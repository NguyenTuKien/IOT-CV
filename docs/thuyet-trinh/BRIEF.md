# BRIEF chung: slide thuyết trình toàn dự án IOT-CV (môn IoT)

Đọc hết file này trước khi làm. Mọi agent dùng chung.

## Sản phẩm
- `docs/thuyet-trinh/IOTCV_BaoCao_IoT.pptx` (≤ 36 slide, 16:9, 1440×810 pt), PDF nhúng font, `IOTCV_HocVaThuyetTrinh.html`.
- Theme đỏ PTIT, dựng bằng bản sao bộ công cụ `D:\NCKH\DevOps_Learning_Platform\baocao\slide\build` (lib/chrome/motion/kit/part_*, hoc/).
  Mẫu nhìn: `D:\Coding\IOT-CV\DLP_BaoCao_NCKH_2026.pptx`. Font Be Vietnam Pro.
- Trọng tâm là DRONE (phần cứng, firmware, cấu hình, MAVLink, web GCS, SITL, bay thật). AI 6 slide, mức tổng quan (không sâu như deck XLA).

## Luật nội dung (cứng)
- Bản FINAL: chỉ trình bày trạng thái cuối cùng. KHÔNG nhắc phiên bản (v1, v2, "bản trước", tên bundle có số), KHÔNG kể
  thử sai, sự cố, tai nạn, quyết định bị bỏ, thảo luận lan man.
- KHÔNG nhắc ESP32-CAM, OV2640, XIAO. Camera là ESP32-S3 N16R8 + OV3660.
- Không slide phân công, không slide "kết luận / hướng phát triển".
- Mọi con số phải có nguồn (đường dẫn file, dòng nếu được). Không bịa. Không có nguồn thì ghi `CHƯA CÓ NGUỒN`.
- Tiêu đề slide nêu kết quả cụ thể.
- Văn viết theo skill human-writing + humanizer: không em-dash (—) hay en-dash (–) trong câu văn, không "không chỉ… mà còn",
  "đóng vai trò", "Tóm lại", "toàn diện", "vượt trội", "mạnh mẽ", "liền mạch", "tối ưu hoá trải nghiệm", không bộ ba gượng ép,
  không câu kết lặp ý. Câu cụ thể, có số, có tên.
- Bảng kiểu booktabs (kẻ ngang), không tô nền header.

## Luật máy
- Sub-agent ĐỌC là chỉ đọc repo; chỉ ghi vào file được giao trong `docs/thuyet-trinh/`.
- Không commit, không push. Không cài gì lên ổ C (cache/toolchain ở `D:\DevCache`).
- Python: `py -3.13` (Windows). Repo dùng `uv` (`uv run python ...`). rg: `D:\IOT_Tools\apps\ripgrep\rg.exe`.
- Lệnh mạng/gh từ Bash bị sandbox chặn; dùng PowerShell.
- File gitignore (logs/, models/, picture/, tmp/, exported_logs/, .env…) VẪN phải đọc: chúng có trên đĩa.
- An toàn: không chạm FC/ESC/motor thật, không mở cổng COM.
