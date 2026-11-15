# Cấu hình bay ngoài trời — 01/11/2026

Người dùng thôi bay trong nhà. Yêu cầu: chỉnh lại mọi thứ cho bay ngoài trời, kiểm mọi tính năng phục
vụ bay mission và tránh vật cản TFmini, giới hạn độ cao dưới 20 m, telemetry về laptop ổn định, lưu
được mọi thứ camera gửi về. Thêm: mission ngắn "đi tới đi lui" ở 5–10 m rồi tự về hạ cánh.

Buổi sáng FC chỉ cắm USB. Chiều người dùng cắm pin và bật tay cầm: kết quả kiểm trên drone thật ở
mục 6, việc còn lại ở mục 7.

## 1. Kết luận

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Tham số ngoài trời trên FC | Đã ghi, đọc lại khớp | Bản chụp trước/sau: `D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261101-{truoc,sau}-ngoai-troi.param`; mục 2 |
| File param trong repo | Khớp FC | `firmware/ardupilot/params/01-base.param`, `02-avoid-tfmini.param` |
| Lưới an toàn trên SITL, đúng bộ param dự án | **7/7 PASS** | `scripts/sitl/run_ngoai_troi.py`, log `logs/sitl/run_ngoai_troi.log`; mục 3 |
| Mission đi–về 8 m | Bay đúng, RTL cuối không leo, hạ đúng chỗ | S1 mục 3 |
| Mẫu Đi–về đổi thành **5 m, 1 lượt, dừng 2 s mỗi đầu** (người dùng: 15 m quá xa) | Có dừng: tới 5,1 m rồi mới quay; không dừng: quay đầu ở 4,2 m | mục 8 |
| La bàn hiệu chỉnh ngoài trời | Đạt: `COMPASS_SCALE` 1,005, offset 67, EKF `compass_variance` ≤ 0,002 | mục 8 |
| Cổng chặn backend với giới hạn ngoài trời | Mẫu đi–về lọt qua; quá xa / quá cao / quá 10 item bị chặn | `backend/tests/test_mission_validation.py` (3 test mới) |
| Ghi hình camera | Ghi trên laptop, **không cần thẻ nhớ**; mọi khung camera gửi tới đều vào file | mục 5 |
| Telemetry Wi-Fi | Backend không còn tự ngắt khi Windows báo reset UDP giả | `backend/tests/test_connection.py` (2 test mới) |
| Kiểm có pin trên drone thật | Tham số, pin, la bàn, RC, TFmini, Wi-Fi, tlog đạt; lệch cân bằng ~3° và tay cầm chưa hiệu chỉnh — **người dùng đã sửa cả hai và thử failsafe tay cầm, đạt** | mục 6 |
| Đường truyền khi laptop nối điện thoại 2,4 GHz | Camera 3,3 khung/s, không mất khung; **MAVLink UDP mất ~20–37 % gói** (đo trong nhà, băng 2,4 GHz đông), chưa chốt nguyên nhân | mục 6 |
| Web nạp mission Đi–về | Nạp lên SITL "Đã nạp xong (6 item)", FC đọc lại khớp | `logs/sitl/web-ngoai-troi-nap-di-ve-sitl.png` |
| Test | Backend 330/330, frontend 241/241, typecheck + lint sạch | chạy lại 19:20 01/11 (sau sửa nạp mission, mục 8) |

## 2. Tham số đã đổi trên FC

| Tham số | Trước (trong nhà) | Sau (ngoài trời) | Nghĩa |
|---|---|---|---|
| `FS_THR_ENABLE` | 3 (Land) | **1 (RTL)** | Mất sóng tay cầm → tự bay về |
| `BATT_FS_LOW_ACT` | 1 (Land) | **2 (RTL)** | Pin dưới 14,0 V đủ 10 s → tự bay về; dưới 13,2 V vẫn Land tại chỗ |
| `FENCE_ENABLE` / `FENCE_TYPE` | 0 / 7 | **1 / 3** | Bật trần + vòng tròn quanh home (không đa giác) |
| `FENCE_ALT_MAX` | 100 | **20** | Trần 20 m so với chỗ cất cánh |
| `FENCE_RADIUS` | 300 | **50** | Vòng 50 m quanh chỗ cất cánh |
| `AVOID_MARGIN` / `AVOID_DIST_MAX` | 0,5 / 0,5 | **2 / 5** | Bỏ mốc tránh 0,5 m của nhà nhỏ |
| `LOIT_SPEED_MS` | 12,5 | **3** | Loiter tối đa 3 m/s |
| `WP_SPD` | 10 | **3** | Mission tối đa 3 m/s |

Giữ nguyên: `FENCE_MARGIN 2`, `FENCE_ACTION 1` (chạm rào → RTL, mất GPS → Land), `RTL_ALT_M 15`,
`RTL_CONE_SLOPE 3`, `OA_TYPE 0` (AUTO không tự tránh), `FS_GCS_ENABLE 0`, `AUTO_OPTIONS 0`,
`BATT_LOW_VOLT 14.0` / `BATT_CRT_VOLT 13.2` (pin 4S). Lý do từng quyết định:
`plans/QUYET-DINH-CHUA-CHOT.md` hàng 6–11.

## 3. SITL — cố tình vượt từng lưới an toàn

`run_ngoai_troi.py` nạp `01-base` + `02-avoid-tfmini` (cùng phần bù mô phỏng của
`run_param_load.py`), rồi bay 7 bài, mỗi bài đặt lại pin ảo về 100 %. Lượt 2 (bản runner cuối):

| Bài | Làm gì | Kết quả |
|---|---|---|
| S1 | Mission đúng mẫu "Đi – về" mặc định của web: 15 m, 2 lượt, cao 8 m; cất cánh 3 m rồi vào AUTO | Xa nhất 13,4 m, cao nhất 8,5 m, **chặng RTL cuối cao nhất 8,0 m (không leo lên 15 m)**, nhanh nhất 2,9 m/s, hạ cách home 0,0 m |
| S2 | Loiter, đẩy ga hết cỡ 15 s | Dừng ở **18,1 m**, không chạm trần |
| S3 | Stabilize, ga leo vừa phải | Đang leo 7,0 m/s thì chạm trần → RTL; **vọt lên 23,5 m** rồi về hạ cách home 0,1 m |
| S4 | Loiter, đẩy cần tiến hết cỡ 25 s | Nhanh nhất 2,3 m/s; **dừng ở 48,1 m**, không chạm rào |
| S5 | AltHold, đẩy cần tiến vừa phải | Không dừng; chạm rào khi đang bay 4,1 m/s → RTL; **xa nhất 53,5 m** rồi về hạ cách home 0,1 m |
| S6 | Loiter cách home 20 m, tắt sóng tay cầm (`SIM_RC_FAIL`) | RTL sau ~1,0 s, về hạ cách home 0,1 m |
| S7 | Loiter cách home 20 m, hạ áp pin để FC đọc 13,76 V | `Battery 1 is low` → RTL sau ~10 s, về hạ cách home 0,1 m, không rơi vào Land |

Chiều 01/11 chạy lại `run_avoid_brake.py` (file `02-avoid-tfmini.param` đã đổi phần fence): **PASS**.
Đối chứng tắt AVOID bay xuyên cột ở 4 m/s; bật TFmini như drone thật thì giữ cần tiến 40 s vẫn dừng
cách mặt cột 1,07–3,2 m (log `logs/sitl/run_avoid_brake-20261101.log`). Runner ghi lại snapshot
`firmware/ardupilot/params/sitl/02-sitl-avoid.param` (fence 20 / 50 / 3) và đồ thị
`docs/so-tay/anh/04-avoid-phanh.png`.

Ba điều rút ra cho người bay:

1. **Loiter là mode an toàn nhất**: tự dừng dưới trần và trước rào.
2. **AltHold không dừng trước rào** (tránh của AltHold chỉ xét TFmini — `AC_Avoid::adjust_roll_pitch_rad`
   thoát ngay khi không phải proximity). Chạm rào thì RTL nhưng vọt ra ngoài vài mét.
3. **Stabilize không có trần mềm**: vọt quá 20 m tới 3–4 m khi leo nhanh. Trần 20 m không phải tường
   cứng ở hai mode này.

Mission cuối ở home nên RTL không leo: ArduCopter lấy độ cao RTL = min(`RTL_ALT_M`, khoảng cách tới
home × `RTL_CONE_SLOPE`) nhưng không thấp hơn độ cao hiện tại; cách home dưới 2 m thì ×3 < 8 m.

### Hai chỗ runner sai ở lượt đầu

Lượt đầu (`logs/sitl/run_ngoai_troi-lan1.log`) báo **FAIL** ở S1 vì runner đòi drone tới trong 1 m
quanh điểm xa; ArduCopter coi đã tới khi vào trong `WP_RADIUS_M` (2 m, mặc định cả FC thật lẫn SITL)
nên quay đầu ở 13,5 m. Ngưỡng sửa thành `15 − WP_RADIUS_M`. S7 lượt đầu đạt nhưng đúng là may: runner
tưởng áp FC đọc cao hơn áp pin ảo là do sụt áp, thật ra là tỉ lệ (`BATT_VOLT_MULT` 11,0 của bo thật so
với bộ chia 10,1 SITL giả định: 16,8 V ảo → FC đọc 18,30 V), nên FC đọc 13,34 V thay vì 13,75 V. Lượt 2
chia theo tỉ lệ: FC đọc 13,76 V. Cả hai bẫy đã ghi vào `.claude/skills/iot-cv-sitl-nghiem-thu/SKILL.md`.

## 4. Web

- Thẻ **Mẫu lộ trình** có kiểu "Đi – về": quãng đi (mặc định 15 m, tối 01/11 đổi thành **5 m**), số
  lượt (mặc định 2, nay **1**; tối đa 4), hướng bay mặc định = hướng mũi drone, nút "Theo mũi drone (N°)".
  Mỗi lượt là [điểm xa, home], nên điểm cuối nằm trên home. Từ tối 01/11 mỗi điểm dừng 2 s (mục 8).
- Cảnh báo "quá số item" của thẻ mẫu trước đây đếm thiếu cất cánh + lệnh cuối (đếm 8 khi backend đếm
  10); đã sửa, có test và đã thử trả lỗi cũ thì test đỏ.
- Đèn **REC** trên panel video: thời gian + dung lượng đang ghi, nút bật/tắt (`GET/POST /api/recording`).
- Nút "Theo mũi drone (N°)" bị cắt chữ khi nằm chung cột → chiếm cả hàng (`col-span-2`).
- Thử thật trên SITL (backend `MAX_ALT=18`, `MAX_DISTANCE_HOME=45`): chọn Đi – về → Áp dụng → NẠP
  MISSION → "Đã nạp xong (6 item)": cất cánh, xa 15 m, home, xa 15 m, home, RTL.

## 5. Ghi hình và telemetry

- Camera (ESP32-S3) không có khe thẻ nhớ cũng không cần: laptop ghi luồng MJPEG nhận qua Wi-Fi vào
  `logs/recordings/<phiên>/*.avi`, **chép nguyên từng khung JPEG**, không nén lại, kèm `frames.csv`
  (giờ, toạ độ, độ cao, hướng, mode của từng khung). Đã kiểm ffmpeg đọc được đủ khung; trình phát của
  Windows và VLC chưa thử trên máy này. Thử với camera giả: 395/395 khung vào file, 0 khung hỏng,
  0 khung rớt. File cắt mỗi 5 phút; dừng khi ổ còn dưới 2 GB.
- Khung camera mất trên đường Wi-Fi thì không ghi lại được — file chỉ có những gì laptop nhận được.
- Telemetry MAVLink ghi vào `logs/tlog/*.tlog` (mở bằng Mission Planner). Log đầy đủ nhất vẫn là
  dataflash trên FC, tải sau mỗi chuyến bằng `scripts/fc/tai_log.py`.
- `chay-drone-that.bat` bật hotspot, backend (`udpin:0.0.0.0:14550`, camera thật, ghi hình + tlog,
  `MAX_ALT=18`, `MAX_DISTANCE_HOME=45`) và web, rồi chờ thấy drone.
- Thử với drone thật (chiều 01/11, cùng biến môi trường như file bat, ghi ra `D:\DevCache\tmp`):
  telemetry tới web 8,00 Hz (giãn cách 123–127 ms); tlog 9.015 gói trong 410 s, pymavlink đọc lại
  được; video MJPEG 640×480 ffprobe đọc được, nhịp trong file khớp nhịp thật (~2 khung/s).

## 6. Kiểm trên drone thật khi cắm pin (chiều 01/11)

Pin cắm sau USB nên FC được khởi động lại qua MAVLink (la bàn chỉ được dò lúc khởi động có pin).

| Mục | Kết quả |
|---|---|
| 39 tham số ngoài trời | Đọc lại sau khởi động lại: khớp hết |
| Pin | 16,93 V lúc cắm (4S), ~0,1 A khi nằm yên |
| La bàn | IST8310 (`COMPASS_DEV_ID` 658945) khoẻ, 432 mG; offset vẫn là bản hiệu chỉnh trong nhà 25/10 (20,4 / 31,3 / 59,7) |
| GPS | Trong nhà 0 vệ tinh — đúng, cần trời |
| Tay cầm | 14 kênh, ga thấp 1010, SwB ở DISARM, `RC not found` đã hết |
| TFmini | Chạy, đo vật trước mũi 0,18–0,42 m (bàn làm việc) |
| Pre-arm trong nhà | Chỉ còn `GPS 1: Bad fix`, `Fence requires position`, `Proximity 0 deg, 0.22m (want > 0.6m)` |
| Cầu Wi-Fi | Ping 30 s: 0 gói mất ở cả hai bo; telemetry tới web 8,00 Hz |
| Camera thật | `camera_check.py` PASS nhưng chỉ 1,6–1,9 khung/s, khoảng hở tới 4,7 s; **không mất khung** (frame_id liền mạch 153/153) |

### Ba điều mới lộ ra

1. **Cân bằng lệch ~3°.** Drone nằm yên đọc pitch −2,98°, roll −0,65°; log 27/10 cũng −2,6…−3,9°.
   `AHRS_TRIM_X` / `Y` đang 3,20° / 1,90° (Calibrate Level 25/10). Nếu mặt đặt phẳng thật thì
   "thăng bằng" của FC là mũi ngóc ~3° ngoài đời → AltHold/Stabilize tự trôi lùi khoảng 0,5 m/s²,
   khớp cả 3 lần trôi lùi 27/10 và cú ngóc mũi lúc rời đất. Loiter/AUTO có GPS tự bù. Cách xử lý:
   kiểm bằng thước thuỷ (app điện thoại) đặt trên tấm khung, đúng là phẳng thì Calibrate Level lại.
2. **Tay cầm chưa hiệu chỉnh**: RC1–4 vẫn 1100 / 1500 / 1900 mặc định, FS-i6X ra 1000–2000 → 10 %
   cuối hành trình cần không có tác dụng. Radio Calibration trong Mission Planner. Sau đó `RC3_MIN`
   phải > 985 (`FS_THR_VALUE` 975 + 10), không thì FC chặn arm bằng `Check FS_THR_VALUE`.
3. **Camera chậm.** Laptop đang nối Wi-Fi nhà **5 GHz kênh 161** trong lúc phát hotspot 2,4 GHz; ping
   từ laptop: router nhà p50 49 ms, DroneBridge 55 ms, camera 180 ms — card Wi-Fi chia thời gian giữa
   hai băng. RSSI camera −29 dBm, firmware đã tắt ngủ Wi-Fi. 13/10 cũng nối 5 GHz mà đạt 7,5 khung/s,
   nên **chưa chốt** nguyên nhân. Ra bãi laptop nối điện thoại 2,4 GHz (cùng băng) — phải thử ở nhà
   trước. Trình ghi vẫn lưu đủ mọi khung nhận được, nhưng mỗi khoảng hở > 2 s là sang file mới (8 file
   trong 95 s) và web hiện "CAMERA OFFLINE".

Thêm: `MOT_THST_HOVER` vẫn 0,27 (học từ 6S). Log 25/10 và 27/10 quá ngắn để FC học lại hay để tính
số thay; chuyến đầu lơ lửng ~1 phút ở Loiter/AltHold để FC tự học và tự lưu (`MOT_HOVER_LEARN 2`).
Cảm biến dòng hợp lý (log 27/10: ~12 A khi bay). Bù điện áp động cơ đang tắt (`MOT_BAT_VOLT_MAX` 0).

**Bẫy mới:** chạy thử `scripts/fc/hieu_chinh_la_ban.py` (bắt đầu rồi tự huỷ sau 12 s) làm FC chặn arm
bằng `PreArm: Compass calibrated requires reboot`. Đã khởi động lại: offset la bàn không đổi, lỗi hết.
Đã ghi vào docstring script và `AGENTS.md`.

Thử failsafe tay cầm hôm nay **chưa có kết quả**: theo dõi 150 s nhưng tay cầm không được tắt
(CH3 đứng 1010). Ngày 25/10 đã đạt với cùng cấu hình receiver (CH3 → 911, FC báo trong < 0,5 s).
Người dùng thử lại lúc 16:25, kết quả ở mục dưới.

### Sau ba việc trong nhà người dùng làm trong Mission Planner (16:25–17:05)

Mission Planner giữ COM6 nên agent đọc lại qua Wi-Fi. Bản chụp đủ 889 tham số:
`D:\IOT_Tools\downloads\speedybee-f405v5\snapshot-20261101-sau-hieu-chinh-trong-nha.param`.

| Việc | Kết quả | Bằng chứng |
|---|---|---|
| Calibrate Level | **Đạt.** `AHRS_TRIM_X` 3,20° → 2,57°, `AHRS_TRIM_Y` 1,90° → −0,84°; drone nằm yên đọc pitch −0,11°, roll +0,12° (trước −2,98° / −0,65°) | 22 mẫu ATTITUDE, độ lệch chuẩn ≤ 0,03° |
| Radio Calibration | **Đạt.** RC1/2/4 1000 / 1500 / 2000; RC3 1006 / 1009 / 2000; cả 16 kênh MIN ≤ TRIM ≤ MAX; `RC3_MIN` 1006 > 985 | bản chụp |
| Failsafe tay cầm | **Đạt.** Tắt tay cầm: CH3 rơi 911 < `FS_THR_VALUE` 975, FC báo `Radio Failsafe - Disarming` (đang nằm đất nên chỉ disarm; trên không `FS_THR_ENABLE` 1 là RTL). Bật lại: RC khoẻ lại | tlog Mission Planner `2026-11-01 16-23-53.tlog` (16:25:10 bật, 16:25:16 tắt); kiểm lại 132/132 mẫu SYS_STATUS báo RC khoẻ |
| Pre-arm, tay cầm bật, trong nhà | Chỉ còn `GPS 1: Bad fix`, `Fence requires position` | RUN_PREARM_CHECKS có ACK |

RC5–16 giữ 1100 / 1500 / 1900, có lẽ vì công tắc không được gạt lúc hiệu chỉnh (SwB cố ý không
gạt). Không sao: chế độ bay và công tắc phụ được FC so theo ngưỡng PWM thô, không theo `RCx_MIN/MAX`.

So với bản chụp 14:06, ngoài trim và RC1–4 chỉ khác: offset gyro và áp suất mặt đất (tính lại mỗi
lần khởi động); `COMPASS_DEV_ID` / `COMPASS_EXTERNAL` (bản 14:06 chụp lúc chưa cắm pin, la bàn chưa có
điện, nên **bản mới mới là bản khôi phục đúng**); `MAV1_*` do Mission Planner; `MAV2_*` = 4 do script
agent xin stream, chỉ nằm trong RAM vì `MAV2_OPTIONS` 0, khởi động lại là về 0.

### Đường truyền khi laptop nối điện thoại phát Wi-Fi

Người dùng chuyển laptop sang "iPhone nghaiz" (2,4 GHz kênh 6); `IOTCV-HOTSPOT` vẫn 2,4 GHz, hai
ESP32 tự nối lại.

| Đo | Wi-Fi nhà 5 GHz (chiều) | Điện thoại 2,4 GHz |
|---|---|---|
| Ping 30 s | 0 mất | camera 0/30, DroneBridge 1/30; p50 48–78 ms |
| Camera (`camera_check.py`) | 1,6–1,9 khung/s | **3,3 khung/s** (khung 13,5 KB, hở dài nhất 2,95 s), PASS, không mất khung |
| MAVLink UDP, hụt số thứ tự | 26–37 % | 21–37 % |

- Đo cùng lúc 40 s: ESP32 đọc từ FC 3 032 byte/s, laptop nhận 2 368 byte/s (**78 %**), tức mất trên
  khúc ESP32 → laptop. Dây FC → ESP32 sạch (6,26 MB giải ra 144 185 gói MAVLink, 43 byte/gói); ESP32
  thấy hotspot −48…−55 dBm.
- Ping 1 gói/s gần như không mất mà luồng MAVLink mất ~20 %: nghi hàng đợi gửi Wi-Fi của ESP32 tràn
  khi sóng chậm. Băng 2,4 GHz quanh nhà rất đông (quét thấy ~15 mạng ở kênh 1–11). **Chưa chốt**, đo
  lại ở bãi bay.
- Lưu ý khi đọc số: tlog Mission Planner qua USB (không thể rớt gói) cũng hụt 38 % số thứ tự, nên số
  hụt seq không chỉ là mất trên đường. Phép đo byte mới là con số chắc.
- Hệ quả: web và tlog nhận thiếu, có lúc hụt liền 1,6–2,7 s. An toàn bay không phụ thuộc: drone bay
  bằng tay cầm, `FS_GCS_ENABLE` 0 nên mất telemetry không kích failsafe, và log đầy đủ nằm trong
  dataflash FC (`scripts/fc/tai_log.py` qua USB sau chuyến bay).
- **Đừng nối TCP 5760 của DroneBridge**: thử 40 s chỉ nhận ~1 gói/s, rồi ESP32 tự khởi động lại giữa
  chừng, lên lại sau ~1 phút.

### Hai bẫy mới lúc kiểm qua Wi-Fi

1. pymavlink 2.4.50 để `target_component` = 0, tức mọi thành phần của hệ 1. ESP32 DroneBridge cũng là
   thành phần của hệ 1 nên trả `PARAM_REQUEST_LIST` bằng 18 tham số của nó; `fetch_all_params` tưởng
   đủ bảng và ghi bản chụp 18 dòng không báo lỗi. Đã sửa `scripts/fc/kiem_fc.py` (`FcThat.start` chốt
   sys/comp của FC theo HEARTBEAT có autopilot hợp lệ); chạy lại: 0 gói lạc, đủ 889/889. Ghi thêm vào
   `firmware/dronebridge/README.md` mục "Bẫy đã gặp".
2. Kiểm pre-arm qua đường mất gói: "không có dòng PreArm nào" **không** có nghĩa là sạch. Lần đầu báo
   vậy trong khi tay cầm đang tắt. Phải chờ ACK của RUN_PREARM_CHECKS, gom STATUSTEXT vài chục giây,
   và xem bit `PREARM_CHECK` trong SYS_STATUS.

## 7. Còn phải làm — người dùng tự tay, agent kiểm lại sau

Trong nhà: **xong hết** (mục 6) — Calibrate Level, Radio Calibration, thử failsafe tay cầm, laptop nối
điện thoại 2,4 GHz rồi đo lại camera.

Ngoài trời:

1. Cánh sau-trái gãy ngày 27/10: thay nếu chưa thay; ba cánh còn lại không nứt, mẻ, vênh.
2. ~~Hiệu chỉnh la bàn~~ **xong tối 01/11** (mục 8). Còn: so hướng mũi với la bàn điện thoại (FC đọc 357°).
3. ~~GPS ≥ 10 vệ tinh, HDOP < 1,5~~ đạt: 18 vệ tinh, HDOP 0,65. Pre-arm chỉ còn `RC not found` vì tay
   cầm tắt — bật tay cầm rồi kiểm lại (không vật gì trong 0,6 m trước TFmini).
4. Agent đo lại mất gói MAVLink và camera ở bãi (laptop nối điện thoại).
5. Chuyến đầu: Loiter 2–3 m, lơ lửng ~1 phút (FC học ga lơ lửng), thử SwD (RTL), rồi mới bay mission Đi–về.
6. Sau chuyến: tải dataflash qua USB (`scripts/fc/tai_log.py`) để agent xem nhiễu la bàn, ga lơ lửng, rung.

Tuỳ chọn: so điện áp với đồng hồ vạn năng — 16,93 V lúc cắm cao hơn 16,80 V của pin 4S đầy, nên
`BATT_VOLT_MULT` có thể cao chừng 0,8 %.

## 8. Tối 01/11 — Đi–về 5 m có dừng, la bàn ngoài trời

### Mẫu Đi–về 5 m

Người dùng: "muốn cho nó đi thẳng 5 m rồi về, 15 m là quá xa". Mặc định mới: 5 m, 1 lượt, mỗi điểm
dừng 2 s. Phải có dừng vì waypoint không dừng thì ArduCopter nối chặng sau vào chặng này
(`ModeAuto::set_next_wp` bỏ qua khi `param1` > 0) và vào cua trước khi tới điểm. SITL
(`run_ngoai_troi.py --chi S1,S1B`, cao 5 m, cất cánh 3 m rồi vào AUTO):

| Bài | Mission | Xa nhất | Chặng RTL cao nhất | Hạ cách home |
|---|---|---|---|---|
| S1 | 5 m, dừng 2 s mỗi đầu (mặc định mới của web) | **5,1 m** | 5,0 m | 0,0 m |
| S1B | 5 m, không dừng (đối chứng) | 4,2 m | 5,0 m | 0,1 m |

Đường đi của số giây dừng (trường `hold_s`, giây nguyên 0–65535 vì FC cất `p1` kiểu uint16):
`MissionWaypoint.hold_s` (`backend/schemas.py`, `ws-contract.schema.json`, `protocol.generated.ts`) →
`Waypoint.hold_s` → `param1` của MISSION_ITEM_INT → đọc lại phải trùng (`compare_readback`). Backend chặn
số lẻ, âm, tràn, hay `hold_s` trên lệnh khác WAYPOINT (`_loi_hold`); web soi gương luật đó
(`missionRules.ts`), giữ `hold_s` khi kéo/đảo/lưu/xuất `.waypoints` (cột param1), cộng vào thời gian
ước lượng, và ghi "dừng 2 s" trên dòng waypoint. Test mới: backend 7, frontend 10.

### La bàn ngoài trời

Người dùng hiệu chỉnh trong Mission Planner. Log backend: GPS có vị trí lúc 18:30:51, hiệu chỉnh xong
18:32:53 (`Mag(0) good orientation: 6 72.0`, tức `COMPASS_ORIENT 6` đúng), FC khởi động lại 18:33:29.
Ba lần `GPS Glitch or Compass error` lúc 18:31–18:32 là do xoay drone khi hiệu chỉnh. Đọc qua Wi-Fi
khoảng 18:36 (chỉ đọc, `doc_la_ban.py` trong scratchpad của phiên):

| Mục | Giá trị | Nghĩa |
|---|---|---|
| `COMPASS_OFS_X/Y/Z` | 35,1 / 23,0 / 52,7 (độ lớn 67) | Rất nhỏ (FC chặn arm khi > 1800) |
| `COMPASS_DIA_*` / `COMPASS_ODI_*` | 0,997–1,037 / ≤ 0,015 | Gần lý tưởng |
| `COMPASS_SCALE` | **1,005** (trước 0) | Hiệu chỉnh có GPS; từ trường chỗ đó khớp mô hình WMM trong 0,5 % — không bị cột điện, sắt thép làm lệch |
| `COMPASS_DEC` | −0,033 rad (−1,9°) | Độ lệch từ tự tính theo vị trí (`COMPASS_AUTODEC 1`) |
| EKF `compass_variance` | ≤ 0,002 (54 mẫu) | EKF tin la bàn hoàn toàn (> 0,8 mới đáng lo) |
| Độ lớn từ trường | 450–454 mGauss | Ổn định |
| GPS | fix 4, 18 vệ tinh, HDOP 0,65 | Rất tốt |
| Pre-arm | chỉ `RC not found` | Tay cầm đang tắt |

Chưa kiểm: hướng mũi so với la bàn điện thoại (FC đọc 357° lúc đọc). Đường truyền lúc đọc mất
1345/3897 gói (35 %), như các lần trước.

### Nạp mission qua Wi-Fi drone thật (18:43–19:14)

Web nạp mission Đi–về 5 m lên drone thật hỏng bốn lần, lần thứ năm đạt (19:14:21 "Đã nạp và đọc lại
khớp 4 item", mất ~25 s). Ba lỗi chồng nhau, tìm ra bằng tlog `logs/tlog/20261101-190530.tlog`:

| Lỗi | Triệu chứng | Sửa |
|---|---|---|
| Bảng mã `MISSION_ACK` khai tay sai từ Phase 07: INVALID_SEQUENCE ghi 10 (đúng 13), OPERATION_CANCELLED ghi 13 (đúng 15) | FC trả ACK 13 vì một item tới trễ — chỉ là nhắc, FC vẫn giữ phiên. Backend báo "bị GCS khác cắt ngang" rồi bỏ; 19:07:33 FC đã báo `Flight plan received` mà web vẫn hỏng | Sửa bảng theo enum MAVLink (thêm 6–12, 14); ACK 13 → chờ tiếp, ACK 15 → nạp lại; test so bảng với pymavlink |
| Im lặng 2 s là gửi lại `MISSION_COUNT` | FC bắt đầu lại từ seq 0: mỗi phiên kịp 1–2 item rồi về 0, không bao giờ xong | Giữa phiên im lặng thì gửi lại item vừa gửi, giữ phiên; chỉ nạp lại khi im quá 8 s (mốc FC tự huỷ) hoặc FC trả ACK 15. Mặc định chờ 3 s × 8 lần (cũ 2 s × 3) |
| Xin `HOME_POSITION` một lần lúc nối | Khởi động lại backend thì gói xin rơi, web báo "Chưa có điểm home", mẫu Đi–về ra 0 điểm | Chưa có home thì xin lại mỗi 2 s |

Web còn hiện "đọc lại CHƯA khớp" trong lúc đang đọc lại (backend đặt `source = local` ngay khi FC
ACK) — đổi thành "đang đọc lại để kiểm từng điểm…" khi còn đang nạp. Test: backend 330/330, frontend
241/241, typecheck sạch.

### Wi-Fi ngoài trời: laptop chạy pin

Laptop pin 55 %, **Energy Saver bật**, card Wi-Fi khi chạy pin ở mức tiết kiệm 2, nối "iPhone nghaiz"
2,4 GHz kênh 6. `wifi_ping_check` 150 s: camera mất 131/150, DroneBridge 87/150, mất chung 8 s mỗi
~15,5 s, laptop không quét. Đặt card Wi-Fi chạy pin = Maximum Performance (cũ: 2) và người dùng tắt
Energy Saver → 45 s sau: DroneBridge mất 3/45, camera 21/45 (p50 101 ms). Bo camera RSSI −28…−31 dBm
nhưng chỉ gửi ~0,6 khung/s (`frames_sent`), hotspot nhận tổng 10 KB/s, internet qua iPhone 41 KB/s —
không nghẽn vì tải; nghi hotspot phải chung kênh 6 và chung sóng 2,4 GHz với iPhone (13/10 laptop nối
5 GHz, camera 7,5 khung/s). Camera không cần cho chuyến mission thử.
