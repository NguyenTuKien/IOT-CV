"""Nạp bundle model ONNX của repo XLA — hợp đồng `D:/XLA/docs/hop-dong-model.md` §4–§5, §9, §11.

Bundle là một thư mục `<model>-v<semver>/` gồm `<model>.onnx`, `meta.json`, `golden/`. Backend
chỉ NẠP và CHẠY; tiền/hậu xử lý (cắt dải mép, letterbox, NMS, cắt hộp RoiAlign) nằm trong graph,
không chép lại ở đây.

Bốn kind: `detector` (§2), `enhancer` (§3), `verifier` (§9) và `enhancer-offline` (§11; hai kind
sau có từ contract 1.1). Bốn bước kiểm lúc nạp (§5), sai bước nào là `BundleRejected(reason)` —
không có đường lùi im lặng:
  1. file `.onnx` và `meta.json` tồn tại;
  2. sha256 của file = sha256 đặt trong env (`DETECTOR_SHA256`, `ENHANCER_OFFLINE_SHA256`…; tiền
     tố env = `kind.replace("-", "_").upper()`) = `meta.onnx_sha256`;
  3. major của `meta.contract_version` = `SUPPORTED_CONTRACT_MAJOR` (kind mới cần ≥ 1.1);
  4. tên / kiểu / shape input-output khớp §2 / §3 / §9 / §11.
Rồi chạy thử một lần (detector/enhancer: khung đen; verifier: khung đen + hộp `[100,100,140,180]`).
`enhancer-offline` không chạy trực tiếp (§11): nạp chỉ mở session CPU để kiểm graph rồi đóng —
trạng thái `ready` (§13); job offline mở lại bằng `load_bundle(..., keep_session=True)`.

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

ModelKind = Literal["detector", "enhancer", "verifier", "enhancer-offline"]
MODEL_KINDS: tuple[ModelKind, ...] = ("detector", "enhancer", "verifier", "enhancer-offline")
# Kind có từ contract minor nào: bundle kind mới phải ghi contract_version ≥ 1.1 (lịch sử đổi 1.1).
KIND_SINCE_MINOR = {"detector": 0, "enhancer": 0, "verifier": 1, "enhancer-offline": 1}
# Kind không chạy trực tiếp: nạp chỉ kiểm rồi đóng session, trạng thái `ready` (§11, §13).
OFFLINE_KINDS = frozenset({"enhancer-offline"})

SUPPORTED_CONTRACT_MAJOR = 1
FRAME_HEIGHT = 480
FRAME_WIDTH = 640
FRAME_SHAPE = (FRAME_HEIGHT, FRAME_WIDTH, 3)
OFFLINE_SCALE = 2
OFFLINE_SHAPE = (FRAME_HEIGHT * OFFLINE_SCALE, FRAME_WIDTH * OFFLINE_SCALE, 3)
# Hộp chạy thử verifier lúc nạp (§9).
VERIFIER_PROBE_BOXES = [[100.0, 100.0, 140.0, 180.0]]

# (tên, kiểu ORT, shape — None là chiều động). §2, §3, §9, §11 của hợp đồng.
_FRAME_IO = ("frame", "tensor(uint8)", [FRAME_HEIGHT, FRAME_WIDTH, 3])
_OFFLINE_OUT = ("frame_out", "tensor(uint8)", list(OFFLINE_SHAPE))
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
    "verifier": {
        "inputs": [_FRAME_IO, ("boxes", "tensor(float)", [None, 4])],
        "outputs": [("scores", "tensor(float)", [None])],
    },
    # Ảnh đơn (`temporal_window` 1); bản video xem `io_spec`.
    "enhancer-offline": {"inputs": [_FRAME_IO], "outputs": [_OFFLINE_OUT]},
}


def env_prefix(kind: str) -> str:
    """Tiền tố env của một kind: `enhancer-offline` → `ENHANCER_OFFLINE` (§11)."""
    return kind.replace("-", "_").upper()


def io_spec(
    kind: ModelKind, meta: dict[str, Any] | None = None
) -> dict[str, list[tuple[str, str, list[int | None]]]]:
    """Spec input/output của kind; `enhancer-offline` video (`temporal_window` T > 1) nhận
    `frames` uint8 [T, 480, 640, 3] (§11)."""
    if kind == "enhancer-offline":
        t = (meta or {}).get("temporal_window", 1)
        if isinstance(t, int) and t > 1:
            frames = ("frames", "tensor(uint8)", [t, FRAME_HEIGHT, FRAME_WIDTH, 3])
            return {"inputs": [frames], "outputs": [_OFFLINE_OUT]}
    return IO_SPEC[kind]


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
    session: Any  # onnxruntime.InferenceSession; None khi đã kiểm rồi đóng (kind offline)
    providers: list[str] = field(default_factory=list)

    @property
    def version(self) -> str:
        return str(self.meta.get("version", "?"))

    @property
    def state(self) -> Literal["loaded", "ready"]:
        """`loaded` = session mở, đã chạy thử; `ready` = kiểm đủ, session đã đóng (§13)."""
        return "loaded" if self.session is not None else "ready"

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


def _check_io(kind: ModelKind, session: Any, meta: dict[str, Any] | None = None) -> None:
    spec = io_spec(kind, meta)
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


def _number(meta: dict[str, Any], key: str) -> float:
    value = meta.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise BundleRejected(f"meta.{key} thiếu hoặc không phải số")
    return float(value)


def _check_contract(kind: ModelKind, meta: dict[str, Any]) -> None:
    version = str(meta.get("contract_version", ""))
    major_s, _, rest = version.partition(".")
    try:
        major, minor = int(major_s), int(rest.split(".", 1)[0] or 0)
    except ValueError:
        raise BundleRejected(f"contract_version {version!r} không đọc được") from None
    if major != SUPPORTED_CONTRACT_MAJOR:
        raise BundleRejected(
            f"contract_version {version} (major {major}), backend chỉ hỗ trợ major "
            f"{SUPPORTED_CONTRACT_MAJOR}"
        )
    since = KIND_SINCE_MINOR[kind]
    if minor < since:
        raise BundleRejected(
            f"contract_version {version}: kind {kind} có từ {SUPPORTED_CONTRACT_MAJOR}.{since}"
        )


def _check_kind_meta(kind: ModelKind, meta: dict[str, Any]) -> None:
    if kind == "detector":
        if meta.get("input_variant", "raw") != "raw":
            raise BundleRejected(
                f"input_variant {meta.get('input_variant')!r}: backend này chỉ chạy detector "
                "trên khung gốc (D5)"
            )
        _number(meta, "conf_threshold")
        if meta.get("recommended_track") is not None:
            from backend.vision.track_filter import check_recommended_track

            try:
                check_recommended_track(meta["recommended_track"])
            except ValueError as exc:
                raise BundleRejected(f"meta.{exc}") from None
    elif kind == "verifier":
        if meta.get("input_variant", "raw") != "raw":
            raise BundleRejected(
                f"verifier input_variant {meta.get('input_variant')!r}, cần 'raw' (§9)"
            )
        _number(meta, "conf_threshold")
    elif kind == "enhancer-offline":
        if meta.get("scale") != OFFLINE_SCALE:
            raise BundleRejected(f"meta.scale = {meta.get('scale')!r}, cần {OFFLINE_SCALE}")
        want = [OFFLINE_SHAPE[1], OFFLINE_SHAPE[0]]
        if list(meta.get("output_size", [])) != want:
            raise BundleRejected(f"meta.output_size = {meta.get('output_size')}, cần {want}")
        t = meta.get("temporal_window")
        if isinstance(t, bool) or not isinstance(t, int) or t < 1 or t % 2 == 0:
            raise BundleRejected(f"meta.temporal_window = {t!r}, cần số nguyên dương lẻ")


def _probe_feeds(kind: ModelKind) -> dict[str, Any]:
    import numpy as np

    zeros = np.zeros(FRAME_SHAPE, np.uint8)
    if kind == "verifier":
        return {"frame": zeros, "boxes": np.asarray(VERIFIER_PROBE_BOXES, np.float32)}
    return {"frame": zeros}


def open_session(path: Path, providers: tuple[str, ...] | list[str] | None) -> Any:
    """`InferenceSession` theo danh sách provider mong muốn (mặc định `VISION_ORT_PROVIDERS`).
    Lỗi (thiếu onnxruntime, graph hỏng): `BundleRejected`."""
    from backend import config

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
        return ort.InferenceSession(str(path), providers=provider_args)
    except Exception as exc:  # noqa: BLE001 — graph hỏng là bundle hỏng
        raise BundleRejected(f"onnxruntime không mở được graph: {exc}") from exc


def load_bundle(
    onnx_path: str | Path,
    sha256: str,
    kind: ModelKind,
    providers: tuple[str, ...] | list[str] | None = None,
    *,
    keep_session: bool | None = None,
) -> LoadedBundle:
    """Kiểm 4 bước §5 rồi tạo `InferenceSession`. Sai bất kỳ bước nào: `BundleRejected`.

    `keep_session` mặc định True, trừ kind offline (`enhancer-offline`): mặc định mở session
    CPU, kiểm IO, KHÔNG chạy, đóng ngay → bundle `ready` (`session=None`, §13). Job offline
    truyền `keep_session=True` (cùng provider mong muốn) để mở session chạy thật."""
    from backend import config

    if kind not in MODEL_KINDS:
        raise BundleRejected(f"kind {kind!r} không có trong hợp đồng ({', '.join(MODEL_KINDS)})")
    path = Path(onnx_path)
    if not path.is_file():
        raise BundleRejected(f"không thấy file {path}")
    meta = read_meta(path)

    if meta.get("model") != kind:
        raise BundleRejected(f"meta.model = {meta.get('model')!r}, cần {kind!r}")
    want_env = (sha256 or "").strip().lower()
    if not want_env:
        env_key = f"{env_prefix(kind)}_SHA256"
        raise BundleRejected(f"{env_key} chưa đặt (lấy bằng scripts/vision/lay_model.py)")
    actual = sha256_file(path)
    in_meta = str(meta.get("onnx_sha256", "")).lower()
    if actual != want_env or actual != in_meta:
        raise BundleRejected(
            f"sha256 lệch: file {actual[:12]}…, env {want_env[:12]}…, meta {in_meta[:12]}…"
        )
    _check_contract(kind, meta)
    if list(meta.get("frame_size", [])) != [FRAME_WIDTH, FRAME_HEIGHT]:
        raise BundleRejected(f"meta.frame_size = {meta.get('frame_size')}, cần [640, 480]")
    _check_kind_meta(kind, meta)

    offline = kind in OFFLINE_KINDS
    keep = (not offline) if keep_session is None else keep_session
    if not keep:
        # Chỉ kiểm graph trên CPU (không giữ VRAM), rồi bỏ tham chiếu: ORT đóng session.
        session = open_session(path, ["CPUExecutionProvider"])
        _check_io(kind, session, meta)
        del session
        log.info("Đã kiểm %s %s (ready, session đã đóng)", kind, meta.get("version", "?"))
        return LoadedBundle(kind=kind, onnx_path=path, meta=meta, session=None, providers=[])

    wanted = tuple(providers) if providers else config.VISION_ORT_PROVIDERS
    session = open_session(path, providers)
    _check_io(kind, session, meta)
    if not offline:
        # Chạy một lần rồi MỚI đọc provider: get_available_providers() có CUDA không có nghĩa là
        # session dùng được CUDA, và lỗi cuDNN chỉ lộ ở lần chạy đầu — lúc đó ORT tự dựng lại
        # session trên CPU. Đọc trước khi chạy là "xanh giả" (bẫy ở XLA 18/11 và ở đây 19/11/2026).
        out_names = [o[0] for o in io_spec(kind, meta)["outputs"]]
        try:
            outs = session.run(out_names, _probe_feeds(kind))
        except Exception as exc:  # noqa: BLE001
            raise BundleRejected(f"chạy thử khung đen lỗi: {exc}") from exc
        n_probe = len(VERIFIER_PROBE_BOXES)
        if kind == "verifier" and tuple(outs[0].shape) != (n_probe,):
            raise BundleRejected(
                f"verifier: chạy thử {n_probe} hộp ra scores shape {list(outs[0].shape)}, "
                f"cần [{n_probe}]"
            )
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
