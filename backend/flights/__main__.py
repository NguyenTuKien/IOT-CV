"""Dựng sẵn đệm của trang Lịch sử bay và in bảng tóm tắt mọi chuyến.

    uv run python -m backend.flights            # bảng tóm tắt
    uv run python -m backend.flights --events   # thêm sự kiện cảnh báo của từng chuyến

Lần đầu đọc hết log (log `.bin` lớn mất hàng chục giây mỗi file); các lần sau đọc đệm.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime

from backend.flights import store_from_config
from backend.flights.binlog import GIO_VN


def _f(v, fmt: str = "{:.1f}") -> str:
    return "-" if v is None else fmt.format(v)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--events", action="store_true", help="in sự kiện cảnh báo/lỗi của từng chuyến")
    args = ap.parse_args()
    t0 = time.monotonic()
    store = store_from_config()
    scan = store.scan()
    flights = store.flights()
    print(
        f"Quét {len(scan.tracks)} log + {len(scan.videos)} lần ghi hình trong "
        f"{time.monotonic() - t0:.1f} s; bỏ qua {len(scan.skipped)} file"
    )
    for f, why in scan.skipped:
        print(f"  BỎ QUA {f}: {why}")
    print(
        "id               dài(s) bay  cao   xa    pin V        mAh  link%  "
        "cam/s phủ%  cảnh báo  mode"
    )
    for fl in flights:
        s = fl["summary"]
        print(
            f"{s['id']}  {s['duration_s']:6.0f} {'có ' if s['took_off'] else 'không':5} "
            f"{_f(s['max_alt_m']):>5} {_f(s['max_dist_m']):>5} "
            f"{_f(s['battery_start_v'], '{:.2f}'):>5}→{_f(s['battery_min_v'], '{:.2f}'):<5} "
            f"{_f(s['used_mah'], '{:.0f}'):>4} {_f(s['link_loss_pct']):>5} {_f(s['video_fps']):>5} "
            f"{_f(s['video_coverage_pct'], '{:.0f}'):>4} {s['warnings']:>6}    "
            f"{','.join(s['modes'])}  [{'+'.join(s['sources'])}]"
        )
        if args.events:
            for e in fl["events"]:
                if e["level"] != "info":
                    at = datetime.fromtimestamp(fl["window_start"] + e["t"], GIO_VN).strftime(
                        "%H:%M:%S"
                    )
                    print(f"      {at} {e['level']:7} {e['source']:6} {e['text']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
