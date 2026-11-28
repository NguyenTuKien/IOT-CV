# Phụ lục A. Hướng dẫn sử dụng

Phụ lục này là hướng dẫn cho người vận hành, đi theo đúng thứ tự một buổi bay: chuẩn bị pin, laptop và mạng, nối drone
với máy tính, dùng tay cầm FS-i6X, bay tay, rồi từng trang của website (giám sát, lái, nạp mission, xem lại chuyến bay). Cuối phụ
lục là các quy tắc an toàn bắt buộc và cách xử lý những tình huống hay gặp. Mọi lệnh chạy từ thư mục gốc của repo
trên laptop Windows.

## Chuẩn bị trước buổi bay

### Pin

Drone dùng pin LiPo Ovonic 4S 5300 mAh: đầy 16,8 V, danh định 14,8 V, cất giữ ở 15,2 đến 15,4 V. Pin sạc bằng SkyRC
iMAX B6AC V2 ở chế độ Balance (mỗi cell lên 4,20 V), dòng không quá 1C; bộ sạc 50 W nên ở 4S thực tế khoảng 3 A.

- Không dùng pin phồng, rách vỏ, dây lỏng hay lệch cell bất thường. Đo từng cell bằng Battery Meter của bộ sạc trước
  mỗi buổi bay.
- Không sạc pin khi không có người trông.
- Mỗi lần cắm pin vào drone, đọc điện áp trên web hoặc Mission Planner. Pin 4S đầy đọc quanh 16,8 V; thấy khoảng 25 V
  là đã cắm nhầm pin 6S, phải dừng lại vì ngưỡng failsafe pin trên FC là của 4S.

### Thứ tự cấp điện

GPS và la bàn chỉ có điện khi cắm pin, mà FC chỉ dò la bàn lúc khởi động. Vì vậy luôn **cắm pin trước, cắm USB sau**.
Nếu rút pin trong khi USB còn cắm quá 10 s, FC sẽ chốt failsafe pin và la bàn đọc sai: cắm pin lại rồi khởi động lại FC.

### Laptop

Laptop là trạm mặt đất và cũng là điểm phát Wi-Fi, nên nó không được ngủ hay tiết kiệm điện trong lúc bay. Trước buổi
bay chạy một lần (có một hộp UAC):

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\laptop\che_do_bay.ps1 -Bat
```

Script tắt chế độ ngủ, không cho Energy Saver tự bật, đặt card Wi-Fi ở Maximum Performance trong cả bốn power scheme
và tắt việc card tự quét Wi-Fi nền (mỗi lần quét, hai ESP32 mất sóng vài giây). Không gập nắp và không bấm nút nguồn
trong buổi bay: cả hai đều đưa máy vào trạng thái ngủ. Về nhà chạy lại với `-Tat` để laptop tự nối Wi-Fi như bình thường.

### Mạng ngoài bãi

Card Wi-Fi của laptop chỉ có một radio. Nó phát hotspot `IOTCV-HOTSPOT` ở băng 2,4 GHz cho hai ESP32, nên không được
nối thêm mạng Wi-Fi nào khác. Internet cho laptop lấy từ iPhone qua cáp:

1. Trên iPhone bật Điểm truy cập cá nhân.
2. Cắm cáp vào laptop; lần đầu bấm Tin cậy trên iPhone.
3. Chạy `chay-drone-that.bat` (mục sau). File này kiểm laptop đã ở chế độ bay chưa, có mạng iPhone qua cáp chưa, Wi-Fi
   có đang nối mạng khác không, rồi bật lại hotspot để hotspot chia sẻ đúng mạng iPhone.

Hai bo ESP32 được gọi bằng tên, không bằng IP, vì IP do DHCP cấp và đổi mỗi lần hotspot khởi động lại:
`DroneBridgeESP32.mshome.net` và `iotcv-camera.mshome.net`. Kiểm sóng của cả hai bo bằng
`py -3.13 scripts\esp32\wifi_ping_check.py`.

## Kết nối drone với máy tính

Drone có hai đường nối với laptop (@tab:pa-ket-noi). USB dùng trên bàn, Wi-Fi dùng khi bay.

Bảng: Các đường nối giữa drone và laptop {#tab:pa-ket-noi}
| Đường nối | Địa chỉ | Dùng cho |
|---|---|---|
| USB tới FC | COM6 | Mission Planner, script `scripts/fc/` (kiểm, nạp, tải log) |
| MAVProxy chia COM6 | UDP 14551 và 14552 | Mission Planner và script ghi số đo cùng lúc |
| Wi-Fi qua DroneBridge | UDP 14550 | backend nghe `udpin:0.0.0.0:14550` |
| Camera ESP32-S3 | `http://iotcv-camera.mshome.net:81/stream` | luồng MJPEG vào backend |
| Drone ảo SITL | TCP 5760 (backend), 5762 (Mission Planner) | chạy thử không cần drone |

Mission Planner và backend không nghe chung cổng UDP 14550. Muốn dùng Mission Planner qua Wi-Fi thì tắt backend trước
bằng `dung-tat-ca.bat`.

### Chạy cho drone thật

Sau khi cắm pin drone và có mạng iPhone qua cáp, chạy `chay-drone-that.bat`. File làm bốn bước: tắt backend và web cũ
(cổng 8000, 5173), kiểm laptop rồi bật lại hotspot, mở backend, mở web, chờ tối đa 60 s cho tới khi backend nhận được
FC rồi mở trình duyệt. Các biến môi trường chính nó đặt:

```
MAVLINK_ENDPOINT=udpin:0.0.0.0:14550
CAMERA_FAKE=0
CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream
MAX_ALT=18   MIN_ALT=2   MAX_DISTANCE_HOME=95
RECORD_VIDEO=1   TLOG_ENABLE=1
```

Giới hạn của web (18 m, 95 m) nhỏ hơn rào ảo trên FC (trần 20 m, bán kính 100 m) để mission soạn trên web không bao giờ
chạm rào. Mỗi chuyến, video camera được ghi vào `logs\recordings\`, telemetry MAVLink vào `logs\tlog\`.

### Chạy cho drone ảo

`chay-tat-ca.bat` bật drone ảo SITL trong WSL, backend nối `tcp:127.0.0.1:5760`, camera dùng video mẫu, rồi mở web.
Mission Planner nối vào SITL qua cổng 5762. File này tắt backend đang chạy, nên **không dùng khi bay thật**, và hai file
không chạy cùng lúc. Tắt mọi thứ: `dung-tat-ca.bat`. Web luôn mở ở `http://localhost:5173`.
Ở chế độ này backend dùng giới hạn mặc định trong `.env` (cao 10 m, cách home 50 m), nên các ảnh chụp web trong phụ lục,
vốn chụp trên drone ảo, vẽ rào mềm 50 m.

![Hai cách chạy hệ thống: drone ảo (SITL, backend qua TCP, Mission Planner cổng 5762) và drone thật (FC, ESP32 DroneBridge, hotspot, backend UDP 14550, camera thật)](docs/thuyet-trinh/img/real/hd-hai-cach-chay-web.png){#fig:pa-hai-cach w=16}

## Tay cầm FS-i6X

### Bật tay phát và bind

Tay phát FS-i6X và bộ thu iA6B đã được bind sẵn. Khi cần bind lại (đổi bộ thu, reset tay phát):

1. Cắm bind plug vào cổng B/VCC của iA6B, cấp nguồn 5 V cho bộ thu: đèn nhấp nháy nhanh.
2. Giữ nút BIND KEY ở mặt sau tay phát, vừa giữ vừa bật công tắc nguồn. Màn hình hiện `RXBinding...`.
3. Đèn iA6B sáng liên tục là đã bind. Tắt cả hai, rút bind plug, bật lại: đèn phải sáng liên tục ngay.
4. Trên tay phát chọn System Setup → RX Setup → Output mode → `i-BUS` (FC chỉ đọc i-BUS).

Failsafe của tay phát cài ở kênh 3 (ga) mức −118 %, khoảng 911 µs, thấp hơn ngưỡng `FS_THR_VALUE` 975 µs của FC. Nhờ đó
khi tay phát tắt hoặc mất sóng, FC nhận ra ngay và chuyển RTL.

### Công tắc và chức năng

![Bố trí công tắc trên tay FS-i6X: SwA, SwB, SwC, SwD, núm VrB và hai cần](docs/thuyet-trinh/img/tikz/F16.png){#fig:pa-tay-cam w=11}

Bảng: Bản đồ công tắc của tay FS-i6X {#tab:pa-cong-tac}
| Công tắc | Kênh | Chức năng |
|---|---|---|
| Cần trái | CH3, CH4 | ga (lên, xuống) và xoay mũi |
| Cần phải | CH1, CH2 | nghiêng trái phải, tiến lùi |
| SwC (3 nấc) | CH5 | lên STABILIZE, giữa ALT_HOLD, xuống LOITER |
| SwD | CH6 | xuống: RTL, bay về home |
| SwA | CH7 | dành cho WEB CONTROL ENABLE; FC không gán chức năng bay (`RC7_OPTION 0`) |
| SwB | CH8 | xuống: ARM, lên: DISARM |
| Núm VrB | CH9 | xoay hết (qua khoảng 1 800 µs): AUTO; lùi lại: về chế độ của SwC |

**Cảnh báo: SwB là công tắc ARM. Gạt SwB lên khi drone đang bay là tắt motor ngay lập tức, drone rơi tự do.** Trong
lúc bay không chạm vào SwB. Chỉ DISARM khi drone đã nằm trên đất, ga đã kéo xuống hết. Muốn dừng khẩn cấp trên không
thì gạt SwC về STABILIZE hoặc LOITER, không dùng SwB.

## Bay tay cơ bản

### Phân vai và vị trí đứng

Mỗi buổi bay có hai người. Người lái cầm tay phát, mắt luôn nhìn drone, không nhìn laptop. Người quan sát nhìn web
hoặc Mission Planner, đọc to độ cao, điện áp, cảnh báo, và có quyền hô "ABORT" bất cứ lúc nào. Người lái đứng sau đuôi
drone, cách ít nhất 5 m, mũi drone hướng ra xa người: ở tư thế này đẩy cần sang phải thì drone đi sang phải.

Khi có người hô ABORT, người lái làm ngay: gạt SwC về STABILIZE, đưa ga về giữa giữ drone thăng bằng, hạ xuống chỗ gần
nhất an toàn, chỉ DISARM sau khi đã chạm đất. Nếu drone lao về phía người thì kéo ga xuống hết ngay: hỏng cánh vẫn hơn
đâm vào người. Hô ABORT khi drone tự nghiêng hay tự xoay, có tiếng lạ, khói, mùi khét, cảnh báo đỏ, điện áp dưới
14,4 V, có người hoặc xe đi vào bãi, hoặc người lái mất phương hướng.

### Cất cánh và hạ cánh

1. GPS đã 3D fix với ít nhất 10 vệ tinh (rào ảo cần GPS mới cho ARM), không còn cảnh báo pre-arm.
2. SwC ở LOITER hoặc STABILIZE, ga xuống hết. Gạt SwB xuống để ARM. Chờ cả bốn motor quay đều tiếng.
3. Đẩy ga lên từ từ, không giật. Ngay khi bốn chân rời đất thì thôi tăng ga.
4. Lên độ cao làm việc, buông cần ở LOITER: drone đứng yên tại chỗ.
5. Hạ cánh: kéo ga xuống từ từ tới khi chạm đất, giữ ga thấp 2 giây, rồi gạt SwB lên để DISARM. Hoặc gạt SwD về RTL
   để drone tự bay về và tự hạ.

### Các chế độ bay

Bảng: Các chế độ bay dùng trong dự án {#tab:pa-che-do}
| Chế độ | Drone tự giữ | Tránh vật cản TFmini | Dùng khi |
|---|---|---|---|
| STABILIZE | thăng bằng; ga lấy từ tay | không | đường thoát cuối, lái tay hoàn toàn |
| ALT_HOLD | độ cao, không giữ vị trí (gió đẩy trôi) | nghiêng lùi khi vật gần hơn 5 m | tập lái, bay gần vật |
| LOITER | độ cao và vị trí (GPS) | dừng cách vật 2 m | chế độ dùng nhiều nhất, tốc độ 3 m/s |
| RTL | bay lên 15 m, về home, hạ cánh | không | về nhà; failsafe tự gọi |
| AUTO | bay mission đã nạp, 3 m/s | không | bay lộ trình |
| GUIDED | nhận lệnh từ web: cất cánh, vận tốc, giữ chỗ | có, khi web lái bằng vận tốc | lái từ web, nạp mission khi bay |
| LAND | hạ thẳng tại chỗ | không | hạ khẩn cấp |

### Failsafe và rào ảo

FC tự xử lý các tình huống trong @tab:pa-failsafe mà không cần laptop. Mất Wi-Fi không làm drone đổi chế độ, vì tay cầm
là đường lái chính.

Bảng: Phản ứng tự động của FC {#tab:pa-failsafe}
| Tình huống | Phản ứng |
|---|---|
| Mất sóng tay cầm (kênh ga dưới 975 µs) | RTL |
| Pin dưới 14,0 V liên tục 10 s | RTL |
| Pin dưới 13,2 V | LAND tại chỗ |
| EKF hỏng | LAND |
| Chạm trần 20 m hoặc rào bán kính | RTL; khi lái tay FC chặn trước lề 2 m |
| Mất Wi-Fi tới laptop | không đổi chế độ (`FS_GCS_ENABLE 0`) |
| Web ngừng gửi lệnh lái hơn 300 ms | backend tự gửi vận tốc 0 |

## Website trạm mặt đất

Website mở ở `http://localhost:5173` (không dùng `127.0.0.1:5173`). Có 11 trang, chuyển trang bằng Alt + số, riêng
Lịch sử bay là Alt + L; phím `?` mở bảng phím tắt. Thanh trên cùng luôn có trạng thái liên kết và công tắc WEB CONTROL;
ở mọi trang trừ trang Bay, thanh này có thêm ba nút thoát hiểm HOLD, RTL, LAND. Mục này đi qua từng trang theo thứ tự
phím tắt.

### Trang Bay (Alt+1)

![Trang Bay: màn hình bay, bản đồ, chế độ bay, lái tay, radar vật cản và video](docs/bao-cao/img/web/web-bay.png){#fig:pa-web-bay w=15}

Trang Bay là buồng lái, vừa một màn hình không phải cuộn: màn hình bay (chân trời giả, độ cao, tốc độ, pin, GPS), bản
đồ hoặc cảnh 3D, khung Chế độ bay, khung Lái tay, khung Vật cản và video camera. Khung Chế độ bay có nút đổi mode, ARM,
DISARM, cất cánh tới độ cao đã chọn, AUTO "Bắt đầu mission", HOLD, RTL, LAND. ARM, DISARM, STABILIZE và cất cánh hỏi
xác nhận trước khi gửi; RTL và LAND là nút thoát hiểm nên gửi ngay.

![Thanh trạng thái dưới tiêu đề: liên kết trình duyệt, backend và drone, mode, ARMED, pin, GPS, đồng hồ và công tắc WEB CONTROL](docs/bao-cao/img/web/web-bay-thanh-trang-thai-2-dong.png){#fig:pa-thanh-trang-thai w=16}

!![Màn hình bay với các ô độ cao, tốc độ, hướng mũi, GPS, pin, tuổi liên kết, EKF (trái) và khung Chế độ bay với HOLD, các mode, DISARM, cất cánh, RTL, LAND (phải)](docs/bao-cao/img/web/web-bay-man-hinh-bay.png|docs/bao-cao/img/web/web-bay-che-do-bay.png){#fig:pa-man-hinh-che-do w=6.5}

Theo dõi một chuyến bay:

1. Chờ thanh trên cùng báo đã nối FC; màn hình bay có số, bản đồ có biểu tượng drone và chữ H ở home.
2. Đọc pin, số vệ tinh, EKF trước khi ARM. Cảnh báo pre-arm hiện ở khung sự kiện.
3. Trong lúc bay, người quan sát đọc to độ cao, điện áp và khoảng cách vật cản.

Cất cánh từ web (drone đang đứng trên đất, người lái cầm tay phát):

1. Chuyển GUIDED, bấm ARM và xác nhận.
2. Chọn độ cao cất cánh, bấm Cất cánh và xác nhận. Nút Cất cánh mờ khi chưa ARM hoặc chưa ở GUIDED.

### Giành quyền lái và lái bằng bàn phím

Web không bao giờ tự giành quyền. Muốn lái từ web:

1. Drone đang bay ổn định ở LOITER, người lái vẫn cầm tay phát.
2. Bấm công tắc WEB CONTROL trên thanh trên cùng. Công tắc chỉ chuyển sang ON khi backend xác nhận; một dải đỏ hiện
   trên cùng mọi trang trong suốt thời gian web giữ quyền.
3. Chuyển GUIDED trong khung Chế độ bay. Web chỉ lái được ở GUIDED.
4. Lái bằng phím (@tab:pa-phim). Trần vận tốc 1,0 m/s, xoay 45°/s.
5. Trả quyền: bấm lại công tắc WEB CONTROL, drone dừng ngay.

![Công tắc WEB CONTROL ở trạng thái ON, web đang giữ quyền lái](docs/bao-cao/img/web/web-bay-quyen-dieu-khien.png){#fig:pa-web-control w=8}

Bảng: Phím lái tay trên web {#tab:pa-phim}
| Phím | Lệnh |
|---|---|
| W / ↑, S / ↓ | tiến theo mũi, lùi |
| A / ←, D / → | sang trái, sang phải |
| R, F | lên, xuống |
| Q, E | xoay trái, xoay phải |
| Space | dừng ngay, vận tốc 0 |
| H | HOLD, đứng yên (mọi trang) |

Thả phím thì web gửi vận tốc 0; đóng tab, cửa sổ mất tiêu điểm hay rớt mạng thì backend tự dừng drone. Chỉ một tab được
giữ quyền lái. Người lái giành lại quyền bất cứ lúc nào bằng cách **gạt SwC sang chế độ khác**: web mất quyền ngay, kể
cả khi người bấm web vẫn đang giữ phím.

![Khung Lái tay khi WEB CONTROL ON: cụm phím QWEASDRF và mũi tên, Space dừng ngay, tốc độ xin và tốc độ thật](docs/bao-cao/img/web/web-bay-lai-tay.png){#fig:pa-lai-tay w=8}

### Radar vật cản

Khung Vật cản hiện khoảng cách TFmini Plus đo phía trước mũi và trạng thái tránh vật cản do backend tính:

- OFF: số đo hợp lệ, vật xa hơn 5 m.
- NEAR: vật trong vùng 5 m mà FC bắt đầu để ý.
- ACTIVE: vật trong lề 2 m và drone ở LOITER hoặc ALT_HOLD, FC đang phanh hoặc lùi.
- UNKNOWN: cảm biến báo lỗi hoặc số đo cũ hơn 2 s.

Khi drone ở STABILIZE hoặc AUTO, khung ghi rõ chế độ này không tự tránh vật cản.

![Khung Vật cản trên drone ảo: vật cách 3,5 m, nằm trong vùng gần vật cản, thang 2 m, 5 m, 6 m](docs/bao-cao/img/web/web-bay-vat-can.png){#fig:pa-vat-can w=9}

### Nhiệm vụ (Alt+2)

![Trang Nhiệm vụ: soạn lộ trình trên bản đồ, hồ sơ độ cao, xem trước 3D và nút nạp mission](docs/bao-cao/img/web/web-mission.png){#fig:pa-web-mission w=15}

Trang Nhiệm vụ soạn lộ trình trên bản đồ, kiểm theo giới hạn của backend, xem trước 3D rồi nạp xuống FC. Backend nhận
mission tối đa 10 điểm, độ cao 2 đến 18 m, không xa home quá 95 m.

![Bản đồ soạn lộ trình: home, 6 waypoint, độ dài từng chặng và rào mềm của backend](docs/bao-cao/img/web/web-mission-ban-do.png){#fig:pa-mission-ban-do w=15}

Soạn và nạp:

1. Bấm lên bản đồ để thêm điểm, kéo để dời, bấm "+" giữa hai điểm để chèn; Ctrl+Z hoàn tác, Ctrl+Y làm lại.
2. Hoặc chọn Mẫu lộ trình sinh quanh home: Vòng tròn, Đa giác, Quét lưới, Đi-về (mặc định đi thẳng 5 m theo hướng mũi
   drone rồi về; quay mũi drone về phía bãi trống trước khi bấm).
3. Chọn cách kết thúc mission: RTL hoặc LAND. Xem Hồ sơ độ cao và bản xem trước 3D để chắc lộ trình nằm trong rào.
4. Bấm NẠP MISSION. Backend kiểm lại, nạp, đọc ngược lên để so khớp, rồi đặt FC bắt đầu từ điểm 1. Chưa bấm thì không
   có gì rời trình duyệt. Bản nháp khác mission trên FC thì trang báo rõ.
5. Có thể lưu mission thành file `.waypoints` để mở bằng Mission Planner (Plan → Load WP File), hoặc mở file từ Mission
   Planner vào web.

![Hồ sơ độ cao theo quãng đường, có trần và sàn độ cao của mission](docs/bao-cao/img/web/web-mission-ho-so-do-cao.png){#fig:pa-ho-so-do-cao w=14}

![Trình soạn mission sau khi nạp: lệnh cất cánh, các waypoint chỉnh được độ cao, dòng "Đã nạp xong" và nút NẠP MISSION](docs/bao-cao/img/web/web-mission-soan-mission.png){#fig:pa-soan-mission w=7}

Bay mission:

1. ARM và cất cánh bằng tay cầm ở LOITER (FC không cho ARM khi đang ở AUTO).
2. Chuyển AUTO bằng núm VrB hoặc nút AUTO trên trang Bay. Nạp mission không làm drone bay; chỉ AUTO mới bay.
3. Drone bay hết các điểm rồi RTL hoặc LAND. Muốn dừng giữa chừng: gạt SwC về LOITER.

Nạp mission khi đang bay: soạn mission mới và bấm NẠP MISSION trong lúc drone đang AUTO. Backend tự chuyển GUIDED cho
drone đứng giữ chỗ, nạp, đọc lại, đặt điểm 1. Drone đứng chờ tới khi người lái chuyển AUTO lần nữa thì bay mission mới
từ điểm 1.

### Không gian 3D (Alt+3)

![Trang Không gian 3D: bản sao số của drone trên ảnh vệ tinh](docs/bao-cao/img/web/web-3d.png){#fig:pa-web-3d w=13}

Bản sao số của drone trên ảnh vệ tinh: tư thế thật theo telemetry, vệt bay 3D, rào phần mềm, tia TFmini, nón nhìn của
camera, mission nháp và mission đã nạp.

1. Chọn góc máy bằng phím 1 đến 5 (có góc bám đuôi); kéo để xoay, cuộn để phóng.
2. Bật tắt từng lớp trong Lớp hiển thị: vệt bay, rào, tia TFmini, nón camera, mission.
3. Chế độ Xưởng 3D cho xem drone S500 của dự án, tháo rời để thấy từng linh kiện nằm ở đâu, có nhãn linh kiện.
4. Máy yếu thì hạ Chất lượng render.

### Camera & AI (Alt+4)

![Trang Camera & AI: luồng camera, khung nhận diện người và thống kê bộ nhận diện](docs/bao-cao/img/web/web-vision.png){#fig:pa-web-vision w=13}

Luồng camera trực tiếp kèm khung nhận diện người, khung Model AI (trạng thái, provider, ms của từng model), khung Bộ
nhận diện (nhịp gói detection, số box, độ tin cậy trung bình, phân bố độ tin cậy) và sơ đồ đường đi của hình ảnh.

1. Kiểm khung Camera trên drone: có hình, khung/s, cỡ khung gốc, chất lượng JPEG hiện tại.
2. Bật hoặc tắt "Ảnh rõ" để xem hình đã làm rõ hay hình gốc; khung nhận diện vẫn vẽ trên hình.
3. Chụp ảnh kèm khung nhận diện khi cần lưu một khoảnh khắc.
4. Khi bay xa, backend tự hạ chất lượng JPEG nếu khung/s tụt và tự nâng lại khi sóng khoẻ; các lần đổi hiện ở mục Lần
   đổi chất lượng gần đây.

Mất camera thì khung báo OFFLINE; telemetry và điều khiển vẫn chạy bình thường.

![Khung Model AI: trạng thái và độ trễ p50, p95 của từng model](docs/bao-cao/img/web/web-vision-model-ai.png){#fig:pa-model-ai w=8.5}

### Tổng quan (Alt+5)

![Trang Tổng quan: sức khoẻ từng khối và mức sẵn sàng bay](docs/bao-cao/img/web/web-overview.png){#fig:pa-web-overview w=13}

Toàn cảnh một màn hình: Sức khoẻ hệ thống (từng khối, cả trạng thái WEB CONTROL), Sẵn sàng bay, vị trí trên bản đồ nhỏ,
thời gian bay từ lúc ARM, các chuyến bay trong phiên, 8 sự kiện mới nhất và thông số phiên làm việc (telemetry nhận,
băng thông WebSocket, số lần nối lại). Dùng trang này khi chỉ cần nhìn; bấm Chi tiết để sang trang tương ứng.

### Dữ liệu bay (Alt+6)

![Trang Dữ liệu bay: biểu đồ thời gian thực của telemetry](docs/bao-cao/img/web/web-telemetry.png){#fig:pa-web-telemetry w=13}

Biểu đồ thời gian thực của các trường telemetry và bảng Số sống của gói telemetry mới nhất.

1. Chọn Cửa sổ thời gian để xem đoạn ngắn hay dài.
2. Rê chuột trên biểu đồ để đọc giá trị tại từng thời điểm.
3. Xuất CSV khi cần phân tích ngoài web.

### Nhật ký (Alt+7)

![Trang Nhật ký: sự kiện backend và web, lịch sử lệnh](docs/bao-cao/img/web/web-logs.png){#fig:pa-web-logs w=13}

Hai bảng: Sự kiện (mọi sự kiện của backend và web) và Lịch sử lệnh (lệnh gửi từ tab này kèm lúc gửi, lúc backend nhận,
lúc FC xác nhận).

1. Lọc theo mức và theo nguồn, hoặc gõ vào ô Tìm sự kiện.
2. Bấm một dòng để xem mã và chi tiết kỹ thuật ngay bên dưới nó.
3. Ở Lịch sử lệnh, đọc độ trễ xác nhận của các lệnh mode, ARM, cất cánh, HOLD, RTL, LAND và bật tắt WEB CONTROL. Lệnh
   lái tay (10 lần mỗi giây) không ghi vào đây.

### Kiểm tra trước bay (Alt+8)

![Trang Kiểm tra trước bay: cổng kiểm tự động và danh sách tự xác nhận](docs/bao-cao/img/web/web-preflight.png){#fig:pa-web-preflight w=13}

1. Đọc kết luận chung: SẴN SÀNG, SẴN SÀNG CÓ LƯU Ý hoặc CHƯA ĐƯỢC BAY. Chưa có telemetry thì trang ghi CHƯA ĐỦ DỮ
   LIỆU, không coi là ổn.
2. Ô nào không đạt thì sửa nguyên nhân trước; ô vàng là lưu ý, không chặn bay.
3. Tự xác nhận từng dòng của danh sách việc người vận hành phải tự kiểm.
4. Đọc lại năm luật an toàn ở cuối trang.

!![9 cổng kiểm tự động, đều đạt (trái) và 7 việc người vận hành tự đánh dấu (phải)](docs/bao-cao/img/web/web-preflight-tu-dong.png|docs/bao-cao/img/web/web-preflight-thu-cong.png){#fig:pa-preflight-chi-tiet w=7.5}

### Hệ thống (Alt+9)

![Trang Hệ thống: kiến trúc, trạng thái backend và giới hạn an toàn](docs/bao-cao/img/web/web-system.png){#fig:pa-web-system w=13}

Các khối của hệ thống và kết nối giữa chúng, cấu hình backend đang chạy, thông số kết nối, và bộ giới hạn an toàn đang
có hiệu lực (độ cao, khoảng cách home, vận tốc lái tay). Trước khi bay, xem trang này để chắc backend đang chạy cấu hình
drone thật (MAVLink qua DroneBridge, camera thật), không phải cấu hình SITL.

### Cài đặt (Alt+0)

![Trang Cài đặt: giao diện, bản đồ, chất lượng 3D, âm thanh cảnh báo](docs/bao-cao/img/web/web-settings.png){#fig:pa-web-settings w=13}

1. Giao diện: theme ngày hoặc đêm, hiệu ứng chuyển động, bảng phím tắt.
2. Bản đồ: bản đồ nền mặc định, vệt đường bay, vòng giới hạn phần mềm.
3. Không gian 3D: chất lượng render, mặt đất, hậu kỳ.
4. Âm thanh cảnh báo: tiếng bíp, giọng đọc khi có sự kiện, âm lượng.

![Mục Giao diện: theme, hiệu ứng chuyển động, bảng phím tắt](docs/bao-cao/img/web/web-settings-giao-dien.png){#fig:pa-cai-dat-giao-dien w=13}

### Lịch sử bay (Alt+L)

![Trang Lịch sử bay: danh sách chuyến, đường bay, camera đã ghi, biểu đồ và thanh phát lại](docs/bao-cao/img/web/web-flights.png){#fig:pa-web-flights w=15}

Sau buổi bay, tải log FC qua USB trước khi bay tiếp, vì chip log 16 MB chỉ chứa khoảng 20 phút bay và log cũ nhất bị
ghi đè dần:

```
uv run --with pyserial python scripts/fc/tai_log.py COM6 --tat-ca
```

Trang Lịch sử bay tự ghép log FC, tlog và video theo giờ GPS. Lần đầu mở, backend phải đọc hết log nên mất chừng nửa
phút.

1. Chọn một chuyến trong danh sách Các chuyến (giờ, thời lượng, độ cao và khoảng cách lớn nhất, chuỗi chế độ bay).
2. Đọc Tóm tắt chuyến: thời gian, cao và xa nhất, quãng đường, pin, mất gói, khung/s camera, số cảnh báo, nguồn dữ liệu.
3. Bấm phát trên thanh Phát lại (1×, 2×, 4×, 8×). Dải màu là chế độ bay, vạch là cảnh báo; đường bay, khung camera và
   biểu đồ cùng chạy theo đầu phát.
4. Bấm vào một biểu đồ để tua tới thời điểm đó. Có chín biểu đồ: độ cao và khoảng cách home, tốc độ ngang, điện áp,
   dòng, RSSI, mất gói, khung/s camera, số vệ tinh, rung.
5. Khung AI cho xem ảnh gốc và Ảnh rõ cạnh nhau hoặc qua thanh trượt, kèm khung nhận diện người; phóng to thì cả hai
   bên phóng cùng một chỗ.

Bản dòng lệnh của cùng dữ liệu: `uv run python -m backend.flights --events`.

## Quy tắc an toàn

Các quy tắc sau lấy từ `SAFETY.md` của dự án. Vi phạm bất kỳ quy tắc nào là đủ lý do huỷ buổi bay.

1. FC chạy ArduPilot là thành phần duy nhất giữ thăng bằng. Web chỉ gửi lệnh mức cao (mode, ARM, cất cánh, hạ cánh, RTL,
   vận tốc ở GUIDED, mission). AI chỉ sinh sự kiện, không bao giờ điều khiển motor.
2. Tháo cánh khi Motor Test, kiểm chiều quay, hiệu chỉnh ESC, thử failsafe và mọi lần thử lệnh từ web khi drone còn
   trên bàn.
3. Không tắt hàng loạt pre-arm check để ARM cho được. Pre-arm báo lỗi là có nguyên nhân thật: sửa nguyên nhân.
4. Người vận hành luôn cầm tay phát trong mọi chuyến có web tham gia. Tay cầm luôn có quyền cao nhất.
5. Dead-man: thả phím, đóng trình duyệt hay trình duyệt treo thì drone phải dừng; backend có hạn 300 ms riêng.
6. Kiểm pin trước mỗi buổi, không sạc khi không có người trông.
7. Bay ở bãi rộng, không người ngoài, không xe, không cây gần; bay thấp trước rồi tăng dần. Rào ảo trên FC là lớp an toàn
   chính, giới hạn của web chỉ là lớp phụ.
8. Mất camera hay AI không được làm drone đổi hành vi bay.

## Xử lý tình huống thường gặp

- Nếu web báo `Takeoff blocked: ESC RPM out of range` thì có motor chưa quay đủ vòng: DISARM, chờ vài giây, ARM lại.
- Nếu FC báo `Check mag field` thì đã cắm USB trước pin: cắm pin, khởi động lại FC khi đang có pin.
- Nếu đã bắt đầu hiệu chỉnh la bàn rồi huỷ giữa chừng mà FC báo `Compass calibrated requires reboot` thì khởi động lại
  FC; offset cũ vẫn còn.
- Nếu FC báo `Auto mode not armable` thì đang ARM ở AUTO: chuyển LOITER, ARM, cất cánh rồi mới chuyển AUTO.
- Nếu sau 60 s backend vẫn chưa nhận FC thì kiểm pin drone đã cắm chưa, chạy `wifi_ping_check.py`, và xem Mission
  Planner có đang chiếm cổng UDP 14550 không.
- Nếu hai ESP32 cùng mất sóng vài giây thì laptop đang quét Wi-Fi, đang chạy pin với Energy Saver, hoặc card đang nối
  thêm mạng khác: chạy `che_do_bay.ps1 -Bat`, lấy internet qua cáp iPhone, cắm sạc.
- Nếu hotspot tự tắt khoảng 20 phút sau khi bật thì mạng có internet mà nó chia sẻ lúc bật đã mất: khi drone đã hạ cánh,
  chạy `scripts\esp32\hotspot-on.ps1 -Restart`.
- Nếu camera báo OFFLINE hoặc tụt khung khi bay xa thì đó là tầm Wi-Fi của camera (khoảng 15 m); telemetry và điều khiển
  vẫn chạy, cứ bay tiếp bằng tay cầm.
- Nếu trình duyệt từ chối `127.0.0.1:5173` thì mở `http://localhost:5173`.
- Nếu drone rơi hoặc mất lái thì tải log FC ngay bằng `tai_log.py` trước khi bay chuyến tiếp theo.
- Nếu thấy điện áp pin khoảng 25 V thì đang cắm pin 6S: không bay.
