"""Đọc một lần ghi hình của backend (`logs/recordings/<YYYYMMDD-HHMMSS>/`) để phát lại theo giờ.

Định dạng do `backend/vision/video_recorder.py` ghi: các đoạn `video-NNN.avi` (MJPEG, mỗi khung
một chunk `00dc`) và `frames.csv` (mỗi khung THẬT một dòng: đoạn, số khung trong đoạn, giờ Unix).
Khung lấp chỗ mất hình ngắn có trong AVI nhưng không có dòng CSV, nên `video_frame` nhảy qua chúng
— số đó chính là thứ tự chunk trong AVI.

AVI đang ghi dở (backend chết, laptop ngủ) chưa có `idx1` và cỡ RIFF sai, nên ở đây không tin
header: đi tuần tự từng chunk từ đầu `movi`, gặp chunk cụt ở cuối file thì dừng.
"""

from __future__ import annotations

import csv
import re
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

REC_NAME = re.compile(r"^\d{8}-\d{6}$")
_HEAD_SCAN = 1 << 16


def read_recording_meta(rec_dir: Path) -> dict[str, Any]:
    """Giờ của mọi khung thật (theo thứ tự ghi) + cỡ khung. Dùng để dựng chuyến bay."""
    times: list[float] = []
    width = height = 0
    with (rec_dir / "frames.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            try:
                times.append(round(float(row["unix_time"]), 3))
            except (KeyError, ValueError):
                continue
            width = width or int(row.get("width") or 0)
            height = height or int(row.get("height") or 0)
    return {
        "ok": bool(times),
        "kind": "video",
        "rec": rec_dir.name,
        "times": times,
        "width": width,
        "height": height,
        "t0": times[0] if times else 0.0,
        "t1": times[-1] if times else 0.0,
    }


def avi_chunk_index(path: Path) -> list[tuple[int, int]]:
    """(vị trí dữ liệu, cỡ) của mọi chunk `00dc` trong `movi`, theo thứ tự."""
    size_file = path.stat().st_size
    out: list[tuple[int, int]] = []
    with path.open("rb") as f:
        head = f.read(_HEAD_SCAN)
        i = head.find(b"movi")
        if i < 8 or head[i - 8 : i - 4] != b"LIST":
            raise ValueError(f"{path.name}: không thấy LIST movi")
        pos = i + 4
        while pos + 8 <= size_file:
            f.seek(pos)
            h = f.read(8)
            fourcc, size = h[:4], int.from_bytes(h[4:8], "little")
            if fourcc == b"idx1" or pos + 8 + size > size_file:
                break
            if fourcc == b"LIST":  # LIST rec: đi vào trong
                pos += 12
                continue
            if fourcc == b"00dc":
                out.append((pos + 8, size))
            pos += 8 + size + (size & 1)
    return out


class Recording:
    """Lấy JPEG thứ `n` (theo thứ tự dòng của `frames.csv`) của một lần ghi."""

    def __init__(self, rec_dir: Path) -> None:
        self.dir = rec_dir
        self.rows: list[tuple[int, int]] = []  # (đoạn, số chunk trong AVI)
        with (rec_dir / "frames.csv").open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                try:
                    self.rows.append((int(row["segment"]), int(row["video_frame"])))
                except (KeyError, ValueError):
                    continue
        self._chunks: dict[int, list[tuple[int, int]]] = {}
        self._lock = threading.Lock()

    def _index(self, segment: int) -> list[tuple[int, int]]:
        with self._lock:
            if segment not in self._chunks:
                avi = self.dir / f"video-{segment:03d}.avi"
                self._chunks[segment] = avi_chunk_index(avi) if avi.exists() else []
            return self._chunks[segment]

    def frame(self, n: int) -> bytes | None:
        if not 0 <= n < len(self.rows):
            return None
        segment, video_frame = self.rows[n]
        chunks = self._index(segment)
        if video_frame >= len(chunks):
            return None
        offset, size = chunks[video_frame]
        if size == 0:
            return None
        with (self.dir / f"video-{segment:03d}.avi").open("rb") as f:
            f.seek(offset)
            data = f.read(size)
        return data if data[:2] == b"\xff\xd8" else None


class RecordingCache:
    """Giữ vài lần ghi đã mở (mỗi cái giữ bảng vị trí chunk) — tua qua lại không đọc lại AVI."""

    def __init__(self, root: Path, size: int = 4) -> None:
        self.root = root
        self.size = size
        self._items: OrderedDict[tuple[str, float], Recording] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, rec: str) -> Recording | None:
        if not REC_NAME.match(rec):
            return None
        rec_dir = self.root / rec
        csv_path = rec_dir / "frames.csv"
        if not csv_path.is_file():
            return None
        key = (rec, csv_path.stat().st_mtime)
        with self._lock:
            if key in self._items:
                self._items.move_to_end(key)
                return self._items[key]
        item = Recording(rec_dir)
        with self._lock:
            self._items[key] = item
            while len(self._items) > self.size:
                self._items.popitem(last=False)
        return item
