# Tổng quan đề tài

Chương này phát biểu bài toán của đề tài, nhắc lại phần lý thuyết IoT nhóm em dùng để thiết kế (khối chức năng, mức triển
khai, mô hình truyền thông), rồi trình bày yêu cầu chức năng, kiến trúc tổng thể, phạm vi và tiến trình thực hiện.

## Bài toán và mục tiêu

Một chiếc drone tuần tra là một thiết bị IoT di động: nó mang cảm biến, gửi dữ liệu không dây về trạm mặt đất, nhận lệnh
ngược lại, còn dữ liệu được xử lý ở máy chủ rồi hiển thị cho người vận hành. Khác một nút cảm biến đứng yên, drone vừa đo
vừa chấp hành bằng bốn motor và có thể gây nguy hiểm khi mất kiểm soát. Đường truyền không dây có thể rớt bất kỳ lúc nào,
nhưng drone không được rơi vì chuyện đó. Nhóm em tự lắp một quadcopter trên khung S500, cho nó bay bằng ArduPilot, và tự
viết toàn bộ phần mềm trạm mặt đất: backend Python trên laptop và giao diện web trong trình duyệt.

### Phát biểu bài toán

Drone bay theo lộ trình người vận hành vẽ trên web, gửi telemetry và video về laptop qua Wi-Fi, tự phanh trước vật cản
phía trước, và báo khi camera thấy người.

**Đầu vào.** Số đo cảm biến trên drone: IMU, áp kế, GPS và la bàn, khoảng cách phía trước từ LiDAR TFmini Plus, điện áp
và dòng pin, vòng quay từng motor. Khung ảnh 640×480 JPEG từ camera ESP32-S3 + OV3660. Lệnh của người vận hành: cần và
công tắc trên tay phát FS-i6X; trên web là lộ trình tối đa 10 điểm, đổi chế độ bay, ARM, cất cánh, về nhà, lái tay bằng
bàn phím.

**Đầu ra.** Lệnh ga cho bốn motor do bo bay tính. Telemetry 8 lần mỗi giây trên web (vị trí, độ cao, hướng, tốc độ, chế độ,
pin, vệ tinh, khoảng cách vật cản). Video trực tiếp có hộp người vẽ chồng, bản "Ảnh rõ" đã làm sáng và nét, sự kiện "phát
hiện người" trong nhật ký. Sau mỗi chuyến: log của bo bay, tlog MAVLink và video, ghép theo giờ GPS trên trang Lịch sử bay.

**Ràng buộc.**

1. Bo bay là nơi duy nhất điều khiển motor. Web và AI chỉ gửi lệnh mức cao; không có đường nào từ đầu ra của AI tới ESC.
2. Tay phát RC luôn được ưu tiên và không đi qua phần mềm của nhóm: mất Wi-Fi hay backend treo thì vẫn lái được.
3. Bay được ở bãi không có Internet: laptop tự phát hotspot 2,4 GHz cho hai bo ESP32 trên drone.
4. Lực đẩy tối đa lớn hơn hai lần khối lượng cất cánh.
5. Motor thật chỉ quay khi người vận hành tự bấm (ARM, Motor Test), tay luôn giữ tay phát.
6. AI chạy trên GPU laptop (RTX 4060 Laptop) và phải theo kịp nhịp khung của camera.

**Tiêu chí đánh giá** chọn sao cho đo được bằng log hoặc phép thử lặp lại được (@tab:c1-tieu-chi). Số liệu chi tiết nằm
ở chương AI và chương Thực nghiệm.

Bảng: Tiêu chí đánh giá, ngưỡng và kết quả đạt được {#tab:c1-tieu-chi}

| Tiêu chí | Ngưỡng đặt ra | Kết quả |
|---|---|---|
| Bay mission AUTO thật | bay hết lộ trình, tự hạ gần home | 9/11 chuyến AUTO, hạ cách home 0,03 đến 0,24 m |
| Giữ rào ảo | trần 20 m, vòng 100 m | cao nhất 18,3 m (trần trừ lề 2 m) |
| Ổn định bay | rung p95 dưới 30 m/s², không clip | lớn nhất 26,1 m/s², clip 0 |
| Dừng khi web mất | dead-man không quá 350 ms | 6 đến 7 ms khi đóng tab |
| Telemetry qua Wi-Fi | dùng được trong vùng bay | tới khoảng 49 m, mất gói trung vị 3,9 % |
| Tránh vật cản | không vượt vật ở Loiter | SITL dừng trước cột, gần nhất 1,07 m |
| Tìm người | ít báo nhầm, không mất người | mAP50 0,210, báo nhầm giảm 67 % |
| Độ trễ AI | kịp nhịp camera | p95 89,5 ms mỗi khung |
| Ảnh rõ | được chọn hơn ảnh gốc | A/B mù 25/25 |

Từ đó nhóm em đặt bốn mục tiêu: (1) lắp hoàn chỉnh một quadcopter bay được Stabilize, AltHold, Loiter, Auto, RTL, có rào
ảo và failsafe; (2) xây trạm mặt đất trên web để giám sát, soạn và nạp mission kể cả khi đang bay AUTO, lái tay có dead-man,
xem video và xem lại chuyến bay; (3) tránh vật cản phía trước bằng LiDAR; (4) tìm người trên video bay thật và làm rõ ảnh,
chạy trực tiếp trong backend.

## Cơ sở IoT dùng trong đề tài

Nhóm em dùng ba khung lý thuyết của môn học theo cách phân loại của Bahga và Madisetti: khối chức năng, mức triển khai và
mô hình truyền thông.

### Khối chức năng

Thiết kế logic bỏ qua phần cứng cụ thể, chia hệ IoT thành bốn tầng thiết bị, truyền thông, dịch vụ, ứng dụng, và hai khối
cắt ngang mọi tầng là quản lý và an toàn, bảo mật. @fig:c1-logic đặt các thành phần của đề tài vào sáu khối đó.

![Thiết kế logic theo sáu khối chức năng IoT: bốn tầng từ thiết bị lên ứng dụng, hai cột quản lý và an toàn cắt ngang](docs/thuyet-trinh/img/asg/f5_logic.png){#fig:c1-logic w=12}

Ở tầng thiết bị, drone là một nút có cả cảm biến lẫn bộ chấp hành, camera là nút chỉ có cảm biến. Tầng truyền thông tách
mỗi loại dữ liệu một đường (UART, I2C, iBUS, DShot trên drone; MAVLink2 trên UDP 14550 và MJPEG qua Wi-Fi; REST và
WebSocket tới trình duyệt), nên hỏng một đường không kéo đường khác. Tầng dịch vụ là backend FastAPI, các dịch vụ báo cho
nhau qua một bus sự kiện nội bộ. Tầng ứng dụng là web 11 trang và Mission Planner dùng để hiệu chỉnh. Khối quản lý gồm file
tham số `.param` lưu trong git, firmware custom build, nhật ký 16 MB trên bo bay, API `/api/system`, `/api/health` và drone
ảo SITL. Khối an toàn gồm một tab giữ quyền lái, giới hạn nhịp lệnh, hợp đồng bản tin 12 mã lỗi, dead-man 350 ms, rào ảo và
failsafe.

### Mức triển khai

Các mức triển khai phân loại hệ IoT theo số nút, chỗ lưu và phân tích dữ liệu, và có hay không thành phần điều khiển các nút
(@tab:c1-muc).

Bảng: Sáu mức triển khai IoT đối chiếu với đề tài {#tab:c1-muc}

| Mức | Đặc điểm | Đối chiếu |
|---|---|---|
| 1 | một nút tự đo, tự lưu, tự phân tích | không hợp: hệ có nhiều nút |
| 2, 3 | một nút, lưu hoặc phân tích trên cloud | không hợp: vẫn một nút |
| 4 | nhiều nút độc lập, có nút quan sát | thiếu bộ điều khiển gửi lệnh xuống nút |
| 5 | nhiều nút, một nút điều phối gom dữ liệu | camera gửi thẳng về laptop |
| 6 | nhiều nút độc lập, bộ điều khiển trung tâm biết trạng thái, gửi lệnh | phù hợp |

Hệ của nhóm em thuộc mức 6 (@fig:c1-level). Hai nút đầu cuối chạy độc lập: drone (bo bay, cảm biến, motor và bo DroneBridge
đưa MAVLink lên Wi-Fi) và camera ESP32-S3. Camera tắt thì drone vẫn bay; bo bay khởi động lại thì camera vẫn phát hình.
Backend là bộ điều khiển trung tâm: biết trạng thái cả hai nút, gửi lệnh MAVLink xuống drone và gửi lệnh đổi chất lượng JPEG
xuống camera khi khung về chậm. Phân tích (AI), lưu trữ (tlog, video, log FC, sự kiện) và ứng dụng (web) là các khối riêng.
DroneBridge chỉ chuyển UART sang Wi-Fi cho riêng bo bay, không gom dữ liệu nút khác, nên hệ không phải mức 5. Điểm khác mẫu
lý thuyết là "cloud" nằm trên chính laptop ở bãi bay, vì lệnh lái cần độ trễ thấp và bãi bay không có Internet ổn định.

![Hệ thống đặt vào mẫu IoT mức 6: hai nút đầu cuối độc lập, máy chủ trung tâm trên laptop, người dùng; tay phát là đường an toàn riêng](docs/thuyet-trinh/img/asg/f5_level.png){#fig:c1-level w=12}

### Mô hình truyền thông

Đề tài dùng cả bốn mô hình trao đổi thông tin, mỗi mô hình cho một loại dữ liệu:

- **Yêu cầu, phản hồi** (REST `/api/*`): việc hỏi một lần, như đọc cấu hình, nạp và đọc lại mission. Nạp mission là một
  giao dịch: hoặc nạp xong và đọc lại khớp, hoặc trả danh sách lỗi.
- **Xuất bản, đăng ký** (bus sự kiện nội bộ): telemetry, AI, dead-man phát sự kiện; mỗi tab qua `/ws` và `GET /api/events`
  là nơi nhận; bus giữ vòng đệm 200 sự kiện.
- **Đẩy, kéo** (MJPEG): camera đẩy khung theo tốc độ của nó, backend giữ đúng khung mới nhất, AI và từng tab kéo theo nhịp
  riêng; không dùng hàng đợi để hình không trễ dần.
- **Cặp độc quyền** (WebSocket `/ws`): một kết nối hai chiều suốt phiên, telemetry 8 Hz xuống, lệnh lên; socket đóng là
  backend gửi vận tốc 0 ngay.

## Yêu cầu chức năng

@tab:c1-yeu-cau liệt kê yêu cầu chức năng theo khối, cột cuối là cơ chế thực hiện.

Bảng: Yêu cầu chức năng của hệ thống {#tab:c1-yeu-cau}

| Khối | Yêu cầu | Cơ chế |
|---|---|---|
| Bay | Stabilize, AltHold, Loiter từ tay phát | ArduPilot, công tắc SwC |
| Bay | về nhà khi mất sóng RC hoặc pin dưới 14,0 V | `FS_THR_ENABLE 1`, `BATT_FS_LOW_ACT 2` |
| Bay | không vượt trần 20 m, vòng 100 m | geofence trên bo bay |
| Nhiệm vụ | vẽ tối đa 10 điểm, nạp, đọc lại so khớp | REST, giao thức MISSION_* |
| Nhiệm vụ | nạp mission mới khi đang bay AUTO | GUIDED giữ chỗ, nạp, đọc lại |
| Điều khiển | lái tay bằng bàn phím, chỉ khi FC ở GUIDED | WebSocket, dead-man 350 ms |
| Giám sát | telemetry 8 Hz, nhật ký sự kiện, radar vật cản | WebSocket `/ws` |
| Vật cản | phanh trước vật trong tầm 0,1 đến 6 m | TFmini Plus, `AVOID_MARGIN 2` |
| Video, AI | video trực tiếp, hộp người, Ảnh rõ, sự kiện | MJPEG, ba tầng lọc trên GPU |
| Lưu trữ | tlog, video, ghép với log FC theo giờ GPS | trang Lịch sử bay |

Ba yêu cầu phi chức năng đi kèm: hỏng độc lập (mất camera không ảnh hưởng telemetry, mất Wi-Fi không ảnh hưởng tay phát);
một người lái tại một thời điểm, có giới hạn nhịp lệnh; mọi ngưỡng đọc từ biến môi trường hoặc file tham số, không viết cứng.

## Kiến trúc tổng thể

@fig:c1-kien-truc là kiến trúc tổng thể. Bo bay SpeedyBee F405 V5 chạy ArduCopter 4.7.1 là bộ não duy nhất quyết định motor
quay ra sao; GPS, LiDAR, bộ thu RC và ESC nối vào nó qua các cổng UART riêng. Bo DroneBridge đọc MAVLink từ UART2 của bo bay
và gửi thành gói UDP tới cổng 14550 của laptop, chiều ngược lại cũng vậy. Bo camera ESP32-S3 phát MJPEG ở cổng 81, không nối
dây với bo bay. Cả hai bo vào hotspot `IOTCV-HOTSPOT` 2,4 GHz do laptop phát. Laptop chạy backend FastAPI ở cổng 8000 cùng
các model AI trên GPU, phục vụ web qua REST và WebSocket.

![Kiến trúc tổng thể: drone với các cổng SERIAL, hai bo ESP32, hotspot của laptop, backend và AI trên laptop, trình duyệt; tay phát đi đường RC riêng](docs/thuyet-trinh/img/tikz/F03.png){#fig:c1-kien-truc w=14}

@fig:c1-lien-ket chia liên kết theo ba vùng (trên drone, laptop, người dùng) và ghi giao thức từng liên kết, kể cả TCP 5760
khi backend nối drone ảo SITL thay cho drone thật; đổi giữa hai loại drone chỉ cần đổi chuỗi kết nối của backend.

![Liên kết thiết bị và giao thức theo ba vùng: trên drone, laptop trạm mặt đất, người dùng](docs/thuyet-trinh/img/asg/f5_lienket.png){#fig:c1-lien-ket w=16}

Dữ liệu chạy theo bốn luồng:

1. **Điều khiển**: bàn phím, WebSocket, backend, Wi-Fi UDP, ESP32, UART2, bo bay, ESC, motor; có dead-man ở backend.
2. **Telemetry**: bo bay, ESP32, Wi-Fi UDP, backend chuẩn hoá thành JSON, WebSocket, web. Web không đọc MAVLink trực tiếp.
3. **Hình ảnh**: OV3660, ESP32-S3 nén JPEG, HTTP MJPEG, backend giữ một kết nối tới camera, chia cho AI và mọi tab; AI chạy
   thread riêng, chậm thì bỏ khung cũ.
4. **An toàn**: tay phát, sóng AFHDS 2A, bộ thu iA6B, iBUS vào bo bay; không qua phần mềm nào của nhóm.

## Phạm vi đề tài

- Bộ điều khiển bay dùng ArduPilot bản custom build 54 tính năng cho vừa 1 MB flash; nhóm em chọn tính năng, cấu hình tham
  số và hiệu chỉnh, không viết lại vòng PID.
- Tránh vật cản dùng một LiDAR một tia nhìn trước, có hiệu lực ở Loiter, PosHold, AltHold và GUIDED vận tốc; ở Stabilize và
  AUTO drone bay đúng lệnh, không tự tránh.
- Tầm Wi-Fi là tầm hotspot laptop, khoảng 49 m khi bay thật. Ngoài tầm đó tay phát là đường lái chính, rào ảo vẫn giữ drone
  trong vòng 100 m.
- AI chạy trên laptop, đầu ra là hộp người, sự kiện và ảnh làm rõ; AI không gửi lệnh nào tới drone.
- Laptop là máy chủ trung tâm, không cần cloud để bay. Laptop tắt thì web mất telemetry và video, nhưng drone vẫn nghe tay
  phát và vẫn bị rào giữ, vì bo bay đặt `FS_GCS_ENABLE 0` (mất trạm mặt đất không kích hoạt về nhà).

## Tiến trình thực hiện

Dự án kéo dài 102 ngày, từ lúc tạo repo 17/08/2026 tới khi hoàn thiện phần AI 26/11/2026, theo nguyên tắc phần mềm trước
trên drone ảo, phần cứng sau. Backend, web lái tay, mission và dead-man chạy đúng trên SITL từ 22 đến 25/09, ba tuần trước
khi bo bay thật được nạp firmware ngày 13/10. @fig:c1-tien-trinh và @tab:c1-moc là các mốc đã đạt.

![Trục thời gian dự án 17/08 đến 26/11/2026, mười mốc: xanh là phần mềm, đỏ là phần cứng và bay, cam là hoàn thiện và AI](docs/thuyet-trinh/img/tikz/F04.png){#fig:c1-tien-trinh w=16}

Bảng: Các mốc đã đạt {#tab:c1-moc}

| Ngày | Mốc đã đạt |
|---|---|
| 17/08 | tạo repo, khung backend MAVLink, web, CI lint và test |
| 21/09 | chốt thiết kế tổng thể, kế hoạch 25 phase, cài đủ 13/13 công cụ trên PC |
| 22/09 đến 25/09 | SITL trên WSL2, backend MAVLink và WebSocket, dead-man, mission, web lái tay |
| 12/10 đến 13/10 | chốt linh kiện; nạp DroneBridge và ArduPilot hoàn toàn bằng script |
| 17/10 | hướng dẫn lắp ráp tương tác 76 bước, sơ đồ và mô hình 3D |
| 24/10 | chuyến bay đầu trên khung đã lắp: Stabilize 82 s, Loiter 155 s cao tới 7,5 m |
| 25/10 đến 01/11 | hiệu chỉnh accel, la bàn ngoài trời, tay phát, failsafe; rào ảo, RTL 15 m |
| 01/11 đến 02/11 | 11 chuyến ngoài trời, nạp mission mới khi drone đang bay AUTO |
| 15/11 đến 26/11 | kiểm phần cứng 12/12 hạng mục đạt, trang Lịch sử bay, AI trên camera bay |

Repo có 89 commit trên nhánh chính, 54 pull request đã merge, 51 script tự động hoá và 13 runner kiểm thử SITL; dữ liệu bay
gồm 97 file tlog và 11 phiên video. Mọi việc trên laptop (nạp firmware, ghi và đọc lại tham số, kiểm phần cứng, tải log)
chạy bằng script để lặp lại được; thao tác làm motor quay do người vận hành tự bấm.

Các chương sau đi theo đường của dữ liệu: phần cứng (chương 2), firmware và phần mềm trên các bo (chương 3), cấu hình và
hiệu chỉnh (chương 4), truyền thông (chương 5), trạm mặt đất (chương 6), drone ảo và kiểm thử (chương 7), AI (chương 8),
thực nghiệm (chương 9), kết luận (chương 10) và phụ lục hướng dẫn sử dụng.
