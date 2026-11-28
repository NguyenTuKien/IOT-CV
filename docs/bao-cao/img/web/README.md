# Ảnh chụp trang web GCS (cho báo cáo Word)

Chụp ngày 27/11/2026 bằng Chrome headless, khung 1707×900 CSS px, `deviceScaleFactor 2` (ảnh trang đầy đủ 3414×1800 px),
theme Ngày. Drone là **drone ảo SITL** (ArduCopter, TFmini Plus ảo trên SERIAL3, lưới cột ảo của SITL), đang GUIDED, ARMED,
treo ở 10 m, một cột ảo cách 3,5 m phía trước để radar vật cản có số. Mission 6 điểm (vòng tròn bán kính 30 m, cao 5 m)
được soạn và nạp qua chính trang Nhiệm vụ, FC đọc lại khớp. Pin ảo đã đặt lại 100 % trước khi chụp.

Đã che trên ảnh: số phiên bản (backend, model AI), tên bundle model, nhãn "nguồn giả" của camera, ô vĩ độ/kinh độ
(drone và home) ở trang Dữ liệu bay, khối Broker IoT/MQTT trên sơ đồ trang Hệ thống. Ô bị che để trống, bố cục giữ nguyên.

## Trang đầy đủ

| File | Trang (route) | Nội dung |
|---|---|---|
| `web-bay.png` | Bay (`/`) | Buồng lái: màn hình bay, bản đồ có mission và rào mềm 50 m, chế độ bay, lái tay, radar vật cản, video có khung AI, nhật ký sự kiện |
| `web-mission.png` | Nhiệm vụ (`/mission`) | Thống kê lộ trình, bản đồ soạn 6 waypoint, hồ sơ độ cao, danh sách điểm, "FC đã xác nhận" |
| `web-3d.png` | Không gian 3D (`/3d`) | Bản sao số trên ảnh vệ tinh (ánh sáng Trưa), PFD, bản đồ nhỏ, bảng góc máy và lớp hiển thị |
| `web-vision.png` | Camera & AI (`/vision`) | Luồng camera, trạng thái 3 model (detector, verifier, ảnh rõ) chạy CUDA kèm ms, thống kê bộ nhận diện |
| `web-overview.png` | Tổng quan (`/overview`) | Phương tiện S500, mô hình 3D, Sẵn sàng bay 9/9, sức khoẻ từng khối, vị trí |
| `web-telemetry.png` | Dữ liệu bay (`/telemetry`) | Biểu đồ độ cao, tốc độ, tư thế, hướng mũi, pin; bảng số sống |
| `web-logs.png` | Nhật ký (`/logs`) | Bảng sự kiện lọc theo mức và nguồn, lịch sử lệnh |
| `web-flights.png` | Lịch sử bay (`/flights`) | Danh sách chuyến bay thật, đường bay chuyến 10:40 ngày 02/11/2026, khung camera đã ghi, thanh phát lại |
| `web-preflight.png` | Kiểm tra trước bay (`/preflight`) | 9 cổng tự động, 7 việc người vận hành tự xác nhận, 5 luật an toàn |
| `web-system.png` | Hệ thống (`/system`) | Sơ đồ kiến trúc sống, trạng thái backend, giới hạn an toàn backend đang áp |
| `web-settings.png` | Cài đặt (`/settings`) | Giao diện, bản đồ, 3D, âm thanh cảnh báo |

## Ảnh chi tiết (cho hướng dẫn sử dụng)

| File | Trang | Nội dung |
|---|---|---|
| `web-bay-thanh-trang-thai.png` | Bay | Thanh trạng thái dưới header: liên kết trình duyệt/backend/drone, mode, ARMED, pin, GPS, đồng hồ, nút WEB CONTROL (đang ON) |
| `web-bay-thanh-trang-thai-2-dong.png` | Bay | Thanh trạng thái cắt đôi, xếp hai dòng cho dễ đọc khi in (báo cáo Word dùng bản này) |
| `web-bay-man-hinh-bay.png` | Bay | Màn hình bay (PFD) và các ô độ cao, tốc độ, hướng mũi, GPS, pin, tuổi link, EKF |
| `web-bay-che-do-bay.png` | Bay | Nút HOLD, các mode, DISARM, TAKEOFF, độ cao cất cánh, RTL, LAND |
| `web-bay-quyen-dieu-khien.png` | Bay | Công tắc giành quyền lái WEB CONTROL ở trạng thái ON |
| `web-bay-lai-tay.png` | Bay | Panel lái tay khi WEB CONTROL ON: bàn phím QWEASDRF và mũi tên, Space dừng ngay, tốc độ xin và tốc độ thật |
| `web-bay-vat-can.png` | Bay | Radar TFmini: 3,5 m, vùng "Gần vật cản", thang 2 m / 5 m / 6 m, cảnh báo chế độ không tự tránh |
| `web-mission-ban-do.png` | Nhiệm vụ | Bản đồ soạn lộ trình: home, 6 waypoint, khoảng cách từng chặng, rào mềm 50 m |
| `web-mission-soan-mission.png` | Nhiệm vụ | Trình soạn mission: cất cánh, các waypoint chỉnh độ cao, "Đã nạp xong (8 item)", nút NẠP MISSION |
| `web-mission-ho-so-do-cao.png` | Nhiệm vụ | Hồ sơ độ cao theo quãng đường, trần 10 m, sàn 2 m |
| `web-vision-model-ai.png` | Camera & AI | Panel Model AI: trạng thái và độ trễ p50/p95 từng model (đã bỏ số phiên bản) |
| `web-preflight-tu-dong.png` | Kiểm tra trước bay | 9 cổng kiểm tự động, đều đạt |
| `web-preflight-thu-cong.png` | Kiểm tra trước bay | Danh sách 7 việc người vận hành tự tick |
| `web-settings-giao-dien.png` | Cài đặt | Theme, chuyển động, phím tắt |

## Lưu ý khi dùng

- Khung camera ở `web-bay.png` và `web-vision.png` không phải hình trực tiếp từ bo camera: backend đang phát lại video bay thật
  đã ghi ngày 02/11/2026 (nhãn nguồn đã che). Nếu chú thích cần nói đúng, ghi "khung phát lại từ video bay thật".
- Bản đồ ở các trang Bay, Nhiệm vụ, 3D, Tổng quan là vị trí của SITL (không phải bãi bay). Bản đồ ở `web-flights.png` là
  đường bay thật nhưng không có nhãn địa danh hay toạ độ.
- Trang Bay luôn nền tối ở ô màn hình bay (thiết kế của app, không phải lỗi theme).
