"""Dựng docs/huong-dan/sac-pin-b6ac.html — MỘT file HTML tự chứa, mở thẳng bằng trình duyệt, chạy offline.

Chạy (từ gốc repo):
    py -3.13 docs/huong-dan/sac-pin/build.py

Cần có: Node 24 + `frontend/node_modules` đã `pnpm install` (lấy rolldown và three).
Bản gói 3D để ở `SAC_BUILD_DIR` (mặc định `D:\\DevCache\\tmp\\sac-pin-build`), không ghi rác vào repo.

Thiếu file chương (`src/ch-<id>.js`) hay `src/scene3d.js` thì build DỪNG. Lúc đang dựng dở từng phần,
đặt `SAC_ALLOW_MISSING=1` để build vẫn ra trang: chương thiếu hiện khung báo "chưa có", 3D thiếu hiện
khung báo "chưa có" — build in rõ danh sách phần đang thiếu.
"""

from __future__ import annotations

import base64
import datetime as dt
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
ROOT = HERE.parents[2]
OUT = ROOT / "docs" / "huong-dan" / "sac-pin-b6ac.html"
CACHE = Path(os.environ.get("SAC_BUILD_DIR", r"D:\DevCache\tmp\sac-pin-build"))
ALLOW_MISSING = os.environ.get("SAC_ALLOW_MISSING") == "1"


def fail(msg: str) -> None:
    print(f"[build] LOI: {msg}", file=sys.stderr)
    sys.exit(1)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def chapter_order() -> list[str]:
    m = re.search(r"SAC\.ORDER\s*=\s*\[([^\]]+)\]", read(SRC / "core.js"))
    if not m:
        fail("khong doc duoc SAC.ORDER trong core.js")
    return re.findall(r"'([^']+)'", m.group(1))


def collect_js(missing: list[str]) -> str:
    parts = [SRC / "core.js"]
    for name in ("data-menu.js", "sim.js"):
        p = SRC / name
        if p.exists():
            parts.append(p)
        else:
            missing.append(name)
    parts += sorted(SRC.glob("diag-*.js"))
    stubs = []
    for cid in chapter_order():
        p = SRC / f"ch-{cid}.js"
        if p.exists():
            parts.append(p)
        else:
            missing.append(p.name)
            stubs.append(cid)
    parts.append(SRC / "app.js")
    js = "\n;\n".join(f"/* ---- {p.name} ---- */\n" + read(p) for p in parts)
    if stubs:
        js += "\n;(function(){var S=window.SAC;" + "".join(
            f"if(!S.chapters['{c}'])S.chapter('{c}',{{num:{i},title:'{c} (chưa có)',render:function(r){{"
            f"r.appendChild(S.head({{num:{i},title:'{c} (chưa có)'}}));}}}});"
            for i, c in enumerate(chapter_order()) if c in stubs
        ) + "})();"
    return js


def collect_models() -> str:
    models = {}
    for p in sorted((SRC / "models").glob("*.glb")):
        models[p.stem] = base64.b64encode(p.read_bytes()).decode("ascii")
    body = ",".join(f'"{k}":"{v}"' for k, v in models.items())
    return f"window.SAC_MODELS={{{body}}};"


def collect_images() -> str:
    """Ảnh chụp thật (src/images/*.webp|png) → window.SAC_IMAGES = {tên-file-không-đuôi: data URL}."""
    mime = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}
    imgs = {}
    for p in sorted((SRC / "images").glob("*")):
        if p.suffix.lower() in mime:
            imgs[p.stem] = f"data:{mime[p.suffix.lower()]};base64," + base64.b64encode(p.read_bytes()).decode("ascii")
    body = ",".join(f'"{k}":"{v}"' for k, v in imgs.items())
    return f"window.SAC_IMAGES={{{body}}};"


def bundle_3d(missing: list[str]) -> str:
    entry = SRC / "scene3d.js"
    if not entry.exists():
        missing.append("scene3d.js")
        return ("window.SAC.view3d=function(el){el.classList.add('v3d');"
                "el.appendChild(document.createTextNode('Mô hình 3D chưa có'));"
                "return{setView(){},highlight(){},dispose(){}};};")
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / "scene3d.bundle.js"
    r = subprocess.run(["node", str(HERE / "bundle3d.mjs"), str(entry), str(out)], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        fail("dong goi 3D that bai:\n" + r.stdout + r.stderr)
    return read(out)


def main() -> None:
    missing: list[str] = []
    js = collect_js(missing)
    b3d = bundle_3d(missing)
    if missing and not ALLOW_MISSING:
        fail("thieu: " + ", ".join(missing) + "  (dat SAC_ALLOW_MISSING=1 neu dang dung do)")
    if missing:
        print("[build] CANH BAO — dang thieu, trang se hien khung 'chua co': " + ", ".join(missing))
    today = dt.date.today().strftime("%d/%m/%Y")
    html = read(SRC / "page.html")
    # Thay bằng hàm (không phải chuỗi) để ký tự '\' trong mã JS không bị re hiểu sai.
    for key, val in {
        "CSS": read(SRC / "styles.css"),
        "MODELS": collect_models() + collect_images(),
        "JS": js,
        "BUNDLE3D": b3d.replace("</script", "<\\/script"),
        "BOOT": f"window.SAC.BUILD_DATE='{today}';window.SAC.boot();",
    }.items():
        marker = f"/*@@{key}@@*/"
        if marker not in html:
            fail(f"page.html thieu {marker}")
        html = html.replace(marker, val.replace("</script", "<\\/script") if key != "BUNDLE3D" else val)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"[build] ok -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
