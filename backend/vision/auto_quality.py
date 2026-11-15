"""Camera tự hạ chất lượng JPEG khi khung/s tụt, tự nâng lại khi sóng khoẻ (15/11/2026).

Vì sao có file này — số đo các chuyến 02/11/2026 (`plans/reports/261115-...md` mục 5): khung VGA,
JPEG chất lượng 12, ~25 KB/khung, 8 khung/s cần ~1,6 Mbit/s. Trong 15 m đạt 7,6–7,8 khung/s; xa
15–25 m còn 3,1; quá 25 m còn 1,8. Wi-Fi giữa drone và laptop hết băng thông, không phải camera
chụp chậm. Khung nhỏ hơn (số chất lượng LỚN hơn, thang esp32-camera 0–63) thì cùng băng thông đó
chở được nhiều khung hơn. Firmware camera đã có `GET /set?quality=N` đổi được lúc đang chạy, nên
không phải nạp lại camera.

Cách làm (dải trễ, không phải PID — dễ giải thích, dễ đoán):

- Khung/s đo trên cửa sổ `window_s` giây gần nhất, đếm khung thật nhận được.
- Dưới `fps_low` → tăng số chất lượng thêm `step` (khung nhỏ hơn), không quá `worst`.
- Trên `fps_high` liền `recover_s` giây → giảm số `step` (nét hơn), không quá `best`.
- Sau mỗi lần đổi, chờ đủ một cửa sổ mới quyết tiếp (đo trên khung của mức MỚI).
- Lên nét rồi lại phải hạ ngay (đứng đúng ranh giới tầm sóng) → `recover_s` nhân đôi, tối đa
  `recover_max_s`: không lật qua lật lại liên tục. Lên nét mà đứng được thì về lại mức gốc.
- Số đo trên camera thật 15/11/2026 (VGA, cảnh trong nhà): mức 12 → 15,2 KB/khung, 19 → 12,4,
  26 → 11,0, 33 → 10,1, 40 → 9,5, 50 → 8,9, 63 → 10,0 (TO hơn 50). Tức là cách này chỉ làm
  khung nhỏ đi tối đa ~37 %, khung/s lúc xa tăng tối đa ~1,6 lần; muốn hơn phải đổi cỡ khung
  hoặc tầm sóng.
- Không có khung nào trong cửa sổ (mất sóng hẳn) → không đổi gì: mất link không phải thiếu
  băng thông.

Mức chất lượng hiện tại lấy từ nhãn `X-Jpeg-Quality` của khung mới nhất (firmware chỉ đổi nhãn khi
khung thật đã nén ở mức mới), không lưu bản sao phía backend: backend khởi động lại giữa buổi bay
vẫn biết camera đang ở mức nào.

Hỏng gì ở đây cũng KHÔNG được làm mất hình (SAFETY.md mục 9): gọi `/set` lỗi thì ghi log, chờ một
cửa sổ rồi thử lại. Tắt hẳn: `CAMERA_AUTO_QUALITY=0`.
"""

from __future__ import annotations

import collections
import json
import logging
import threading
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

from backend import config
from backend.events import BUS
from backend.vision.stream import MjpegFrame, MjpegLatestFrameReader

log = logging.getLogger(__name__)

# Thang chất lượng của esp32-camera (firmware/camera/src/main.cpp JPEG_QUALITY_MIN/MAX).
QUALITY_MIN = 0
QUALITY_MAX = 63
_TICK_S = 1.0
_HTTP_TIMEOUT_S = 2.0
# Đủ cho cửa sổ 3 s ở 30 khung/s với dư nhiều; camera VGA thật chỉ ~9 khung/s.
_MAX_TIMES = 1024


@dataclass(frozen=True)
class AutoQualitySettings:
    best: int
    worst: int
    step: int
    fps_low: float
    fps_high: float
    window_s: float
    recover_s: float
    recover_max_s: float

    @classmethod
    def from_config(cls) -> AutoQualitySettings:
        return cls(
            best=config.CAMERA_QUALITY_BEST,
            worst=config.CAMERA_QUALITY_WORST,
            step=config.CAMERA_QUALITY_STEP,
            fps_low=config.CAMERA_AUTO_FPS_LOW,
            fps_high=config.CAMERA_AUTO_FPS_HIGH,
            window_s=config.CAMERA_AUTO_WINDOW_S,
            recover_s=config.CAMERA_AUTO_RECOVER_S,
            recover_max_s=config.CAMERA_AUTO_RECOVER_MAX_S,
        )

    def problems(self) -> list[str]:
        """Cấu hình sai thì liệt kê ra (rỗng = dùng được)."""
        out = []
        if not QUALITY_MIN <= self.best <= self.worst <= QUALITY_MAX:
            out.append(
                f"cần {QUALITY_MIN} <= CAMERA_QUALITY_BEST ({self.best}) <= "
                f"CAMERA_QUALITY_WORST ({self.worst}) <= {QUALITY_MAX}"
            )
        if self.step < 1:
            out.append(f"CAMERA_QUALITY_STEP ({self.step}) phải >= 1")
        if not 0 < self.fps_low < self.fps_high:
            out.append(
                f"cần 0 < CAMERA_AUTO_FPS_LOW ({self.fps_low}) < "
                f"CAMERA_AUTO_FPS_HIGH ({self.fps_high})"
            )
        if self.window_s <= 0:
            out.append(f"CAMERA_AUTO_WINDOW_S ({self.window_s}) phải > 0")
        if not 0 < self.recover_s <= self.recover_max_s:
            out.append(
                f"cần 0 < CAMERA_AUTO_RECOVER_S ({self.recover_s}) <= "
                f"CAMERA_AUTO_RECOVER_MAX_S ({self.recover_max_s})"
            )
        return out


class AutoQualityPolicy:
    """Phần quyết định, không I/O. `decide()` đề xuất; chỉ `commit()` (sau khi camera đã nhận)
    mới đổi trạng thái — gọi `/set` hỏng thì như chưa từng đổi."""

    def __init__(self, settings: AutoQualitySettings) -> None:
        self.settings = settings
        self.recover_s = settings.recover_s
        self._hold_until = float("-inf")
        self._high_since: float | None = None
        self._last_change_at: float | None = None
        self._last_was_finer = False

    def decide(self, now: float, fps: float | None, quality: int | None) -> int | None:
        """Mức chất lượng nên đặt, hoặc None = giữ nguyên."""
        s = self.settings
        if fps is None or quality is None:
            self._high_since = None
            return None
        if now < self._hold_until:
            return None
        if fps < s.fps_low:
            self._high_since = None
            return min(quality + s.step, s.worst) if quality < s.worst else None
        if (
            self._last_was_finer
            and self._last_change_at is not None
            and now - self._last_change_at >= self.recover_s
        ):
            # Lần lên nét trước đứng được trọn một quãng chờ: bỏ phạt, về nhịp gốc.
            self.recover_s = s.recover_s
            self._last_was_finer = False
        if fps <= s.fps_high or quality <= s.best:
            self._high_since = None
            return None
        if self._high_since is None:
            self._high_since = now
        if now - self._high_since < self.recover_s:
            return None
        return max(quality - s.step, s.best)

    def commit(self, now: float, old: int, new: int) -> None:
        """Camera đã nhận mức `new`."""
        if new > old and self._last_was_finer:
            # Vừa lên nét đã phải hạ lại: đang đứng ở ranh giới, chờ lâu gấp đôi trước lần sau.
            self.recover_s = min(self.recover_s * 2, self.settings.recover_max_s)
        self._last_was_finer = new < old
        self._last_change_at = now
        self.defer(now)

    def defer(self, now: float) -> None:
        """Không quyết gì thêm trong một cửa sổ (sau khi đổi, hoặc sau khi gọi camera hỏng)."""
        self._hold_until = now + self.settings.window_s
        self._high_since = None


class CameraQualityController:
    """Nghe mọi khung của reader, mỗi `tick_s` giây đo khung/s rồi gọi `/set` khi cần.

    `on_frame` chạy trên thread đọc camera nên chỉ ghi giờ rồi trả về; gọi HTTP nằm ở thread riêng.
    """

    def __init__(
        self,
        reader: MjpegLatestFrameReader,
        settings: AutoQualitySettings,
        control_url: str,
        *,
        setter: Callable[[int], bool] | None = None,
        clock: Callable[[], float] = time.monotonic,
        tick_s: float = _TICK_S,
    ) -> None:
        self.reader = reader
        self.policy = AutoQualityPolicy(settings)
        self.control_url = control_url.rstrip("/")
        self._set = setter or self._http_set
        self._clock = clock
        self.tick_s = tick_s
        self._lock = threading.Lock()
        self._times: collections.deque[float] = collections.deque(maxlen=_MAX_TIMES)
        self._first_at: float | None = None
        self._quality: int | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._set_failing = False
        self.changes = 0

    # -- đo ------------------------------------------------------------------
    def on_frame(self, frame: MjpegFrame) -> None:
        with self._lock:
            self._times.append(frame.received_at)
            if self._first_at is None:
                self._first_at = frame.received_at
            if frame.jpeg_quality is not None:
                self._quality = frame.jpeg_quality

    def fps(self, now: float) -> float | None:
        """Khung/s trong cửa sổ gần nhất; None khi chưa đo đủ một cửa sổ hoặc không có khung nào."""
        window = self.policy.settings.window_s
        with self._lock:
            if self._first_at is None or now - self._first_at < window:
                return None
            n = sum(1 for t in self._times if now - t <= window)
        return n / window if n else None

    @property
    def quality(self) -> int | None:
        with self._lock:
            return self._quality

    # -- một nhịp ------------------------------------------------------------
    def step(self, now: float | None = None) -> int | None:
        """Đo, quyết, gửi. Trả mức mới khi camera đã nhận, None nếu giữ nguyên hoặc gửi hỏng."""
        now = self._clock() if now is None else now
        fps = self.fps(now)
        old = self.quality
        new = self.policy.decide(now, fps, old)
        if new is None or old is None or new == old:
            return None
        if not self._set(new):
            self.policy.defer(now)
            return None
        self.policy.commit(now, old, new)
        self.changes += 1
        nang = new < old
        message = (
            f"Camera {'nâng' if nang else 'hạ'} chất lượng JPEG {old} → {new} "
            f"({fps:.1f} khung/s {'>' if nang else '<'} "
            f"{self.policy.settings.fps_high if nang else self.policy.settings.fps_low:g})"
        )
        log.info(message)
        BUS.emit(
            "info",
            "vision",
            "camera.quality",
            message,
            {"from": old, "to": new, "fps": round(fps or 0.0, 2)},
        )
        return new

    def _http_set(self, quality: int) -> bool:
        url = f"{self.control_url}/set?quality={quality}"
        try:
            with urllib.request.urlopen(url, timeout=_HTTP_TIMEOUT_S) as resp:  # noqa: S310
                body = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 — camera không nhận thì giữ mức cũ, không ném ra
            if not self._set_failing:
                log.warning("Không đổi được chất lượng camera (%s): %s. Sẽ thử lại.", url, exc)
            self._set_failing = True
            return False
        if body.get("quality") != quality:
            log.warning("Camera trả lời lạ khi đặt chất lượng %d: %r", quality, body)
            return False
        self._set_failing = False
        return True

    # -- vòng đời --------------------------------------------------------------
    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self.reader.subscribe(self.on_frame)
        self._thread = threading.Thread(target=self._run, name="camera-auto-quality", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 3.0) -> None:
        self._stop.set()
        self.reader.unsubscribe(self.on_frame)
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
            if not thread.is_alive():
                self._thread = None

    def _run(self) -> None:
        while not self._stop.wait(self.tick_s):
            try:
                self.step()
            except Exception:  # noqa: BLE001 — vòng này chết thì mất tự chỉnh, không được mất hình
                log.exception("Vòng tự chỉnh chất lượng camera lỗi, bỏ qua nhịp này")


def make_controller(reader: MjpegLatestFrameReader) -> CameraQualityController | None:
    """Bộ tự chỉnh cho camera thật, hoặc None (có ghi log lý do) khi tắt / không dùng được."""
    if not config.CAMERA_AUTO_QUALITY:
        return None
    url = config.camera_control_url()
    if url is None:
        log.info("Tự chỉnh chất lượng camera: không chạy với nguồn video giả hoặc URL camera lạ.")
        return None
    settings = AutoQualitySettings.from_config()
    problems = settings.problems()
    if problems:
        log.error("Tự chỉnh chất lượng camera TẮT vì cấu hình sai: %s", "; ".join(problems))
        return None
    return CameraQualityController(reader, settings, url)
