# Kiểm toàn bộ phần cứng trên bàn, 15/11/2026

> Phiên kiểm do Claude chạy, khoảng 02:50–03:25. Drone **không cánh**, pin 4S và USB cắm suốt.
> Người dùng làm phần tay: bấm Motor Test trong Mission Planner, gạt tay cầm, chắn TFmini, quay tay
> motor và xem khung. Không đổi tham số nào trên FC. Số liệu lấy từ MAVLink (USB), không ước lượng.

## 1. Kết luận

Không tìm thấy hỏng hóc nào. Mọi phần kiểm được trên bàn đều đạt:

| Phần | Kết quả | Số đo chính |
|---|---|---|
| FC SpeedyBee F405 V5 | Đạt | Đúng firmware `V4.7.1 (dbe79216)`, `speedybeef4v5`; lỗi nội bộ 0 (`spi_fail` ngày 02/11 không lặp lại); tải CPU ≤ 40 %; RAM trống 49–54 KB |
| IMU | Đạt | \|a\| 998 mG; con quay ồn 0,6–4,9 mrad/s, lệch ≤ 0,4 mrad/s; rung lúc đứng 0,01–0,07 m/s², clip 0 |
| Baro | Đạt | 1010,2 hPa, ồn 0,2–0,3 Pa |
| La bàn IST8310 | Đạt | 385–388 mG, dao động 0,5 mG (trong nhà; WMM ngoài trời ~456 mG) |
| Tham số | Còn nguyên | 889 tham số; so với bản chụp 01/11 chỉ khác các lần hiệu chỉnh và chỉnh sửa đã ghi (la bàn ngoài trời, level, radio, `TKOFF_RPM_*`, rào 100 m); `INS_ACC_ID`, `COMPASS_DEV_ID` có đủ |
| 4 ESC + 4 motor | Đạt | 41 lần khởi động không cánh, 0 lần khựng; bắt vòng 0,05–0,16 s; vòng quay lệch nhau ≤ 2,8 % (mục 2) |
| Receiver + tay cầm | Đạt | 4 cần đủ 1000–2000 µs; SwA/SwB/SwC/SwD, VrB đúng chức năng; failsafe tắt tay phát đạt (mục 3) |
| TFmini Plus | Đạt | Bám vật từ 10 tới 260 cm, giữ ở ~1,1 m dao động ±2 cm (mục 4) |
| Pin 4S | Đạt | 15,20 → 15,18 V = 3,80 V/cell (mức cất giữ); người dùng xác nhận không phồng, vỏ và giắc tốt |
| ESP32 DroneBridge | Đạt | MAVLink 2 chiều: laptop hỏi `AUTOPILOT_VERSION`, FC trả sau 0,21 s |
| Camera ESP32-S3 | Đạt | `camera_check.py --frames 150` PASS: 150/150 khung sạch, VGA 7,6 khung/s, RSSI −28 dBm, PSRAM trống 8,2 MB |
| Cơ khí | Đạt (người dùng kiểm) | 4 motor quay tay êm như nhau, không rơ, không đảo, ốc chặt; khung, càng, dây pha, mối hàn, cánh, tụ 1500 µF lành; phụ kiện gắn chắc |

**Việc "kiểm cơ khí M1" còn mở từ 01/11 đã xong:** M1 (sau-phải) quay tay như ba motor kia, không cánh
thì khởi động 10/10 lần không khựng, vòng quay và rung ngang ba motor kia.

## 2. Motor Test không cánh

Mission Planner gửi lệnh Motor Test (người dùng bấm), script `scripts/fc/kiem_phan_cung.py --ghi` ghi
ESC telemetry, đầu ra servo, rung và pin ở ~19 mẫu/s. Hai việc dùng chung một cổng USB nhờ MAVProxy
(mục 6).

- Vòng 1: "Test all motors" 7 lần ở ga 13 % (≈ `MOT_SPIN_ARM 0,13`, pwm 1130), 3 s mỗi lần — giống lúc ARM.
- Vòng 2: từng motor ở ga 30 % (pwm 1300), 5 s, hai lượt A → D, thêm một lần "Test all" ở 30 %.

| ESC | Vị trí | Lần khởi động | Bắt vòng ≥ 300 rpm | Khựng | rpm ở 13 % | rpm ở 30 % | Rung riêng ở 30 % (x/y/z, m/s²) | Nhiệt ESC |
|---|---|---|---|---|---|---|---|---|
| M1 | sau-phải | 10 | 0,05–0,16 s | 0 | 2098–2100 | 4514 | 0,03–0,08 / 0,09–0,10 / 0,06 | 36–39 °C |
| M2 | trước-phải | 11 | 0,05–0,16 s | 0 | 2100 | 4509–4514 | 0,05–0,10 / 0,14–0,15 / 0,11 | 43–45 °C |
| M3 | sau-trái | 10 | 0,09–0,16 s | 0 | 2042 | 4462–4471 | 0,04 / 0,09–0,10 / 0,06–0,07 | 31–33 °C |
| M4 | trước-trái | 10 | 0,05–0,16 s | 0 | 2071 | 4506–4509 | 0,02–0,05 / 0,09–0,10 / 0,02–0,03 | 39–41 °C |

- "Bắt vòng" chính xác tới ~0,1 s vì mỗi ESC chỉ báo 9 lần/giây. So với 25/10 (ga 10 %, 0,25–0,26 s)
  thì nhanh hơn, nhưng mức ga khác nên chỉ so tương đối.
- Rung riêng từng motor rất nhỏ (ArduPilot coi dưới 15 m/s² là tốt). Cả bốn cùng quay ở 30 %:
  0,12 / 0,20 / 0,12. M2 nhỉnh hơn ở trục y một chút, vẫn trong mức nhiễu.
- **ESC M2 nóng hơn nhưng không do tải:** lúc motor đứng yên 2 phút trước khi thử, bốn ESC đã đọc
  36 / 42 / 30 / 38 °C, và chênh lệch giữ nguyên lúc quay. Đây là cảm biến hoặc vị trí trên bo 4in1,
  không phải kênh M2 làm việc nặng hơn. Lúc bay 02/11 ESC ≤ 54 °C.
- Chiều quay: người dùng nhìn, cả bốn đúng (A/C ngược kim đồng hồ, B/D thuận), không rít, không lắc.

**Giới hạn của bài này:** không cánh thì motor gần như không cần mô-men khởi động, nên bài này **không
tái hiện được** kiểu khựng lúc ARM khi có cánh (02/11: M2 3 lần, M3 3, M1 1, M4 1 trong 9 lần ARM).
Bài này loại được lỗi điện (dây pha, mối hàn, kênh ESC chết) và lỗi cơ (ổ bi, trục) — các lỗi đó lộ ra
cả khi không tải. Khựng có tải vẫn là chuyện ESC khởi động ở vòng thấp; `TKOFF_RPM_MIN 1000` vẫn là lưới
an toàn và chưa phải chặn lần nào.

## 3. Tay cầm FS-i6X + receiver iA6B

`scripts/fc/doc_tay_cam.py` qua MAVProxy, cộng tlog của MAVProxy để thấy cả thông báo trùng:

| Kênh | Điều khiển | Kết quả |
|---|---|---|
| CH1–CH4 | 2 cần | Đủ 1000–2000 µs, về giữa 1498–1501; ga đáy 1006–1011 |
| CH5 | SwC | 1000 STABILIZE, 1500 ALT_HOLD, 2000 LOITER — FC đổi chế độ theo |
| CH6 | SwD | 2000 → RTL, về 1000 → STABILIZE |
| CH7 | SwA | 1000 ↔ 2000 (WEB CONTROL ENABLE do backend đọc, FC không gán chức năng) |
| CH8 | SwB (ARM) | 03:13:05 và 03:13:17 gạt lên → FC từ chối `Arm: GPS 1: Bad fix`, `Arm: Fence requires position`, vẫn disarmed |
| CH9 | VrB | Vặn cao → AUTO, về thấp → STABILIZE |
| CH10 | VrA | Không đổi — đúng bản đồ, VrA không gán kênh |
| Failsafe | Tắt tay phát | CH3 → 911 µs, FC báo `Radio Failsafe` cùng lúc (< 0,1 s); bật lại → `Radio Failsafe Cleared` |

Kéo ga đáy + yaw phải (`ARMING_RUDDER 2`) cũng là lệnh ARM: một lần lúc thử cần, FC từ chối như trên.

## 4. TFmini Plus

Lần thử đầu, số đứng yên 258–259 cm suốt 150 s: tay chưa nằm trong chùm tia (rộng 3,6°). Lần hai, chắn
đúng trước hai ô kính, ghi chuỗi `DISTANCE_SENSOR` 20 mẫu/s:

- 258 cm (vật phía trước mũi) → 25–33 cm → lùi dần → giữ ~113 cm (±2 cm, 6 s) → về 10 cm → bỏ vật thì
  về lại 259 cm. Cờ proximity khoẻ suốt.
- 14 s không có gói nào lúc vật sát dưới ~15 cm: vùng mù gần của TFmini Plus (0–10 cm), FC bỏ ô đó.
  Không ảnh hưởng tránh vật cản (mốc phanh `AVOID_MARGIN 2` m).

## 5. Không kiểm được trên bàn — và vì sao

| Mục | Lý do | Kiểm lúc nào |
|---|---|---|
| GPS fix, `GPS 1: not healthy` | Trong nhà 0 vệ tinh; module trả lời (fix 1) | Ngoài trời: `kiem_phan_cung.py` mục GPS; việc mở ở báo cáo 261115-lich-su-bay mục 6.3 |
| Đường 5 V của FC | hwdef `speedybeef4v5` không có chân đo 5 V (chỉ có ADC áp/dòng pin, RSSI) | Đồng hồ vạn năng ở pad 5V |
| Áp từng cell | FC chỉ đo tổng | Máy đo cell hoặc B6AC lúc sạc |
| Dòng không tải từng motor | ESC OX32 báo dòng 0; cảm biến dòng của FC mỗi bậc ADC ≈ 0,3 A (370,4 A/V × 0,8 mV), lúc nghỉ đọc −0,24 A | Chỉ thấy khi có tải (bay: 11–12 A lúc treo) |
| Khựng khởi động có tải | Cần cánh | Log mỗi lần ARM ngoài bãi (`phan_tich_log.py`, mục "ESC khởi động") |

**Wi-Fi ở nhà:** cả hai bo cùng mất 4–5 s, đều đặn mỗi ~15,5 s (17/60 giây). Mất cùng giây ở cả hai bo
→ lỗi phía laptop: card đang nối Wi-Fi nhà "Nghaiz" (5 GHz, kênh 120) và phát hotspot cùng lúc, đúng bẫy
ghi trong AGENTS.md. Ngoài bãi (`che_do_bay.ps1 -Bat`, internet qua cáp iPhone) đo 02/11: 0/150 gói mất.
Không phải lỗi drone.

## 6. Cách làm để lặp lại

```powershell
# 1. Chụp nhanh mọi thứ (chỉ đọc), drone đứng yên, cắm pin trước USB sau
uv run --offline --with pyserial python scripts/fc/kiem_phan_cung.py COM6

# 2. Motor Test có ghi số liệu: MAVProxy giữ COM6, chia cho Mission Planner (UDP 14551) và script (14552)
D:\IOT_Tools\apps\MAVProxy\mavproxy.exe --master=COM6 --baudrate 115200 `
    --out=udp:127.0.0.1:14551 --out=udp:127.0.0.1:14552 --non-interactive --state-basedir logs\kiem-motor
uv run --offline python scripts/fc/kiem_phan_cung.py udpin:127.0.0.1:14552 --ghi logs/kiem-motor/motor.csv --giay 900
#    Mission Planner tự nối UDP 14551 → SETUP → Optional Hardware → Motor Test; NGƯỜI VẬN HÀNH bấm.
uv run --offline python scripts/fc/kiem_phan_cung.py --phan-tich logs/kiem-motor/motor.csv

# 3. Tay cầm
uv run --offline python scripts/fc/doc_tay_cam.py udpin:127.0.0.1:14552 --giay 600
```

Script ghi đọc lại tốc độ gói mỗi 2 s (Mission Planner nối cùng kênh sẽ ghi đè) và flush từng dòng,
nên dừng giữa chừng vẫn phân tích được. Không qua Wi-Fi: ở nhà mất 4–5 s một lần, đủ nuốt trọn một lần
thử motor.

## 7. File

- Script mới: `scripts/fc/kiem_phan_cung.py` (chụp nhanh / ghi Motor Test / phân tích).
- Số liệu (gitignored): `logs/kiem-motor/motor-20261115.csv`, `tfmini-chuoi-20261115.csv`,
  `tay-cam-20261115.log`, `mav.tlog`.
- Bản chụp tham số: `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261115-kiem-phan-cung.param`.
- Ảnh camera: `logs/camera/kiem-20261115.jpg`.
