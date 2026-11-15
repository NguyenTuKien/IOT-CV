# 001-khong-gio-thieu.bin

Đọc qua bản ghép bảng FMT: `logs\fc-dataflash-20261101-bay-ngoai-troi\001-khong-gio-thieu-ghep-fmt.bin`

## Chuyến 1 — 20:13:05 → 20:16:41 (arm 215 s, bay 207 s)
- Lưu ý: giờ arm suy từ lúc đặt home (log mất bản ghi ARM)
- Chế độ: STABILIZE 20:13:05 (công tắc chế độ) → LOITER 20:13:45 (công tắc chế độ) → RTL 20:15:50 (công tắc phụ)
- Disarm: tự sau khi hạ
- Cao nhất 15.3 m so với home · xa nhất 34.7 m
- Chạm đất cách home 0.13 m
- Tốc độ đất lớn nhất 3.5 m/s · vệ tinh ít nhất 18 · HDOP lớn nhất 0.78
- Gói GPS cách nhau: TB 200.4, p95 200.0, max 400.0 ms; 2 lần > 245 ms
- Leo nhanh nhất 1.7 m/s, hạ nhanh nhất -1.8 m/s · ga ra (ThO) TB 0.2, p95 0.2, max 0.3 · hover học được 0.221
- Pin 15.46 → 15.20 V (thấp nhất 15.04) · dòng TB 9.5, p95 12.9, max 15.7 A · tốn 568 mAh
- Rung (m/s², tốt < 30, xấu > 60): X TB 7.0, p95 11.3, max 22.3 · Y TB 8.8, p95 14.4, max 20.4 · Z TB 11.3, p95 17.5, max 23.4 · clip +0
- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max 0.34, vị trí 0.04, cao 0.23, la bàn 0.26
- Bám góc: roll RMS 1.4° (max 9.0°), pitch RMS 1.6° (max 10.8°), yaw RMS 3.7° (max 27.8°); nghiêng thật lớn nhất 29°
- Lúc rời đất: pitch thật−lệnh lớn nhất -0.5° · roll +0.8° (dương: pitch = ngóc mũi, roll = nghiêng phải)
- Góc giữ chỗ khi treo: roll TB +1.0°, pitch TB -1.3° (472 mẫu, mũi hướng 91°±74)
- Đoạn STABILIZE: 32 s · tốc độ đất TB 0.5, p95 2.9, max 3.4 m/s · cần roll/pitch lệch giữa TB 3.6, p95 8.0, max 192.0 µs (1 µs ≈ 0,06° lệnh)
- Cân bằng motor: M1 1413 · M2 1406 · M3 1434 · M4 1423 µs (1202 mẫu treo); trước−sau -9, phải−trái -19, CW−CCW -2 µs
- Motor chạm trần (≥1950) 0 mẫu, chạm sàn (≤1100) 0 mẫu / 2069
- ESC khởi động: M1 sau-phải 0.11 s, HỤT 1 lần; M2 trước-phải 0.55 s; M3 sau-trái 0.26 s; M4 trước-trái 0.29 s
- ESC tụt vòng khi bay: không
- Nhiệt ESC lớn nhất 46 °C
- FC 20:13:40: EKF3 IMU0 MAG0 in-flight yaw alignment complete

## Chuyến 2 — 20:18:51 → 20:22:03 (arm 193 s, bay 171 s)
- Chế độ: LOITER 20:18:51 (công tắc chế độ) → AUTO 20:19:21 (công tắc phụ) → LOITER 20:20:00 (công tắc chế độ) → RTL 20:21:12 (công tắc phụ)
- Disarm: tự sau khi hạ
- Cao nhất 15.4 m so với home · xa nhất 34.1 m
- Chạm đất cách home 0.13 m
- Tốc độ đất lớn nhất 3.3 m/s · vệ tinh ít nhất 19 · HDOP lớn nhất 0.74
- Gói GPS cách nhau: TB 200.6, p95 200.0, max 400.0 ms; 3 lần > 245 ms
- Leo nhanh nhất 2.7 m/s, hạ nhanh nhất -1.5 m/s · ga ra (ThO) TB 0.2, p95 0.2, max 0.3 · hover học được 0.218
- Pin 15.29 → 15.09 V (thấp nhất 14.91) · dòng TB 9.5, p95 12.4, max 17.1 A · tốn 507 mAh
- Rung (m/s², tốt < 30, xấu > 60): X TB 7.8, p95 13.3, max 20.7 · Y TB 8.5, p95 14.9, max 20.3 · Z TB 10.0, p95 15.2, max 23.0 · clip +0
- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max 0.37, vị trí 0.04, cao 0.19, la bàn 0.23
- Bám góc: roll RMS 1.0° (max 7.1°), pitch RMS 1.3° (max 9.0°), yaw RMS 4.5° (max 36.7°); nghiêng thật lớn nhất 15°
- Lúc rời đất: pitch thật−lệnh lớn nhất +1.7° · roll +2.2° (dương: pitch = ngóc mũi, roll = nghiêng phải)
- Góc giữ chỗ khi treo: roll TB -1.9°, pitch TB -1.1° (418 mẫu, mũi hướng 219°±98)
- Cân bằng motor: M1 1456 · M2 1469 · M3 1454 · M4 1440 µs (972 mẫu treo); trước−sau -0, phải−trái +16, CW−CCW -14 µs
- Motor chạm trần (≥1950) 0 mẫu, chạm sàn (≤1100) 0 mẫu / 1712
- ESC khởi động: M1 sau-phải 0.40 s; M2 trước-phải 0.12 s; M3 sau-trái 0.25 s; M4 trước-trái 0.28 s
- ESC tụt vòng khi bay: không
- Nhiệt ESC lớn nhất 47 °C
- Mission: WP2 gần nhất 0.08 m; WP3 gần nhất 0.13 m
- FC 20:19:21: Mission: 1 Takeoff
- FC 20:19:22: EKF3 IMU0 MAG0 in-flight yaw alignment complete
- FC 20:19:25: Mission: 2 WP
- FC 20:19:32: Reached command #2
- FC 20:19:32: Mission: 3 WP
- FC 20:19:41: Reached command #3
- FC 20:19:41: Mission: 4 RTL

## Chuyến 3 — 20:24:14 → 20:25:49 (arm 95 s, bay 81 s)
- Chế độ: LOITER 20:24:14 (công tắc chế độ) → AUTO 20:25:00 (công tắc phụ)
- Disarm: hết mission
- Cao nhất 8.2 m so với home · xa nhất 3.2 m
- Chạm đất cách home 0.08 m
- Tốc độ đất lớn nhất 1.7 m/s · vệ tinh ít nhất 18 · HDOP lớn nhất 0.78
- Gói GPS cách nhau: TB 200.4, p95 200.0, max 400.0 ms; 1 lần > 245 ms
- Leo nhanh nhất 1.6 m/s, hạ nhanh nhất -0.8 m/s · ga ra (ThO) TB 0.2, p95 0.2, max 0.3 · hover học được 0.219
- Pin 15.20 → 15.05 V (thấp nhất 14.90) · dòng TB 9.1, p95 12.3, max 16.4 A · tốn 239 mAh
- Rung (m/s², tốt < 30, xấu > 60): X TB 6.7, p95 9.4, max 12.5 · Y TB 7.4, p95 12.0, max 17.4 · Z TB 9.7, p95 15.1, max 19.1 · clip +0
- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max 0.28, vị trí 0.03, cao 0.16, la bàn 0.18
- Bám góc: roll RMS 1.0° (max 5.8°), pitch RMS 1.0° (max 4.0°), yaw RMS 2.6° (max 13.9°); nghiêng thật lớn nhất 11°
- Lúc rời đất: pitch thật−lệnh lớn nhất +1.2° · roll -1.0° (dương: pitch = ngóc mũi, roll = nghiêng phải)
- Góc giữ chỗ khi treo: roll TB -0.5°, pitch TB -0.1° (280 mẫu, mũi hướng 103°±115)
- Cân bằng motor: M1 1449 · M2 1445 · M3 1470 · M4 1448 µs (614 mẫu treo); trước−sau -14, phải−trái -12, CW−CCW -9 µs
- Motor chạm trần (≥1950) 0 mẫu, chạm sàn (≤1100) 0 mẫu / 810
- ESC khởi động: M1 sau-phải 0.12 s, HỤT 1 lần; M2 trước-phải 0.56 s; M3 sau-trái 0.38 s; M4 trước-trái 0.30 s
- ESC tụt vòng khi bay: không
- Nhiệt ESC lớn nhất 46 °C
- Mission: WP2 gần nhất 0.03 m; WP3 gần nhất 0.09 m
- FC 20:24:36: EKF3 IMU0 MAG0 in-flight yaw alignment complete
- FC 20:25:00: Mission: 1 Takeoff
- FC 20:25:03: Mission: 2 WP
- FC 20:25:10: Reached command #2
- FC 20:25:10: Mission: 3 WP
- FC 20:25:19: Reached command #3
- FC 20:25:19: Mission: 4 RTL

## Chuyến 4 — 20:26:25 → 20:28:08 (arm 103 s, bay 86 s)
- Chế độ: LOITER 20:26:25 (công tắc chế độ) → AUTO 20:27:12 (công tắc phụ)
- Disarm: hết mission
- Cao nhất 15.1 m so với home · xa nhất 5.9 m
- Chạm đất cách home 0.03 m
- Tốc độ đất lớn nhất 2.3 m/s · vệ tinh ít nhất 19 · HDOP lớn nhất 0.85
- Gói GPS cách nhau: TB 200.4, p95 200.0, max 400.0 ms; 1 lần > 245 ms
- Leo nhanh nhất 2.6 m/s, hạ nhanh nhất -1.8 m/s · ga ra (ThO) TB 0.2, p95 0.3, max 0.3 · hover học được 0.217
- Pin 15.14 → 15.01 V (thấp nhất 14.84) · dòng TB 8.7, p95 12.7, max 16.5 A · tốn 251 mAh
- Rung (m/s², tốt < 30, xấu > 60): X TB 8.0, p95 11.7, max 18.7 · Y TB 10.1, p95 17.0, max 26.1 · Z TB 11.6, p95 19.5, max 25.9 · clip +0
- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max 0.36, vị trí 0.05, cao 0.23, la bàn 0.27 · CÓ cờ lỗi FS
- Bám góc: roll RMS 1.3° (max 8.1°), pitch RMS 1.4° (max 7.5°), yaw RMS 2.6° (max 11.0°); nghiêng thật lớn nhất 10°
- Lúc rời đất: pitch thật−lệnh lớn nhất -1.8° · roll +2.2° (dương: pitch = ngóc mũi, roll = nghiêng phải)
- Góc giữ chỗ khi treo: roll TB -1.7°, pitch TB -1.2° (315 mẫu, mũi hướng 214°±65)
- Cân bằng motor: M1 1467 · M2 1460 · M3 1469 · M4 1413 µs (468 mẫu treo); trước−sau -31, phải−trái +22, CW−CCW -24 µs
- Motor chạm trần (≥1950) 0 mẫu, chạm sàn (≤1100) 0 mẫu / 863
- ESC khởi động: M1 sau-phải 0.39 s, HỤT 1 lần; M2 trước-phải 0.41 s; M3 sau-trái 0.23 s; M4 trước-trái 0.26 s
- ESC tụt vòng khi bay: không
- Nhiệt ESC lớn nhất 46 °C
- Mission: WP2 gần nhất 0.02 m; WP3 gần nhất 0.14 m
- FC 20:26:49: EKF3 IMU0 MAG0 in-flight yaw alignment complete
- FC 20:27:12: Mission: 1 Takeoff
- FC 20:27:13: Mission: 2 WP
- FC 20:27:22: Reached command #2
- FC 20:27:22: Mission: 3 WP
- FC 20:27:30: Reached command #3
- FC 20:27:30: Mission: 4 RTL
- FC 20:27:58: AHRS: DCM active
- FC 20:27:58: AHRS: EKF3 active

## Chuyến 5 — 20:28:34 → 20:30:46 (arm 132 s, bay 114 s)
- Chế độ: LOITER 20:28:34 (công tắc chế độ) → AUTO 20:29:36 (công tắc phụ)
- Disarm: hết mission
- Cao nhất 18.1 m so với home · xa nhất 23.6 m
- Chạm đất cách home 0.19 m
- Tốc độ đất lớn nhất 3.5 m/s · vệ tinh ít nhất 19 · HDOP lớn nhất 0.89
- Gói GPS cách nhau: TB 200.6, p95 200.0, max 400.0 ms; 2 lần > 245 ms
- Leo nhanh nhất 2.7 m/s, hạ nhanh nhất -1.5 m/s · ga ra (ThO) TB 0.2, p95 0.3, max 0.3 · hover học được 0.228
- Pin 15.08 → 14.91 V (thấp nhất 14.76) · dòng TB 9.4, p95 13.1, max 16.5 A · tốn 345 mAh
- Rung (m/s², tốt < 30, xấu > 60): X TB 7.7, p95 10.8, max 15.6 · Y TB 9.4, p95 17.0, max 21.4 · Z TB 10.5, p95 15.6, max 23.6 · clip +0
- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max 0.44, vị trí 0.07, cao 0.20, la bàn 0.30
- Bám góc: roll RMS 1.1° (max 5.4°), pitch RMS 1.5° (max 8.5°), yaw RMS 2.4° (max 12.2°); nghiêng thật lớn nhất 18°
- Lúc rời đất: pitch thật−lệnh lớn nhất +1.4° · roll +0.6° (dương: pitch = ngóc mũi, roll = nghiêng phải)
- Góc giữ chỗ khi treo: roll TB -2.8°, pitch TB -0.3° (237 mẫu, mũi hướng 213°±49)
- Cân bằng motor: M1 1484 · M2 1467 · M3 1471 · M4 1427 µs (491 mẫu treo); trước−sau -31, phải−trái +27, CW−CCW -14 µs
- Motor chạm trần (≥1950) 0 mẫu, chạm sàn (≤1100) 0 mẫu / 1138
- ESC khởi động: M1 sau-phải KHÔNG bắt vòng trong 3 s; M2 trước-phải 0.41 s; M3 sau-trái 0.22 s; M4 trước-trái 0.35 s, HỤT 1 lần
- ESC tụt vòng khi bay: không
- Nhiệt ESC lớn nhất 46 °C
- Mission: WP2 gần nhất 0.14 m; WP3 gần nhất 0.19 m
- FC 20:28:56: EKF3 IMU0 MAG0 in-flight yaw alignment complete
- FC 20:29:36: Mission: 1 Takeoff
- FC 20:29:36: Mission: 2 WP
- FC 20:29:53: Reached command #2
- FC 20:29:53: Mission: 3 WP
- FC 20:30:01: Reached command #3
- FC 20:30:01: Mission: 4 RTL

## Toàn log
- Có dữ liệu bay từ 20:12:18 tới 20:31:01
- Gói GPS cách nhau (cả log): TB 200.4, p95 200.0, max 400.0 ms; 9 lần > 245
- Nguồn bo: Vcc bo không đo (NaN); cờ nguồn gặp: [0]
- CPU: tải TB 42.0, p95 46.0, max 47.0 %, vòng lặp chậm 3
- Log rơi 140 message (bộ đệm ghi đầy)
- TFmini (đo được): TB 2.8, p95 4.1, max 5.9 m
- LỖI 20:30:53: failsafe tay cầm mã 1
