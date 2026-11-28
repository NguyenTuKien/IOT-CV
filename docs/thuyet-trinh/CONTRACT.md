# Hợp đồng chung cho các agent dựng slide (đọc hết trước khi code)

Gốc: `D:\Coding\IOT-CV\docs\thuyet-trinh\` (gọi tắt `TT\`). Đọc thêm `TT\BRIEF.md` (luật cứng) và `TT\OUTLINE.md` (nội dung).

## Phân file (mỗi file chỉ một agent ghi)
| Agent | Ghi | Không đụng |
|---|---|---|
| TikZ-1 | `TT\tex\fig\F01,F03,F04,F06,F07,F09,F10,F15.tex` | mọi file khác |
| TikZ-2 | `TT\tex\fig\F16,F17,F18,F19,F22,F24,F26,F28,F30,F33,F44.tex` | mọi file khác |
| Icon | `TT\build\assets\icons\` (thêm file mới, không xoá/sửa file cũ), `TT\build\assets\icons\NEW.md` | mọi file khác |
| Part A | `TT\build\part_a.py` (S01 đến S09) | lib/chrome/kit/charts/motion, part khác |
| Part B | `TT\build\part_b.py` (S10 đến S18) | như trên |
| Part C | `TT\build\part_c.py` (S19 đến S29) | như trên |
| Part D | `TT\build\part_d.py` (S30 đến S35) | như trên |
`lib.py`, `chrome.py`, `kit.py`, `charts.py`, `motion.py`, `build.py` là của phiên chính: cần thêm helper thì viết trong part của mình.

## TikZ
- File `tex\fig\F<nn>.tex` chỉ chứa thân `\begin{tikzpicture}…\end{tikzpicture}` (có thể kèm `\tdplotsetmaincoords` trước).
  Preamble, font Be Vietnam Pro, màu (`cDo cDoD cDoT cXanh cXanhT cLuc cLucT cVang cVangT cNavy cMuc cXam cXamT cVien cTim cTimT`),
  thư viện (positioning, arrows.meta, shapes, calc, fit, backgrounds, 3d, perspective, tikz-3dplot, pgfplots 1.18 + style `slide`) có sẵn trong `tex\mkfig.py`.
- Dựng: `cd TT\tex; py -3.13 mkfig.py F03` → `TT\img\tikz\F03.png` (300 dpi, nền trong suốt). Mở PNG bằng Read để soát.
- Khớp tỉ lệ khung mà OUTLINE dành cho hình (ví dụ 9 × 6 in → tỉ lệ 3:2). Chữ trong hình đọc được khi hình in ra cỡ đó:
  cỡ chữ tối thiểu tương đương 14 pt trên slide. Đọc CSV bằng `\addplot table[col sep=comma]{D:/Coding/IOT-CV/docs/thuyet-trinh/facts/data/<file>.csv}`.
- Nhiều màu, có bóng/gradient nhẹ, 3D thật (tikz-3dplot / pgfplots `\addplot3`) cho hình ghi 3D.

## Part (python-pptx)
- File `build\part_X.py` có `def build(d):` gọi lần lượt các hàm slide theo thứ tự OUTLINE. Mẫu cách viết: `D:\NCKH\DevOps_Learning_Platform\baocao\slide\build\part_a.py`
  (đọc để học phong cách; KHÔNG chép câu chữ, câu của mẫu có em-dash).
- API: `chrome.Deck`: `d.title_frame()`, `d.content(title, kicker)` → `(sl, tl)`.
  `lib`: `text, text2, box, pic, icon, disc, arrow, pill, table, group, notes` + màu `RED RED_D RED_T INK GRAY MUTE LINE CARD WHITE K8S K8S_T GREEN GREEN_T AMBER AMBER_T NAVY`, `CX0=1.0 CX1=18.9`.
  `kit`: `card, node, stat, heading, mark, img(sl, "web-bay.png", x, y, w, h), fig(sl, "F03", x, y, w, h)` (giữ tỉ lệ, căn giữa trong hộp; thiếu file thì vẽ ô đỏ "THIẾU HÌNH", không crash), `DATA` (thư mục CSV).
  `charts`: `bar, line, doughnut, csv_cols, vn0 vn1 vn2 vn3`.
  `motion`: `tl.add(shapes, eff, dur, stagger=…)` với eff `fade rise zoom float wipe-l wipe-r wipe-u wipe-d`.
- Icon: `icon(sl, "b:python", …)` (logo hãng, `_w` trắng, `_k` đen) hoặc `icon(sl, "i:cpu_r", …)` (lucide, hậu tố `_r` đỏ, `_w` trắng, `_k` đen, `_g` xám, `_gr` xanh lá, `_am` hổ phách, `_b` xanh). Thiếu file thì vẽ chấm xám (không crash) và in `[icon missing]`.
  Icon mới do agent Icon thêm (danh sách cuối file này). Tên lucide có sẵn: xem `build\assets\icons\i_*`.
- Ảnh: `kit.img(sl, "<file trong TT\img>", …)`; danh sách ở `TT\img\MANIFEST.md` (agent ảnh đang ghi). Ảnh nguồn gốc ngoài `TT\img` dùng đường dẫn tuyệt đối được phép tạm thời.
- Mọi chữ trên slide lấy từ OUTLINE. Tràn chỗ thì rút gọn câu, giữ số. Ghi chú người nói: `notes(sl, "<Ghi chú người nói của OUTLINE>")`.
- Không em-dash/en-dash trong chữ hiển thị và ghi chú; số kiểu Việt (dấu phẩy thập phân, cách nghìn bằng khoảng trắng).
- Tự kiểm: viết runner riêng trong scratch của mình, ví dụ
  `import sys; sys.path.insert(0, r"D:\Coding\IOT-CV\docs\thuyet-trinh\build"); from chrome import Deck; import part_b; d=Deck(); part_b.build(d); d.save(r"<scratch>\b.pptx")`
  rồi `powershell -File TT\build\export.ps1 -Pptx <scratch>\b.pptx -OutDir <scratch>\b -Width 1600` và mở từng PNG soát:
  chữ không tràn khung, không đè nhau, cân đối, nhìn đẹp như deck DLP. Lỗi COM của PowerPoint (bận) thì đợi vài giây chạy lại.
  Hình TikZ chưa có lúc đó là bình thường (ô đỏ giữ chỗ); khi có rồi chạy lại để soát bố cục thật.

## Icon cần thêm (agent Icon ghi tên thật vào NEW.md)
Thương hiệu (`b_<ten>.png`, `_w`, `_k`): python, fastapi, vite, espressif, platformio, onnx, pytorch, opencv, nvidia, windows,
playwright, numpy, pydantic, uv, arduino, leaflet, openstreetmap, wireguard (không cần nếu không có), googlechrome, visualstudiocode, latex.
Lucide (`i_<ten>_<mau>.png`, đủ màu r w k g gr am b): plane, drone (nếu lucide có), radio, radio-tower, wifi, battery-full, battery-charging,
satellite, satellite-dish, map-pin, map, route, navigation, compass, camera, video, gauge, cpu, usb, cable, plug, zap, shield-check,
shield-alert, eye, scan-search, scan-face, keyboard, gamepad-2, monitor, laptop, smartphone, server, database, history, timer,
activity, thermometer, ruler, wrench, screwdriver, hammer, package, box, layers, git-branch, terminal, code-2, file-code,
settings, sliders-horizontal, target, crosshair, mountain, cloud-sun, sun, image, images, wand-2, sparkles, brain, bot, users,
user-search, rotate-3d, move-3d, anchor, home, flag, check-circle-2, x-circle, alert-triangle, info, clock, calendar, list-checks.
