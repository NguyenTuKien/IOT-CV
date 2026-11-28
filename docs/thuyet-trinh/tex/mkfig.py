"""Compile every tex/fig/<name>.tex (a tikzpicture body only) to img/tikz/<name>.png at 300 dpi, transparent.

    py -3.13 mkfig.py            # all figures
    py -3.13 mkfig.py F04 F13    # only these (file stem prefix match)

Colours: PTIT red cDo, blue cXanh, green cLuc, amber cVang, navy cNavy, ink cMuc, grey cXam, light tints *T.
Font Be Vietnam Pro (same as the deck). Exit code 1 on the first LaTeX error, with the log tail printed.
"""
import glob
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "fig")
BUILD = os.path.join(HERE, "_build")
OUT = os.path.join(HERE, "..", "img", "tikz")

PRE = r"""\documentclass[12pt,border=6pt]{standalone}
\usepackage{fontspec}
\setmainfont{BeVietnamPro}[Path=D:/IOT_Tools/downloads/fonts/,Extension=.ttf,UprightFont=*-Regular,BoldFont=*-Bold]
\usepackage{amsmath}
\usepackage{unicode-math}\setmathfont{Cambria Math}
\usepackage{xcolor}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows.meta,shapes.geometric,shapes.misc,calc,fit,backgrounds,decorations.pathreplacing,shadows,3d,perspective}
\usepackage{tikz-3dplot}
\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\usepgfplotslibrary{groupplots,fillbetween}
\definecolor{cDo}{HTML}{BB2025}\definecolor{cDoD}{HTML}{8E1418}\definecolor{cDoT}{HTML}{FCEBEC}
\definecolor{cXanh}{HTML}{326CE5}\definecolor{cXanhT}{HTML}{EAF0FC}
\definecolor{cLuc}{HTML}{15803D}\definecolor{cLucT}{HTML}{E6F4EA}
\definecolor{cVang}{HTML}{B45309}\definecolor{cVangT}{HTML}{FDF2E1}
\definecolor{cNavy}{HTML}{1E293B}\definecolor{cMuc}{HTML}{1F2937}\definecolor{cXam}{HTML}{4B5563}
\definecolor{cXamT}{HTML}{F3F4F6}\definecolor{cVien}{HTML}{DDE1E6}\definecolor{cTim}{HTML}{6D28D9}\definecolor{cTimT}{HTML}{F1EBFD}
\pgfplotsset{slide/.style={tick label style={font=\small}, label style={font=\small}, scaled ticks=false,
  /pgf/number format/fixed, /pgf/number format/use comma, /pgf/number format/1000 sep={\,},
  legend style={font=\small,draw=none,fill=none}, axis line style={cXam}, major tick style={cXam},
  grid style={cVien}}}
\pgfkeys{/pgf/number format/assume math mode=true}
\begin{document}
"""


def build(name):
    src = open(os.path.join(FIG, name + ".tex"), encoding="utf-8").read()
    tex = os.path.join(BUILD, name + ".tex")
    with open(tex, "w", encoding="utf-8") as f:
        f.write(PRE + src + "\n\\end{document}\n")
    r = subprocess.run(["xelatex", "-interaction=nonstopmode", "-halt-on-error", name + ".tex"], cwd=BUILD,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        print(f"FAIL {name}\n" + r.stdout[-3000:])
        return False
    subprocess.run(["pdftocairo", "-png", "-r", "300", "-singlefile", "-transp", name + ".pdf",
                    os.path.join(OUT, name)], cwd=BUILD, check=True)
    print("ok", name)
    return True


def main():
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    names = sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(FIG, "*.tex")))
    if len(sys.argv) > 1:
        names = [n for n in names if any(n.startswith(a) for a in sys.argv[1:])]
    if not names:
        sys.exit("no figure matched")
    bad = [n for n in names if not build(n)]
    if bad:
        sys.exit(f"failed: {bad}")


if __name__ == "__main__":
    main()
