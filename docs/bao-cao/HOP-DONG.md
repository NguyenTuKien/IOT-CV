# Hợp đồng viết báo cáo Word (đọc hết trước khi viết)

Gốc: `D:\Coding\IOT-CV\docs\bao-cao\` (gọi tắt `BC\`). Bộ dựng `BC\build_docx.py` (phiên chính viết) đọc
`BC\chuong\*.md` theo thứ tự tên file và ra `BC\IOTCV_BaoCao_IoT.docx` trên khuôn bìa và style của
`assignment\B23DCCN600_Nguyễn Duy Nghĩa.docx`. **Tổng tối đa 100 trang A4** (bìa + mục lục chiếm khoảng 5).

## Chia file (mỗi file chỉ một agent ghi)

| Agent | File | Trang (gồm cả hình) |
|---|---|---|
| W1 | `chuong\01-tong-quan.md`, `chuong\02-phan-cung.md` | 8 + 15 |
| W2 | `chuong\03-firmware-phan-mem.md`, `chuong\04-cau-hinh-hieu-chinh.md`, `chuong\05-truyen-thong.md` | 8 + 8 + 8 |
| W3 | `chuong\06-tram-mat-dat.md`, `chuong\07-sitl-kiem-thu.md`, `chuong\08-ai.md` | 11 + 5 + 12 (AI có lý thuyết xử lý ảnh) |
| W4 | `chuong\09-thuc-nghiem.md`, `chuong\10-ket-luan.md`, `chuong\11-phu-luc-huong-dan.md` | 10 + 2 + 10 |
| SHOTS | `img\web\*.png`, `img\web\README.md` | |

Một trang A4 chữ trơn khoảng 420 chữ; hình rộng 15 cm chiếm khoảng nửa trang. Viết sát ngân sách trang.

## Cú pháp Markdown bộ dựng hiểu

- `# Tên chương` (bộ dựng tự thêm "CHƯƠNG n."; phụ lục viết `# Phụ lục A. Hướng dẫn sử dụng`), `## Tên mục`,
  `### Tên tiểu mục`. **Không tự đánh số** mục, bộ dựng đánh 1.1, 1.1.1.
- Đoạn văn: các dòng liền nhau là một đoạn, dòng trống tách đoạn. `**đậm**`, `*nghiêng*`, `` `mã` ``.
- Danh sách: `- ý` (gạch đầu dòng), `1. ý` (đánh số). Không lồng quá 1 cấp.
- Hình: `![Chú thích hình](đường/dẫn.png){#fig:nhan w=15}`. Đường dẫn tương đối gốc repo `D:\Coding\IOT-CV\` hoặc tuyệt đối.
  `w` = rộng cm (mặc định 15, tối đa 16). Chú thích viết thành câu, không có chữ "Hình", bộ dựng thêm "Hình 2.3.".
- Hai hình cạnh nhau, một chú thích: `!![Chú thích chung](a.png|b.png){#fig:nhan w=7.5}`.
- Bảng: dòng `Bảng: Chú thích bảng {#tab:nhan}` rồi bảng pipe ngay dưới (dòng đầu là tiêu đề cột).
  Bảng kiểu booktabs: không tô nền tiêu đề. Tối đa 6 cột, chữ ngắn.
- Dẫn chiếu: `@fig:nhan`, `@tab:nhan` → bộ dựng đổi thành "Hình 2.3", "Bảng 4.1". Nhãn duy nhất toàn báo cáo, tiền tố
  theo chương (`fig:c2-noi-day`).
- Khối mã: ```` ``` ```` ... ```` ``` ```` (lệnh, đoạn tham số ngắn, tối đa 12 dòng).
- Biểu đồ từ CSV (bộ dựng vẽ bằng matplotlib theo màu PTIT):
  ```` ```chart ```` rồi các dòng `type: bar|hbar|line|scatter`, `csv: docs/thuyet-trinh/facts/data/<file>.csv`,
  `x: <cột>`, `y: <cột1>,<cột2>`, `xlabel: ...`, `ylabel: ...`, `caption: ...`, `id: fig:nhan`, `w: 14` rồi ```` ``` ````.
  Mở CSV xem tên cột thật trước khi viết.

## Nguồn sự thật (đọc trước, đừng hỏi lại)

`D:\Coding\IOT-CV\AGENTS.md`; `docs\thuyet-trinh\facts\01..06-*.md` + `facts\data\*.csv` (số liệu đã kiểm, có nguồn);
`docs\thuyet-trinh\OUTLINE.md` (lời nói + phần "Để học" giải thích từng chủ đề, số liệu đã chốt);
`docs\phan-cung-thuc-te.md`; `firmware\ardupilot\params\*.param`; `docs\so-tay\*.md` (sổ tay từng phase, nhiều chi tiết thao
tác); `plans\PROGRESS.md`; `frontend\src`, `backend\` (đọc code khi cần chi tiết tính năng). AI: `D:\XLA\results\v2\system\README.md`,
`D:\XLA\results\v2\iotcv\README.md`. Memory dự án: `C:\Users\Nghaiz\.claude\projects\d--Coding-IOT-CV\memory\*.md`.
Đọc cả file bị gitignore. Không cần đọc hết transcript phiên cũ: facts\ đã tổng hợp từ đó.

## Hình có sẵn (dùng nhiều, mỗi mục nên có hình hoặc bảng)

- Ảnh drone thật của nhóm: `docs\thuyet-trinh\img\user-drone-nghieng.jpg`, `user-drone-tren.jpg`, `user-drone-ban-lam-viec.jpg`
  (màn laptop đã làm mờ); Mission Planner ngoài bãi `docs\thuyet-trinh\img\real\mp-bay-that-ban-do.png`, `mp-bay-that-full.png`.
- Sơ đồ báo cáo môn vẽ lại (đã đúng phần cứng hiện tại): `docs\thuyet-trinh\img\asg\` (`README.md` mô tả): `f5_daydien`
  (nối dây đầy đủ, dùng ở chương 2), `f5_botri`, `f5_lienket`, `f5_logic`, `f5_mohinh`, `f5_level`.
- TikZ 2D/3D của slide: `docs\thuyet-trinh\img\tikz\F*.png` (bảng mô tả ở `OUTLINE.md` mục "Danh sách hình").
- Ảnh đã làm sạch: `docs\thuyet-trinh\img\MANIFEST.md` (linh kiện, web, AI, Mission Planner, SITL) và
  `docs\thuyet-trinh\img\MANIFEST-2.md` (`img\real\`: lịch sử bay thật `lsb-*`, sơ đồ hướng dẫn lắp ráp `hd-*`, ảnh hãng).
- Ảnh hãng: `assignment\_build\img\official\**` (trừ `aithinker\*`). Ảnh trang web mới: `docs\bao-cao\img\web\` (SHOTS
  chụp; tên `web-<đoạn đường dẫn đầu của route>.png`, trang gốc `/` là `web-bay.png`; ảnh chi tiết `web-<route>-<chi-tiet>.png`,
  danh sách thật ở `img\web\README.md`; chưa có thì cứ dẫn theo quy tắc tên, bộ dựng vẽ ô giữ chỗ).
- **Cấm** dùng: ảnh ESP32-CAM / AI-Thinker / OV2640 / XIAO, `frontend\screenshots\*` (giao diện cũ), ảnh slide `build\render\`.

## Luật viết (bắt buộc)

1. **Sản phẩm cuối cùng.** Không nhắc phiên bản cũ, bản dựng cũ, "lúc đầu… sau đó đổi", sự cố, tai nạn, thảo luận. Mô tả
   hệ thống như nó đang chạy. Không có ESP32-CAM/OV2640/XIAO, không có MQTT (không xây dựng), không "v1/v2".
2. **Mọi con số có nguồn** trong các file trên. Không bịa giá tiền, ngày, số đo. Không chắc thì bỏ.
3. **Giọng người viết** (thay cho skill humanizer + human-writing): ngôi "nhóm em"; câu dài ngắn xen nhau; nói cụ thể (tên
   tham số, số, cổng); **không em-dash/en-dash** (—, –); không mở bài rào đón, không câu kết lặp ý ("Tóm lại…", "Như vậy có thể
   thấy…"); không "không chỉ… mà còn", "đóng vai trò quan trọng", "then chốt", "toàn diện", "mạnh mẽ", "liền mạch", "tối ưu
   hoá trải nghiệm"; không xếp ba tính từ; không in đậm tràn lan. Số kiểu Việt: dấu phẩy thập phân, cách nghìn bằng khoảng trắng.
4. Mỗi chương mở bằng 1 đoạn ngắn nói chương này có gì, rồi vào việc. Giải thích đủ để thầy cô đọc hiểu vì sao làm vậy.
5. Không lộ mật khẩu Wi-Fi, token, toạ độ GPS nhà/bãi bay, email.
6. Chỉ ghi file của mình. Không commit, không sửa file khác, không mở cổng COM hay nối drone thật. Tải/cài gì thì để ổ D.
7. Xong thì tự soát: `rg "—|–|OV2640|ESP32-CAM|MQTT" <file>` phải ra 0; mọi đường dẫn hình tồn tại (trừ `img\web\`).
