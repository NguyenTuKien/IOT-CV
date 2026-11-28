# 04. Thực nghiệm và kết quả (facts cho slide)

Gom ngày 26/11/2026 từ log, báo cáo và sổ tay trong repo. Chỉ ghi trạng thái cuối và kết quả đạt.
Mọi số có nguồn; CSV vẽ biểu đồ ở `docs/thuyet-trinh/facts/data/` (UTF-8, LF, có dòng tiêu đề, đơn vị
nằm trong tên cột). Giờ là giờ Việt Nam (giờ GPS).

Viết tắt nguồn:

- `[HW]` = `plans/reports/261115-kiem-phan-cung-that.md`
- `[LS]` = `plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md`
- `[B0111]` = `plans/reports/261102-phan-tich-bay-01-11.md`
- `[PT01]` = `logs/fc-dataflash-20261101-bay-ngoai-troi/phan-tich-001.md`
- `[PT02-n]` = `logs/fc-dataflash-20261102-bay-ngoai-troi/phan-tich-00n.md`
- `[FL]` = kết quả chạy `uv run python -m backend.flights --events` ngày 26/11/2026 (đọc
  `logs/fc-dataflash-*/*.bin`, `logs/tlog/*.tlog`, `logs/recordings/*/`)

---

## 1. Kiểm phần cứng trên bàn (15/11/2026): 12/12 hạng mục đạt

Drone không cánh, pin 4S cắm suốt; số liệu đọc qua MAVLink USB bằng `scripts/fc/kiem_phan_cung.py`
(chế độ chỉ đọc + chế độ ghi Motor Test qua MAVProxy). Nguồn: `[HW]` mục 1.

| Hạng mục | Kết quả | Số đo chính |
|---|---|---|
| FC SpeedyBee F405 V5 | Đạt | ArduCopter V4.7.1 (dbe79216); lỗi nội bộ 0; tải CPU ≤ 40 %; RAM trống 49–54 KB |
| IMU | Đạt | \|a\| 998 mG; ồn con quay 0,6–4,9 mrad/s; rung đứng yên 0,01–0,07 m/s², clip 0 |
| Baro | Đạt | 1010,2 hPa, ồn 0,2–0,3 Pa |
| La bàn IST8310 | Đạt | 385–388 mG, dao động 0,5 mG |
| Tham số FC | Đạt | 889 tham số, `INS_ACC_ID` và `COMPASS_DEV_ID` đủ |
| 4 ESC + 4 motor | Đạt | 41 lần khởi động, 0 lần khựng; bắt vòng 0,05–0,16 s; vòng quay lệch nhau ≤ 2,8 % |
| Receiver iA6B + FS-i6X | Đạt | 4 cần đủ 1000–2000 µs; SwA/SwB/SwC/SwD/VrB đúng chức năng; failsafe tắt tay phát < 0,1 s |
| TFmini Plus | Đạt | bám vật 10–260 cm, giữ ~113 cm dao động ±2 cm |
| Pin 4S | Đạt | 15,20 V = 3,80 V/cell |
| ESP32 DroneBridge | Đạt | MAVLink 2 chiều, FC trả `AUTOPILOT_VERSION` sau 0,21 s |
| Camera ESP32-S3 + OV3660 | Đạt | 150/150 khung sạch, VGA 7,6 khung/s, RSSI −28 dBm, PSRAM trống 8,2 MB |
| Cơ khí | Đạt | 4 motor quay tay êm, khung, càng, dây pha, mối hàn, tụ 1500 µF lành |

GPS không đưa vào bảng bàn (trong nhà 0 vệ tinh, `[HW]` mục 5). Ngoài trời GPS u-blox M10 bắt
15–28 vệ tinh, HDOP ≤ 0,89 suốt 11 chuyến (`[PT01]`, `[PT02-1..9]`; cột `ve_tinh_it_nhat`, `hdop_max`
của `chat-luong-bay.csv`).

### Motor Test không cánh (`[HW]` mục 2)

Vòng 1: "Test all" 7 lần ở ga 13 % (pwm 1130, 3 s). Vòng 2: từng motor ở ga 30 % (pwm 1300, 5 s), hai lượt.

| ESC | Vị trí | Khởi động | Khựng | rpm @13 % | rpm @30 % | Rung @30 % x/y/z (m/s²) | Nhiệt ESC |
|---|---|---|---|---|---|---|---|
| M1 | sau-phải | 10 | 0 | 2098–2100 | 4514 | 0,03–0,08 / 0,09–0,10 / 0,06 | 36–39 °C |
| M2 | trước-phải | 11 | 0 | 2100 | 4509–4514 | 0,05–0,10 / 0,14–0,15 / 0,11 | 43–45 °C |
| M3 | sau-trái | 10 | 0 | 2042 | 4462–4471 | 0,04 / 0,09–0,10 / 0,06–0,07 | 31–33 °C |
| M4 | trước-trái | 10 | 0 | 2071 | 4506–4509 | 0,02–0,05 / 0,09–0,10 / 0,02–0,03 | 39–41 °C |

Cả bốn cùng quay ở 30 %: rung 0,12 / 0,20 / 0,12 m/s² (ngưỡng tốt của ArduPilot < 15). Chiều quay
đúng (A/C ngược kim, B/D thuận).

### Tay cầm (`[HW]` mục 3)

CH1–CH4 về giữa 1498–1501 µs; CH5 (SwC) 1000/1500/2000 = STABILIZE/ALT_HOLD/LOITER; CH6 (SwD) → RTL;
CH9 (VrB) → AUTO; tắt tay phát → CH3 911 µs, FC báo `Radio Failsafe` cùng lúc (< 0,1 s).

---

## 2. Bay thật ngoài trời: 11 chuyến, 25,1 phút trên không

Nguồn: `[FL]` (bảng chuyến), `[LS]` mục 4, `[PT01]`, `[PT02-1..9]`. Hai buổi: tối 01/11/2026 và sáng
02/11/2026. Chuyến tính khi drone lên quá 1 m.

| Buổi | Số chuyến | Thời gian ARM | Thời gian trên không | Quãng đường ngang | Pin dùng |
|---|---|---|---|---|---|
| 01/11 | 5 | 778 s (13,0 phút) | 659 s (11,0 phút) | 329 m | 1903 mAh |
| 02/11 | 6 | 950 s (15,8 phút) | 849 s (14,2 phút) | 1218 m | 2435 mAh |
| **Tổng** | **11** | **1728 s (28,8 phút)** | **1508 s (25,1 phút)** | **1547 m** | **4338 mAh** |

Thời gian ARM, quãng đường, mAh: `[FL]` (cột `arm_s`, `path_m`, `used_mah` của `chuyen-bay-tom-tat.csv`).
Thời gian trên không: dòng "bay N s" của `[PT01]` và `[PT02-n]` (cột `bay_s` của `chat-luong-bay.csv`).

| Chuyến | Trên không (s) | Chế độ | Cao nhất (m) | Xa nhất (m) | Pin (V) | mAh | Hạ cách home (m) |
|---|---|---|---|---|---|---|---|
| 01/11 20:12 | 207 | STABILIZE, LOITER, RTL | 15,3 | 35,3 | 15,44→15,05 | 562 | 0,13 |
| 01/11 20:18 | 171 | LOITER, AUTO, RTL | 15,4 | 34,9 | 15,29→14,93 | 506 | 0,13 |
| 01/11 20:24 | 81 | LOITER, AUTO (đi–về) | 8,2 | 3,9 | 15,18→14,90 | 239 | 0,08 |
| 01/11 20:26 | 86 | LOITER, AUTO (đi–về) | 15,1 | 5,1 | 15,14→14,84 | 251 | 0,03 |
| 01/11 20:28 | 114 | LOITER, AUTO (đi–về) | 18,1 | 29,3 | 15,08→14,76 | 345 | 0,19 |
| 02/11 10:10 | 103 | LOITER, RTL | 18,2 | 42,0 | 16,61→16,24 | 285 | 0,07 |
| 02/11 10:14 | 136 | LOITER, AUTO | 18,3 | 49,6 | 16,38→15,96 | 380 | 0,12 |
| 02/11 10:23 | 119 | LOITER, AUTO | 15,6 | 28,9 | 16,12→15,76 | 339 | 0,12 |
| 02/11 10:26 | 143 | LOITER, AUTO | 16,6 | 28,7 | 15,94→15,54 | 407 | 0,24 |
| 02/11 10:30 | 149 | LOITER, AUTO | 15,2 | 27,2 | 15,76→15,35 | 428 | 0,10 |
| 02/11 10:40 | 199 | LOITER, AUTO, GUIDED (nạp mission khi bay) | 18,1 | 27,8 | 15,56→15,14 | 596 | 0,09 |

Chất lượng bay, cả 11 chuyến (`chat-luong-bay.csv`, nguồn `[PT01]`, `[PT02-n]`, `[B0111]` mục 3):

- 9/11 chuyến bay mission AUTO; mọi chuyến tự hạ (RTL hoặc hết mission) cách home **0,03–0,24 m**.
- Qua waypoint: 01/11 cách 0,02–0,19 m; 02/11 cách 0,36–1,43 m, điểm cuối 0,03–0,22 m.
- Rung p95 trục Z 10,8–19,5 m/s², lớn nhất 26,1 (ngưỡng tốt < 30); clip 0 ở mọi chuyến.
- EKF tỉ số kiểm lớn nhất 0,45 (< 1 là tốt). Bám góc RMS roll 0,6–1,4°, pitch 0,8–1,6°.
- Pin 4S cuối chuyến thấp nhất 14,76 V (ngưỡng FC 14,0 / 13,2 V). Dòng TB 8,2–10,1 A, treo 11–12 A.
- Nhiệt ESC lớn nhất 54 °C. Hover học được 0,184–0,228 ga.
- Trần độ cao 20 m giữ đúng: cao nhất 18,3 m = trần − `FENCE_MARGIN` 2 m (`[B0111]` mục 4).
- Rào thật: chuyến 02/11 10:14 lái LOITER ra rào 50 m, FC tự dừng ở 48,7 m, đúng lề 2 m (`[LS]` mục 4).

### Chuỗi thời gian cho biểu đồ

Xuất bằng `backend/flights` (cùng lưới thời gian của trang Lịch sử bay, bước 0,5 s), lấy 1 mẫu/2,
cắt ở lúc DISARM + 2 s. Cột `t_since_arm_s` = giây từ lúc ARM (âm = 10 s trước ARM). Ô trống = không có
dữ liệu lúc đó. Nguồn cột: lat, lon, alt, tốc độ, góc, pin, vệ tinh, rung, TFmini từ log FC (dataflash);
`rssi_dbm`, `link_loss_pct_3s` từ tlog backend; `cam_fps_2s` từ video ghi trên laptop.

| File | Chuyến | Dòng | Nội dung đáng vẽ |
|---|---|---|---|
| `data/chuoi-20261102-104039.csv` | 02/11 10:40:39, 213 s ARM | 451 | Độ cao (cao nhất 18,1 m), pin 15,56→15,14 V, dòng tới 16 A, roll/pitch, vệt GPS, RSSI TB −78 dBm, khung/s TB 5,6; cột `mode` cho thấy LOITER → AUTO → GUIDED (nạp mission) → AUTO |
| `data/chuoi-20261102-101435.csv` | 02/11 10:14:35, 153 s ARM | 331 | Chuyến xa nhất 49,5 m (dừng trước rào), RSSI TB −75 dBm, thấp nhất −92 dBm, khung/s TB 6,6 |

Nguồn file gốc: `logs/fc-dataflash-20261102-bay-ngoai-troi/009-20261102-034039.bin` và
`003-20261102-031435.bin`, tlog `logs/tlog/20261102-102742.tlog`, `20261102-104243.tlog`,
`20261102-101505.tlog`, video `logs/recordings/20261102-*`. Script xuất là script tạm (không vào repo);
lặp lại bằng `FlightStore.flights()` trong `backend/flights/index.py`, trường `series`.

Lưu ý khi vẽ: `lat_deg`/`lon_deg` là toạ độ thật của bãi bay. Vẽ vệt bay nên trừ toạ độ home (home
10:40: 21.0437839, 105.7292325) để ra mét Đông/Bắc.

Mốc sự kiện trên trục thời gian chuyến 10:40 (giây từ ARM, `[FL]` sự kiện mức info):
28,3 "Mission: 1 Takeoff" (AUTO) · 41,8 / 54,0 / 58,5 / 71,3 / 76,4 qua WP2–WP6 · 76,8 GUIDED giữ chỗ ·
77,9 "Flight plan received" · 106,7 AUTO bay mission mới từ "1 Takeoff" · 122,9–170,2 qua WP2–WP7 ·
170,2 "Mission: 8 RTL" · 213,5 DISARM.

### Tóm tắt từng chuyến (CSV)

`data/chuyen-bay-tom-tat.csv`: 11 chuyến cất cánh, cột `arm_s`, `airborne_s_alt_gt_1m` (giây alt > 1 m
trên lưới backend, gần với `bay_s`), `max_alt_m`, `max_dist_home_m`, `path_m`, pin, mAh,
`link_loss_pct` (chỉ 02/11 có tlog), `video_fps`. Nguồn `[FL]`.

`data/chat-luong-bay.csv`: rung, bám góc, EKF, vệ tinh, HDOP, dòng, nhiệt ESC, hạ cách home của 11
chuyến. Nguồn `[PT01]`, `[PT02-1,3,5,7,8,9]`.

---

## 3. Nạp mission khi đang bay (02/11/2026, chuyến 10:40): đạt

Nguồn: `[LS]` mục 3.1 bảng, `[PT02-9]`, `[FL]`.

- 10:41:56 drone đang AUTO ở 13–18 m, web gửi mission mới. Backend chuyển GUIDED đứng giữ chỗ
  (`COMMAND_ACK 176`), FC báo "Flight plan received", backend đặt `DO_SET_MISSION_CURRENT 1`.
- 10:42:26 người lái gạt AUTO, drone bay mission mới từ "1 Takeoff" qua WP2–WP7, rồi "8 RTL", hạ cách
  home 0,09 m.
- SITL cùng bài (`scripts/sitl/run_nap_khi_bay.py`): GUIDED sau < 0,1 s, lệch khi giữ chỗ 0,42 m ngang
  và 0,01 m cao, FC về item 1, tới B1 cách 1,3 m (`docs/so-tay/07-backend-mission-proximity-safety.md`
  dòng 308–318).

---

## 4. Mạng: DroneBridge + hotspot laptop

### Cấu hình ngoài bãi đã chốt: 0 gói mất

Đo 02/11/2026 trên drone chạy pin, ping hai ESP32 (`docs/so-tay/12-hotspot-laptop.md` mục 7,
`[B0111]` mục 4). Bảng này là thí nghiệm chọn cấu hình mạng cho laptop; CSV
`data/mang-hotspot-cau-hinh-20261102.csv`.

| Laptop lấy internet bằng | Mẫu ping | DroneBridge mất | Camera mất | Camera |
|---|---|---|---|---|
| Wi-Fi nhà 5 GHz, card vừa nối vừa phát | 240 | 77 (32 %) | 122 (51 %) | 1,41 khung/s |
| iPhone qua cáp USB, card chỉ phát hotspot | 240 | 7 (2,9 %) | 47 (20 %) | 4,67 khung/s |
| Cáp iPhone + tắt quét nền card (`che_do_bay.ps1 -Bat`) | 150 | **0** | **0** | **9,2 khung/s** |

- Hotspot giữ liên tục 28 phút (09:22–09:51, 10 s một mẫu, mọi mẫu On, đủ hai bo) (`[B0111]` mục 4).
- Backend tự chào DroneBridge (`MAVLINK_UDP_HELLO`): bo nối lại, gói đầu về sau 0,27 s (`[B0111]` mục 4).

### Tầm liên kết lúc bay (02/11/2026)

Nguồn `[LS]` mục 5, mục 11.1; cột `link_loss_pct` của `[FL]`.

- MAVLink qua Wi-Fi dùng được tới ~49 m; mất gói mỗi chuyến 1,8–12,1 %, trung vị 3,9 %
  (6 chuyến: 1,8 / 2,9 / 3,5 / 4,2 / 4,7 / 12,1).
- RSSI DroneBridge trung bình −75 tới −80 dBm, thấp nhất −90 tới −93 dBm lúc ở xa.
- Mất Wi-Fi không ảnh hưởng an toàn: `FS_GCS_ENABLE 0`, drone vẫn nghe tay cầm và vẫn bị rào giữ.

### Camera theo khoảng cách (`[LS]` mục 5, CSV `data/camera-fps-theo-khoang-cach-20261102.csv`)

| Cách home | Khung/s TB (mọi lần ARM 02/11) |
|---|---|
| 0–5 m | 7,8 |
| 5–15 m | 7,6 |
| 15–25 m | 3,1 |
| > 25 m | 1,8 |

Khung VGA, JPEG chất lượng 12, 24–26 KB/khung, 8 khung/s cần ~1,6 Mbit/s. Trên đất 8,2 khung/s.

### Camera tự hạ chất lượng JPEG (`[LS]` mục 11.2, CSV `data/jpeg-quality-kich-thuoc-20261115.csv`)

| Chất lượng | 12 | 19 | 26 | 30 | 33 | 40 | 50 | 63 |
|---|---|---|---|---|---|---|---|---|
| KB/khung | 15,2 | 12,4 | 11,0 | 10,3 | 10,1 | 9,5 | 8,9 | 10,0 |

Dưới 4 khung/s backend tăng chất lượng thêm 7, tối đa 40; trên 6,5 khung/s liền 10 s thì nâng nét lại về 12.
Từ 12 lên 40 khung nhỏ đi ~37 %, chở được ~1,6 lần số khung. Chạy thật với camera: 12 → 40 → 12,
8 sự kiện, đọc lại `quality 12`; cấu hình mặc định 40 s cạnh laptop: 0 lần đổi, 7,6–8,1 khung/s; 23 bài
`backend/tests/test_auto_quality.py` đạt.

---

## 5. Độ trễ (CSV `data/do-tre.csv`)

| Phép đo | Giá trị | Nguồn |
|---|---|---|
| Đóng tab khi đang giữ W → backend gửi vận tốc 0 | 6 ms và 7 ms (2 lần, SITL) | `docs/so-tay/10-web-dieu-khien-obstacle-video.md` dòng 213 |
| Socket đóng → dead-man ngắt | < 1 ms | `docs/so-tay/06-backend-dieu-khien-deadman.md` dòng 132; `plans/PROGRESS.md` dòng 481 |
| Trình duyệt treo, socket còn mở → dừng | ≤ 350 ms (hạn 300 ms + nhịp 50 ms) | `docs/so-tay/06-backend-dieu-khien-deadman.md` dòng 133, 154 |
| Thả phím → trang gửi 0 | ≤ 100 ms (gửi 10 Hz) | `docs/so-tay/10-web-dieu-khien-obstacle-video.md` dòng 25, 64 |
| Laptop hỏi FC qua Wi-Fi (`AUTOPILOT_VERSION`) | 0,21 s | `[HW]` mục 1 |
| Tắt tay phát → FC báo Radio Failsafe | < 0,1 s | `[HW]` mục 3 |
| Nạp mission khi bay → GUIDED | < 0,1 s (SITL) | `docs/so-tay/07-backend-mission-proximity-safety.md` dòng 313 |
| Mất sóng tay cầm → RTL | ~1 s (SITL) | `[LS]` mục 11.1 |
| AI cả hệ trên laptop, p95 nhịp thật | 89,5 ms | `D:\XLA\results\v2\iotcv\README.md` dòng 61 |
| Ping hotspot thường ngày | p50 ~4–40 ms, p95 ~66–145 ms | `docs/so-tay/12-hotspot-laptop.md` dòng 168 |

---

## 6. Drone ảo SITL: mọi runner PASS

### Cấu hình ngoài trời, rào 100 m, trần 20 m (15/11/2026): 8/8 PASS

Nguồn `[LS]` mục 11.1 (`scripts/sitl/run_ngoai_troi.py`, `KET QUA: PASS`); CSV `data/sitl-ngoai-troi-20261115.csv`.

| Bài | Kết quả |
|---|---|
| S1 / S1B mission đi–về 5 m | xa nhất 5,1 / 4,3 m, RTL không leo, hạ đúng home |
| S2 LOITER ga hết cỡ | dừng ở 18,1 m (trần 20, lề 2) |
| S3 STABILIZE vượt trần | chạm trần lúc leo 7 m/s → RTL, hạ cách home 0,1 m |
| S4 LOITER tiến hết cỡ | tự dừng ở 98,1 m, trước rào |
| S5 ALT_HOLD bay ra rào | chạm rào 99,6 m lúc 4,1 m/s → RTL, hạ đúng home |
| S6 mất sóng tay cầm | RTL sau ~1 s, hạ đúng home |
| S7 pin yếu | `Battery Failsafe` → RTL, hạ đúng home |

### Mười runner SITL (CSV `data/sitl-runner.csv`)

| Runner | Số đo | Nguồn |
|---|---|---|
| `run_mode_chain.py` | 7/7 chế độ; RTL về home 0,0 m | `plans/PROGRESS.md` dòng 280 |
| `run_rtl_alt.py` | đỉnh 20,0 m (`RTL_ALT_M 15`) và 50,0 m (`RTL_ALT_M 50`) | dòng 281 |
| `run_mission_auto.py` | 6 item đọc lại khớp từng trường, tới đủ WP 1–5, RTL về 0,0 m | dòng 282 |
| `run_mission_low_alt.py` | waypoint 3 m, xuống 3,2 m | dòng 283 |
| `run_log_dump.py` | 1218 mẫu `CTUN` ra CSV | dòng 284 |
| `run_param_load.py` | 51/51 dòng tham số kiểm | dòng 346 |
| `run_avoid_brake.py` | AVOID phanh, gần cột nhất 1,07 m | `logs/sitl/run_avoid_brake-20261101.log` |
| `run_backend_avoid.py` | backend báo OFF → NEAR → ACTIVE, gần nhất 1,05 m | `docs/so-tay/07-backend-mission-proximity-safety.md` dòng 129–135 |
| `run_nap_khi_bay.py` | GUIDED < 0,1 s, lệch 0,42 m, về item 1 | sổ tay 07 dòng 308–318 |
| `run_ngoai_troi.py` | 8/8 bài | `[LS]` mục 11.1 |

`bash scripts/sitl/run-all.sh` chạy tuần tự 8 runner trong ~17 phút (`scripts/sitl/run-all.sh` dòng 10–11).

### Tránh vật cản TFmini (SITL, `logs/sitl/run_avoid_brake-20261101.log`, CSV `data/tranh-vat-can-sitl.csv`)

LOITER giữ cần tiến thẳng vào cột ảo, TFmini Plus ảo trên SERIAL3, nguyên file param tránh vật cản của dự án:

| Lần chạy | Vượt cột | Gần cột nhất | Tốc độ 5 s cuối | Mẫu TFmini trong tầm | Lệch TFmini so với GPS |
|---|---|---|---|---|---|
| Đối chứng `AVOID_ENABLE 0` | có | −0,83 m (xuyên cột) | 3,99 m/s | 12 | 1,48 m |
| TFmini + AVOID bật | **không** | **1,07 m** | **0,78 m/s** | 133 | 0,36 m |

Ảnh: `docs/so-tay/anh/04-avoid-phanh.png`, `docs/so-tay/anh/04-mp-avoid-phanh.png` (`plans/PROGRESS.md` dòng 352–353).
Trên bàn TFmini thật bám 10–260 cm (`data/tfmini-chuoi-20261115.csv`, mục 7). Lúc bay 02/11 10:40
TFmini đo TB 2,1 m, max 3,2 m (`[PT02-9]` "Toàn log").

### Nghiệm thu web trên SITL: 9/9 (`docs/so-tay/10-web-dieu-khien-obstacle-video.md` dòng 205–217)

Cất cánh từ web (HUD 5,0 m) · giữ W tiến 1,00 m/s · thả W dừng sau 1,31 s · đóng tab dừng sau 6–7 ms ·
mất tiêu điểm dừng sau 1,06 s · mission 3 điểm từ bản đồ chạy hết · HOLD dừng sau 1,30 s · mất camera
báo OFFLINE sau 2,3 s, phần còn lại vẫn chạy · vật cản LOITER OFF → NEAR → ACTIVE.

---

## 7. Kiểm thử phần mềm (CSV `data/kiem-thu-phan-mem.csv`)

| Bộ kiểm | Đạt | Nguồn |
|---|---|---|
| `uv run pytest backend/tests` | 393 passed | `[LS]` mục 9 |
| `pnpm test` (frontend) | 278 passed, 22 file | `[LS]` mục 9 |
| Coverage `safety` / `mission` / `deadman` / `proximity` | 99 / 90 / 93 / 97 %, tổng 93 % | `plans/PROGRESS.md` dòng 550 |
| `test_deadman.py` / `test_control.py` | 17 / 17 passed | `plans/PROGRESS.md` dòng 477–478 |

---

## 8. Danh mục CSV

| File | Nội dung | Nguồn |
|---|---|---|
| `kiem-phan-cung-20261115.csv` | bảng 12 hạng mục đạt (mục 1) | `[HW]` mục 1 |
| `motor-test-esc-20261115.csv` | số đo từng ESC dạng khoảng | `[HW]` mục 2 |
| `motor-test-rpm-20261115.csv` | rpm từng motor ở ga 13 % và 30 % (cột số, vẽ cột đôi) | `[HW]` mục 2, lấy giá trị lớn nhất mỗi khoảng |
| `motor-test-chuoi-20261115.csv` | 483 dòng, 1 mẫu/11 của `logs/kiem-motor/motor-20261115.csv` (~1,7 mẫu/s, 283 s): pwm, rpm, nhiệt 4 ESC, rung x/y/z | `logs/kiem-motor/motor-20261115.csv` |
| `tfmini-chuoi-20261115.csv` | 468 dòng, 1 mẫu/7 của chuỗi `DISTANCE_SENSOR` 198 s (10–259 cm) | `logs/kiem-motor/tfmini-chuoi-20261115.csv` |
| `chuyen-bay-tom-tat.csv` | 11 chuyến cất cánh | `[FL]` |
| `chat-luong-bay.csv` | chất lượng bay 11 chuyến | `[PT01]`, `[PT02-n]` |
| `chuoi-20261102-104039.csv` | chuỗi thời gian chuyến nạp mission khi bay, 451 dòng | mục 2 |
| `chuoi-20261102-101435.csv` | chuỗi thời gian chuyến xa nhất, 331 dòng | mục 2 |
| `mang-hotspot-cau-hinh-20261102.csv` | ba cấu hình mạng laptop | sổ tay 12 mục 7 |
| `camera-fps-theo-khoang-cach-20261102.csv` | khung/s theo khoảng cách | `[LS]` mục 5 |
| `jpeg-quality-kich-thuoc-20261115.csv` | KB/khung theo chất lượng JPEG | `[LS]` mục 11.2 |
| `do-tre.csv` | độ trễ (mục 5) | cột `nguon` |
| `sitl-ngoai-troi-20261115.csv` | 8 bài SITL ngoài trời | `[LS]` mục 11.1 |
| `sitl-runner.csv` | 10 runner SITL | cột `nguon` |
| `tranh-vat-can-sitl.csv` | đối chứng vs bật AVOID | `logs/sitl/run_avoid_brake-20261101.log` |
| `kiem-thu-phan-mem.csv` | số bài test | cột `nguon` |

---

## 9. Kết quả đạt được

1. Kiểm phần cứng trên bàn 12/12 hạng mục đạt; 4 motor 41 lần khởi động, 0 lần khựng, vòng quay lệch
   nhau ≤ 2,8 % (`[HW]` mục 1–2).
2. 11 chuyến bay thật ngoài trời, 25,1 phút trên không, 1547 m quãng đường ngang, cao tới 18,3 m, xa
   tới 49,6 m (`[FL]`, `[PT01]`, `[PT02-n]`).
3. 9/11 chuyến bay mission AUTO; mọi chuyến tự hạ cách home 0,03–0,24 m (`chat-luong-bay.csv`).
4. Bay ổn định: rung lớn nhất 26,1 m/s² (< 30), clip 0, EKF ≤ 0,45, pin cuối chuyến ≥ 14,76 V
   (`[PT01]`, `[PT02-n]`).
5. Nạp mission mới khi drone đang bay AUTO: GUIDED giữ chỗ, bay lại từ điểm 1, hạ cách home 0,09 m
   (02/11 10:40, `[LS]` mục 3.1).
6. Rào ảo và trần độ cao giữ đúng trên drone thật (dừng ở 48,7 m với rào 50 m; cao nhất 18,3 m với trần
   20 m) và trên SITL với rào 100 m (dừng ở 98,1 m) (`[LS]` mục 4, 11.1).
7. MAVLink qua Wi-Fi dùng được tới ~49 m, mất gói trung vị 3,9 % mỗi chuyến; cấu hình mạng ngoài bãi
   đạt 0/150 gói mất, camera 9,2 khung/s (`[LS]` mục 11.1, sổ tay 12 mục 7).
8. Dead-man dừng drone 6–7 ms sau khi đóng tab, ≤ 350 ms khi trình duyệt treo
   (sổ tay 10 dòng 213, sổ tay 06 dòng 133).
9. Tránh vật cản TFmini trên SITL: drone dừng cách cột 1,07 m, lần đối chứng tắt AVOID bay xuyên cột
   (`logs/sitl/run_avoid_brake-20261101.log`).
10. SITL 10/10 runner PASS, trong đó cấu hình ngoài trời 8/8; web 9/9 bài nghiệm thu; 393 test backend
    và 278 test frontend đạt (`[LS]` mục 9, 11.1; `plans/PROGRESS.md`).
