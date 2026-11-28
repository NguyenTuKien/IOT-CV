# Brainstorm 26/11/2026: slide thuyết trình toàn dự án drone + AI (môn IoT)

## Yêu cầu (người dùng duyệt)
- Môn IoT, bìa PTIT, chừa trống tên SV/GV (người dùng tự điền).
- Tối đa 40 slide, càng gọn càng tốt; trọng tâm là drone; AI gọn (4 slide), không sâu như deck XLA.
- Theme đỏ PTIT của `DLP_BaoCao_NCKH_2026.pptx`; dựng bằng bộ công cụ `D:\NCKH\DevOps_Learning_Platform\baocao\slide\build` (lib/chrome/motion/kit/part_*).
- Kèm ghi chú người nói + file HTML học (mẫu `DLP_HocVaThuyetTrinh.html`, bộ `build/hoc/`).
- Đầu ra: `docs/thuyet-trinh/` (pptx, pdf nhúng font, html).
- Bản final: không nhắc phiên bản cũ, camera cũ, lịch sử thử sai, thảo luận lan man; không slide phân công/kết luận "việc tiếp theo".
- Bắt buộc qua `t1k-human-writing` + `humanizer`.

## Dàn ý (~32–36 slide)
Bìa + nội dung · 01 Bài toán · 02 Linh kiện · 03 Lắp ráp + firmware · 04 Cấu hình + hiệu chỉnh · 05 MAVLink + mạng ·
06 Web GCS · 07 SITL · 08 AI trên camera · 09 Thực nghiệm + kết quả.

## Cách làm
1. Fan-out đọc (Opus, chỉ đọc) → `docs/thuyet-trinh/facts/*.md` có dẫn nguồn.
2. Gom `OUTLINE.md` → viết nội dung + notes qua human-writing.
3. Dựng hình (TikZ xelatex→PNG, biểu đồ native, ảnh thật, ảnh chụp web headless) + `part_*.py` song song, file riêng.
4. Render COM, soát từng slide, grep từ cấm, xuất PDF, dựng HTML.

## Đo thành công
≤ 40 slide; render soát hết; grep `OV2640|ESP32-CAM|v1|v2|bản cũ|—` sạch; mọi số có nguồn trong facts; HTML mở offline.
