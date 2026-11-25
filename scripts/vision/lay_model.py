"""Chép một bundle model từ repo XLA vào models/vision/<bundle>/ và in sha256 cần đặt env.

    uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.0 [--json]

Kiểm cấu trúc bundle (hợp đồng §4: `<model>.onnx`, `meta.json`, `golden/` với 3 khung +
`expected.json`; verifier thêm `golden/boxes.json` (§9); enhancer / enhancer-offline thêm
`*.out.png`, của offline cỡ 1280×960 (§11)) và sha256 của file .onnx khớp `meta.onnx_sha256` trước
khi chép. KHÔNG sửa `.env`: lệnh in dòng `DETECTOR_SHA256=…` (tiền tố env =
`kind.replace("-", "_").upper()`, vd. `ENHANCER_OFFLINE_SHA256`) để người chạy tự đặt (hoặc truyền
qua biến môi trường của lệnh chạy backend). File .onnx bị dòng `*.onnx` có sẵn trong `.gitignore`
chặn, không vào git.
Mã thoát: 0 = đã chép, 1 = bundle sai, 2 = sai cách gọi.
"""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.vision.model_bundle import MODEL_KINDS, OFFLINE_SHAPE, env_prefix, sha256_file  # noqa: E402

DEST_ROOT = ROOT / "models" / "vision"
GOLDEN_FRAMES = ("000.jpg", "001.jpg", "002.jpg")
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def png_size(path: Path) -> tuple[int, int] | None:
    """(rộng, cao) đọc từ khối IHDR của PNG, không cần giải mã ảnh."""
    head = path.read_bytes()[:24] if path.is_file() else b""
    if len(head) < 24 or head[:8] != PNG_MAGIC or head[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", head[16:24])


def golden_problems(golden: Path, kind: str) -> list[str]:
    """Lỗi cấu trúc golden theo kind (rỗng = đạt). Không chạy model: `kiem_bundle.py` lo việc đó."""
    need = (*GOLDEN_FRAMES, "expected.json")
    problems = [f"thiếu golden/{n}" for n in need if not (golden / n).is_file()]
    if kind == "verifier" and not (golden / "boxes.json").is_file():
        problems.append("verifier thiếu golden/boxes.json (§9)")
    if kind in ("enhancer", "enhancer-offline"):
        want = (OFFLINE_SHAPE[1], OFFLINE_SHAPE[0]) if kind == "enhancer-offline" else (640, 480)
        for n in GOLDEN_FRAMES:
            out = golden / n.replace(".jpg", ".out.png")
            size = png_size(out)
            if size != want:
                problems.append(f"golden/{out.name} cỡ {size}, cần {want[0]}x{want[1]}")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Chép bundle model XLA vào models/vision/")
    ap.add_argument("--from", dest="src", type=Path, required=True)
    ap.add_argument("--dest-root", type=Path, default=DEST_ROOT)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    src: Path = args.src
    if not src.is_dir():
        print(f"không thấy thư mục {src}", file=sys.stderr)
        return 2
    onnx = list(src.glob("*.onnx"))
    meta_path = src / "meta.json"
    if len(onnx) != 1 or not meta_path.is_file() or not (src / "golden").is_dir():
        print(f"{src} không đúng cấu trúc bundle (.onnx, meta.json, golden/)", file=sys.stderr)
        return 1
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    kind = onnx[0].stem
    if kind not in MODEL_KINDS:
        print(f"{onnx[0].name}: kind {kind!r} không có trong hợp đồng", file=sys.stderr)
        return 1
    digest = sha256_file(onnx[0])
    if meta.get("model") != kind or digest != str(meta.get("onnx_sha256", "")).lower():
        msg = f"bundle sai: model {meta.get('model')!r}/{kind}, sha256 {digest} ≠ meta"
        print(msg, file=sys.stderr)
        return 1
    problems = golden_problems(src / "golden", kind)
    if problems:
        print(f"bundle sai: {'; '.join(problems)}", file=sys.stderr)
        return 1
    dest = args.dest_root / src.name
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    prefix = env_prefix(kind)
    rel = dest.relative_to(ROOT) if dest.is_relative_to(ROOT) else dest
    out = {
        "model": kind,
        "version": meta.get("version"),
        "dest": str(dest),
        "onnx": f"{rel.as_posix()}/{onnx[0].name}",
        "sha256": digest,
        "env": {f"{prefix}_ONNX": f"{rel.as_posix()}/{onnx[0].name}", f"{prefix}_SHA256": digest},
    }
    if args.json:
        print(json.dumps(out))
    else:
        print(f"đã chép {src} -> {dest}")
        for k, v in out["env"].items():
            print(f"{k}={v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
