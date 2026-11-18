"""Kiểm một bundle model XLA bằng CHÍNH bộ nạp của backend + golden với dung sai hợp đồng §4.

    uv run python scripts/vision/kiem_bundle.py models/vision/detector-v1.0.0 [--cpu] --json

Bước: (1) `backend.vision.model_bundle.load_bundle` (4 kiểm §5; `--sha256` mặc định lấy từ
meta.json, tức là chỉ kiểm file khớp meta); (2) chạy 3 khung `golden/*.jpg` giải mã bằng
`cv2.imdecode` như backend; (3) so `golden/expected.json`:
  detector — cùng số hộp có score ≥ conf_threshold, mỗi hộp IoU ≥ 0,95, |Δscore| ≤ 0,02;
  enhancer — sai khác tuyệt đối trung bình ≤ 1,0, lớn nhất ≤ 8 (thang 0–255) so với `*.out.png`.
Mã thoát: 0 = đạt, 1 = bundle bị từ chối hoặc golden lệch, 2 = sai cách gọi.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.vision.model_bundle import BundleRejected, load_bundle, read_meta  # noqa: E402

IOU_MIN = 0.95
DSCORE_MAX = 0.02
MEAN_ABS_MAX = 1.0
MAX_ABS_MAX = 8


def _iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _check_detector(bundle, golden: Path, expected: dict) -> list[dict]:
    import cv2

    thr = float(bundle.meta["conf_threshold"])
    rows = []
    for name, want in sorted(expected.items()):
        img = cv2.imdecode(np.fromfile(golden / name, np.uint8), cv2.IMREAD_COLOR)
        boxes, scores = bundle.session.run(["boxes", "scores"], {"frame": img})
        got = [(b.tolist(), float(s)) for b, s in zip(boxes, scores, strict=True) if s >= thr]
        exp = [
            (b, float(s)) for b, s in zip(want["boxes"], want["scores"], strict=True) if s >= thr
        ]
        ok = len(got) == len(exp)
        worst_iou, worst_ds = 1.0, 0.0
        if ok:
            free = list(range(len(got)))
            for eb, es in exp:
                if not free:
                    ok = False
                    break
                j = max(free, key=lambda k: _iou(eb, got[k][0]))
                free.remove(j)
                worst_iou = min(worst_iou, _iou(eb, got[j][0]))
                worst_ds = max(worst_ds, abs(es - got[j][1]))
            ok = ok and worst_iou >= IOU_MIN and worst_ds <= DSCORE_MAX
        rows.append(
            {
                "frame": name,
                "n_expected": len(exp),
                "n_got": len(got),
                "min_iou": round(worst_iou, 4),
                "max_dscore": round(worst_ds, 4),
                "pass": ok,
            }
        )
    return rows


def _check_enhancer(bundle, golden: Path, expected: dict) -> list[dict]:
    import cv2

    rows = []
    for name in sorted(expected):
        img = cv2.imdecode(np.fromfile(golden / name, np.uint8), cv2.IMREAD_COLOR)
        (out,) = bundle.session.run(["frame_out"], {"frame": img})
        ref_path = golden / (Path(name).stem + ".out.png")
        ref = cv2.imdecode(np.fromfile(ref_path, np.uint8), cv2.IMREAD_COLOR)
        diff = np.abs(out.astype(np.int16) - ref.astype(np.int16))
        mean_abs, max_abs = float(diff.mean()), int(diff.max())
        rows.append(
            {
                "frame": name,
                "mean_abs": round(mean_abs, 4),
                "max_abs": max_abs,
                "pass": mean_abs <= MEAN_ABS_MAX and max_abs <= MAX_ABS_MAX,
            }
        )
    return rows


def check(bundle_dir: Path, sha256: str | None, providers: list[str] | None) -> dict:
    metas = list(bundle_dir.glob("*.onnx"))
    if len(metas) != 1:
        return {"pass": False, "reason": f"{bundle_dir} cần đúng một file .onnx, có {len(metas)}"}
    onnx_path = metas[0]
    kind = onnx_path.stem
    try:
        meta = read_meta(onnx_path)
        bundle = load_bundle(onnx_path, sha256 or str(meta.get("onnx_sha256", "")), kind, providers)
    except BundleRejected as exc:
        return {"pass": False, "model": kind, "reason": exc.reason}
    golden = bundle_dir / "golden"
    expected = json.loads((golden / "expected.json").read_text(encoding="utf-8"))
    rows = (_check_detector if kind == "detector" else _check_enhancer)(bundle, golden, expected)
    return {
        "pass": all(r["pass"] for r in rows),
        "model": kind,
        "version": bundle.version,
        "onnx_sha256": meta.get("onnx_sha256"),
        "providers": bundle.providers,
        "golden": rows,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Kiểm bundle model XLA bằng bộ nạp của backend")
    ap.add_argument("bundle", type=Path)
    ap.add_argument("--sha256", default=None, help="sha256 mong đợi (mặc định: meta.json)")
    ap.add_argument("--cpu", action="store_true", help="ép CPUExecutionProvider")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    if not args.bundle.is_dir():
        print(f"không thấy thư mục {args.bundle}", file=sys.stderr)
        return 2
    result = check(args.bundle, args.sha256, ["CPUExecutionProvider"] if args.cpu else None)
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(("ĐẠT" if result["pass"] else "KHÔNG ĐẠT"), json.dumps(result, ensure_ascii=False))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
