"""Xác minh hộp người bằng `verifier.onnx` của repo XLA — hợp đồng `docs/hop-dong-model.md` §9.

Tầng 2 của đường nhận diện: detector → **verifier** → lọc track (§10). Graph nhận NGUYÊN khung
uint8 [480, 640, 3] BGR + hộp `boxes` float32 [N, 4] xyxy px khung gốc, tự nới hộp, cắt RoiAlign,
chuẩn hoá; ra `scores` float32 [N] = P(người), cùng thứ tự hộp. IOT-CV không viết phép cắt (D2).

`VERIFIER_ONNX` rỗng = tắt verifier: pipeline chạy chỉ detector (trạng thái `disabled`).

N theo bậc, MỖI BẬC MỘT SESSION (`N_BUCKETS`). Phase 09 của plan XLA 261125-ai-v2 đo 58–62 ms khi
gặp một N mới rồi 4–6 ms, làm p95 trực tiếp +70 ms. Đo lại 26/11/2026 (RTX 4060 Laptop, ORT CUDA,
`verifier-v1.0.0`): session CUDA trả ~60 ms MỖI LẦN shape `boxes` khác lần gọi trước, không chỉ
lần đầu — N xen kẽ 1, 2, 1, 2… thì lần nào cũng ~60 ms (đổi `prefer_nhwc` / `cudnn_conv_algo_search`
không đỡ). Nên đệm N lên bậc trong MỘT session không đủ; mỗi bậc giữ session riêng, luôn thấy đúng
một shape: xen kẽ năm bậc còn p50 6,5 ms, p95 10,3 ms, đổi lại ~67 MiB VRAM mỗi session thêm. Bậc
nhỏ nhất dùng session của bundle (đã chạy thử N = 1 lúc nạp). N thật đệm bằng hộp giả (bỏ điểm),
N > bậc lớn nhất chia lượt; mỗi bậc chạy thử một lần lúc nạp. Graph chấm từng hộp độc lập (RoiAlign
→ backbone theo lô), nên đệm không đổi điểm của hộp thật.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from backend import config
from backend.vision.model_bundle import (
    FRAME_SHAPE,
    VERIFIER_PROBE_BOXES,
    BundleRejected,
    LoadedBundle,
    RateLimitedWarning,
    load_bundle,
    open_session,
)

log = logging.getLogger(__name__)

# Cỡ lô `boxes` session được thấy; detector v1 hiếm khi ra > 16 hộp qua ngưỡng.
N_BUCKETS: tuple[int, ...] = (1, 2, 4, 8, 16)
# Hộp đệm: chính hộp chạy thử lúc nạp (§9), nằm gọn trong khung, điểm của nó bị bỏ.
_PAD_BOX = np.asarray(VERIFIER_PROBE_BOXES[0], np.float32)


def bucket_for(n: int, buckets: tuple[int, ...] = N_BUCKETS) -> int:
    """Bậc nhỏ nhất ≥ `n` (n ≥ 1); n vượt bậc lớn nhất thì trả bậc lớn nhất (gọi chia lượt)."""
    for b in buckets:
        if n <= b:
            return b
    return buckets[-1]


class BoxVerifier:
    def __init__(
        self,
        bundle: LoadedBundle,
        confidence: float | None = None,
        *,
        buckets: tuple[int, ...] = N_BUCKETS,
        warmup: bool = True,
    ) -> None:
        """Mở thêm một session cho mỗi bậc trừ bậc nhỏ nhất (cùng provider với session của
        bundle), rồi chạy thử từng bậc nếu `warmup`. Lỗi mở/chạy thử: `BundleRejected`."""
        if bundle.kind != "verifier":
            raise ValueError(f"cần bundle verifier, nhận {bundle.kind}")
        if not buckets or list(buckets) != sorted(set(buckets)) or buckets[0] < 1:
            raise ValueError(f"buckets {buckets!r} phải tăng dần, nguyên dương, không trùng")
        self.bundle = bundle
        self.buckets = tuple(buckets)
        if confidence is None:
            confidence = config.VERIFIER_CONFIDENCE
        self.confidence = float(bundle.meta["conf_threshold"] if confidence is None else confidence)
        self._wrong_size = RateLimitedWarning(log)
        providers = bundle.providers or None
        # Bậc → session riêng; bậc nhỏ nhất đọc `bundle.session` lúc gọi (xem `session_for`).
        self.sessions: dict[int, Any] = {
            b: open_session(bundle.onnx_path, providers) for b in self.buckets[1:]
        }
        if warmup:
            self.warmup()

    @classmethod
    def from_config(cls) -> BoxVerifier | None:
        """Nạp theo `VERIFIER_ONNX` + `VERIFIER_SHA256`; None khi `VERIFIER_ONNX` rỗng (tắt).
        Ném `BundleRejected` khi sai hợp đồng."""
        if not config.VERIFIER_ONNX:
            return None
        return cls(load_bundle(config.VERIFIER_ONNX, config.VERIFIER_SHA256, "verifier"))

    def session_for(self, bucket: int) -> Any:
        return self.bundle.session if bucket == self.buckets[0] else self.sessions[bucket]

    def warmup(self) -> None:
        """Chạy mỗi bậc một lần trên khung đen (session CUDA dựng sẵn kế hoạch cho shape của nó).
        Lỗi ở bậc nào: `BundleRejected` — bundle không chạy được N đó thì không dùng được."""
        zeros = np.zeros(FRAME_SHAPE, np.uint8)
        for b in self.buckets:
            try:
                self._run(b, zeros, np.repeat(_PAD_BOX[None, :], b, axis=0))
            except Exception as exc:  # noqa: BLE001 — graph hỏng ở N này là bundle hỏng
                raise BundleRejected(f"verifier: chạy thử N = {b} hộp lỗi: {exc}") from exc

    def _run(self, bucket: int, frame: np.ndarray, boxes: np.ndarray) -> np.ndarray:
        (scores,) = self.session_for(bucket).run(["scores"], {"frame": frame, "boxes": boxes})
        scores = np.asarray(scores, np.float32).reshape(-1)
        if len(scores) != len(boxes):
            raise ValueError(f"verifier trả {len(scores)} điểm cho {len(boxes)} hộp (§9)")
        return scores

    def verify(self, frame_bgr: np.ndarray, boxes: np.ndarray) -> np.ndarray | None:
        """Điểm float32 [N] cho `boxes` [N, 4]; N = 0 trả mảng rỗng KHÔNG gọi session; None khi
        khung sai cỡ (không tự resize). Mỗi session chỉ thấy đúng N của bậc nó (đệm + chia lượt)."""
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
        frame = np.ascontiguousarray(frame_bgr)
        step = self.buckets[-1]
        out: list[np.ndarray] = []
        for start in range(0, len(boxes), step):
            chunk = boxes[start : start + step]
            n = len(chunk)
            bucket = bucket_for(n, self.buckets)
            if bucket > n:
                chunk = np.concatenate([chunk, np.repeat(_PAD_BOX[None, :], bucket - n, axis=0)])
            out.append(self._run(bucket, frame, chunk)[:n])
        return np.concatenate(out)
