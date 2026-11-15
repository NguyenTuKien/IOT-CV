"""Ghi luồng camera thành video ngay trên laptop — thay cho thẻ nhớ (01/11/2026).

Bo camera ESP32-S3 có khe microSD nhưng người dùng không có thẻ, nên chỗ DUY NHẤT giữ được
hình là laptop: mọi khung camera gửi về qua Wi-Fi được ghi ở đây. Cái giá phải biết: khung
nào rơi trên đường Wi-Fi thì mất luôn, và chất lượng chỉ bằng luồng xem trực tiếp (VGA,
~7–8 khung/giây).

Mỗi lần ghi là một thư mục `RECORD_DIR/<YYYYMMDD-HHMMSS>/`:

    video-001.avi, video-002.avi …   MJPEG trong AVI (avi_writer.py)
    frames.csv                       mỗi khung: đoạn, số thứ tự trong đoạn, giờ nhận,
                                     frame_id, cỡ, vị trí drone

Ghi ĐỦ mọi khung và không nén lại. Bộ ghi đăng ký nhận từng khung từ reader chứ không lấy
mẫu `latest()` theo nhịp: camera gửi ~7–8,5 khung/giây, lấy mẫu 8 lần/giây là rơi khung.
JPEG camera gửi được chép nguyên vào AVI, mỗi khung camera đúng một khung video. Giờ chính
xác của từng khung nằm ở frames.csv.

Mất hình ngắn (quá `_LAP_TU_S` nhưng chưa quá `RECORD_GAP_S`) thì khi có hình lại, khung
cuối trước quãng mất được chép thêm cho kín quãng đó, theo fps của đoạn: video phát đúng giờ
thật, hình đứng yên đúng lúc camera mất sóng. Khung chép thêm KHÔNG có dòng trong frames.csv
— cột `video_frame` nhảy cóc qua chúng, nên vẫn tra được khung thật nào ở đâu. Trước đây mọi
quãng mất > 2 s đều mở file mới: tối 01/11/2026 camera rớt Wi-Fi vài giây một lần, một buổi
33 phút ra 223 file AVI.

Mất hình lâu hơn `RECORD_GAP_S` thì đóng đoạn đang ghi, có hình lại mở đoạn mới — không chép
khung đứng yên cho cả phút camera tắt. Đổi cỡ khung hoặc quá `RECORD_SEGMENT_S` cũng mở đoạn
mới: file nhỏ, laptop có tắt ngang thì chỉ mất vài giây cuối.

SAFETY.md mục 9: ghi hình hỏng không được kéo telemetry hay điều khiển theo. Việc của bộ ghi
trên thread đọc camera chỉ là bỏ khung vào hàng đợi (đầy thì bỏ khung và đếm, không bao giờ
chờ); ghi đĩa ở thread riêng. Không bao giờ ném lỗi ra ngoài — hỏng thì tự dừng và để lý do
ở `status()["reason"]`.
"""

from __future__ import annotations

import contextlib
import csv
import logging
import queue
import shutil
import threading
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any

from backend import config
from backend.vision.avi_writer import MjpegAviWriter, jpeg_complete, jpeg_size

log = logging.getLogger(__name__)

CSV_HEADER = [
    "segment",
    "video_frame",
    "unix_time",
    "frame_id",
    "width",
    "height",
    "lat",
    "lon",
    "rel_alt_m",
    "heading_deg",
    "mode",
    "armed",
    # Nhãn X-Jpeg-Quality của khung (từ 15/11/2026): thấy được lúc camera tự hạ/nâng chất lượng.
    "jpeg_quality",
]
# Hàng đợi giữa thread đọc camera và thread ghi: ~8 s hình ở 8 khung/giây. Đĩa kẹt lâu hơn
# thế thì khung bị bỏ và đếm ở `dropped_frames`; camera vẫn chạy.
QUEUE_FRAMES = 64
# fps ghi vào đầu đoạn mới cho tới khi đo được (cần hai khung) — tốc độ thường gặp của
# camera thật ở VGA.
_FPS_TAM = 8.0
# Thread ghi thức dậy ít nhất chừng này giây một lần dù không có khung: để thấy mất hình.
_WAKE_S = 0.25
_DISK_CHECK_S = 10.0
# Vá đầu file AVI + đẩy CSV xuống đĩa: laptop tắt ngang chỉ mất chừng này giây cuối.
_FLUSH_S = 2.0
# AVI 1.0 dùng số 32 bit và nhiều trình đọc vấp từ 1 GB: tới đây thì sang đoạn mới.
_MAX_SEGMENT_BYTES = 1_000_000_000
# Hai khung cách nhau quá chừng này giây là mất hình: chép lại khung cuối cho kín quãng đó.
# Ngắn hơn là nhịp camera không đều bình thường, để fps trung bình của đoạn lo.
_LAP_TU_S = 1.0
_CHO_HINH = "Đang chờ hình từ camera"


class VideoRecorder:
    """Ghi MỌI khung của một `MjpegLatestFrameReader` thành các đoạn AVI.

    `telemetry` trả telemetry hiện tại (thuộc tính `lat`, `lon`, `relative_alt`, `heading`,
    `mode`, `armed`) để ghi kèm từng khung vào `frames.csv`; None thì để trống các cột đó.
    """

    def __init__(
        self,
        reader,
        *,
        telemetry: Callable[[], Any] | None = None,
        out_dir: str | Path | None = None,
        segment_s: float | None = None,
        gap_s: float | None = None,
        min_free_gb: float | None = None,
        clock: Callable[[], float] = time.monotonic,
        wall: Callable[[], float] = time.time,
    ) -> None:
        self.reader = reader
        self.telemetry = telemetry
        self.out_dir = Path(out_dir or config.RECORD_DIR)
        self.segment_s = config.RECORD_SEGMENT_S if segment_s is None else segment_s
        self.gap_s = config.RECORD_GAP_S if gap_s is None else gap_s
        self.min_free_gb = config.RECORD_MIN_FREE_GB if min_free_gb is None else min_free_gb
        self._clock = clock
        self._wall = wall

        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._queue: queue.Queue = queue.Queue(maxsize=QUEUE_FRAMES)

        self._reset_counters()
        self.reason: str | None = None

    # -- trạng thái ------------------------------------------------------------
    def _reset_counters(self) -> None:
        self.session_dir: Path | None = None
        self.segment_file: Path | None = None
        self.segments = 0
        self.frames_written = 0
        self.bad_frames = 0  # JPEG thiếu đầu/đuôi hoặc không đọc được cỡ: bỏ
        self.dropped_frames = 0  # hàng đợi đầy (đĩa kẹt): bỏ
        self.started_at: float | None = None
        self.last_frame_at: float | None = None
        self._bytes_closed = 0
        self._writer: MjpegAviWriter | None = None
        self._size: tuple[int, int] | None = None
        self._seg_started = 0.0
        self._last_received = 0.0
        self._last_jpeg: bytes | None = None  # khung cuối của đoạn đang ghi, để lấp quãng mất
        self._csv_file = None
        self._csv = None
        self._next_disk_check = 0.0
        self._next_flush = 0.0

    @property
    def running(self) -> bool:
        thread = self._thread
        return thread is not None and thread.is_alive()

    def status(self) -> dict[str, Any]:
        with self._lock:
            running = self.running
            writing = self._writer is not None
            reason = self.reason
            if running and not writing and reason is None:
                reason = _CHO_HINH
            current = self._writer.bytes_written if self._writer is not None else 0
            return {
                "auto": config.RECORD_VIDEO,
                "running": running,
                "writing": writing,
                "session_dir": str(self.session_dir) if self.session_dir else None,
                "segment_file": str(self.segment_file) if self.segment_file else None,
                "segments": self.segments,
                "frames_written": self.frames_written,
                "bad_frames": self.bad_frames,
                "dropped_frames": self.dropped_frames,
                "bytes_written": self._bytes_closed + current,
                "started_at": self.started_at,
                "last_frame_at": self.last_frame_at,
                "reason": reason,
            }

    # -- vòng đời --------------------------------------------------------------
    def start(self) -> dict[str, Any]:
        """Bắt đầu một lần ghi mới (thư mục mới). Đang ghi thì không làm gì."""
        if self.running:
            return self.status()
        if self.reader is None:
            self.reason = "Khối vision đang tắt (VISION_ENABLED=0), không có camera để ghi"
            return self.status()
        if not self._begin_session():
            return self.status()
        self._stop.clear()
        self.reader.subscribe(self._on_frame)
        self._thread = threading.Thread(target=self._run, name="video-recorder", daemon=True)
        self._thread.start()
        return self.status()

    def stop(self, timeout: float = 5.0, reason: str | None = "Đã tắt ghi hình") -> dict[str, Any]:
        """Dừng ghi. Khung còn trong hàng đợi được ghi nốt trước khi đóng file."""
        if self.reader is not None:
            self.reader.unsubscribe(self._on_frame)
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
            if not thread.is_alive():
                self._thread = None
        self._end_session(reason)
        return self.status()

    def _begin_session(self) -> bool:
        """Đặt lại bộ đếm, bỏ khung cũ còn trong hàng đợi, kiểm chỗ trống. Thư mục chỉ được
        tạo khi có khung đầu tiên (`_ensure_session`): backend bật mà camera chưa lên thì
        không sinh thư mục rỗng."""
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        with self._lock:
            self._reset_counters()
            self.reason = None
            if not self._du_cho_trong(self.out_dir):
                return False
            self.started_at = self._wall()
        return True

    def _on_frame(self, frame) -> None:
        """Chạy trên thread đọc camera: chỉ bỏ khung vào hàng đợi, không bao giờ chờ."""
        try:
            self._queue.put_nowait(frame)
        except queue.Full:
            self.dropped_frames += 1

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                frame = self._queue.get(timeout=_WAKE_S)
            except queue.Empty:
                frame = None
            if not self._step_an_toan(frame):
                break
        else:
            # Dừng theo yêu cầu: ghi nốt khung đã vào hàng đợi rồi mới đóng file.
            while True:
                try:
                    frame = self._queue.get_nowait()
                except queue.Empty:
                    break
                if not self._step_an_toan(frame):
                    break
        self._end_session(None)

    def _step_an_toan(self, frame) -> bool:
        """`_step` dưới khoá; lỗi bị giữ lại thành `reason`. False = phải dừng ghi."""
        try:
            with self._lock:
                self._step(frame, self._clock())
        except Exception as exc:  # noqa: BLE001 — ghi hình hỏng KHÔNG được ném ra ngoài
            log.exception("Ghi video hỏng, dừng ghi")
            self.reason = f"Lỗi khi ghi video: {exc}"
            return False
        return self.reason is None  # _step tự dừng (đầy đĩa…) thì có reason

    def _ensure_session(self) -> None:
        """Tạo thư mục của lần ghi + frames.csv ngay trước đoạn video đầu tiên."""
        if self.session_dir is not None:
            return
        session = self.out_dir / datetime.now().strftime("%Y%m%d-%H%M%S")
        session.mkdir(parents=True, exist_ok=True)
        self._csv_file = open(session / "frames.csv", "a", newline="", encoding="utf-8")  # noqa: SIM115
        self._csv = csv.writer(self._csv_file)
        if self._csv_file.tell() == 0:
            self._csv.writerow(CSV_HEADER)
        self.session_dir = session
        log.info("Ghi video camera vào %s", session)

    def _end_session(self, reason: str | None) -> None:
        with self._lock:
            self._close_segment()
            if self._csv_file is not None:
                with contextlib.suppress(OSError):
                    self._csv_file.close()
                self._csv_file = None
                self._csv = None
            if reason is not None and self.reason is None:
                self.reason = reason

    # -- một bước ----------------------------------------------------------------
    def _step(self, frame, now: float) -> None:
        """Một bước của thread ghi: `frame` là khung mới, None = chờ hết `_WAKE_S` mà không
        có khung. Gọi khi đã giữ `_lock` (thread ghi, hoặc test gọi thẳng)."""
        if now >= self._next_disk_check:
            self._next_disk_check = now + _DISK_CHECK_S
            if not self._du_cho_trong(self.out_dir):
                self._close_segment()
                return
        if frame is not None:
            self._ghi_khung(frame, now)
        elif self._writer is not None and now - self._last_received > self.gap_s:
            log.info("Mất hình camera > %.1f s, đóng đoạn %s", self.gap_s, self.segment_file)
            self._close_segment()
        if self._writer is not None and now >= self._next_flush:
            self._next_flush = now + _FLUSH_S
            self._writer.flush()
            if self._csv_file is not None:
                self._csv_file.flush()

    def _ghi_khung(self, frame, now: float) -> None:
        jpeg = frame.jpeg
        size = jpeg_size(jpeg) if jpeg_complete(jpeg) else None
        if size is None:
            self.bad_frames += 1
            return
        t = frame.received_at
        writer = self._writer
        if writer is not None and (
            size != self._size
            or t - self._last_received > self.gap_s
            or t - self._seg_started >= self.segment_s
            or writer.bytes_written >= _MAX_SEGMENT_BYTES
        ):
            self._close_segment()
        if self._writer is None:
            self._open_segment(size, t, now)
        else:
            self._lap_quang_mat_hinh(t)
        # Giờ nhận thật của khung: khung có thể đã nằm trong hàng đợi một lúc.
        unix_time = self._wall() - (now - t)
        self._ghi_csv(frame, size, unix_time)
        self._writer.write_jpeg(jpeg, t)
        self.frames_written += 1
        self._last_received = t
        self._last_jpeg = jpeg
        self.last_frame_at = unix_time

    def _lap_quang_mat_hinh(self, t: float) -> None:
        """Khung mới đến sau quãng mất hình > `_LAP_TU_S` (chưa đủ dài để sang đoạn mới):
        chép lại khung cuối vào quãng đó theo fps của đoạn, để video giữ đúng giờ thật."""
        gap = t - self._last_received
        if gap <= _LAP_TU_S or self._last_jpeg is None:
            return
        fps = self._writer.fps
        for k in range(1, int(gap * fps)):
            self._writer.write_jpeg(self._last_jpeg, self._last_received + k / fps)

    def _open_segment(self, size: tuple[int, int], t: float, now: float) -> None:
        self._ensure_session()
        path = self.session_dir / f"video-{self.segments + 1:03d}.avi"
        self._writer = MjpegAviWriter(path, _FPS_TAM, *size)
        self.segments += 1
        self.segment_file = path
        self._size = size
        self._seg_started = t
        self._last_jpeg = None
        self._next_flush = now + _FLUSH_S

    def _close_segment(self) -> None:
        writer = self._writer
        if writer is None:
            return
        self._writer = None
        try:
            writer.close()  # ghi chỉ mục idx1 — thiếu nó file vẫn xem được nhưng không tua được
        except OSError as exc:
            log.warning("Không đóng trọn được %s: %s", writer.path, exc)
            if self.reason is None:
                self.reason = f"Lỗi khi đóng file video: {exc}"
        self._bytes_closed += writer.bytes_written
        if self._csv_file is not None:
            with contextlib.suppress(OSError):
                self._csv_file.flush()

    def _ghi_csv(self, frame, size: tuple[int, int], unix_time: float) -> None:
        if self._csv is None:
            return
        t = None
        if self.telemetry is not None:
            try:
                t = self.telemetry()
            except Exception:  # noqa: BLE001 — thiếu telemetry thì để trống cột, vẫn ghi hình
                t = None
        self._csv.writerow(
            [
                self.segments,
                self._writer.frames,  # số thứ tự (từ 0) của khung này trong file video
                f"{unix_time:.3f}",
                "" if frame.frame_id is None else frame.frame_id,
                size[0],
                size[1],
                _cot(t, "lat"),
                _cot(t, "lon"),
                _cot(t, "relative_alt"),
                _cot(t, "heading"),
                _cot(t, "mode"),
                _cot(t, "armed"),
                "" if frame.jpeg_quality is None else frame.jpeg_quality,
            ]
        )

    def _du_cho_trong(self, path: Path) -> bool:
        # Thư mục ghi có thể chưa tồn tại (tạo khi có khung đầu): đo ở thư mục cha gần nhất.
        while not path.exists() and path.parent != path:
            path = path.parent
        try:
            free_gb = shutil.disk_usage(path).free / 1e9
        except OSError:
            return True  # không đo được thì cứ ghi, lỗi ghi thật sẽ tự báo
        if free_gb < self.min_free_gb:
            self.reason = (
                f"Ổ đĩa chỉ còn {free_gb:.1f} GB (< {self.min_free_gb:g} GB) — dừng ghi hình"
            )
            return False
        return True


def _cot(t, name: str):
    """Giá trị một cột telemetry cho CSV; thiếu thì chuỗi rỗng."""
    value = getattr(t, name, None) if t is not None else None
    return "" if value is None else value
