"""Pipeline AI trên luồng camera: detector mỗi khung, enhancer khi có người xem `variant=enhanced`.

    reader --subscribe--> _on_frame: giữ KHUNG MỚI NHẤT (không hàng đợi)
      thread "vision-pipeline": giải mã JPEG
        -> detector -> verifier (nếu nạp, hợp đồng XLA §9) -> DetectionPayload (latest_detection)
                    -> EventThrottle / TrackFilter k/n (§10) -> sự kiện vision.person_detected
        -> enhancer (chỉ khi có client enhanced) -> JPEG -> enhanced_view.latest()

Hộp gửi lên WebSocket là hộp SAU verifier (§10); `DetectionPayload` giữ nguyên shape.

Luật (SAFETY.md mục 9): pipeline chạy thread riêng, chậm thì BỎ khung cũ chứ không xếp hàng, lỗi
trong thread chỉ log + đếm — không bao giờ làm chậm luồng raw, telemetry hay lệnh lái.
"""

from __future__ import annotations

import collections
import logging
import threading
import time
from collections.abc import Callable
from typing import Any

import numpy as np

from backend import config
from backend.schemas import DetectionBox, DetectionPayload
from backend.vision.detector import PERSON_LABEL, PersonDetector
from backend.vision.enhancer import Enhancer
from backend.vision.events import EventThrottle
from backend.vision.model_bundle import FRAME_HEIGHT, FRAME_WIDTH, RateLimitedWarning
from backend.vision.stream import MjpegFrame
from backend.vision.track_filter import TrackBox, TrackEvent
from backend.vision.verifier import BoxVerifier

log = logging.getLogger(__name__)

STEPS = ("decode", "detector", "verifier", "enhancer", "encode", "total")
_TIMING_WINDOW = 300


def _percentile(values: list[float], q: float) -> float:
    return float(np.percentile(np.asarray(values, dtype=np.float64), q))


class _EnhancedView:
    """Thứ `mjpeg_multipart` đọc cho luồng enhanced: chỉ cần `.latest()`."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: MjpegFrame | None = None

    def set(self, frame: MjpegFrame) -> None:
        with self._lock:
            self._frame = frame

    def latest(self) -> MjpegFrame | None:
        with self._lock:
            return self._frame

    def clear(self) -> None:
        with self._lock:
            self._frame = None


class VisionPipeline:
    def __init__(
        self,
        reader: Any,
        detector: PersonDetector | None,
        enhancer: Enhancer | None,
        *,
        verifier: BoxVerifier | None = None,
        on_person: Callable[[float], None] | None = None,
        on_event: Callable[[TrackEvent], None] | None = None,
        clock: Callable[[], float] = time.time,
        timing_window: int = _TIMING_WINDOW,
    ) -> None:
        """`on_event` nhận đủ sự kiện track (§10); `on_person` (cách gọi cũ) chỉ nhận
        `confidence` của cùng sự kiện. Tham số track k/n sai (env + meta detector): `ValueError`."""
        if detector is None and enhancer is None:
            raise ValueError("pipeline cần ít nhất một model")
        self.reader = reader
        self.detector = detector
        self.verifier = verifier if detector is not None else None
        self.enhancer = enhancer
        self.on_person = on_person
        self.on_event = on_event
        self._clock = clock
        self.throttle = (
            EventThrottle(confidence_threshold=detector.confidence, meta=detector.bundle.meta)
            if detector
            else None
        )
        self.enhanced_view = _EnhancedView()

        self._cond = threading.Condition()
        self._pending: MjpegFrame | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._enhanced_clients = 0
        self._latest_detection: DetectionPayload | None = None
        self._timings: dict[str, collections.deque[float]] = {
            s: collections.deque(maxlen=timing_window) for s in STEPS
        }
        self._err = RateLimitedWarning(log)
        self.frames_in = 0
        self.frames_processed = 0
        self.frames_dropped = 0
        self.errors = 0

    # -- vòng đời ---------------------------------------------------------------
    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self.reader.subscribe(self._on_frame)
        self._thread = threading.Thread(target=self._run, name="vision-pipeline", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 3.0) -> None:
        self.reader.unsubscribe(self._on_frame)
        self._stop.set()
        with self._cond:
            self._cond.notify_all()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            self._thread = None

    # -- luồng enhanced: đếm tham chiếu --------------------------------------------
    def acquire_enhanced(self) -> None:
        with self._cond:
            self._enhanced_clients += 1

    def release_enhanced(self) -> None:
        with self._cond:
            self._enhanced_clients = max(0, self._enhanced_clients - 1)
            if self._enhanced_clients == 0:
                self.enhanced_view.clear()

    @property
    def enhanced_clients(self) -> int:
        with self._cond:
            return self._enhanced_clients

    # -- nhận khung (thread đọc camera) -------------------------------------------
    def _on_frame(self, frame: MjpegFrame) -> None:
        with self._cond:
            if self._pending is not None:
                self.frames_dropped += 1
            self._pending = frame
            self.frames_in += 1
            self._cond.notify()

    def _run(self) -> None:
        while not self._stop.is_set():
            with self._cond:
                while self._pending is None and not self._stop.is_set():
                    self._cond.wait(timeout=0.5)
                frame, self._pending = self._pending, None
            if frame is None:
                continue
            try:
                self.process(frame)
            except Exception as exc:  # noqa: BLE001 — SAFETY 9: lỗi AI không giết backend
                self.errors += 1
                self._err.warn("Pipeline AI lỗi ở một khung: %r", exc)

    # -- xử lý một khung (test gọi thẳng được) -------------------------------------
    def process(self, frame: MjpegFrame) -> DetectionPayload | None:
        """Một khung: giải mã, detector, rồi enhancer (chỉ khi có người xem enhanced). Nối tiếp,
        không song song: 19/11/2026 thử chạy enhancer trên worker riêng thì GPU (dùng chung với
        desktop) bão hoà, tổng p50 vẫn ~95 ms và công suất tối đa tụt 15 -> 11,7 khung/s."""
        import cv2

        t0 = time.perf_counter()
        img = cv2.imdecode(np.frombuffer(frame.jpeg, np.uint8), cv2.IMREAD_COLOR)
        t1 = time.perf_counter()
        if img is None:
            raise ValueError("JPEG không giải mã được")
        self._timings["decode"].append((t1 - t0) * 1000)

        payload = self._detect(img, frame, t1) if self.detector is not None else None
        if self.enhancer is not None and self.enhanced_clients > 0:
            self._enhance(img, frame)
        self._timings["total"].append((time.perf_counter() - t0) * 1000)
        self.frames_processed += 1
        return payload

    def _detect(self, img: np.ndarray, frame: MjpegFrame, t1: float) -> DetectionPayload | None:
        dets = self.detector.detect(img)
        t2 = time.perf_counter()
        self._timings["detector"].append((t2 - t1) * 1000)
        # Khung sai cỡ: detector bỏ khung, không gửi payload với cỡ sai.
        if img.shape[:2] != (FRAME_HEIGHT, FRAME_WIDTH):
            return None
        track_boxes = [TrackBox(d.x1, d.y1, d.x2, d.y2, d.confidence) for d in dets]
        if self.verifier is not None:
            # N = 0 thì verifier không gọi session, nhưng bước vẫn được đo (≈ 0 ms) cho đủ số.
            scores = self.verifier.verify(img, [[b.x1, b.y1, b.x2, b.y2] for b in track_boxes])
            self._timings["verifier"].append((time.perf_counter() - t2) * 1000)
            keep = [
                (d, TrackBox(b.x1, b.y1, b.x2, b.y2, b.score, float(s)))
                for d, b, s in zip(dets, track_boxes, scores, strict=True)
                if s >= self.verifier.confidence
            ]
            dets = [d for d, _ in keep]
            track_boxes = [b for _, b in keep]
        frame_ts = frame.timestamp_ms / 1000.0 if frame.timestamp_ms is not None else self._clock()
        payload = DetectionPayload(
            frame_id=frame.frame_id or 0,
            frame_ts=frame_ts,
            width=FRAME_WIDTH,
            height=FRAME_HEIGHT,
            boxes=[
                DetectionBox(
                    x1=d.x1, y1=d.y1, x2=d.x2, y2=d.y2, confidence=d.confidence, label=PERSON_LABEL
                )
                for d in dets
            ],
        )
        with self._cond:
            self._latest_detection = payload
        events = self.throttle.update(track_boxes, self._clock()) if self.throttle else []
        for event in events:
            if self.on_event is not None:
                self.on_event(event)
            if self.on_person is not None:
                self.on_person(event.confidence)
        return payload

    def _enhance(self, img: np.ndarray, frame: MjpegFrame) -> None:
        import cv2

        t3 = time.perf_counter()
        out = self.enhancer.enhance(img)
        t4 = time.perf_counter()
        if out is None:
            return
        self._timings["enhancer"].append((t4 - t3) * 1000)
        ok, buf = cv2.imencode(
            ".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, config.ENHANCED_JPEG_QUALITY]
        )
        if not ok:
            return
        self._timings["encode"].append((time.perf_counter() - t4) * 1000)
        self.enhanced_view.set(
            MjpegFrame(
                jpeg=buf.tobytes(),
                frame_id=frame.frame_id,
                timestamp_ms=frame.timestamp_ms,
                jpeg_quality=None,
                framesize=frame.framesize,
                received_at=time.monotonic(),
            )
        )

    def latest_detection(self) -> DetectionPayload | None:
        with self._cond:
            return self._latest_detection

    def reset_stats(self) -> None:
        """Xoá số đo và bộ đếm (bench gọi sau warmup)."""
        with self._cond:
            for d in self._timings.values():
                d.clear()
            self.frames_in = self.frames_processed = self.frames_dropped = self.errors = 0

    def timings(self) -> dict[str, list[float]]:
        return {k: list(v) for k, v in self._timings.items()}

    def stats(self) -> dict[str, Any]:
        ms: dict[str, dict[str, float]] = {}
        for step, values in self.timings().items():
            if values:
                ms[step] = {
                    "p50": round(_percentile(values, 50), 2),
                    "p95": round(_percentile(values, 95), 2),
                }
        return {
            "frames_in": self.frames_in,
            "frames_processed": self.frames_processed,
            "frames_dropped": self.frames_dropped,
            "errors": self.errors,
            "enhanced_clients": self.enhanced_clients,
            "ms": ms,
        }
