"""Chép một bundle model từ repo XLA vào models/vision/<bundle>/ và in sha256 cần đặt env.

    uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.0 [--json]

Kiểm cấu trúc bundle (hợp đồng §4: `<model>.onnx`, `meta.json`, `golden/`) và sha256 của file
.onnx khớp `meta.onnx_sha256` trước khi chép. KHÔNG sửa `.env`: lệnh in dòng `DETECTOR_SHA256=…`
để người chạy tự đặt (hoặc truyền qua biến môi trường của lệnh chạy backend). File .onnx bị dòng
`*.onnx` có sẵn trong `.gitignore` chặn, không vào git.
Mã thoát: 0 = đã chép, 1 = bundle sai, 2 = sai cách gọi.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.vision.model_bundle import sha256_file  # noqa: E402

DEST_ROOT = ROOT / "models" / "vision"


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
    digest = sha256_file(onnx[0])
    if meta.get("model") != kind or digest != str(meta.get("onnx_sha256", "")).lower():
        msg = f"bundle sai: model {meta.get('model')!r}/{kind}, sha256 {digest} ≠ meta"
        print(msg, file=sys.stderr)
        return 1
    dest = args.dest_root / src.name
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    env_key = f"{kind.upper()}_SHA256"
    rel = dest.relative_to(ROOT) if dest.is_relative_to(ROOT) else dest
    out = {
        "model": kind,
        "version": meta.get("version"),
        "dest": str(dest),
        "onnx": f"{rel.as_posix()}/{onnx[0].name}",
        "sha256": digest,
        "env": {f"{kind.upper()}_ONNX": f"{rel.as_posix()}/{onnx[0].name}", env_key: digest},
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
