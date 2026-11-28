# MANIFEST-2: ảnh bổ sung cho slide (img/real/)

Lập ngày 27/11/2026 (agent CAPTURE). Bổ sung cho `MANIFEST.md`, không thay nó. Mọi file dưới đây đã được mở xem lại sau
khi xuất. Cỡ ghi theo pixel.

Công cụ: Chrome headless qua `@playwright/test` của `frontend/` (viewport 1707×900; web chụp deviceScaleFactor 2, sơ đồ
SVG của trang hướng dẫn chụp deviceScaleFactor 3), ImageMagick 7, Pillow trên `py -3.13`. Script nằm trong scratchpad
của phiên (có thể bị dọn); mọi chỗ sửa ghi ở cột "Đã sửa".

## 1. Lịch sử bay (chuyến bay thật), `lsb-*.png`

Cách chụp: backend chạy KHÔNG nối drone (`MAVLINK_ENDPOINT=udpin:127.0.0.1:14599`, `MAVLINK_UDP_HELLO=127.0.0.1:14598`
để không chào bo DroneBridge thật, `TLOG_ENABLE=0`, `RECORD_VIDEO=0`, `CAMERA_FAKE=1`, deadman log ghi ra scratchpad), web
`pnpm dev`. Trang `/flights?f=<id>`, theme ngày, nền bản đồ "Vệ tinh". Chụp từng panel theo phần tử (không có thanh menu,
không có thanh trạng thái "Mất liên lạc"). Đã tắt cả hai tiến trình sau khi chụp.

Sửa chung trên DOM trước khi chụp (không sửa ảnh): chip "ẢNH RÕ · enhancer-v2.0.0" → "ẢNH RÕ"; ẩn nút "Ảnh rõ offline (AI
dựng lại)", ẩn ghi chú "Enhancer v2.0.0 dựng ảnh rõ…", ẩn thanh dựng offline; ẩn 3 dòng sự kiện có phiên bản/số máy
("ArduCopter V4.7.1 (dbe79216)", "ChibiOS: d103983f", "speedybeef4v5 0020001A …"). Đã quét text trang tìm toạ độ GPS
dạng số thập phân dài và chữ "nguồn giả": không có trong các panel đã chụp.

| File | Thấy gì | Cỡ | Nguồn | Đã sửa |
|---|---|---|---|---|
| lsb-danh-sach-0211.png | danh sách 9 chuyến ngày Thứ Hai 02/11/2026 (10:10 → 10:40), mỗi chuyến: giờ, thời lượng, cao/xa, chuỗi mode, số cảnh báo; 10:40 đang chọn | 564×1838 | web `/flights`, panel "Các chuyến" | bỏ giới hạn chiều cao danh sách để thấy hết |
| lsb-danh-sach-0111.png | 6 chuyến ngày Chủ Nhật 01/11/2026 (19:41 → 20:28) | 564×1350 | như trên | như trên |
| lsb-danh-sach-hai-ngay.png | hai cột trên đặt cạnh nhau, nền trắng | 1152×1838 | ghép hai file trên | ghép |
| lsb-1040-tong-quan.png | trang Lịch sử bay chuyến 10:40 02/11: tiêu đề trang, danh sách, đường bay trên ảnh vệ tinh (GUIDED, 17,9 m, 15 m, 15,23 V), camera đã ghi 12,5 khung/s (thấy 2 người ở góc trên trái), thanh phát lại + dải mode | 3414×1595 | web, viewport từ tiêu đề trang xuống | cắt đáy ngay dưới vạch sự kiện |
| lsb-1040-ban-do.png | panel "Đường bay": vệt bay mission chuyến 10:40 (xanh = đã bay, xám = còn lại), chữ H home, biểu tượng drone | 1554×1010 | web | không. Còn 2 đường nối mảnh của ô bản đồ ngang ảnh (lỗi ghép ô của Leaflet ở dsf 2) |
| lsb-1040-camera.png | panel "Camera": khung camera đã ghi tại đầu phát, 12,5 khung/s, 2 người trên bãi | 1150×1010 | web | không |
| lsb-1040-phat-lai.png | thanh phát lại: nút, 1×/2×/4×/8×, 10:42:08 · 1:38 / 3:53, dải mode LOITER/AUTO/GUIDED, vạch cảnh báo | 2674×218 | web | không |
| lsb-1040-ai-canh-nhau.png | panel AI: khung gốc ↔ ảnh rõ cạnh nhau, hộp người của detector; khung #10999: 8 người, tin cậy cao nhất 54 %, model 59 ms; độ sáng 168 → 131, tương phản 35,8 → 59,4, độ nét 74 → 424 | 2726×1042 | web, tua tới t = 121,7 s | sửa DOM như trên. Lưu ý: nhãn hộp chỉ 11–14 %, chụm ở mép trên; số ms là số tức thời, không trích làm số đo |
| lsb-1040-bieu-do.png | 9 biểu đồ: độ cao & cách home, tốc độ ngang, điện áp pin, dòng, RSSI DroneBridge, mất gói MAVLink, camera khung/s, số vệ tinh (~25), rung | 2726×1182 | web | không |
| lsb-1040-bieu-do-hang1.png | hàng đầu: độ cao & cách home, tốc độ ngang, điện áp pin | 2726×470 | cắt từ file trên | crop y 0–470 |
| lsb-1040-tom-tat.png | tóm tắt: 10:40:39 → 10:44:13 (3:34), cao/xa 18,1 m / 27,8 m, quãng đường 325 m, pin 15,56 → 15,14 V · 596 mAh, mất gói 2,9 %, camera 5,5 khung/s · 75 %, cảnh báo 27, nguồn log FC + tlog + video | 1230×1010 | web | không. Có dòng "Đồng hồ laptop chậm 54,2 s, đã chỉnh" |
| lsb-1040-su-kien.png | 13 sự kiện đầu (ARM, RC Protocol IBUS, New mission, New fence, Mission 1 Takeoff, 2 WP…) | 1474×1010 | web | ẩn 3 dòng phiên bản. Còn 3 dòng "Mất hình 2,8 s / 3,0 s / 2,1 s" (camera): BRIEF cấm kể sự cố, cân nhắc trước khi dùng |
| lsb-0111-2018-ban-do.png | đường bay chuyến 20:18 01/11 (Đi–về ~35 m dọc lối đi), lúc RTL | 1554×1010 | web, tua t = 175 s | không |
| lsb-0111-2018-phat-lai.png | thanh phát lại chuyến 20:18: STABILIZE → LOITER → AUTO → LOITER → RTL | 2674×218 | web, t = 90 s | không |
| lsb-0111-2018-bieu-do.png | 9 biểu đồ chuyến 20:18; RSSI, mất gói, camera trống vì chuyến chỉ có log FC | 2726×1180 | web | không |
| lsb-0111-2018-bieu-do-hang1.png | hàng đầu: độ cao & cách home (tới ~33 m), tốc độ, pin | 2726×470 | cắt từ file trên | crop y 0–470 |
| lsb-0111-2018-tom-tat.png | 20:18:51 → 20:22:03 (3:13), 15,4 m / 34,9 m, 95 m, 15,29 → 14,93 V · 506 mAh, cảnh báo 0, nguồn log FC | 1230×1012 | web | không |
| lsb-0111-2018-su-kien.png | 9 sự kiện: ARM, Mission 1 Takeoff, 2 WP, Reached #2, 3 WP, Reached #3, 4 RTL, DISARM | 1474×1012 | web | không |

Không chụp: panel Camera và AI của chuyến 01/11 tối (chuyến không có video; panel ghi "backend chưa chạy, laptop ngủ…",
tức là kể sự cố). Chuyến 10:40 là chuyến có video + AI duy nhất được chụp.

## 2. Trang hướng dẫn lắp ráp, `hd-*.png`

Nguồn: `D:\Coding\IOT-CV\docs\huong-dan\lap-rap-phan-cung.html` (mở `file://`, không sửa file). Sơ đồ SVG chụp theo phần
tử ở dsf 3, bỏ nền thẻ và viền thẻ (shave 15 px, trim, viền trắng 40 px). Không hình nào có ESP32-CAM, OV2640, XIAO.
Lưu ý chung: tiêu đề trong hình còn dấu "—" (chữ của trang hướng dẫn), slide nên viết chú thích riêng.

| File | Thấy gì | Cỡ | Trang | Đã sửa |
|---|---|---|---|---|
| hd-bo-tri-khung-tren.png | bố trí trên khung nhìn từ trên, đúng tỉ lệ: 4 motor (M1–M4, CW/CCW, vùng quét cánh 10 inch), stack, TFmini, camera, GPS trên cột, iA6B, ESP32 + UBEC, pin | 1885×2074 | #khung | không |
| hd-bo-tri-khung-ngang.png | nhìn ngang mũi bên trái: GPS cột ≥ 8–10 cm, TFmini ngẩng 2–3°, camera chúc ~30°, pin dưới bụng | 1922×1203 | #khung | không |
| hd-stack-chong-rung.png | stack nổ tầng: ốc nylon, FC F405 V5, đệm silicone, ESC OX32, bát chống rung 30,5, cáp 10 chân 25 mm | 1817×1110 | #khung | không |
| hd-chieu-quay-motor.png | chiều quay 4 motor nhìn từ trên (FRAME_TYPE 12) | 1513×1831 | #khung | không |
| hd-fc-mat-tren.png | sơ đồ pad FC mặt trên: T2/R2 → ESP32, T3/R3 → TFmini, 5V/G cụm LED1, B+/B− còi, 9V cảnh báo | 1882×1740 | #bo | không |
| hd-fc-mat-duoi.png | FC mặt dưới: cổng ESC 10 chân, GPS 6 chân, receiver 4 chân, HD 6 chân (không dùng) | 1722×1599 | #bo | không |
| hd-esc-mat-55a.png | ESC OX32 55A mặt "55A": 8 pad tín hiệu, 4 motor, pad +/− | 1711×1560 | #bo | không |
| hd-camera-s3-chan.png | bo camera ESP32-S3 N16R8: hàng chân, 5V/GND từ UBEC, OV3660, USB-UART/USB-OTG | 1572×765 | #bo | không |
| hd-hai-cach-chay-web.png | hai cách chạy: drone ảo (SITL → backend tcp → web → MP 5762) và drone thật (FC → ESP32 → hotspot → backend udpin 14550 → camera thật → web) | 3542×1130 | #maytinh | DOM: "Drone THẬT — Claude chạy" → "Drone THẬT" |
| hd-cac-loai-giac.png | 8 loại giắc: JST-SH 1,0, JST-GH 1,25, Dupont 2,54, servo 3 chân, XT60, JST-XH, USB-C, pad hàn | 3987×1843 | #day | không |
| hd-co-day-awg.png | cỡ dây AWG và dùng ở đâu (12–14, 16, 18–22, 24–28 AWG) | 3054×1046 | #day | không |
| hd-cap-gps.png | cáp GPS M10 10 chân → 6 dây → cổng GPS FC (TX↔R4, RX↔T4 bắt chéo) | 1926×929 | #day | không |
| hd-cap-receiver.png | cáp receiver: cổng 4 chân FC → Dupont → cổng i-BUS iA6B | 1837×737 | #day | không |
| hd-tfmini-fc.png | TFmini Plus → FC: 4 dây vào pad (5V/G cụm LED1, T3/R3), cảnh báo 9V | 1858×838 | #day | không |
| hd-tfmini-usb-ttl.png | thử TFmini trên bàn qua USB-TTL CP2102 → laptop | 1929×772 | #day | không |
| hd-esp32-fc-serial2.png | ESP32 DevKit ↔ FC SERIAL2 (T2→RX2, R2→TX2, GND), nguồn riêng từ UBEC | 1912×820 | #day | không |
| hd-nhanh-nguon-ubec.png | nhánh nguồn riêng: pad pin ESC → UBEC 5V 3A → bảng chia → ESP32 + camera | 1865×780 | #day | không |
| hd-coi.png | còi active → pad B+/B− | 1666×693 | #day | không |
| hd-noi-dai-day-motor.png | nối dài dây motor 16 AWG ~30 cm, mối nối so le, gen co | 1797×791 | #day | không |

Mô hình 3D (trang #mohinh, chụp vùng `#v3dStage` 1006×648 css ở dsf 2, giai đoạn lắp xong chưa cánh, xoay tắt; điều khiển
bằng chuột trên trang: nút góc nhìn, cuộn để phóng, kéo phải để dời):

| File | Thấy gì | Cỡ | Đã sửa |
|---|---|---|---|
| hd-3d-tach-lop-nhan.png | ảnh nổ (tách lớp 100 %) chéo 3/4, có nhãn: GPS M10, FC, còi, ESC, TFmini, iA6B, bát chống rung, camera, 4 motor, UBEC, pin 4S, ESP32 | 2014×1298 | xoá chữ in "S500" và "CẤM KHOAN" trên tấm đáy (tô màu tấm, chỗ nằm dưới nhãn "Camera" dựng lại bằng alpha nhãn ước lượng 0,88) |
| hd-3d-tach-lop.png | cùng góc, không nhãn | 2014×1298 | như trên (chỉ tô màu tấm) |
| hd-3d-ben-nhan-tia.png | nhìn ngang phóng to, có nhãn, có tia TFmini (cam) và nón nhìn camera (tím) | 2014×1298 | không |
| hd-3d-cheo-nhan.png | chéo 3/4 phóng vừa, có nhãn | 2014×1298 | không. Vài nhãn chồng lên chi tiết khác (vd. "Pin 4S" nằm trên tấm trên) do cách xếp nhãn của trang |
| hd-3d-can-stack.png | cận cảnh chéo vùng stack, GPS, TFmini, XT60, không nhãn | 2014×1298 | không |

Đã thử, không dùng: góc "Trước" phóng to (tia che gần hết hình), góc "Dưới" có nhãn (nhãn chiếu xuyên khung, sai chỗ).
Các 3D khác (chéo, ngang, trên, trước không nhãn) đã có ở `MANIFEST.md` mục 2.

## 3. Ảnh của người dùng (từ `img/user-*.png`)

| File | Thấy gì | Cỡ | Nguồn | Đã sửa |
|---|---|---|---|---|
| mp-bay-that-ban-do.png | bản đồ vệ tinh bãi bay thật trong Mission Planner, drone tại tâm, "Sats: 21", "hdop: 0.6"; dải dưới cùng là dòng trạng thái HUD "Bat1 16.32v 0.1 A 99% · EKF · Vibe · GPS: 3D dgps" | 861×692 | `img\user-mp-bay-that.png` | ghép: vùng bản đồ (385,72)-(1246,742) + dải HUD (0,316)-(380,334) đặt trên nền tối cao 22 px. Không có "DISARMED", "PreArm: RC not found", "Not Ready to Arm", taskbar, toạ độ |
| mp-bay-that-full.png | cửa sổ MP đầy đủ: HUD, tab Quick (Sonar 0,00, GroundSpeed 0,03, Yaw 359,78, Vertical 0,04), bản đồ | 1280×762 | như trên | bỏ taskbar (y ≥ 762); thanh tiêu đề chỉ còn "Mission Planner" (tô (81,1)-(525,17), bỏ số phiên bản, ArduCopter V4.7.1, số máy); tô toạ độ GPS ở thanh dưới (439,746)-(572,760). Chữ đỏ HUD còn nguyên |
| drone-ban-lam-viec.png | drone S500 lắp xong trên bàn cạnh tay phát FS-i6X và pin Ovonic 4S 5300 mAh; thấy stack, GPS, ESP32 header, motor | 2208×1750 | `img\user-drone-ban-lam-viec.png` (2880×2160) | crop (0,410) 2208×1750: bỏ màn hình laptop (có cửa sổ chat) và bàn phím màu bên phải; còn một phần bàn phím laptop và kệ sách mép trái |
| drone-tren.png | drone nhìn từ trên: stack FC, tụ 1500 µF, UBEC, GPS cột, ESP32, chân đáp | 2160×2832 | `img\user-drone-tren.png` (2160×2880) | crop bỏ 48 px nền gạch đáy |
| drone-tren-can-stack.png | cận cảnh stack FC/ESC, dây motor, tụ 1500 µF 35 V, UBEC, tấm "EDITION 2015" | 1272×1440 | `img\user-drone-tren.png` | crop (456,792) 1272×1440 |
| drone-nghieng.png | drone đủ cánh đứng trên nền gạch, nhìn chéo từ trên | 1176×860 | `img\user-drone-nghieng.png` (1206×963) | crop (30,40) 1176×860 |

Mọi file mục 3: bỏ metadata (`-strip`), không chỉnh màu hay nội dung.

## 4. Kiểm kê các ảnh khác trong repo

### Ảnh WEBP đội lốt đã chuyển sang PNG (vào `img/real/`)

| File | Thấy gì | Cỡ | Nguồn |
|---|---|---|---|
| flysky-fs_1.png | tay phát FlySky FS-i6X nhìn chéo (ảnh hãng, nền trắng) | 1500×1000 | `assignment\_build\img\official\flysky\fs_1.jpg` (WEBP) |
| flysky-fs_2.png | FS-i6X nhìn chéo khác | 1500×1218 | `...\flysky\fs_2.png` (WEBP) |
| flysky-fs_3.png | FS-i6X nghiêng | 1500×1218 | `...\flysky\fs_3.png` (WEBP) |
| flysky-fs_4.png | FS-i6X nhìn thẳng | 1500×1218 | `...\flysky\fs_4.png` (WEBP) |
| flysky-fs_5.png | FS-i6X nhìn thẳng (gần giống fs_4) | 1500×1218 | `...\flysky\fs_5.png` (WEBP) |

`fs_6.jpeg` (WEBP) là ảnh trời mây, không liên quan, không chuyển. `picture\esp32-s3-n16r8-ov3660\vn-*.jpg` cũng là WEBP
nhưng có watermark shop "PHÚC MINH" (đã loại ở `MANIFEST.md`), không chuyển.

### Dùng được (đường dẫn gốc, chưa sao vào img/)

Gốc chung `D:\Coding\IOT-CV\assignment\_build\img\` (ảnh hãng; khi dùng ghi nguồn hãng):

| File | Nội dung |
|---|---|
| `official\speedybee\fc_layout_top.png` | sơ đồ layout FC F405 V5 mặt trên có chú thích (gyro, baro, LED, BOOT, USB-C…) |
| `official\speedybee\prod_1.jpg` … `prod_4.jpg` | stack F405 V5 + ESC 55A nhìn chéo, nền trắng (prod_4 nhìn thẳng FC) |
| `official\speedybee\prod_5.jpg` | FC mặt dưới, nền trắng |
| `official\speedybee\prod_6.jpg`, `prod_7.jpg` | ESC 55A hai mặt, nền trắng |
| `official\speedybee\SpeedyBee_F405_V5_Board.png`, `v5_27.jpg` | layout FC hai mặt có chú thích (ảnh dọc dài) |
| `official\speedybee\v5_24.jpg` | wiring diagram chính hãng (FC, ESC, GPS, receiver, LED, VTX) |
| `official\speedybee\v5_25.jpg` | nối ESC với 4 motor + tụ 1000 µF + cáp XT60 |
| `official\speedybee\v5_28.jpg` | layout ESC 55A hai mặt có chú thích |
| `official\speedybee\v5_23.jpg` | kích thước FC và ESC |
| `official\speedybee\v5_21.jpg` | ESC nổ tầng (heatsink, MOSFET, bus bar), nền tối |
| `official\speedybee\v5_06.jpg`, `v5_07.jpg`, `v5_10.jpg` | ảnh quảng cáo nền tối: gyro ICM-42688, nguồn DC-DC, chip blackbox 16 MB (chữ tiếng Anh) |
| `official\holybro\s500_1.jpg`, `s500_3.jpg`, `s500_4.jpg` | khung S500 lắp xong, nền trắng |
| `official\holybro\s500_5.jpg` | các chi tiết bộ khung tháo rời |
| `official\holybro\m10_family.jpg` | ba module GPS M10/M9N/M8N (chỉ M10 là của dự án) |
| `official\holybro\m10v1_dim.png` | bản vẽ kích thước GPS M10 (Ø50) |
| `official\benewake\tfminiplus_product.png`, `tfp-001.png` | TFmini Plus, nền trắng |
| `official\benewake\tfp-005.png` … `tfp-007.png` | bản vẽ kích thước TFmini Plus (35 × 21 × 18,5 mm) |
| `official\tmotor\tm_02.jpg` | 4 motor T-Motor AIR2216 II KV920, nền trắng |
| `official\tmotor\tm_03.jpg` | cánh T1045 |
| `official\tmotor\tm_09.jpg` | bản vẽ kích thước motor |
| `official\ardupilot\m_01_12_quad_x_bf.png` (+ `.svg`) | sơ đồ thứ tự motor QUAD X (BETAFLIGHT), đúng FRAME_TYPE 12 của dự án |
| `official\ardupilot\MOTORS_CW_CCWLegend.jpg` | chú giải chiều quay CW/CCW |
| `official\dronebridge\db_ESP32_setup.png` | sơ đồ FC ↔ UART ↔ ESP32 DroneBridge ↔ UDP/TCP Wi-Fi ↔ GCS |
| `official\espressif\esp32-devkitc-v4-functional-overview.png` | ESP32-DevKitC có chú thích (nút EN/Boot, USB-UART, WROOM-32E) |
| `official\espressif\esp32_devkitC_v4_pinlayout.png` | pinout ESP32-DevKitC |
| `official\flysky\ia6b_overview.png` | sơ đồ cổng receiver FS-iA6B |
| `parts\fc.png`, `esc.png`, `motor.png`, `gps_m10.png`, `tfmini.png`, `fsi6x.png`, `esp32_devkitc.png`, `ia6b.png` | ảnh linh kiện đã tách nền, cỡ nhỏ (176–777 px) |
| `collage\s500.png`, `stack.png`, `motors.png` | ảnh đã tách nền khung, stack, 4 motor |
| `collage\tile_1.png` … `tile_7.png` | thẻ linh kiện có tên + một dòng thông số (khung, stack, motor, GPS, TFmini, FS-i6X, ESP32 DevKit) |

Khác:

| File | Nội dung |
|---|---|
| `D:\Coding\IOT-CV\.playwright-mcp\xla-ls-task31c.png` | Label Studio gán nhãn một khung bay thật (20261102-100941), hộp người trên bãi; dùng được cho slide dữ liệu AI |
| `D:\Coding\IOT-CV\docs\so-tay\anh\09-ban-do-sau-chuyen-bay.png`, `09-hai-lop-mission.png` | trang Bay giao diện tối cũ, SITL, bản đồ có mission; đã có bản mới hơn |
| `D:\Coding\IOT-CV\frontend\screenshots\day-system.png` | trang Hệ thống bản 15/11 (sơ đồ trình duyệt ↔ backend ↔ FC ↔ camera); menu còn cũ |

Các ảnh `docs\so-tay\anh\03-*, 04-*, 07-mp-read-wps.png` đã dùng ở `MANIFEST.md` mục 5.

### Đã xem, gắn cờ, không dùng

- Có ESP32-CAM / AI-Thinker / OV2640: `official\aithinker\esp32_cam.png` + `.webp`, `parts\esp32cam.png`, `collage\tile_8.png`
  ("ESP32-CAM, cảm biến ảnh OV2640"), `collage\collage_linhkien.png` (có ô ESP32-CAM), `frontend\screenshots\v3-hangar.png`
  và `v3-hangar-exploded.png` (nhãn "ESP32-CAM · camera + AI", "ArduCopter 4.7").
- Giao diện cũ (15/11 hoặc trước, menu chưa có "Lịch sử bay", theme tối cũ, hoặc số phiên bản): toàn bộ
  `frontend\screenshots\*.png` (day-*, night-*, v2-*, v3-*, debug-nav), `docs\so-tay\anh\08-*.png` (trang Bay tối cũ, "Phase 09"),
  `docs\so-tay\anh\07-video-gia-trinh-duyet.png` (video giả SITL), `.playwright-mcp\page-2026-11-19T02-29-*.png` và
  `page-2026-11-19T02-30-00-024Z.png`, `page-2026-11-19T03-01-13-102Z.png` (bản 19/11), `.playwright-mcp\ai-1040-*.png`
  (bộ làm rõ cũ, theme tối), `.playwright-mcp\flights-full.jpg` (bản 19/11).
- Không liên quan: `.playwright-mcp\page-2026-11-18T19-*.png` (ảnh slide), `page-2026-11-19T03-*.jpeg` (Google Drive),
  `xla-ls-task31.png` / `task31b.png` (Label Studio đang tải / hộp rời), `official\speedybee\v5_12.jpg`, `v5_13.jpg`,
  `v5_15.jpg` (drone FPV, app điện thoại), `v5_29`–`v5_32` (danh mục phụ kiện hộp), `official\holybro\s500_2/6/7/8/9.jpg`
  (motor/cánh của bộ kit khác), `official\tmotor\tm_01/04–08.jpg` (hộp, quảng cáo), `official\ardupilot\MissionPlanner_MotorTest.png`
  (ảnh nhỏ), `reference-frames-holybro-s500.jpg` (bộ kit Pixhawk).
- `plans\reports\*.png`: đã xử lý ở `MANIFEST.md` mục 3 và "Đã xem và không dùng".
