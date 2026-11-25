"""Xác minh hộp người bằng `verifier.onnx` của repo XLA — hợp đồng `docs/hop-dong-model.md` §9.

Tầng 2 của đường nhận diện: detector → **verifier** → lọc track (§10). Graph nhận NGUYÊN khung
uint8 [480, 640, 3] BGR + hộp `boxes` float32 [N, 4] xyxy px khung gốc, tự nới hộp, cắt RoiAlign,
chuẩn hoá; ra `scores` float32 [N] = P(người), cùng thứ tự hộp. IOT-CV không viết phép cắt (D2).

`VERIFIER_ONNX` rỗng = tắt verifier: pipeline chạy chỉ detector (trạng thái `disabled`).
"""

from __future__ import annotations

import logging

import numpy as np

from backend import config
from backend.vision.model_bundle import (
    FRAME_SHAPE,
    LoadedBundle,
    RateLimitedWarning,
    load_bundle,
)

log = logging.getLogger(__name__)


class BoxVerifier:
    def __init__(self, bundle: LoadedBundle, confidence: float | None = None) -> None:
        if bundle.kind != "verifier":
            raise ValueError(f"cần bundle verifier, nhận {bundle.kind}")
        self.bundle = bundle
        if confidence is None:
            confidence = config.VERIFIER_CONFIDENCE
        self.confidence = float(bundle.meta["conf_threshold"] if confidence is None else confidence)
        self._wrong_size = RateLimitedWarning(log)

    @classmethod
    def from_config(cls) -> BoxVerifier | None:
        """Nạp theo `VERIFIER_ONNX` + `VERIFIER_SHA256`; None khi `VERIFIER_ONNX` rỗng (tắt).
        Ném `BundleRejected` khi sai hợp đồng."""
        if not config.VERIFIER_ONNX:
            return None
        return cls(load_bundle(config.VERIFIER_ONNX, config.VERIFIER_SHA256, "verifier"))

    def verify(self, frame_bgr: np.ndarray, boxes: np.ndarray) -> np.ndarray | None:
        """Điểm float32 [N] cho `boxes` [N, 4]; N = 0 trả mảng rỗng KHÔNG gọi session; None khi
        khung sai cỡ (không tự resize)."""
        boxes = np.ascontiguousarray(np.asarray(boxes, np.float32).reshape(-1, 4))
        if frame_bgr.shape != FRAME_SHAPE or frame_bgr.dtype != np.uint8:
            self._wrong_size.warn(
                "Khung %s %s không phải 480x640x3 uint8 — verifier bỏ khung",
                frame_bgr.shape,
                frame_bgr.dtype,
            )
            return None
        if len(boxes) == 0:
            return np.zeros(0, np.float32)
        (scores,) = self.bundle.session.run(
            ["scores"], {"frame": np.ascontiguousarray(frame_bgr), "boxes": boxes}
        )
        scores = np.asarray(scores, np.float32).reshape(-1)
        if len(scores) != len(boxes):
            raise ValueError(f"verifier trả {len(scores)} điểm cho {len(boxes)} hộp (§9)")
        return scores
