# Cấu hình và hiệu chỉnh

Firmware chỉ là khung; drone bay ra sao do khoảng chín trăm tham số của ArduCopter quyết định. Chương này trình bày
cách nhóm em tổ chức tham số thành file, các nhóm tham số chính (cổng serial, khung và motor, pin, failsafe, rào ảo,
tránh vật cản), bản đồ tay cầm FS-i6X với các chế độ bay, và năm bước hiệu chỉnh cảm biến cùng số đo xác nhận từng
bước. Giá trị nêu trong chương đọc từ bản chụp 889 tham số của bo thật ngày 15/11/2026 và từ các file trong
`firmware/ardupilot/params/`.

## Ba file tham số

Tham số được giữ trong git dưới dạng file văn bản, mỗi dòng `TÊN,giá trị`, có chú thích lý do ngay trên dòng. Nhóm
em tách thành ba file theo việc, nạp lần lượt bằng `scripts/fc/nap_param.py` (chương 3).

Bảng: Ba file tham số của dự án {#tab:c4-file-param}

| File | Số dòng | Nội dung |
|---|---|---|
| `00-after-flash.param` | 852 | bản chụp mặc định ngay sau khi nạp firmware, dùng để đối chiếu và khôi phục |
| `01-base.param` | 194 | cổng serial, khung, motor, pin, failsafe, tốc độ, RTL, log |
| `02-avoid-tfmini.param` | 123 | TFmini Plus, proximity, tránh vật cản, rào ảo |

File tham số chỉ chứa những giá trị tính hoặc chọn được trên giấy. Ba thứ phải đo trên chính con drone là radio, la
bàn và accel thì làm bằng trình hướng dẫn của Mission Planner (mục cuối chương này), không nạp từ file.

## Cổng serial, khung và motor

### Chia cổng serial

Bo F405 V5 có sáu UART dùng được. Mỗi thiết bị ngoại vi gắn một cổng, chọn giao thức bằng `SERIALn_PROTOCOL` và tốc độ
bằng `SERIALn_BAUD` (giá trị viết tắt: 115 nghĩa là 115 200 baud).

Bảng: Bản đồ cổng serial của bo bay {#tab:c4-serial}

| Cổng | Thiết bị | Giao thức | Baud |
|---|---|---|---|
| SERIAL0 (USB-C) | laptop khi ở trên bàn | MAVLink | USB |
| SERIAL1 | module Bluetooth trong bo, không dùng | −1 (tắt) | |
| SERIAL2 (T2/R2) | ESP32 DroneBridge | 2 (MAVLink2) | 115 200 |
| SERIAL3 (T3/R3) | TFmini Plus | 9 (Rangefinder) | 115 200 |
| SERIAL4 | GPS Holybro M10 | 5 (GPS) | 230 400 |
| SERIAL5 | telemetry ESC OX32 | 16 (ESC Telemetry) | firmware cố định |
| SERIAL6 (R6) | bộ thu FlySky iA6B | 23 (RCIN), `RC_PROTOCOLS 4` = iBUS | |

UART2 là cổng duy nhất của bo có DMA, nên được dành cho luồng MAVLink tới DroneBridge, luồng có lưu lượng lớn nhất.

### Thứ tự motor

ESC 4 trong 1 OX32 đánh số motor theo kiểu Betaflight, khác sơ đồ Quad X mặc định của ArduPilot. ArduPilot có sẵn
kiểu khung này (`FRAME_TYPE 12`, @fig:c4-quad-bf). Nhóm em đặt `FRAME_CLASS 1` (Quad), `FRAME_TYPE 1` và gán lại bốn
đầu ra `SERVO1..4_FUNCTION` = 36, 33, 34, 35 (Motor4, Motor1, Motor2, Motor3), cho kết quả tương đương. Đầu ra 1 đến 4
lần lượt nối motor sau-phải, trước-phải, sau-trái, trước-trái. Bản drone ảo SITL chạy mô hình vật lý `-f bfx` cho khớp.

![Sơ đồ Quad X kiểu Betaflight của ArduPilot: số motor và chiều quay nhìn từ trên (ảnh từ tài liệu ArduPilot).](assignment/_build/img/official/ardupilot/m_01_12_quad_x_bf.png){#fig:c4-quad-bf w=7}

Bảng: Tham số motor và ESC {#tab:c4-motor}

| Tham số | Giá trị | Lý do |
|---|---|---|
| `MOT_PWM_TYPE` | 5 (DShot300) | lệnh số, chịu nhiễu tốt hơn DShot600 |
| `SERVO_BLH_POLES` | 14 | số cực của motor 2216, để đổi tần số điện ra vòng/phút |
| `SERVO_BLH_TRATE` | 10 Hz | nhịp telemetry ESC |
| `MOT_SPIN_ARM` | 0,13 | vòng chờ khi ARM, nhỏ hơn `MOT_SPIN_MIN` 0,15 |
| `TKOFF_RPM_MIN`, `TKOFF_RPM_MAX` | 1 000, 4 000 vòng/phút | chặn cất cánh khi có motor chưa quay đủ vòng |
| `MOT_BAT_VOLT_MAX`, `MIN` | 16,8 V, 13,2 V | bù sụt áp pin 4S cho vòng điều khiển |

`TKOFF_RPM_MIN` dựa vào telemetry vòng quay mà ESC gửi về qua SERIAL5. Sau khi ARM, bo bay giữ cả bốn motor ở vòng
chờ và chỉ cho tăng ga cất cánh khi cả bốn ESC báo vòng quay nằm trong 1 000 đến 4 000 vòng/phút. Vòng chờ đo được ở
pin 15,5 V là 1 850 đến 1 960 vòng/phút, nằm trong dải; cận trên 4 000 loại bỏ số rác của telemetry. Nếu một motor
khởi động chậm, web báo `Takeoff blocked: ESC RPM out of range`, người lái tắt ARM và ARM lại.

## Lưới an toàn trong firmware

Các phản ứng an toàn đặt trong firmware chứ không đặt trong backend, vì firmware chạy trên chính drone, không phụ
thuộc laptop hay Wi-Fi. Laptop tắt giữa chuyến thì drone vẫn được rào giữ và vẫn tự về khi mất tay cầm.

### Failsafe

Failsafe là phản ứng tự động khi một điều kiện an toàn bị vi phạm. @tab:c4-failsafe liệt kê các tình huống và phản
ứng đã cấu hình.

Bảng: Tình huống và phản ứng tự động của bo bay {#tab:c4-failsafe}

| Tình huống | Tham số | Phản ứng |
|---|---|---|
| Mất sóng tay cầm | `FS_THR_ENABLE 1`, `FS_THR_VALUE 975` | RTL |
| Pin dưới 14,0 V đủ 10 s | `BATT_LOW_VOLT 14,0`, `BATT_FS_LOW_ACT 2` | RTL |
| Pin dưới 13,2 V | `BATT_CRT_VOLT 13,2`, `BATT_FS_CRT_ACT 1` | LAND tại chỗ |
| EKF hỏng | `FS_EKF_ACTION 1` | LAND |
| Ra khỏi rào ảo | `FENCE_ACTION 1` | RTL (không có GPS thì LAND) |
| Mất Wi-Fi | `FS_GCS_ENABLE 0` | không đổi, vẫn nghe tay cầm |

Cách bo bay biết mất sóng tay cầm là một mẹo của bộ thu. Lúc bình thường kênh ga (CH3) không bao giờ xuống dưới
khoảng 1 000 µs. Bộ thu iA6B được cài failsafe: mất sóng thì đẩy CH3 xuống −118 %, khoảng 911 µs. Bo bay thấy CH3 dưới
`FS_THR_VALUE` 975 µs thì hiểu là mất sóng và kích RTL. Hiệu chỉnh radio phải giữ `RC3_MIN` cao hơn ngưỡng ít nhất
10 µs; giá trị đang có là 1 006 µs. Thử trên drone thật: tắt tay phát, CH3 rơi xuống 911 µs và bo bay báo
`Radio Failsafe` trong chưa tới 0,1 s.

Mất Wi-Fi được cố ý để không làm gì. Tay cầm RC là đường lái chính và có tầm xa hơn Wi-Fi; nếu mất Wi-Fi mà kích RTL,
drone sẽ tự quay về mỗi lần bay ra ngoài tầm Wi-Fi dù người lái vẫn đang điều khiển tốt.

### Ngưỡng pin

Pin là Ovonic 4S 5 300 mAh. Ngưỡng tính theo điện áp mỗi cell: 3,5 V/cell cho mức cảnh báo, 3,3 V/cell cho mức nguy
hiểm.

Bảng: Tham số pin {#tab:c4-pin}

| Tham số | Giá trị | Cách tính |
|---|---|---|
| `BATT_MONITOR` | 4 | đo áp và dòng analog |
| `BATT_VOLT_MULT` | 11,0 | hệ số chia áp theo phần cứng của bo |
| `BATT_AMP_PERVLT` | 370,4 A/V | từ thông số SpeedyBee `Scale=27`: 10 000 / 27 |
| `BATT_CAPACITY` | 5 300 mAh | dung lượng pin thật |
| `BATT_LOW_VOLT` | 14,0 V | 4 × 3,5 V |
| `BATT_CRT_VOLT` | 13,2 V | 4 × 3,3 V |
| `BATT_LOW_MAH` | 1 060 mAh | chừa 20 % dung lượng cho tuổi thọ pin |

Trong 11 chuyến bay thật, điện áp cuối chuyến thấp nhất là 14,76 V, chưa chạm mức cảnh báo nào.

### Rào ảo hình trụ

Rào ảo (geofence) `FENCE_TYPE 3` gồm hai phần: trần độ cao so với điểm cất cánh (bit 0) và vòng tròn quanh home (bit
1), ghép lại thành một hình trụ (@fig:c4-rao-tru). Bật rào thì bo bay đòi có GPS mới cho ARM.

![Rào ảo hình trụ quanh điểm cất cánh: bán kính 100 m, trần 20 m, lái tay bị chặn leo ở 18 m, RTL bay ở 15 m.](docs/thuyet-trinh/img/tikz/F15.png){#fig:c4-rao-tru w=10}

Bảng: Tham số rào ảo, tốc độ và RTL {#tab:c4-rao}

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `FENCE_RADIUS` | 100 m | vòng tròn quanh home |
| `FENCE_ALT_MAX` | 20 m | trần |
| `FENCE_MARGIN` | 2 m | lề: chế độ giữ vị trí dừng trước rào 2 m |
| `RTL_ALT_M` | 15 m | khi về nhà leo hoặc giữ 15 m rồi mới bay ngang |
| `LOIT_SPEED_MS`, `WP_SPD` | 3 m/s | tốc độ ngang ở Loiter và khi bay mission |

Ở các chế độ có giữ vị trí, bo bay coi rào như bức tường mềm: lái tay đẩy hết ga lên thì drone dừng leo ở 20 − 2 =
18 m, đẩy tiến về phía rào thì dừng trước rào 2 m. Ở chế độ không giữ vị trí, drone chạm rào sẽ chuyển RTL. Trên
drone ảo với rào 100 m, Loiter ga hết cỡ dừng ở 18,1 m và Loiter tiến hết cỡ dừng ở 98,1 m. Trên drone thật, độ cao
lớn nhất trong 11 chuyến là 18,3 m, đúng trần trừ lề. Backend có thêm một lớp giới hạn phụ khi bay thật (`MAX_ALT` 18 m,
`MIN_ALT` 2 m, `MAX_DISTANCE_HOME` 95 m, cách rào 5 m) để mission soạn trên web không bao giờ chạm tới rào của bo bay.

## Tránh vật cản bằng TFmini Plus

TFmini Plus là LiDAR đo khoảng cách bằng thời gian bay của xung ánh sáng hồng ngoại, chùm tia hẹp 3,6°, gắn ở mũi
drone nhìn thẳng ra trước (@fig:c4-tia-tfmini). Sau khi cấu hình, cảm biến chạy khoảng 100 khung/s, đơn vị cm. Chuỗi
xử lý trong ArduCopter có ba lớp: driver rangefinder đọc khoảng cách, lớp proximity coi rangefinder là một cảm biến
vật cản theo hướng, và thư viện AC_Avoid điều chỉnh lệnh bay theo khoảng cách đó.

![Mô hình 3D drone nhìn ngang: tia TFmini Plus (cam) ở mũi và nón nhìn của camera (tím).](docs/thuyet-trinh/img/real/hd-3d-ben-nhan-tia.png){#fig:c4-tia-tfmini w=10}

Bảng: Tham số rangefinder, proximity và tránh vật cản {#tab:c4-avoid}

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `RNGFND1_TYPE` | 20 | Benewake TFmini Plus qua UART |
| `RNGFND1_ORIENT` | 0 | nhìn thẳng trước |
| `RNGFND1_MIN`, `MAX` | 0,1 m, 6 m | dải đo dùng |
| `PRX1_TYPE` | 4 | lấy rangefinder làm proximity (chỉ có ở bản dựng riêng) |
| `AVOID_ENABLE` | 3 | bit 0 xét rào, bit 1 xét proximity |
| `AVOID_BEHAVE`, `AVOID_MARGIN` | 1, 2 m | Loiter, PosHold dừng cách vật 2 m |
| `AVOID_DIST_MAX`, `AVOID_ANG_MAX` | 5 m, 10° | AltHold nghiêng lùi khi vật gần hơn 5 m, tối đa 10° |
| `AVOID_BACKUP_SPD` | 0,75 m/s | tốc độ lùi khi quá gần |
| `OA_TYPE` | 0 | AUTO không tự tìm đường vòng |

Tránh vật cản có ở Loiter, PosHold, AltHold và khi web lái bằng vận tốc ở Guided. Stabilize không tránh vì là chế độ
lái hoàn toàn bằng tay. AUTO không tìm đường vòng vì một tia 3,6° nhìn thẳng chỉ cho biết có vật ở ngay trước, không đủ
để biết đi vòng bên nào. Trên drone ảo với TFmini ảo và nguyên file tham số này, drone Loiter đẩy cần tiến thẳng vào
cột dừng cách cột 1,07 m; lần đối chứng tắt AVOID bay xuyên qua cột.

Trên bàn, TFmini đọc qua bo bay bằng `scripts/fc/tfmini_qua_fc.py` bám vật từ 10 đến 260 cm (@fig:c4-tfmini), vật đặt
cách khoảng 1 m đọc ra 98 đến 104 cm. Khi bay chuyến 10:40 ngày 02/11, TFmini đo trung bình 2,1 m, lớn nhất 3,2 m.

```chart
type: line
csv: docs/thuyet-trinh/facts/data/tfmini-chuoi-20261115.csv
x: t_s
y: distance_cm
xlabel: Thời gian (s)
ylabel: Khoảng cách (cm)
caption: Khoảng cách TFmini Plus đọc qua gói DISTANCE_SENSOR của bo bay khi đưa vật lại gần rồi ra xa, 15/11/2026.
id: fig:c4-tfmini
w: 13
```

## Tay cầm FS-i6X và chế độ bay

Tay phát FlySky FS-i6X gửi sóng 2,4 GHz tới bộ thu iA6B; bộ thu chuyển sang chuẩn iBUS cho bo bay đọc 14 kênh. Mỗi
kênh là một giá trị độ rộng xung từ 1 000 đến 2 000 µs. Bốn kênh đầu là hai cần gạt; nhóm em dùng thêm bốn công tắc
và một núm xoay (@fig:c4-tay-cam).

![Tay phát FS-i6X: năm công tắc và núm xoay được dùng, kênh và chức năng của từng cái.](docs/thuyet-trinh/img/tikz/F16.png){#fig:c4-tay-cam w=10}

Bảng: Bản đồ công tắc, kênh và chức năng {#tab:c4-kenh}

| Công tắc | Kênh | Tham số | Chức năng |
|---|---|---|---|
| SwC (3 nấc) | CH5 | `FLTMODE_CH 5`, `FLTMODE1 0`, `FLTMODE4 2`, `FLTMODE6 5` | lên Stabilize, giữa AltHold, xuống Loiter |
| SwD | CH6 | `RC6_OPTION 4` | xuống: RTL |
| SwA | CH7 | `RC7_OPTION 0` | bật quyền lái cho web (backend đọc) |
| SwB | CH8 | `RC8_OPTION 153` | xuống ARM, lên DISARM |
| Núm VrB | CH9 | `RC9_OPTION 16` | xoay quá khoảng 1 800 µs: AUTO |

Ba chế độ trên SwC khác nhau ở phần bo bay tự lo. Stabilize chỉ giữ thăng bằng, người lái tự giữ độ cao và vị trí.
AltHold dùng baro để giữ độ cao, người lái lo hướng và vị trí. Loiter dùng thêm GPS để giữ cả vị trí, thả cần là drone
đứng yên; đây là chế độ nên dùng khi cất cánh. Hai chế độ tự động có lối riêng: SwD gạt xuống là RTL, núm VrB xoay hết
là AUTO để bay mission, lùi núm về thì trở lại chế độ của SwC. Web chỉ lái được ở Guided, và chỉ khi SwA bật, nên
người cầm tay phát luôn là người quyết định có giao quyền cho web hay không.

SwB là công tắc ARM. Gán ARM vào công tắc riêng giúp tắt motor ngay khi cần, đổi lại người lái phải nhớ không chạm SwB
khi drone đang bay. Lần kiểm ngày 15/11/2026: bốn cần đủ 1 000 đến 2 000 µs, về giữa ở 1 498 đến 1 501 µs; CH5 đúng ba
mức 1 000, 1 500, 2 000 µs; VrB qua 1 831 µs vào AUTO, xuống 1 779 µs về Stabilize.

## Hiệu chỉnh cảm biến và ESC

Cảm biến MEMS giá rẻ có sai số riêng của từng con chip, và la bàn còn bị nhiễu bởi kim loại, dây dẫn dòng lớn ngay trên
khung. Trước khi bay phải hiệu chỉnh năm thứ theo thứ tự ở @fig:c4-hieu-chinh. Người vận hành làm theo hướng dẫn trong
Mission Planner; sau mỗi bước agent đọc lại toàn bộ tham số và đối chiếu.

![Năm bước hiệu chỉnh và số đo xác nhận của từng bước.](docs/thuyet-trinh/img/tikz/F17.png){#fig:c4-hieu-chinh w=16}

Accel 6 mặt đặt drone ở sáu tư thế để đo vector trọng lực theo cả hai chiều của mỗi trục, từ đó tính độ lệch gốc
(offset) và hệ số nhân (scale) của từng trục. Level cho bo bay biết thế nào là nằm ngang so với khung. La bàn phải
hiệu chỉnh ngoài trời, xa sắt thép: xoay drone đủ mọi hướng, số đo vẽ thành một mặt cầu bị lệch tâm, và độ lệch tâm
đó là phần nhiễu cố định (hard iron) cần trừ đi. Mức độ tin được kiểm bằng cách so cường độ từ trường đo được với mô
hình từ trường Trái Đất WMM tại vị trí bay.

Bảng: Kết quả hiệu chỉnh đang chạy trên bo {#tab:c4-hieu-chinh}

| Bước | Giá trị lưu trên bo | Số đo xác nhận |
|---|---|---|
| Accel 6 mặt | `INS_ACCSCAL` 1,0013 / 1,0035 / 1,0002; `INS_ACCOFFS` 0,0065 / 0,0560 / 0,0545 | scale lệch ≤ 0,35 % |
| Level | `AHRS_TRIM_X` 0,0449 rad, `AHRS_TRIM_Y` −0,0146 rad | nằm yên đọc pitch −0,11°, roll +0,12° (22 mẫu) |
| La bàn IST8310 | `COMPASS_OFS` 35,1 / 23,0 / 52,7 (độ lớn 67); `COMPASS_SCALE` 1,005 | khớp WMM trong 0,5 %, `compass_variance` ≤ 0,002 |
| Radio | RC1, 2, 4: 1 000 / 1 500 / 2 000; RC3: 1 006 / 1 009 / 2 000 | `RC3_MIN` > 975 + 10 |
| ESC OX32 | `MOTOR_TIMING` 20, chống mất đồng bộ mức High, `DRIVER_RAMP_POWER` 80 | 41 lần khởi động, 0 lần khựng |

Độ lớn offset la bàn 67 nằm rất xa ngưỡng 1 800 mà bo bay chặn ARM. Độ từ thiên bo tự tính theo vị trí GPS là
`COMPASS_DEC` −1,9°. GPS u-blox M10 kiểm ngoài trời đạt fix 3D với 18 vệ tinh, HDOP 0,65; suốt 11 chuyến bay, số vệ
tinh từ 15 đến 28 và HDOP không quá 0,89. HDOP (hệ số suy giảm độ chính xác ngang) dưới 1 nghĩa là vệ tinh phân bố đều
trên bầu trời, vị trí đo được tin cậy.

ESC OX32 được cấu hình qua trình duyệt Chrome tại `ox32.oxbot.com` (WebSerial) cho motor KV thấp với cánh 10 inch:
`MOTOR_TIMING` 20, `DRIVER_DEMAG_COMPENSATION` 2, `DRIVER_RAMP_POWER` 80, `PROTECTION_LOW_SPEED_POWER` 2. Sau đó Motor
Test không lắp cánh được người vận hành bấm trong Mission Planner (@fig:c4-motor-test), còn script ghi số đo qua cổng
UDP 14552 của MAVProxy.

![Trang Motor Test của Mission Planner: chọn motor, mức ga và thời gian quay (ảnh từ tài liệu ArduPilot).](assignment/_build/img/official/ardupilot/MissionPlanner_MotorTest.png){#fig:c4-motor-test w=8}

Bảng: Motor Test không cánh ngày 15/11/2026 {#tab:c4-motor-test}

| ESC | Vị trí | Khởi động / khựng | Vòng/phút ở ga 13 % | Vòng/phút ở ga 30 % | Nhiệt ESC |
|---|---|---|---|---|---|
| M1 | sau-phải | 10 / 0 | 2 098 đến 2 100 | 4 514 | 36 đến 39 °C |
| M2 | trước-phải | 11 / 0 | 2 100 | 4 509 đến 4 514 | 43 đến 45 °C |
| M3 | sau-trái | 10 / 0 | 2 042 | 4 462 đến 4 471 | 31 đến 33 °C |
| M4 | trước-trái | 10 / 0 | 2 071 | 4 506 đến 4 509 | 39 đến 41 °C |

Bốn motor quay đúng chiều, bắt vòng sau 0,05 đến 0,16 s, vòng quay lệch nhau không quá 2,8 %. Cả bốn cùng quay ở ga
30 % thì rung đo trên IMU là 0,12 / 0,20 / 0,12 m/s² theo ba trục, rất thấp so với mức 15 m/s² mà ArduPilot coi là tốt.
Sau khi hiệu chỉnh, `scripts/fc/kiem_phan_cung.py` rà lại cả bo: lỗi nội bộ 0, IMU đo trọng lực 998 mG, rung đứng
yên 0,01 đến 0,07 m/s².
