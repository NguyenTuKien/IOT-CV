# Trạm mặt đất: backend và web điều khiển

Chương này mô tả phần mềm chạy trên laptop ngoài bãi bay: backend FastAPI nói chuyện với bo bay qua MAVLink, và giao diện web React mà người vận hành dùng để theo dõi, lái tay, lập mission và xem lại các chuyến đã bay. Nội dung đi từ kiến trúc backend, hợp đồng dữ liệu giữa backend và web, cách web được quyền lái và bị lấy lại quyền, cơ chế dead-man, các lớp an toàn, quy trình nạp mission, tới từng trang của web và trang Lịch sử bay.

## Kiến trúc backend

Backend viết bằng Python 3.13 trên FastAPI, quản lý gói bằng `uv`. Phần mã chính trong `backend/` có 11 671 dòng, chưa tính 8 107 dòng test (đếm bằng `wc -l` ngày 26/11/2026). Có một luật xuyên suốt: web không bao giờ đọc MAVLink trực tiếp. Gói MAVLink đi từ bo bay qua ESP32 DroneBridge tới cổng UDP 14550 của laptop, backend giải mã, chuẩn hoá thành JSON có schema rồi mới đẩy lên trình duyệt. Nhờ vậy giao diện không phải biết `custom_mode` của ArduPilot là gì, hay HEARTBEAT nào là của bo bay.

FastAPI chạy trên một vòng sự kiện asyncio. Những việc cần đúng giờ hoặc nặng được tách ra thread riêng để không chặn vòng đó: thread đọc MAVLink, vòng dead-man, pipeline AI và phần ghép lịch sử bay. @fig:c6-kien-truc chia backend thành ba tầng theo cách đó.

![Ba tầng của backend: các thread nói chuyện với bo bay ở dưới, hub WebSocket và REST ở giữa, camera, AI và lịch sử bay ở trên. Số dòng đếm ngày 26/11/2026.](docs/thuyet-trinh/img/tikz/F22.png){#fig:c6-kien-truc w=15}

Bảng: Các khối chính của backend và việc của từng khối {#tab:c6-module}
| Khối | File | Dòng | Việc |
|---|---|---|---|
| Liên kết | `mavlink/connection.py` | 486 | nối UDP/TCP/serial, xin nhịp, lọc HEARTBEAT, ghi tlog |
| Telemetry | `mavlink/telemetry.py` | 568 | gói MAVLink thành trạng thái chuẩn hoá |
| Lệnh bay | `mavlink/control.py` | 451 | mode, ARM, cất cánh, vận tốc, RTL, LAND, chờ ACK |
| Mission | `mavlink/mission.py` | 850 | kiểm, nạp, đọc lại so khớp, GUIDED giữ chỗ |
| Dead-man | `mavlink/deadman.py` | 321 | thread riêng, tự gửi vận tốc 0 |
| An toàn | `mavlink/safety.py` | 278 | quyền web, RC luôn ưu tiên |
| Vật cản | `mavlink/proximity.py` | 179 | số đo TFmini thành trạng thái tránh |
| Hub WebSocket | `ws.py` | 1 145 | phát telemetry, nhận lệnh, trần nhịp |
| Hợp đồng | `schemas.py` | 864 | schema Pydantic cho mọi message |
| Camera và AI | `vision/` (16 file) | 3 140 | đọc MJPEG, ghi video, ba model AI |
| Lịch sử bay | `flights/` (8 file) | 2 031 | ghép log FC, tlog, video |

Mọi ngưỡng (trần vận tốc, độ cao, thời gian chờ, đường dẫn model) đọc từ biến môi trường trong `backend/config.py`, nên cùng một mã chạy được cho drone ảo lẫn drone thật. Khi bay thật, file `chay-drone-that.bat` đặt `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550`, độ cao tối đa 18 m và khoảng cách tối đa tới home 95 m.

## Bốn kiểu trao đổi dữ liệu

Backend dùng cả bốn mô hình trao đổi dữ liệu của môn học, mỗi mô hình cho một loại dữ liệu.

- **Yêu cầu phản hồi (REST).** Trình duyệt hỏi trạng thái, cấu hình, hay nạp mission và chờ kết quả. Kiểu này hợp với việc cần biết chắc thành công hay thất bại.
- **Xuất bản và đăng ký (bus sự kiện).** `backend/events.py` chỉ có 93 dòng: một vòng đệm 200 sự kiện gần nhất cùng danh sách người đăng ký. Thread telemetry, dead-man và AI cùng đẩy sự kiện vào đây. Vòng đệm giúp tab mở sau khi drone đã bay vài phút vẫn thấy chuyện đã xảy ra, qua `GET /api/events`.
- **Đẩy kéo (video).** Backend mở đúng một kết nối tới luồng MJPEG của camera và giữ khung mới nhất. AI và các tab xem tự lấy khung đó, nên bo ESP32-S3 không phải phục vụ nhiều người xem.
- **Kết nối độc quyền (WebSocket).** Tab người lái giữ một socket `/ws` suốt phiên, nhận telemetry 8 lần mỗi giây và gửi lệnh lái. Socket đóng là dấu hiệu người lái đã rời đi.

## Hợp đồng REST và WebSocket

Mọi message giữa backend và web được khai báo một lần trong `backend/schemas.py` bằng Pydantic. Từ đó backend sinh `ws-contract.schema.json`, và web sinh kiểu TypeScript bằng `pnpm gen:protocol`. Một trường đổi tên ở backend làm kiểu bên web hỏng ngay lúc biên dịch, thay vì lỗi lúc bay. @tab:c6-rest liệt kê các route REST chính.

Bảng: Các route REST của backend (tiền tố `/api`) {#tab:c6-rest}
| Nhóm | Route |
|---|---|
| Trạng thái | `GET /health`, `/status`, `/config`, `/system` |
| Mission | `GET /mission`, `POST /mission` |
| Sự kiện, biểu đồ | `GET /events`, `GET /telemetry/history` |
| Video | `GET /video/stream` (gốc hoặc ảnh rõ), `GET /video/fake-source` (nguồn thử cho SITL) |
| Ghi hình | `GET /recording`, `POST /recording/start`, `POST /recording/stop` |
| Lịch sử bay | `GET /flights`, `GET /flight`, `GET /flights/frame`, `GET /flights/ai` |

WebSocket `/ws` dùng một phong bì chung `{v, type, ts, id?, data}`. Chiều lên có 10 loại lệnh, chiều xuống có 7 loại message: `telemetry`, `status`, `event`, `detection`, `ack`, `error`, `pong`. Mỗi loại lệnh có trần nhịp riêng (@tab:c6-ws) để một tab lỗi không gửi dồn dập làm nghẽn đường MAVLink vốn chỉ chạy 115 200 baud giữa bo bay và ESP32.

Bảng: Lệnh chiều lên của WebSocket và trần nhịp {#tab:c6-ws}
| Lệnh | Việc | Trần (lệnh/s) |
|---|---|---|
| `cmd.velocity` | lái tay bằng vận tốc | 30 |
| `cmd.web_control_enable` | bật, tắt quyền lái của web | 5 |
| `cmd.mode` | đổi chế độ bay | 5 |
| `cmd.hold`, `cmd.rtl`, `cmd.land` | đứng yên, về home, hạ cánh | 5 mỗi loại |
| `cmd.arm`, `cmd.takeoff` | ARM, cất cánh | 2 mỗi loại |
| `cmd.mission.upload` | nạp mission | 1 |
| `ping` | đo độ trễ liên kết | 2 |

Hub có ba quy tắc. Một vòng phát duy nhất cho mọi socket, nên hai tab không lệch pha nhau. Message hỏng không đóng socket mà chỉ trả `error` với một trong 12 mã lỗi (`bad_payload`, `rate_limited`, `wrong_mode`, `timeout`...), vì đóng socket nghĩa là mất luôn telemetry. Tại mỗi thời điểm chỉ một socket giữ quyền lái.

## Kết nối với bo bay

Sau mỗi lần nối, backend xin bo bay gửi từng message với nhịp riêng bằng `MAV_CMD_SET_MESSAGE_INTERVAL` (ví dụ ATTITUDE 10 Hz, BATTERY_STATUS 1 Hz), mỗi 2 s chào bo DroneBridge để nó nhớ địa chỉ laptop, và bỏ mọi HEARTBEAT có `autopilot = MAV_AUTOPILOT_INVALID` để chỉ tin trạng thái của bo bay; chi tiết ở chương 5. Mỗi gói nhận được còn được ghi vào tlog kèm 8 byte giờ nhận, đúng định dạng Mission Planner mở được, với bộ đệm 4 KB nên mất điện đột ngột chỉ mất dưới 1 s dữ liệu. Telemetry 900 s gần nhất (7 200 gói ở 8 Hz) được giữ trong RAM để trang Dữ liệu bay vẽ biểu đồ ngay khi mở.

## Quyền lái và lệnh vận tốc

Web không tự giành quyền. Người vận hành phải bật WEB CONTROL trên web và bật công tắc SwA (kênh 7) trên tay cầm, bo bay phải đang ở GUIDED, và tab phải là tab giữ quyền. Người lái gạt tay cầm sang chế độ khác GUIDED là web mất quyền ngay (`backend/mavlink/safety.py`).

Web lái bằng vận tốc chứ không bằng toạ độ. Backend gửi `SET_POSITION_TARGET_LOCAL_NED` trong khung `MAV_FRAME_BODY_OFFSET_NED` (trục X hướng mũi, Y sang phải, Z xuống), với `type_mask = 0x0DC7` nghĩa là bỏ qua vị trí và gia tốc, chỉ nghe vận tốc và tốc độ xoay. Sai một bit ở mặt nạ này thì bo bay hiểu thành lệnh bay về toạ độ (0, 0, 0), nên giá trị được ghim trong một hằng số có test riêng. Trần vận tốc 1,0 m/s, xoay 45°/s.

Bảng: Phím lái tay trên web {#tab:c6-phim}
| Phím | Lệnh | Phím | Lệnh |
|---|---|---|---|
| W hoặc ↑ | tiến | R | lên |
| S hoặc ↓ | lùi | F | xuống |
| A hoặc ← | sang trái | Q | xoay trái |
| D hoặc → | sang phải | E | xoay phải |
| Space | dừng ngay | H | HOLD đứng yên |

Giữ phím không gửi lệnh trực tiếp. Phím chỉ đặt trạng thái, còn một bộ hẹn giờ 10 Hz là nơi duy nhất gửi `cmd.velocity`, nên nhịp gửi không phụ thuộc tốc độ lặp phím của hệ điều hành và luôn dưới trần 30 lệnh/s. Thả phím thì gửi thêm 3 nhịp vận tốc 0; Space hay cửa sổ mất tiêu điểm gửi 0 ngay. Web cũng nhận tay cầm game nếu cắm vào laptop.

## Dead-man

Lái bằng vận tốc đặt ra câu hỏi: web ngừng gửi lệnh thì drone làm gì? Dead-man trả lời bằng ba lớp độc lập, mỗi lớp cho một kiểu hỏng (@tab:c6-deadman).

Bảng: Ba lớp dead-man và thời gian dừng {#tab:c6-deadman}
| Kiểu hỏng | Ai phát hiện | Hành động | Thời gian |
|---|---|---|---|
| Đóng tab, rớt mạng | backend thấy socket đóng | gửi vận tốc 0 ngay | 6 và 7 ms (SITL, đo 2 lần) |
| Trình duyệt treo, socket còn mở | hết hạn 300 ms không có lệnh | nhịp 50 ms kế tiếp gửi 0 | ≤ 350 ms |
| Backend chết | bo bay | ArduPilot tự huỷ lệnh vận tốc | khoảng 3 s |

Vòng dead-man chạy trong `threading.Thread` riêng, không nằm trong asyncio. Nếu một handler nào đó chặn vòng sự kiện (ghi file chậm, gọi nhầm hàm blocking), vòng dead-man vẫn chạy đúng giờ; test `test_event_loop_bi_chen_van_gui_zero` đỏ ngay nếu ai đó chuyển vòng này vào asyncio. Bảo đảm của hệ là `MANUAL_COMMAND_TIMEOUT_MS + DEADMAN_TICK_MS` = 350 ms, không phải 300 ms. Lệnh 0 được gửi lặp 5 nhịp để chắc tới nơi qua Wi-Fi, và mỗi lần gửi được ghi vào `logs/deadman.jsonl`. Vòng này còn làm việc ngược lại: khi người lái đang giữ phím, nó gửi lại vận tốc gần nhất, vì ArduPilot cố ý huỷ lệnh vận tốc sau khoảng 3 s không có lệnh mới. Trạng thái "dead-man đã kích" giữ nguyên tới khi người vận hành bật lại WEB CONTROL, coi như cái gật đầu "tôi đã thấy có một lần mất kết nối".

## Các lớp an toàn

An toàn được xếp thành bốn lớp lồng nhau, lớp trong thắng lớp ngoài (@fig:c6-lop-an-toan). Giới hạn của backend chặt hơn của bo bay để lớp ngoài chạm trước, còn bo bay là lớp chính vì nó vẫn chạy khi laptop hay Wi-Fi hỏng.

![Bốn lớp an toàn lồng nhau, lớp trong luôn thắng lớp ngoài: tay cầm RC, bo bay, backend, web.](docs/thuyet-trinh/img/tikz/F26.png){#fig:c6-lop-an-toan w=11}

Trong cùng là tay cầm RC: gạt chế độ là lấy lại quyền, SwB là công tắc ARM, mất sóng thì bo bay tự RTL. Bo bay giữ rào ảo trụ bán kính 100 m, trần 20 m, lề 2 m (chạm rào thì RTL), failsafe pin, và AVOID dừng drone cách vật cản 2 m. Backend có dead-man, trần 1,0 m/s và 45°/s, mission 2 đến 18 m, tối đa 10 điểm, cách home không quá 95 m. Ngoài cùng, web chỉ lái ở GUIDED, khi WEB CONTROL và SwA cùng bật, và chỉ một tab.

Trạng thái vật cản được backend tính từ `DISTANCE_SENSOR` của TFmini Plus thành bốn giá trị `OFF`, `NEAR`, `ACTIVE`, `UNKNOWN`, với `AVOID_DIST_MAX_M = 5`, `AVOID_MARGIN_M = 2`; số đo cũ hơn 2 s bị coi là `UNKNOWN` để giao diện không hiển thị một khoảng cách đã chết. Ở GUIDED bo bay không tự tránh, nên trang Bay hiện dòng cảnh báo suốt thời gian đó.

## Lập và nạp mission

Trên trang Nhiệm vụ, người vận hành bấm điểm trên bản đồ, chỉnh độ cao từng điểm, xem hồ sơ độ cao và xem trước lộ trình 3D. Web có bốn mẫu lộ trình tự sinh quanh home: vòng tròn, đa giác, quét lưới và đi về; lộ trình lưu được trên máy hoặc xuất, nhập file `.waypoints` của Mission Planner. Luật kiểm tra ở web soi gương luật ở backend: vượt giới hạn thì báo đỏ, không âm thầm cắt bớt điểm (@fig:c6-trang-mission).

![Trang Nhiệm vụ: danh sách waypoint, hồ sơ độ cao, thống kê quãng đường và nút nạp xuống bo bay rồi đọc lại.](docs/bao-cao/img/web/web-mission.png){#fig:c6-trang-mission w=15}

Backend kiểm mission thêm một lần trước khi gửi: tối đa 10 điểm, độ cao 2 đến 18 m, không điểm nào cách home quá 95 m. Ngưỡng 2 m có từ một bài SITL: bo bay nhận và bay waypoint 3 m xuống tới 3,2 m mà không chặn, nên chặn điểm thấp là việc của backend (chương 7).

Giao thức mission của MAVLink là kiểu kéo. Trạm báo có N điểm bằng `MISSION_COUNT`, bo bay xin lần lượt từng điểm bằng `MISSION_REQUEST_INT`, trạm gửi `MISSION_ITEM_INT`, cuối cùng bo bay trả `MISSION_ACK`. Gói mất thì bo bay xin lại, nên giao thức chịu được Wi-Fi chập chờn nếu thời gian chờ đủ dài: backend chờ mỗi điểm 3 s và thử lại tối đa 8 lần, khoảng 24 s cho cả lượt. Nạp xong, backend đọc lại toàn bộ mission bằng `MISSION_REQUEST_LIST` và so từng trường với bản đã gửi, sai số độ cao cho phép 0,1 m. Thứ nằm trong bo bay đúng là thứ người vận hành đã vẽ thì web mới báo xong.

Trường hợp khó nhất là nạp mission mới khi drone đang bay AUTO theo mission cũ. Thay mission giữa chừng thì không rõ bo bay sẽ đi tiếp điểm nào, nên backend chuyển GUIDED để drone đứng giữ chỗ trước khi gửi bất kỳ gói mission nào; không chuyển được thì dừng và không gửi gì. Nạp và đọc lại xong, backend gửi `DO_SET_MISSION_CURRENT 1`, người lái gạt AUTO để drone bay mission mới từ điểm 1 (@fig:c6-nap-auto). Trên SITL, bước chuyển GUIDED mất dưới 0,1 s và drone lệch 0,42 m trong lúc đứng chờ. Trên drone thật, chuyến 10:40 ngày 02/11/2026 nạp mission theo đúng trình tự này, bo bay báo "Flight plan received", gạt AUTO là drone bay lại từ "1 Takeoff".

![Trình tự nạp mission khi đang bay AUTO: GUIDED giữ chỗ, nạp từng điểm theo giao thức kéo, đọc lại so khớp, đặt điểm hiện tại về 1.](docs/thuyet-trinh/img/tikz/F24.png){#fig:c6-nap-auto w=13}

## Giao diện web

Web viết bằng React 19, Vite và TypeScript, giao diện dựng trên Tailwind CSS và shadcn/ui, bản đồ dùng Leaflet, vẽ mission bằng terra-draw, 3D bằng three.js qua @react-three/fiber, biểu đồ bằng uPlot. Thư mục `frontend/src` có 147 file với 20 689 dòng. Web có 11 trang, mở nhanh bằng Alt cộng số (@tab:c6-trang). Màu, nhãn chế độ bay và nhãn nguồn sự kiện lấy từ một chỗ chung (`lib/tone.ts`, `lib/modes.ts`, `lib/eventStyle.ts`) nên cùng một trạng thái có cùng màu ở mọi trang.

Bảng: Các trang của web và việc chính {#tab:c6-trang}
| Phím | Trang | Việc chính |
|---|---|---|
| Alt+1 | Bay | buồng lái: HUD, bản đồ, chế độ bay, lái tay, vật cản, video |
| Alt+2 | Nhiệm vụ | soạn lộ trình, hồ sơ độ cao, xem trước 3D, nạp và đọc lại |
| Alt+3 | Không gian 3D | bản sao số của drone: tư thế thật, vệt bay, rào ảo, tia TFmini |
| Alt+4 | Camera & AI | luồng camera, hộp người, trạng thái model |
| Alt+5 | Tổng quan | sức khoẻ từng khối, mức sẵn sàng bay |
| Alt+6 | Dữ liệu bay | biểu đồ thời gian thực mọi trường telemetry, xuất CSV |
| Alt+7 | Nhật ký | sự kiện lọc theo mức, nguồn; lệnh kèm độ trễ xác nhận |
| Alt+L | Lịch sử bay | phát lại từng chuyến từ log |
| Alt+8 | Kiểm tra trước bay | cổng kiểm tự động và việc người vận hành xác nhận |
| Alt+9 | Hệ thống | kiến trúc, trạng thái backend, giới hạn an toàn |
| Alt+0 | Cài đặt | giao diện, bản đồ, chất lượng 3D, âm thanh, phím tắt |

Trang Bay là trang người vận hành nhìn nhiều nhất (@fig:c6-trang-bay). Nó được thiết kế để vừa một màn hình laptop 1707×900 không phải cuộn: chân trời giả, độ cao, tốc độ, pin, GPS và tuổi liên kết ở trên; bản đồ có home; khối chế độ bay với ARM và TAKEOFF; bàn phím lái tay và radar vật cản luôn hiện; nhật ký sự kiện và khung video ở dưới.

![Trang Bay nối drone ảo SITL: HUD, bản đồ, chế độ bay, bàn phím lái tay, radar vật cản, nhật ký và video.](docs/bao-cao/img/web/web-bay.png){#fig:c6-trang-bay w=16}

Trang Kiểm tra trước bay chia việc làm hai phần: phần tự động đọc từ telemetry (backend và drone có nối, GPS có 3D fix, EKF khoẻ, pin trên ngưỡng, có điểm home, TFmini và camera khoẻ, WEB CONTROL đang tắt), phần còn lại người vận hành tự xác nhận vì máy không thấy được (cánh quạt, điện áp từng cell, đã thử gạt tay cầm lấy lại quyền, bãi bay trống, rào ảo đã bật trên bo bay). Ảnh chụp từng trang và cách dùng nằm ở Phụ lục A.

Trang Camera & AI và phần AI trên trang Lịch sử bay được trình bày ở chương 8.

## Lịch sử bay

Mỗi chuyến bay để lại ba nguồn dữ liệu ở ba nơi. Bo bay ghi log dataflash `.bin` với GPS, tư thế, pin, rung và TFmini, mẫu dày và đủ cả chuyến. Backend ghi tlog, có thứ log bo bay không có: chất lượng liên kết (gói mất tính theo số `seq`, RSSI của DroneBridge). Backend còn ghi video camera thành từng đoạn 300 s trong `logs/recordings`, tự dừng khi ổ đĩa còn dưới 2 GB. Gói `backend/flights` đọc cả ba và đưa về một trục thời gian chung (@fig:c6-ghep-nguon).

![Ba nguồn dữ liệu của một chuyến bay (log FC, tlog, video) được ghép trên cùng trục giờ GPS rồi đưa lên trang Lịch sử bay.](docs/thuyet-trinh/img/tikz/F28.png){#fig:c6-ghep-nguon w=16}

Một chuyến được định nghĩa là một lần ARM tới DISARM. Log FC lấy giờ thật từ GPS (tuần và mili giây GPS), còn tlog và video dùng đồng hồ laptop lúc nhận, nên hai bên lệch nhau. Backend chỉnh lệch theo thứ tự tin cậy: gói `SYSTEM_TIME` trong tlog, rồi khớp các lần ARM cùng độ dài với log FC, rồi độ lệch của tlog gần nhất. Không chỉnh thì video lệch gần một phút so với đường bay; với chuyến 10:40 ngày 02/11, trang báo đồng hồ laptop chậm 54,2 s và đã chỉnh. Mẫu của từng nguồn được gom về lưới 0,2 s ngay khi đọc. Mỗi cột số liệu lấy từ nguồn tốt nhất có trong chuyến, dataflash trước rồi tới tlog; ngoài vùng có dữ liệu thì để trống, vì "không biết" khác "tốt". Đọc một file `.bin` 14 MB mất hàng chục giây, nên kết quả từng file được lưu đệm JSON, khoá theo đường dẫn, cỡ và thời điểm sửa file.

![Trang Lịch sử bay mở chuyến 10:40 ngày 02/11/2026: danh sách chuyến, đường bay trên ảnh vệ tinh, khung camera đã ghi tại đầu phát, thanh phát lại tô màu theo chế độ bay.](docs/thuyet-trinh/img/real/lsb-1040-tong-quan.png){#fig:c6-lich-su-bay w=16}

Trang Lịch sử bay (@fig:c6-lich-su-bay) phát lại chuyến ở tốc độ 1×, 2×, 4× hoặc 8×. Đường bay trên bản đồ, khung camera, các biểu đồ và danh sách sự kiện cùng chạy theo một đầu phát. Phần tóm tắt cho thời lượng, độ cao và khoảng cách lớn nhất, quãng đường, pin đầu và cuối, mAh đã dùng, tỉ lệ mất gói, khung/s của camera. Bên dưới là chín biểu đồ: độ cao và khoảng cách tới home, tốc độ ngang, điện áp, dòng, RSSI DroneBridge, mất gói MAVLink, khung/s của camera, số vệ tinh và rung.

Giá trị của việc ghép nằm ở những đại lượng không nguồn nào đo được một mình. Khung/s của camera theo thời gian chỉ có khi đặt video cạnh giờ bay, và đặt thêm cạnh khoảng cách tới home thì thấy camera chậm lại ở đâu. @fig:c6-fps-chuyen vẽ cột đó từ chuỗi ghép của chuyến 10:40.

```chart
type: line
csv: docs/thuyet-trinh/facts/data/chuoi-20261102-104039.csv
x: t_since_arm_s
y: cam_fps_2s
xlabel: Thời gian từ lúc ARM (s)
ylabel: Khung/s camera (cửa sổ 2 s)
caption: Khung/s của camera theo thời gian trong chuyến 10:40 ngày 02/11/2026, lấy từ chuỗi ghép log FC, tlog và video.
id: fig:c6-fps-chuyen
w: 14
```

Toàn bộ bảng chuyến và sự kiện in được bằng dòng lệnh, nên mọi số trên trang kiểm lại được mà không cần mở trình duyệt:

```
uv run python -m backend.flights --events
```
