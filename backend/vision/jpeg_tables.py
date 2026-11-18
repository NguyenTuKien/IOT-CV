"""Đọc bảng lượng tử (DQT) và cách lấy mẫu màu (SOF) từ header JPEG — không giải mã ảnh.

Dùng để camera giả nén ĐÚNG bảng của camera thật (OV3660 + esp32-camera, q12: Annex K × 0,75,
4:2:2) và để test so khung giả với khung thật. Bảng trả về theo thứ tự TỰ NHIÊN (hàng-cột), không
phải zigzag như trong file.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

# ZIGZAG[k] = chỉ số tự nhiên (hàng*8 + cột) của hệ số thứ k theo zigzag (ITU T.81 hình A.6).
ZIGZAG = (
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
)  # fmt: skip

DQT_ASSET = Path(__file__).resolve().parent / "assets" / "camera_dqt.json"


@dataclass(frozen=True)
class JpegTables:
    qtables: dict[int, list[int]]  # id bảng -> 64 số, thứ tự tự nhiên
    components: list[tuple[int, int, int, int]]  # (id, h, v, id bảng lượng tử)
    width: int
    height: int

    @property
    def subsampling(self) -> str:
        """ "4:4:4" / "4:2:2" / "4:2:0" theo hệ số lấy mẫu của thành phần Y so với Cb/Cr."""
        if len(self.components) != 3:
            return f"{len(self.components)}-comp"
        (_, hy, vy, _), (_, hc, vc, _) = self.components[0], self.components[1]
        ratio = (hy // max(hc, 1), vy // max(vc, 1))
        return {(1, 1): "4:4:4", (2, 1): "4:2:2", (2, 2): "4:2:0"}.get(ratio, f"{ratio}")


def parse_jpeg_tables(jpeg: bytes) -> JpegTables:
    if jpeg[:2] != b"\xff\xd8":
        raise ValueError("không phải JPEG (thiếu SOI)")
    qtables: dict[int, list[int]] = {}
    components: list[tuple[int, int, int, int]] = []
    width = height = 0
    i = 2
    while i + 4 <= len(jpeg):
        if jpeg[i] != 0xFF:
            raise ValueError(f"marker hỏng ở byte {i}")
        marker = jpeg[i + 1]
        if marker == 0xFF:  # byte đệm
            i += 1
            continue
        length = int.from_bytes(jpeg[i + 2 : i + 4], "big")
        seg = jpeg[i + 4 : i + 2 + length]
        if marker == 0xDB:
            j = 0
            while j < len(seg):
                precision, table_id = seg[j] >> 4, seg[j] & 0x0F
                size = 128 if precision else 64
                raw = seg[j + 1 : j + 1 + size]
                vals = (
                    [int.from_bytes(raw[k : k + 2], "big") for k in range(0, 128, 2)]
                    if precision
                    else list(raw)
                )
                natural = [0] * 64
                for k, v in enumerate(vals):
                    natural[ZIGZAG[k]] = v
                qtables[table_id] = natural
                j += 1 + size
        elif marker in (0xC0, 0xC1, 0xC2):
            height = int.from_bytes(seg[1:3], "big")
            width = int.from_bytes(seg[3:5], "big")
            for c in range(seg[5]):
                cid, hv, tq = seg[6 + 3 * c : 9 + 3 * c]
                components.append((cid, hv >> 4, hv & 0x0F, tq))
        elif marker == 0xDA:  # SOS: hết header
            break
        i += 2 + length
    if not qtables or not components:
        raise ValueError("header JPEG thiếu DQT hoặc SOF")
    return JpegTables(qtables, components, width, height)


def load_camera_dqt(path: Path = DQT_ASSET) -> dict:
    """`camera_dqt.json` do `scripts/vision/trich_dqt.py` ghi từ một khung thật."""
    return json.loads(path.read_text(encoding="utf-8"))
