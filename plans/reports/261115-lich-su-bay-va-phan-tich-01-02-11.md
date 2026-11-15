# Lịch sử bay trên web + phân tích mọi chuyến 01/11 và 02/11 (15/11/2026)

Đọc lại toàn bộ log FC (dataflash), tlog của backend và video ghi trên laptop từ 24/10 tới 02/11, kiểm
FC qua USB (pin 15,30 V = 4S, 889 tham số, 0 lệch so với `01-base.param` và `02-avoid-tfmini.param`),
làm trang **Lịch sử bay** trên web, và xử lý các việc còn nợ từ buổi bay 02/11.

## 1. Kết luận

1. **Lỗi nặng nhất nằm ở backend, đã sửa.** Bo DroneBridge phát HEARTBEAT cùng sysid với FC, nên backend
   thấy drone "STABILIZE, disarmed" nửa thời gian (1674 lần lật trong 15 phút tlog). Hậu quả thật: chuyến
   10:30 ngày 02/11 nạp mission lúc đang AUTO mà **không** chuyển GUIDED giữ chỗ, FC nhảy tới item 6 của
   mission đang nạp dở. Drone vẫn bay xong và hạ an toàn. Mục 3.1.
2. **Camera tụt theo khoảng cách, đó là tầm Wi-Fi.** Cách home ≤ 15 m: 7,6–7,8 khung/s; 15–25 m: 3,1;
   xa hơn 25 m: 1,8. Mất hình chỉ-camera 102 s, cùng lúc với mất MAVLink 40 s. Quét nền của card Wi-Fi đã
   tắt từ 09:29 nên không phải nó. Mục 5.
3. FC báo `Internal Errors 0x4000 spi_fail` một lần lúc đang bay (10:41:42, cao 13 m). Không thấy hậu quả
   gì (vòng lặp, IMU, log đều bình thường); chỉ chặn ARM lại tới khi khởi động lại FC, và FC đã khởi động
   lại. Mục 6.1.
4. Chuỗi "Radio Failsafe", "EKF variance", "GPS Bad fix" lúc 10:44 xảy ra **sau khi đã hạ và disarm**. Mục
   6.2.
5. `GPS 1: not healthy` lúc đứng đất lặp lại ở cả hai buổi, chưa rõ gốc. Chưa đổi tham số GPS nào. Mục 6.3.
6. `TKOFF_RPM_MIN 1000` không chặn lần nào trong 9 lần ARM; 4 motor bắt vòng trong 0,10–0,90 s. Motor
   khựng lúc khởi động giờ rải ra cả M2, M3, M4, không còn riêng M1. Mục 7.
7. Đồng hồ laptop chậm 50 s (01/11) và 54 s (02/11) so với GPS; trang Lịch sử bay tự chỉnh. Hôm nay chỉ
   lệch 0,31 s (đồng bộ lần cuối 14/11 18:11).
8. **Rào nới lên 100 m theo lựa chọn của bạn, trần giữ 20 m.** Đã ghi lên FC qua USB và đọc lại khớp;
   SITL 8/8 bài PASS với rào mới. Mục 11.1.
9. **Camera tự hạ chất lượng JPEG khi tụt khung, tự nâng lại khi về gần.** Chạy thật với camera: đúng cả
   hai chiều, gần laptop không hạ oan lần nào. Giới hạn: khung chỉ nhỏ đi tối đa ~37 %, nên ở xa khung/s
   tăng khoảng 1,6 lần chứ không về lại 8. Mục 11.2.

## 2. Trang Lịch sử bay

Mở web như mọi khi, chọn **Lịch sử bay** (nhóm Giám sát, phím tắt Alt+L), hoặc `localhost:5173/flights`.

- Bên trái: các chuyến xếp theo ngày, có cờ cảnh báo. Mặc định mở chuyến mới nhất có cất cánh.
- Bản đồ: cả đường bay (xám), đoạn đã bay tới lúc đang xem, home, drone xoay theo hướng mũi.
- Camera: đúng khung hình ghi lúc đó; mất hình quá 1,5 s thì hiện "MẤT HÌNH".
- Thanh phát: về lúc ARM, Phát/Dừng, tốc độ 1×/2×/4×/8×, kéo tua; dải màu chế độ bay (bấm để nhảy),
  vạch sự kiện (vàng: cảnh báo, đỏ: lỗi).
- 9 biểu đồ, bấm vào là tua: độ cao + cách home, tốc độ, điện áp, dòng, RSSI DroneBridge, % mất gói
  MAVLink, khung/s camera, số vệ tinh, rung.
- Tóm tắt (thời gian, cao/xa nhất, pin, mAh, mất link, camera, độ lệch đồng hồ đã chỉnh) và danh sách sự
  kiện (bấm để tua).

Nguồn: `logs/fc-dataflash-*/*.bin`, `logs/tlog/*.tlog`, `logs/recordings/*/`. Ba nguồn được đưa về giờ GPS:
tlog có `SYSTEM_TIME` thì lấy độ lệch từ đó, không thì khớp lúc ARM giữa tlog và log FC; video theo tlog
cùng lúc. Lần đầu đọc hết log mất vài chục giây, sau đó dùng đệm ở `logs/.cache/flights/`
(`FLIGHT_LOGS_DIR`, `FLIGHT_CACHE_DIR` trong `.env`). Dựng sẵn đệm và in bảng:
`uv run python -m backend.flights --events`.

Bỏ qua có lý do (hiện ở cuối danh sách): 11 log FC trong nhà 25/10 và 27/10 không có giờ GPS, và tlog
SITL `20261102-095846` (không có gói DroneBridge, có "IMU1/Barometer 2" — bo thật chỉ có một IMU, một
baro). Chuyến tối 01/11 chỉ có log FC: laptop ngủ 19:45–20:33 nên không có tlog lẫn video.

Giới hạn: sự kiện chỉ lấy trong lúc ARM ± 10 s, nên "GPS not healthy" giữa hai chuyến không hiện trên trang
(xem bằng `--events` hoặc mục 6.3).

Code: `backend/flights/` (mới: `binlog.py`, `sources.py`, `video.py`, `index.py`, `__main__.py`), 3 route
trong `backend/api.py` (`GET /api/flights`, `GET /api/flight?id=`, `GET /api/flights/frame`), model trong
`backend/schemas.py` → `ws-contract.schema.json` → `frontend/src/lib/protocol.generated.ts`; web:
`frontend/src/pages/FlightsPage.tsx`, `frontend/src/components/flights/*`, `frontend/src/lib/flights.ts`.
`scripts/fc/log_bin.py` giờ chỉ chuyển tiếp sang `backend/flights/binlog.py`.

## 3. Lỗi sửa trong lúc phân tích

### 3.1 Backend đọc nhầm HEARTBEAT của DroneBridge

Tlog 02/11: bo DroneBridge gửi HEARTBEAT từ (1, 68) mỗi giây: `type 18` (ONBOARD_CONTROLLER), `autopilot 8`
(INVALID), `custom_mode 0`, `base_mode 1`. `TelemetryReader` chỉ lọc theo sysid, còn `update_state` chỉ
bỏ HEARTBEAT kiểu GCS. Mỗi gói đó đặt `mode = STABILIZE`, `armed = False`, và giữ `last_update` (link coi
như còn sống dù FC im).

Bằng chứng trên drone thật:

| Chuyến 02/11 | Lúc nạp | FC trả | Kết quả |
|---|---|---|---|
| 10:30:39 | 10:31:48, đang AUTO | không có lệnh đổi mode; 8 × "Auto mission changed, restarted command"; `MISSION_ACK` lỗi (1) | FC bay tiếp từ item 6 của mission đang nạp dở, rồi "Mission: 10 RTL" (mission cũ chỉ 9 item) |
| 10:40:39 | 10:41:56, đang AUTO | `COMMAND_ACK 176` (GUIDED) → "Flight plan received" → `DO_SET_MISSION_CURRENT 1` | đúng: bạn gạt AUTO 10:42:26, bay lại từ "1 Takeoff" |

Chuyến 10:40 đúng chỉ vì lúc gọi nạp, gói HEARTBEAT mới nhất tình cờ là của FC.

Sửa: `update_state` (`backend/mavlink/telemetry.py`) bỏ mọi HEARTBEAT có `autopilot == MAV_AUTOPILOT_INVALID`,
cùng luật `_wait_vehicle_heartbeat` đã dùng khi chốt FC. Chạy lại cả tlog 10:27–10:42 qua `update_state`:
`(mode, armed)` đổi 1674 lần theo luật cũ, 14 lần theo luật mới (đúng các lần FC đổi thật). Test mới
`test_heartbeat_cua_dronebridge_khong_doi_mode_armed_va_khong_giu_link`: đỏ khi bỏ luật mới, xanh khi có.
Backend đang chạy phải khởi động lại mới nhận bản sửa (`chay-drone-that.bat` luôn bật backend mới).

### 3.2 `phan_tich_log.py` báo sai giờ ARM

Log mất bản ghi ARM (rơi trong đợt ghi dồn lúc mở file log) thì script lấy giờ ARM từ lần FC đặt home. FC
còn ghi lại ORGN giữa chuyến (cùng MODE và dòng "GPS 1: probing..."), vd. lúc nạp mission khi bay; script
lấy lần **cuối** nên log 008/009 thành "arm 90 s, KHÔNG cất cánh" và số khởi động ESC sai. Sửa lấy lần
đầu; `logs/fc-dataflash-20261102-bay-ngoai-troi/phan-tich-008.md`, `-009.md` đã dựng lại (162 s / 149 s
bay, 213 s / 199 s bay).

### 3.3 `LogBin.doc()` chặn stdout của cả tiến trình

Bọc cả vòng lặp generator trong `redirect_stdout`: lúc dừng ở `yield`, mọi `print` của người gọi (và của
thread khác trong backend) mất trắng. Giờ chỉ chặn quanh `recv_match`.

## 4. Các chuyến

Giờ GPS (VN). "Cao" so với home; "Xa" từ trang Lịch sử bay. Chuyến 10:14: mission chỉ trong 8 m quanh home;
48,7 m là lúc bạn lái Loiter ra rào (10:15:46), FC dừng cách rào 50 m đúng `FENCE_MARGIN` 2 m.

| Chuyến | ARM (s) | Cất cánh | Cao (m) | Xa (m) | Pin (V) | mAh | Mất gói | Camera | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|
| 24/10 18:24 | 82 | không | – | – | 24,03→23,34 | 240 | – | – | pin 6S, "Check mag field" |
| 01/11 19:41 | 1 | không | – | – | 16,12 | – | 39 % | 2,8/s | `GPS 1: not healthy` |
| 01/11 20:12 | 255 | có | 15,3 | 35,3 | 15,44→15,05 | 562 | – | – | chỉ log FC |
| 01/11 20:18 | 192 | có | 15,4 | 34,9 | 15,29→14,93 | 506 | – | – | |
| 01/11 20:24 | 95 | có | 8,2 | 3,9 | 15,18→14,90 | 239 | – | – | sau khi hạ, TFmini thấy vật cách 0,58 m (PreArm) |
| 01/11 20:26 | 104 | có | 15,1 | 5,1 | 15,14→14,84 | 251 | – | – | |
| 01/11 20:28 | 132 | có | 18,1 | 29,3 | 15,08→14,76 | 345 | – | – | M1 không bắt vòng trong 3 s; tắt tay phát sau khi hạ |
| 02/11 10:10 | 125 | có | 18,2 | 42,0 | 16,61→16,24 | 285 | 3,5 % | 7,0/s, 89 % | |
| 02/11 10:13 | 29 | không | – | – | 16,41 | 2 | 0 % | 9,6/s | tắt bằng SwB |
| 02/11 10:14 | 153 | có | 18,3 | 49,6 | 16,38→15,96 | 380 | 1,8 % | 6,5/s, 81 % | lái Loiter ra rào: FC dừng ở 48,7 m, đúng thiết kế |
| 02/11 10:23:12 | 4 | không | – | – | 16,14 | 0 | 0 % | 10/s | |
| 02/11 10:23:19 | 138 | có | 15,6 | 28,9 | 16,12→15,76 | 339 | 4,2 % | 4,6/s, 63 % | mất link 32 s (backend nối lại) |
| 02/11 10:26:16 | 17 | không | – | – | 15,95 | 0 | 0 % | 8,4/s | trước đó "Auto mode not armable" (ARM lúc đang AUTO) |
| 02/11 10:26:36 | 159 | có | 16,6 | 28,7 | 15,94→15,54 | 407 | 4,7 % | 4,7/s, 64 % | |
| 02/11 10:30 | 162 | có | 15,2 | 27,2 | 15,76→15,35 | 428 | 12,1 % | 4,7/s, 77 % | nạp mission khi bay, sai (mục 3.1) |
| 02/11 10:40 | 214 | có | 18,1 | 27,8 | 15,56→15,14 | 596 | 2,9 % | 5,5/s, 75 % | nạp đúng; `spi_fail`; failsafe sau khi hạ |

11 chuyến cất cánh: 01/11 tổng 13 phút ARM, 02/11 tổng 16 phút. Pin 4S cuối chuyến không dưới 14,76 V
(ngưỡng FC 14,0 / 13,2 V). Rung, bám góc, cân bằng motor, nhiệt ESC (≤ 54 °C) trong
`logs/fc-dataflash-*/phan-tich-*.md` đều trong ngưỡng.

## 5. Camera

Chỉ 02/11 có video lúc bay (01/11 laptop ngủ). Khung VGA, JPEG chất lượng 12, trung bình 24–26 KB/khung
(p95 29–45 KB): 8 khung/s cần khoảng 1,6 Mbit/s.

| Cách home | Khung/s trung bình (mọi lần ARM 02/11) |
|---|---|
| 0–5 m | 7,8 |
| 5–15 m | 7,6 |
| 15–25 m | 3,1 |
| > 25 m | 1,8 |

- Trên đất (cao < 1 m): 8,2 khung/s; trên không: 5,1. Bàn thử 02/11 sáng: 9,2.
- Mất hình (khung/s = 0) cộng cả 6 chuyến: 102 s chỉ camera, 40 s cùng lúc với mất MAVLink. Ba lần mất dài
  9–15 s trùng đúng lúc mất link (10:15:41, 10:24:28, 10:28:16): cả hai bo cùng rớt khỏi hotspot.
- RSSI DroneBridge (bo trên drone nhận hotspot laptop) trung bình −75 tới −80 dBm, thấp nhất −90 tới
  −93 dBm lúc ở xa.

Kết luận: xa quá ~15 m thì đường Wi-Fi giữa drone và card Wi-Fi trong laptop không còn đủ băng thông cho
1,6 Mbit/s; MAVLink (vài kbit/s) sống lâu hơn nên mất hình xảy ra trước, nhiều hơn mất link. Không phải
UBEC hay quét nền (đã tắt 09:29 trước buổi bay). Hướng chữa: giảm băng thông camera cần (JPEG nhỏ hơn
hoặc khung nhỏ hơn — `GET /set?quality=N` đổi được lúc đang chạy), hoặc tăng tầm (anten/vị trí bo trên
khung, điểm phát Wi-Fi tốt hơn card trong laptop). Bạn chọn để backend tự hạ chất lượng JPEG: mục 11.2.

Thấy thêm khi xem khung hình: vùng sáng mạnh có mảng hồng, nghi do OV3660 xử lý vùng cháy sáng. Chỉ ghi lại.

## 6. FC

### 6.1 `Internal Errors 0x4000 spi_fail` (10:41:42, 02/11)

Một lần duy nhất trong cả buổi (`PM.ErC = 1`, dòng 214), lúc đang AUTO ở 13 m. Quanh lúc đó: vòng lặp
chính tối đa 2,8 ms (bình thường), không có vòng chậm, IMU không hở, log không rơi thêm gói (các gói rơi
đều ở giây đầu mỗi file log, bình thường). Log không cho biết bus SPI nào (IMU, chip log hay OSD). Hậu quả
duy nhất: FC chặn ARM lại (`PreArm: Internal errors 0x4000 l:214 spi_fail`) tới khi khởi động lại. FC hôm
nay đã khởi động lại, không còn báo. Lặp lại thì tải log ngay và ghi lại lúc đó đang làm gì.

### 6.2 Failsafe lúc 10:44, sau khi đã hạ

10:44:13 FC tự disarm sau khi RTL hạ xong. 10:44:15 bạn gạt SwB về tắt, 10:44:16 kéo ga về đáy, 10:44:20
ga nhảy về 911 (giá trị failsafe của receiver) = tay phát tắt → "Radio Failsafe - Disarming" khi đã
disarm. Pin vẫn 15,3 V suốt, tức chưa rút pin. Tối 01/11 cũng y như vậy (20:30:53, 7 s sau khi hạ). Vô
hại, nhưng thứ tự đúng vẫn là rút pin drone trước, tắt tay phát sau.

Cùng lúc đó GPS im từ 10:44:13 tới 10:44:26 (quá 4 s thì FC coi là mất GPS → "Bad fix", "EKF variance",
failsafe EKF), rồi tự dò lại được ngay với 32 vệ tinh. Chuyến 10:30 và 10:40 (hai chuyến có nạp mission
khi bay) có thêm điều lạ: 7–11 s ngay sau khi disarm, vòng lặp chính của FC chậm tới 246 ms, 15–27 lần;
các chuyến khác không có. Lúc bay không lần nào như vậy (tối đa 2,9 ms). Chưa rõ FC làm gì lúc đó; chỉ
xảy ra khi đã đứng đất, đã disarm.

Dòng "GPS 1: probing for u-blox" giữa chuyến (10:26:09, 10:30:39, 10:31:51, 10:41:57) **không** phải GPS
mất: FC ghi lại một loạt (ORGN, MODE, thông tin GPS) cùng một thời điểm, và gói GPS không hở lúc đó.

### 6.3 `GPS 1: not healthy` lúc đứng đất

| Buổi | Cờ GPS khoẻ tắt | Chặn ARM |
|---|---|---|
| 01/11 | 19:21, 19:23, 19:30, 19:32, 19:37, 19:41–19:45 (mỗi lần 1–5 s) | 19:37:30, 19:41:34, 19:41:41, 19:43:12 |
| 02/11 | 10:34:22, 10:37:25, 10:38:58–10:39:59 | 10:39:02 tới 10:39:58 (4 lần), ARM được 10:40:39 |

Lúc đó vẫn fix 4, 28–32 vệ tinh. ArduPilot coi GPS không khoẻ khi gói tới trễ (trung bình > 215 ms hoặc
trễ 2 gói liền), không phải vì tín hiệu yếu. Lúc bay thì gói đều: 02/11 khoảng cách gói tối đa 200–214
ms (riêng 008 một lần 291 ms), 01/11 có 1–3 lần/chuyến lỡ một gói (400 ms). GPS là u-blox M10
(`ROM SPG 5.10`), `GPS1_GNSS_MODE 0` (giữ mặc định của module), `GPS1_RATE_MS 200`.

Đã thử và loại: nạp mission không giải thích được (02/11 lần nạp 10:38:56 trùng, nhưng 10:34 và 10:37
không nạp gì; 01/11 các lần tắt cờ đều sau lần nạp cuối 19:14). Nghi nhiều nhất: M10 chạy 5 Hz với mặc
định nhiều chòm vệ tinh, khi bắt ~30 vệ tinh thì có lúc ra gói trễ. Cần số đo `GPA.Delta` lúc đứng đất mới
kết luận được, mà log FC hiện chỉ ghi khi ARM. Trên bàn trong nhà không thử được (0 vệ tinh).

## 7. ESC và `TKOFF_RPM_MIN`

Từ lúc FC cho motor quay tới khi bắt ≥ 300 vòng (`phan-tich-*.md`, mục "ESC khởi động"):

- 02/11, 9 lần ARM: mọi motor bắt vòng trong 0,10–0,90 s; không lần nào `Takeoff blocked`.
- Khựng (đã quay ≥ 1000 vòng rồi tụt về 0) trong 3 s đầu: M2 (3 lần ARM), M3 (3), M1 (1), M4 (1).
- 01/11: M1 có vấn đề 4/5 chuyến (3 lần khựng, 1 lần không bắt vòng trong 3 s), M4 khựng 1 lần.

Lỗi riêng M1 giảm, nhưng khựng lúc khởi động có ở cả bốn motor với tần suất thấp: giống cách ESC khởi động
ở vòng thấp hơn là hỏng cơ khí một motor. `TKOFF_RPM_MIN` đang làm đúng việc: motor khựng lúc ga đáy thì
FC chờ, không cho cất cánh. Việc kiểm cơ khí M1 (báo cáo 261102 mục 7.1) vẫn nên làm khi tháo cánh.

## 8. Việc nợ từ buổi 02/11

| Việc | Trạng thái |
|---|---|
| Ghi phần nạp mission khi bay vào báo cáo 261102 mục 5–6 | xong |
| Dòng bẫy trong `AGENTS.md` (nạp khi bay, HEARTBEAT DroneBridge, nơi xem lịch sử bay) | xong |
| Chạy đủ pytest (02/11 bị `WinError 10013` cắt ngang) | xong: 370/370 |
| Kiểm `TKOFF_RPM_MIN` bằng log thật | xong, mục 7 |
| GPS not healthy | phân tích xong, gốc chưa rõ, mục 6.3 |
| Kiểm cơ khí M1 | việc tay, còn mở |

## 9. Nghiệm thu

- `uv run pytest backend/tests` (chạy qua `cmd` riêng): **370 passed**. Trong đó 15 bài mới của
  `test_flights.py` (bài ghép chuyến đỏ khi bỏ luật "không gộp hai log FC", ra một chuyến 144,6 s) và bài
  HEARTBEAT DroneBridge (đỏ khi bỏ luật mới).
- `pnpm test`: 22 file, **278 passed**. `pnpm typecheck` sạch; `pnpm lint`: không cảnh báo nào ở file mới
  (các cảnh báo còn lại có từ trước, ở `components/twin/`).
- `ruff check` + `ruff format --check` trên file Python đã sửa: sạch.
- Trang thật (Playwright, Chrome): chuyến 02/11 10:40 mở ra đứng đúng lúc ARM; Phát 1× chạy 3 s trong 3 s,
  8× chạy 15 s trong 2 s, khung camera đổi theo, bản đồ có đường đã bay và drone; console không lỗi.
- Sau phần việc mục 11: `uv run pytest backend/tests` **393 passed** (thêm 23 bài của
  `test_auto_quality.py`); `ruff check` + `ruff format --check` trên mọi file Python đã sửa: sạch. Không
  sửa file nào của web nên không chạy lại `pnpm test`.

## 10. Còn mở

- GPS not healthy: bạn chọn để nguyên, không đổi tham số GPS nào (mục 6.3).
- Kiểm cơ khí M1 khi tháo cánh.
- Camera tự chỉnh mới chạy thật trên bàn, chưa bay. Chuyến tới: xem `frames.csv` cột `jpeg_quality` và
  các dòng `Camera hạ/nâng chất lượng JPEG` trong bảng sự kiện (mục 11.2).
- Ngoài ~50 m Wi-Fi có thể mất hẳn (MAVLink đo được tới ~49 m): bay xa thì lái bằng tay cầm, web chỉ để xem.

## 11. Việc làm theo lựa chọn của bạn (15/11/2026)

### 11.1 Rào 100 m, trần 20 m

| File / nơi | Đổi |
|---|---|
| `firmware/ardupilot/params/02-avoid-tfmini.param` | `FENCE_RADIUS 50 → 100`, chú thích ghi lý do và số đo tầm Wi-Fi |
| FC thật (USB, COM6, pin 15,23 V) | `scripts/fc/nap_param.py` nạp cả file: 22/22 dòng nhận, khởi động lại 1 lần, đọc lại khớp, `KET QUA: PASS` |
| `chay-drone-that.bat` | `MAX_DISTANCE_HOME 45 → 95` (mission web luôn cách rào 5 m); `MAX_ALT 18` giữ nguyên |
| `scripts/sitl/run_ngoai_troi.py` | trần và rào đọc từ chính file param nạp lên SITL, không còn số 50 viết cứng |
| `docs/phan-cung-thuc-te.md` | ghi mốc 15/11 |

SITL `run_ngoai_troi.py` với bộ tham số mới (8/8 PASS, `KET QUA: PASS`):

| Bài | Kết quả |
|---|---|
| S1 / S1B mission đi–về 5 m | xa nhất 5,1 / 4,3 m, RTL không leo, hạ đúng home |
| S2 Loiter ga hết cỡ | dừng ở 18,1 m (trần 20, lề 2) |
| S3 Stabilize vượt trần | chạm trần lúc leo 7 m/s → RTL, cao nhất 23,2 m, hạ cách home 0,1 m |
| S4 Loiter tiến hết cỡ | tự dừng ở **98,1 m**, trước rào |
| S5 AltHold bay ra rào | chạm rào ở 99,6 m lúc 4,1 m/s → RTL, xa nhất **103,4 m** (vọt 3,4 m), hạ đúng home |
| S6 mất sóng tay cầm | RTL sau ~1 s, hạ đúng home |
| S7 pin yếu | `Battery Failsafe` → RTL, hạ đúng home |

Ngoài rào 100 m là chuyện của tay cầm, không phải của Wi-Fi: 02/11 MAVLink còn sống tới ~49 m (mất 2–12 %
gói, RSSI −90 dBm), camera VGA chỉ ổn trong ~15 m. `FS_GCS_ENABLE 0` nên mất Wi-Fi không làm drone RTL;
drone vẫn nghe tay cầm và vẫn bị rào giữ.

### 11.2 Camera tự hạ chất lượng JPEG

`backend/vision/auto_quality.py` (mới), nối vào `backend/app.py`, cấu hình trong `backend/config.py` và
`.env.example`:

- Đếm khung thật nhận được trong 5 s gần nhất. Dưới **4 khung/s** thì gọi `GET /set?quality=N` của camera,
  tăng số chất lượng thêm 7 (khung nhỏ hơn), tối đa **40**. Trên **6,5 khung/s** liền 10 s thì giảm lại,
  tối thiểu **12** (mức camera tự đặt lúc khởi động).
- Sau mỗi lần đổi chờ đủ 5 s để đo trên khung của mức mới. Vừa nâng nét đã phải hạ lại (đứng ở ranh giới
  tầm sóng) thì lần nâng sau chờ gấp đôi, tối đa 120 s: không lật qua lật lại.
- Mất hình hẳn (không khung nào trong 5 s) thì không đổi gì, vì đó là mất link chứ không phải thiếu băng
  thông. Gọi camera hỏng thì giữ mức cũ, thử lại sau 5 s, không làm mất hình.
- Mức hiện tại đọc từ nhãn `X-Jpeg-Quality` của khung mới nhất, nên backend khởi động lại giữa buổi vẫn
  biết camera đang ở mức nào.
- Mỗi lần đổi có một dòng trong bảng sự kiện của web (`camera.quality`, mức info, không bật thông báo),
  và `frames.csv` của video ghi trên laptop có thêm cột `jpeg_quality`.
- Tắt: `CAMERA_AUTO_QUALITY=0`. Không chạy với nguồn video giả.

Số đo trên camera thật hôm nay (VGA, drone trên bàn, cảnh trong nhà):

| Chất lượng | 12 | 19 | 26 | 30 | 33 | 40 | 50 | 63 |
|---|---|---|---|---|---|---|---|---|
| KB/khung | 15,2 | 12,4 | 11,0 | 10,3 | 10,1 | 9,5 | 8,9 | 10,0 |

Mức 63 cho khung **to hơn** mức 50, nên trần để 40. Từ 12 lên 40 khung nhỏ đi ~37 %, tức là cùng một băng
thông chở được ~1,6 lần số khung: ở 15–25 m từ ~3,1 lên ~5 khung/s, quá 25 m từ ~1,8 lên ~2,9. Muốn hơn
thế phải giảm cỡ khung (QVGA nhỏ hơn VGA ~4 lần) hoặc tăng tầm sóng; bạn đã chọn giữ VGA.

Nghiệm thu:

- 23 bài trong `backend/tests/test_auto_quality.py`, có một bài mô phỏng bay ra xa rồi về dùng đúng các
  cỡ khung đo ở trên: ở xa đứng yên ở mức 40, khung/s ≥ 2,5 (từ 1,8), về gần nét lại mức 12, tổng 8 lần
  đổi.
- Chạy thật với camera, ép ngưỡng cho nó phải hạ rồi nâng: 12 → 19 → 26 → 33 → 40 rồi 40 → 33 → 26 →
  19 → 12, 8 sự kiện, camera đọc lại `quality 12`.
- Chạy thật với cấu hình mặc định 40 s cạnh laptop: 0 lần đổi, 7,6–8,1 khung/s, giữ 12.
- Cửa sổ đo là 5 s chứ không phải 3 s vì luồng thật hôm nay có lúc đứng 1 s (4, 5, 0, 9, 8 khung trong 5
  giây). Cửa sổ 3 s đọc ra 3 khung/s và hạ nét oan; đã thử cho bài kiểm đó đỏ với 3 s.
