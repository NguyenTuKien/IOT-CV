"""Chuyển tiếp tới `backend/flights/binlog.py` (15/11/2026), nơi duy nhất giữ bộ đọc log `.bin`.

Giữ file này để `phan_tich_log.py` và lệnh cũ (`from log_bin import LogBin`) chạy như trước.
Sửa code thì sửa ở `backend/flights/binlog.py`.
"""

import sys
from pathlib import Path

_GOC_REPO = str(Path(__file__).resolve().parents[2])
if _GOC_REPO not in sys.path:
    sys.path.insert(0, _GOC_REPO)

from backend.flights.binlog import (  # noqa: E402, F401
    DAU,
    FMT_ID,
    FMT_LEN,
    GIAY_NHUAN_GPS,
    GIO_VN,
    GPS_EPOCH,
    LOAI_DINH_DANG,
    LogBin,
    ban_ghi_dinh_dang,
    co_bang_fmt,
    ghep_fmt,
    so_byte_lech,
)
