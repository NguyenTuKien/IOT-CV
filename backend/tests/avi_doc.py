"""Đọc file AVI bằng tay để kiểm `backend/vision/avi_writer.py` mà không tin vào chính nó.

Đi theo cấu trúc RIFF (fourcc + cỡ, lồng nhau), không dùng vị trí cố định nào của bộ ghi:
cỡ một LIST mà sai thì các chunk bên trong lệch và phép đọc hỏng ngay.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AviDoc:
    file_bytes: int
    riff_end: int  # vị trí hết chunk RIFF theo cỡ ghi trong file
    us_per_frame: int
    total_frames: int  # avih.dwTotalFrames
    width: int
    height: int
    handler: bytes  # strh.fccHandler
    fps: float  # strh.dwRate / strh.dwScale
    length: int  # strh.dwLength
    chunks: list[bytes]  # dữ liệu từng chunk 00dc trong movi, theo thứ tự
    index: list[tuple[bytes, int, int, int]] | None  # idx1: (fourcc, flags, offset, size)
    index_ok: bool  # mọi mục idx1 trỏ đúng chunk cùng cỡ


def _walk(data: bytes, start: int, end: int) -> list[tuple[bytes, int, int, bytes | None]]:
    """Các chunk trong [start, end): (fourcc, vị trí dữ liệu, cỡ dữ liệu, loại LIST)."""
    out = []
    i = start
    while i + 8 <= end:
        fourcc = data[i : i + 4]
        size = struct.unpack_from("<I", data, i + 4)[0]
        body = i + 8
        assert body + size <= end, (
            f"chunk {fourcc!r} ở {i} tràn ra ngoài cha ({body + size} > {end})"
        )
        if fourcc in (b"RIFF", b"LIST"):
            out.append((fourcc, body + 4, size - 4, data[body : body + 4]))
        else:
            out.append((fourcc, body, size, None))
        i = body + size + (size & 1)
    return out


def _by_name(items) -> dict[bytes, tuple[int, int]]:
    return {(kind or fourcc): (start, size) for fourcc, start, size, kind in items}


def doc_avi(path: str | Path) -> AviDoc:
    data = Path(path).read_bytes()
    assert data[:4] == b"RIFF" and data[8:12] == b"AVI ", "không phải RIFF AVI"
    riff_size = struct.unpack_from("<I", data, 4)[0]
    riff_end = 8 + riff_size
    top = _by_name(_walk(data, 12, riff_end))
    hdrl_start, hdrl_size = top[b"hdrl"]
    hdrl = _by_name(_walk(data, hdrl_start, hdrl_start + hdrl_size))
    avih, _ = hdrl[b"avih"]
    us_per_frame = struct.unpack_from("<I", data, avih)[0]
    total = struct.unpack_from("<I", data, avih + 16)[0]
    width, height = struct.unpack_from("<II", data, avih + 32)
    strl_start, strl_size = hdrl[b"strl"]
    strl = _by_name(_walk(data, strl_start, strl_start + strl_size))
    strh, _ = strl[b"strh"]
    assert data[strh : strh + 4] == b"vids"
    handler = data[strh + 4 : strh + 8]
    scale, rate, _start, length = struct.unpack_from("<IIII", data, strh + 20)
    movi_start, movi_size = top[b"movi"]
    movi_items = _walk(data, movi_start, movi_start + movi_size)
    chunks = [data[s : s + n] for fourcc, s, n, _ in movi_items if fourcc == b"00dc"]
    index = None
    index_ok = True
    if b"idx1" in top:
        idx_start, idx_size = top[b"idx1"]
        index = [
            struct.unpack_from("<4sIII", data, j)
            for j in range(idx_start, idx_start + idx_size, 16)
        ]
        base = movi_start - 4  # offset trong idx1 tính từ chữ 'movi'
        for fourcc, _flags, offset, size in index:
            pos = base + offset
            ok = (
                data[pos : pos + 4] == fourcc and struct.unpack_from("<I", data, pos + 4)[0] == size
            )
            index_ok = index_ok and ok
    return AviDoc(
        file_bytes=len(data),
        riff_end=riff_end,
        us_per_frame=us_per_frame,
        total_frames=total,
        width=width,
        height=height,
        handler=handler,
        fps=rate / scale,
        length=length,
        chunks=chunks,
        index=index,
        index_ok=index_ok,
    )
