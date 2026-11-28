"""Build the course-assignment figures (tex/asg/fig/<name>.tex = tikzpicture body) to img/asg/<name>.png.

    py -3.13 prep_img.py          # once: transparent part photos into tex/asg/img/
    py -3.13 mkasg.py             # all figures
    py -3.13 mkasg.py f5_daydien  # only these (stem prefix match)
    py -3.13 mkasg.py f5_daydien --zoom 0.5 0.5 0.25 0.25   # also write a 600 dpi crop (fractions x y w h) to _build/

xelatex + pdftocairo -r 300 -transp. Font Be Vietnam Pro, PTIT palette (same names as tex/mkfig.py) plus wire colours.
Figures are drawn at their final slide size in mm, so 14 pt in the source is 14 pt on the slide.
"""
import glob
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "fig")
BUILD = os.path.join(HERE, "_build")
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "img", "asg"))
IMG = os.path.join(HERE, "img").replace("\\", "/")

PRE = r"""\documentclass[14pt,border=0pt]{standalone}
\usepackage{fontspec}
\setmainfont{BeVietnamPro}[Path=D:/IOT_Tools/downloads/fonts/,Extension=.ttf,UprightFont=*-Regular,BoldFont=*-Bold,
  FontFace={sb}{n}{*-SemiBold},FontFace={m}{n}{*-Medium}]
\newcommand{\sbf}{\fontseries{sb}\selectfont}
\usepackage{graphicx}\graphicspath{{%IMG%/}}
\usepackage{xcolor}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows.meta,shapes.geometric,shapes.misc,calc,fit,backgrounds,shadows,shadows.blur,decorations.pathreplacing}
\definecolor{cDo}{HTML}{BB2025}\definecolor{cDoD}{HTML}{8E1418}\definecolor{cDoT}{HTML}{FCEBEC}
\definecolor{cXanh}{HTML}{326CE5}\definecolor{cXanhT}{HTML}{EAF0FC}
\definecolor{cLuc}{HTML}{15803D}\definecolor{cLucT}{HTML}{E6F4EA}
\definecolor{cVang}{HTML}{B45309}\definecolor{cVangT}{HTML}{FDF2E1}
\definecolor{cNavy}{HTML}{1E293B}\definecolor{cMuc}{HTML}{1F2937}\definecolor{cXam}{HTML}{4B5563}
\definecolor{cXamT}{HTML}{F3F4F6}\definecolor{cVien}{HTML}{DDE1E6}\definecolor{cTim}{HTML}{6D28D9}\definecolor{cTimT}{HTML}{F1EBFD}
\definecolor{cTeal}{HTML}{0F766E}\definecolor{cTealT}{HTML}{E0F2F1}
% wire colours (legend of f5_daydien)
\definecolor{wBat}{HTML}{D7261E}\definecolor{w5}{HTML}{D6337F}\definecolor{w45}{HTML}{EA7317}
\definecolor{wGnd}{HTML}{111111}\definecolor{wTx}{HTML}{E0A100}\definecolor{wRx}{HTML}{16A34A}
\definecolor{wI2c}{HTML}{2563EB}\definecolor{wIbus}{HTML}{7C3AED}\definecolor{wPha}{HTML}{6B7280}\definecolor{wSig}{HTML}{0E7490}
\begin{document}
"""


def white(src, dst):
    """Preview on a white slide background (the deck background), for checking only."""
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(dst)


def build(name, zoom=None):
    src = open(os.path.join(FIG, name + ".tex"), encoding="utf-8").read()
    with open(os.path.join(BUILD, name + ".tex"), "w", encoding="utf-8") as f:
        f.write(PRE.replace("%IMG%", IMG) + src + "\n" + r"\end{document}" + "\n")
    r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", name + ".tex"], cwd=BUILD,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        print(f"FAIL {name}\n" + r.stdout[-3000:])
        return False
    subprocess.run(["pdftocairo", "-png", "-r", "300", "-singlefile", "-transp", name + ".pdf",
                    os.path.join(OUT, name)], cwd=BUILD, check=True)
    white(os.path.join(OUT, name + ".png"), os.path.join(BUILD, name + "-white.png"))
    info = subprocess.run(["pdfinfo", name + ".pdf"], cwd=BUILD, capture_output=True, text=True).stdout
    size = [l for l in info.splitlines() if l.startswith("Page size")]
    if size:
        w, h = (float(v) for v in size[0].split()[2:5:2])
        print(f"ok {name}  {w / 72:.2f} x {h / 72:.2f} in")
        if zoom:
            fx, fy, fw, fh = zoom
            dpi = 600
            X, Y, W, H = (int(v * dpi / 72) for v in (fx * w, fy * h, fw * w, fh * h))
            subprocess.run(["pdftocairo", "-png", "-r", str(dpi), "-singlefile", "-transp", "-x", str(X), "-y", str(Y),
                            "-W", str(W), "-H", str(H), name + ".pdf", name + "-zoom"], cwd=BUILD, check=True)
            white(os.path.join(BUILD, name + "-zoom.png"), os.path.join(BUILD, name + "-zoom.png"))
            print("zoom ->", os.path.join(BUILD, name + "-zoom.png"))
    return True


if __name__ == "__main__":
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    zoom = None
    if "--zoom" in args:
        i = args.index("--zoom")
        zoom = [float(v) for v in args[i + 1:i + 5]]
        args = args[:i] + args[i + 5:]
    names = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(FIG, "*.tex")))
    if args:
        names = [n for n in names if any(n.startswith(a) for a in args)]
    ok = all(build(n, zoom) for n in names)
    sys.exit(0 if ok else 1)
