"""Làm rõ ảnh bằng `enhancer.onnx` của repo XLA — hợp đồng `docs/hop-dong-model.md` §3 (XLA).

Vào/ra cùng cỡ 640×480 BGR uint8; cột `[0, crop_left)` của ảnh ra lặp cột `crop_left` nên hộp của
detector vẫn khớp toạ độ trên cả hai luồng. Chỉ phục vụ luồng web `variant=enhanced`, không đưa vào
đường nhận diện (D5).

Bundle mặc định từ 26/11/2026 là `enhancer-v2.0.0` (classic ONNX, plan XLA 261125-ai-v2): thắng
khung gốc 25/25 ở A/B mù v2 (XLA `results/ab-v2/decision.json`), web bật "Ảnh rõ" sẵn theo
`ENHANCER_DEFAULT_ON`; người xem tắt được. (`enhancer-v1.0.0` NAFNet chưa đạt A/B 19/11.)
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


class Enhancer:
    def __init__(self, bundle: LoadedBundle) -> None:
        if bundle.kind != "enhancer":
            raise ValueError(f"cần bundle enhancer, nhận {bundle.kind}")
        self.bundle = bundle
        self._wrong_size = RateLimitedWarning(log)

    @classmethod
    def from_config(cls) -> Enhancer:
        """Nạp theo `ENHANCER_ONNX` + `ENHANCER_SHA256`. Ném `BundleRejected` khi sai hợp đồng."""
        return cls(load_bundle(config.ENHANCER_ONNX, config.ENHANCER_SHA256, "enhancer"))

    def enhance(self, frame_bgr: np.ndarray) -> np.ndarray | None:
        """Ảnh đã làm rõ cùng cỡ; None khi khung sai cỡ (không tự resize)."""
        if frame_bgr.shape != FRAME_SHAPE or frame_bgr.dtype != np.uint8:
            self._wrong_size.warn(
                "Khung %s %s không phải 480x640x3 uint8 — enhancer bỏ khung",
                frame_bgr.shape,
                frame_bgr.dtype,
            )
            return None
        (out,) = self.bundle.session.run(["frame_out"], {"frame": np.ascontiguousarray(frame_bgr)})
        return out
