"""Phát lại JPEG gốc của một bản ghi camera qua pipeline AI thật, đo ms từng bước + khung/s.

    uv run python scripts/vision/replay_bench.py --recording logs/recordings/20261102-100941 --json

Đọc JPEG nguyên vẹn bằng `backend.flights.video.Recording` (không nén lại), nạp hai model theo
`DETECTOR_ONNX`/`ENHANCER_ONNX` + sha256 (mặc định lấy sha256 từ meta.json của bundle đã chép), bật
luồng enhanced (trường hợp nặng nhất: có người xem "Ảnh rõ"), rồi:
  1. nhịp thật: đẩy khung vào `_on_frame` đúng giãn cách `unix_time` của bản ghi, thread pipeline
     xử lý như lúc bay -> khung bị bỏ (pipeline chậm hơn camera thì bỏ khung cũ);
  2. hết tốc lực: `process()` liên tiếp không ngủ -> công suất tối đa (khung/s).
Warmup 30 khung trước mỗi lượt. Ghi `logs/vision-bench/<thời điểm>.json` (logs/ đã gitignore) kèm
golden GPU của hai bundle (`kiem_bundle.check`).
Ngân sách (plan XLA phase 16): tổng p95 ≤ 50 ms, detector p95 ≤ 30 ms, enhancer p95 ≤ 30 ms.
Mã thoát: 0 = đạt ngân sách + golden, 1 = vượt / lệch, 2 = sai cách gọi.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "vision"))


def inside_repo(path: Path) -> Path:
    """Đường ghi ra phải nằm trong repo (chặn ghi đè file ngoài repo qua tham số dòng lệnh)."""
    resolved = (path if path.is_absolute() else ROOT / path).resolve()
    if not resolved.is_relative_to(ROOT):
        raise SystemExit(f"đường ghi {resolved} phải nằm trong {ROOT}")
    return resolved

from kiem_bundle import check as check_bundle  # noqa: E402

from backend import config  # noqa: E402
from backend.flights.video import Recording  # noqa: E402
from backend.vision.detector import PersonDetector  # noqa: E402
from backend.vision.enhancer import Enhancer  # noqa: E402
from backend.vision.model_bundle import load_bundle, read_meta  # noqa: E402
from backend.vision.pipeline import VisionPipeline  # noqa: E402
from backend.vision.stream import MjpegFrame  # noqa: E402

BUDGET_MS = {"total": 50.0, "detector": 30.0, "enhancer": 30.0}
WARMUP = 30


class _NullReader:
    def subscribe(self, fn):  # pipeline.start() đăng ký; bench tự gọi _on_frame
        pass

    def unsubscribe(self, fn):
        pass


def _sha(path: str, env_sha: str) -> str:
    return env_sha or str(read_meta(Path(path)).get("onnx_sha256", ""))


def _rows(rec_dir: Path) -> list[dict]:
    with (rec_dir / "frames.csv").open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _frame(rec: Recording, rows: list[dict], i: int) -> MjpegFrame | None:
    jpeg = rec.frame(i)
    if jpeg is None:
        return None
    ts = int(float(rows[i]["unix_time"]) * 1000)
    return MjpegFrame(jpeg, int(rows[i]["frame_id"] or i), ts, 12, "VGA", time.monotonic())


def _summary(pipe: VisionPipeline) -> dict:
    out = {}
    for step, vals in pipe.timings().items():
        if vals:
            s = sorted(vals)
            out[step] = {
                "p50": round(s[len(s) // 2], 2),
                "p95": round(s[min(len(s) - 1, int(len(s) * 0.95))], 2),
                "n": len(s),
            }
    return out


def _realtime(pipe: VisionPipeline, frames: list[MjpegFrame]) -> dict:
    """Đẩy khung đúng giãn cách của bản ghi; thread pipeline xử lý như lúc bay."""
    times = [f.timestamp_ms / 1000 for f in frames]
    pipe.reset_stats()
    pipe.start()
    t0, base = time.perf_counter(), times[0]
    for f, t in zip(frames, times, strict=True):
        wait = (t - base) - (time.perf_counter() - t0)
        if wait > 0:
            time.sleep(min(wait, 2.0))  # bản ghi có quãng camera đứng: không chờ quá 2 s
        pipe._on_frame(f)
    time.sleep(0.3)
    pipe.stop()
    wall = time.perf_counter() - t0
    return {
        "frames_in": pipe.frames_in,
        "frames_processed": pipe.frames_processed,
        "frames_dropped": pipe.frames_dropped,
        "dropped_frac": round(pipe.frames_dropped / max(pipe.frames_in, 1), 4),
        "input_fps": round(pipe.frames_in / wall, 2),
        "processed_fps": round(pipe.frames_processed / wall, 2),
        "errors": pipe.errors,
        "ms": _summary(pipe),
    }


def _maxrate(pipe: VisionPipeline, frames: list[MjpegFrame]) -> dict:
    pipe.reset_stats()
    t0 = time.perf_counter()
    for f in frames:
        pipe.process(f)
    wall = time.perf_counter() - t0
    return {
        "frames": pipe.frames_processed,
        "fps": round(pipe.frames_processed / wall, 2),
        "ms": _summary(pipe),
    }


def machine_state() -> dict:
    """Điều kiện máy lúc đo: GPU dùng chung với desktop (Chrome, VS Code, Discord…) làm số ms
    lệch gấp 2–3 lần giữa các lần đo (19/11/2026). Ghi kèm để số đo đọc đúng."""
    import subprocess

    q = "utilization.gpu,temperature.gpu,clocks.sm,clocks.max.sm,power.draw"
    try:
        out = (
            subprocess.run(
                ["nvidia-smi", f"--query-gpu={q}", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            .stdout.strip()
            .split(", ")
        )
        util, temp, clk, clk_max, power = (float(x) for x in out[:5])
    except (OSError, ValueError):
        return {"gpu": "nvidia-smi không đọc được"}
    return {
        "gpu_util_idle_pct": util,
        "gpu_temp_c": temp,
        "gpu_clock_mhz": clk,
        "gpu_clock_max_mhz": clk_max,
        "gpu_power_w": power,
    }


def run(rec_dir: Path, start: int, n: int) -> dict:
    det_b = load_bundle(
        config.DETECTOR_ONNX, _sha(config.DETECTOR_ONNX, config.DETECTOR_SHA256), "detector"
    )
    enh_b = load_bundle(
        config.ENHANCER_ONNX, _sha(config.ENHANCER_ONNX, config.ENHANCER_SHA256), "enhancer"
    )
    state = machine_state()
    pipe = VisionPipeline(
        _NullReader(), PersonDetector(det_b), Enhancer(enh_b), timing_window=100_000
    )
    rec, rows = Recording(rec_dir), _rows(rec_dir)
    idx = range(start, min(len(rows), start + WARMUP + n))
    frames = [f for f in (_frame(rec, rows, i) for i in idx) if f is not None]
    warm, body = frames[:WARMUP], frames[WARMUP:]

    pipe.acquire_enhanced()  # có người xem "Ảnh rõ": trường hợp nặng nhất
    for f in warm:
        pipe.process(f)
    realtime = _realtime(pipe, body)
    maxrate = _maxrate(pipe, body)
    pipe.release_enhanced()  # mặc định web: "Ảnh rõ" tắt, chỉ detector
    realtime_det = _realtime(pipe, body)
    return {
        "machine": state,
        "detector": {
            "version": det_b.version,
            "onnx_sha256": det_b.meta["onnx_sha256"],
            "providers": det_b.providers,
        },
        "enhancer": {
            "version": enh_b.version,
            "onnx_sha256": enh_b.meta["onnx_sha256"],
            "providers": enh_b.providers,
        },
        "realtime": realtime,
        "maxrate": maxrate,
        "realtime_detector_only": realtime_det,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Bench pipeline AI trên bản ghi camera thật")
    ap.add_argument("--recording", type=Path, required=True)
    ap.add_argument(
        "--start", type=int, default=284, help="khung đầu (mặc định: lúc rời đất 02/11)"
    )
    ap.add_argument("--frames", type=int, default=600)
    ap.add_argument("--out-dir", type=Path, default=ROOT / "logs" / "vision-bench")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    rec_dir = args.recording if args.recording.is_absolute() else ROOT / args.recording
    if not (rec_dir / "frames.csv").is_file():
        print(f"không thấy {rec_dir / 'frames.csv'}", file=sys.stderr)
        return 2
    res = run(rec_dir, args.start, args.frames)
    golden = {
        kind: check_bundle(Path(path).parent, sha or None, None)
        for kind, path, sha in (
            ("detector", config.DETECTOR_ONNX, config.DETECTOR_SHA256),
            ("enhancer", config.ENHANCER_ONNX, config.ENHANCER_SHA256),
        )
    }
    ms = res["realtime"]["ms"]
    budget = {
        k: {"p95": ms.get(k, {}).get("p95"), "max": v, "pass": ms.get(k, {}).get("p95", 1e9) <= v}
        for k, v in BUDGET_MS.items()
    }
    gpu = all(res[k]["providers"][0] == "CUDAExecutionProvider" for k in ("detector", "enhancer"))
    res |= {
        "recording": rec_dir.name,
        "start": args.start,
        "created": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "budget_ms": budget,
        "golden": {
            k: {"pass": v["pass"], "providers": v.get("providers")} for k, v in golden.items()
        },
        "gpu": gpu,
    }
    res["pass"] = (
        all(b["pass"] for b in budget.values())
        and all(g["pass"] for g in res["golden"].values())
        and gpu
        and res["realtime"]["errors"] == 0
    )
    out_dir = inside_repo(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(res, indent=1), encoding="utf-8")
    res["file"] = str(out)
    print(json.dumps(res) if args.json else f"{'ĐẠT' if res['pass'] else 'KHÔNG ĐẠT'} -> {out}")
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
