# TFmini Plus và receiver sau khi hàn dây trắng — 26/10/2026

Kiểm trên drone đã lắp, pin 4S cắm (15,8–15,9 V), không ARM, motor không quay. Bản chụp tham số
trước khi sửa: `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261026-truoc-sua-tfmini.param`.

## 1. Kết luận

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Dây trắng → T3 | **Đạt, không cần hàn lại** | TFmini trả lời lệnh gửi qua dây trắng: `5A 07 01 00 07 01 6A` (firmware v1.7.0) |
| Chập T3 với pad 9V/GND | Không có | Chập thì cảm biến không nhận được lệnh; nó nhận đủ 4 lệnh |
| Cấu hình TFmini | **Đã sửa** | Về cài đặt gốc `5A 05 10 00 6F`, lưu `5A 05 11 00 70`, khởi động lại `5A 05 02 00 61` → 93,5 khung/giây đọc qua MAVLink (trước: 1 khung/giây) |
| Đơn vị | cm | Cùng bức tường: trước 2566 (mm), sau 257 cm |
| ArduPilot nhận cảm biến | Đạt | `DISTANCE_SENSOR` id 10, hướng 0, tầm 10–600 cm, ~10 mẫu/s; hết `Rangefinder 1: No Data` / `PRX1: No Data` |
| Đo vật thật | Đạt | 20 cm (người dùng đo) → 13–14 cm; ~1 m → 98–104 cm; không vật → 256 cm |
| Web (backend qua Wi-Fi) | Đạt ở tầng WebSocket | `obstacle_distance` 2,56 → 0,95 m, `rangefinder_healthy=true` |
| Phanh trên SITL, đúng bộ tham số dự án | PASS | `run_avoid_brake.py`: tắt avoid thì xuyên cột; bật thì giữ cần tiến 40 s vẫn dừng, gần nhất 1,11 m |
| Receiver | **Không bị ảnh hưởng** | Mục 4 |
| PreArm khi bật TFmini + PRX | Sạch | `MAV_CMD_RUN_PREARM_CHECKS` không trả lỗi khi tay phát bật |

Sai số 7 cm ở 20 cm nằm sát vùng mù 10 cm của cảm biến; từ ~1 m trở ra khớp.

## 2. Cách đã sửa, và một đường không dùng được

`scripts/fc/tfmini_qua_fc.py` (mới) nói chuyện với TFmini qua FC bằng gói MAVLink `SERIAL_CONTROL`
(thiết bị `SERIAL0 + 3`): `doc`, `phien-ban`, `khoi-phuc`. Cần `RNGFND1_TYPE 0` lúc chạy, vì driver
rangefinder sẽ đọc tranh byte trên SERIAL3.

Passthrough `SERIAL_PASS1 0` + `SERIAL_PASS2 3` **không dùng được** cho việc ghi: chiều đọc chạy,
nhưng sau vài lần gửi FC thôi nhận byte từ USB; sau đó MAVLink qua USB cũng kẹt (ghi treo > 40 s) tới
khi khởi động lại FC. Lệnh reboot gửi qua Wi-Fi gỡ được. Hôm 25/10 cũng gặp chuyện tương tự.
Lúc cảm biến còn ở 1 khung/giây, nó trả lời lệnh chậm gần 1 s, có lần không trả lời, nên script
nhắc lại lệnh tới khi có trả lời.

## 3. Tham số trên FC sau phiên này

`RNGFND1_TYPE 20`, `RNGFND1_ORIENT 0`, `RNGFND1_MIN 0.1`, `RNGFND1_MAX 6`, `PRX1_TYPE 4`,
`AVOID_ENABLE 3`, `AVOID_BEHAVE 1`, `AVOID_ANG_MAX 10`, `OA_TYPE 0`, `FENCE_ENABLE 0`.

**Mốc tạm cho bay thử trong nhà** (người dùng yêu cầu 40–50 cm vì nhà nhỏ):
`AVOID_MARGIN 0,5` (cũ 2), `AVOID_DIST_MAX 0,5` (cũ 5). Tài liệu ArduPilot khuyến nghị từ 1 m cho cả
hai; mã không chặn giá trị nhỏ hơn. **Trả về 2 / 5 trước khi bay ngoài trời.** File
`firmware/ardupilot/params/02-avoid-tfmini.param` vẫn giữ 2 / 5. Chạy backend cho bay trong nhà thì
thêm `AVOID_MARGIN_M=0.5 AVOID_DIST_MAX_M=0.5` để panel web cùng mốc với FC.

`FENCE_ENABLE`: tránh vật cản không cần fence (đã đọc `AC_Avoid` 4.7.1: chỉ xét bit 2 của
`AVOID_ENABLE`). Plan 17.7 ghi "bắt buộc đi kèm" là sai, đã đính chính.

## 4. Receiver

| Thử | Kết quả |
|---|---|
| Đứng yên 12 s, TFmini còn 1 khung/giây | 116 mẫu, 14 kênh, lệch 0 µs mọi kênh |
| Đứng yên 15 s, TFmini 100 khung/giây | 152 mẫu, 14 kênh, lệch 0 µs |
| Gạt cần 65 s | CH1/CH2/CH3 chạy 1000–2000, CH4 1000–1579 (chỉ đẩy trái theo hướng dẫn an toàn), CH5 (SwC) đủ 3 nấc; RC không lần nào báo không khoẻ; FC không ARM |
| Tay phát tắt giữa phiên | Receiver xuất CH3 = 911 (giá trị failsafe đã cài), FC báo `Radio failsafe on`; bật tay phát lại → hết |

CH7 không đổi trong bài gạt cần, có thể SwA chưa được gạt; không ảnh hưởng kết luận.

## 5. TFmini làm gì ở từng chế độ (bản đồ SwC: Stabilize / AltHold / Loiter)

- **Stabilize**: không tránh gì.
- **AltHold**: vật cản gần hơn `AVOID_DIST_MAX` thì FC cộng thêm góc nghiêng lùi
  (1 − d/DIST_MAX) × 45°, tối đa `AVOID_ANG_MAX` 10°. Đây là đẩy lùi, không phải phanh đứng; cần
  của người lái vẫn ghi đè được. Không có cảm biến nhìn xuống nên không có ngưỡng độ cao: chạy cả khi
  bay sát đất.
- **Loiter / PosHold** (cần GPS, chỉ ngoài trời): dừng ở `AVOID_MARGIN`, lùi ra với
  `AVOID_BACKUP_SPD` 0,75 m/s nếu đang ở gần hơn.
- **Auto / Guided / RTL**: không tránh (`OA_TYPE 0`); panel web đã cảnh báo điều này.

Khoảng cách tính từ mắt TFmini. Đầu cánh trước nhô ra trước mắt cảm biến chừng 15–20 cm (ước theo
khung S500, chưa đo), nên mốc 0,5 m chỉ còn khoảng 30 cm tới đầu cánh.

## 6. Còn lại

- Bay thử tránh vật cản thật (người vận hành bay): trong nhà ở AltHold, vật cản mềm (thùng carton,
  nệm), tiến chậm với cần thả giữa, xem drone tự nghiêng lùi khi còn ~50 cm. Bài chuẩn ngoài trời ở
  Loiter là F9 của Phase 22, với mốc 2 / 5.
- Bảng hiệu chuẩn 5 khoảng cách (Phase 22) mới có 2 điểm.
- Nhiệt độ chip TFmini báo 67–72 °C cả hôm 25/10 lẫn hôm nay. Chưa đối chiếu được với ngưỡng của
  hãng; theo dõi tiếp.
