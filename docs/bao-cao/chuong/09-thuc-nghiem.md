# Thực nghiệm và kết quả

Chương này trình bày các phép thử trên drone thật: kiểm toàn bộ phần cứng trên bàn, Motor Test có số đo, 11 chuyến
bay ngoài trời trong hai buổi 01/11/2026 và 02/11/2026, trong đó có một chuyến nạp mission mới khi drone đang bay
AUTO. Mỗi mục nói rõ đã thử gì, thử trong điều kiện nào, số đo lấy từ đâu. Cuối chương là bảng đối chiếu kết quả
với các ngưỡng nhóm em đặt ra từ đầu. Các bài trên drone ảo SITL đã trình bày ở chương 7.

## Kiểm phần cứng trên bàn

Trước khi lắp cánh, nhóm em kiểm lại toàn bộ phần cứng của drone đã lắp xong. Drone đặt trên bàn, **không gắn cánh**,
cắm pin 4S suốt buổi. Script `scripts/fc/kiem_phan_cung.py` nối FC qua USB (COM6) và đọc mọi số đo qua MAVLink ở chế
độ chỉ đọc: lỗi nội bộ của FC, IMU, khí áp kế, la bàn, tham số, receiver, TFmini, bốn ESC, pin. Riêng bài Motor Test
cần hai chương trình cùng nghe FC, nên MAVProxy giữ cổng COM6 rồi chia ra hai cổng UDP: 14551 cho Mission Planner
(người vận hành bấm Motor Test) và 14552 cho `kiem_phan_cung.py --ghi` (ghi số đo). Kết quả ở @tab:c9-kiem-ban.

Bảng: Kết quả kiểm phần cứng trên bàn, 12/12 hạng mục đạt {#tab:c9-kiem-ban}
| Hạng mục | Kết quả | Số đo chính |
|---|---|---|
| FC SpeedyBee F405 V5 | Đạt | ArduCopter 4.7.1; lỗi nội bộ 0; tải CPU ≤ 40 %; RAM trống 49-54 KB |
| IMU | Đạt | gia tốc tĩnh 998 mG; ồn con quay 0,6-4,9 mrad/s; rung đứng yên 0,01-0,07 m/s², clip 0 |
| Khí áp kế | Đạt | 1010,2 hPa, ồn 0,2-0,3 Pa |
| La bàn IST8310 | Đạt | 385-388 mG, dao động 0,5 mG |
| Tham số FC | Đạt | 889 tham số, có đủ `INS_ACC_ID` và `COMPASS_DEV_ID` |
| 4 ESC và 4 motor | Đạt | 41 lần khởi động, 0 lần khựng; vòng quay lệch nhau ≤ 2,8 % |
| Receiver iA6B, tay FS-i6X | Đạt | 4 cần đủ 1000-2000 µs; 5 công tắc, núm đúng chức năng; failsafe < 0,1 s |
| TFmini Plus | Đạt | bám vật 10-260 cm; giữ ~113 cm dao động ±2 cm |
| Pin 4S | Đạt | 15,20 V, tức 3,80 V/cell |
| ESP32 DroneBridge | Đạt | MAVLink hai chiều; FC trả `AUTOPILOT_VERSION` sau 0,21 s |
| Camera ESP32-S3 + OV3660 | Đạt | 150/150 khung sạch; VGA 7,6 khung/s; RSSI −28 dBm |
| Cơ khí | Đạt | motor quay tay êm; khung, càng, dây pha, mối hàn, tụ 1500 µF lành |

Với tay cầm, bốn cần về giữa ở 1498-1501 µs. Công tắc SwC cho ba mức 1000/1500/2000 µs ứng với STABILIZE, ALT_HOLD,
LOITER; SwD chuyển RTL; núm VrB đưa vào AUTO. Khi tắt tay phát, kênh ga rơi xuống 911 µs, thấp hơn ngưỡng
`FS_THR_VALUE` 975 µs, và FC báo `Radio Failsafe` ngay trong cùng nhịp đọc (dưới 0,1 s). GPS không nằm trong bảng vì
trong nhà không bắt được vệ tinh; ngoài trời GPS u-blox M10 bắt 15 đến 28 vệ tinh, HDOP không quá 0,89 trong cả 11
chuyến bay.

## Motor Test không cánh có số đo

Bài này kiểm bốn cặp ESC và motor trong điều kiện gần giống lúc bay: ESC phải bắt vòng nhanh, không khựng, bốn motor
quay đều nhau ở cùng mức ga. Nhóm em chạy hai vòng. Vòng 1 dùng "Test all" 7 lần ở ga 13 % (PWM 1130 µs, 3 s). Vòng 2
chạy từng motor ở ga 30 % (PWM 1300 µs, 5 s), hai lượt. Vòng quay đọc từ telemetry ESC, rung đọc từ IMU của FC, ghi
khoảng 1,7 mẫu mỗi giây trong 283 s.

Bảng: Số đo từng ESC trong Motor Test không cánh {#tab:c9-motor}
| ESC | Vị trí | Khởi động / khựng | rpm ở 13 % | rpm ở 30 % | Nhiệt ESC |
|---|---|---|---|---|---|
| M1 | sau-phải | 10 / 0 | 2098-2100 | 4514 | 36-39 °C |
| M2 | trước-phải | 11 / 0 | 2100 | 4509-4514 | 43-45 °C |
| M3 | sau-trái | 10 / 0 | 2042 | 4462-4471 | 31-33 °C |
| M4 | trước-trái | 10 / 0 | 2071 | 4506-4509 | 39-41 °C |

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/motor-test-rpm-20261115.csv
x: motor
y: rpm_ga_13pct,rpm_ga_30pct
legend: Ga 13 %,Ga 30 %
xlabel: Motor
ylabel: Vòng quay (rpm)
caption: Vòng quay lớn nhất của bốn motor ở ga 13 % và 30 %, Motor Test không cánh
id: fig:c9-rpm
w: 12
```

```chart
type: line
csv: docs/thuyet-trinh/facts/data/motor-test-chuoi-20261115.csv
x: t_s
y: rpm_m1,rpm_m2,rpm_m3,rpm_m4
legend: M1,M2,M3,M4
xlabel: Thời gian (s)
ylabel: Vòng quay (rpm)
caption: Vòng quay bốn motor theo thời gian trong cả buổi Motor Test: các đợt Test all ở 13 % rồi từng motor ở 30 %
id: fig:c9-rpm-chuoi
w: 14
```

Bốn motor khởi động tổng cộng 41 lần, không lần nào khựng, thời gian bắt vòng (lên 300 rpm) từ 0,05 đến 0,16 s.
Ở ga 30 %, motor chậm nhất (M3, 4462 rpm) chỉ kém motor nhanh nhất (M1, 4514 rpm) khoảng 1,2 %; ở ga 13 % chênh lệch lớn
nhất là 2,8 %. Khi cả bốn cùng quay ở 30 %, rung đo được là 0,12 / 0,20 / 0,12 m/s² theo ba trục x, y, z, rất xa ngưỡng
tốt 15 m/s² của ArduPilot. Chiều quay khớp `FRAME_TYPE 12`: M1 và M3 ngược kim đồng hồ,
M2 và M4 thuận kim đồng hồ.

## Bay thật ngoài trời

### Điều kiện bay

Hai buổi bay diễn ra ở một bãi đất trống rộng, buổi tối 01/11/2026 và buổi sáng 02/11/2026. Cấu hình drone giống nhau ở
cả hai buổi, trừ bán kính rào là thông số đặt riêng cho bãi bay (@tab:c9-dieu-kien).

Bảng: Cấu hình và dữ liệu của hai buổi bay {#tab:c9-dieu-kien}
| Mục | Giá trị |
|---|---|
| Pin | Ovonic LiPo 4S 5300 mAh; ngưỡng FC 14,0 V (RTL) và 13,2 V (LAND) |
| Rào ảo trên FC | trần 20 m, bán kính 50 m quanh home, lề 2 m, chạm rào thì RTL |
| Tốc độ | `LOIT_SPEED_MS` 3 m/s, `WP_SPD` 3 m/s, `RTL_ALT_M` 15 m |
| Đường lái chính | tay FS-i6X; mất sóng tay cầm thì RTL; mất Wi-Fi không đổi mode (`FS_GCS_ENABLE 0`) |
| Trạm mặt đất | laptop phát hotspot 2,4 GHz, backend nghe UDP 14550, web ở `localhost:5173` |
| Mạng laptop 02/11 | internet từ iPhone qua cáp, card Wi-Fi chỉ phát hotspot, đã chạy `che_do_bay.ps1 -Bat` |
| Dữ liệu 01/11 | log FC (dataflash) của 5 chuyến |
| Dữ liệu 02/11 | log FC, tlog của backend, video camera của 6 chuyến |

Một chuyến được tính khi drone lên quá 1 m so với home. Log FC ghi mỗi lần ARM thành một file riêng
(`LOG_FILE_DSRMROT 1`). Mỗi file được đọc bằng `scripts/fc/phan_tich_log.py`, cho ra thời gian bay, độ cao, rung, bám
góc, EKF, pin, nhiệt ESC và khoảng cách từ điểm hạ cánh tới home. Thời gian ARM, quãng đường và mAh lấy từ module
`backend/flights`, nơi ghép log FC, tlog và video theo giờ GPS. Đây cũng là dữ liệu của trang Lịch sử bay.

### Kết quả 11 chuyến

Hai buổi có 11 chuyến cất cánh, tổng 25,1 phút trên không và 1 547 m quãng đường ngang (@tab:c9-tong-buoi). Chín chuyến
có bay mission AUTO, các chuyến còn lại bay LOITER rồi RTL. Chi tiết từng chuyến ở @tab:c9-chuyen.

Bảng: Tổng hợp theo buổi bay {#tab:c9-tong-buoi}
| Buổi | Số chuyến | Thời gian ARM | Trên không | Quãng đường ngang | Pin dùng |
|---|---|---|---|---|---|
| 01/11 | 5 | 778 s | 659 s (11,0 phút) | 329 m | 1 903 mAh |
| 02/11 | 6 | 950 s | 849 s (14,2 phút) | 1 218 m | 2 435 mAh |
| Tổng | 11 | 1 728 s | 1 508 s (25,1 phút) | 1 547 m | 4 338 mAh |

Bảng: Số đo từng chuyến bay {#tab:c9-chuyen}
| Chuyến | Trên không (s) | Chế độ | Cao / xa nhất (m) | Pin (V) | Hạ cách home (m) |
|---|---|---|---|---|---|
| 01/11 20:12 | 207 | STABILIZE, LOITER, RTL | 15,3 / 35,3 | 15,44 → 15,05 | 0,13 |
| 01/11 20:18 | 171 | LOITER, AUTO, RTL | 15,4 / 34,9 | 15,29 → 14,93 | 0,13 |
| 01/11 20:24 | 81 | LOITER, AUTO đi-về | 8,2 / 3,9 | 15,18 → 14,90 | 0,08 |
| 01/11 20:26 | 86 | LOITER, AUTO đi-về | 15,1 / 5,1 | 15,14 → 14,84 | 0,03 |
| 01/11 20:28 | 114 | LOITER, AUTO đi-về | 18,1 / 29,3 | 15,08 → 14,76 | 0,19 |
| 02/11 10:10 | 103 | LOITER, RTL | 18,2 / 42,0 | 16,61 → 16,24 | 0,07 |
| 02/11 10:14 | 136 | LOITER, AUTO | 18,3 / 49,6 | 16,38 → 15,96 | 0,12 |
| 02/11 10:23 | 119 | LOITER, AUTO | 15,6 / 28,9 | 16,12 → 15,76 | 0,12 |
| 02/11 10:26 | 143 | LOITER, AUTO | 16,6 / 28,7 | 15,94 → 15,54 | 0,24 |
| 02/11 10:30 | 149 | LOITER, AUTO | 15,2 / 27,2 | 15,76 → 15,35 | 0,10 |
| 02/11 10:40 | 199 | LOITER, AUTO, GUIDED | 18,1 / 27,8 | 15,56 → 15,14 | 0,09 |

Lưới an toàn của FC giữ đúng trên drone thật. Độ cao lớn nhất của cả hai buổi là 18,3 m, bằng đúng trần 20 m trừ lề
2 m: khi lái tay, FC chặn leo ở đó. Trong chuyến 02/11 10:14, nhóm em lái LOITER thẳng ra phía rào 50 m để thử: FC tự
dừng drone ở 48,7 m, đúng lề 2 m, không cần người lái phanh. Pin cuối chuyến thấp nhất là 14,76 V, chưa chạm ngưỡng
cảnh báo 14,0 V lần nào. Dòng trung bình 8,2 đến 10,1 A, lúc treo 11 đến 12 A. Mức ga treo mà FC tự học
(`MOT_THST_HOVER`) nằm trong khoảng 0,184 đến 0,228, tức drone còn dư lực nhiều.

## Chuyến mission AUTO và nạp mission khi đang bay

Chuyến 02/11 lúc 10:40 thử tính năng khó nhất của trạm mặt đất: gửi một mission mới xuống FC trong lúc drone đang bay
mission cũ ở chế độ AUTO. Nếu FC nhận các gói mission mới khi vẫn đang AUTO, nó có thể bay tới điểm của mission dở dang.
Vì vậy backend chuyển GUIDED cho drone đứng giữ chỗ trước, nạp, đọc ngược lại để so khớp từng điểm, rồi đặt FC về
điểm 1 bằng `DO_SET_MISSION_CURRENT 1`. Người lái chủ động chuyển lại AUTO khi đã sẵn sàng. Các mốc trong chuyến lấy
từ sự kiện của log FC (@tab:c9-moc-1040).

Bảng: Các mốc của chuyến 10:40, tính từ lúc ARM {#tab:c9-moc-1040}
| Giây | Sự kiện |
|---|---|
| 0 | ARM ở LOITER, cất cánh bằng tay cầm |
| 28,3 | chuyển AUTO, FC báo "Mission: 1 Takeoff" |
| 41,8 đến 76,4 | qua WP2 đến WP6 của mission cũ |
| 76,8 | web gửi mission mới, backend chuyển GUIDED giữ chỗ |
| 77,9 | FC báo "Flight plan received", backend đọc lại, đặt điểm 1 |
| 106,7 | người lái chuyển AUTO, drone bay mission mới từ "1 Takeoff" |
| 122,9 đến 170,2 | qua WP2 đến WP7 của mission mới |
| 170,2 | "Mission: 8 RTL", drone tự bay về |
| 213,5 | hạ cánh cách home 0,09 m, DISARM |

![Vệt bay 3D của chuyến 10:40 dựng từ GPS, toạ độ tính bằng mét so với home: đoạn LOITER cất cánh, đoạn AUTO và điểm chuyển GUIDED để nạp mission mới](docs/thuyet-trinh/img/tikz/F44.png){#fig:c9-vet-3d w=12}

```chart
type: line
csv: docs/thuyet-trinh/facts/data/chuoi-20261102-104039.csv
x: t_since_arm_s
y: alt_m,dist_home_m
legend: Độ cao (m),Cách home (m)
xlabel: Thời gian từ lúc ARM (s)
ylabel: Mét
caption: Độ cao và khoảng cách tới home của chuyến 10:40; quãng giữ chỗ GUIDED nằm giữa giây 76,8 và 106,7
id: fig:c9-do-cao-1040
w: 14
```

```chart
type: line
csv: docs/thuyet-trinh/facts/data/chuoi-20261102-104039.csv
x: t_since_arm_s
y: batt_v,batt_a
legend: Điện áp pin (V),Dòng (A)
xlabel: Thời gian từ lúc ARM (s)
ylabel: Điện áp (V) / dòng (A)
caption: Điện áp và dòng pin trong chuyến 10:40: điện áp giảm từ 15,56 V xuống 15,14 V, dòng lớn nhất 16 A
id: fig:c9-pin-1040
w: 14
```

Trong gần 30 giây giữ chỗ (giây 76,8 đến 106,7), drone đứng ở GUIDED chờ người lái. Mission mới chạy
đủ từ điểm 1 tới RTL, drone tự hạ cách home 0,09 m. Cả chuyến dùng 596 mAh, nhiều nhất trong 11 chuyến. Cùng bài này
trên SITL (`run_nap_khi_bay.py`) cho số đo chi tiết hơn: FC vào GUIDED sau chưa tới 0,1 s, lúc giữ chỗ lệch 0,42 m ngang
và 0,01 m cao. @fig:c9-lsb-1040 là chuyến này khi xem lại trên trang Lịch sử bay.

!![Chuyến 10:40 trên trang Lịch sử bay: đường bay mission trên ảnh vệ tinh (trái) và bảng tóm tắt ghép từ log FC, tlog và video (phải)](docs/thuyet-trinh/img/real/lsb-1040-ban-do.png|docs/thuyet-trinh/img/real/lsb-1040-tom-tat.png){#fig:c9-lsb-1040 w=7.5}

## Chất lượng bay

Phần này dùng các chỉ số ArduPilot khuyên đọc sau mỗi chuyến. Rung lấy từ bản tin `VIBE` (p95 và lớn nhất của trục Z),
số lần cảm biến gia tốc bị bão hoà là `Clip`. EKF dùng tỉ số kiểm lớn nhất trong log `XKF4`: dưới 1 nghĩa là các cảm
biến khớp nhau. Bám góc là sai số RMS giữa góc FC muốn và góc đo được. Sai số hạ cánh là khoảng cách từ điểm DISARM tới
home. Số liệu cả 11 chuyến ở @tab:c9-chat-luong và hai biểu đồ dưới.

Bảng: Chỉ số chất lượng bay của 11 chuyến {#tab:c9-chat-luong}
| Chỉ số | Nhỏ nhất | Lớn nhất | Ngưỡng tốt |
|---|---|---|---|
| Rung p95 trục Z (m/s²) | 10,8 | 19,5 | < 30 |
| Rung lớn nhất (m/s²) | 14,0 | 26,1 | < 30 |
| Clip gia tốc | 0 | 0 | 0 |
| Tỉ số kiểm EKF | 0,23 | 0,45 | < 1 |
| Bám góc roll RMS (°) | 0,6 | 1,4 | |
| Bám góc pitch RMS (°) | 0,8 | 1,6 | |
| HDOP | 0,53 | 0,89 | < 1,2 khi bay LOITER |
| Nhiệt ESC lớn nhất (°C) | 46 | 54 | |
| Hạ cách home (m) | 0,03 | 0,24 | ≤ 3 |

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/chat-luong-bay.csv
x: chuyen_vn
y: vibe_z_p95_ms2,vibe_max_ms2
legend: Rung trục Z p95,Rung lớn nhất
xlabel: Chuyến bay
ylabel: Rung (m/s²)
caption: Rung trục Z (p95 và lớn nhất) của 11 chuyến, mọi chuyến dưới ngưỡng 30 m/s²
id: fig:c9-rung
w: 13
```

```chart
type: bar
csv: docs/thuyet-trinh/facts/data/chat-luong-bay.csv
x: chuyen_vn
y: ha_cach_home_m
xlabel: Chuyến bay
ylabel: Khoảng cách (m)
caption: Khoảng cách từ điểm hạ cánh tự động tới home của 11 chuyến
id: fig:c9-ha-canh
w: 13
```

Rung buổi sáng 02/11 thấp hơn rõ so với buổi tối 01/11 (p95 trục Z 10,8 đến 12,0 so với 15,1 đến 19,5 m/s²), nhưng cả
hai buổi đều dưới ngưỡng 30 và không có lần clip nào. Sai số bám góc không quá 1,4° ở trục roll và 1,6° ở trục pitch, drone
bám lệnh đều trong cả LOITER lẫn AUTO. Sai số hạ cánh lớn nhất 0,24 m, nhỏ hơn
mười lần ngưỡng 3 m. Với mission, drone đi qua waypoint cách tâm điểm 0,02 đến 0,19 m ở các mission đi-về ngắn ngày
01/11, và 0,36 đến 1,43 m ở các mission dài hơn ngày 02/11, vì ArduCopter vào cua trước khi tới điểm; điểm cuối mission
vẫn cách 0,03 đến 0,22 m.

## Liên kết Wi-Fi lúc bay

Ngày 02/11 backend ghi tlog nên đo được chất lượng đường MAVLink qua DroneBridge theo khoảng cách. RSSI là cường độ
sóng hotspot mà bo DroneBridge trên drone nhận được; tỉ lệ mất gói tính trên tlog của từng chuyến. Trước buổi bay, cấu
hình mạng ngoài bãi (iPhone qua cáp, card Wi-Fi chỉ phát hotspot, tắt quét nền) cho 0/150 gói mất ở cả hai bo khi
drone đứng cạnh laptop.

```chart
type: scatter
csv: docs/thuyet-trinh/facts/data/chuoi-20261102-101435.csv
x: dist_home_m
y: rssi_dbm
xlabel: Khoảng cách tới home (m)
ylabel: RSSI DroneBridge (dBm)
caption: RSSI của bo DroneBridge theo khoảng cách trong chuyến xa nhất (02/11 10:14, tới 49,6 m)
id: fig:c9-rssi
w: 12
```

Bảng: Liên kết và camera lúc bay, 6 chuyến ngày 02/11 {#tab:c9-lien-ket}
| Đại lượng | Giá trị |
|---|---|
| Tầm MAVLink còn dùng được | ~49 m |
| Mất gói MAVLink mỗi chuyến | 1,8 đến 12,1 %, trung vị 3,9 % |
| RSSI trung bình / thấp nhất | −75 đến −80 dBm / −90 đến −93 dBm |
| Camera trong 15 m | 7,6 đến 7,8 khung/s |
| Camera 15-25 m / trên 25 m | 3,1 / 1,8 khung/s |

MAVLink chỉ cần vài kbit/s nên giữ được tới gần 50 m. Luồng camera VGA cần khoảng 1,6 Mbit/s nên tốc độ khung giảm từ
khoảng 15 m. Vì vậy backend có cơ chế tự tăng hệ số nén JPEG khi khung/s xuống thấp. Việc bay không phụ thuộc Wi-Fi:
tay cầm FS-i6X vẫn là đường lái chính và rào ảo trên FC vẫn giữ drone dù mất liên kết với laptop.

## Ngày bay ngoài bãi

Ở bãi bay, laptop nối với drone qua hotspot. Mission Planner dùng để xem nhanh trạng thái GPS,
EKF và rung trước khi cất cánh (@fig:c9-mp-bai), còn trang Bay của web dùng để giám sát và nạp mission trong lúc bay.

![Mission Planner tại bãi bay trước khi cất cánh: drone ở tâm bản đồ vệ tinh, 21 vệ tinh, HDOP 0,6, GPS 3D dgps, pin 16,32 V](docs/thuyet-trinh/img/real/mp-bay-that-ban-do.png){#fig:c9-mp-bai w=10}

!![Drone S500 của nhóm: đủ cánh trên bãi gạch trước khi bay (trái) và trên bàn làm việc cạnh tay FS-i6X, pin 4S 5300 mAh (phải)](docs/thuyet-trinh/img/real/drone-nghieng.png|docs/thuyet-trinh/img/real/drone-ban-lam-viec.png){#fig:c9-drone-that w=7.5}

## Tổng hợp kết quả so với mục tiêu

Các ngưỡng trong @tab:c9-tong-hop là ngưỡng nhóm em đặt cho từng bài trong kế hoạch bay (bay RC cơ bản, bay tự động
và bay từ web), phần lớn lấy theo khuyến nghị đọc log của ArduPilot.

Bảng: Kết quả đạt được so với mục tiêu {#tab:c9-tong-hop}
| Mục tiêu | Ngưỡng | Kết quả | Đánh giá |
|---|---|---|---|
| Phần cứng hoạt động đủ | mọi hạng mục đạt | 12/12 hạng mục | Đạt |
| ESC, motor tin cậy | 0 lần khựng | 41 lần khởi động, 0 khựng | Đạt |
| Rung khung | < 30 m/s², clip 0 | lớn nhất 26,1 m/s², clip 0 | Đạt |
| EKF ổn định | tỉ số kiểm < 1 | lớn nhất 0,45 | Đạt |
| Pin lúc bay | không dưới 14,0 V | thấp nhất 14,76 V | Đạt |
| Dư lực đẩy | ga treo ≤ 0,65 | 0,184 đến 0,228 | Đạt |
| Tự về và hạ cánh | ≤ 3 m quanh home | 0,03 đến 0,24 m | Đạt |
| Bay mission AUTO | chạy đủ mission rồi RTL | 9/11 chuyến có AUTO | Đạt |
| Nạp mission khi đang bay | giữ chỗ, bay lại từ điểm 1 | chuyến 10:40, hạ cách home 0,09 m | Đạt |
| Trần độ cao | không vượt 20 m | cao nhất 18,3 m | Đạt |
| Rào bán kính | dừng trước rào | dừng ở 48,7 m với rào 50 m | Đạt |
| Failsafe tay cầm | FC phát hiện ngay | dưới 0,1 s | Đạt |
| Tầm liên kết MAVLink | đo được tầm thật | ~49 m, mất gói trung vị 3,9 % | Đạt |
| Camera lúc bay | hình liên tục cho AI | 7,6 đến 7,8 khung/s trong 15 m | Đạt trong 15 m |
| Dead-man lái tay từ web | dừng ≤ 1 s | 6-7 ms khi đóng tab (SITL) | Đạt trên SITL |

Mười ba mục đạt trên drone thật. Hai mục cuối mang đặc điểm của hệ hiện tại: camera giữ đủ tốc độ khung trong bán kính
khoảng 15 m quanh laptop, xa hơn thì thưa khung nhưng MAVLink và việc bay không bị ảnh hưởng; lái tay bằng bàn phím từ
web được nghiệm thu đầy đủ trên SITL, còn trong các chuyến bay thật web dùng để giám sát và nạp mission, tay cầm giữ
quyền lái.
