"""Ghi file AVI MJPEG từ chính các khung JPEG camera gửi về — KHÔNG nén lại.

Vì sao tự ghi AVI thay vì `cv2.VideoWriter` (đo 01/11/2026, OpenCV 5.0, VGA): bộ mã MJPEG
có sẵn của OpenCV nén kém — đặt chất lượng 60 vẫn ra ~46 KB/khung, trong khi JPEG chuẩn ở
mức đó chỉ ~17 KB; truyền chất lượng qua `params` lúc tạo thì không ăn (95 hay 60 đều
51,6 KB). Bản ghi thử 53 giây ra 64 MB/phút. Camera ESP32-S3 vốn đã gửi JPEG: chép nguyên
khung vào AVI thì không mất thêm chất lượng, không tốn CPU giải mã/nén, file nhỏ bằng đúng
luồng Wi-Fi, và không cần OpenCV.

Mỗi khung camera là một khung video, kèm thời điểm nhận. Camera không gửi đều nhịp, nên số
khung/giây trong phần đầu file là số ĐO được từ các thời điểm đó (khung đầu tới khung cuối),
vá lại mỗi lần `flush()` / `close()`: phát lại đúng tốc độ trung bình.

Không dùng chunk rỗng (quy ước "khung bị rớt" của AVI) để giữ nhịp cố định: OpenCV/ffmpeg
đọc ra số khung khác số khung khai báo, và chưa kiểm được trình phát của Windows xử lý ra
sao. Mọi khung đều là JPEG đầy đủ — loại AVI MJPEG thường nhất.

Cấu trúc (AVI 1.0, một luồng video):

    RIFF 'AVI '
      LIST 'hdrl'  avih · LIST 'strl' (strh · strf)
      LIST 'movi'  00dc · 00dc · …
      idx1         (ghi lúc đóng file)

`flush()` vá phần đầu file (số khung, fps, cỡ RIFF/movi) và đẩy dữ liệu xuống đĩa: gọi đều
đặn thì laptop có tắt ngang, file vẫn đọc tuần tự được tới lần `flush()` cuối, chỉ thiếu chỉ
mục để tua.
"""

from __future__ import annotations

import struct
from pathlib import Path

# Số khung/giây đo được bị kẹp trong khoảng này: hai khung đến sát nhau ở đầu đoạn không
# được biến thành video 1000 khung/giây.
FPS_MIN = 0.5
FPS_MAX = 60.0

_AVIF_HASINDEX = 0x10
_AVIIF_KEYFRAME = 0x10
_FPS_SCALE = 1000  # dwRate / dwScale = fps, nên fps lẻ (7,4) vẫn ghi đúng
# Vị trí cố định trong phần đầu file (bố cục ở `_header`, có assert giữ). avih: µs/khung,
# byte/giây tối đa, tổng khung, cỡ bộ đệm gợi ý. strh: dwRate, độ dài luồng, cỡ bộ đệm gợi
# ý. Rồi cỡ RIFF, cỡ LIST movi, vị trí chữ 'movi' (offset trong idx1 tính từ đây).
_OFF_RIFF_SIZE = 4
_OFF_AVIH_US_PER_FRAME = 32
_OFF_AVIH_MAXBPS = 36
_OFF_AVIH_TOTAL = 48
_OFF_AVIH_SUGGEST = 60
_OFF_STRH_RATE = 132
_OFF_STRH_LENGTH = 140
_OFF_STRH_SUGGEST = 144
_OFF_MOVI_SIZE = 216
_OFF_MOVI_TYPE = 220
_HEADER_BYTES = 224

# SOF0..SOF15, trừ DHT (C4), JPG (C8), DAC (CC) — các segment mang cỡ ảnh.
_SOF_MARKERS = frozenset(range(0xC0, 0xD0)) - {0xC4, 0xC8, 0xCC}


def jpeg_size(data: bytes) -> tuple[int, int] | None:
    """(rộng, cao) đọc từ segment SOF của JPEG; None nếu không phải JPEG đọc được.

    Không giải mã ảnh — chỉ đi qua các marker tới SOF."""
    n = len(data)
    if n < 4 or data[0] != 0xFF or data[1] != 0xD8:
        return None
    i = 2
    while i + 4 <= n:
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:  # byte độn giữa hai marker
            i += 1
            continue
        if marker == 0x01 or 0xD0 <= marker <= 0xD8:  # marker đứng một mình, không có độ dài
            i += 2
            continue
        if marker in (0xD9, 0xDA):  # hết ảnh / bắt đầu dữ liệu nén mà chưa thấy SOF
            return None
        seg_len = int.from_bytes(data[i + 2 : i + 4], "big")
        if marker in _SOF_MARKERS:
            if i + 9 > n:
                return None
            h = int.from_bytes(data[i + 5 : i + 7], "big")
            w = int.from_bytes(data[i + 7 : i + 9], "big")
            return (w, h) if w and h else None
        if seg_len < 2:
            return None
        i += 2 + seg_len
    return None


def jpeg_complete(data: bytes) -> bool:
    """Khung có đủ đầu (SOI) và đuôi (EOI) không. Khung JPEG đứt giữa chừng không được chép
    vào video — nó hiện thành một mảng vỡ."""
    return len(data) >= 4 and data[:2] == b"\xff\xd8" and data.rstrip(b"\x00").endswith(b"\xff\xd9")


class MjpegAviWriter:
    """Ghi tuần tự các khung JPEG cùng cỡ vào một file AVI.

    `fps` chỉ là số tạm cho tới khi có hai khung để đo."""

    def __init__(self, path: str | Path, fps: float, width: int, height: int) -> None:
        self.path = Path(path)
        self.width = int(width)
        self.height = int(height)
        self.frames = 0
        self._fps_tam = min(max(float(fps), FPS_MIN), FPS_MAX)
        self._t_first: float | None = None
        self._t_last: float | None = None
        self._index: list[bytes] = []
        self._max_chunk = 0
        self._final_bytes = 0
        self._f = open(self.path, "wb")  # noqa: SIM115 — đóng ở close()
        self._f.write(self._header())

    @property
    def fps(self) -> float:
        """Số khung/giây đo từ thời điểm nhận khung đầu và khung cuối."""
        if self.frames < 2 or self._t_last <= self._t_first:
            return self._fps_tam
        fps = (self.frames - 1) / (self._t_last - self._t_first)
        return min(max(fps, FPS_MIN), FPS_MAX)

    @property
    def bytes_written(self) -> int:
        return self._f.tell() if self._f is not None else self._final_bytes

    def write_jpeg(self, jpeg: bytes, t: float) -> None:
        """Thêm một khung; `t` là thời điểm nhận khung (giây, đồng hồ đơn điệu)."""
        f = self._f
        offset = f.tell() - _OFF_MOVI_TYPE
        f.write(b"00dc" + struct.pack("<I", len(jpeg)) + jpeg)
        if len(jpeg) % 2:
            f.write(b"\x00")  # chunk RIFF phải chẵn byte
        self._index.append(struct.pack("<4sIII", b"00dc", _AVIIF_KEYFRAME, offset, len(jpeg)))
        self._max_chunk = max(self._max_chunk, len(jpeg))
        self.frames += 1
        if self._t_first is None:
            self._t_first = t
        self._t_last = t

    def flush(self) -> None:
        """Vá phần đầu theo số khung hiện có và đẩy xuống đĩa (chưa có idx1)."""
        if self._f is not None:
            self._patch_header(index_bytes=0)

    def close(self) -> None:
        """Ghi idx1, vá phần đầu, đóng file. Gọi lại lần nữa thì không làm gì."""
        f = self._f
        if f is None:
            return
        try:
            f.seek(0, 2)
            index = b"".join(self._index)
            f.write(b"idx1" + struct.pack("<I", len(index)) + index)
            self._patch_header(index_bytes=8 + len(index))
            self._final_bytes = f.tell()
        finally:
            self._f = None
            f.close()

    def _patch_header(self, *, index_bytes: int) -> None:
        f = self._f
        end = f.seek(0, 2)
        fps = self.fps
        suggest = self._max_chunk + 8
        for off, value in (
            (_OFF_RIFF_SIZE, end - 8),
            (_OFF_AVIH_US_PER_FRAME, round(1_000_000 / fps)),
            (_OFF_AVIH_MAXBPS, round(suggest * fps)),
            (_OFF_AVIH_TOTAL, self.frames),
            (_OFF_AVIH_SUGGEST, suggest),
            (_OFF_STRH_RATE, round(fps * _FPS_SCALE)),
            (_OFF_STRH_LENGTH, self.frames),
            (_OFF_STRH_SUGGEST, suggest),
            (_OFF_MOVI_SIZE, end - index_bytes - _OFF_MOVI_TYPE),
        ):
            f.seek(off)
            f.write(struct.pack("<I", value))
        f.seek(0, 2)
        f.flush()

    def _header(self) -> bytes:
        w, h = self.width, self.height
        fps = self._fps_tam
        avih = struct.pack(
            "<IIIIIIIIII16x",
            round(1_000_000 / fps),  # dwMicroSecPerFrame (vá lại theo fps đo)
            0,  # dwMaxBytesPerSec (vá sau)
            0,  # dwPaddingGranularity
            _AVIF_HASINDEX,
            0,  # dwTotalFrames (vá sau)
            0,  # dwInitialFrames
            1,  # dwStreams
            0,  # dwSuggestedBufferSize (vá sau)
            w,
            h,
        )
        strh = struct.pack(
            "<4s4sIHHIIIIIIIIhhhh",
            b"vids",
            b"MJPG",
            0,  # dwFlags
            0,  # wPriority
            0,  # wLanguage
            0,  # dwInitialFrames
            _FPS_SCALE,  # dwScale
            round(fps * _FPS_SCALE),  # dwRate (vá lại theo fps đo)
            0,  # dwStart
            0,  # dwLength (vá sau)
            0,  # dwSuggestedBufferSize (vá sau)
            0xFFFFFFFF,  # dwQuality = -1 (mặc định)
            0,  # dwSampleSize (video: 0)
            0,
            0,
            w,
            h,
        )
        strf = struct.pack("<IiiHH4sIiiII", 40, w, h, 1, 24, b"MJPG", w * h * 3, 0, 0, 0, 0)
        strl = b"strl" + _ck(b"strh", strh) + _ck(b"strf", strf)
        hdrl = b"hdrl" + _ck(b"avih", avih) + b"LIST" + struct.pack("<I", len(strl)) + strl
        head = (
            b"RIFF"
            + struct.pack("<I", 0)  # cỡ RIFF (vá sau)
            + b"AVI "
            + b"LIST"
            + struct.pack("<I", len(hdrl))
            + hdrl
            + b"LIST"
            + struct.pack("<I", 4)  # cỡ movi (vá sau)
            + b"movi"
        )
        assert len(head) == _HEADER_BYTES, len(head)  # các _OFF_* ở trên dựa vào bố cục này
        return head


def _ck(fourcc: bytes, data: bytes) -> bytes:
    return fourcc + struct.pack("<I", len(data)) + data
