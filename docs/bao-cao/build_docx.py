"""Dựng báo cáo Word từ chuong/*.md trên khuôn bìa + style của báo cáo môn.

    py -3.13 build_docx.py            # ra IOTCV_BaoCao_IoT.docx
    py -3.13 build_docx.py --word     # thêm: Word cập nhật mục lục, đếm trang, xuất PDF

Cú pháp Markdown: HOP-DONG.md. Hình/bảng đánh số theo chương, @fig:/@tab: đổi thành "Hình 2.3"/"Bảng 4.1".
"""
import copy
import csv
import glob
import os
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
TEMPLATE = os.path.join(REPO, "assignment", "B23DCCN600_Nguyễn Duy Nghĩa.docx")
OUT = os.path.abspath(os.environ.get("BC_OUT", os.path.join(HERE, "IOTCV_BaoCao_IoT.docx")))
CHART_DIR = os.path.join(HERE, "img", "chart")
COVER_LAST = 23          # phần tử cuối của trang bìa trong file mẫu (24 là ngắt trang, bỏ)
SECT_SRC = 357           # đoạn chứa sectPr có footer số trang
MEMBERS = [("Nguyễn Duy Nghĩa", "B23DCCN600"), ("Nguyễn Minh Toàn", "B23DCCN832"),
           ("Nguyễn Thành Trung", "B23DCCN861"), ("Nguyễn Tự Kiên", "B23DCCN465")]
TEACHER = "TS. Lê Văn Vịnh"
MAX_W, MAX_H = 16.0, 19.0
PAL = ["#BB2025", "#326CE5", "#15803D", "#B45309", "#6D28D9", "#1E293B"]
REFS = [
    "A. Bahga, V. Madisetti. Internet of Things: A Hands-On Approach. VPT, 2014.",
    "ArduPilot Dev Team. ArduPilot Copter Documentation (ArduCopter 4.x).",
    "MAVLink Development Team. MAVLink Developer Guide, giao thức MAVLink 2.",
    "SpeedyBee. SpeedyBee F405 V5 Stack, tài liệu hướng dẫn của hãng.",
    "Benewake. TFmini Plus LiDAR Module, Product Manual.",
    "Espressif Systems. ESP32-S3 Technical Reference Manual; dự án DroneBridge for ESP32.",
    "Ultralytics. YOLO11 Documentation.",
    "Nhóm 10. Báo cáo môn Xử lý ảnh: xử lý ảnh chất lượng thấp từ camera UAV, PTIT, 2026.",
]


# ---------------------------------------------------------------- markdown → blocks
def parse(md):
    lines = md.replace("\r", "").split("\n")
    blocks, i = [], 0
    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if not s:
            i += 1
            continue
        if s.startswith("```"):
            kind = s[3:].strip()
            body = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            blocks.append(("chart", body) if kind == "chart" else ("code", body))
            continue
        m = re.match(r"^(#{1,3})\s+(.*)$", s)
        if m:
            blocks.append(("h", len(m.group(1)), m.group(2).strip()))
            i += 1
            continue
        m = re.match(r"^(!!?)\[(.*?)\]\((.*?)\)\s*(\{.*\})?\s*$", s)
        if m:
            blocks.append(("img2" if m.group(1) == "!!" else "img", m.group(2), m.group(3), attrs(m.group(4))))
            i += 1
            continue
        m = re.match(r"^Bảng:\s*(.*?)\s*(\{.*\})?\s*$", s)
        j = i + 1
        while m and j < len(lines) and not lines[j].strip():
            j += 1  # chịu dòng trống giữa "Bảng:" và bảng
        if m and j < len(lines) and lines[j].strip().startswith("|"):
            cap, at = m.group(1), attrs(m.group(2))
            i = j
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                r = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in r):
                    rows.append(r)
                i += 1
            blocks.append(("table", cap, at, rows))
            continue
        if s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                r = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in r):
                    rows.append(r)
                i += 1
            blocks.append(("table", "", {}, rows))
            continue
        m = re.match(r"^(-|\*|\d+\.)\s+(.*)$", s)
        if m:
            kind = "ol" if m.group(1)[0].isdigit() else "ul"
            items = []
            while i < len(lines):
                mm = re.match(r"^\s*(-|\*|\d+\.)\s+(.*)$", lines[i])
                if mm:
                    items.append(mm.group(2).strip())
                elif lines[i].strip() and not re.match(r"^(#|!|\||```|Bảng:)", lines[i].strip()) and items:
                    items[-1] += " " + lines[i].strip()
                else:
                    break
                i += 1
            blocks.append((kind, items))
            continue
        para = [s]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#{1,3}\s|!!?\[|\||```|Bảng:|-\s|\*\s|\d+\.\s)",
                                                                   lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        blocks.append(("p", " ".join(para)))
    return blocks


def attrs(s):
    out = {}
    if not s:
        return out
    for tok in s.strip("{}").split():
        if tok.startswith("#"):
            out["id"] = tok[1:]
        elif "=" in tok:
            k, v = tok.split("=", 1)
            out[k] = v
    return out


def chart_spec(body):
    spec = {}
    for l in body:
        if ":" in l:
            k, v = l.split(":", 1)
            spec[k.strip()] = v.strip()
    return spec


# ---------------------------------------------------------------- numbering pass
def number_all(chapters):
    labels, ch_no, app = {}, 0, 0
    for _, blocks in chapters:
        fig = tab = 0
        for b in blocks:
            if b[0] == "h" and b[1] == 1:
                if b[2].lower().startswith("phụ lục"):
                    app += 1
                    key = chr(64 + app)
                else:
                    ch_no += 1
                    key = str(ch_no)
                fig = tab = 0
            elif b[0] in ("img", "img2"):
                fig += 1
                if b[3].get("id"):
                    labels[b[3]["id"]] = f"Hình {key}.{fig}"
            elif b[0] == "chart":
                fig += 1
                sid = chart_spec(b[1]).get("id")
                if sid:
                    labels[sid] = f"Hình {key}.{fig}"
            elif b[0] == "table" and b[1]:
                tab += 1
                if b[2].get("id"):
                    labels[b[2]["id"]] = f"Bảng {key}.{tab}"
    return labels


# ---------------------------------------------------------------- docx helpers
INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*\s][^*]*?\*|@(?:fig|tab):[\w-]+)")
MISSING = []


def runs(p, text, labels, size=None, bold=None):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("@"):
            lab = labels.get(part[1:])
            if not lab:
                MISSING.append(part)
            r = p.add_run(lab or part)
        elif part.startswith("**"):
            r = p.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("`"):
            r = p.add_run(part[1:-1])
            r.font.name = "Consolas"
            r.font.size = Pt(11)
        elif part.startswith("*") and len(part) > 2:
            r = p.add_run(part[1:-1])
            r.italic = True
        else:
            r = p.add_run(part)
        if size:
            r.font.size = Pt(size)
        if bold is not None and not part.startswith("**"):
            r.bold = bold


def resolve(path):
    p = path.replace("/", os.sep)
    return p if os.path.isabs(p) else os.path.join(REPO, p)


MAX_PX = 2000          # 16 cm ở 2000 px ~ 317 dpi, đủ in
HEAVY_PNG = 1_500_000  # PNG ảnh chụp nặng hơn mức này thì lưu JPEG


def embeddable(full):
    """Ảnh nhúng được và gọn: định dạng python-docx đọc được, rộng tối đa MAX_PX, PNG ảnh chụp nặng thành JPEG.
    Bản đổi nằm ở img/conv/ (bộ đệm dựng, xoá thoải mái)."""
    from PIL import Image
    from docx.image.image import Image as DocxImage
    im = Image.open(full)
    ok = im.format in ("PNG", "JPEG", "GIF", "BMP", "TIFF")
    if ok:
        try:
            DocxImage.from_file(full)
        except Exception:
            ok = False  # header python-docx không đọc được: mã hoá lại
    heavy = im.format == "PNG" and os.path.getsize(full) > HEAVY_PNG
    if ok and im.width <= MAX_PX and not heavy:
        return full
    as_jpeg = im.format == "JPEG" or heavy
    out_dir = os.path.join(HERE, "img", "conv")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, re.sub(r"[^\w.-]", "_", os.path.relpath(full, REPO)) + (".jpg" if as_jpeg else ".png"))
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(full):
        if im.width > MAX_PX:
            im = im.resize((MAX_PX, round(im.height * MAX_PX / im.width)), Image.LANCZOS)
        if as_jpeg:
            if im.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", im.size, "white")
                im = im.convert("RGBA")
                bg.paste(im, mask=im.split()[-1])
                im = bg
            im.convert("RGB").save(out, "JPEG", quality=90, optimize=True)
        else:
            (im if im.mode in ("RGB", "RGBA", "L", "P") else im.convert("RGB")).save(out, "PNG", optimize=True)
    return out


def add_picture(doc, path, w):
    from PIL import Image
    full = resolve(path)
    p = doc.add_paragraph(style="IOT Figure")
    p.paragraph_format.keep_with_next = True
    if not os.path.exists(full):
        r = p.add_run(f"[THIẾU HÌNH: {path}]")
        r.font.color.rgb = RGBColor(0xBB, 0x20, 0x25)
        r.bold = True
        print("  missing image:", path)
        return p
    full = embeddable(full)
    iw, ih = Image.open(full).size
    w = min(float(w), MAX_W)
    if w * ih / iw > MAX_H:
        w = MAX_H * iw / ih
    p.add_run().add_picture(full, width=Cm(w))
    return p


def caption(doc, style, text, labels):
    p = doc.add_paragraph(style=style)
    runs(p, text, labels)
    return p


def set_cell_border(cell, **kw):
    tcPr = cell._tc.get_or_add_tcPr()
    b = tcPr.find(qn("w:tcBorders"))
    if b is None:
        b = OxmlElement("w:tcBorders")
        tcPr.append(b)
    for edge, (sz, val) in kw.items():
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), val)
        e.set(qn("w:sz"), str(sz))
        e.set(qn("w:color"), "1F2937")
        b.append(e)


def add_table(doc, rows, labels):
    ncol = max(len(r) for r in rows)
    t = doc.add_table(rows=len(rows), cols=ncol)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    # cột rộng theo độ dài chữ (giảm dần để cột dài không nuốt hết), tổng 16 cm
    wt = []
    for j in range(ncol):
        ls = [len(re.sub(r"[`*]", "", r[j])) for r in rows if j < len(r)] or [1]
        word = max((len(w) for r in rows if j < len(r) for w in re.sub(r"[`*]", "", r[j]).split()), default=1)
        wt.append(max(4, word + 2, min(sum(ls) / len(ls) * 0.6 + max(ls) * 0.4, 60)) ** 0.85)
    widths = [Cm(16 * w / sum(wt)) for w in wt]
    grid = t._tbl.tblGrid
    for j, gc in enumerate(grid.findall(qn("w:gridCol"))):
        gc.set(qn("w:w"), str(int(widths[j].twips)))
    for i, r in enumerate(rows):
        for j in range(ncol):
            c = t.cell(i, j)
            c.paragraphs[0].style = doc.styles["Normal"]
            c.width = widths[j]
            pf = c.paragraphs[0].paragraph_format
            pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
            pf.space_before, pf.space_after, pf.line_spacing = Pt(2), Pt(2), 1.1
            runs(c.paragraphs[0], r[j] if j < len(r) else "", labels, size=11, bold=True if i == 0 else None)
            edges = {}
            if i == 0:
                edges["top"] = (12, "single")
                edges["bottom"] = (6, "single")
            if i == len(rows) - 1:
                edges["bottom"] = (12, "single")
            edges.setdefault("left", (0, "nil"))
            edges.setdefault("right", (0, "nil"))
            set_cell_border(c, **edges)
    # header row repeats across pages
    trPr = t.rows[0]._tr.get_or_add_trPr()
    h = OxmlElement("w:tblHeader")
    h.set(qn("w:val"), "true")
    trPr.append(h)
    doc.add_paragraph(style="IOT Body").paragraph_format.space_after = Pt(0)
    return t


def add_code(doc, body):
    for line in body:
        p = doc.add_paragraph(style="Normal")
        pf = p.paragraph_format
        pf.space_before = pf.space_after = Pt(0)
        pf.left_indent = Cm(0.6)
        pf.line_spacing = 1.0
        r = p.add_run(line if line else " ")
        r.font.name = "Consolas"
        r.font.size = Pt(10)
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear")
        sh.set(qn("w:fill"), "F3F4F6")
        p._p.get_or_add_pPr().append(sh)
    doc.add_paragraph(style="IOT Body").paragraph_format.space_after = Pt(0)


def render_chart(spec):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "Times New Roman", "font.size": 11, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.formatter.use_locale": False})
    path = resolve(spec["csv"])
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    xs = [r[spec["x"]].replace("–", "-").replace("—", "-") for r in rows]
    ys = [c.strip() for c in spec["y"].split(",")]

    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    fig, ax = plt.subplots(figsize=(float(spec.get("w", 14)) / 2.54, float(spec.get("h", 7)) / 2.54), dpi=200)
    kind = spec.get("type", "bar")
    xnum = [num(x) for x in xs]
    if kind in ("bar", "hbar"):
        n = len(ys)
        width = 0.8 / n
        for k, c in enumerate(ys):
            vals = [num(r[c]) or 0 for r in rows]
            pos = [i + (k - (n - 1) / 2) * width for i in range(len(xs))]
            if kind == "bar":
                bars = ax.bar(pos, vals, width, color=PAL[k % 6], label=c)
            else:
                bars = ax.barh(pos, vals, width, color=PAL[k % 6], label=c)
            if len(xs) * n <= 24:
                ax.bar_label(bars, labels=[f"{v:g}".replace(".", ",") for v in vals], fontsize=9, padding=2)
        if kind == "bar":
            ax.set_xticks(range(len(xs)), xs, rotation=0 if len(xs) < 10 else 45, ha="center" if len(xs) < 10 else "right")
        else:
            ax.set_yticks(range(len(xs)), xs)
            ax.invert_yaxis()
    else:
        for k, c in enumerate(ys):
            pts = [(a, num(r[c])) for a, r in zip(xnum if None not in xnum else range(len(xs)), rows) if num(r[c]) is not None]
            if kind == "scatter":
                ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=12, color=PAL[k % 6], label=c)
            else:
                ax.plot([p[0] for p in pts], [p[1] for p in pts], color=PAL[k % 6], lw=1.6, label=c)
        if None in xnum:
            ax.set_xticks(range(len(xs)), xs, rotation=45, ha="right")
    ax.set_xlabel(spec.get("xlabel", ""))
    ax.set_ylabel(spec.get("ylabel", ""))
    ax.grid(axis="y", color="#DDE1E6", lw=0.6)
    ax.ticklabel_format(axis="y", style="plain", useOffset=False) if kind != "hbar" else None
    if len(ys) > 1:
        names = [x.strip() for x in spec.get("legend", "").split(",")] if spec.get("legend") else ys
        for h, nm in zip(ax.get_legend_handles_labels()[0], names):
            h.set_label(nm)
        ax.legend(frameon=False, fontsize=10, loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=len(ys))
    fig.tight_layout()
    os.makedirs(CHART_DIR, exist_ok=True)
    out = os.path.join(CHART_DIR, (spec.get("id") or f"chart-{abs(hash(str(spec)))}").replace(":", "-") + ".png")
    fig.savefig(out)
    plt.close(fig)
    return out


def references(doc):
    doc.add_paragraph("TÀI LIỆU THAM KHẢO", style="Heading 1")
    for i, r in enumerate(REFS, 1):
        p = doc.add_paragraph(style="IOT Body")
        p.paragraph_format.first_line_indent = Cm(0)
        p.add_run(f"[{i}] {r}")


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def toc(doc):
    page_break(doc)
    p = doc.add_paragraph(style="IOT Body")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run("MỤC LỤC")
    r.bold = True
    r.font.size = Pt(16)
    p = doc.add_paragraph()
    for kind, txt in (("begin", None), (None, 'TOC \\o "1-2" \\h \\z \\u'), ("separate", None),
                      (None, "Mở bằng Word và cập nhật mục lục (F9)."), ("end", None)):
        r = p.add_run()
        if kind:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), kind)
            r._r.append(fc)
        elif txt.startswith("TOC"):
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = txt
            r._r.append(it)
        else:
            r.text = txt
    page_break(doc)


# ---------------------------------------------------------------- cover
def cover(doc):
    body = doc.element.body
    els = list(body)
    sect_src = copy.deepcopy(els[SECT_SRC].find(".//" + qn("w:sectPr")))
    for el in els[COVER_LAST + 1:]:
        if el.tag != qn("w:sectPr"):
            body.remove(el)
    final = body.find(qn("w:sectPr"))
    body.replace(final, sect_src)
    ps = doc.paragraphs
    for i, p in enumerate(ps):
        if p.text.startswith("Bài làm:"):
            # dòng "Bài làm" không dùng; bỏ nó và 2 dòng trống sau để bìa còn chỗ cho 4 thành viên
            for q in [p] + [x for x in ps[i + 1:i + 3] if not x.text.strip()]:
                q._p.getparent().remove(q._p)
            break
    t = doc.tables[0]
    rows = [("Lớp:", "D23CTPM01"), ("Giảng viên hướng dẫn:", TEACHER)] + [("Nhóm sinh viên:" if i == 0 else "", f"{n} - {m}")
                                                    for i, (n, m) in enumerate(MEMBERS)]
    proto = copy.deepcopy(t.rows[1]._tr)
    for r in list(t.rows):
        t._tbl.remove(r._tr)
    for _ in rows:
        t._tbl.append(copy.deepcopy(proto))
    for i, (a, b) in enumerate(rows):
        for j, v in enumerate((a, b)):
            para = t.cell(i, j).paragraphs[0]
            for k, r in enumerate(para.runs):
                r.text = v if k == 0 else ""
            if not para.runs:
                para.add_run(v)
            t.cell(i, j).width = Cm(5.4 if j == 0 else 9.2)
    grid = t._tbl.find(qn("w:tblGrid"))
    for gc, wcm in zip(grid.findall(qn("w:gridCol")), (5.4, 9.2)):
        gc.set(qn("w:w"), str(int(wcm * 567)))
    tblPr = t._tbl.tblPr
    tblPr.find(qn("w:tblW")).set(qn("w:w"), str(int(14.6 * 567)))
    tblPr.find(qn("w:tblInd")).set(qn("w:w"), str(int(1.0 * 567)))


# ---------------------------------------------------------------- main
def build():
    files = sorted(glob.glob(os.path.join(os.environ.get("BC_CHUONG", os.path.join(HERE, "chuong")), "*.md")))
    chapters = [(f, parse(open(f, encoding="utf-8").read())) for f in files]
    labels = number_all(chapters)
    doc = Document(TEMPLATE)
    cover(doc)
    toc(doc)
    bullet_numpr = None
    tpl = Document(TEMPLATE)
    for p in tpl.paragraphs:
        if p.style.name == "IOT List" and p._p.pPr is not None and p._p.pPr.find(qn("w:numPr")) is not None:
            bullet_numpr = copy.deepcopy(p._p.pPr.find(qn("w:numPr")))
            break
    ch_no = app = 0
    first = True
    for f, blocks in chapters:
        key, h2, h3, fig, tab = "?", 0, 0, 0, 0
        for b in blocks:
            k = b[0]
            if k == "h":
                lvl, title = b[1], b[2]
                if lvl == 1:
                    if not first:
                        page_break(doc)
                    first = False
                    h2 = h3 = fig = tab = 0
                    if title.lower().startswith("phụ lục"):
                        if app == 0:
                            references(doc)
                            page_break(doc)
                        app += 1
                        key = chr(64 + app)
                        t = re.sub(r"^phụ lục\s+[A-Z]\.?\s*", "", title, flags=re.I)
                        text = f"PHỤ LỤC {key}. {t.upper()}"
                    else:
                        ch_no += 1
                        key = str(ch_no)
                        text = f"CHƯƠNG {key}. {title.upper()}"
                    doc.add_paragraph(text, style="Heading 1")
                elif lvl == 2:
                    h2 += 1
                    h3 = 0
                    doc.add_paragraph(f"{key}.{h2}. {title}", style="Heading 2")
                else:
                    h3 += 1
                    doc.add_paragraph(f"{key}.{h2}.{h3}. {title}", style="Heading 3")
            elif k == "p":
                runs(doc.add_paragraph(style="IOT Body"), b[1], labels)
            elif k in ("ul", "ol"):
                for n, it in enumerate(b[1], 1):
                    p = doc.add_paragraph(style="IOT List")
                    if k == "ul" and bullet_numpr is not None:
                        p._p.get_or_add_pPr().append(copy.deepcopy(bullet_numpr))
                        runs(p, it, labels)
                    else:
                        p.paragraph_format.left_indent = Cm(1.0)
                        p.paragraph_format.first_line_indent = Cm(-0.6)
                        runs(p, (f"{n}. " if k == "ol" else "• ") + it, labels)
            elif k == "img":
                fig += 1
                add_picture(doc, b[2], b[3].get("w", 15))
                caption(doc, "IOT Hinh", f"Hình {key}.{fig}. {b[1]}", labels)
            elif k == "img2":
                fig += 1
                paths = b[2].split("|")
                w = float(b[3].get("w", 7.5))
                t = doc.add_table(rows=1, cols=len(paths))
                t.alignment = WD_TABLE_ALIGNMENT.CENTER
                for j, pth in enumerate(paths):
                    cell = t.cell(0, j)
                    cell.paragraphs[0].style = doc.styles["IOT Figure"]
                    full = resolve(pth.strip())
                    if os.path.exists(full):
                        cell.paragraphs[0].add_run().add_picture(embeddable(full), width=Cm(min(w, 7.9)))
                    else:
                        cell.paragraphs[0].add_run(f"[THIẾU HÌNH: {pth}]")
                        print("  missing image:", pth)
                caption(doc, "IOT Hinh", f"Hình {key}.{fig}. {b[1]}", labels)
            elif k == "chart":
                fig += 1
                spec = chart_spec(b[1])
                try:
                    png = render_chart(spec)
                    add_picture(doc, png, spec.get("w", 14))
                except Exception as e:  # noqa: BLE001  (lỗi phải hiện ra, không nuốt)
                    print(f"  CHART FAIL in {os.path.basename(f)}: {spec.get('id')}: {e}")
                    doc.add_paragraph(f"[LỖI BIỂU ĐỒ: {spec.get('csv')}: {e}]", style="IOT Figure")
                caption(doc, "IOT Hinh", f"Hình {key}.{fig}. {spec.get('caption', '')}", labels)
            elif k == "table":
                if b[1]:
                    tab += 1
                    caption(doc, "IOT Bang", f"Bảng {key}.{tab}. {b[1]}", labels).paragraph_format.keep_with_next = True
                add_table(doc, b[3], labels)
            elif k == "code":
                add_code(doc, b[1])
    if app == 0:
        page_break(doc)
        references(doc)
    doc.save(OUT)
    print("chapters:", len(chapters), "labels:", len(labels), "->", OUT)
    if MISSING:
        print("unresolved refs:", sorted(set(MISSING)))


def word_pass():
    import win32com.client
    w = win32com.client.DispatchEx("Word.Application")
    w.Visible = False
    try:
        d = w.Documents.Open(OUT)
        d.TablesOfContents(1).Update()
        d.Fields.Update()
        pages = d.ComputeStatistics(2)
        app_page = None
        for para in d.Paragraphs:
            if para.OutlineLevel == 1 and para.Range.Text.startswith("PHỤ LỤC A."):
                app_page = para.Range.Information(3)
                break
        print("content pages (before appendix):", (app_page - 1) if app_page else pages)
        d.Save()
        d.ExportAsFixedFormat(OUT[:-5] + ".pdf", 17)
        d.Close(False)
        print("pages:", pages)
    finally:
        w.Quit()


if __name__ == "__main__":
    build()
    if "--word" in sys.argv:
        word_pass()
