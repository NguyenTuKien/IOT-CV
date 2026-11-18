"""Nạp bundle model ONNX của repo XLA — hợp đồng `D:/XLA/docs/hop-dong-model.md` §4–§5.

Bundle là một thư mục `<model>-v<semver>/` gồm `<model>.onnx`, `meta.json`, `golden/`. Backend
chỉ NẠP và CHẠY; tiền/hậu xử lý (cắt dải mép, letterbox, NMS) nằm trong graph, không chép lại ở đây.

Bốn bước kiểm lúc nạp (§5), sai bước nào là `BundleRejected(reason)` — không có đường lùi im lặng:
  1. file `.onnx` và `meta.json` tồn tại;
  2. sha256 của file = sha256 đặt trong env (`DETECTOR_SHA256`…) = `meta.onnx_sha256`;
  3. major của `meta.contract_version` = `SUPPORTED_CONTRACT_MAJOR`;
  4. tên / kiểu / shape input-output khớp §2 (detector) hoặc §3 (enhancer).

Import `onnxruntime` tại chỗ: thiếu nó chỉ làm model bị từ chối, không làm backend bay chết.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

log = logging.getLogger(__name__)

ModelKind = Literal["detector", "enhancer"]

SUPPORTED_CONTRACT_MAJOR = 1
FRAME_HEIGHT = 480
FRAME_WIDTH = 640
FRAME_SHAPE = (FRAME_HEIGHT, FRAME_WIDTH, 3)

# (tên, kiểu ORT, shape — None là chiều động). §2 và §3 của hợp đồng.
_FRAME_IO = ("frame", "tensor(uint8)", [FRAME_HEIGHT, FRAME_WIDTH, 3])
IO_SPEC: dict[str, dict[str, list[tuple[str, str, list[int | None]]]]] = {
    "detector": {
        "inputs": [_FRAME_IO],
        "outputs": [
            ("boxes", "tensor(float)", [None, 4]),
            ("scores", "tensor(float)", [None]),
        ],
    },
    "enhancer": {
        "inputs": [_FRAME_IO],
        "outputs": [("frame_out", "tensor(uint8)", [FRAME_HEIGHT, FRAME_WIDTH, 3])],
    },
}

_dll_lock = threading.Lock()
_dll_preloaded = False


class BundleRejected(Exception):
    """Bundle không qua kiểm của hợp đồng §5. `reason` là câu cho người đọc, đưa lên web."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class LoadedBundle:
    kind: ModelKind
    onnx_path: Path
    meta: dict[str, Any]
    session: Any  # onnxruntime.InferenceSession
    providers: list[str] = field(default_factory=list)

    @property
    def version(self) -> str:
        return str(self.meta.get("version", "?"))

    @property
    def cpu_only(self) -> bool:
        return self.providers == ["CPUExecutionProvider"]


class RateLimitedWarning:
    """Log một cảnh báo tối đa một lần mỗi `period_s` (hợp đồng §1: khung sai cỡ, một lần/phút)."""

    def __init__(self, logger: logging.Logger, period_s: float = 60.0) -> None:
        self._log = logger
        self._period = period_s
        self._last: float | None = None
        self.suppressed = 0

    def warn(self, msg: str, *args: object) -> None:
        now = time.monotonic()
        if self._last is None or now - self._last >= self._period:
            self._last = now
            self._log.warning(msg + " (bỏ qua %d lần lặp)", *args, self.suppressed)
            self.suppressed = 0
        else:
            self.suppressed += 1


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _preload_cuda_dlls(ort: Any, providers: tuple[str, ...]) -> None:
    """ORT-GPU trên Windows cần DLL CUDA 12 + cuDNN 9; gói pip `nvidia-*` cài sẵn chúng nhưng
    ORT chỉ tìm thấy sau `preload_dlls()`. Không gọi thì session lặng lẽ lùi về CPU.

    `preload_dlls()` chưa đủ: cuDNN 9 nạp MUỘN các thư viện con (`cudnn_engines_tensor_ir64_9.dll`…)
    theo tên lúc chạy Conv đầu tiên, nên mọi thư mục `site-packages/nvidia/*/bin` phải nằm trong
    PATH. Thiếu thì lần chạy đầu báo `CUDNN_STATUS_SUBLIBRARY_LOADING_FAILED` và ORT tự chạy lại
    trên CPU mà `get_providers()` vẫn ghi CUDA (đo 19/11/2026)."""
    global _dll_preloaded
    if "CUDAExecutionProvider" not in providers or not hasattr(ort, "preload_dlls"):
        return
    with _dll_lock:
        if _dll_preloaded:
            return
        _dll_preloaded = True
        try:
            import nvidia  # gói namespace của các wheel nvidia-*-cu12

            bins = [p / "bin" for base in nvidia.__path__ for p in Path(base).iterdir()]
            bins = [str(b) for b in bins if b.is_dir()]
            os.environ["PATH"] = os.pathsep.join([*bins, os.environ.get("PATH", "")])
            for b in bins:
                if hasattr(os, "add_dll_directory"):
                    os.add_dll_directory(b)
        except ImportError:
            pass  # không có wheel nvidia-*: dựa vào CUDA cài sẵn trong máy
        try:
            ort.preload_dlls()
        except Exception as exc:  # noqa: BLE001 — thiếu DLL thì session báo CPU-only ở dưới
            log.warning("onnxruntime.preload_dlls() lỗi: %s", exc)


def _check_io(kind: ModelKind, session: Any) -> None:
    spec = IO_SPEC[kind]
    for side, got in (("input", session.get_inputs()), ("output", session.get_outputs())):
        want = spec[f"{side}s"]
        if len(got) != len(want):
            raise BundleRejected(
                f"{kind}: có {len(got)} {side}, hợp đồng cần {len(want)} "
                f"({', '.join(w[0] for w in want)})"
            )
        for arg, (name, dtype, shape) in zip(got, want, strict=True):
            if arg.name != name:
                raise BundleRejected(f"{kind}: {side} tên '{arg.name}', hợp đồng cần '{name}'")
            if arg.type != dtype:
                raise BundleRejected(f"{kind}: {side} '{name}' kiểu {arg.type}, cần {dtype}")
            dims = list(arg.shape)
            ok = len(dims) == len(shape) and all(
                w is None or d == w for d, w in zip(dims, shape, strict=True)
            )
            if not ok:
                raise BundleRejected(f"{kind}: {side} '{name}' shape {dims}, cần {shape}")


def read_meta(onnx_path: Path) -> dict[str, Any]:
    meta_path = onnx_path.parent / "meta.json"
    if not meta_path.is_file():
        raise BundleRejected(f"thiếu {meta_path}")
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BundleRejected(f"meta.json đọc lỗi: {exc}") from exc
    if not isinstance(meta, dict):
        raise BundleRejected("meta.json không phải object")
    return meta


def load_bundle(
    onnx_path: str | Path,
    sha256: str,
    kind: ModelKind,
    providers: tuple[str, ...] | list[str] | None = None,
) -> LoadedBundle:
    """Kiểm 4 bước §5 rồi tạo `InferenceSession`. Sai bất kỳ bước nào: `BundleRejected`."""
    from backend import config

    path = Path(onnx_path)
    if not path.is_file():
        raise BundleRejected(f"không thấy file {path}")
    meta = read_meta(path)

    if meta.get("model") != kind:
        raise BundleRejected(f"meta.model = {meta.get('model')!r}, cần {kind!r}")
    want_env = (sha256 or "").strip().lower()
    if not want_env:
        env_key = f"{kind.upper()}_SHA256"
        raise BundleRejected(f"{env_key} chưa đặt (lấy bằng scripts/vision/lay_model.py)")
    actual = sha256_file(path)
    in_meta = str(meta.get("onnx_sha256", "")).lower()
    if actual != want_env or actual != in_meta:
        raise BundleRejected(
            f"sha256 lệch: file {actual[:12]}…, env {want_env[:12]}…, meta {in_meta[:12]}…"
        )
    version = str(meta.get("contract_version", ""))
    try:
        major = int(version.split(".", 1)[0])
    except ValueError:
        raise BundleRejected(f"contract_version {version!r} không đọc được") from None
    if major != SUPPORTED_CONTRACT_MAJOR:
        raise BundleRejected(
            f"contract_version {version} (major {major}), backend chỉ hỗ trợ major "
            f"{SUPPORTED_CONTRACT_MAJOR}"
        )
    if list(meta.get("frame_size", [])) != [FRAME_WIDTH, FRAME_HEIGHT]:
        raise BundleRejected(f"meta.frame_size = {meta.get('frame_size')}, cần [640, 480]")
    if kind == "detector":
        if meta.get("input_variant", "raw") != "raw":
            raise BundleRejected(
                f"input_variant {meta.get('input_variant')!r}: backend này chỉ chạy detector "
                "trên khung gốc (D5)"
            )
        try:
            float(meta["conf_threshold"])
        except (KeyError, TypeError, ValueError):
            raise BundleRejected("meta.conf_threshold thiếu hoặc không phải số") from None

    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise BundleRejected("chưa cài onnxruntime (uv sync --extra vision)") from exc

    wanted = tuple(providers) if providers else config.VISION_ORT_PROVIDERS
    _preload_cuda_dlls(ort, wanted)
    available = set(ort.get_available_providers())
    use = [p for p in wanted if p in available] or ["CPUExecutionProvider"]
    try:
        provider_args = [
            (p, config.VISION_CUDA_OPTIONS) if p == "CUDAExecutionProvider" else p for p in use
        ]
        session = ort.InferenceSession(str(path), providers=provider_args)
    except Exception as exc:  # noqa: BLE001 — graph hỏng là bundle hỏng
        raise BundleRejected(f"onnxruntime không mở được graph: {exc}") from exc
    _check_io(kind, session)
    # Chạy một khung khởi động rồi MỚI đọc provider: get_available_providers() có CUDA không có
    # nghĩa là session dùng được CUDA, và lỗi cuDNN chỉ lộ ở lần chạy đầu — lúc đó ORT tự dựng lại
    # session trên CPU. Đọc trước khi chạy là "xanh giả" (bẫy ở XLA 18/11 và ở đây 19/11/2026).
    import numpy as np

    out_names = [o[0] for o in IO_SPEC[kind]["outputs"]]
    try:
        session.run(out_names, {"frame": np.zeros(FRAME_SHAPE, np.uint8)})
    except Exception as exc:  # noqa: BLE001
        raise BundleRejected(f"chạy thử khung đen lỗi: {exc}") from exc
    got = list(session.get_providers())
    bundle = LoadedBundle(kind=kind, onnx_path=path, meta=meta, session=session, providers=got)
    if bundle.cpu_only and "CUDAExecutionProvider" in wanted:
        log.warning(
            "!!! %s %s chạy CPU-ONLY (CUDA không tạo được) — chậm, kiểm DLL CUDA/cuDNN !!!",
            kind,
            bundle.version,
        )
    log.info("Đã nạp %s %s, provider %s", kind, bundle.version, got)
    return bundle
