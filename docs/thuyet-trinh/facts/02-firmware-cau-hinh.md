# Facts 02: firmware, cài đặt, cấu hình, hiệu chỉnh, phần mềm PC

Trạng thái cuối, đọc ngày 26/11/2026. Mỗi số kèm đường dẫn nguồn (đường dẫn tương đối tính từ
`D:\Coding\IOT-CV`, trừ khi ghi ổ D khác). Nguồn chuẩn cho giá trị đang chạy trên FC là bản chụp
toàn bộ tham số mới nhất `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261115-kiem-phan-cung.param`
(889 tham số, `plans/reports/261115-kiem-phan-cung-that.md` mục 1); ký hiệu **[SNAP]** bên dưới là file đó.

---

## 1. ArduPilot custom build

| Mục | Giá trị | Nguồn |
|---|---|---|
| Firmware | ArduCopter **4.7.1 stable**, git `dbe792162d06cab66c3475fd5556bf7a120f119e` | `firmware/ardupilot/build-d450a747/NOTES.md` dòng 8 |
| Board target | `speedybeef4v5` (SpeedyBee F405 V5) | `firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml` dòng 44-46 |
| Nơi build | custom.ardupilot.org, kéo thả file yaml | yaml trên, dòng 3 |
| Mã bản build | `d450a747` | tên thư mục `firmware/ardupilot/build-d450a747/` |
| Số feature | **54** feature được chọn (ArduPilot có 410 feature chọn được; bản stock của bo bật 110) | yaml dòng 5-7, danh sách dòng 48-102 |
| Bật thêm so với stock (6) | `AC_AVOID_ALTHOLD`, `AC_OAPATHPLANNER`, `CRASHCATCHER`, `EKF3_WINDEST`, `PROXIMITY`, `PROXIMITY_RANGEFINDER` | yaml dòng 9-15; kiểm từng cờ trong `extra_hwdef.dat`: `NOTES.md` dòng 28-41 |
| Tắt bớt (62), lý do | OSD/MSP/VTX/Camera (không FPV), CRSF/GHST/SBUS/SRXL/PPM (chỉ giữ iBUS), telemetry FrSky/CRSF/Spektrum (telemetry đi MAVLink), NMEA GPS (M10 là u-blox), giữ 3 driver la bàn IST8310 + IST8308 + QMC5883L, bỏ HEXA/OCTA/TRI, Parachute, Rally, LandingGear, Airspeed, TF02/TF03 | yaml dòng 17-26 |
| Cờ biên dịch chứng minh | `HAL_PROXIMITY_ENABLED 1`, `AP_AVOIDANCE_ALTHOLD_ENABLED 1`, `AP_OAPATHPLANNER_ENABLED 1`, `AP_RANGEFINDER_BENEWAKE_TFMINIPLUS_ENABLED 1`, `AP_RCPROTOCOL_IBUS_ENABLED 1`, `AP_GPS_UBLOX_ENABLED 1`, `AP_FENCE_ENABLED 1` | `firmware/ardupilot/build-d450a747/extra_hwdef.dat` (khối `define ... 1`) |
| Vì sao custom | F405 chỉ có 1 MB flash; bản stock không có nhóm `PRX_*` (proximity), nên không dùng TFmini Plus làm cảm biến tránh vật cản được | yaml dòng 5-6; `firmware/ardupilot/params/02-avoid-tfmini.param` dòng 6-7 |
| Dung lượng firmware | `bin/arducopter` dùng **759.588 byte**, còn trống **239.820 byte** (≈ 234 KB) trong 999.424 byte | `NOTES.md` dòng 71-74 (trích cuối `build.log`) |
| File nạp lần đầu | `arducopter_with_bl.hex` 2.224.308 byte (ghi cả bootloader + firmware) | `NOTES.md` bảng "Bảy file" |
| File cập nhật sau | `arducopter.apj` 700.098 byte (qua Mission Planner) | như trên |
| Kiểm bản đúng sau nạp | Có `PRX1_TYPE`, `AVOID_ANG_MAX`, `SERVO_BLH_POLES` trong bảng tham số | `NOTES.md` mục "Kiểm chứng nhanh"; `docs/so-tay/14-hang-ve-nap-firmware.md` mục 1 |
| Banner trên bo | `ArduCopter V4.7.1 (dbe79216)` + `speedybeef4v5` | `docs/so-tay/14-hang-ve-nap-firmware.md` mục 1 |

Feature không bật, có lý do: i-BUS telemetry (hết UART), GyroFFT (F405 yếu, đã có notch theo RPM ESC), Lua
scripting (1 MB không đủ). Nguồn: yaml dòng 28-33.

## 2. Quy trình nạp firmware FC (chuỗi script)

Ba lệnh, chạy từ PowerShell ở gốc repo (`docs/so-tay/14-hang-ve-nap-firmware.md` mục 2):

```
uv run --with pyserial python scripts/fc/nap_dfu.py
uv run --with pyserial python scripts/fc/kiem_fc.py COM6 --nghieng 60 --luu-param firmware/ardupilot/params/00-after-flash.param
uv run --with pyserial python scripts/fc/nap_param.py COM6 firmware/ardupilot/params/01-base.param
```

| Bước | Script làm gì | Nguồn |
|---|---|---|
| 1 | Hỏi tên bo qua MSP; khác `SPEEDYBEEF405V5` thì từ chối | `docs/so-tay/14-hang-ve-nap-firmware.md` mục 2 bước 1 |
| 2 | Gửi `MSP_REBOOT` kiểu bootloader ROM: bo vào DFU, không cần giữ nút BOOT | như trên, bước 2; `scripts/fc/vao_dfu.py` |
| 3 | `STM32_Programmer_CLI -ob displ`: RDP phải `0xAA` (chip không khoá đọc) | bước 3; bo thật đọc RDP `0xAA` (mục 1) |
| 4 | Sao lưu 1 MB flash gốc ra ổ D, một lần: `factory-betaflight-4.5.2.bin`, 1.048.576 byte, đọc 7,2 s | bước 4; mục 1 |
| 5 | Ghi `arducopter_with_bl.hex` rồi đọc lại so từng byte: xoá sector 0-10, ghi 32,6 s, kiểm 5,6 s, `Download verified successfully` | bước 5; mục 1 |
| 6 | `-s 0x08000000` chạy chương trình (thay rút cắm cáp), đợi cổng USB `1209:5741` đứng yên 8 s | bước 6-7; `scripts/fc/nap_dfu.py` docstring |
| 7 | `kiem_fc.py`: đọc banner, cảm biến, hướng gyro (pitch tới −68°, roll tới +53°, đúng dấu), baro 1012,6 hPa, chụp 850 tham số | mục 1 |
| 8 | `nap_param.py`: nạp file `.param`, reboot bằng `MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN`, đọc lại từng dòng, tham số chỉ hiện sau reboot thì nạp nốt (tối đa 3 lần reboot) | `scripts/fc/nap_param.py` docstring |
| Kết quả | `01-base.param` **34/34 dòng nhận**, số tham số 850 → 861; bo thật từ chối 0 dòng | `docs/so-tay/14-hang-ve-nap-firmware.md` mục 1 |

Mã thoát `nap_dfu.py`: 1 = lỗi/cần bấm BOOT, 2 = sai bo, 3 = chip khoá đọc, 4 = cần rút cắm cáp
(`scripts/fc/nap_dfu.py` dòng 15-17). Cổng COM: FC ArduPilot = **COM6** (USB `1209:5741`), DroneBridge =
COM4 (CP2102), camera = COM7 (CH343P) (`docs/so-tay/14-hang-ve-nap-firmware.md` mục 1; `AGENTS.md`).

Ba file tham số trong repo: `00-after-flash.param` (852 dòng, bản chụp mặc định ngay sau nạp),
`01-base.param` (194 dòng), `02-avoid-tfmini.param` (123 dòng) (`wc -l firmware/ardupilot/params/*.param`).

## 3. Bản đồ cổng serial của FC

| Cổng | Pad / đầu nối | Thiết bị | `SERIALn_PROTOCOL` | Baud | Nguồn |
|---|---|---|---|---|---|
| SERIAL0 | USB-C | Mission Planner / script qua USB | MAVLink (mặc định) | 115200 (MP CONNECT COM6 115200) | `docs/so-tay/14-hang-ve-nap-firmware.md` mục 1 |
| SERIAL1 | (nội bộ) | Module Bluetooth của bo, ArduPilot không dùng | **−1** (None) | | `01-base.param` dòng 41-42 |
| SERIAL2 | T2/R2 (UART2, cổng duy nhất có DMA) | ESP32 DroneBridge | **2** (MAVLink2) | **115** = 115200 | `01-base.param` dòng 44-48 |
| SERIAL3 | T3/R3 | TFmini Plus | **9** (Rangefinder) | **115** = 115200 | `02-avoid-tfmini.param` dòng 59-61 |
| SERIAL4 | pad + cổng 6 chân phía trước | GPS Holybro M10 (u-blox) | **5** (GPS) | **230** = 230400 | `01-base.param` dòng 55-57 |
| SERIAL5 | (đi sang ESC qua cáp 8 chân) | ESC telemetry OX32 4in1 | **16** (ESC Telemetry) | firmware ép 115200 | `01-base.param` dòng 59-64 |
| SERIAL6 | pad R6 / cổng 4 chân phía sau | Receiver FlySky iA6B (iBUS) | **23** (RCIN) | | `01-base.param` dòng 66-67 |

Đấu dây DroneBridge: FC T2 → ESP32 GPIO16 (RX2), FC R2 → ESP32 GPIO17 (TX2), GND chung, ESP32 ăn 5 V từ UBEC
riêng (`firmware/dronebridge/README.md` mục (c)). TFmini Plus: xanh → R3, trắng → T3, đỏ/đen → 5V/G
(`docs/phan-cung-thuc-te.md` hàng TFmini). Receiver chỉ bật giao thức iBUS: `RC_PROTOCOLS 4` (bit 2)
(`01-base.param` dòng 69-74).

## 4. Nhóm tham số chính (giá trị đang chạy trên FC)

### 4.1 Khung và motor

| Tham số | Giá trị | Lý do | Nguồn |
|---|---|---|---|
| `FRAME_CLASS` | 1 (Quad) | Khung S500 | `01-base.param` dòng 33 |
| `FRAME_TYPE` + `SERVO1..4_FUNCTION` | **1** + **36 / 33 / 34 / 35** (Motor4/1/2/3) | Tương đương `FRAME_TYPE 12` (X kiểu Betaflight): ESC OX32 đánh số M1 sau-phải, M2 trước-phải, M3 sau-trái, M4 trước-trái. Đầu ra 1..4 = sau-phải / trước-phải / sau-trái / trước-trái | `01-base.param` dòng 17-38; [SNAP] `FRAME_TYPE,1`; `docs/phan-cung-thuc-te.md` hàng "Bo bay + ESC" |
| `MOT_PWM_TYPE` | 5 (DShot300) | Dung sai nhiễu tốt hơn DShot600 | `01-base.param` dòng 89-91; [SNAP] |
| `SERVO_BLH_POLES` | 14 | Số cực motor 2216 | `01-base.param` dòng 96 |
| `SERVO_BLH_TRATE` | 10 Hz | Tốc độ telemetry ESC | `01-base.param` dòng 98 |
| `MOT_SPIN_ARM` | 0,13 | Đo 25/10: motor tụt dưới 300 rpm trong 3 s đầu giảm từ 13/32 lần (0,10) xuống 2/28 lần; phải ≤ `MOT_SPIN_MIN` 0,15 | `01-base.param` dòng 99-107; `00-after-flash.param` dòng 479 |
| `TKOFF_RPM_MIN` / `TKOFF_RPM_MAX` | **1000 / 4000** vòng/phút | FC giữ motor ở vòng chờ tới khi cả 4 ESC báo trong khoảng; vòng chờ đo được 1850-1960 ở 15,5 V; 4000 chặn số rác telemetry | `01-base.param` dòng 108-117; [SNAP] |
| `MOT_BAT_VOLT_MAX` / `MIN` | 16,8 / 13,2 V | Bù điện áp pin 4S cho bộ điều khiển (4,2 và 3,3 V mỗi cell) | `01-base.param` dòng 145-149; [SNAP] |
| `ARMING_RUDDER` | 2 | Arm/disarm bằng cần vẫn dùng được | [SNAP]; `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 7 |

### 4.2 Pin (Ovonic 4S 5300 mAh)

| Tham số | Giá trị | Lý do | Nguồn |
|---|---|---|---|
| `BATT_MONITOR` | 4 (analog áp + dòng) | Mặc định bo | `01-base.param` dòng 121 |
| `BATT_VOLT_MULT` | 11,0 | Theo hwdef biên dịch vào firmware | `01-base.param` dòng 122-127; [SNAP] |
| `BATT_AMP_PERVLT` / `BATT_AMP_OFFSET` | **370,4 A/V** / 0,0071 V | Quy đổi từ thông số SpeedyBee `Scale=27, Offset=-2644`: 10000/27 = 370,4 | `01-base.param` dòng 128-136; [SNAP] |
| `BATT_CAPACITY` | 5300 mAh | Pin thật | `01-base.param` dòng 138 |
| `BATT_LOW_VOLT` | **14,0 V** (3,5 V/cell) | Cảnh báo 4S | `01-base.param` dòng 139-141 |
| `BATT_CRT_VOLT` | **13,2 V** (3,3 V/cell) | Nguy hiểm 4S | `01-base.param` dòng 142 |
| `BATT_LOW_MAH` | 1060 mAh (20 % của 5300) | Chừa 20 % cho tuổi thọ pin | `01-base.param` dòng 143-144 |
| `BATT_FS_LOW_ACT` | **2 (RTL)** | Dưới 14,0 V đủ 10 s → tự bay về | `01-base.param` dòng 150; `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 2 |
| `BATT_FS_CRT_ACT` | **1 (Land)** | Dưới 13,2 V hạ cánh tại chỗ | `01-base.param` dòng 151 |
| `BATT_ARM_VOLT` | 0 | | `01-base.param` dòng 152-154 |

### 4.3 Failsafe

| Tham số | Giá trị | Ý nghĩa | Nguồn |
|---|---|---|---|
| `FS_THR_ENABLE` | **1 (RTL)** | Mất sóng tay cầm → tự bay về | `01-base.param` dòng 159 |
| `FS_THR_VALUE` | 975 µs | Tay phát cài failsafe kênh 3 ở −118 % ≈ 911 µs, thấp hơn 975 | [SNAP]; `docs/phan-cung-thuc-te.md` hàng RC |
| `FS_EKF_ACTION` | 1 (Land) | EKF hỏng → hạ cánh | `01-base.param` dòng 160 |
| `FS_GCS_ENABLE` | **0** | Mất Wi-Fi/telemetry không kích RTL; tay cầm RC là đường lái chính | `01-base.param` dòng 161-164 |
| Thử thật | Tắt tay phát: CH3 rơi 911 < 975, FC báo `Radio Failsafe` trong < 0,5 s | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 6 bảng "Sau ba việc"; `plans/reports/261115-kiem-phan-cung-that.md` mục 1 |
| SITL 7 bài cố tình vượt lưới an toàn | 7/7 PASS (mất RC → RTL sau ~1,0 s; pin 13,76 V → RTL sau ~10 s; hạ cách home 0,1 m) | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 3; `scripts/sitl/run_ngoai_troi.py` |

### 4.4 Geofence, tốc độ, RTL

| Tham số | Giá trị | Ý nghĩa | Nguồn |
|---|---|---|---|
| `FENCE_ENABLE` | 1 | Bật rào (cần GPS mới ARM) | `02-avoid-tfmini.param` dòng 100 |
| `FENCE_TYPE` | 3 | Trần độ cao (bit 0) + vòng tròn quanh home (bit 1) | dòng 81-82, 101 |
| `FENCE_ALT_MAX` | **20 m** | Trần so với điểm cất cánh | dòng 102 |
| `FENCE_RADIUS` | **100 m** | Vòng quanh home | dòng 103; [SNAP] |
| `FENCE_MARGIN` | 2 m | Lái tay bị chặn leo ở 20 − 2 = 18 m | dòng 87-88, 104 |
| `FENCE_ACTION` | 1 (RTL; không GPS thì Land) | | dòng 105 |
| Lớp phủ ở backend (drone thật) | `MAX_ALT=18`, `MIN_ALT=2`, `MAX_DISTANCE_HOME=95` (cách rào 5 m) | `chay-drone-that.bat` (khối `set`) |
| `LOIT_SPEED_MS` / `WP_SPD` | **3 / 3 m/s** | Mặc định 12,5 / 10 m/s quá nhanh với người mới | `01-base.param` dòng 166-173 |
| `RTL_ALT_M` | 15 m | Thấp hơn trần 20 m trừ lề 2 m | `01-base.param` dòng 170-174 |
| `RTL_CONE_SLOPE` | 3 (mặc định) | | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 2 "Giữ nguyên"; `00-after-flash.param` dòng 682 |

### 4.5 Rangefinder và tránh vật cản (TFmini Plus)

| Tham số | Giá trị | Ý nghĩa | Nguồn |
|---|---|---|---|
| `RNGFND1_TYPE` | **20** (Benewake TFmini Plus UART) | | `02-avoid-tfmini.param` dòng 64; [SNAP] |
| `RNGFND1_ORIENT` | 0 (nhìn thẳng trước) | | dòng 65 |
| `RNGFND1_MIN` / `MAX` | 0,1 / 6 m | | dòng 66-67 |
| `PRX1_TYPE` | **4** (dùng rangefinder làm proximity) | Chỉ có trên bản custom | dòng 70; [SNAP] |
| `AVOID_ENABLE` | 3 (bit 0 fence + bit 1 proximity theo ArduPilot; file ghi bit dùng cho TFmini) | | dòng 72-73, 106; [SNAP] |
| `AVOID_BEHAVE` | 1 | Dừng ở lề khi bay Loiter/PosHold | dòng 107 |
| `AVOID_MARGIN` | **2 m** | Loiter/PosHold dừng cách vật 2 m | dòng 108 |
| `AVOID_DIST_MAX` | **5 m** | AltHold bắt đầu nghiêng lùi khi vật gần hơn 5 m | dòng 112 |
| `AVOID_ANG_MAX` | 10° | Góc nghiêng lùi tối đa ở AltHold | dòng 113 |
| `AVOID_BACKUP_SPD` / `AVOID_BACKUP_DZ` / `AVOID_ACCEL_MAX` | 0,75 m/s / 0,10 / 3 | | dòng 109-111 |
| `OA_TYPE` | 0 | AUTO không tự tránh (chỉ một tia 3,6° nhìn thẳng) | dòng 115-123 |
| Chế độ có tránh | Loiter, PosHold, AltHold, Guided vận tốc từ web; Stabilize và AUTO không tránh | dòng 74-77, 115-123; `AGENTS.md` mục TFmini |
| Cảm biến sau cấu hình | ~100 khung/s, đơn vị cm; đo vật ~1 m ra 98-104 cm | `docs/phan-cung-thuc-te.md` hàng TFmini |
| Kiểm 15/11 | bám vật từ 10 tới 260 cm, giữ ở ~1,1 m dao động ±2 cm | `plans/reports/261115-kiem-phan-cung-that.md` mục 1 |
| SITL rào 50 m | Loiter ga hết cỡ dừng ở 18,1 m; Loiter tiến hết cỡ dừng ở 48,1 m | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 3 S2, S4 |

### 4.6 Log

| Tham số | Giá trị | Ý nghĩa | Nguồn |
|---|---|---|---|
| `LOG_BITMASK` | 176126 | | `01-base.param` dòng 184 |
| `LOG_DISARMED` | 0 | Chỉ ghi khi ARM | dòng 176-185 |
| `LOG_FILE_DSRMROT` | 1 | Mỗi chuyến (ARM → DISARM) một file log | dòng 186-189 |
| `EK3_LOG_LEVEL` | 1 | Chỉ ghi XKF4 của EKF3; dataflash 16 MB chứa ~20 phút bay | dòng 190-194 |

## 5. Chế độ bay và bản đồ tay cầm FS-i6X

Nguồn giá trị: [SNAP]; chức năng công tắc: `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 7,
kiểm lại 15/11 (`plans/reports/261115-kiem-phan-cung-that.md` mục 1).

| Công tắc | Kênh | Tham số | Chức năng |
|---|---|---|---|
| SwC (3 nấc) | CH5 | `FLTMODE_CH 5`; `FLTMODE1 0`, `FLTMODE4 2`, `FLTMODE6 5` | lên = Stabilize, giữa = AltHold, xuống = Loiter |
| SwD (2 nấc) | CH6 | `RC6_OPTION 4` | xuống = RTL |
| SwA (2 nấc) | CH7 | `RC7_OPTION 0` | WEB CONTROL ENABLE (backend đọc, FC bỏ qua) |
| SwB (2 nấc) | CH8 | `RC8_OPTION 153` | ARM/DISARM: xuống = ARM, lên = DISARM |
| Núm VrB | CH9 | `RC9_OPTION 16` | xoay qua ~1.800 µs = Auto, lùi lại = về chế độ của SwC (đo: qua 1.831 vào AUTO, xuống 1.779 về STABILIZE) |
| VrA | | | không dùng |
| | CH10 | `RC10_OPTION 0` | None |

Receiver iA6B qua iBUS, FC đọc 14 kênh (`docs/phan-cung-thuc-te.md` hàng RC).

## 6. Hiệu chỉnh đã làm và giá trị kết quả

Người dùng bấm trong Mission Planner, agent đọc tham số kiểm lại (`AGENTS.md` mục "Bẫy đã gặp").

| Hiệu chỉnh | Giá trị kết quả đang chạy | Chất lượng | Nguồn |
|---|---|---|---|
| Accel 6 mặt | `INS_ACCOFFS_X/Y/Z` 0,0065 / 0,0560 / 0,0545; `INS_ACCSCAL_X/Y/Z` 1,0013 / 1,0035 / 1,0002 | Scale lệch ≤ 0,35 % | [SNAP]; `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 2 |
| Calibrate Level | `AHRS_TRIM_X` 0,0449 rad (2,57°), `AHRS_TRIM_Y` −0,0146 rad (−0,84°) | Drone nằm yên đọc pitch −0,11°, roll +0,12° (22 mẫu, độ lệch chuẩn ≤ 0,03°) | [SNAP]; `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 6 |
| La bàn ngoài trời (IST8310, `COMPASS_DEV_ID` 658945) | `COMPASS_OFS_X/Y/Z` 35,1 / 23,0 / 52,7 (độ lớn 67; FC chặn arm khi > 1800); `COMPASS_DIA` 0,997 / 1,003 / 1,037; **`COMPASS_SCALE` 1,005**; `COMPASS_ORIENT 6` | Từ trường khớp mô hình WMM trong 0,5 %; EKF `compass_variance` ≤ 0,002 (54 mẫu); 450-454 mGauss; `COMPASS_DEC` −1,9° tự tính | [SNAP]; `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 8 |
| Radio | RC1/2/4: 1000 / 1500 / 2000; RC3: 1006 / 1009 / 2000 | `RC3_MIN` 1006 > `FS_THR_VALUE` + 10 = 985 | [SNAP]; `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 6 |
| ESC OX32 (firmware ESC 1.13), cấu hình qua `ox32.oxbot.com` | `MOTOR_TIMING` 20, `DRIVER_DEMAG_COMPENSATION` 2 (High), `DRIVER_RAMP_POWER` 80, `PROTECTION_LOW_SPEED_POWER` 2 (On Adaptive) | Cho motor KV thấp + cánh 10" | `firmware/esc-ox32/README.md`; file `firmware/esc-ox32/ox32-esc-moi-20261025.json` |
| Kiểm ESC + motor sau hiệu chỉnh (không cánh) | 41 lần khởi động, 0 lần khựng; bắt vòng 0,05-0,16 s; vòng quay 4 motor lệch nhau ≤ 2,8 %; M1 ở 13 % ga: 2098-2100 rpm, ở 30 %: 4514 rpm | | `plans/reports/261115-kiem-phan-cung-that.md` mục 1-2 |
| GPS (kiểm ngoài trời) | fix 4, 18 vệ tinh, HDOP 0,65 | | `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 8 |
| IMU / baro (kiểm 15/11) | \|a\| 998 mG; gyro ồn 0,6-4,9 mrad/s; rung đứng yên 0,01-0,07 m/s², clip 0; baro 1010,2 hPa ồn 0,2-0,3 Pa | | `plans/reports/261115-kiem-phan-cung-that.md` mục 1 |
| FC | tải CPU ≤ 40 %, RAM trống 49-54 KB, lỗi nội bộ 0 | | như trên |

## 7. ESP32 DroneBridge (cầu MAVLink Wi-Fi)

| Mục | Giá trị | Nguồn |
|---|---|---|
| Bo | ESP32 DevKit 30 chân, ESP32-D0WD-V3 rev 3.1, flash 4 MB, USB-UART CP2102, COM4 | `firmware/dronebridge/README.md` mục "Board và trạng thái" |
| Firmware | **DroneBridge for ESP32 2.4.1 (stable)**, phát hành 12/09/2026 | như trên; mục (a) |
| Vì sao không tự viết | Firmware có sẵn, ArduPilot ghi trong tài liệu chính thức, có web UI, tự lo reconnect/buffer/UDP | README mục "Vì sao không tự viết" |
| Nạp | `esptool --chip esp32 -p COM4 -b 115200 write-flash --flash-mode dio --flash-size 2MB --flash-freq 40m 0x1000 bootloader.bin 0x8000 partition-table.bin 0x10000 db_esp32.bin 0x190000 www.bin` (~1,5 phút). **Chỉ 115200 baud** | README mục (a) |
| Cấu hình | Ghi thẳng phân vùng NVS (`0x9000`, dài `0x6000`) qua USB bằng `scripts/esp32/dronebridge-nvs.ps1`; script tự đọc SSID/mật khẩu hotspot của Windows, không lưu vào git | README mục (b) |
| Chế độ Wi-Fi | STA (`esp32_mode 2`), nối Mobile Hotspot 2,4 GHz của laptop, kênh 6 | `firmware/dronebridge/db_params.iotcv.csv`; README mục (b) |
| Tên mạng | `DroneBridgeESP32.mshome.net` (IP DHCP) | README; `db_params.iotcv.csv` `wifi_hostname` |
| UART | TX GPIO17, RX GPIO16, **115200**, giao thức MAVLink (`proto 4`), gói 576 byte, timeout 20 ms | `db_params.iotcv.csv` |
| Đích UDP | `192.168.137.1:14550` (laptop trên hotspot), bo tự đẩy gói | `db_params.iotcv.csv` `udp_client_ip`, `udp_client_port` |
| Bo phát HEARTBEAT riêng | sys 1, comp 68, `autopilot` INVALID, 1 Hz; backend bỏ mọi HEARTBEAT `MAV_AUTOPILOT_INVALID` | README mục "Board và trạng thái"; `AGENTS.md` |
| `MAVLINK_UDP_HELLO` (backend) | `DroneBridgeESP32.mshome.net:14550`, mỗi 2 s gửi HEARTBEAT kiểu GCS (sysid 254) khi nghe `udpin:` để bo thêm laptop vào danh sách client; bo phản hồi sau 0,27 s; để trống là tắt | `backend/config.py` dòng 90-97; `.env.example` dòng 34-36 |
| Backend nghe | `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550` | `chay-drone-that.bat` |
| Tường lửa | mở UDP 14550 bằng `scripts/esp32/firewall-mavlink.ps1` | đầu file script |
| Kiểm 15/11 | MAVLink 2 chiều: laptop hỏi `AUTOPILOT_VERSION`, FC trả sau 0,21 s | `plans/reports/261115-kiem-phan-cung-that.md` mục 1 |

## 8. Camera ESP32-S3 N16R8 + OV3660

| Mục | Giá trị | Nguồn |
|---|---|---|
| Bo | ESP32-S3 N16R8 (flash 16 MB QIO, PSRAM 8 MB octal), module OV3660 3 MP (PID `0x3660`), cổng USB-UART CH343P (COM7) | `docs/phan-cung-thuc-te.md` mục camera |
| Project | PlatformIO, env **`esp32s3_n16r8`**, framework Arduino, `board = esp32-s3-devkitc-1`, `memory_type = qio_opi`, bảng phân vùng `default_16MB.csv` | `firmware/camera/platformio.ini` |
| Build flags | `-DCAMERA_MODEL_ESP32S3_EYE -DBOARD_HAS_PSRAM` (bảng chân ESP32S3_EYE: XCLK 15, SIOD 4, SIOC 5, VSYNC 6, HREF 7, PCLK 13) | `platformio.ini`; `docs/phan-cung-thuc-te.md` |
| Toolchain đã build | espressif32 7.1.3 + Arduino core 2.0.17 | `docs/phan-cung-thuc-te.md` mục camera |
| XCLK | **10 MHz** (`XCLK_FREQ_HZ = 10000000`) | `firmware/camera/src/main.cpp` dòng 33 |
| Vì sao 10 MHz | ở 20 MHz Wi-Fi của chính bo tụt ~295 → ~60 KB/s, có khung JPEG hỏng | `docs/phan-cung-thuc-te.md` mục camera; `docs/test-log.md` mục Phase 12 |
| Độ phân giải | **VGA 640×480** (`FRAME_SIZE_DEFAULT FRAMESIZE_VGA`) | `firmware/camera/include/secrets.example.h` dòng 13 |
| JPEG quality | mặc định **12** (khoảng 0-63, đổi lúc chạy bằng `/set?quality=N`) | `secrets.example.h` dòng 12; `main.cpp` dòng 22-23 |
| Frame buffer | 2 khung trong PSRAM, `CAMERA_GRAB_LATEST` | `main.cpp` dòng 24; `docs/phan-cung-thuc-te.md` |
| Cổng | `/stream` MJPEG cổng **81**; `/status`, `/set`, `POST /update` cổng 80 | `firmware/camera/README.md` bảng "Nó làm gì"; `secrets.example.h` dòng 16-19 |
| `/status` trả | `quality`, `framesize`, `rssi`, `uptime_ms`, `frames_sent`, `camera` (OK/FAIL/OTA), `sensor_pid`, `stream_clients`, `stream_port`, `free_psram`, `firmware_sha`, `partition` | `firmware/camera/README.md` |
| Tên mạng | `iotcv-camera.mshome.net`, STA vào hotspot laptop | `secrets.example.h` dòng 14; README |
| Nạp USB | `scripts\esp32\nap_camera.ps1` (sinh `secrets.h`, tìm cổng CH343P theo VID `1A86` PID `55D3`, build, nạp, đọc log tới khi có IP) | `firmware/camera/README.md` mục "Nạp, một lệnh" |
| OTA qua Wi-Fi | `nap_camera.ps1 -Ota`: gửi `firmware.bin` tới `POST /update` kèm token + MD5, ghi khe `app0` ↔ `app1`, kiểm `firmware_sha` sau khởi động; 793 KB gửi ~6,5 s, chạy lại ~9 s | README mục "Nạp qua Wi-Fi (OTA)" |
| Tự hạ chất lượng (backend) | dưới 4 khung/s thì tăng số quality thêm 7, tối đa 40; trên 6,5 khung/s liền 10 s thì giảm, tối thiểu 12; tắt bằng `CAMERA_AUTO_QUALITY=0` | README; `backend/config.py` dòng 306 |
| Cỡ khung VGA theo quality | 12 → 15,2 KB; 26 → 11,0; 40 → 9,5; 50 → 8,9 KB | `firmware/camera/README.md` |
| Kiểm 15/11 | `camera_check.py --frames 150`: 150/150 khung sạch, **VGA 7,6 khung/s**, RSSI −28 dBm, PSRAM trống 8,2 MB | `plans/reports/261115-kiem-phan-cung-that.md` mục 1 |
| Backend đọc | `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`, `CAMERA_FAKE=0` | `chay-drone-that.bat` |

## 9. Phần mềm trên PC

Phiên bản đo ngày 21/09/2026 trừ chỗ ghi khác (`plans/PROGRESS.md` dòng 54).

| Phần mềm | Phiên bản ghi nhận | Vai trò trong dự án | Nguồn |
|---|---|---|---|
| Mission Planner | 1.3.83 (build 1.3.9384.38258) | Hiệu chỉnh accel/level/la bàn/radio, Motor Test (người vận hành bấm), đọc mission, xem tlog | `plans/PROGRESS.md` dòng 54; `docs/so-tay/14-hang-ve-nap-firmware.md` mục 1 |
| STM32CubeProgrammer (`STM32_Programmer_CLI`) | 2.23.0 | Nạp ArduPilot qua DFU, sao lưu/đọc lại flash | `plans/PROGRESS.md` dòng 54; `scripts/fc/nap_dfu.py` (`D:\IOT_Tools\apps\STM32CubeProgrammer\bin`) |
| MAVProxy | 1.8.74 | Giữ COM6 và chia ra UDP 14551 (Mission Planner) + 14552 (`kiem_phan_cung.py --ghi`); console SITL | `plans/PROGRESS.md` dòng 54, 184; `AGENTS.md` mục "Kiểm toàn bộ phần cứng" |
| pymavlink | 2.4.49 (Phase 00); 2.4.50 lúc kiểm 01/11 | Thư viện MAVLink của backend và mọi script | `plans/PROGRESS.md` dòng 54; `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 6 |
| PlatformIO Core + VS Code extension | 6.2.0; VS Code 1.138.0 | Build/nạp firmware camera | `plans/PROGRESS.md` dòng 54 |
| esptool | v5.4.0 | Nạp DroneBridge, đọc/sao lưu flash ESP32 | như trên |
| WSL2 Ubuntu | 24.04.4 LTS | Chạy ArduCopter SITL build từ mã nguồn cùng commit `dbe79216` | `plans/PROGRESS.md` dòng 54; `firmware/ardupilot/build-d450a747/NOTES.md` mục "Param SITL" |
| ArduPilot SITL | ArduCopter 4.7.1 | Drone ảo nghiệm thu param, mission, failsafe, backend | `NOTES.md` mục "Param SITL" |
| Python | 3.13.7 | Backend FastAPI, script | `plans/PROGRESS.md` dòng 54 |
| uv | 0.12.12 | Quản lý môi trường Python (`uv run ...`), cache ở `D:\DevCache` | như trên |
| Node.js / pnpm | v24.13.0 / 11.10.0 | Build web GCS (Vite + React) | như trên |
| Thư viện web | react 19.3.0, vite 8.3.0, typescript 6.0.3, tailwindcss 4.3.3, leaflet 1.9.4, zustand 5.0.15 | Web GCS | `plans/PROGRESS.md` dòng 100 |
| Docker Engine | 29.6.2 | Có cài | `plans/PROGRESS.md` dòng 54 |
| Chrome | CHƯA CÓ NGUỒN (phiên bản) | Mở web GCS (`localhost:5173`), trình cấu hình ESC `ox32.oxbot.com` (WebSerial), đo headless bằng Playwright | `firmware/esc-ox32/README.md` bước 3; `AGENTS.md` mục Web |
| cua-driver (MCP) | 0.28.2 lúc chọn (21/09/2026) | Điều khiển GUI Mission Planner, STM32CubeProgrammer từ agent | `plans/reports/260921-research-windows-computer-use-mcp.md` dòng 398; `.mcp.json` |
| Driver CP210x | Universal 11.6.0 | Cổng COM của ESP32 DroneBridge | `firmware/dronebridge/README.md` mục "Board" |
| Charge Master (SkyRC) | firmware sạc 1.13 | Phần mềm sạc pin B6AC V2 | memory dự án (CHƯA CÓ NGUỒN trong repo) |

## 10. Script trong `scripts/` (51 file chạy được)

Đếm bằng `ls scripts/*/` ngày 26/11/2026 (không tính `__pycache__`, `README.md`).

### `scripts/fc/` (11): đọc, nạp, kiểm FC thật qua USB/MAVLink

| Script | Việc |
|---|---|
| `nap_dfu.py` | Nạp ArduPilot qua DFU tới lúc lên cổng COM |
| `vao_dfu.py` | Đưa FC đang chạy Betaflight vào DFU bằng lệnh MSP, không bấm BOOT |
| `kiem_fc.py` | Kiểm FC ngay sau nạp: banner, cảm biến, hướng gyro, chụp bảng tham số |
| `nap_param.py` | Nạp file `.param`, reboot, đọc lại từng dòng |
| `kiem_phan_cung.py` | Rà sức khoẻ toàn bộ phần cứng (IMU, baro, la bàn, GPS, RC, TFmini, 4 ESC, pin), chỉ đọc |
| `doc_tay_cam.py` | Đọc bản đồ công tắc tay cầm từ FC |
| `hieu_chinh_la_ban.py` | Onboard Mag Calibration từ dòng lệnh |
| `tfmini_qua_fc.py` | Đọc/cấu hình TFmini Plus qua FC bằng gói `SERIAL_CONTROL` |
| `tai_log.py` | Tải log dataflash `.bin` qua MAVLink |
| `phan_tich_log.py` | Tóm tắt log `.bin` theo từng chuyến ARM → DISARM |
| `log_bin.py` | Chuyển tiếp tới bộ đọc log chung `backend/flights/binlog.py` |

### `scripts/esp32/` (12): hai bo ESP32 và hotspot

| Script | Việc |
|---|---|
| `dronebridge-nvs.ps1` | Ghi cấu hình DroneBridge vào NVS qua USB |
| `nap_camera.ps1` | Nạp firmware camera bằng một lệnh (`-Ota` qua Wi-Fi) |
| `camera-secrets.ps1` | Sinh `secrets.h` (SSID, mật khẩu hotspot, token OTA) |
| `ota_camera.py` | Gửi firmware camera qua Wi-Fi và chứng minh chip chạy đúng bản |
| `camera_check.py` | Nghiệm thu camera qua Wi-Fi (đếm khung, kiểm JPEG) |
| `camera_net.py` | Một chỗ giữ địa chỉ camera cho các script |
| `esp32_log.py` | Đọc log Serial ESP32, không reset bo, tự che mật khẩu |
| `wifi_ping_check.py` | Ping đồng thời hai ESP32, tìm giây mất chung |
| `wifi_scan_watch.ps1` | Ghi lúc card Wi-Fi laptop quét |
| `hotspot-on.ps1` | Bật Mobile Hotspot cho hai ESP32 (`-Restart`) |
| `hotspot.ps1` | Thư viện hotspot dùng chung |
| `firewall-mavlink.ps1` | Mở UDP 14550 trên tường lửa Windows |

(Số file: 5 `.py` + 7 `.ps1`.)

### `scripts/sitl/` (14): drone ảo

| Script | Việc |
|---|---|
| `harness.py` | Thư viện chung: nói chuyện với SITL bằng MAVLink thật |
| `run-all.sh` | Chạy lần lượt mọi runner, in bảng tổng, mã thoát ≠ 0 nếu có bài hỏng |
| `sitl-headless.sh` | Bật/tắt SITL chạy nền cho nghiệm thu backend |
| `run_mode_chain.py` | Chuỗi 7 chế độ bay |
| `run_rtl_alt.py` | Thí nghiệm RTL ở 15 m và 50 m |
| `run_mission_auto.py` | Mission 5 waypoint chạy AUTO |
| `run_mission_low_alt.py` | Mission có waypoint thấp 3 m |
| `run_log_dump.py` | Dump log `.BIN` ra CSV |
| `run_param_load.py` | Nạp bộ param dự án, ghi dòng nhận/từ chối |
| `run_avoid_brake.py` | TFmini ảo và AVOID phanh |
| `run_proximity_probe.py` | Đo dữ liệu proximity thật của SITL |
| `run_backend_avoid.py` | Backend thấy AVOID đúng như FC |
| `run_ngoai_troi.py` | 7 bài vượt lưới an toàn cấu hình ngoài trời |
| `run_nap_khi_bay.py` | Nạp mission mới khi đang bay AUTO qua backend |

### `scripts/vision/` (5): model AI

`lay_model.py` (chép bundle model từ repo XLA), `kiem_bundle.py` (kiểm bundle bằng bộ nạp của backend),
`replay_bench.py` (đo ms từng bước trên bản ghi camera), `replay_pred.py` (xuất dự đoán cả hệ cho XLA chấm),
`trich_dqt.py` (trích bảng lượng tử JPEG của camera thật).

### `scripts/laptop/` (1)

`che_do_bay.ps1`: laptop không ngủ, Energy Saver không tự bật, card Wi-Fi Maximum Performance và tắt tự quét
(`-Bat` trước buổi bay, `-Tat` khi về).

### Gốc `scripts/` và thư mục khác (8)

`run_sitl.sh` (bật SITL có map + MAVProxy), `run_backend.sh` (chạy backend), `ws_probe.py` (dò WebSocket
backend), `sitl_deadman_check.py` (nghiệm thu dead-man trên SITL), `bench_tfmini.py` (đọc TFmini qua USB-TTL),
`setup-d-drive.ps1` (dời cache/toolchain sang ổ D), `gui/gui.ps1` (đường lui điều khiển GUI),
`github/bootstrap_github.py` (tạo label/milestone/issue).

Tổng: 11 + 12 + 14 + 5 + 1 + 8 = **51**.

---

## Ảnh/ảnh chụp màn hình dùng được

Ảnh chụp màn hình phần mềm:

- `D:\Coding\IOT-CV\docs\so-tay\anh\03-mp-wp-list.png` (Mission Planner, danh sách waypoint SITL)
- `D:\Coding\IOT-CV\docs\so-tay\anh\04-mp-avoid-phanh.png` (Mission Planner lúc AVOID phanh trên SITL)
- `D:\Coding\IOT-CV\docs\so-tay\anh\04-avoid-phanh.png`
- `D:\Coding\IOT-CV\docs\so-tay\anh\07-mp-read-wps.png` (Mission Planner đọc mission từ FC)
- `D:\Coding\IOT-CV\docs\so-tay\anh\03-log-viewer.png` (UAV Log Viewer)
- `D:\Coding\IOT-CV\docs\so-tay\anh\08-gcs-hud-sitl.png` (web GCS HUD với SITL)
- `D:\Coding\IOT-CV\docs\so-tay\anh\09-ban-do-sau-chuyen-bay.png`, `09-hai-lop-mission.png`
- `D:\Coding\IOT-CV\logs\sitl\web-ngoai-troi-nap-di-ve-sitl.png` (web nạp mission Đi về lên SITL)
- `D:\Coding\IOT-CV\logs\sitl\web-ngoai-troi-mau-di-ve.png`, `web-ngoai-troi-bay-rec.png`
- `D:\Coding\IOT-CV\plans\reports\261126-phase18-trang-bay-1707x900.png` (trang Bay, 1707×900)

Ảnh chính hãng / sơ đồ:

- `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\m_01_12_quad_x_bf.png` (sơ đồ motor Quad X kiểu Betaflight)
- `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\MissionPlanner_MotorTest.png`
- `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\reference-frames-holybro-s500.jpg`
- Thư mục `D:\Coding\IOT-CV\assignment\_build\img\official\{speedybee,dronebridge,benewake,flysky,holybro,espressif}\`
- Ảnh thật bo camera: `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg`, `IMG_8498.jpg`
- Ảnh thật FC: `D:\Coding\IOT-CV\picture\FC-speedybee-f405-v5\IMG_8456.HEIC` … `IMG_8463.HEIC` (HEIC, phải chuyển sang JPG)

Không tìm thấy ảnh chụp màn hình Mission Planner lúc hiệu chỉnh accel/la bàn/radio trên drone thật (đã
tìm `docs/so-tay/anh`, `logs/sitl`, `plans/reports`, `picture`, `assignment/_build/img`).

## Số liệu thiếu nguồn

- Phiên bản Chrome đang dùng: CHƯA CÓ NGUỒN.
- Phiên bản cua-driver đang chạy hiện tại: repo chỉ ghi 0.28.2 lúc chọn (21/09/2026); bản đang cài
  CHƯA CÓ NGUỒN trong repo.
- Phiên bản Charge Master và firmware sạc 1.13: chỉ có trong memory của agent, CHƯA CÓ NGUỒN trong repo.
- Hiệu chỉnh ESC kiểu PWM (throttle range): không có bản ghi; dự án dùng DShot300, CHƯA CÓ NGUỒN
  khẳng định không cần.
- Hiệu chỉnh điện áp (`BATT_VOLT_MULT`) bằng đồng hồ vạn năng và dòng (`BATT_AMP_PERVLT`) theo mAh sạc trả:
  giá trị đang dùng là số tính từ tài liệu, chưa có bản ghi hiệu chỉnh đo thật (FC đọc 16,93 V lúc pin đầy
  16,80 V, `plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 7).
- Số fps camera ở QVGA: CHƯA CÓ NGUỒN (chỉ có VGA 7,6 khung/s).
- Baud của SERIAL0/USB khi Mission Planner nối: chỉ có "CONNECT COM6 115200"; USB không dùng baud thật.
- Ý nghĩa bit của `AVOID_ENABLE 3` trong 4.7.1: file param ghi "chỉ xét bit 2" cho TFmini nhưng giá trị là 3
  (bit 0 + bit 1); cần đối chiếu tài liệu ArduPilot trước khi đưa lên slide.
