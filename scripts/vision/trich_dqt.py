"""Trích bảng DQT + cách lấy mẫu màu của camera thật từ một khung đã ghi -> camera_dqt.json.

    uv run python scripts/vision/trich_dqt.py --recording logs/recordings/20261102-100941

Ghi `backend/vision/assets/camera_dqt.json` (bảng thứ tự tự nhiên, subsampling, nguồn, sha256 khung
nguồn). Camera giả (`backend/vision/fake_stream.py`) đọc file này để nén đúng như camera thật ở q12.
Mã thoát: 0 = ghi xong, 1 = khung không đọc được / không phải q12, 2 = sai cách gọi.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.flights.video import Recording  # noqa: E402
from backend.vision.jpeg_tables import DQT_ASSET, parse_jpeg_tables  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--recording", type=Path, required=True)
    ap.add_argument("--frame", type=int, default=500, help="số thứ tự dòng trong frames.csv")
    ap.add_argument("--out", type=Path, default=DQT_ASSET)
    ap.add_argument("--json", action="store_true", help="in kết quả JSON ra stdout")
    args = ap.parse_args(argv)
    rec_dir = args.recording if args.recording.is_absolute() else ROOT / args.recording
    if not (rec_dir / "frames.csv").is_file():
        print(f"không thấy {rec_dir / 'frames.csv'}", file=sys.stderr)
        return 2
    jpeg = Recording(rec_dir).frame(args.frame)
    if jpeg is None:
        print(f"khung {args.frame} không đọc được", file=sys.stderr)
        return 1
    with (rec_dir / "frames.csv").open(encoding="utf-8", newline="") as f:
        row = list(csv.DictReader(f))[args.frame]
    tables = parse_jpeg_tables(jpeg)
    luma_id = tables.components[0][3]
    chroma_id = tables.components[1][3]
    out = {
        "camera": "OV3660 + ESP32-S3 (esp32-camera)",
        "esp32_quality": 12,
        "subsampling": tables.subsampling,
        "components": [list(c) for c in tables.components],
        "qtable_luma": tables.qtables[luma_id],
        "qtable_chroma": tables.qtables[chroma_id],
        "order": "natural (row-major), không phải zigzag",
        "source": {
            "recording": rec_dir.name,
            "frame_index": args.frame,
            "segment": int(row["segment"]),
            "video_frame": int(row["video_frame"]),
            "width": tables.width,
            "height": tables.height,
            "sha256": hashlib.sha256(jpeg).hexdigest(),
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
    if args.json:
        print(json.dumps(out))
    else:
        print(f"đã ghi {args.out} ({tables.subsampling}, Y[0]={out['qtable_luma'][0]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
