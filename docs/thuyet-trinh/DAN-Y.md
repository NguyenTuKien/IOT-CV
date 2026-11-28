# Dàn ý chốt (35 slide) — SSOT cho OUTLINE.md và các agent dựng

Khung slide: 20 × 11,25 in. Vùng nội dung x 1,0 → 18,9 in, y 1,55 → 10,5 in (thanh đỏ tiêu đề 0 → 1,25 in, chân trang từ 10,66 in).
Không có slide chuyển phần; mỗi slide nội dung có pill "kicker" dạng `Phần N · <chủ đề>`.

| # | Phần | Slide (ý chính) |
|---|---|---|
| 1 | Mở đầu | Bìa: tên đề tài, môn IoT · PTIT, chừa trống tên SV/GV, logo công nghệ |
| 2 | Mở đầu | Nội dung trình bày (9 phần) + một hình sản phẩm |
| 3 | 1 Bài toán | Bài toán và mục tiêu: drone tuần tra tự hành, telemetry + video qua Wi-Fi, tránh vật cản, tìm người |
| 4 | 1 Bài toán | Kiến trúc tổng thể (TikZ 3D: drone, 2 ESP32, laptop trạm mặt đất, trình duyệt) |
| 5 | 1 Bài toán | Tiến trình thực hiện 17/08 → 26/11 (timeline mốc đạt được) |
| 6 | 2 Phần cứng | Linh kiện drone (thẻ + ảnh board + thông số) |
| 7 | 2 Phần cứng | Sơ đồ nối dây và chia cổng UART (TikZ 2D + bảng SERIAL1..6) |
| 8 | 2 Phần cứng | Hệ thống nguồn 4S → ESC / FC / UBEC (TikZ cây nguồn) |
| 9 | 2 Phần cứng | Lắp ráp 7 giai đoạn A–G, 76 bước (+ ảnh mô hình 3D) |
| 10 | 3 Firmware | ArduPilot custom build 54 tính năng, chuỗi nạp DFU → kiểm → tham số |
| 11 | 3 Firmware | Firmware DroneBridge ESP32 và camera ESP32-S3 |
| 12 | 3 Firmware | Phần mềm và công cụ trên PC (logo + nhóm script) |
| 13 | 4 Cấu hình | Tham số an toàn: failsafe, geofence (TikZ 3D hình trụ rào), pin, RPM cất cánh |
| 14 | 4 Cấu hình | Tay cầm FS-i6X và chế độ bay |
| 15 | 4 Cấu hình | Hiệu chỉnh accel, level, la bàn, radio, ESC (sơ đồ giai đoạn) |
| 16 | 5 MAVLink | Luồng MAVLink qua Wi-Fi: gói, tần số, lọc HEARTBEAT |
| 17 | 5 MAVLink | Mạng ngoài bãi: iPhone qua cáp → hotspot laptop → 2 ESP32; số đo mất gói, khung/s theo khoảng cách |
| 18 | 6 Trạm mặt đất | Kiến trúc backend FastAPI (module, REST, WebSocket) |
| 19 | 6 Trạm mặt đất | Trang Bay: telemetry, radar vật cản, lái bằng bàn phím |
| 20 | 6 Trạm mặt đất | Lập và nạp mission, nạp lại khi đang bay AUTO (GUIDED giữ chỗ) |
| 21 | 6 Trạm mặt đất | Các lớp an toàn: dead-man, rào phần mềm, tránh vật cản TFmini |
| 22 | 6 Trạm mặt đất | Lịch sử bay: ghép log FC + tlog + video theo giờ GPS |
| 23 | 7 SITL | Drone ảo SITL và kiểm thử tự động (runner, số test) |
| 24 | 8 AI | Ảnh camera thật: 5 lỗi đo được |
| 25 | 8 AI | Dữ liệu và gán nhãn trên khung bay thật |
| 26 | 8 AI | Hệ tìm người ba tầng |
| 27 | 8 AI | Ảnh rõ: bộ lọc cổ điển 5 bước |
| 28 | 8 AI | Kết quả: mAP50, báo nhầm, A/B mù (biểu đồ) |
| 29 | 8 AI | Tích hợp trong web: độ trễ, trang camera + lịch sử |
| 30 | 9 Thực nghiệm | Kiểm phần cứng 12/12 + Motor Test (biểu đồ RPM) |
| 31 | 9 Thực nghiệm | 11 chuyến bay thật (bảng + ô số) |
| 32 | 9 Thực nghiệm | Một chuyến mission AUTO: độ cao, pin theo thời gian + vệt GPS |
| 33 | 9 Thực nghiệm | Chất lượng bay: rung, EKF, sai số hạ cánh (biểu đồ) |
| 34 | 9 Thực nghiệm | Sản phẩm hoàn chỉnh: các con số đạt được |
| 35 | Kết | Cảm ơn, hỏi đáp |
