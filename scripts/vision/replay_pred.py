"""Phát lại một bản ghi camera qua detector → verifier → lọc track, xuất CSV dự đoán "cả hệ" cho
XLA chấm — hợp đồng `D:/XLA/docs/hop-dong-model.md` §14.1 (từ 1.1; D4, D11 plan 261125-ai-v2).

    uv run --no-sync python scripts/vision/replay_pred.py --recording logs/recordings/<rec> \
        --frames <list.txt> --stage detector|verifier|track --out <csv> [--blank <list.txt>] \
        [--detector-onnx <path>] [--verifier-onnx <path>] \
        [--track-k K --track-n N --track-iou F --track-max-gap G] [--verifier-conf F] [--cpu] --json

Gọi từ XLA: env con KHÔNG được có `UV_PROJECT_ENVIRONMENT`/`VIRTUAL_ENV` của XLA (uv xoá venv).

Luật phát lại (§14.1):
- Phát MỌI khung theo thứ tự `frames.csv` (để track có ngữ cảnh), TRỪ khung trong `--blank`: khung
  đó không vào detector, và trạng thái track bị xoá khi VÀO và khi RA một đoạn khung blank (vào =
  khung blank đầu của một đoạn liền; ra = khung không blank đầu tiên sau đoạn đó; đoạn chạm cuối
  bản ghi chỉ có lần vào). `track_resets` đếm đúng số lần xoá đó.
- Chỉ ghi các khung trong `--frames` (giao với `--blank` → mã 2). Khung của bản ghi KHÁC trong hai
  danh sách bị bỏ qua (danh sách có thể gộp nhiều bản ghi); khung mang tên bản ghi này mà không có
  trong `frames.csv`, hay có mà đọc không được → mã 1.
- CSV `frame,x1,y1,x2,y2,conf` (px khung gốc 640×480,
  `frame` = `<rec>_<segment:03d>_<video_frame:05d>.jpg`).
  stage `detector`: mọi hộp graph trả (≥ `score_floor`, không lọc `conf_threshold` — để vẽ đường
  PR), `conf` = điểm detector. stage `verifier`: hộp ≥ ngưỡng detector, `conf` = điểm verifier,
  không lọc ngưỡng verifier. stage `track`: hộp ≥ ngưỡng detector và ≥ ngưỡng verifier
  (`--verifier-conf`, mặc định meta/env) thuộc track ĐÃ XÁC NHẬN ở khung đó, `conf` = điểm
  verifier (chạy không có verifier thì là điểm detector, `bundles.verifier` = null).
- Lọc track là `backend/vision/track_filter.py` (cài đặt duy nhất). k/n: `--track-*` > env
  `DETECTION_TRACK_*` > `recommended_track` của detector > k = n = `DETECTION_MIN_FRAMES`.
Mã thoát: 0 = xong; 1 = dữ liệu / bundle (bundle bị từ chối, khung thiếu/hỏng); 2 = sai cách gọi.
`--json` in `{frames_written, frames_replayed, frames_blank, track_resets, stage, track:{k,n,iou,
max_gap}, bundles:{detector,verifier}}` (+ `recording`, `out`, `frames_unreadable`).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "vision"))

from replay_bench import replay_frames  # noqa: E402

from backend import config  # noqa: E402
from backend.vision.detector import PersonDetector  # noqa: E402
from backend.vision.model_bundle import BundleRejected, LoadedBundle, load_bundle, read_meta  # noqa: E402
from backend.vision.track_filter import TrackBox, TrackFilter, resolve_track  # noqa: E402
from backend.vision.verifier import BoxVerifier  # noqa: E402

STAGES = ("detector", "verifier", "track")
CSV_HEADER = ["frame", "x1", "y1", "x2", "y2", "conf"]


class UsageError(Exception):
    """Sai cách gọi → mã 2."""


class DataError(Exception):
    """Dữ liệu hoặc bundle sai → mã 1."""


def frame_name(rec: str, segment: int, video_frame: int) -> str:
    """Tên khung theo D11 (`xla/camera/frames.py` `frame_name`)."""
    return f"{rec}_{segment:03d}_{video_frame:05d}.jpg"


def read_list(path: Path) -> list[str]:
    """Một tên khung mỗi dòng; bỏ dòng trống và dòng bắt đầu bằng `#`."""
    if not path.is_file():
        raise UsageError(f"không thấy file danh sách {path}")
    lines = (ln.strip() for ln in path.read_text(encoding="utf-8").splitlines())
    return [ln for ln in lines if ln and not ln.startswith("#")]


def _bundle(path: str, env_sha: str, kind: str, explicit: bool, providers) -> LoadedBundle:
    """sha256: đường dẫn truyền tay lấy từ meta.json của chính bundle đó (env sha thuộc đường dẫn
    trong config); đường dẫn config lấy env, rỗng thì meta (như `replay_bench.py`)."""
    try:
        sha = "" if explicit else env_sha
        sha = sha or str(read_meta(Path(path)).get("onnx_sha256", ""))
        return load_bundle(path, sha, kind, providers)
    except BundleRejected as exc:
        raise DataError(f"{kind} bị từ chối: {exc.reason}") from None


def _describe(bundle: LoadedBundle | None) -> dict | None:
    if bundle is None:
        return None
    return {
        "version": bundle.version,
        "onnx_sha256": bundle.meta.get("onnx_sha256"),
        "path": str(bundle.onnx_path),
        "providers": bundle.providers,
    }


def _parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Phát lại bản ghi, xuất CSV dự đoán cả hệ (§14.1)")
    ap.add_argument("--recording", type=Path, required=True)
    ap.add_argument("--frames", type=Path, required=True, help="danh sách khung cần ghi ra")
    ap.add_argument("--stage", choices=STAGES, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--blank", type=Path, default=None, help="khung bị cấm đưa vào detector")
    ap.add_argument("--detector-onnx", default=None)
    ap.add_argument("--verifier-onnx", default=None)
    ap.add_argument("--track-k", type=int, default=None)
    ap.add_argument("--track-n", type=int, default=None)
    ap.add_argument("--track-iou", type=float, default=None)
    ap.add_argument("--track-max-gap", type=int, default=None)
    ap.add_argument("--verifier-conf", type=float, default=None)
    ap.add_argument("--cpu", action="store_true", help="ép CPUExecutionProvider")
    ap.add_argument("--json", action="store_true")
    return ap


class _Replay:
    def __init__(self, args: argparse.Namespace, rec_dir: Path) -> None:
        self.args = args
        self.rec_dir = rec_dir
        self.rec = rec_dir.name
        providers = ["CPUExecutionProvider"] if args.cpu else None
        det_path = args.detector_onnx or config.DETECTOR_ONNX
        det_b = _bundle(
            det_path, config.DETECTOR_SHA256, "detector", bool(args.detector_onnx), providers
        )
        self.detector = PersonDetector(det_b)
        ver_path = args.verifier_onnx or config.VERIFIER_ONNX
        self.verifier: BoxVerifier | None = None
        if ver_path:
            ver_b = _bundle(
                ver_path, config.VERIFIER_SHA256, "verifier", bool(args.verifier_onnx), providers
            )
            self.verifier = BoxVerifier(ver_b, args.verifier_conf)
        elif args.stage == "verifier":
            raise UsageError("--stage verifier cần verifier: --verifier-onnx hoặc VERIFIER_ONNX")
        try:
            params, per_track = resolve_track(
                det_b.meta,
                k=args.track_k,
                n=args.track_n,
                iou=args.track_iou,
                max_gap=args.track_max_gap,
            )
        except ValueError as exc:
            raise UsageError(f"tham số track: {exc}") from None
        self.track = TrackFilter(
            params, cooldown_s=config.DETECTION_COOLDOWN_S, per_track_cooldown=per_track
        )

    def rows_for(self, img: np.ndarray, now: float) -> list[tuple[list[float], float]]:
        """Hộp + điểm của một khung theo `--stage`; luôn cập nhật track (cho ngữ cảnh)."""
        out = self.detector.raw(img)
        if out is None:
            raise DataError("khung sai cỡ")
        boxes = np.asarray(out[0], np.float64).reshape(-1, 4)
        scores = np.asarray(out[1], np.float64).reshape(-1)
        stage = self.args.stage
        rows: list[tuple[list[float], float]] = []
        if stage == "detector":
            rows = [(b.tolist(), float(s)) for b, s in zip(boxes, scores, strict=True)]
        keep = scores >= self.detector.confidence
        boxes, scores = boxes[keep], scores[keep]
        track_in: list[TrackBox] = []
        if self.verifier is not None:
            vscores = self.verifier.verify(img, boxes)
            if stage == "verifier":
                rows = [(b.tolist(), float(v)) for b, v in zip(boxes, vscores, strict=True)]
            for b, s, v in zip(boxes, scores, vscores, strict=True):
                if v >= self.verifier.confidence:
                    track_in.append(TrackBox(*b.tolist(), float(s), float(v)))
        else:
            track_in = [TrackBox(*b.tolist(), float(s)) for b, s in zip(boxes, scores, strict=True)]
        result = self.track.update(track_in, now)
        if stage == "track":
            rows = [
                (
                    [b.x1, b.y1, b.x2, b.y2],
                    b.score if b.verifier_score is None else b.verifier_score,
                )
                for _, b in result.confirmed
            ]
        return rows


def run(args: argparse.Namespace) -> dict:
    import cv2

    rec_dir = args.recording if args.recording.is_absolute() else ROOT / args.recording
    if not (rec_dir / "frames.csv").is_file():
        raise UsageError(f"không thấy {rec_dir / 'frames.csv'}")
    wanted = read_list(args.frames)
    blank = set(read_list(args.blank)) if args.blank is not None else set()
    overlap = sorted(set(wanted) & blank)
    if overlap:
        raise UsageError(f"--frames giao --blank ở {len(overlap)} khung, vd. {overlap[:3]}")
    replay = _Replay(args, rec_dir)
    rec = replay.rec
    prefix = f"{rec}_"
    wanted_set = {w for w in wanted if w.startswith(prefix)}

    written: dict[str, list[tuple[list[float], float]]] = {}
    unreadable: list[str] = []
    seen: set[str] = set()
    replayed = n_blank = resets = 0
    in_blank = False
    for item in replay_frames(rec_dir):
        name = frame_name(rec, item.segment, item.video_frame)
        seen.add(name)
        if name in blank:
            if not in_blank:
                replay.track.reset()
                resets += 1
                in_blank = True
            n_blank += 1
            continue
        if in_blank:
            replay.track.reset()
            resets += 1
            in_blank = False
        img = None
        if item.frame is not None:
            img = cv2.imdecode(np.frombuffer(item.frame.jpeg, np.uint8), cv2.IMREAD_COLOR)
        if img is None or img.shape != (480, 640, 3):
            # Khung không có (camera mất) thì lúc bay cũng không tới detector: không cập nhật track.
            unreadable.append(name)
            continue
        rows = replay.rows_for(img, item.frame.timestamp_ms / 1000.0)
        replayed += 1
        if name in wanted_set:
            written[name] = rows

    missing = sorted(wanted_set - seen)
    if missing:
        raise DataError(
            f"{len(missing)} khung của --frames không có trong {rec}, vd. {missing[:3]}"
        )
    bad = sorted(wanted_set & set(unreadable))
    if bad:
        raise DataError(f"{len(bad)} khung của --frames đọc không được, vd. {bad[:3]}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(CSV_HEADER)
        for name in sorted(written):
            for box, conf in written[name]:
                w.writerow([name, *(f"{v:.2f}" for v in box), f"{conf:.6f}"])
    return {
        "frames_written": len(written),
        "frames_replayed": replayed,
        "frames_blank": n_blank,
        "track_resets": resets,
        "stage": args.stage,
        "track": replay.track.params.as_dict(),
        "bundles": {
            "detector": _describe(replay.detector.bundle),
            "verifier": _describe(replay.verifier.bundle if replay.verifier else None),
        },
        "recording": rec,
        "out": str(args.out),
        "frames_unreadable": len(unreadable),
    }


def main(argv: list[str] | None = None) -> int:
    try:
        args = _parser().parse_args(argv)
    except SystemExit as exc:  # argparse: sai cách gọi = 2, --help = 0
        return int(exc.code or 0)
    try:
        res = run(args)
    except (UsageError, DataError) as exc:
        code = 2 if isinstance(exc, UsageError) else 1
        print(f"replay_pred: {exc}", file=sys.stderr)
        if args.json:
            print(json.dumps({"error": str(exc), "exit": code}, ensure_ascii=False))
        return code
    if args.json:
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(f"{res['frames_written']} khung -> {res['out']} (stage {res['stage']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
