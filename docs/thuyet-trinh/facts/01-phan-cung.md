# Facts 01: Phần cứng drone (trạng thái cuối)

Quy ước nguồn (viết tắt):
- `[HW]` = `docs/phan-cung-thuc-te.md` (SSOT, thắng mọi nguồn khác khi lệch)
- `[PARTS]` = `docs/huong-dan/lap-rap/src/data-parts.js`
- `[CAB]` = `docs/huong-dan/lap-rap/src/data-cables.js`
- `[STEPS]` = `docs/huong-dan/lap-rap/src/data-steps.js`, `[STEPS2]` = `.../data-steps2.js`
- `[TOOLS]` = `docs/huong-dan/lap-rap/src/data-tools.js`
- `[BC]` = `docs/bao-cao-tong-quan-du-an.md`, `[ARC]` = `docs/archive/plan-nhap-92-giai-doan.md`
- `[P13]` = `plans/phase-13-chuan-bi-lap-rap.md`
- `[K1115]` = `plans/reports/261115-kiem-phan-cung-that.md`, `[K1025]` = `plans/reports/261025-kiem-tra-phan-cung-that.md`, `[HC1025]` = `plans/reports/261025-hieu-chinh-bay-trong-nha.md`
- `[P01]` = `firmware/ardupilot/params/01-base.param`, `[P02]` = `firmware/ardupilot/params/02-avoid-tfmini.param`, `[CB]` = `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`

## 1. Bảng linh kiện trên drone cuối

| # | Linh kiện | Thông số chính | Vai trò | SL | Nguồn |
|---|---|---|---|---|---|
| 1 | Khung Holybro S500 V2 | 480 mm đường chéo motor-motor; 782 g (khung + chân đáp, Holybro công bố); tấm đế là PDB có đồng đúc chìm (cấm khoan); không có lỗ 30,5×30,5 | Khung, phân phối nguồn | 1 | [PARTS] frame; [BC] mục 3.1 |
| 2 | Bo bay SpeedyBee F405 V5 (stack OX32 55A) | STM32F405, 1 MB flash, gyro ICM-42688, baro SPA06, blackbox 16 MB; 39×39 mm, lỗ 30,5 M3; không có la bàn trong bo | Não drone, chạy ArduCopter 4.7.1 custom build | 1 | [PARTS] fc; [HW] |
| 3 | ESC SpeedyBee OX32 55A 4-in-1 | 55 A liên tục/kênh, 3–6S; 40,9×44,9×8 mm; DShot300 (`MOT_PWM_TYPE 5`); firmware ESC 1.13 | Cấp dòng 4 motor, telemetry RPM | 1 | [PARTS] esc; [P01] dòng 91; [HW] |
| 4 | Motor T-Motor AIR2216 II KV920 (bộ AIR GEAR 450 II) | Ø27,7×31 mm, 64 g; trục ren M6; bắt 4×M3 lỗ 16×19; 2 ren phải + 2 ren trái | Lực đẩy | 4 | [PARTS] motor |
| 5 | Cánh T1045 | 10 inch, bước 4,5; giới hạn 1,2 kg/cánh, đẹp nhất 6000–7000 vòng/phút | Cánh quạt | 4 dùng + 4 dự phòng | [PARTS] prop |
| 6 | GPS Holybro M10 + la bàn IST8310 | u-blox M10, UART 230400 (`GPS1_TYPE 2`), la bàn I2C; nguồn 4,7–5,2 V; cáp GH 1,25 10 chân + cột nâng | Định vị, hướng | 1 | [PARTS] gps; [P01] dòng 56–57, 79 |
| 7 | Tay phát FlySky FS-i6X | AFHDS 2A, SwA–SwD (chỉ SwC 3 nấc), VrA/VrB | Điều khiển tay, đường an toàn | 1 | [PARTS] rc; [HW] |
| 8 | Bộ thu FlySky FS-iA6B | i-BUS; 4,0–8,4 V; 47×26,2×15 mm, 14,9 g, 2 anten; FC đọc 14 kênh | Nhận RC | 1 | [PARTS] rx; [HW] |
| 9 | Benewake TFmini Plus (fw v1.7.0) | LiDAR ToF; 5 V ±0,5 V, ≤110 mA (đỉnh 140 mA); tầm 0,1–12 m (vật sáng), 0,1–4 m (vật tối); chùm 3,6°; 35×18,5×21 mm, 12 g; ~100 khung/s, đơn vị cm | Tránh vật cản phía trước | 1 | [PARTS] tfmini; [HW] |
| 10 | ESP32 DevKit CP2102 (ESP32-D0WD-V3, flash 4 MB, 30 chân) | DroneBridge v2.4.1; UART 115200 (TX GPIO17, RX GPIO16); Wi-Fi STA vào `IOTCV-HOTSPOT`, UDP 14550 | Cầu MAVLink Wi-Fi | 1 | [HW]; [PARTS] esp32 |
| 11 | Camera ESP32-S3 N16R8 + OV3660 | Flash 16 MB QIO, PSRAM 8 MB octal; OV3660 3 MP (tối đa 2048×1536); bo 57,2×28,1 mm, 12,3 g; 2 USB-C (USB-UART CH343P, USB-OTG); XCLK 10 MHz; stream VGA MJPEG `:81/stream` | Camera Wi-Fi cho AI | 1 | [HW]; [PARTS] cam |
| 12 | UBEC 5V 3A | Vào thẳng pin 4S, ra 5 V tới 3 A | Nguồn riêng cho 2 bo ESP32 | 1 | [HW]; [PARTS] ubec |
| 13 | Pin Ovonic LiPo 4S 5300 mAh 110C | XT60; 423 g; 16,8 V đầy / 14,8 V danh định / storage 15,2–15,4 V | Nguồn chính | 1 | [PARTS] bat; [BC] 3.1 |
| 14 | Còi active (hộp stack) | nối pad B+/B− | Báo arm, pin yếu, tìm drone | 1 | [PARTS] deluxe; [CAB] buzzer |
| 15 | Tụ 1500 µF 35 V | hàn song song pad nguồn ESC (thay tụ 1000 µF trong hộp) | Hấp thụ xung điện áp | 1 | [HW]; [HC1025] dòng 150 |
| 16 | Phụ kiện lắp | bát chống rung 30,5×30,5; dây silicone 16AWG 3 màu ~4,5 m; gen co 2–10 mm; dây rút 2,5×100; băng keo xốp VHB; velcro + dây đai pin; bảng chia nguồn (hộp stack) | Cơ khí, nối dây | 1 bộ | [PARTS] acc; [P13] dòng 63–66 |

Phụ trợ trên bàn, không bay: mạch USB-TTL CP2102 (đọc TFmini trên máy tính) [HW]; sạc SkyRC iMAX B6AC V2 [HW].

Ghi chú tên bản stack: [HW] ghi bản **"Model Aircraft"**; [ARC] dòng 25, [BC] mục 3.1 và hướng dẫn lắp ráp ghi **"Deluxe"** (24 món, có smoke stopper). Chỉ ghi "SpeedyBee F405 V5 OX32 55A" trên slide cho an toàn.

### Giá / nơi mua
- Tổng phần cứng bay đợt 1 (khung, stack, motor + cánh, GPS, RC, pin, sạc): **9.661.000 ₫** ([ARC] dòng 15, 1371; [BC] mục 3.1).
- Phụ kiện lắp ráp ước ~280.000 ₫ ([ARC] dòng 42); giá từng món là **ước** trong [P13] dòng 63–69: bát chống rung 50.000–150.000 ₫; dây 16AWG ~150.000 ₫; gen co ~50.000 ₫; dây rút ~30.000 ₫; UBEC ~80.000 ₫; ESP32 DevKit ~120.000 ₫; USB-TTL ~30.000 ₫.
- Bo camera ESP32-S3: shop Phúc Minh Tech ([HW] dòng 92). Giá CHƯA CÓ NGUỒN.
- Giá từng món của đợt 1, TFmini Plus, camera: CHƯA CÓ NGUỒN. Tổng chi cuối: CHƯA CÓ NGUỒN (chỉ có 9.661.000 ₫ + các số ước).

## 2. Sơ đồ khối: cái gì nối với cái gì

| Thiết bị | Cổng FC / pad | Giao thức, tham số | Điện | Nguồn |
|---|---|---|---|---|
| ESP32 DroneBridge | SERIAL2 = pad T2/R2/G (mặt trên, mép trước); T2→RX2 GPIO16, R2←TX2 GPIO17 | MAVLink2, `SERIAL2_PROTOCOL 2`, `SERIAL2_BAUD 115` (115200); UART2 là cổng duy nhất có DMA | 5V từ UBEC (VIN) | [CAB] espuart; [P01] dòng 44–48 |
| TFmini Plus | SERIAL3 = pad R3 (dây xanh TXD), T3 (dây trắng RXD); 5V/G cụm LED1 | `SERIAL3_PROTOCOL 9`, 115200; `RNGFND1_TYPE 20`, `RNGFND1_ORIENT 0` (nhìn trước), dải 0,1–6 m | 5V của FC (không phải 9V) | [CAB] tfmini; [P02] dòng 60–67 |
| GPS M10 | SERIAL4 = cổng GPS 6P (mặt dưới, mép trước): TX→R4, RX→T4, SCL/SDA→CL/DA | `SERIAL4_PROTOCOL 5`, 230400 | 4V5 của FC | [CAB] gps; [P01] dòng 56–57 |
| ESC telemetry | SERIAL5 qua cáp 10 chân | `SERIAL5_PROTOCOL 16` | | [P01] dòng 64 |
| Receiver iA6B | SERIAL6 = cổng receiver 4P (R6) | i-BUS, `SERIAL6_PROTOCOL 23`, `RC_PROTOCOLS 4` | 4V5 của FC | [CAB] rx; [P01] dòng 67, 74 |
| ESC ↔ FC | cáp SH1.0 10 chân (V, G, C, T, M1–M4) | tín hiệu motor DShot300, đo dòng, áp pin nuôi FC | VBAT | [CAB] stack |
| Còi | pad B+/B− | | | [CAB] buzzer |
| Camera ESP32-S3 | không nối FC | Wi-Fi HTTP MJPEG `iotcv-camera.mshome.net:81/stream` | 5V từ UBEC | [PARTS] cam; [HW] |
| Laptop | USB-C FC = COM6 (bàn); bay: hotspot `IOTCV-HOTSPOT` 2,4 GHz, laptop 192.168.137.1 | MAVLink UDP 14550, video HTTP :81 | | [CAB] usbfc, wifi; [HW] |
| SERIAL1 | Bluetooth nội bộ, ArduPilot không dùng (`SERIAL1_PROTOCOL -1`) | | | [P01] dòng 41–42 |

- Đánh số motor ESC kiểu Betaflight: M1 sau-phải, M2 trước-phải, M3 sau-trái, M4 trước-trái ([HW]). Trên FC: `FRAME_TYPE 1` + `SERVO1..4_FUNCTION 36/33/34/35`, tương đương `FRAME_TYPE 12` ([P01] dòng 26–34).
- Chiều quay: trước-phải + sau-trái CCW, trước-trái + sau-phải CW ([P01] dòng 23–24). Ren phải → vị trí CCW (M2, M3), ren trái → CW (M1, M4) ([PARTS] motor).
- Firmware: ArduCopter 4.7.1 custom build trên custom.ardupilot.org, board `speedybeef4v5`; ArduPilot có 410 feature, bản stock bật 110, bản dự án 54 feature (bật thêm Proximity, Proximity Rangefinder, OA Path Planner, Avoid AltHold, CrashCatcher, EKF3 Wind estimation; tắt OSD/MSP/VTX, CRSF/SBUS/PPM, NMEA) ([CB] dòng 1–30).
- Hai đường điều khiển: RC (FS-i6X → iA6B → FC, không qua phần mềm nhóm, ưu tiên cao nhất) và web (laptop → Wi-Fi UDP → ESP32 → UART2 → FC) ([BC] mục 2.3).

## 3. Phân phối nguồn

```
Pin 4S 5300 mAh ─XT60─► pad + / − của ESC (dây XT60 120 mm, 12–14 AWG)
   ├─ tụ 1500 µF 35 V song song pad nguồn
   ├─ ESC OX32 4in1 ─► 4 motor (dây pha nối dài 16AWG ~30 cm × 12)
   │      └─ cáp 10 chân ─► FC: BEC 5V (2,5 A) nuôi TFmini; 4V5 nuôi GPS + receiver
   └─ UBEC 5V 3A (hàn song song pad + / − ESC) ─► bảng chia nguồn ─► ESP32 DevKit (VIN) + camera ESP32-S3 (5V)
```
Nguồn: [CAB] bat, cap, ubecin, ubecout, esppwr, campwr, rx, gps, tfmini; [HW].

- BEC 5V của stack tối đa 2,5 A; tải của nó: GPS ~40 mA + iA6B ~50 mA + TFmini 110 mA (đỉnh 140) ≈ 200 mA ([P02] dòng 20–23).
- Lý do tách UBEC: Wi-Fi của hai bo ESP32 gây sụt áp; GND UBEC và FC chung qua pin ([PARTS] ubec). Tải thực tế của UBEC < 1 A ([PARTS] ubec).
- Thiết bị ngoài stack (GPS, TFmini, 2 ESP32) tổng < 10 W ([K1025] dòng 60–61).
- Pad 4V5 có điện cả khi chỉ cắm USB, ≤ 1 A chung ([HW]). GPS + la bàn chỉ có điện khi cắm pin ([HW]).
- Đo dòng: `BATT_MONITOR 4`, `BATT_VOLT_MULT 11.0`, `BATT_AMP_PERVLT 370.4`, `BATT_AMP_OFFSET 0.0071`, `BATT_CAPACITY 5300` ([P01] dòng 121–138).
- Ngưỡng pin 4S: `BATT_LOW_VOLT 14.0` → RTL, `BATT_CRT_VOLT 13.2` → LAND, `BATT_LOW_MAH 1060` ([P01] dòng 141–151; [PARTS] bat).
- Cỡ dây: 12–14 AWG pin→ESC (≥ 60 A); 16 AWG dây motor (~15 A/motor); 18–22 AWG UBEC/5V; 24–28 AWG tín hiệu ([CAB] gauges).

## 4. Khối lượng, kích thước, lực đẩy

| Mục | Số | Loại | Nguồn |
|---|---|---|---|
| Đường chéo motor-motor | 480 mm | hãng | [PARTS] frame |
| Khung + chân đáp | 782 g | hãng | [BC] 3.2 |
| 4 motor | 256 g (64 g × 4) | hãng | [BC] 3.2 |
| Pin | 423 g | hãng | [BC] 3.2 |
| AUW đầy đủ có camera | ≈ 1824 g | **ước tính** (nhiều dòng ước) | [BC] 3.2 |
| AUW với pin 4S | ~1,9 kg | ước | [K1025] dòng 60 |
| Lực đẩy 1 motor (4S, T1045, 16 V, ga 100 %) | 1332 g tại 9857 vòng/phút | bảng đo hãng | [BC] 3.2 |
| Trần lực đẩy theo cánh | 4 × 1200 = 4800 g | hãng | [BC] 3.2 |
| Tỉ số lực đẩy / khối lượng | 2,63 : 1 (trần cánh), 2,92 : 1 (trần motor) | tính từ số ước | [BC] 3.2 |
| Nhấc khỏi đất (bay trong nhà 4S) | cần ga ~41 %, lệnh motor ~50–55 % | đo log | [HC1025] dòng 71–72 |
| Dòng lúc treo | 11–12 A, sụt ~0,3 V | đo | [HW] hàng Pin; [K1115] mục 5 |
| Thời gian bay | 15–20 phút | **ước**, chưa đo | [HC1025] dòng 82–83 |

## 5. Kết quả kiểm phần cứng trên bàn (15/11/2026, không cánh)

Nguồn: [K1115] mục 1–4.
- Kết luận: không hỏng hóc; mọi phần kiểm được đều đạt.
- FC: firmware `V4.7.1 (dbe79216)`, lỗi nội bộ 0, CPU ≤ 40 %; 889 tham số.
- IMU |a| 998 mG, rung lúc đứng 0,01–0,07 m/s², clip 0. Baro 1010,2 hPa. La bàn 385–388 mG.
- 4 ESC + motor: 41 lần khởi động, 0 lần khựng; ở ga 30 % 4462–4514 vòng/phút, lệch ≤ 2,8 %; ESC 31–45 °C.
- Tay cầm: 4 cần 1000–2000 µs; failsafe tắt tay phát → CH3 911 µs, FC báo `Radio Failsafe` < 0,1 s.
- Bản đồ kênh: CH5 SwC Stabilize/AltHold/Loiter, CH6 SwD RTL, CH7 SwA WEB CONTROL, CH8 SwB ARM/DISARM, CH9 VrB Auto ([K1115] mục 3; [HW]).
- TFmini bám vật 10–260 cm, giữ ~1,1 m dao động ±2 cm; vùng mù gần 0–10 cm.
- Pin 15,20 V = 3,80 V/cell. ESP32 DroneBridge: FC trả `AUTOPILOT_VERSION` sau 0,21 s. Camera: 150/150 khung sạch, VGA 7,6 khung/s, RSSI −28 dBm.

## 6. Bố trí trên khung (hướng dẫn lắp ráp, Phase 18)

| Món | Vị trí | Nguồn |
|---|---|---|
| Stack FC + ESC | Tâm khung, trên bát chống rung 30,5×30,5; mũi tên FC chỉ mép trước (mép có cổng 10 chân, cổng GPS, pad T2/R2); ESC mặt "55A" quay lên | [STEPS2] F7; [PARTS] fc, esc |
| TFmini Plus | Mép trước tấm trên, 2 ốc M2 (lỗ cách 28 × 11,5 mm), ngẩng 2–3°, tia không vướng chân, cánh, GPS | [STEPS2] F12 |
| Camera ESP32-S3 | Mép trước, gần đường tâm dọc, chĩa xuống ~30°, đệm cao su nhỏ | [STEPS2] F13 |
| GPS M10 | Cột ở đuôi tấm trên, cao ≥ 8–10 cm, mũi tên cùng hướng FC, xa dây nguồn | [STEPS2] F10 |
| Receiver iA6B | Đuôi tấm trên, băng keo xốp; 2 anten vuông góc, cách dây nguồn ≥ 5 cm | [STEPS2] F11 |
| ESP32 DevKit + UBEC + bảng chia | Phía sau, tầng dưới; anten PCB ló ra ngoài khung | [STEPS2] F14 |
| Pin | Dưới tấm đế, velcro + dây đai qua khe; cân trọng tâm ±5° | [STEPS2] F15, F16 |
| Dây | Dây motor dọc mặt dưới cần, 3 dây rút/cần; dây tín hiệu đi tấm trên, xa dây motor | [STEPS2] F9 |

Lưu ý: [BC] mục 3.6 (bản thiết kế cũ) đặt camera dưới bụng nhìn thẳng xuống; hướng dẫn lắp ráp mới hơn ghi mép trước chĩa ~30°. Chưa có ảnh drone thật để xác nhận vị trí cuối.

## 7. Dụng cụ và vật tư lắp ráp

Nguồn: [TOOLS]; [ARC] dòng 34; [PARTS] deluxe.
- Mỏ hàn ≥ 60 W ([ARC] dòng 34): 330–350 °C pad nhỏ, 380–400 °C dây 16AWG và pad nguồn ([TOOLS] iron).
- Đồng hồ vạn năng (thông mạch, đo áp), bộ lục giác 1,5/2,0/2,5, keo khoá ren, túi chống cháy LiPo, kính bảo hộ, bình chữa cháy, kẹp chữ C.
- Bảng tập hàn + smoke stopper (Short-Circuit Protection Tool, chọn 1A lần cấp điện đầu) + bảng chia nguồn: đi kèm hộp stack.
- Gen co nhiệt, băng keo xốp VHB, dây rút, velcro, dây Dupont, header.
- Sạc SkyRC iMAX B6AC V2: 50 W, 1–6 cell, có Battery Meter đo từng cell; chế độ Balance (sạc tới 4,20 V/cell), Storage, Battery Meter; dòng sạc ≤ 1C = 5,3 A, máy 50 W tối đa ~3 A ở 4S ([PARTS] charger; [BC] 3.1; [STEPS2] G11). Phần mềm Charge Master trên laptop (`docs/huong-dan/sac-pin/`).
- Mạch USB-TTL CP2102: thử TFmini trên bàn trước khi hàn ([CAB] tfbench).

## 8. Trình tự lắp ráp (7 chặng, 76 bước)

Nguồn: [STEPS] + [STEPS2]; trang `docs/huong-dan/lap-rap-phan-cung.html`.

| Chặng | Phase | Nội dung chính | Bước |
|---|---|---|---|
| A. Chuẩn bị | 13 | dọn chỗ làm, đối chiếu dụng cụ, tập hàn trên bảng tập, 6 luật an toàn | A1–A4 |
| B. Kiểm hàng | 14.1 | chụp ảnh, đếm 24 món hộp stack, soi motor, chia ren 2 + 2, đo từng cell pin bằng B6AC | B1–B9 |
| C. Bàn: RC + GPS (chỉ USB) | 15 | cáp receiver → R6, bind FS-i6X, gán kênh, failsafe 2 lớp, cáp GPS 6 chân, hàn còi | C1–C9 |
| D. Bàn: nguồn + motor + ESC (có pin, không cánh) | 16 | 12 dây motor vào ESC, hàn XT60 + tụ + dây UBEC, chồng stack, đo thông mạch, cấp pin qua smoke stopper, Motor Test, DShot300 | D1–D14 |
| E. Bàn: ESP32 + TFmini + camera + web | 17 | hotspot, bảng chia nguồn UBEC, ESP32 vào SERIAL2, telemetry Wi-Fi, TFmini thử USB-TTL rồi hàn R3/T3, nguồn camera, kiểm 10 phút toàn chuỗi | E1–E11 |
| F. Lắp khung S500 (không pin, không cánh) | 18 | 4 cần, chân đáp, motor đúng ren, bát chống rung + stack, nối dài 12 mối dây motor (3–4 giờ), đi dây, gắn GPS, receiver, TFmini, camera, ESP32, pin, cân CG | F1–F18 |
| G. Hiệu chỉnh trên khung + cánh | 19 | accel 6 tư thế + level, la bàn ngoài trời, radio, chiều quay không cánh, failsafe, ngưỡng pin + geofence, arm thử, gắn cánh, walk-around | G1–G11 |

Phân công tay/máy: người làm hàn, cắm cáp, lắp khung, đo đồng hồ; mọi việc trên laptop (nạp firmware, tham số, đọc trạng thái) do agent chạy (`AGENTS.md` mục "Lắp ráp phần cứng").

## Ảnh dùng được

Ảnh thật (chụp bằng điện thoại):
- `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg`: bo camera ESP32-S3 N16R8 mặt trên, thấy module OV3660, 2 cổng USB-C, nhãn chân (đã mở xem). Tốt nhất cho slide camera; có tem bảo hành của shop.
- `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8498.jpg`: bo camera mặt dưới (nhãn USB-UART/USB-OTG, khe microSD) (theo [PARTS] cam `real_s3_bot`).
- `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\vn-11134207-81ztc-mri3720uwpohe8.jpg`: ảnh shop, kích thước bo (theo [PARTS] `s3_dims`). 4 ảnh `vn-11134207-*` còn lại cũng là ảnh shop.
- `D:\Coding\IOT-CV\picture\FC-speedybee-f405-v5\IMG_8456.HEIC`: FC thật mặt trên; `IMG_8458.HEIC` mặt dưới; `IMG_8462.HEIC` cạnh bên; IMG_8457/8459/8460/8461/8463 thêm góc chụp FC. Định dạng HEIC, cần đổi sang JPG trước khi chèn (chưa mở xem được).
- `D:\Coding\IOT-CV\picture\esp32-cp210-m\IMG_8453.HEIC`: ESP32 DevKit CP2102 thật; `IMG_8455.HEIC` nhãn chân; `IMG_8454.HEIC` góc khác. HEIC.
- `D:\Coding\IOT-CV\logs\camera\kiem-20261115.jpg`: khung VGA thật từ camera OV3660 lúc kiểm 15/11 (đã mở xem: ảnh trong phòng, chất lượng thấp, hợp minh hoạ "ảnh camera thật").
- `D:\Coding\IOT-CV\logs\kiem-hang\esp32s3-ov3660-khung-thu-1.jpg`: khung chụp đầu tiên của OV3660 (13/10).

Ảnh chính hãng (sạch, dùng được):
- `D:\Coding\IOT-CV\assignment\_build\img\official\speedybee\prod_1.jpg` stack; `prod_6.jpg`/`prod_7.jpg` ESC trên/dưới; `v5_23.jpg` kích thước; `v5_24.jpg` sơ đồ đấu dây; `v5_25.jpg` thứ tự motor; `v5_27.jpg`/`v5_28.jpg` bố trí pad FC/ESC; `v5_29.jpg` 24 món trong hộp.
- `D:\Coding\IOT-CV\assignment\_build\img\official\holybro\s500_3.jpg` khung S500 lắp xong; `s500_5.jpg` các phần khung; `s500_4.jpg` cạnh bên; `m10v1_pinout.jpg` chân GPS M10.
- `D:\Coding\IOT-CV\assignment\_build\img\official\tmotor\tm_02.jpg` motor; `tm_03.jpg` cánh; `tm_09.jpg` bản vẽ kích thước.
- `D:\Coding\IOT-CV\assignment\_build\img\official\flysky\fs_2.png` FS-i6X; `ia6b_overview.png` cổng iA6B.
- `D:\Coding\IOT-CV\assignment\_build\img\official\benewake\tfminiplus_product.png` TFmini Plus; `tfp-007.png` lỗ bắt.
- `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\m_01_12_quad_x_bf.png` sơ đồ Quad X kiểu Betaflight; `MOTORS_CW_CCWLegend.jpg` chú giải chiều cánh.
- `D:\Coding\IOT-CV\docs\huong-dan\sac-pin\src\images\charger-master-charge.webp` (+ `-program`, `-system`): màn hình Charge Master sạc B6AC.

Có điều kiện, phải sửa trước khi dùng (vướng luật BRIEF):
- `D:\Coding\IOT-CV\assignment\_build\out\f5_daydien.png`: sơ đồ đấu dây đầy đủ (FC, ESC, GPS, iA6B, TFmini, ESP32, UBEC, PDB, màu dây) rất hợp slide, nhưng có khối **ESP32-CAM (OV2640)** và ghi TFmini RXD "để trống" (nay dây trắng đã vào T3). Phải vẽ lại hoặc che.
- `D:\Coding\IOT-CV\assignment\_build\out\f5_botri.png`: sơ đồ bố trí nhìn từ trên (stack, LiDAR mũi, GPS đuôi, M1–M4, chiều quay), chú thích số 6 ghi ESP32-CAM và 2 UBEC. Phải sửa chú thích.
- `D:\Coding\IOT-CV\assignment\_build\img\collage\collage_linhkien.png`: ghép 8 linh kiện, ô cuối là ESP32-CAM. Cắt bỏ ô đó (hoặc dùng `collage/stack.png`, `motors.png`, `s500.png`).
- `D:\Coding\IOT-CV\assignment\_build\img\parts\esp32cam.png`: KHÔNG dùng.

Không có trên đĩa: ảnh chụp drone đã lắp hoàn chỉnh (thư mục `docs/so-tay/anh/18/` theo bước F18 không tồn tại; sổ tay 13–22 "chưa viết"). Phạm vi đã quét: `picture/**`, `assignment/_build/**`, `docs/**` ảnh, `logs/**`, `tmp/picture`, `plans/reports/*.png`, `D:\XLA\docs\nop-bai*` (chỉ có ảnh AI/web). Nên xin người dùng chụp drone thật, hoặc dùng ảnh chụp mô hình 3D trong `docs/huong-dan/lap-rap-phan-cung.html`.

## Số liệu thiếu nguồn

- Giá từng linh kiện đợt 1 (khung, stack, motor, GPS, RC, pin, sạc), TFmini Plus, camera ESP32-S3, UBEC thật: CHƯA CÓ NGUỒN (chỉ có tổng 9.661.000 ₫ và giá ước Phase 13). Nơi mua từng món: CHƯA CÓ NGUỒN (trừ camera: Phúc Minh Tech).
- Tổng chi cuối cùng của toàn dự án: CHƯA CÓ NGUỒN.
- Khối lượng cân thật (có / không pin): CHƯA CÓ NGUỒN; "Chưa cân drone" ([HC1025] dòng 151). `docs/do-dac/` không tồn tại.
- Lực đẩy đo trên cân: CHƯA CÓ NGUỒN (`plans/PROGRESS.md` dòng 992 còn mở).
- Thời gian bay đo thật: CHƯA CÓ NGUỒN (chỉ ước 15–20 phút).
- Kích thước tổng thể drone (cao, rộng gồm cánh): CHƯA CÓ NGUỒN.
- Điện áp đầu ra UBEC đo thật: CHƯA CÓ NGUỒN ([PARTS] ubec "chưa đo áp"); đường 5V của FC không đo được qua phần mềm ([K1115] mục 5).
- Dòng đỉnh UBEC / camera ESP32-S3 thực tế: CHƯA CÓ NGUỒN.
- Thông số thật của UBEC (hãng, dải vào): CHƯA CÓ NGUỒN; [BC] ghi "đầu vào 2–6S" là yêu cầu thiết kế.
- Vị trí gắn camera trên drone thật: chưa có ảnh xác nhận (xem mục 6).
