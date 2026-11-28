# Truyền thông

Dữ liệu của hệ thống đi qua bốn chặng: từ bo bay sang ESP32 bằng UART, từ hai bo ESP32 về laptop bằng Wi-Fi, trong
laptop giữa backend và các tab trình duyệt, và riêng một đường vô tuyến RC từ tay phát tới bộ thu. Chương này nói
từng chặng: nền tảng UART, Wi-Fi 2,4 GHz, UDP và TCP; giao thức MAVLink2 cùng các gói backend xin bo bay gửi; cấu hình
mạng Wi-Fi ngoài bãi bay và số đo của nó; và bốn mô hình trao đổi dữ liệu IoT mà hệ thống đang chạy.

Bảng: Các liên kết truyền thông của hệ thống {#tab:c5-lien-ket}

| Liên kết | Môi trường | Giao thức | Dữ liệu |
|---|---|---|---|
| Tay phát FS-i6X → bộ thu iA6B → bo bay | vô tuyến 2,4 GHz, rồi dây | AFHDS 2A, iBUS | 14 kênh RC, đường lái chính |
| Bo bay ↔ ESP32 DroneBridge | dây, UART2 | MAVLink2, 115 200 baud | telemetry, lệnh, mission |
| ESP32 DroneBridge ↔ laptop | Wi-Fi 2,4 GHz | UDP cổng 14550 | MAVLink2 đóng gói |
| Camera ESP32-S3 → laptop | Wi-Fi 2,4 GHz | HTTP trên TCP, cổng 81 | MJPEG VGA |
| Backend ↔ trình duyệt | trong laptop | WebSocket `/ws`, REST `/api/*`, HTTP | JSON, video |

## Nền tảng: UART, Wi-Fi 2,4 GHz, UDP và TCP

### UART

UART là cổng nối tiếp không đồng bộ: hai bên không chung đường xung nhịp mà thống nhất trước tốc độ baud. Mỗi byte
truyền thành một khung 10 bit theo kiểu 8N1: một bit start mức thấp, 8 bit dữ liệu, không bit chẵn lẻ, một bit stop
mức cao. Ở 115 200 baud, đường truyền chở tối đa 115 200 / 10 = 11 520 byte/s mỗi chiều. Dây nối bắt chéo: TX của bên
này vào RX của bên kia, và hai bên phải chung GND để cùng một mức 0 V. Bo bay và ESP32 đều dùng logic 3,3 V nên nối
thẳng được (@fig:c5-uart).

![Nối ESP32 DroneBridge với cổng SERIAL2 của bo bay: T2 vào RX2 (GPIO16), R2 vào TX2 (GPIO17), GND chung, ESP32 lấy nguồn 5 V riêng từ UBEC.](docs/thuyet-trinh/img/real/hd-esp32-fc-serial2.png){#fig:c5-uart w=11}

### Wi-Fi 2,4 GHz

Cả hai bo ESP32 và ESP32-S3 chỉ có Wi-Fi băng 2,4 GHz, nên hotspot của laptop bị ép phát ở 2,4 GHz; để chế độ tự động
thì Windows có thể phát ở 5 GHz và hai bo không thấy mạng. Băng 2,4 GHz xuyên vật cản tốt hơn 5 GHz nhưng chật hơn.
Card Wi-Fi của laptop chỉ có một radio: nếu vừa nối một mạng khác vừa phát hotspot, nó phải chia thời gian phát giữa hai
kênh, và mỗi lần tự quét tìm mạng nó cũng tạm ngừng phát. Cường độ tín hiệu nhận RSSI tính bằng dBm, càng gần 0 càng
mạnh; quanh −90 dBm thì gói bắt đầu rơi nhiều.

### UDP và TCP

Hai giao thức vận chuyển của Internet được dùng cho hai loại dữ liệu khác nhau (@tab:c5-udp-tcp).

Bảng: So sánh UDP và TCP theo cách hệ thống dùng {#tab:c5-udp-tcp}

| | UDP | TCP |
|---|---|---|
| Kết nối | không, mỗi gói độc lập | bắt tay trước, giữ kết nối |
| Gói mất | mất luôn | tự gửi lại |
| Thứ tự | không bảo đảm | bảo đảm |
| Khi sóng yếu | gói sau vẫn tới đúng lúc | phải chờ gửi lại, luồng khựng |
| Dùng cho | MAVLink cổng 14550 | MJPEG cổng 81, WebSocket, REST |

Telemetry hợp với UDP: một gói ATTITUDE mất không cần gửi lại, vì 0,1 s sau đã có gói mới hơn. Những thứ không được
mất thì MAVLink tự lo ở tầng ứng dụng: lệnh có gói xác nhận, mission có giao thức hỏi từng điểm. Video MJPEG đi trên
HTTP nên dùng TCP; khi mất gói, TCP chờ gửi lại làm luồng khựng một nhịp, đó là lý do camera giữ khung mới nhất và
backend tự hạ chất lượng khi khung/s tụt.

## Giao thức MAVLink2

### Cấu trúc khung

MAVLink là giao thức nhị phân gọn nhẹ cho drone. Mỗi thiết bị có cặp mã (system id, component id): bo bay là (1, 1),
backend tự xưng GCS (254, 190). Mỗi khung MAVLink2 gồm phần đầu 10 byte, phần dữ liệu và 2 byte kiểm tra
(@tab:c5-khung).

Bảng: Các trường của một khung MAVLink2 theo đặc tả giao thức {#tab:c5-khung}

| Trường | Byte | Nội dung |
|---|---|---|
| STX | 1 | `0xFD`, đánh dấu đầu khung MAVLink2 |
| LEN | 1 | độ dài phần dữ liệu, 0 đến 255 |
| INCOMPAT, COMPAT FLAGS | 1 + 1 | cờ tính năng, ví dụ khung có chữ ký |
| SEQ | 1 | số thứ tự 0 đến 255, bên nhận đếm khoảng nhảy để biết mất gói |
| SYSID, COMPID | 1 + 1 | mã thiết bị gửi |
| MSGID | 3 | mã loại gói, ví dụ 0 là HEARTBEAT, 30 là ATTITUDE |
| PAYLOAD | 0 đến 255 | các trường của gói, số 0 ở cuối được cắt bớt |
| CHECKSUM | 2 | CRC-16 trên phần đầu (trừ STX) và phần dữ liệu, cộng một byte riêng của từng loại gói |
| SIGNATURE | 13 | tuỳ chọn, chữ ký chống giả mạo |

Byte CRC riêng của từng loại gói làm cho hai bên lệch định nghĩa gói sẽ loại gói ngay ở bước kiểm tra, thay vì đọc ra
số sai. Trang Lịch sử bay đếm khoảng nhảy của trường SEQ trong các gói của bo bay ghi ở tlog để tính tỉ lệ mất gói MAVLink.

### Các gói xin bo bay gửi

Bo bay không tự gửi mọi thứ với nhịp cố định. Mỗi lần nối hoặc nối lại, backend gửi lệnh `MAV_CMD_SET_MESSAGE_INTERVAL`
cho từng loại gói trong @tab:c5-goi với đúng tần số cần dùng, nên băng thông Wi-Fi không tốn cho gói không ai đọc.

Bảng: Mười loại gói backend xin bo bay gửi và tần số {#tab:c5-goi}

| ID | Gói | Hz | Dùng cho |
|---|---|---|---|
| 0 | HEARTBEAT | 1 | chế độ bay, ARM, phát hiện mất liên kết |
| 1 | SYS_STATUS | 2 | cờ sức khoẻ cảm biến |
| 24 | GPS_RAW_INT | 2 | kiểu fix, số vệ tinh |
| 30 | ATTITUDE | 10 | chân trời giả |
| 33 | GLOBAL_POSITION_INT | 5 | vị trí trên bản đồ |
| 74 | VFR_HUD | 5 | tốc độ, tốc độ leo |
| 132 | DISTANCE_SENSOR | 5 | khoảng cách TFmini |
| 147 | BATTERY_STATUS | 1 | dòng, phần trăm pin |
| 193 | EKF_STATUS_REPORT | 2 | trạng thái EKF |
| 330 | OBSTACLE_DISTANCE | 5 | nhánh dành cho cảm biến vật cản 360° |

Cộng lại là 38 gói mỗi giây theo lịch. Ngoài ra backend nhận các gói sự kiện không theo nhịp: STATUSTEXT (thông báo chữ
của bo bay), COMMAND_ACK, HOME_POSITION (xin từng lần bằng `MAV_CMD_REQUEST_MESSAGE`) và các gói của giao thức mission.
Backend gom trạng thái mới nhất từ các gói này thành một bản telemetry JSON và phát cho web 8 lần mỗi giây.

### Lệnh và mission đi xuống

Chiều xuống dùng ba loại gói. `COMMAND_LONG` chở các lệnh có mã `MAV_CMD_*`: đổi chế độ, ARM, cất cánh, RTL, LAND, đặt
điểm mission hiện tại. Mỗi lệnh chờ COMMAND_ACK tối đa 3 s, nên web biết lệnh được nhận hay bị từ chối và vì sao.
`SET_POSITION_TARGET_LOCAL_NED` chở vận tốc khi người dùng lái bằng bàn phím ở chế độ Guided. Mission đi theo giao thức
hỏi đáp: backend gửi `MISSION_COUNT`, bo bay hỏi từng điểm bằng `MISSION_REQUEST_INT`, backend trả `MISSION_ITEM_INT`,
cuối cùng bo bay gửi `MISSION_ACK`. Vì chạy trên UDP, mỗi điểm chờ 3 s và thử lại tối đa 8 lần. Nạp xong, backend đọc
ngược mission từ bo bay và so từng trường, sai số độ cao cho phép 0,1 m.

### Lọc HEARTBEAT của bo DroneBridge

HEARTBEAT là gói "tôi còn sống" gửi mỗi giây, chở loại thiết bị, loại autopilot, chế độ bay và trạng thái ARM. Cổng
UDP 14550 của laptop nhận HEARTBEAT từ ba nguồn (@fig:c5-heartbeat): bo bay (1, 1), bo DroneBridge và trạm GCS. Bo
DroneBridge phát HEARTBEAT của riêng nó từ (1, 68), tức mượn đúng system id của bo bay, với trường `autopilot` là
`MAV_AUTOPILOT_INVALID` (giá trị 8) và `custom_mode` 0. Nếu chỉ lọc theo system id, một nửa số HEARTBEAT nhận được sẽ
báo chế độ STABILIZE và chưa ARM, và web sẽ hiển thị sai chế độ bay liên tục.

![Luồng MAVLink từ bo bay qua ESP32 về backend; cổng lọc chỉ giữ HEARTBEAT có autopilot khác INVALID.](docs/thuyet-trinh/img/tikz/F18.png){#fig:c5-heartbeat w=16}

Backend chỉ coi là đã nối khi gặp HEARTBEAT có `autopilot` khác INVALID, và khi đọc telemetry thì bỏ mọi HEARTBEAT có
`autopilot` INVALID, bất kể system id. Lọc theo trường autopilot phân biệt chắc chắn được, vì chỉ autopilot thật mới
điền loại autopilot.

DroneBridge chỉ gửi UDP tới những địa chỉ nó biết. Để bo luôn biết laptop, backend tự chào: mỗi 2 s, khi đang nghe
`udpin:0.0.0.0:14550`, backend gửi một HEARTBEAT kiểu GCS tới `DroneBridgeESP32.mshome.net:14550`. Khi bo nối lại Wi-Fi,
gói đầu tiên về tới laptop sau 0,27 s. Tường lửa Windows mở cổng UDP 14550 bằng `scripts/esp32/firewall-mavlink.ps1`.

## Mạng Wi-Fi ngoài bãi bay

Ngoài bãi không có Wi-Fi nhà. Laptop phát Mobile Hotspot `IOTCV-HOTSPOT` băng 2,4 GHz, địa chỉ laptop trên mạng này cố
định là 192.168.137.1; hai bo ESP32 nối vào ở chế độ STA (@fig:c5-mang). Internet cho laptop (bản đồ vệ tinh) lấy từ
iPhone qua cáp USB, nên card Wi-Fi của laptop không nối mạng nào khác và chỉ làm một việc là phát hotspot.

![Mạng ngoài bãi: iPhone cấp internet qua cáp USB, laptop phát hotspot 2,4 GHz cho bo DroneBridge và bo camera.](docs/thuyet-trinh/img/tikz/F19.png){#fig:c5-mang w=10}

Bảng: Cấu hình mạng ngoài bãi {#tab:c5-cau-hinh-mang}

| Mục | Cấu hình |
|---|---|
| Hotspot | `IOTCV-HOTSPOT`, 2,4 GHz, bật bằng `scripts\esp32\hotspot-on.ps1 -Restart` sau khi đã có mạng iPhone |
| Gọi hai bo | `DroneBridgeESP32.mshome.net`, `iotcv-camera.mshome.net` (Windows tự phân giải tên, IP DHCP đổi thế nào cũng gọi được) |
| Internet | iPhone qua cáp USB; Wi-Fi laptop không nối mạng nào |
| Card Wi-Fi | `che_do_bay.ps1 -Bat`: tắt tự quét, Maximum Performance, laptop không ngủ |
| Backend | `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550`, `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream` |
| Kiểm sóng | `py -3.13 scripts\esp32\wifi_ping_check.py`, ping đồng thời hai bo |

Cách cấp internet cho laptop được chọn bằng phép đo: ping hai bo ESP32 trên drone chạy pin, với ba cách laptop lấy
internet (@fig:c5-hotspot). Khi card vừa nối Wi-Fi nhà 5 GHz vừa phát hotspot, nó phải chia sóng; lấy internet qua cáp
iPhone thì card chỉ còn phát; tắt thêm tự quét thì không còn khoảng ngừng nào. Cấu hình thứ ba là cấu hình dùng ngoài
bãi: 150 lần ping không mất gói nào ở cả hai bo, camera đạt 9,2 khung/s. Hotspot giữ liên tục 28 phút trong lần ghi
10 s một mẫu, mọi mẫu đều thấy đủ hai bo.

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/mang-hotspot-cau-hinh-20261102.csv
x: cau_hinh_laptop
y: dronebridge_mat_pct,camera_mat_pct
legend: DroneBridge (MAVLink),Camera
xlabel: Cách laptop lấy internet
ylabel: Gói ping mất (%)
caption: Tỉ lệ mất gói ping tới bo DroneBridge và bo camera theo cách laptop lấy internet, đo ngày 02/11/2026; cấu hình thứ ba là cấu hình dùng ngoài bãi.
id: fig:c5-hotspot
w: 15
```

## Tầm liên kết khi bay

Số đo trong lúc bay lấy từ tlog mà backend ghi cho mọi gói MAVLink nhận được, ghép với log của bo bay và video ghi
trên laptop theo giờ GPS. @tab:c5-mat-goi tóm tắt sáu chuyến ngày 02/11/2026.

Bảng: Liên kết Wi-Fi trong sáu chuyến bay ngày 02/11/2026 {#tab:c5-mat-goi}

| Chuyến | Xa home nhất (m) | Mất gói MAVLink (%) | Camera trung bình (khung/s) |
|---|---|---|---|
| 10:10 | 42,0 | 3,5 | 7,0 |
| 10:14 | 49,6 | 1,8 | 6,5 |
| 10:23 | 28,9 | 4,2 | 4,6 |
| 10:26 | 28,7 | 4,7 | 4,7 |
| 10:30 | 27,2 | 12,1 | 4,7 |
| 10:40 | 27,8 | 2,9 | 5,5 |

MAVLink qua Wi-Fi dùng được tới khoảng 49 m, mất gói mỗi chuyến từ 1,8 đến 12,1 %, trung vị 3,9 %. RSSI của bo
DroneBridge trung bình −75 đến −80 dBm, thấp nhất −90 đến −93 dBm lúc ở xa. @fig:c5-rssi vẽ RSSI theo khoảng cách
trong chuyến xa nhất.

```chart
type: scatter
csv: docs/thuyet-trinh/facts/data/chuoi-20261102-101435.csv
x: dist_home_m
y: rssi_dbm
xlabel: Khoảng cách tới home (m)
ylabel: RSSI DroneBridge (dBm)
caption: RSSI của bo DroneBridge theo khoảng cách tới điểm cất cánh, chuyến 10:14 ngày 02/11/2026.
id: fig:c5-rssi
w: 13
```

Video nhạy với sóng yếu hơn telemetry. Mỗi khung VGA chất lượng 12 chụp cảnh ngoài trời khi bay nặng 24 đến 26 KB, 8 khung/s cần khoảng
1,6 Mbit/s, trong khi toàn bộ telemetry chỉ vài chục gói nhỏ mỗi giây. Camera giữ gần 8 khung/s trong 15 m đầu rồi giảm
dần (@fig:c5-camera-xa); đứng trên mặt đất cạnh laptop đạt 8,2 khung/s. Đây là lúc vòng tự chỉnh chất lượng của backend
(chương 3) làm việc: khung nhẹ đi tới khoảng 37 % thì số khung chở được tăng tới khoảng 1,6 lần.

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/camera-fps-theo-khoang-cach-20261102.csv
x: khoang_cach_home
y: fps_tb
xlabel: Khoảng cách tới home
ylabel: Khung/s trung bình
caption: Số khung camera về tới laptop mỗi giây theo khoảng cách tới home, mọi lần ARM ngày 02/11/2026.
id: fig:c5-camera-xa
w: 12
```

Ra ngoài tầm Wi-Fi, drone vẫn an toàn: `FS_GCS_ENABLE 0` nên mất Wi-Fi không kích failsafe, drone vẫn nghe tay cầm RC
và vẫn bị rào ảo giữ. Khi web đang lái ở Guided mà lệnh vận tốc ngừng tới bo bay khoảng 3 s, ArduPilot tự huỷ lệnh chuyển động và drone đứng lại.

## Bốn mô hình trao đổi dữ liệu IoT

Phía laptop, dữ liệu trao đổi theo bốn mô hình giao tiếp kinh điển của IoT, mỗi mô hình là một kênh đang chạy thật
(@fig:c5-mo-hinh). Nhóm em chọn mô hình theo tính chất của từng loại dữ liệu chứ không ép mọi thứ vào một kênh.

![Bốn mô hình giao tiếp trong hệ thống: yêu cầu, phản hồi qua REST; xuất bản, đăng ký qua bus sự kiện; đẩy, kéo qua luồng MJPEG; cặp độc quyền qua WebSocket.](docs/thuyet-trinh/img/asg/f5_mohinh.png){#fig:c5-mo-hinh w=12}

Bảng: Bốn mô hình, kênh và dữ liệu {#tab:c5-mo-hinh}

| Mô hình | Kênh | Ai khởi xướng | Dữ liệu |
|---|---|---|---|
| Yêu cầu, phản hồi | REST `/api/*`, 19 route | trình duyệt | trạng thái, cấu hình, mission, lịch sử bay |
| Xuất bản, đăng ký | bus sự kiện trong backend | nguồn sự kiện | sự kiện telemetry, AI, dead-man |
| Đẩy, kéo | MJPEG camera → backend → tab | camera đẩy, tab kéo | khung ảnh |
| Cặp độc quyền | WebSocket `/ws` | hai chiều, giữ suốt phiên | telemetry 8 Hz, lệnh lái |

Yêu cầu, phản hồi hợp với việc làm một lần và cần kết quả: `GET /api/status` hỏi trạng thái, `POST /api/mission` nạp
mission và trả kết quả đọc lại, `GET /api/flights` liệt kê các chuyến bay đã ghi. Mỗi yêu cầu có đúng một phản hồi.

Bus sự kiện là dạng xuất bản, đăng ký chạy trong một tiến trình (`backend/events.py`). Nguồn sự kiện (luồng telemetry
khi đổi chế độ hay nhận STATUSTEXT, pipeline AI khi thấy người, vòng dead-man khi tự dừng) chỉ gửi một lần; mọi tab đang
mở `/ws` đều nhận, và một vòng đệm 200 sự kiện cho tab mới mở đọc lại qua `GET /api/events`. Nguồn không cần biết ai
đang nghe. Sự kiện thấy người `vision.person_detected` chỉ phát khi đủ k trong n khung gần nhất có người và cách lần trước
ít nhất 4 s, để không dồn hàng chục thông báo mỗi giây.

Đẩy, kéo dùng cho video. Camera chỉ phục vụ một client `/stream` một lúc, nên backend giữ đúng một kết nối tới camera,
ghi đè một khung mới nhất trong bộ nhớ; pipeline AI chạy ở luồng riêng và các tab trình duyệt kéo khung qua
`/api/video/stream`. Bên nhận chậm hơn nguồn thì bỏ khung cũ, không ai phải chờ ai.

Cặp độc quyền là WebSocket `/ws` giữa backend và tab giữ quyền lái: mở một lần, giữ suốt phiên, hai chiều. Mỗi message
có chung một phong bì JSON `{v, type, ts, id?, data}`; chiều xuống có 7 loại (`telemetry`, `status`, `event`, `detection`,
`ack`, `error`, `pong`), chiều lên có 10 loại lệnh, mỗi loại có trần nhịp riêng (`cmd.velocity` 30 lần/s, `cmd.arm` 2
lần/s, `cmd.mission.upload` 1 lần/s). Message sai không làm đóng kết nối mà chỉ nhận lại `error` với một trong 12 mã lỗi.
Chỉ một tab giữ quyền lái một lúc. Đóng tab hay rớt kết nối thì backend gửi vận tốc 0 ngay; trên drone ảo, thời gian từ
lúc đóng tab tới lúc backend gửi lệnh dừng đo được 6 và 7 ms.
