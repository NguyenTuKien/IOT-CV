"""Vệ sinh repo: khung sườn AI cũ `ml/scripts/` đã xoá thì không được quay lại.

Sáu file `ml/scripts/*.py` (chỉ ném `NotImplementedError`) xoá 25/11/2026 theo plan XLA
`plans/261125-ai-v2/phase-16-iotcv-don-no.md`; phần AI nằm ở repo XLA, IOT-CV chỉ nhận
ONNX vào `models/vision/` (xem `ml/README.md`). Tài liệu lịch sử (`docs/archive/`,
`plans/ai/`, `plans/reports/260921-*`, `plans/PROGRESS.md`) còn nhắc tên cũ là bản ghi,
không quét ở đây; chỉ quét code, CI, hạ tầng và cấu hình.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Ghép chuỗi để chính file này không tự khớp mẫu khi bị quét.
_PATTERN = re.compile(rb"ml[\\/]+" + rb"scripts", re.IGNORECASE)

# Các chỗ có thể GỌI script: code backend, web, script dòng lệnh, CI, hạ tầng, cấu hình uv.
_SCAN = ("backend", "frontend/src", "scripts", ".github", "infra", "pyproject.toml")
_SKIP_DIRS = {"__pycache__", "node_modules", ".pytest_cache", ".ruff_cache", "dist"}


def _files(target: Path):
    if target.is_file():
        yield target
        return
    for path in target.rglob("*"):
        if path.is_file() and not _SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
            yield path


def test_ml_scripts_khong_ton_tai():
    path = ROOT / "ml" / "scripts"
    assert not path.exists(), (
        f"{path} đã xoá 25/11/2026 (phần AI ở repo XLA); đừng tạo lại, thêm code AI vào XLA"
    )


def test_khong_code_nao_nhac_ml_scripts():
    self_path = Path(__file__).resolve()
    scanned = 0
    hits: list[str] = []
    for name in _SCAN:
        target = ROOT / name
        assert target.exists(), f"thiếu {target}: sửa _SCAN cho khớp cấu trúc repo"
        for path in _files(target):
            if path.resolve() == self_path:
                continue
            scanned += 1
            for lineno, line in enumerate(path.read_bytes().splitlines(), 1):
                if _PATTERN.search(line):
                    hits.append(f"{path.relative_to(ROOT).as_posix()}:{lineno}")
    # Quét rỗng thì "không có hit" chẳng chứng minh gì.
    assert scanned > 50, f"chỉ quét được {scanned} file, đường quét sai"
    assert not hits, "code/CI/cấu hình còn nhắc ml/scripts đã xoá: " + ", ".join(hits)
