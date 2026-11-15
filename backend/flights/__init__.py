"""Lịch sử bay: ghép log FC (dataflash), tlog của backend và video đã ghi thành từng chuyến bay.

- `binlog.py`  — đọc `.bin` của ArduPilot, cứu log mất bảng FMT.
- `sources.py` — một file log → chuỗi thời gian + ARM + mode + sự kiện.
- `video.py`   — lấy khung JPEG theo giờ từ `logs/recordings/`.
- `index.py`   — gom thành chuyến, lưu đệm, dựng dữ liệu cho `GET /api/flights…`.

Chỉ ĐỌC log; không đụng FC, không đụng link MAVLink đang chạy.
"""

from __future__ import annotations

from pathlib import Path

from backend import config


def store_from_config():
    from backend.flights.index import FlightStore

    return FlightStore(
        logs_dir=Path(config.FLIGHT_LOGS_DIR),
        tlog_dir=Path(config.TLOG_DIR),
        rec_dir=Path(config.RECORD_DIR),
        cache_dir=Path(config.FLIGHT_CACHE_DIR),
    )
