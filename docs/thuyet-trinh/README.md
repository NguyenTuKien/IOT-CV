# Slide thuyết trình môn IoT: drone S500 + AI

| File | Là gì |
|---|---|
| `IOTCV_BaoCao_IoT.pptx` | deck 39 slide, theme PTIT, có hiệu ứng và ghi chú người nói |
| `IOTCV_BaoCao_IoT.pdf` | bản PDF nhúng font Be Vietnam Pro |
| `IOTCV_HocVaThuyetTrinh.html` | trang học và tập thuyết trình, mở thẳng trong trình duyệt |

Bìa chừa trống dòng "Sinh viên thực hiện" và "Giảng viên hướng dẫn": sửa trong `build/part_a.py` (hàm slide bìa) rồi dựng lại,
hoặc gõ thẳng trong PowerPoint.

## Nguồn

- `facts/*.md`, `facts/data/*.csv`: số liệu trích từ repo IOT-CV, XLA, log bay, có đường dẫn nguồn cho từng số.
- `DAN-Y.md` (dàn ý 35 slide gốc; 4 slide thêm S04b, S07b, S18b, S31b nằm trong `OUTLINE.md` và `build/part_x.py`) → `OUTLINE.md` (chữ trên slide, hình, ghi chú người nói, phần "Để học").
- `img/`: ảnh đã cắt nhãn (`MANIFEST.md`), ảnh drone thật `img/user-*`, `img/real/` (`MANIFEST-2.md`: lịch sử bay thật, sơ đồ hướng dẫn lắp ráp, Mission Planner ngoài bãi), `img/asg/` sơ đồ báo cáo môn vẽ lại (`tex/asg/mkasg.py`), `img/tikz/` hình TikZ dựng từ `tex/fig/F<nn>.tex`.

## Dựng lại

```powershell
cd docs\thuyet-trinh\tex;   py -3.13 mkfig.py            # hình TikZ (xelatex + pdftocairo của MiKTeX)
cd ..\build;                py -3.13 build.py             # ra ..\IOTCV_BaoCao_IoT.pptx
powershell -File export.ps1 -Pptx ..\IOTCV_BaoCao_IoT.pptx -OutDir render -Width 1600   # ảnh slide
py -3.13 hoc\build_hoc.py                                  # trang HTML, dùng ảnh trong render\
```

PDF: mở pptx trong PowerPoint, Save As PDF (hoặc COM `SaveAs(path, 32)`).

Bộ dựng lấy từ bộ slide DLP (`D:\NCKH\DevOps_Learning_Platform\baocao\slide\build`): `lib.py` (chữ, hình, bảng booktabs),
`chrome.py` (khung PTIT), `motion.py` (Morph, hiệu ứng tự chạy), `kit.py` (thẻ, ô số, `img`/`fig`), `charts.py` (biểu đồ native),
`part_a..d.py` (nội dung S01–S09, S10–S18, S19–S29, S30–S35).
