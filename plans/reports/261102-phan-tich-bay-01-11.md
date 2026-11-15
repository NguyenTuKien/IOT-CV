# Phân tích buổi bay ngoài trời tối 01/11/2026

Viết 02/11/2026. Nguồn: log dataflash tải từ FC qua USB sáng 02/11
(`logs/fc-dataflash-20261101-bay-ngoai-troi/001-khong-gio-thieu.bin`), tlog và video của backend
(`logs/tlog/`, `logs/recordings/`), nhật ký hệ thống Windows, toàn bộ tham số FC đọc lại 02/11.
Bảng số từng chuyến: `logs/fc-dataflash-20261101-bay-ngoai-troi/phan-tich-001.md` (sinh bằng
`scripts/fc/phan_tich_log.py`).

## 1. Kết luận

1. **Trong khoảng 45 phút bay (19:45–20:31) chỉ còn dữ liệu của 19 phút cuối.** Log FC phủ
   20:12:18–20:31:01 (5 chuyến). Các chuyến trước đó, gồm cả những lần rơi, vượt fence và bay
   Stabilize, đã bị ghi đè trên chip 16 MB. Laptop **ngủ lúc 19:45:33** ("Sleep Reason: Button or
   Lid"), thức lại 20:33:02, rồi tắt hẳn lúc 20:34 vì pin cạn. Vì vậy suốt buổi bay không có tlog,
   video, nhật ký web hay Mission Planner.
2. **Năm chuyến còn log đều bay tốt**: hạ cánh cách home 3–19 cm, rung thấp, EKF khoẻ, pin dư. Có
   một lỗi phần cứng thật: **motor M1 (sau-phải) khởi động lỗi ở 4/5 lần ARM**.
3. Lỗi M1 khởi động là thủ phạm có bằng chứng mạnh nhất cho các lần "cắm đầu" lúc rời đất. Kéo ga
   khi M1 chưa quay thì drone lật về phía M1. Không còn log của chính các lần rơi nên chưa chứng minh
   được 100 %.
4. Mạng chập chờn là do **laptop**, không phải ESP32 hay NetBird. 01/11 là buổi đầu laptop chạy pin:
   máy ngủ khi gập nắp hoặc bấm nút nguồn, tự ngủ sau 10 phút không chạm, Energy Saver tự bật ở
   40–50 % pin, card Wi-Fi tiết kiệm điện ở scheme Balance. Lúc cắm sạc thì không có bẫy nào trong số
   này. Thêm nữa, card Wi-Fi vừa nối mạng ngoài (iPhone hay router) vừa phát hotspot thì phải chia sóng
   (đo sáng 02/11). Đã chuyển sang lấy internet từ iPhone **qua cáp**: card Wi-Fi chỉ còn phát hotspot.
5. "Nhật ký báo lỗi liên tục" có ba nguồn: FC nhắc PreArm 30 giây một lần ở mức CRITICAL (hiện thành
   dòng đỏ), link mất/nối lại liên tục, và rác ghi file (66/75 tlog rỗng, 223 file video cho một buổi).
   Cả ba đã sửa.
6. Sau mỗi lần hotspot chập chờn, DroneBridge **quên laptop** và backend chờ mãi tới khi rút pin drone.
   Backend giờ tự gửi gói chào tới bo trong lúc chờ nối (`MAVLINK_UDP_HELLO`), đã kiểm trên drone thật.
7. **Hotspot tự tắt 20 phút sau khi mạng nó đang chia sẻ biến mất** (thấy 05:11:13 sáng 02/11). Hotspot
   bám vào mạng có internet ở thời điểm nó được bật. `chay-drone-that.bat` giờ luôn bật lại hotspot, và
   dừng lại chờ sửa khi có cảnh báo.

## 2. Dữ liệu còn và mất

| Nguồn | Còn | Mất | Vì sao |
|---|---|---|---|
| Log FC (dataflash) | 20:12:18–20:31:01, 5 chuyến | mọi chuyến trước 20:12 | ~17,2 KB/s khi ARM → 16 MB ≈ 15 phút bay; chip đầy thì xoá log cũ nhất từ đầu. Log còn lại cũng mất 62,6 KB đầu (mất bảng FMT) |
| tlog backend | 19:12–19:45:36 (4,9 MB) | 19:45–20:34 | laptop ngủ → hotspot tắt |
| Video camera | 19:12–19:45 (223 file AVI) | 19:45–20:34 | như trên |
| Mission Planner | tới 19:43 | sau 19:43 | đã đóng |

Log FC chỉ ghi lúc ARM (`LOG_DISARMED 0`), nên giai đoạn chờ ARM (PreArm, GPS) không bao giờ có
trong log FC.

## 3. Năm chuyến còn log

| # | Giờ | Chế độ | Cao nhất | Xa nhất | Hạ cách home | M1 khởi động |
|---|---|---|---|---|---|---|
| 1 | 20:13:05–20:16:41 | Stabilize (32 s bay) → Loiter → RTL | 15,3 m | 34,7 m | 0,13 m | hụt 1 lần |
| 2 | 20:18:51–20:22:03 | Loiter → AUTO → Loiter → RTL | 15,4 m | 34,1 m | 0,13 m | tốt |
| 3 | 20:24:14–20:25:49 | Loiter → AUTO (Đi–về) | 8,2 m | 3,2 m | 0,08 m | hụt 1 lần |
| 4 | 20:26:25–20:28:08 | Loiter → AUTO (Đi–về) | 15,1 m | 5,9 m | 0,03 m | hụt 1 lần |
| 5 | 20:28:34–20:30:46 | Loiter → AUTO (Đi–về) | 18,1 m | 23,6 m | 0,19 m | **không bắt vòng 2,6 s** |

Chung cả 5 chuyến: rung TB 7–12 m/s² (max 26, ngưỡng xấu 60), `Clip` 0; tỉ số EKF ≤ 0,44 (< 1 là
tốt); bám góc RMS 1,0–1,6°; 4 motor lệch nhau ≤ 31 µs; ESC ≤ 47 °C; pin 15,46 → 14,76 V, dòng TB
~9 A, tốn 239–568 mAh mỗi chuyến; hover học được 0,217–0,228; GPS 18–23 vệ tinh, HDOP ≤ 0,89;
CPU 42 %. Lúc rời đất pitch/roll lệch lệnh ≤ 2,2°, nên lỗi ngóc mũi ngày 27/10 đã hết sau lần
hiệu chỉnh level 01/11.

## 4. Từng vấn đề

**Mất lái, rơi bụi cỏ, cắm đầu.** Không còn log của chính các lần đó. Bằng chứng gián tiếp: ở 4/5
lần ARM có log, M1 khởi động lỗi. Ở chuyến 5, M1 đứng 0 vòng từ 0,38 s tới 2,98 s sau khi motor bắt
đầu quay, trong khi 3 motor kia đã ~1900 vòng. Trong 5 chuyến này người lái chờ 5,6–18,8 s mới cất
cánh, lúc đó cả 4 motor đã ≥ 1885 vòng nên không sao. Cất cánh nhanh trong vài giây đầu thì drone lật.
Ngày 25/10 (trong nhà, cùng `MOT_SPIN_ARM 0.13`) chỉ 2/28 lần, nên lỗi đã nặng lên sau ba lần va chạm
27/10. Đã đặt `TKOFF_RPM_MIN` (mục 5) làm lưới an toàn; vẫn cần kiểm cơ khí M1 (mục 7).

**Tiếng "khậc khậc".** Chính là M1 khởi động hụt ở trên: vòng quay vọt lên rồi tụt về gần 0 (log có
mẫu 2556 → 44162 → 7 và 3603 → 0 vòng).

**ARM bị từ chối** (tlog 19:12–19:45; mỗi lần 1–2 phút như bạn kể):

| FC báo | Nghĩa | Làm gì |
|---|---|---|
| `PreArm: GPS 1: not healthy` | gói GPS đến trễ: 2 gói liên tiếp cách > 245 ms, hoặc trung bình > 215 ms | chờ; lúc bay có log thì 9 lần hở 400 ms trong 851 s, chưa lần nào 2 gói liền |
| `Arm: Throttle too high` | cần ga chưa ở đáy | kéo ga xuống đáy rồi mới gạt SwB |
| `PreArm: Radio failsafe on`, `Throttle below failsafe`, `RC not found` | tay phát tắt hoặc mất sóng | bật tay phát trước |
| `Arm: RTL mode not armable` | SwD đang bật RTL | gạt SwD về |
| `PreArm: Proximity 0 deg, 0.16m (want > 0.6m)` | TFmini thấy cỏ cách mũi < 0,6 m | xoay mũi ra chỗ trống (giữ nguyên `RNGFND1_MIN`) |
| `PreArm: Fence enabled, need position estimate` | EKF chưa có vị trí | để drone đứng yên chờ GPS |

Trang web giờ hiện đúng các gợi ý này dưới từng dòng.

**Đèn GPS FIX nháy.** Bình thường. Tài liệu Holybro: đèn Fix tắt = chưa có 3D fix, nháy hoặc sáng đứng
= đã có 3D fix ([GPS LED & Buzzer Meaning](https://docs.holybro.com/gps-and-rtk-system/gps-led-and-buzzer/gps-led-and-buzzer-meaning),
truy cập 02/11/2026).

**Stabilize khó lái.** Đúng bản chất: không giữ độ cao, không giữ vị trí. Ở chuyến 1, cần lái gần như
để giữa (p95 lệch 8 µs) mà drone vẫn trôi tới 3,4 m/s theo gió. Hover chỉ ở 23 % ga nên nửa trên cần ga
rất nhạy. Bạn chọn giữ nguyên SwC; bay thường dùng Loiter, bay tay dùng AltHold.

**RTL, mission lệch chục cm.** Không phải lỗi. GPS không RTK thường sai 0,5–2 m; ở đây hạ cách home
3–19 cm, qua waypoint gần nhất 2–19 cm, là rất tốt.

**Bay cao, bay xa có chạm ngưỡng không.** Trong log còn lại: cao nhất 18,1 m (chuyến 5, đúng trần mềm
20 m − `FENCE_MARGIN` 2 m, nên AC_Avoid đã giữ lại), xa nhất 34,7 m (fence 50 m, chưa chạm). Lần bạn
cố vượt fence nằm trong phần log đã mất. SITL cho biết các mode khác nhau ra sao: Loiter tự dừng
trước rào (18,1 m; 48,1 m). Stabilize đẩy hết ga thì vọt lên 23,2 m (quá trần 3,2 m) rồi mới RTL.
AltHold ra khỏi vòng 50 m tới 53,4 m rồi mới RTL. Tức là chỉ Loiter (và mission) mới không chạm rào.

**EKF chuyển sang DCM 0,1 s lúc 20:27:58** (chuyến 4, đang hạ RTL). `XKF4.FS = 4` là bit 2 "phép ghép
la bàn trục X bị suy biến": EKF3 đặt lại ma trận hiệp phương sai (`CovarianceInit`), AHRS dùng DCM
một nhịp rồi về EKF3. GPS lúc đó tốt (21–23 vệ tinh). Một lần, tự hồi, chưa cần làm gì. Nếu lặp lại
thì làm compassmot (`COMPASS_MOT_*` đang 0); bài này phải quay motor nên bạn tự làm trong Mission
Planner.

**Mạng, hotspot, NetBird.** Trước 19:45, tlog mất 27–41 % gói MAVLink, từng đợt 3–5 s mỗi ~15 s,
RSSI vẫn tốt, tức lỗi ở phía laptop. Phiên iot-cv-34 đã đo ra Energy Saver là thủ phạm (tắt đi là
DroneBridge sạch). Đọc power plan 02/11 thấy thêm bốn chỗ:

| Cài đặt (power scheme Legion Balance đang dùng) | Cắm sạc | Chạy pin |
|---|---|---|
| Gập nắp | Ngủ | Ngủ |
| Nút nguồn / nút sleep | Ngủ | Ngủ |
| Tự ngủ sau | không bao giờ | **10 phút** |
| Energy Saver tự bật | – | **40 %** pin |
| Card Wi-Fi tiết kiệm điện | Max Performance | **Medium** (chỉ 2/4 scheme từng được đặt Max) |

`scripts/laptop/che_do_bay.ps1 -Bat` đặt cả năm mục về "không làm gì / Max Performance" trên cả 4
scheme, lưu giá trị cũ, `-Tat` trả lại. Bạn chọn **chưa bật**. NetBird 02/11 đang ở trạng thái
Disconnected, 0 peer, không có route. Không có bằng chứng nó gây ra lỗi nào. Muốn chắc thì
`netbird down` trước khi bay, không mất gì.

**Card Wi-Fi chia sóng (đo sáng 02/11, ở nhà, laptop cắm sạc, drone chạy pin).** Ping 4 lần/giây trong
60 s tới hai ESP32 và tới đường ra internet:

| Laptop lấy internet bằng | DroneBridge mất | Camera mất | Đường ra mất | Camera |
|---|---|---|---|---|
| Wi-Fi nhà 5 GHz kênh 120 (card vừa nối vừa phát hotspot) | 77/240 | 122/240 | router 50/240 | 1,41 khung/s |
| iPhone qua cáp USB (card Wi-Fi chỉ phát hotspot) | 7/240 | 47/240 | iPhone 0/240 | 4,67 khung/s |

Khi nối Wi-Fi nhà, router và hai ESP32 mất gói luân phiên từng khối ~5 s: card RZ616 chỉ có một radio,
chia thời gian giữa kênh mạng ngoài và kênh hotspot. Ngoài bãi 01/11 card cũng làm hai việc (nối Wi-Fi
iPhone 2,4 GHz kênh 6, sau thử 5 GHz kênh 149). Bỏ hẳn việc chia sóng bằng cách lấy internet từ iPhone
qua cáp. Đã cài Apple Mobile Device Support 20.0.1.47 vào `D:\IOT_Tools\apps\Apple\` (tách từ bộ cài
iTunes chính chủ; bản này không còn kèm driver, còn driver "Apple Mobile Device Ethernet" 1.8.5.1 do
Windows Update tự cài khi iPhone được tin cậy; ở ổ C chỉ còn bản lưu bộ cài 32,8 MB trong
`C:\ProgramData\Apple`). Hồ sơ Wi-Fi "iPhone nghaiz" chuyển sang nối tay. Có cáp thì Windows tự ngắt
Wi-Fi khỏi mạng ngoài (thấy lúc 04:51:13) mà link drone không rớt.

**DroneBridge quên laptop.** Sau một lần ngắt Wi-Fi nhà, hotspot đổi kênh, hai ESP32 nối lại và danh
sách `udp_clients` của DroneBridge rỗng: bo vẫn đọc FC (6,2 KB mỗi 5 s) nhưng không gửi gì về laptop,
backend chờ mãi. Gửi một gói bất kỳ tới bo là bo thêm lại client, gói đầu về sau 0,27 s; cổng đã đóng
(ICMP unreachable) không làm bo xoá client. Backend giờ, khi nghe UDP, gửi HEARTBEAT kiểu GCS (sysid 254,
khác `MAV_GCS_SYSID` 255 nên không đụng failsafe GCS) tới `MAVLINK_UDP_HELLO` (mặc định
`DroneBridgeESP32.mshome.net:14550`) mỗi `MAVLINK_UDP_HELLO_PERIOD_S` (2 s) trong lúc chờ FC; để trống là
tắt.

**Hotspot tự tắt sau 20 phút.** 05:11:13 cả hai bo mất sóng cùng lúc và không lên lại. Nhật ký
WLAN-AutoConfig ghi `8008 AutoConfig service has begun to stop the hosted network`, và với card ảo của
hotspot là `8003 ... Reason: The network is disconnected by the user`, tức chính Windows (dịch vụ Mobile
Hotspot) tắt hotspot, không phải card lỗi. Lúc đó vẫn có 2 bo đang nối, chế độ "không có thiết bị thì tự
tắt" đã tắt (`PeerlessTimeoutEnabled 0`). Mốc khớp đúng tới giây: hotspot được bật lúc laptop còn dùng
Wi-Fi nhà; 04:51:13 Windows ngắt Wi-Fi nhà vì cáp iPhone đã có internet; 05:11:13 là đúng 20 phút sau.
Hotspot bám vào mạng có internet ở thời điểm được bật, mạng đó mất thì 20 phút sau Windows tắt hotspot.
Windows không có cách đọc hotspot đang chia sẻ card nào (giá trị `PreferredPublicInterface` trong registry
của `icssvc` chỉ là lựa chọn của trang Settings: bật lại từ cáp iPhone mà nó vẫn trỏ card Wi-Fi), nên cách
chữa là bật lại hotspot sau khi đã có đúng mạng: `hotspot-on.ps1 -Restart`. `chay-drone-that.bat` luôn
chạy nó (lúc đó backend chưa bật nên mất sóng vài giây không ảnh hưởng gì), và khi có cảnh báo thì dừng
chờ sửa xong mới bật hotspot. Cùng cơ chế thì giữa buổi bay mà rút cáp hay iPhone tắt Điểm truy cập
quá 20 phút, hotspot cũng sẽ tắt (chưa thử với cáp). Kiểm 09:22–09:51 sáng 02/11: hotspot bật lại khi
đã có cáp iPhone, 10 s một mẫu suốt 28 phút (qua mốc 20 phút lúc 09:42:44), mẫu nào cũng On, đủ hai
bo, cả hai trả ping.

**Card Wi-Fi vẫn tự quét khi không nối mạng nào.** Đo 05:09–05:11 (internet qua cáp, card chỉ phát
hotspot), trong 108 giây đo được card quét 2 lần, cách nhau ~60 s. Lần đầu cả hai bo mất 3 s cùng lúc,
lần sau chỉ camera mất. DroneBridge mất 3/108 giây, camera 8/108 giây. Ít hơn hẳn lúc card phải chia
sóng nhưng chưa hết. **Đã chữa 09:29:20**: tắt "auto configuration" của card
(`netsh wlan set autoconfig enabled=no interface=Wi-Fi`, cần admin). 150 giây sau đó: card không quét
lần nào, hai bo mất 0/150 giây; hotspot vẫn chạy, và tắt-bật lại hotspot (`hotspot-on.ps1 -Restart`)
vẫn được, 20 s sau hai bo nối lại. Đổi lại, Windows không tự nối Wi-Fi nào (cả Wi-Fi nhà) tới khi bật
lại, nên `che_do_bay.ps1 -Bat` tắt nó (một hộp UAC) và `-Tat` bật lại; `-GiuQuetWifi` để bỏ qua.

**Các mục tiết kiệm pin của Windows (Energy recommendations), xét cho chạy pin + Quiet mode.** Máy này
ngủ kiểu S3 (`powercfg /a`): tắt màn hình chỉ tắt đèn màn, hotspot và backend vẫn chạy; ngủ thì card
Wi-Fi tắt. Power mode "best energy efficiency" chỉ đè 11 cài đặt CPU/GPU, không đụng card Wi-Fi, và lúc
chạy pin Windows vốn đã dùng nó.

| Mục | Ngoài bãi |
|---|---|
| Power mode tiết kiệm, dark mode, tắt HDR, tắt screen saver, 60 Hz | không ảnh hưởng bay; AI nhận diện chậm hơn |
| Độ sáng tiết kiệm | ban ngày khó đọc cảnh báo |
| Tắt màn sau 3 phút | máy vẫn chạy; chỉ không thấy cảnh báo tới khi chạm touchpad (Quiet đang để sẵn 3 phút) |
| **Ngủ sau 10 phút** | **đừng áp**: ngủ là mất hotspot, DroneBridge, camera, tlog, video. Quiet chạy pin đang để sẵn 10 phút |

Ba bẫy không có trong danh sách đó: Energy Saver tự bật ở 50 % (Quiet) / 40 % (Balance) dù không bật
tay; gập nắp, nút nguồn = ngủ; Legion tự đổi scheme (Balance để card Wi-Fi Medium khi chạy pin).
`che_do_bay.ps1 -Bat` sửa cả bốn và không đụng độ sáng, tắt màn, 60 Hz, CPU. Chạy nó **sau** khi áp các
mục của Windows.

**Camera chậm (0,6–1,4 khung/s).** Firmware ĐÃ tắt tiết kiệm điện Wi-Fi (`WiFi.setSleep(false)`,
`firmware/camera/src/main.cpp`) và chạy XCLK 10 MHz. 13/10 đo trên bàn, ăn điện USB, đạt 7,5 khung/s.
01/11 trên drone: RSSI −29 dBm mà ping mất ~½, p50 ~700 ms, trong khi DroneBridge sạch; đổi laptop
sang iPhone 2,4 GHz hay 5 GHz cũng không đỡ (phiên iot-cv-34 đo). Sáng 02/11, card Wi-Fi chỉ phát
hotspot thì camera lên 4,67 khung/s (nối thêm mạng ngoài: 1,41), nhưng vẫn dưới 7,5 của 13/10 và ping
vẫn mất 20 %. Lúc đó tôi nghi phần còn lại nằm ở chính bo camera trên drone: nguồn UBEC hoặc vị trí
sát ESC, FC, DroneBridge. RSSI −26…−41 dBm chỉ là chiều laptop → bo, còn video đi chiều ngược lại.
**Sai**: sau khi tắt quét nền của card (09:29), bo vẫn nằm trên drone và ăn điện UBEC từ pin, đạt
**9,2 khung/s** (VGA, quality 12, 0 khung nhảy cóc, RSSI −34 dBm), trên cả 7,5 của 13/10. Phần còn lại
cũng là do card quét.

Bài tách lỗi dưới đây chỉ cần nếu lúc bay (motor quay, ESC chạy) camera lại chậm hẳn: tắt tay phát,
rút pin drone; rút dây nguồn UBEC (cả 5V lẫn GND) khỏi bo camera, để bo nguyên chỗ; rút USB FC khỏi
laptop, cắm USB-C bo camera vào; cắm lại pin
drone; tắt backend rồi chạy `uv run python scripts\esp32\camera_check.py`. Nhanh lên thì lỗi do nguồn
UBEC; không thì do vị trí, khi đó gỡ bo đặt lên bàn đo tiếp. **Đừng cắm USB khi bo còn nối UBEC**: hai
nguồn 5 V đấu thẳng vào nhau.

**Nhật ký báo lỗi liên tục.** Đã sửa ba chỗ:
- Web gộp các dòng giống hệt nhau (cách nhau ≤ 90 s) thành một dòng "×N từ HH:MM:SS" và thêm gợi ý
  tiếng Việt cho các thông báo chặn ARM. Áp cho trang Nhật ký, panel sự kiện và chuông thông báo. Xuất
  CSV/JSON vẫn đủ từng dòng.
- 66/75 file tlog từ chiều 01/11 là 0 byte: mỗi lần backend thử nối khi drone chưa bật pin để lại một
  file. Giờ file rỗng tự xoá khi đóng.
- Video tách file mỗi khi mất hình > 2 s, nên buổi 19:12–19:45 ra 223 file AVI. Giờ quãng mất ngắn hơn
  `RECORD_GAP_S` (mặc định mới 30 s) được lấp bằng khung cuối: video phát đúng giờ thật, hình đứng yên
  lúc mất sóng, `frames.csv` vẫn chỉ ghi khung thật.
- Log FC tải về bị báo lỗi vì mất đầu: `scripts/fc/tai_log.py` giờ bỏ qua đoạn hỏng và lưu
  `-thieu.bin`; `scripts/fc/phan_tich_log.py --fmt-tu <log nguyên vẹn cùng firmware>` đọc được.
- Toast lỗi lặp lại (ví dụ `Takeoff blocked` mỗi 2 s) giờ chỉ hiện một toast, cập nhật "×N từ HH:MM:SS"
  và tắt sau khi hết lặp; chuông đếm theo dòng đã gộp (13 lần lặp = 1). Kiểm trên SITL bằng trình duyệt.

**Failsafe tay phát lúc 20:30:53**, 7 s sau khi chuyến 5 đã DISARM: tay phát bị tắt trước khi rút pin.
Vô hại vì đã DISARM. Thứ tự đúng: rút pin drone trước, tắt tay phát sau.

## 5. Đã đổi

Tham số FC, ghi qua USB 02/11 (đọc lại đủ 6/6) và vào `firmware/ardupilot/params/01-base.param`:

| Tham số | Cũ → mới | Để làm gì |
|---|---|---|
| `TKOFF_RPM_MIN` | 0 → 1000 | ARM xong mà có motor < 1000 vòng thì FC giữ vòng chờ, không cho cất cánh, web báo `Takeoff blocked: ESC RPM out of range` |
| `TKOFF_RPM_MAX` | 0 → 4000 | chặn số rác của telemetry (01/11 có mẫu 44162); vòng chờ thật 1850–1960 |
| `MOT_BAT_VOLT_MAX` / `MIN` | 0 / 0 → 16,8 / 13,2 | bù điện áp pin 4S: cùng mức ga cho cùng lực đẩy từ pin đầy tới pin cạn |
| `LOG_FILE_DSRMROT` | 0 → 1 | mỗi chuyến một file log, chip đầy thì chỉ chuyến cũ nhất bị xoá |
| `EK3_LOG_LEVEL` | 0 → 1 | bỏ ~3,7 KB/s log EKF chi tiết (giữ XKF4): 16 MB ≈ 20 phút bay thay vì ~15 |

SITL: ESC ảo của SITL báo 0 vòng (đo A/B: `TKOFF_RPM_MIN` 1000 → không rời đất, 0 → lên 3,66 m),
nên `scripts/sitl/run_param_load.py` có thêm `SITL_BU_RPM` (đặt 0 trên SITL, như phần bù dòng ảo) và
`run_ngoai_troi.py` dùng nó.

File code: `backend/mavlink/connection.py`, `backend/vision/video_recorder.py`, `backend/config.py`,
`.env.example` (RECORD_GAP_S), `backend/tests/test_tlog.py`, `backend/tests/test_video_recorder.py`,
`frontend/src/lib/eventGroups.ts` (mới), `frontend/src/components/EventLog.tsx`,
`frontend/src/pages/LogsPage.tsx`, `frontend/src/components/shell/NotificationCenter.tsx`,
`frontend/tests/unit/eventGroups.test.ts` (mới), `scripts/fc/tai_log.py`, `scripts/fc/log_bin.py`
(mới), `scripts/fc/phan_tich_log.py` (mới), `scripts/laptop/che_do_bay.ps1` (mới),
`scripts/sitl/run_param_load.py`, `scripts/sitl/run_ngoai_troi.py`. Backend đang chạy phải khởi
động lại mới nhận bản sửa tlog và video.

Sáng 02/11 thêm: `backend/mavlink/connection.py` (chào DroneBridge), `backend/config.py` và
`.env.example` (`MAVLINK_UDP_HELLO`, `MAVLINK_UDP_HELLO_PERIOD_S`), `backend/tests/conftest.py`,
`backend/tests/test_udp_hello.py` (mới), `frontend/src/hooks/useWebSocket.ts` (toast),
`frontend/src/hooks/useUnread.ts` (chuông), `frontend/src/lib/eventGroups.ts`,
`frontend/src/pages/LogsPage.tsx`, `frontend/tests/unit/useUnread.test.tsx` (mới),
`frontend/tests/unit/eventGroups.test.ts`, `scripts/esp32/camera_check.py` (mạng hỏng thì in
`FAIL mạng` thay vì traceback), `chay-drone-that.bat` (ba cảnh báo trước khi bật hotspot: chưa ở chế độ
bay, chưa có cáp iPhone, Wi-Fi laptop đang nối mạng khác; có cảnh báo thì dừng chờ sửa; luôn bật lại
hotspot), `scripts/esp32/hotspot.ps1` và `scripts/esp32/hotspot-on.ps1` (`-Restart`). Trên laptop: Apple
Mobile Device Support (ổ D), driver mạng Apple, hồ sơ Wi-Fi "iPhone nghaiz" → nối tay.

Ngoài bãi 02/11 thêm (ghi bù 15/11, hôm đó bạn bảo dừng tài liệu để bay): **nạp mission mới khi drone
đang bay**. `MissionManager.upload()` (`backend/mavlink/mission.py`): drone armed + AUTO thì chuyển GUIDED
đứng giữ chỗ TRƯỚC khi gửi `MISSION_COUNT` (không chuyển được thì báo lỗi, không gửi gói nào), đọc lại
khớp thì `DO_SET_MISSION_CURRENT 1`; người lái bấm AUTO (trang Bay hoặc núm VrB) để bay mission mới từ
điểm 1. Lý do: đang AUTO mà mission đổi thì ArduPilot bay ngay tới item cùng số của mission mới, và
`MIS_RESTART 0` làm lần vào AUTO sau chạy tiếp số cũ. File: `backend/mavlink/mission.py`, `backend/ws.py`
(sự kiện `mission.hold_for_upload`), `backend/tests/test_mission_upload.py`, `backend/tests/fakes.py`,
`frontend/src/lib/missionRules.ts`, `frontend/tests/unit/missionRules.test.ts`,
`scripts/sitl/run_nap_khi_bay.py` (mới), `plans/phase-07-backend-mission-proximity-safety.md`, sổ tay 07
mục 14.

## 6. Nghiệm thu

- `uv run pytest backend/tests`: 342 passed (thêm 3 bài tlog/video ngày 01/11 và 9 bài chào DroneBridge,
  trong đó có bài đối chứng: tắt chào thì bo giả im lặng và hết giờ).
- `pnpm typecheck`, `pnpm lint` (oxlint): đạt; `pnpm test`: 21 file, 264 bài, đạt.
- `ruff check` + `ruff format --check` trên các file Python đã sửa: đạt.
- Drone thật (chạy pin, qua Wi-Fi): backend cũ chờ mãi; backend mới nối FC ngay khi khởi động,
  DroneBridge có lại client `192.168.137.1:14550`. Wi-Fi laptop tự ngắt lúc 04:51:13 mà link không rớt.
- `camera_check.py` trỏ vào địa chỉ không ai trả lời: in `FAIL mạng: ... timed out`, mã 1.
- Ba cảnh báo của `chay-drone-that.bat` thử cả hai nhánh (kêu khi sai, im khi đúng). Khối dừng chờ sửa
  cũng thử cả hai nhánh: có cảnh báo thì tới `pause`, không có thì chạy thẳng.
- `hotspot-on.ps1 -Restart` trên máy thật: hotspot tắt 05:21:14, bật lại 05:21:20–22, hai bo nối lại
  05:21:22–24, backend có lại link FC (`link_alive: true`).
- Theo dõi hotspot sau khi bật lại từ cáp iPhone, 10 s/lần từ 05:21:57 tới 05:33:10 (67 mẫu): hotspot
  On suốt, DroneBridge không mất lần nào, camera mất 1 lần. Dừng ở phút 12 vì bạn cần tắt máy, nên
  **chưa kiểm được** hotspot bám cáp có giữ qua mốc 20 phút không.
- SITL `run_ngoai_troi.py` với bộ tham số mới (nạp lại từ đầu): 8/8 PASS — S1/S1B mission Đi–về,
  S2 Loiter dừng ở 18,1 m, S3 Stabilize vượt trần rồi RTL, S4 Loiter dừng trước rào ở 48,1 m, S5
  AltHold ra rào rồi RTL, S6 mất sóng tay phát → RTL sau ~1 s, S7 pin yếu → RTL.
- Tham số trên FC thật: đọc lại 6/6 khớp. `TKOFF_RPM_MIN` chưa thử trên drone thật (cần cắm pin và
  ARM, việc của người vận hành): lần ARM đầu tiên hãy để ý web có báo `Takeoff blocked` không.
  **Kết quả (đọc log 15/11):** 9 lần ARM sáng 02/11, không lần nào `Takeoff blocked`; cả 4 motor bắt vòng
  trong 0,10–0,90 s.
- Nạp mission khi đang bay, SITL `run_nap_khi_bay.py`: PASS (GUIDED < 0,1 s, lệch 0,42 m, FC về item 1,
  AUTO bay thẳng B1). Drone thật 02/11 (đọc tlog 15/11): chuyến 10:40 **đúng** (GUIDED → nạp → "Flight plan
  received" → item 1 → bạn gạt AUTO 10:42:26 → bay lại từ "1 Takeoff"). Chuyến 10:30 **sai**: backend
  không chuyển GUIDED, FC nhảy tới item 6 của mission đang nạp dở ("Auto mission changed" 8 lần) rồi
  từ chối (`MISSION_ACK` lỗi), drone vẫn bay xong và hạ an toàn. Gốc: HEARTBEAT của bo DroneBridge
  (cùng sysid với FC) làm backend tưởng drone "STABILIZE, disarmed" nửa thời gian. Đã sửa 15/11:
  `plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md` mục 3.1.

## 7. Còn lại

1. **Kiểm cơ khí M1** (sau-phải), tháo cánh: quay tay so với M2–M4 xem có rít hay khựng không, nhìn
   trục và chuông có cong không, kiểm 3 dây pha và mối hàn ở ESC. Lỗi tăng từ 2/28 (25/10) lên 4/5
   (01/11) sau ba lần va chạm 27/10.
2. Bài tách lỗi camera (mục 4, "Camera chậm"): không cần nữa sau khi tắt quét nền (9,2 khung/s trên
   nguồn UBEC). Chỉ làm nếu lúc bay camera lại chậm; xem `logs\recordings\...\frames.csv`.
3. Trước buổi bay tới: áp các mục tiết kiệm pin của Windows trừ "ngủ sau 10 phút", rồi chạy
   `che_do_bay.ps1 -Bat` sau cùng.
4. Nếu `GPS 1: not healthy` còn lặp lâu: thử trên bàn với `LOG_DISARMED 1` trong 10 phút đầu sau khi
   cắm pin để log ghi được `GPA.Delta`, rồi mới tính chuyện đổi `GPS1_GNSS_MODE`.
5. ~~Card Wi-Fi tự quét~~: đã chữa (mục 4), gắn vào `che_do_bay.ps1 -Bat`. Hôm nay tôi đã tắt tay
   lúc 09:29:20 và ghi `logs\laptop\che-do-bay-wifi.json`, nên về nhà chạy `che_do_bay.ps1 -Tat` là
   Wi-Fi nhà tự nối lại như cũ.
6. ~~Hotspot bám cáp qua mốc 20 phút~~: đã kiểm, giữ 28 phút (mục 4). Chưa thử rút cáp giữa buổi.

## 8. Thứ tự cho buổi bay tới

1. Laptop chạy pin, Quiet mode được. Áp các mục tiết kiệm pin trừ "ngủ sau 10 phút", rồi
   `che_do_bay.ps1 -Bat` (bấm Yes ở hộp UAC: tắt quét nền của card Wi-Fi). Không gập nắp.
2. iPhone: bật Điểm truy cập cá nhân, cắm cáp vào laptop, bấm Tin cậy. Không nối Wi-Fi laptop vào
   iPhone. iPhone sẽ sạc từ laptop, nên để ý pin laptop.
3. Bật tay phát → cắm pin drone (pin trước, USB sau) → chờ GPS (đèn Fix nháy) → `chay-drone-that.bat`
   (thiếu bước 1 hay 2 thì nó cảnh báo và dừng chờ sửa; nó tự bật lại hotspot). Cắm cáp iPhone
   **trước** khi chạy file này, và giữ cáp cả buổi.
4. Mũi drone hướng ra chỗ trống (TFmini). Cần ga ở đáy, SwD tắt, rồi gạt SwB.
5. ARM xong **chờ 5 giây, nghe đủ 4 motor quay đều** rồi mới kéo ga. Web báo `Takeoff blocked` thì
   tắt ARM, chờ, ARM lại.
6. Sau mỗi lần rơi hay mất lái: **dừng, tải log** (`uv run --with pyserial python scripts/fc/tai_log.py
   COM6`) trước khi bay tiếp. Hết buổi thì tải hết.
7. Rút pin drone trước, tắt tay phát sau. Về nhà chạy `che_do_bay.ps1 -Tat`.
