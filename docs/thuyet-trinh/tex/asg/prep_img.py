"""Copy part photos into tex/asg/img/ as RGBA PNG with transparent background.

    py -3.13 prep_img.py

Sources (read only): assignment/_build/img/parts/*.png (white background -> flood-filled from the border),
img/anh-camera-s3.jpg (wood background -> masked to the board outline).
"""
import os
from collections import deque

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TT = os.path.normpath(os.path.join(HERE, "..", ".."))
PARTS = r"D:\Coding\IOT-CV\assignment\_build\img\parts"
OUT = os.path.join(HERE, "img")
WHITE_TOL = 28  # how far from pure white a border pixel may be and still count as background


def knock_out_white(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        if a < 20 or min(r, g, b) >= 255 - WHITE_TOL:
            px[x, y] = (255, 255, 255, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    im.save(dst)


def camera(dst):
    im = Image.open(os.path.join(TT, "img", "anh-camera-s3.jpg")).convert("RGBA")
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((76, 96, 1392, 836), radius=10, fill=255)   # main board
    d.rectangle((1380, 218, 1557, 698), fill=255)                  # PCB antenna tab
    im.putalpha(mask)
    im.crop((70, 90, 1562, 839)).save(dst)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for n in ("fc", "esc", "gps_m10", "motor", "tfmini", "esp32_devkitc", "fsi6x"):
        knock_out_white(os.path.join(PARTS, n + ".png"), os.path.join(OUT, n + ".png"))
    Image.open(os.path.join(PARTS, "ia6b.png")).convert("RGBA").save(os.path.join(OUT, "ia6b.png"))  # line drawing: keep its white body
    camera(os.path.join(OUT, "cam_s3.png"))
    print("ok")
