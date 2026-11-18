"""Phát hiện người bằng `detector.onnx` của repo XLA — hợp đồng `docs/hop-dong-model.md` §2 (XLA).

Graph nhận NGUYÊN khung camera uint8 [480, 640, 3] BGR và tự làm hết tiền/hậu xử lý (cắt dải mép,
letterbox, NMS, quy toạ độ). Ở đây chỉ còn: kiểm cỡ khung, chạy, lọc `conf_threshold`.

Đường nhận diện chạy trên khung GỐC, không qua enhancer (D5 của plan XLA; E4 ngày 19/11/2026 cho
thấy qua enhancer kém hơn).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from backend import config
from backend.vision.model_bundle import (
    FRAME_SHAPE,
    LoadedBundle,
    RateLimitedWarning,
    load_bundle,
)

log = logging.getLogger(__name__)
PERSON_LABEL = "person"


@dataclass(frozen=True)
class Detection:
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


class PersonDetector:
    def __init__(self, bundle: LoadedBundle, confidence: float | None = None) -> None:
        if bundle.kind != "detector":
            raise ValueError(f"cần bundle detector, nhận {bundle.kind}")
        self.bundle = bundle
        if confidence is None:
            confidence = config.DETECTION_CONFIDENCE
        self.confidence = float(bundle.meta["conf_threshold"] if confidence is None else confidence)
        self._wrong_size = RateLimitedWarning(log)

    @classmethod
    def from_config(cls) -> PersonDetector:
        """Nạp theo `DETECTOR_ONNX` + `DETECTOR_SHA256`. Ném `BundleRejected` khi sai hợp đồng."""
        return cls(load_bundle(config.DETECTOR_ONNX, config.DETECTOR_SHA256, "detector"))

    def raw(self, frame_bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
        """(boxes [N,4], scores [N]) chưa lọc ngưỡng vận hành; None khi khung sai cỡ."""
        if frame_bgr.shape != FRAME_SHAPE or frame_bgr.dtype != np.uint8:
            self._wrong_size.warn(
                "Khung %s %s không phải 480x640x3 uint8 — detector bỏ khung, không tự resize",
                frame_bgr.shape,
                frame_bgr.dtype,
            )
            return None
        boxes, scores = self.bundle.session.run(
            ["boxes", "scores"], {"frame": np.ascontiguousarray(frame_bgr)}
        )
        return boxes, scores

    def detect(self, frame_bgr: np.ndarray) -> list[Detection]:
        out = self.raw(frame_bgr)
        if out is None:
            return []
        boxes, scores = out
        return [
            Detection(float(s), float(b[0]), float(b[1]), float(b[2]), float(b[3]))
            for b, s in zip(boxes, scores, strict=True)
            if s >= self.confidence
        ]
