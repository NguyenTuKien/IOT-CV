"""AI trên khung ĐÃ GHI cho trang Lịch sử bay: hộp người + ảnh rõ của từng khung, để so với gốc.

Dùng chung model mà `VisionRuntime` đã nạp lúc backend khởi động (không nạp lần hai, không đụng
pipeline của luồng trực tiếp). Detector chạy trên khung GỐC đúng như lúc bay (D5); enhancer chỉ để
người xem so sánh. Kết quả lưu đệm theo (lần ghi, số khung): người xem kéo qua kéo lại một đoạn.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any

import numpy as np

from backend import config
from backend.flights.video import RecordingCache
from backend.schemas import DetectionBox, FlightFrameAI, ImageQuality, VisionModelStatus
from backend.vision.detector import PERSON_LABEL
from backend.vision.model_bundle import FRAME_HEIGHT, FRAME_WIDTH

_CACHE_SIZE = 128
_VISION_OFF = VisionModelStatus(state="disabled", reason="khối vision chưa chạy trong backend")
# Enhancer chạy song song với detector trên cùng khung (hai session ORT riêng, `run` an toàn
# đa luồng): một khung xong sau max(detector, enhancer) thay vì tổng hai bước.
_ENHANCE_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="flight-enhance")


class FrameNotFound(LookupError):
    """Không có lần ghi / khung này, hoặc khung hỏng không giải mã được."""


class EnhancerUnavailable(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class _Enhanced:
    jpeg: bytes
    ms: float
    quality: ImageQuality


def image_quality(img: np.ndarray) -> ImageQuality:
    """Độ sáng, tương phản, độ nét của một khung BGR (xem `ImageQuality`)."""
    import cv2

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return ImageQuality(
        brightness=round(float(gray.mean()), 1),
        contrast=round(float(gray.std()), 1),
        sharpness=round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
    )


class _Lru:
    def __init__(self, size: int) -> None:
        self.size = size
        self._items: OrderedDict[tuple[str, int], Any] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple[str, int]) -> Any:
        with self._lock:
            if key not in self._items:
                return None
            self._items.move_to_end(key)
            return self._items[key]

    def put(self, key: tuple[str, int], value: Any) -> None:
        with self._lock:
            self._items[key] = value
            while len(self._items) > self.size:
                self._items.popitem(last=False)


class FlightFrameAIService:
    def __init__(
        self,
        recordings: RecordingCache,
        vision: Callable[[], Any],
        cache_size: int = _CACHE_SIZE,
    ) -> None:
        self.recordings = recordings
        self._vision = vision
        self._enhanced = _Lru(cache_size)
        self._analysis = _Lru(cache_size)
        # Trang xin số đo và ảnh rõ của cùng khung CÙNG LÚC: lần xin sau chờ lần đang chạy.
        self._enhancing: dict[tuple[str, int], Future[_Enhanced]] = {}
        self._enhancing_lock = threading.Lock()

    def _decode(self, rec: str, n: int) -> np.ndarray:
        import cv2

        item = self.recordings.get(rec)
        jpeg = item.frame(n) if item else None
        if jpeg is None:
            raise FrameNotFound(f"không có khung {n} của lần ghi {rec}")
        img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise FrameNotFound(f"khung {n} của {rec} không giải mã được")
        return img

    def _statuses(self) -> tuple[Any, VisionModelStatus, VisionModelStatus]:
        v = self._vision()
        if v is None:
            return None, _VISION_OFF, _VISION_OFF
        return v, v.detector_status, v.enhancer_status

    @staticmethod
    def _size_note(img: np.ndarray) -> str | None:
        h, w = img.shape[:2]
        if (w, h) == (FRAME_WIDTH, FRAME_HEIGHT):
            return None
        return f"khung {w}×{h}, model cần {FRAME_WIDTH}×{FRAME_HEIGHT}"

    def _enhance(self, rec: str, n: int, img: np.ndarray | None = None) -> _Enhanced:
        """Chạy enhancer trên khung `n` (có đệm, gộp lần xin trùng đang chạy).

        Ném `FrameNotFound` / `EnhancerUnavailable` (lần xin chờ nhận đúng lỗi của lần chạy)."""
        key = (rec, n)
        cached = self._enhanced.get(key)
        if cached is not None:
            return cached
        with self._enhancing_lock:
            running = self._enhancing.get(key)
            if running is None:
                mine: Future[_Enhanced] = Future()
                self._enhancing[key] = mine
        if running is not None:
            return running.result()
        try:
            result = self._enhance_now(rec, n, img)
        except BaseException as exc:
            mine.set_exception(exc)
            raise
        else:
            mine.set_result(result)
            return result
        finally:
            with self._enhancing_lock:
                self._enhancing.pop(key, None)

    def _enhance_now(self, rec: str, n: int, img: np.ndarray | None) -> _Enhanced:
        v, _, enh_status = self._statuses()
        enhancer = getattr(v, "enhancer", None)
        if enhancer is None:
            raise EnhancerUnavailable(enh_status.reason or "enhancer chưa nạp")
        if img is None:
            img = self._decode(rec, n)
        note = self._size_note(img)
        if note:
            raise EnhancerUnavailable(note)
        t0 = time.perf_counter()
        out = enhancer.enhance(img)
        ms = round((time.perf_counter() - t0) * 1000, 1)
        if out is None:
            raise EnhancerUnavailable("enhancer không trả ảnh cho khung này")
        import cv2

        quality = [cv2.IMWRITE_JPEG_QUALITY, config.ENHANCED_JPEG_QUALITY]
        ok, buf = cv2.imencode(".jpg", out, quality)
        if not ok:
            raise EnhancerUnavailable("không nén được JPEG ảnh rõ")
        result = _Enhanced(buf.tobytes(), ms, image_quality(out))
        self._enhanced.put((rec, n), result)
        return result

    def enhanced_jpeg(self, rec: str, n: int) -> bytes:
        """JPEG khung `n` sau enhancer. Ném `FrameNotFound` / `EnhancerUnavailable`."""
        return self._enhance(rec, n).jpeg

    def analyze(self, rec: str, n: int, detect: bool = True) -> FlightFrameAI:
        """Hộp người trên khung gốc `n`, số đo ảnh gốc / ảnh rõ, trạng thái hai model.

        `detect=False`: bỏ detector, chỉ enhancer + số đo (người xem tắt hộp người: ảnh rõ theo
        video nhanh gần gấp đôi). Ném `FrameNotFound`."""
        cached = self._analysis.get((rec, n))
        if cached is not None:
            return cached
        v, det_status, enh_status = self._statuses()
        img = self._decode(rec, n)
        h, w = img.shape[:2]
        note = self._size_note(img)
        boxes: list[DetectionBox] = []
        det_ms: float | None = None
        pending: Future[_Enhanced] | None = None
        if getattr(v, "enhancer", None) is not None and note is None:
            pending = _ENHANCE_POOL.submit(self._enhance, rec, n, img)
        detector = getattr(v, "detector", None) if detect else None
        if detector is not None and note is None:
            t0 = time.perf_counter()
            dets = detector.detect(img)
            det_ms = round((time.perf_counter() - t0) * 1000, 1)
            boxes = [
                DetectionBox(
                    x1=d.x1, y1=d.y1, x2=d.x2, y2=d.y2, confidence=d.confidence, label=PERSON_LABEL
                )
                for d in dets
            ]
        enhanced: _Enhanced | None = None
        if pending is not None:
            try:
                enhanced = pending.result()
            except EnhancerUnavailable:
                # Lý do đã có ở `enhancer` (trạng thái model) và ở 503 của khung ảnh rõ.
                enhanced = None
        result = FlightFrameAI(
            rec=rec,
            n=n,
            width=w,
            height=h,
            detector=det_status,
            enhancer=enh_status,
            boxes=boxes,
            detector_ms=det_ms,
            enhancer_ms=enhanced.ms if enhanced else None,
            quality_raw=image_quality(img),
            quality_enhanced=enhanced.quality if enhanced else None,
            note=note,
        )
        # Chỉ lưu đệm khi detector đã chạy: model nạp muộn, hay lần sau người xem bật hộp người,
        # thì lần hỏi đó phải chạy thật (ảnh rõ vẫn trúng đệm riêng của nó).
        if det_ms is not None:
            self._analysis.put((rec, n), result)
        return result
