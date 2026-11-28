# Phần cứng

Chương này trình bày linh kiện của drone và lý do chọn, khối lượng và lực đẩy, cách chia cổng UART của bo bay, sơ đồ nối
dây, đường nguồn từ pin 4S, vị trí từng món trên khung, cách chống rung, thứ tự và chiều quay của bốn motor, và quy trình
lắp ráp 7 chặng 76 bước.

## Lựa chọn linh kiện

Linh kiện được chọn theo năm điều kiện rút ra từ bài toán: bo bay được ArduPilot hỗ trợ và đủ cổng UART cho GPS, LiDAR, bộ
thu RC, telemetry ESC và một cầu MAVLink; có la bàn, vì Loiter, RTL và Auto cần biết hướng mũi; mang thêm được LiDAR, camera
và hai bo ESP32 mà tỉ số lực đẩy trên khối lượng vẫn trên 2 : 1; tay phát nối thẳng vào bo bay, độc lập với đường Wi-Fi;
nguồn của hai bo ESP32 tách khỏi nguồn 5 V của bo bay. Drone gồm 16 nhóm linh kiện, chia thành khối bay (@tab:c2-bom-bay) và
khối cảm biến, truyền thông, nguồn phụ (@tab:c2-bom-phu).

Bảng: Linh kiện khối bay {#tab:c2-bom-bay}

| Linh kiện | Thông số chính | Lý do chọn |
|---|---|---|
| Khung Holybro S500 V2 | đường chéo motor 480 mm, 782 g gồm chân đáp; tấm đế là bo chia nguồn | ArduPilot có bộ tham số khung tham chiếu S500 với motor 2216, cánh 1045, pin 4S; tải thêm tới 1 500 g chưa tính pin |
| Bo bay SpeedyBee F405 V5 | STM32F405, flash 1 MB, gyro ICM-42688, áp kế SPA06, blackbox 16 MB; 39 × 39 mm, lỗ 30,5 mm | target `speedybeef4v5` có trong ArduPilot; chồng sẵn với ESC nên ít mối hàn |
| ESC OX32 55A 4-in-1 | 55 A liên tục mỗi kênh, 3S đến 6S, DShot300, báo vòng quay từng motor | dư dòng xa so với 11 đến 12 A khi treo; vòng quay cho phép bo bay chặn cất cánh khi có motor chưa quay đủ |
| 4 motor T-Motor AIR2216 II KV920 | Ø27,7 × 31 mm, 64 g; trục ren M6; 2 ren phải, 2 ren trái | lỗ 16 × 19 mm bắt thẳng lên cần S500; 1 332 g lực đẩy ở 16 V với cánh T1045 |
| Cánh T1045 (4 dùng, 4 dự phòng) | 10 inch, bước 4,5; giới hạn 1,2 kg mỗi cánh | đi kèm motor, vặn theo ren nên tự siết khi quay |
| GPS Holybro M10 + la bàn IST8310 | u-blox M10, UART 230 400 baud, la bàn I2C, nguồn 4,7 đến 5,2 V | bo bay không có la bàn, nên la bàn đi theo GPS là bắt buộc |
| Tay phát FS-i6X, bộ thu FS-iA6B | AFHDS 2A 2,4 GHz; bộ thu iBUS, 14,9 g, 2 anten; bo bay đọc 14 kênh | F405 V5 không nhận PPM; iBUS gửi mọi kênh trên một dây vào chân R6 |
| Pin Ovonic LiPo 4S 5 300 mAh 110C | XT60, 423 g; 16,8 V đầy, 14,8 V danh định | 12,5 mAh mỗi gam; khả năng xả dư xa dòng lớn nhất của drone |

Bảng: Linh kiện cảm biến, truyền thông và nguồn phụ {#tab:c2-bom-phu}

| Linh kiện | Thông số chính | Lý do chọn |
|---|---|---|
| Benewake TFmini Plus | LiDAR ToF 0,1 đến 12 m (vật sáng), chùm 3,6°, khoảng 100 khung/s; 5 V, tới 110 mA; 12 g | ArduPilot có sẵn driver (`RNGFND1_TYPE 20`), nhẹ, đọc qua UART |
| ESP32 DevKit CP2102 | ESP32-D0WD-V3, flash 4 MB, UART 115 200 baud | chạy firmware DroneBridge biến UART thành Wi-Fi UDP; logic 3,3 V nối thẳng bo bay |
| Camera ESP32-S3 N16R8 + OV3660 | flash 16 MB, PSRAM 8 MB; cảm biến 3 MP; 57,2 × 28,1 mm, 12,3 g; 2 cổng USB-C | PSRAM giữ được hai khung đệm; nạp qua USB hoặc Wi-Fi, không cần mạch nạp rời |
| UBEC 5 V 3 A | vào thẳng pin 4S, ra 5 V tới 3 A | nguồn riêng cho hai bo ESP32 |
| Tụ 1 500 µF 35 V | song song pad nguồn ESC | hấp thụ xung điện áp khi ESC đóng cắt; 35 V dư cho 4S |
| Còi active | pad B+, B− | báo ARM, pin yếu, giúp tìm drone |
| Phụ kiện lắp | bát chống rung 30,5 mm; dây silicone 16 AWG khoảng 4,5 m; gen co, dây rút, băng keo xốp, velcro, dây đai; bảng chia nguồn | nối dài dây motor, gắn stack mềm, cố định linh kiện |

Trên bàn còn mạch USB-TTL CP2102 để đọc TFmini trên máy tính trước khi hàn vào bo bay, và sạc SkyRC iMAX B6AC V2 (50 W, đo
được từng cell). Ảnh linh kiện ở @fig:c2-anh-stack đến @fig:c2-anh-esp32.

!![Stack SpeedyBee F405 V5 với ESC OX32 55A (ảnh hãng, trái) và bo bay F405 V5 của nhóm, mặt trên (phải)](assignment/_build/img/official/speedybee/prod_1.jpg|docs/thuyet-trinh/img/anh-fc-f405-tren.jpg){#fig:c2-anh-stack w=6}

!![Motor T-Motor AIR2216 II KV920 (trái) và cánh T1045 (phải), ảnh hãng](assignment/_build/img/official/tmotor/tm_02.jpg|assignment/_build/img/official/tmotor/tm_03.jpg){#fig:c2-anh-motor w=6}

!![Khung Holybro S500 V2 (trái) và GPS Holybro M10 có la bàn (phải), ảnh hãng](assignment/_build/img/official/holybro/s500_3.jpg|assignment/_build/img/parts/gps_m10.png){#fig:c2-anh-khung w=6}

!![Tay phát FlySky FS-i6X (trái) và sơ đồ cổng bộ thu FS-iA6B (phải), ảnh hãng](docs/thuyet-trinh/img/real/flysky-fs_2.png|assignment/_build/img/official/flysky/ia6b_overview.png){#fig:c2-anh-rc w=6}

!![LiDAR TFmini Plus (trái) và bản vẽ lỗ bắt (phải), ảnh hãng](assignment/_build/img/official/benewake/tfminiplus_product.png|assignment/_build/img/official/benewake/tfp-007.png){#fig:c2-anh-tfmini w=6}

!![Bo ESP32 DevKit chạy DroneBridge (trái) và bo camera ESP32-S3 N16R8 gắn OV3660 (phải), ảnh linh kiện của nhóm](docs/thuyet-trinh/img/anh-esp32-dronebridge.jpg|docs/thuyet-trinh/img/anh-camera-s3.jpg){#fig:c2-anh-esp32 w=6}

### Khối lượng và lực đẩy

@tab:c2-khoi-luong cộng khối lượng cất cánh; các dòng "ước" là ước lượng theo tài liệu, còn lại theo số hãng công bố.

Bảng: Khối lượng cất cánh {#tab:c2-khoi-luong}

| Phần | Khối lượng (g) | Nguồn số |
|---|---|---|
| Khung S500 V2 + chân đáp | 782 | Holybro |
| 4 motor | 256 | T-Motor |
| Pin 4S 5 300 mAh | 423 | Ovonic |
| Stack, bát chống rung, GPS và cột, bộ thu | 111 | ước, bộ thu theo hãng |
| 4 cánh, dây nối dài, XT60, tụ, gen co | 142 | ước |
| Camera và giá đỡ, ESP32, UBEC, phụ kiện | 110 | ước |
| **Tổng** | **khoảng 1 824** | |

Theo bảng đo của T-Motor, mỗi motor với cánh T1045 ở 16 V cho 1 332 g tại 9 857 vòng/phút khi ga 100 %, nhưng cánh chỉ chịu
1,2 kg, nên trần là 4 × 1 200 = 4 800 g. Chia cho khoảng 1 824 g được 2,63 : 1 (2,92 : 1 theo trần motor), trên mức 2 : 1.
Log bay xác nhận dư lực: ArduPilot tự học ga treo `MOT_THST_HOVER` được 0,184 đến 0,228 qua 11 chuyến, dòng treo 11 đến 12 A.

## Chia cổng UART của bo bay

Bo F405 V5 có sáu cổng nối tiếp, nhóm em dùng năm. ArduPilot không tự đoán thiết bị ở cổng nào: mỗi cổng được khai báo bằng
`SERIALn_PROTOCOL`, nên một cổng vật lý chạy MAVLink, GPS hay LiDAR chỉ do một con số quyết định (@tab:c2-uart).

Bảng: Chia cổng nối tiếp của bo bay F405 V5 {#tab:c2-uart}

| Cổng | Pad, đầu nối | Thiết bị | `SERIALn_PROTOCOL` | Baud |
|---|---|---|---|---|
| SERIAL0 | USB-C | Mission Planner, script trên bàn | MAVLink | 115 200 |
| SERIAL1 | nội bộ | Bluetooth của bo, không dùng | −1 | |
| SERIAL2 | T2, R2 | ESP32 DroneBridge | 2 (MAVLink2) | 115 200 |
| SERIAL3 | T3, R3 | TFmini Plus | 9 (Rangefinder) | 115 200 |
| SERIAL4 | cổng GPS 6 chân | GPS M10 | 5 (GPS) | 230 400 |
| SERIAL5 | cáp stack | telemetry ESC OX32 | 16 (ESC Telemetry) | 115 200 |
| SERIAL6 | R6, cổng 4 chân | bộ thu iA6B | 23 (RCIN, iBUS) | |

UART2 là cổng duy nhất có DMA (chip chuyển byte UART vào bộ nhớ mà không bắt CPU đọc từng byte), nên nhóm em dành nó cho luồng
MAVLink dày nhất là DroneBridge. Bộ thu chỉ bật iBUS (`RC_PROTOCOLS 4`).

!![Pad của bo bay: mặt trên với T2, R2 tới ESP32, T3, R3 tới TFmini, pad 5V, G và còi (trái); mặt dưới với cổng ESC 10 chân, cổng GPS, cổng bộ thu (phải)](docs/thuyet-trinh/img/real/hd-fc-mat-tren.png|docs/thuyet-trinh/img/real/hd-fc-mat-duoi.png){#fig:c2-pad-fc w=7.5}

Pad 9V nằm ngay cạnh cụm T3, R3, và chân 1 của cổng "HD" 6 chân cũng mang 9 V (@fig:c2-pad-fc). TFmini chỉ chịu 5 V ± 0,5 V,
nên dây đỏ của nó lấy ở pad 5V của cụm LED1 và không dùng cổng HD. Mũi tên in trên bo chỉ về mép có cổng 10 chân, cổng GPS và
pad T2, R2; đó là mép trước khi lắp lên khung.

## Sơ đồ nối dây

@fig:c2-day-dien là sơ đồ nối dây đầy đủ, mỗi đường là một sợi dây thật, đi từ pad tới pad. GPS M10 ở SERIAL4 có thêm hai chân
CL, DA cho la bàn; bộ thu gửi iBUS vào R6; DroneBridge ở SERIAL2, TFmini ở SERIAL3. Pin 4S vào thẳng pad của ESC có tụ song
song; cáp stack đưa điện áp pin, đo dòng, telemetry và bốn tín hiệu motor lên bo bay; UBEC riêng nuôi hai bo ESP32 qua bảng
chia. Camera không nối dây tín hiệu nào với bo bay.

![Sơ đồ nối dây đầy đủ: bo bay, ESC, 4 motor, GPS, bộ thu và tay phát, TFmini, ESP32 DroneBridge, camera ESP32-S3, còi, pin, tụ, UBEC, bảng chia, laptop; màu dây theo chú giải](docs/thuyet-trinh/img/asg/f5_daydien.png){#fig:c2-day-dien w=16}

Mọi đường UART đều bắt chéo: TX của thiết bị vào R của bo bay và ngược lại, cùng một dây GND chung. Bo bay, ESP32, TFmini và
GPS đều dùng logic 3,3 V nên nối trực tiếp, không cần mạch chuyển mức (@tab:c2-day).

Bảng: Chân nối của từng thiết bị {#tab:c2-day}

| Thiết bị | Tín hiệu | Nguồn |
|---|---|---|
| ESP32 DroneBridge | T2 → GPIO16 (RX2), R2 ← GPIO17 (TX2), GND | 5 V từ UBEC vào VIN |
| TFmini Plus | xanh TXD → R3, trắng RXD ← T3 | đỏ 5V, đen G của cụm LED1 |
| GPS M10 | TX → R4, RX ← T4, SCL → CL, SDA → DA | 4V5 của cổng GPS |
| Bộ thu iA6B | cổng Servo (iBUS) → R6 | 4V5 của cổng bộ thu |
| ESC OX32 | cáp SH1.0: V, G, C (dòng), T (telemetry), M1 đến M4 | điện áp pin qua chân V |
| Còi | B+, B− | từ bo bay |

Giắc GPS M10 thuộc họ GH 1,25 mm, không cắm vừa cổng SH 1,0 mm của bo bay, nên 6 dây được nối theo tên tín hiệu qua cáp GPS đi
kèm stack. Bộ thu dùng cáp 4 chân của stack, đầu kia làm thành ba đầu Dupont cái cắm vào cổng iBUS.

## Nguồn điện

Toàn bộ drone chạy từ một pin LiPo 4S (@fig:c2-nguon). Pin cắm vào pad nguồn ESC qua dây XT60 120 mm; tụ 1 500 µF 35 V ở đó
hấp thụ xung điện áp khi motor đổi ga. Từ pad nguồn chia ba nhánh: qua ESC vào bốn motor; qua cáp 10 chân lên bo bay, nơi BEC
5 V 2,5 A nuôi TFmini và đường 4V5 nuôi GPS, bộ thu; và UBEC 5 V 3 A hàn song song pad nguồn ESC, qua bảng chia nuôi
DroneBridge và camera.

![Cây nguồn từ pin 4S: ESC và 4 motor, BEC 5 V và 4V5 của bo bay, UBEC 5 V 3 A qua bảng chia tới hai bo ESP32; nét dày theo cỡ dây](docs/thuyet-trinh/img/tikz/F07.png){#fig:c2-nguon w=12}

Hai bo ESP32 kéo dòng thành từng đợt ngắn khi phát Wi-Fi, dễ làm đường 5 V dao động; đặt chúng trên UBEC riêng giữ 5 V của bo
bay sạch. GND của UBEC và của bo bay chung nhau qua pin, đủ cho UART giữa ESP32 và bo bay.

Bảng: Ngân sách dòng của từng nguồn {#tab:c2-tai}

| Nguồn | Khả năng | Tải | Dòng tải |
|---|---|---|---|
| Pin qua ESC | 55 A mỗi kênh | 4 motor | treo 11 đến 12 A; trung bình chuyến 8,2 đến 10,1 A |
| BEC 5 V của stack | 2,5 A | TFmini Plus | tới 110 mA, đỉnh 140 mA |
| Đường 4V5 của bo bay | 1 A chung | GPS M10, bộ thu iA6B | khoảng 40 mA và 50 mA |
| UBEC 5 V | 3 A | ESP32 DroneBridge, camera | dưới 1 A |

Theo @tab:c2-tai, tải của BEC 5 V và 4V5 cộng lại khoảng 200 mA, xa dưới 2,5 A. Cỡ dây chọn theo dòng: 12 đến 14 AWG từ pin
tới ESC (chịu từ 60 A), 16 AWG cho dây motor (khoảng 15 A mỗi motor), 18 đến 22 AWG cho UBEC và 5 V, 24 đến 28 AWG cho tín
hiệu. Bo bay đo điện áp và dòng pin qua cáp stack (`BATT_VOLT_MULT 11.0`, `BATT_AMP_PERVLT 370.4`); ngưỡng pin trình bày ở
chương 4.

## Bố trí trên khung

Bo bay đặt ở tâm, mũi tên chỉ về mũi. La bàn và hai linh kiện thu phát sóng (bộ thu, ESP32) đặt xa dây nguồn. TFmini và camera
đặt ở mép trước, tầm nhìn không vướng chân, cánh hay dây (@fig:c2-bo-tri, @tab:c2-vi-tri).

![Bố trí linh kiện nhìn từ trên: số motor, chiều quay, stack ở tâm, TFmini và camera ở mũi, GPS ở đuôi, pin dưới tấm đế](docs/thuyet-trinh/img/asg/f5_botri.png){#fig:c2-bo-tri w=12}

Bảng: Vị trí linh kiện trên khung S500 {#tab:c2-vi-tri}

| Linh kiện | Vị trí | Lý do |
|---|---|---|
| Stack FC + ESC | tâm khung, trên bát chống rung, mặt "55A" của ESC quay lên | trọng tâm giữa 4 motor, tách rung khỏi khung |
| TFmini Plus | mép trước tấm trên, 2 ốc M2, ngẩng 2 đến 3° | tia 3,6° không chạm chân đáp, cánh, GPS |
| Camera ESP32-S3 | mép trước, gần đường tâm dọc, chĩa xuống khoảng 30°, đệm cao su | nhìn chếch xuống phía trước; gần tâm để ít lệch trọng tâm |
| GPS M10 | cột ở đuôi tấm trên, cao từ 8 đến 10 cm, mũi tên cùng hướng bo bay | la bàn xa dòng lớn của ESC và dây pin |
| Bộ thu iA6B | đuôi tấm trên, hai anten vuông góc, cách dây nguồn từ 5 cm | anten xa nguồn nhiễu |
| ESP32, UBEC, bảng chia | phía sau, tầng dưới, anten PCB ló ra ngoài khung | anten không bị khung hay pin che |
| Pin 4S | dưới tấm đế, velcro và dây đai qua khe | dịch tới lui để cân trọng tâm |

Tấm đế S500 là bo chia nguồn có đường đồng đúc chìm, nên không khoan thêm lỗ. @fig:c2-bo-tri-hd vẽ cùng bố trí đúng tỉ lệ ở
hai góc, kể cả vùng quét của cánh 10 inch. Sau khi gắn đủ, trọng tâm được kiểm bằng hai ngón tay đỡ hai cần đối xứng: lệch
thì dịch pin 5 mm mỗi lần tới khi khung nằm ngang trong ± 5°.

!![Bố trí đúng tỉ lệ: nhìn từ trên với vùng quét cánh (trái), nhìn ngang với cột GPS, TFmini ngẩng 2 đến 3°, camera chúc khoảng 30° (phải)](docs/thuyet-trinh/img/real/hd-bo-tri-khung-tren.png|docs/thuyet-trinh/img/real/hd-bo-tri-khung-ngang.png){#fig:c2-bo-tri-hd w=7.5}

## Chống rung cho bo bay

Gyro và gia tốc kế đo cả rung của motor; rung lớn làm bộ ước lượng EKF lệch, ảnh hưởng thẳng tới các chế độ giữ độ cao và vị
trí. Khung S500 không có lỗ 30,5 × 30,5 mm, nên stack không bắt cứng mà đặt trên bát chống rung 30,5 mm, mặt dưới bát bắt vào
lỗ có sẵn của tấm trên. Stack chồng theo @fig:c2-chong-rung: ESC dưới, đệm silicone kẹp giữa hai tầng, bo bay trên với vỏ
silicone trong bốn lỗ, khoá bằng ốc nylon. Không ốc nào xuyên từ bát xuống khung, vì như vậy sẽ nối cứng lại.

![Stack nổ tầng trên bát chống rung: ốc nylon, bo bay F405 V5, đệm silicone, ESC OX32, bát 30,5 mm, cáp 10 chân 25 mm](docs/thuyet-trinh/img/real/hd-stack-chong-rung.png){#fig:c2-chong-rung w=11}

Đứng yên, rung đo được 0,01 đến 0,07 m/s²; Motor Test không cánh ở ga 30 %, 0,02 đến 0,15 m/s² trên ba trục. Trong 11 chuyến
bay thật, rung p95 trục Z là 10,8 đến 19,5 m/s², lớn nhất 26,1 m/s², đều dưới ngưỡng tốt 30 m/s², và gia tốc kế không bão hoà
lần nào (clip 0). Dây motor bó dọc mặt dưới cần bằng 3 dây rút mỗi cần, dây tín hiệu đi trên tấm trên, tách xa dây motor.

## Thứ tự motor và chiều quay

ESC OX32 đánh số motor theo kiểu Betaflight, khác sơ đồ Quad X chuẩn của ArduPilot. Nhóm em giữ `FRAME_CLASS 1`,
`FRAME_TYPE 1` và ánh xạ lại bốn đầu ra bằng `SERVO1..4_FUNCTION`, tương đương `FRAME_TYPE 12` (Quad X kiểu Betaflight).
@tab:c2-motor ghi theo vị trí (trước phải, sau trái) để không nhầm khi lắp.

Bảng: Thứ tự, chiều quay và ánh xạ bốn motor {#tab:c2-motor}

| Đầu ra ESC | Vị trí | Chiều quay | Ren trục | Tham số |
|---|---|---|---|---|
| M1 | sau phải | thuận kim (CW) | ren trái | `SERVO1_FUNCTION 36` (Motor4) |
| M2 | trước phải | ngược kim (CCW) | ren phải | `SERVO2_FUNCTION 33` (Motor1) |
| M3 | sau trái | ngược kim (CCW) | ren phải | `SERVO3_FUNCTION 34` (Motor2) |
| M4 | trước trái | thuận kim (CW) | ren trái | `SERVO4_FUNCTION 35` (Motor3) |

Hai motor chéo nhau quay cùng chiều để mô men xoắn của hai cặp triệt nhau; muốn xoay mũi, bo bay tăng ga một cặp và giảm cặp
kia. Ren trục ngược chiều quay để cánh tự siết khi chạy: ren phải ở vị trí CCW, ren trái ở vị trí CW; cánh CW là loại
"pusher", thường in chữ R (@fig:c2-chieu-quay).

!![Chiều quay bốn motor nhìn từ trên (trái) và sơ đồ Quad X thứ tự Betaflight của ArduPilot, ứng với FRAME_TYPE 12 (phải)](docs/thuyet-trinh/img/real/hd-chieu-quay-motor.png|assignment/_build/img/official/ardupilot/m_01_12_quad_x_bf.png){#fig:c2-chieu-quay w=6.5}

Tín hiệu tới ESC là DShot300 (`MOT_PWM_TYPE 5`), giao thức số nên không cần hiệu chỉnh dải ga ESC; 300 được chọn thay 600 vì
dung sai nhiễu tốt hơn. Thứ tự và chiều quay được kiểm bằng Motor Test không cánh: người vận hành bấm từng motor trong Mission
Planner, script đọc vòng quay qua telemetry ESC. Bốn motor quay đều (@fig:c2-rpm): 41 lần khởi động không lần nào khựng, ở ga
30 % đạt 4 462 đến 4 514 vòng/phút, lệch nhau không quá 2,8 %.

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/motor-test-rpm-20261115.csv
x: motor
y: rpm_ga_13pct,rpm_ga_30pct
legend: Ga 13 %,Ga 30 %
xlabel: Motor
ylabel: Vòng quay (vòng/phút)
caption: Vòng quay bốn motor khi Motor Test không cánh ở ga 13 % và 30 %, đọc từ telemetry ESC
id: fig:c2-rpm
w: 12
```

## Lắp ráp

Việc lắp chia thành bảy chặng A đến G, tổng 76 bước, mỗi bước có ô tick trong trang hướng dẫn tương tác
`docs/huong-dan/lap-rap-phan-cung.html` (sơ đồ, mô hình 3D, cảnh báo từng bước). Ba chặng C, D, E làm trên bàn khi chưa có
khung: mỗi chuỗi (tay phát tới bo bay, pin tới ESC tới motor, bo bay tới ESP32 tới laptop) được nối và kiểm riêng, nên khi có
lỗi chỉ có vài chỗ để tìm. Mọi chuỗi chạy đúng mới chuyển sang chặng F lắp khung. Cánh tháo tới bước G9, vì motor 2216 với
cánh 10 inch đủ sức gây thương tích (@fig:c2-chang, @tab:c2-chang).

![Bảy chặng lắp ráp A đến G, chiều rộng tỉ lệ số bước: xám là chuẩn bị, xanh là làm trên bàn, đỏ là lắp khung, xanh lá là hiệu chỉnh](docs/thuyet-trinh/img/tikz/F09.png){#fig:c2-chang w=16}

Bảng: Bảy chặng lắp ráp, 76 bước {#tab:c2-chang}

| Chặng | Bước | Nội dung chính |
|---|---|---|
| A. Chuẩn bị | 4 | chỗ làm, dụng cụ, tập hàn trên bảng tập, 6 luật an toàn |
| B. Kiểm hàng | 9 | đếm 24 món hộp stack, soi motor, chia 2 ren phải và 2 ren trái, đo từng cell pin |
| C. Tay phát, GPS trên bàn | 9 | cáp bộ thu vào R6, bind, gán kênh, failsafe hai lớp, cáp GPS 6 dây, hàn còi |
| D. Nguồn, motor, ESC trên bàn | 14 | 12 dây motor vào ESC, hàn XT60, tụ, dây UBEC, chồng stack, cấp pin qua smoke stopper, Motor Test |
| E. ESP32, TFmini, camera trên bàn | 11 | hotspot, bảng chia, ESP32 vào SERIAL2, TFmini thử qua USB-TTL rồi hàn R3, T3, chạy cả chuỗi 10 phút |
| F. Lắp khung S500 | 18 | 4 cần, chân đáp, motor đúng ren, bát chống rung, nối dài 12 mối dây motor, đi dây, gắn linh kiện, cân trọng tâm |
| G. Hiệu chỉnh trên khung | 11 | accel 6 tư thế, la bàn ngoài trời, radio, chiều quay không cánh, failsafe, rào ảo, arm thử, gắn cánh |

Lần cấp pin đầu (bước D6) đi qua smoke stopper đặt ở 1 A, mạch ngắt dòng khi có chập; mạch tháo ra trước khi chạy motor. Dây gốc
của motor chỉ dài 150 mm trong khi stack ở tâm, nên mỗi motor được nối dài khoảng 30 cm bằng dây 16 AWG: mối nối chồng 6 đến
8 mm, ba mối so le 2 cm, gen nhỏ bọc từng mối và gen to bọc cả bó. Sau mỗi motor đo ba pha thông, ba điện trở pha với pha bằng
nhau, pha với vỏ không thông. Mười hai mối hàn này mất khoảng 3 đến 4 giờ. Dụng cụ chính: mỏ hàn từ 60 W (330 đến 350 °C cho
pad nhỏ, 380 đến 400 °C cho dây 16 AWG và pad nguồn), đồng hồ vạn năng, bộ lục giác 1,5, 2,0, 2,5 mm, keo khoá ren, túi chống
cháy LiPo, kính bảo hộ.

Trang hướng dẫn có mô hình 3D dựng theo kích thước linh kiện, xoay và tách lớp được, dùng để xem trước vị trí từng món
(@fig:c2-3d).

!![Mô hình 3D trong trang hướng dẫn: tách lớp có nhãn linh kiện (trái) và drone lắp xong nhìn chéo từ trước (phải)](docs/thuyet-trinh/img/real/hd-3d-tach-lop-nhan.png|docs/thuyet-trinh/img/lap-rap-3d-tren-truoc.png){#fig:c2-3d w=7.5}

## Drone hoàn chỉnh

@fig:c2-drone là chiếc drone nhóm em đã lắp xong. Nhìn từ trên thấy stack ở tâm với tụ 1 500 µF 35 V, UBEC, cột GPS, bo ESP32
và chân đáp; ảnh nghiêng là drone đủ cánh. Sau khi lắp, phần cứng được kiểm trên bàn theo 12 hạng mục (bo bay, IMU, áp kế, la
bàn, tham số, ESC và motor, tay phát, TFmini, pin, DroneBridge, camera, cơ khí) và đạt cả 12; chi tiết ở chương Thực nghiệm.

!![Drone hoàn chỉnh của nhóm: nhìn nghiêng đủ cánh (trái) và nhìn từ trên thấy stack, tụ, UBEC, GPS, ESP32 (phải)](docs/thuyet-trinh/img/real/drone-nghieng.png|docs/thuyet-trinh/img/real/drone-tren.png){#fig:c2-drone w=7.5}
