# OUTLINE: slide thuyết trình IOT-CV (môn IoT, 35 slide)

Đặc tả nội dung cho người dựng `part_*.py`. Thứ tự và số slide theo `docs/thuyet-trinh/DAN-Y.md`. Mọi số lấy từ
`docs/thuyet-trinh/facts/` (viết tắt `F01`…`F06` = `facts/01-phan-cung.md` … `facts/06-tien-trinh.md`,
`D/` = `docs/thuyet-trinh/facts/data/`).

Quy ước chung cho người dựng:

- Khung 20 × 11,25 in. Vùng nội dung x 1,0 đến 18,9 in, y 1,55 đến 10,5 in. Toạ độ ghi `(x, y, rộng, cao)` theo inch.
- Pill kicker đặt ở góc trên vùng nội dung theo `chrome.py`; tiêu đề trong thanh đỏ, 38 pt.
- Màu: đỏ PTIT `BB2025` chủ đạo, `8E1418` đỏ đậm, xanh `326CE5`, xanh lá `15803D`, hổ phách `B45309`, navy `1E293B`,
  chữ `1F2937`, nền thẻ `F3F4F6`, viền `DDE1E6`.
- Markup: `**đậm**`, `==đỏ nhấn==`, `` `mono` `` (đúng `lib.py`). Bảng kiểu booktabs, kẻ ngang, không tô nền header.
- Số thập phân dùng dấu phẩy; số từ 1 000 trở lên tách nghìn bằng thin space U+2009 (trừ cổng mạng, giá trị tham số trong `mono`, ngày giờ).
- Khoảng số viết "a đến b" hoặc "a…b", không dùng gạch ngang.
- Hiệu ứng: tên theo `motion.py` (`fade`, `rise`, `zoom`, `float`, `wipe-l/r/u/d`). Mọi bước "After Previous",
  `stagger` 120 ms khi một bước có nhiều hình. Transition mặc định `fade`; thanh tiêu đề morph giữa các slide nội dung.
- Biểu đồ native: python-pptx chart, font Be Vietnam Pro, lưới ngang nhạt `DDE1E6`, không viền khung, nhãn số dấu phẩy.
- TikZ: dựng bằng xelatex ra PNG 300 dpi vào `docs/thuyet-trinh/img/tikz/<ID>.png`, nền trong suốt, font Be Vietnam Pro.
- Ảnh chụp màn hình có chip phiên bản hay nhãn "nguồn giả": **cắt hoặc che nhãn** trước khi chèn (ghi rõ ở từng hình).

## Danh sách hình

| ID | Slide | Loại | Đặc tả ngắn | Nguồn |
|---|---|---|---|---|
| F01 | S01, S35 | TikZ 3D | drone Quad X nhìn chéo 3/4, 4 cánh, GPS cột đuôi, TFmini mũi, tia Wi-Fi tới laptop | F01 mục 1, 6 |
| F02 | S02, S34 | Ảnh thật | S02 `img/user-drone-ban-lam-viec.jpg` (drone, FS-i6X, pin), S34 `img/user-drone-nghieng.jpg` | `img/lap-rap-3d-*.png` (agent ảnh đang dựng) |
| F03 | S04 | TikZ 3D | kiến trúc hệ thống: drone (FC, ESC, 2 ESP32, TFmini, GPS), hotspot, laptop backend, trình duyệt, tay cầm RC | F03 mục 1; F01 mục 2 |
| F04 | S05 | TikZ 2D | trục thời gian 17/08 → 26/11, 10 mốc | F06 (a) |
| F05 | S06 | Ảnh | ghép 6 ảnh linh kiện: stack, motor, GPS/khung, TFmini, camera, FS-i6X | F01 "Ảnh dùng được" |
| F06 | S07 | TikZ 2D | sơ đồ nối dây FC: SERIAL2..6, USB, cáp ESC 10 chân | F01 mục 2; F02 mục 3 |
| F07 | S08 | TikZ 2D | cây nguồn pin 4S → ESC / BEC FC / UBEC → tải | F01 mục 3 |
| F08 | S09 | Ảnh thật | `img/user-drone-tren.jpg` chụp từ trên, 6 số đánh dấu linh kiện | `img/lap-rap-3d-*.png` |
| F09 | S09 | TikZ 2D | 7 mũi chevron A…G, số bước mỗi chặng | F01 mục 8 |
| F10 | S10 | TikZ 2D | chuỗi nạp `nap_dfu.py` → `kiem_fc.py` → `nap_param.py`, 8 bước | F02 mục 2 |
| F11 | S10 | Biểu đồ native (doughnut) | flash 1 MB: dùng 759 588 B, trống 239 820 B | F02 mục 1 |
| F12 | S11 | Ảnh | bo camera ESP32-S3 + OV3660 mặt trên | `IMG_8497.jpg` |
| F13 | S11 | Biểu đồ native (line) | KB/khung theo chất lượng JPEG 12…50 | `D/jpeg-quality-kich-thuoc-20261115.csv` |
| F14 | S12 | Lưới logo | logo công cụ PC (icons có sẵn + chữ) | F02 mục 9 |
| F15 | S13 | TikZ 3D | hình trụ rào ảo bán kính 100 m, trần 20 m, lề 2 m, home, RTL 15 m | F02 mục 4.4 |
| F16 | S14 | TikZ 2D + ảnh | ảnh FS-i6X, chú thích công tắc → kênh → chức năng | F02 mục 5; `fs_2.png` |
| F17 | S15 | TikZ 2D | 5 giai đoạn hiệu chỉnh, mỗi ô một kết quả số | F02 mục 6 |
| F18 | S16 | TikZ 2D | luồng MAVLink FC → ESP32 → UDP → backend, cổng lọc HEARTBEAT | F03 mục 3 |
| F19 | S17 | TikZ 2D | mạng ngoài bãi: iPhone (cáp USB) → laptop hotspot 2,4 GHz → 2 ESP32 | F03 mục 8 |
| F20 | S17 | Biểu đồ native (bar) | khung/s camera theo khoảng cách | `D/camera-fps-theo-khoang-cach-20261102.csv` |
| F21 | S17 | Biểu đồ native (scatter) | RSSI DroneBridge theo khoảng cách, chuyến 10:14 | `D/chuoi-20261102-101435.csv` |
| F22 | S18 | TikZ 2D | backend: thread MAVLink, hub WS, REST, vision, flights | F03 mục 2 |
| F23 | S19 | Ảnh chụp màn hình | trang Bay 1707×900, **cắt chú giải bản đồ và khung video** | `day-flight.png` |
| F24 | S20 | TikZ 2D | sơ đồ tuần tự web → backend → FC khi nạp lúc AUTO | F03 mục 3.4; F04 mục 3 |
| F25 | S20 | Ảnh chụp màn hình | trang Nhiệm vụ | `day-mission.png` |
| F26 | S21 | TikZ 2D | vòng an toàn đồng tâm: RC → FC → backend → web | F03 mục 3.5 |
| F27 | S21 | Biểu đồ native (bar) | SITL tránh cột: gần cột nhất, tốc độ 5 s cuối | `D/tranh-vat-can-sitl.csv` |
| F28 | S22 | TikZ 2D | 3 dải nguồn (log FC, tlog, video) ghép trên trục giờ GPS | F03 mục 3.8, 4 |
| F29 | S22 | Ảnh chụp màn hình | trang Lịch sử bay, **che chip tên model** | `261126-phase15-lich-su-bay-classic-1707x900.png` |
| F30 | S23 | TikZ 2D | vòng SITL: WSL SITL ↔ harness ↔ backend ↔ web | F03 mục 7 |
| F31 | S24 | Ảnh | khung bay gốc có 5 chú thích lỗi | `ab_raw.jpg` |
| F32 | S25 | Biểu đồ native (bar ngang) | số khung dev / test / neg | F05 A2 |
| F33 | S26 | TikZ 2D | pipeline 3 tầng + nhánh Ảnh rõ | F05 A3, A4 |
| F34 | S26 | Ảnh | khung 4 người sau tầng 2 | `box_005_00809_t2.jpg` |
| F35 | S27 | Ảnh cặp | gốc ↔ Ảnh rõ cùng khung | `ab_raw.jpg`, `ab_classic.jpg` |
| F36 | S27 | Biểu đồ native (bar ngang) | ms p50 từng bước lọc | F05 A4 |
| F37 | S28 | Biểu đồ native (clustered bar) | mAP50 và báo nhầm: 1 tầng vs 3 tầng | F05 A5 |
| F38 | S28 | Ảnh cặp | khung không người: tầng 1 vs sau tầng 2 | `box_002_00005_t1.jpg`, `_t2.jpg` |
| F39 | S29 | Biểu đồ native (stacked bar ngang) | ms p50/p95 detector, verifier, Ảnh rõ | F05 A6 |
| F40 | S29 | Ảnh chụp màn hình | trang Camera & AI, **cắt nhãn nguồn giả và chip phiên bản** | `web_vision_full.jpg` |
| F41 | S30 | Biểu đồ native (clustered bar) | rpm 4 motor ở ga 13 % và 30 % | `D/motor-test-rpm-20261115.csv` |
| F42 | S30 | Biểu đồ native (line) | rpm 4 motor theo thời gian Motor Test | `D/motor-test-chuoi-20261115.csv` |
| F43 | S31 | Biểu đồ native (combo bar + line) | giây trên không + độ cao lớn nhất, 11 chuyến | `D/chuyen-bay-tom-tat.csv`, `D/chat-luong-bay.csv` |
| F44 | S32 | TikZ 3D (pgfplots) | vệt GPS 3D chuyến 10:40, tô màu theo mode | `D/chuoi-20261102-104039.csv` |
| F45 | S32 | Biểu đồ native (line) | độ cao theo thời gian + dải mode | `D/chuoi-20261102-104039.csv` |
| F46 | S32 | Biểu đồ native (line 2 trục) | điện áp và dòng pin theo thời gian | `D/chuoi-20261102-104039.csv` |
| F47 | S33 | Biểu đồ native (bar + đường ngưỡng) | rung p95 trục Z, 11 chuyến, ngưỡng 30 | `D/chat-luong-bay.csv` |
| F48 | S33 | Biểu đồ native (bar) | khoảng cách hạ cánh tới home, 11 chuyến | `D/chat-luong-bay.csv` |

Tổng: 19 TikZ (4 hình 3D: F01, F03, F15, F44), 16 biểu đồ native, 9 ảnh/render, 4 ảnh chụp màn hình, 1 lưới logo.
Bảng native: S06, S07, S13, S16, S23, S25, S28, S30, S31 (9 bảng).

## Danh sách ảnh cần có

| Vai trò | Đường dẫn tuyệt đối |
|---|---|
| Mô hình 3D drone đã lắp (thay ảnh drone thật) | `D:\Coding\IOT-CV\docs\thuyet-trinh\img\lap-rap-3d-*.png` (agent ảnh dựng từ `D:\Coding\IOT-CV\docs\huong-dan\lap-rap-phan-cung.html`) |
| Stack FC + ESC | `D:\Coding\IOT-CV\assignment\_build\img\official\speedybee\prod_1.jpg` |
| 24 món trong hộp stack | `D:\Coding\IOT-CV\assignment\_build\img\official\speedybee\v5_29.jpg` |
| Khung S500 lắp xong | `D:\Coding\IOT-CV\assignment\_build\img\official\holybro\s500_3.jpg` |
| Các phần khung S500 | `D:\Coding\IOT-CV\assignment\_build\img\official\holybro\s500_5.jpg` |
| Motor AIR2216 | `D:\Coding\IOT-CV\assignment\_build\img\official\tmotor\tm_02.jpg` |
| Tay phát FS-i6X | `D:\Coding\IOT-CV\assignment\_build\img\official\flysky\fs_2.png` |
| TFmini Plus | `D:\Coding\IOT-CV\assignment\_build\img\official\benewake\tfminiplus_product.png` |
| Bo camera thật | `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg` |
| ESP32 DevKit (sơ đồ chân hãng) | `D:\Coding\IOT-CV\assignment\_build\img\official\espressif\esp32_devkitC_v4_pinlayout.png` |
| Giao diện web DroneBridge | `D:\Coding\IOT-CV\assignment\_build\img\official\dronebridge\dbesp32_webinterface.png` |
| Sơ đồ Quad X thứ tự motor kiểu Betaflight | `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\m_01_12_quad_x_bf.png` |
| Motor Test trong Mission Planner | `D:\Coding\IOT-CV\assignment\_build\img\official\ardupilot\MissionPlanner_MotorTest.png` |
| Trang Bay | `D:\Coding\IOT-CV\frontend\screenshots\day-flight.png` (cắt chú giải bản đồ, cắt khung video) |
| Trang Nhiệm vụ | `D:\Coding\IOT-CV\frontend\screenshots\day-mission.png` (soát chữ "Phase", "50 m" trước khi dùng; có thì cắt) |
| Trang Lịch sử bay | `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-classic-1707x900.png` (che chip tên model) |
| Trang Camera & AI | `D:\XLA\docs\nop-bai-src\slide-v4\img\web_vision_full.jpg` (cắt nhãn "Nguồn giả", che chip phiên bản) |
| AVOID phanh trên SITL (Mission Planner) | `D:\Coding\IOT-CV\docs\so-tay\anh\04-mp-avoid-phanh.png` |
| Khung bay gốc | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_raw.jpg` |
| Cùng khung sau Ảnh rõ | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_classic.jpg` |
| Khung không người, tầng 1 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_002_00005_t1.jpg` |
| Khung không người, sau tầng 2 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_002_00005_t2.jpg` |
| Khung 4 người sau tầng 2 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_005_00809_t2.jpg` |
| Khung VGA thật lúc kiểm camera | `D:\Coding\IOT-CV\logs\camera\kiem-20261115.jpg` |
| Logo PTIT | `D:\Coding\IOT-CV\docs\thuyet-trinh\build\assets\ptit_logo.jpg` |

Không dùng: mọi ảnh có khối camera đời trước (`assignment\_build\out\f5_daydien.png`, `f5_botri.png`,
`collage_linhkien.png`, `parts\esp32cam.png`), ảnh web tháng 9 (`docs\so-tay\anh\08-*`, `09-*`), ảnh FC dạng HEIC chưa đổi.

---

## S01 · Mở đầu

**Tiêu đề**: Drone tuần tra tự hành điều khiển qua Wi-Fi, tìm người bằng AI

**Bố cục**: slide bìa theo `chrome.py` (không thanh đỏ nội dung). Trái 1,0 đến 10,5 in: tên đề tài 44 pt hai dòng
(1,0; 3,2; 9,5; 2,4), dòng phụ 22 pt (1,0; 5,8; 9,5; 0,8), khối "Sinh viên / Giảng viên" bỏ trống (1,0; 7,2; 8,0; 1,6).
Phải 10,75 đến 19,15 in: ảnh drone thật `img/user-drone-nghieng.jpg` trong khung trắng (10,75; 0,95; 8,4; 6,8), nhãn "DRONE THẬT CỦA NHÓM". F01 dùng ở S35. Dưới cùng y 9,4: hàng 8 logo công nghệ cao 0,55 in.

**Khối nội dung**:
- Tên đề tài: **Drone quadcopter tuần tra tự hành** / điều khiển qua Wi-Fi, tránh vật cản, tìm người bằng AI
- Dòng phụ: Báo cáo môn Internet of Things · Học viện Công nghệ Bưu chính Viễn thông
- Sinh viên thực hiện: `……………………` · Giảng viên hướng dẫn: `……………………` (để trống, người dùng tự điền)
- Hàng logo: ArduPilot (chữ), Python, FastAPI (chữ), React, TypeScript, Vite (chữ), ONNX (chữ), GitHub. Logo nào
  không có trong `build/assets/icons/` thì đặt chip chữ navy.

**Hình**: F01, TikZ 3D. Drone Quad X nhìn chéo 3/4 từ trên: thân tâm navy `1E293B`, 4 cần xám, 4 vòng cánh đỏ
`BB2025` bán trong suốt, mũi tên chiều quay (trước-phải và sau-trái ngược kim, trước-trái và sau-phải thuận kim),
cột GPS ở đuôi, khối TFmini ở mũi phát tia đỏ mảnh về phía trước, khối camera dưới mũi. Từ thân có 3 cung sóng
xanh `326CE5` đi tới biểu tượng laptop góc phải dưới. Nguồn hình dạng: F01 mục 1, 6; chiều quay F01 mục 2.

**Hiệu ứng**: tên đề tài `rise` 500 ms → dòng phụ `fade` → F01 `zoom` 700 ms → hàng logo `float` stagger 80 ms.

**Nguồn**: chiều quay và vị trí linh kiện: F01 mục 2, mục 6.

**Ghi chú người nói**: Em xin chào thầy cô. Đề tài của nhóm em là một chiếc drone quadcopter tự lắp, bay bằng
ArduPilot, điều khiển được từ trình duyệt qua Wi-Fi. Drone có cảm biến LiDAR nhìn phía trước để tự phanh khi gặp
vật cản, và có camera gửi hình về laptop để mô hình AI tìm người trong khung hình. Toàn bộ phần mềm trạm mặt đất,
từ backend tới giao diện web, do nhóm tự viết. Trong phần trình bày, em sẽ đi từ bài toán, phần cứng, firmware và
cấu hình, sang đường truyền MAVLink, trạm mặt đất, drone ảo dùng để kiểm thử, phần AI, rồi tới số liệu của 11
chuyến bay thật ngoài trời. Mọi con số trên slide đều lấy từ log bay, báo cáo kiểm thử hoặc file tham số trong repo
của dự án.

**Để học**:
- Đề tài là một hệ IoT hoàn chỉnh: cảm biến trên drone, truyền qua Wi-Fi, xử lý trên laptop, hiển thị trên web.
- Drone bay bằng ArduPilot, phần mềm trạm mặt đất do nhóm tự viết.
- Có 11 chuyến bay thật làm bằng chứng.
- Giải thích: một hệ IoT gồm bốn khâu nối tiếp. Khâu thu nhận là cảm biến (IMU, GPS, LiDAR, camera). Khâu truyền
  dẫn ở đây là UART trên drone và Wi-Fi giữa drone với laptop. Khâu xử lý là backend Python trên laptop, gồm cả mô
  hình AI. Khâu ứng dụng là trang web người vận hành nhìn và bấm. Drone khác một thiết bị IoT đứng yên ở chỗ nó
  chuyển động và có thể gây nguy hiểm, nên phần lớn công sức dồn vào lớp an toàn: tay cầm RC luôn được ưu tiên, rào
  ảo trên bo bay, phanh khi gặp vật cản.
- Thuật ngữ: **ArduPilot** (firmware lái tự động mã nguồn mở), **trạm mặt đất / GCS** (phần mềm giám sát và ra lệnh
  cho drone).

---

## S02 · Mở đầu

**Tiêu đề**: Nội dung trình bày: 9 phần, từ bài toán tới 11 chuyến bay thật

**Bố cục**: trái 1,0 đến 10,2 in: danh sách 9 dòng, mỗi dòng cao 0,88 in bắt đầu y 1,7; số thứ tự trong ô tròn đỏ
0,6 in, tên phần 22 pt, chú thích 15 pt xám. Phải: F02 (10,8; 1,7; 8,1; 7,6), chú thích ảnh dưới (10,8; 9,5; 8,1; 0,5).

**Khối nội dung** (9 dòng):
1. **Bài toán** · mục tiêu, kiến trúc, tiến trình
2. **Phần cứng** · 16 nhóm linh kiện, nối dây, nguồn, lắp ráp
3. **Firmware** · ArduPilot 54 tính năng, DroneBridge, camera
4. **Cấu hình** · an toàn, tay cầm, hiệu chỉnh
5. **MAVLink** · gói tin, mạng ngoài bãi
6. **Trạm mặt đất** · backend, web, mission, an toàn, lịch sử bay
7. **SITL** · drone ảo, kiểm thử tự động
8. **AI** · tìm người và làm rõ ảnh trên camera bay
9. **Thực nghiệm** · kiểm phần cứng, 11 chuyến bay
- Chú thích ảnh: Drone đã lắp, tay phát FS-i6X và pin 4S 5 300 mAh

**Hình**: F02, ảnh render 3D drone đã lắp, góc 3/4 trên, nền trắng; viền bo 0,12 in, bóng nhẹ.
Nguồn: `D:\Coding\IOT-CV\docs\thuyet-trinh\img\lap-rap-3d-*.png`.

**Hiệu ứng**: F02 `fade` 600 ms → 9 dòng `rise` stagger 90 ms.

**Nguồn**: 16 nhóm linh kiện F01 mục 1; 54 tính năng F02 mục 1; 11 chuyến F04 mục 2.

**Ghi chú người nói**: Bài trình bày có chín phần. Phần một nói drone cần làm gì và các khối nối với nhau ra sao. Phần hai và ba là phần cứng và firmware: mười sáu nhóm linh kiện, cách chia cổng, nguồn điện, rồi bản ArduPilot nhóm em tự chọn 54 tính năng để vừa bộ nhớ của bo bay. Phần bốn là cấu hình an toàn và hiệu chỉnh. Phần năm và sáu là đường truyền MAVLink qua Wi-Fi và phần mềm trạm mặt đất. Phần bảy là drone ảo SITL, nơi nhóm em kiểm phần mềm trước khi bay thật. Phần tám là AI trên camera. Phần chín là số liệu thực nghiệm. Ảnh bên phải là chiếc drone nhóm em đã lắp, đặt cạnh tay phát FS-i6X và pin bốn cell dùng khi bay.

**Để học**:
- Nhớ thứ tự 9 phần để chuyển ý mạch lạc.
- Trọng tâm là drone; AI chỉ chiếm 6 slide.
- Ảnh bên phải là drone thật của nhóm, chụp trên bàn làm việc.
- Giải thích: bài được xếp theo đường đi của dữ liệu. Đầu tiên là phần vật lý (linh kiện, dây, nguồn), sau đó là
  phần mềm chạy trên chính drone (firmware), rồi tới cách drone được chỉnh để bay an toàn, đường truyền về đất, phần
  mềm dưới đất, và cuối cùng là bằng chứng bay thật. Cách xếp này giúp người nghe luôn biết mình đang ở khâu nào của
  hệ thống. Phần AI đặt gần cuối vì nó dùng lại mọi thứ phía trước: camera trên drone, mạng hotspot, backend và trang web.
- Thuật ngữ: **SITL** (Software In The Loop: chạy chính firmware ArduPilot trên máy tính với mô hình vật lý giả lập).

---

## S03 · Phần 1 · Bài toán

**Tiêu đề**: Một drone, hai đường điều khiển, bốn việc phải làm được

**Bố cục**: hàng trên (1,0; 1,7; 17,9; 1,3): một câu bài toán 22 pt trong thẻ nền `FCEBEC`. Dưới: 4 thẻ ngang
2×2 bên trái (1,0 đến 12,0 in, y 3,3 đến 10,3; mỗi thẻ 5,4 × 3,35 in, khe 0,2), icon lucide đỏ góc trái thẻ.
Phải (12,4; 3,3; 6,5; 7,0): khối "Hai đường điều khiển" gồm 2 dải ngang có mũi tên.

**Khối nội dung**:
- Câu bài toán: Drone bay theo lộ trình vẽ trên web, gửi telemetry và video về laptop qua Wi-Fi, tự phanh trước vật
  cản, báo khi camera thấy người.
- Thẻ 1 · **Tự bay mission**: vẽ tối đa 10 điểm trên bản đồ, nạp xuống FC, đọc lại so khớp, bay AUTO. Nạp được cả khi
  đang bay.
- Thẻ 2 · **Telemetry + video qua Wi-Fi**: telemetry 8 Hz lên web, video MJPEG 640×480 từ camera ESP32-S3.
- Thẻ 3 · **Tránh vật cản**: LiDAR TFmini Plus nhìn trước, tầm 0,1 đến 6 m; dừng cách vật 2 m ở Loiter.
- Thẻ 4 · **Tìm người**: AI ba tầng chạy trên GPU laptop, vẽ hộp người lên video, ghi sự kiện.
- Khối phải, dải 1 (đỏ): **Tay cầm RC** · FS-i6X → iA6B → FC · ưu tiên cao nhất, không qua phần mềm nhóm
- Khối phải, dải 2 (xanh): **Web** · trình duyệt → backend → Wi-Fi UDP → ESP32 → UART2 → FC · chỉ lái khi FC ở GUIDED
- Dòng chân khối phải: Mất Wi-Fi thì drone vẫn nghe tay cầm và vẫn bị rào ảo giữ.

**Hình**: không có hình lớn; icon lucide (`i:route_r`, `i:wifi_r`, `i:radar_r`, `i:scan-face_r` hoặc gần nhất có trong
`assets/icons`).

**Hiệu ứng**: câu bài toán `fade` → 4 thẻ `rise` stagger 120 ms → dải RC `wipe-l` → dải web `wipe-l` → dòng chân `fade`.

**Nguồn**: mission ≤ 10 điểm `backend/config.py` dòng 115 đến 125 (F03 mục 3.5); telemetry 8 Hz F03 mục 1; VGA F02 mục 8;
TFmini 0,1 đến 6 m, `AVOID_MARGIN` 2 m F02 mục 4.5; AI ba tầng F05 A3; hai đường điều khiển F01 mục 2; web chỉ ở GUIDED
F03 mục 3.5; `FS_GCS_ENABLE 0` F02 mục 4.3.

**Ghi chú người nói**: Bài toán của nhóm em có thể nói trong một câu: drone bay theo lộ trình người vận hành vẽ
trên web, gửi số liệu và hình ảnh về laptop qua Wi-Fi, tự phanh khi có vật cản phía trước, và báo khi camera thấy
người. Từ câu đó tách ra bốn việc ở bên trái. Bên phải là điểm em muốn thầy cô chú ý: drone có hai đường điều khiển
độc lập. Đường tay cầm RC đi thẳng từ bộ thu vào bo bay, không qua phần mềm nào của nhóm em, nên luôn được ưu tiên.
Đường web phải qua backend, Wi-Fi và bo ESP32, và web chỉ được lái khi bo bay đang ở chế độ GUIDED. Người cầm tay
cầm gạt sang chế độ khác là web mất quyền ngay. Vì vậy mất Wi-Fi không làm drone mất kiểm soát.

**Để học**:
- Bốn việc: tự bay mission, telemetry và video qua Wi-Fi, tránh vật cản, tìm người.
- Hai đường điều khiển độc lập; RC luôn thắng.
- Web chỉ lái được ở GUIDED.
- Giải thích: trong hệ thống điều khiển có người, nguyên tắc an toàn cơ bản là có một đường dự phòng không phụ thuộc
  vào phần mềm mình viết. Tay cầm RC dùng sóng 2,4 GHz riêng (giao thức AFHDS 2A), bộ thu nối thẳng vào bo bay qua
  iBUS. Nếu backend treo, trình duyệt đóng hay Wi-Fi mất, người vận hành vẫn lái được và vẫn có nút về nhà. Web chỉ
  là đường thứ hai, mạnh về giao diện nhưng không được phép là đường duy nhất.
- Thuật ngữ: **GUIDED** (chế độ ArduPilot nhận lệnh vị trí hoặc vận tốc từ trạm mặt đất), **telemetry** (số liệu
  trạng thái drone gửi về đất).

---

## S04 · Phần 1 · Bài toán

**Tiêu đề**: Kiến trúc: 2 bo ESP32 nối drone với laptop qua một hotspot

**Bố cục**: F03 chiếm (1,0; 1,6; 12,6; 8,8). Phải (13,9; 1,7; 5,0; 8,6): 4 thẻ dọc nhỏ, mỗi thẻ 5,0 × 2,0 in,
khe 0,2, viền trái màu theo khối.

**Khối nội dung** (4 thẻ):
- **Trên drone** (đỏ): FC SpeedyBee F405 V5 chạy ArduCopter 4.7.1; GPS, TFmini, bộ thu RC, ESC nối vào 5 cổng UART.
- **Cầu MAVLink** (xanh): ESP32 DroneBridge, UART2 115 200 baud ↔ Wi-Fi UDP 14550.
- **Camera** (hổ phách): ESP32-S3 + OV3660, MJPEG cổng 81, không nối FC.
- **Laptop** (navy): phát hotspot `IOTCV-HOTSPOT` 2,4 GHz; backend FastAPI cổng 8000; web React qua WebSocket `/ws`.

**Hình**: F03, TikZ 3D (phép chiếu isometric). Bên trái một tấm nền nghiêng tượng trưng drone (viền đỏ `BB2025`)
chứa các khối hộp 3D: FC (navy, giữa), ESC 4in1 (xám, dưới FC), GPS (cột đuôi), TFmini (mũi, tia đỏ), bộ thu iA6B,
ESP32 DroneBridge (xanh `326CE5`), camera ESP32-S3 (hổ phách `B45309`). Dây UART vẽ nét liền nhãn `SERIAL2`…`SERIAL6`.
Giữa: biểu tượng hotspot (sóng 3 cung) nhãn `IOTCV-HOTSPOT 2,4 GHz`. Phải: hộp 3D laptop chứa 2 tầng "backend
FastAPI :8000" và "AI ONNX GPU", nối mũi tên tới hộp trình duyệt "web :5173". Hai mũi tên Wi-Fi: xanh "MAVLink UDP
14550" từ DroneBridge, hổ phách "MJPEG :81" từ camera. Góc trái dưới: tay cầm FS-i6X, mũi tên đỏ đậm nét đứt
"RC 2,4 GHz" thẳng tới bộ thu, nhãn "ưu tiên cao nhất". Nguồn: F03 mục 1; F01 mục 2.

**Hiệu ứng**: F03 `fade` 700 ms → 4 thẻ `rise` stagger 150 ms.

**Nguồn**: F03 mục 1 (`chay-drone-that.bat`, `backend/config.py` dòng 102 đến 105, `01-base.param` dòng 44 đến 48);
F01 mục 2; F02 mục 7, 8.

**Ghi chú người nói**: Đây là kiến trúc tổng thể. Bên trái là drone. Bo bay SpeedyBee F405 V5 chạy ArduCopter 4.7.1,
là bộ não duy nhất quyết định motor quay thế nào. GPS, LiDAR, bộ thu RC và ESC đều nối vào bo bay qua các cổng UART
riêng. Trên drone còn hai bo ESP32 nhóm em thêm vào. Bo thứ nhất chạy firmware DroneBridge, nhận MAVLink từ cổng UART2
của bo bay và gửi qua Wi-Fi dạng gói UDP tới cổng 14550 của laptop. Bo thứ hai là camera ESP32-S3, phát video MJPEG ở
cổng 81, không nối với bo bay. Cả hai bo vào mạng hotspot do laptop phát. Trên laptop có backend FastAPI đọc MAVLink,
chạy AI, rồi đẩy dữ liệu lên trang web qua một WebSocket. Tay cầm RC ở góc dưới đi đường riêng.

**Để học**:
- Bo bay là nơi duy nhất điều khiển motor; laptop chỉ ra lệnh cấp cao.
- DroneBridge biến UART thành UDP; camera là luồng HTTP riêng.
- Laptop vừa phát hotspot vừa chạy backend và AI.
- Giải thích: MAVLink là giao thức nhị phân nhỏ gọn để bo bay và trạm mặt đất trao đổi gói tin. Trên drone, MAVLink
  chạy trên dây UART tốc độ 115 200 baud. Bo ESP32 DroneBridge đọc các byte đó và đóng vào gói UDP gửi qua Wi-Fi,
  chiều ngược lại cũng vậy, nên với backend thì drone giống như một máy trong mạng LAN. Video không đi qua MAVLink vì
  quá nặng; camera có bo riêng phát luồng MJPEG, tức là chuỗi ảnh JPEG nối tiếp qua HTTP.
- Thuật ngữ: **UART** (cổng nối tiếp hai dây TX/RX), **UDP** (giao thức gửi gói không bắt tay, hợp cho telemetry),
  **MJPEG** (video là chuỗi ảnh JPEG).

---

## S04b · Phần 1 · Bài toán

**Tiêu đề**: Mô hình IoT mức 6: 2 nút độc lập, 1 bộ điều khiển trung tâm

**Bố cục**: trái (1,0; 2,05; 11,6; 8,45): hình `img/asg/f5_level.png`. Phải (12,95; 2,05; 5,95): 4 thẻ có icon, dưới cùng
một ô đỏ nhạt ghi điểm khác lý thuyết.

**Khối nội dung**:
- **Nút 1: drone** · bo bay đọc cảm biến, quay 4 motor; DroneBridge đưa MAVLink lên Wi-Fi
- **Nút 2: camera** · ESP32-S3 + OV3660 chỉ là cảm biến, gửi MJPEG thẳng về laptop
- **Bộ điều khiển trung tâm** · backend FastAPI biết trạng thái mọi nút, gửi lệnh xuống drone, lưu log, chạy AI
- **Ứng dụng** · web GCS trên trình duyệt: REST để hỏi, WebSocket để lái và nhận telemetry
- Ô cuối: laptop ở bãi bay giữ vai cloud. Hai nút vào hotspot của laptop, không cần Internet để bay.

**Hình**: `img/asg/f5_level.png` (vẽ lại từ hình 5.10 của báo cáo môn, `tex/asg/f5_level.tex`).

**Hiệu ứng**: hình `fade` → 4 thẻ `rise` stagger 130 ms → ô cuối `fade`.

**Nguồn**: `img/asg/README.md`; kiến trúc S04; hotspot `docs/so-tay/12-hotspot-laptop.md`.

**Ghi chú người nói**: Nếu xếp theo các mức triển khai IoT trong môn học, hệ thống của nhóm em là mức 6. Mức này có nhiều nút đầu cuối chạy độc lập, mỗi nút tự gửi dữ liệu lên, và một bộ điều khiển trung tâm biết trạng thái của tất cả để ra lệnh. Ở đây có hai nút. Nút thứ nhất là drone: bo bay đọc cảm biến và điều khiển motor, còn bo DroneBridge đưa MAVLink lên Wi-Fi. Nút thứ hai là camera ESP32-S3, nó chỉ đo, không điều khiển gì. Bộ điều khiển trung tâm là backend FastAPI. Nó vừa nhận dữ liệu, vừa lưu, vừa chạy AI, rồi phục vụ trang web. Điểm khác lý thuyết là phần cloud nằm trên chính laptop ở bãi bay. Cả hai nút vào hotspot của laptop, nên bay được kể cả khi không có Internet.

**Để học**:
- Mức 6: nhiều nút độc lập, phân tích và lưu ở trung tâm, ứng dụng dùng chung.
- Hai nút: drone (cảm biến + chấp hành) và camera (chỉ cảm biến).
- Laptop thay cloud.
- Giải thích: các mức IoT phân theo chỗ dữ liệu được lưu và phân tích, và theo số nút. Mức 1 chỉ có một nút làm hết; mức 6
  có nhiều nút tự gửi dữ liệu và một bộ điều khiển trung tâm. Bộ điều khiển trung tâm ở đây gửi lệnh MAVLink xuống drone
  và nhận ảnh từ camera; nếu thêm drone thứ hai thì chỉ cần thêm một nút, phần trung tâm giữ nguyên. Tay phát RC không
  thuộc mô hình này vì nó là đường an toàn riêng, đi thẳng tới bộ thu trên drone.
- Thuật ngữ: **nút đầu cuối** (thiết bị có cảm biến hoặc bộ chấp hành), **bộ điều khiển trung tâm** (dịch vụ biết trạng thái mọi nút).

---

## S05 · Phần 1 · Bài toán

**Tiêu đề**: 102 ngày từ tạo repo tới drone bay mission và tìm người

**Bố cục**: F04 trục thời gian ngang (1,0; 2,2; 17,9; 5,6). Dưới (1,0; 8,3; 17,9; 1,9): 4 ô số ngang, mỗi ô 4,3 × 1,9 in.

**Khối nội dung**:
- 10 mốc trên trục (ngày · nhãn ngắn, xen kẽ trên/dưới trục):
  1. 17/08 · Tạo repo, khung backend, web, CI
  2. 21/09 · Chốt thiết kế, cài 13/13 công cụ PC
  3. 22/09 đến 25/09 · SITL, backend MAVLink, web lái tay, mission
  4. 12/10 · Chốt linh kiện, camera ESP32-S3
  5. 13/10 · Nạp ArduPilot lên FC bằng script
  6. 17/10 · Hướng dẫn lắp ráp 76 bước
  7. 24/10 · Chuyến bay đầu: Stabilize 82 s, Loiter 155 s
  8. 01/11 · Hiệu chỉnh ngoài trời, rào ảo, RTL 15 m
  9. 01/11 đến 02/11 · 11 chuyến ngoài trời, nạp mission khi bay
  10. 15/11 đến 26/11 · Kiểm phần cứng 12/12, Lịch sử bay, AI trên camera
- 4 ô số: **89** commit · **51** script tự động hoá · **13** runner SITL · **11** chuyến bay thật

**Hình**: F04, TikZ 2D. Trục ngang navy dày 3 pt, vạch tháng (08, 09, 10, 11) theo tỉ lệ ngày thật; 10 chấm tròn:
màu xanh `326CE5` cho mốc phần mềm (1, 2, 3), đỏ `BB2025` cho phần cứng và bay (4 đến 9), hổ phách `B45309` cho mốc 10.
Mỗi chấm một nhãn 2 dòng (ngày đậm + mô tả 11 pt), nhãn xen trên/dưới để không chồng. Dải mờ đỏ từ 24/10 tới 02/11
ghi "bay thật". Nguồn: F06 (a).

**Hiệu ứng**: trục `wipe-r` 900 ms → 10 mốc `fade` stagger 110 ms → 4 ô số `zoom` stagger 120 ms.

**Nguồn**: F06 (a) từng hàng; 102 ngày, 89 commit, 51 script, 13 runner: F06 (b); 11 chuyến: F04 mục 2;
chuyến bay đầu: `plans/reports/261025-kiem-tra-phan-cung-that.md` dòng 30, 50, 51 (F06 (a)).

**Ghi chú người nói**: Dự án kéo dài 102 ngày tính từ lúc tạo repo ngày 17/08. Ngày 21/09 nhóm em chốt thiết kế và cài
đủ công cụ. Điểm đáng chú ý là thứ tự: phần mềm làm trước trên drone ảo. Từ 22 tới 25/09, backend, web lái tay và
mission đã chạy trên SITL, ba tuần trước khi bo bay thật được nạp firmware ngày 13/10. Sau đó là lắp ráp, chuyến bay
đầu ngày 24/10, hiệu chỉnh và cấu hình bay ngoài trời ngày 01/11, rồi hai buổi bay ngoài trời với 11 chuyến cất cánh.
Nửa cuối tháng 11 dành cho kiểm phần cứng toàn bộ, trang lịch sử bay và tích hợp AI. Bốn con số bên dưới đếm từ repo:
89 commit, 51 script tự động hoá, 13 runner SITL và 11 chuyến bay thật.

**Để học**:
- Làm phần mềm trên drone ảo trước, phần cứng sau: tiết kiệm thời gian và tránh rơi drone.
- Mốc 13/10 nạp FC, 24/10 bay đầu, 01 và 02/11 bay ngoài trời.
- Bốn số: 89 commit, 51 script, 13 runner, 11 chuyến.
- Giải thích: cách làm "mô phỏng trước" phổ biến trong robot và UAV. SITL chạy đúng mã ArduPilot sẽ nạp lên bo
  thật, nên backend nói chuyện với drone ảo y như với drone thật qua MAVLink. Lỗi logic trong mission hay dead-man được
  bắt trên máy tính, không tốn pin, không tốn cánh. Khi phần cứng về, việc còn lại chủ yếu là nối dây, hiệu chỉnh cảm
  biến và kiểm những thứ SITL không có, như sóng Wi-Fi thật. Mốc phần cứng dồn vào khoảng ba tuần, từ nạp firmware 13/10 tới hai buổi bay 01 và 02/11.
- Thuật ngữ: **runner** (script chạy một bài kiểm tự động trên SITL và trả PASS/FAIL), **CI** (chạy test tự động mỗi lần đẩy code).

---

## S06 · Phần 2 · Phần cứng

**Tiêu đề**: 16 nhóm linh kiện trên khung S500 480 mm, pin 4S 5 300 mAh

**Bố cục**: trái (1,0; 1,6; 8,4; 8,8): F05 lưới ảnh 3 cột × 2 hàng, mỗi ô 2,7 × 4,2 in có nhãn dưới. Phải
(9,8; 1,6; 9,1; 8,8): bảng 9 dòng × 3 cột.

**Khối nội dung**:
- Nhãn 6 ảnh: Stack FC + ESC · Motor AIR2216 · Khung S500 · TFmini Plus · Camera ESP32-S3 · Tay phát FS-i6X
- Bảng (cột: Linh kiện | Thông số chính | Việc):

| Linh kiện | Thông số chính | Việc |
|---|---|---|
| SpeedyBee F405 V5 | STM32F405, flash 1 MB, gyro ICM-42688, blackbox 16 MB | Bo bay |
| ESC OX32 55A 4in1 | 55 A/kênh, DShot300, có telemetry vòng quay | 4 motor |
| T-Motor AIR2216 KV920 | 64 g/motor (hãng), cánh T1045 10 inch | Lực đẩy |
| Holybro M10 + IST8310 | u-blox M10, 230 400 baud, la bàn I2C | Định vị, hướng |
| FlySky FS-i6X + iA6B | AFHDS 2A, iBUS, FC đọc 14 kênh | Lái tay |
| Benewake TFmini Plus | LiDAR ToF 0,1 đến 12 m, chùm 3,6°, 100 khung/s | Vật cản |
| ESP32 DevKit CP2102 | DroneBridge, UART 115 200 ↔ Wi-Fi | Cầu MAVLink |
| ESP32-S3 N16R8 + OV3660 | flash 16 MB, PSRAM 8 MB, 3 MP, VGA MJPEG | Camera |
| Ovonic LiPo 4S | 5 300 mAh 110C, 423 g (hãng), XT60 | Nguồn |

- Dòng chân bảng (14 pt xám): Thêm UBEC 5 V 3 A, còi, tụ 1 500 µF 35 V, bộ phụ kiện lắp. Lực đẩy hãng công bố:
  1 332 g/motor ở 16 V, cánh T1045.

**Hình**: F05, ảnh ghép: `speedybee\prod_1.jpg`, `tmotor\tm_02.jpg`, `holybro\s500_3.jpg`, `benewake\tfminiplus_product.png`,
`picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg`, `flysky\fs_2.png` (đường dẫn đầy đủ ở "Danh sách ảnh cần có"). Mỗi ô nền
trắng, viền `DDE1E6`, ảnh fit giữa.

**Hiệu ứng**: 6 ô ảnh `zoom` stagger 100 ms → bảng `wipe-d` 700 ms → dòng chân `fade`.

**Nguồn**: F01 mục 1 (dòng 1 đến 16 của bảng linh kiện); lực đẩy 1 332 g bảng hãng `docs/bao-cao-tong-quan-du-an.md`
mục 3.2 (F01 mục 4); 480 mm F01 mục 4.

**Ghi chú người nói**: Drone dùng khung Holybro S500, đường chéo giữa hai motor 480 mm. Bo bay và ESC là một stack của
SpeedyBee: bo F405 V5 dùng chip STM32F405 có 1 MB flash, ESC bốn trong một chịu 55 ampe mỗi kênh, giao tiếp DShot300
và gửi ngược vòng quay từng motor về bo bay. Motor là T-Motor AIR2216 KV920 với cánh 10 inch; theo bảng của hãng mỗi
motor cho 1 332 gam lực đẩy ở 16 vôn. GPS M10 có la bàn đi kèm. Tay phát FS-i6X và bộ thu iA6B là đường lái tay. Cảm biến
tránh vật cản là LiDAR TFmini Plus. Hai bo ESP32: một làm cầu MAVLink, một là camera ESP32-S3 với cảm biến OV3660. Nguồn
là pin LiPo bốn cell 5 300 mAh.

**Để học**:
- Stack F405 V5 + ESC OX32 55A là trung tâm.
- Motor KV920 + cánh 10 inch hợp khung 480 mm, bay êm, ít vòng quay.
- Hai bo ESP32 có hai việc khác nhau: cầu MAVLink và camera.
- Giải thích: KV là số vòng quay mỗi phút trên một vôn khi không tải. KV thấp (920) đi với cánh to quay chậm, cho lực
  đẩy lớn và hiệu suất tốt, hợp drone chở cảm biến; KV cao đi với cánh nhỏ cho drone đua. Pin "4S" là bốn cell LiPo nối
  tiếp, đầy 16,8 V, danh định 14,8 V. "110C" là dòng xả tối đa so với dung lượng, ở đây dư rất xa so với 11 đến 12 A khi
  treo.
- Thuật ngữ: **ESC** (bộ điều tốc motor không chổi than), **DShot** (giao thức số gửi lệnh ga tới ESC), **LiDAR ToF**
  (đo khoảng cách bằng thời gian bay của xung sáng).

---

## S07 · Phần 2 · Phần cứng

**Tiêu đề**: 5 cổng UART của FC, mỗi cổng một thiết bị, một giao thức

**Bố cục**: trái (1,0; 1,6; 10,0; 8,9): F06. Phải (11,3; 1,6; 7,6; 6,4): bảng 6 dòng. Dưới bảng (11,3; 8,2; 7,6; 2,2):
thẻ "Thứ tự motor" có ảnh nhỏ `m_01_12_quad_x_bf.png` (2,0 × 2,0 in) bên trái và 2 dòng chữ.

**Khối nội dung**:
- Bảng (Cổng | Thiết bị | Giao thức | Baud):

| Cổng | Thiết bị | `SERIALn_PROTOCOL` | Baud |
|---|---|---|---|
| SERIAL2 (T2/R2) | ESP32 DroneBridge | 2 · MAVLink2 | 115 200 |
| SERIAL3 (T3/R3) | TFmini Plus | 9 · Rangefinder | 115 200 |
| SERIAL4 (cổng GPS) | GPS M10 | 5 · GPS | 230 400 |
| SERIAL5 (cáp 10 chân) | ESC OX32 | 16 · ESC Telemetry | 115 200 |
| SERIAL6 (R6) | Bộ thu iA6B | 23 · RCIN (iBUS) | |
| SERIAL0 (USB-C) | Mission Planner, script | MAVLink | |

- Thẻ thứ tự motor: **Quad X, thứ tự motor kiểu Betaflight** · M1 sau-phải, M2 trước-phải, M3 sau-trái, M4 trước-trái.
  FC ánh xạ lại bằng `SERVO1..4_FUNCTION` 36 / 33 / 34 / 35.

**Hình**: F06, TikZ 2D. Hình vuông giữa navy là FC (nhãn "SpeedyBee F405 V5"), mép trước có mũi tên "mũi drone".
Năm khối thiết bị xếp quanh: ESP32 DroneBridge (xanh `326CE5`, trái trên), TFmini Plus (đỏ, trên), GPS M10 (xanh lá
`15803D`, phải trên), bộ thu iA6B (hổ phách, phải dưới), ESC OX32 (xám đậm, dưới). Mỗi dây có nhãn cổng + chân:
"T2 → GPIO16, R2 ← GPIO17", "R3 ← TX (xanh), T3 → RX (trắng)", "TX→R4, RX→T4, SCL/SDA", "R6 iBUS", "cáp SH1.0 10 chân:
V, G, C, T, M1…M4". Dây nguồn vẽ mảnh khác màu: 5 V của FC tới TFmini, 4V5 tới GPS và bộ thu, 5 V UBEC tới ESP32. Nguồn:
F01 mục 2; F02 mục 3.

**Hiệu ứng**: FC `zoom` → 5 khối thiết bị `fade` stagger 120 ms → bảng `wipe-d` → thẻ motor `rise`.

**Nguồn**: `firmware/ardupilot/params/01-base.param` dòng 17 đến 74, `02-avoid-tfmini.param` dòng 59 đến 67 (F02 mục 3);
chân nối F01 mục 2 (`data-cables.js`); thứ tự motor `docs/phan-cung-thuc-te.md`, `01-base.param` dòng 26 đến 34 (F01 mục 2).

**Ghi chú người nói**: Bo bay có sáu cổng nối tiếp, nhóm em dùng năm. Cổng UART2 là cổng duy nhất có DMA nên dành cho
bo DroneBridge, chạy MAVLink2 ở 115 200 baud. TFmini nằm ở SERIAL3 với giao thức Rangefinder. GPS ở SERIAL4 chạy 230 400
baud. ESC gửi telemetry vòng quay qua SERIAL5 trong cùng cáp mười chân. Bộ thu RC ở SERIAL6 với iBUS. Cổng USB dùng khi
cắm laptop trên bàn. Ô bên dưới nói về thứ tự motor. ESC của stack này đánh số motor theo kiểu Betaflight, khác sơ đồ
quen thuộc của ArduPilot, nên nhóm em giữ khung Quad X và ánh xạ lại bốn đầu ra bằng tham số SERVO1 tới SERVO4. Ghi
motor theo vị trí như trước-phải, sau-trái giúp không nhầm khi lắp.

**Để học**:
- Mỗi thiết bị một cổng UART, giao thức chọn bằng `SERIALn_PROTOCOL`.
- UART2 có DMA nên dành cho MAVLink tốc độ cao.
- Quad X, thứ tự motor kiểu Betaflight, ánh xạ bằng `SERVO1..4_FUNCTION`.
- Giải thích: ArduPilot không đoán thiết bị nào cắm ở cổng nào; người cấu hình khai báo bằng tham số. Cùng một cổng
  vật lý có thể chạy MAVLink, GPS, LiDAR hay telemetry ESC chỉ bằng cách đổi một con số. TX của bên này phải nối RX của
  bên kia. DMA cho phép chip chuyển dữ liệu UART vào bộ nhớ mà không bắt CPU đọc từng byte, nên cổng có DMA chịu được
  luồng MAVLink dày mà không làm nặng vòng điều khiển bay.
- Thuật ngữ: **DMA** (truy cập bộ nhớ trực tiếp), **iBUS** (giao thức số của FlySky gửi nhiều kênh RC trên một dây),
  **baud** (số bit mỗi giây trên đường nối tiếp).

---

## S07b · Phần 2 · Phần cứng

**Tiêu đề**: Sơ đồ nối dây: từng pad của F405 V5 và đường nguồn từ pin 4S

**Bố cục**: toàn khung (1,0; 2,05; 17,9; 8,5): hình `img/asg/f5_daydien.png`.

**Khối nội dung**: chỉ có hình; chú giải màu dây nằm trong hình.

**Hình**: `img/asg/f5_daydien.png`, vẽ lại từ hình 5.6 của báo cáo môn trên lưới 9 mm, mọi dây đi từ pad tới pad
(`tex/asg/f5_daydien.tex`).

**Hiệu ứng**: hình `fade`.

**Nguồn**: `facts/01-phan-cung.md` (chia cổng, tụ 1 500 µF 35 V, dây trắng TFmini vào T3, camera ăn UBEC); `img/asg/README.md`.

**Ghi chú người nói**: Đây là sơ đồ nối dây đầy đủ, mỗi đường là một sợi dây thật. Bên trái là GPS M10 ở cổng SERIAL4, có thêm hai chân CL và DA cho la bàn, và bộ thu FS-iA6B gửi iBUS vào chân R6. Bên phải là bo DroneBridge ở cổng SERIAL2. Dây TX của thiết bị luôn vào chân R của bo bay và ngược lại, nên các đường xanh lá và vàng bắt chéo. TFmini ở SERIAL3, dây trắng của nó hàn vào T3. Phía dưới là phần nguồn. Pin 4S vào thẳng pad của ESC, có tụ 1 500 micro fara để dập xung. Cáp stack đưa điện áp pin, telemetry và bốn tín hiệu motor lên bo bay. Một UBEC riêng lấy điện từ pin, qua bảng chia nuôi bo DroneBridge và camera. Camera không nối dây nào với bo bay, nó chỉ gửi hình qua Wi-Fi.

**Để học**:
- TX của thiết bị vào R của bo bay.
- SERIAL2 DroneBridge, SERIAL3 TFmini, SERIAL4 GPS, SERIAL6 iBUS, SERIAL5 telemetry ESC qua cáp stack.
- Nguồn: pin → ESC (tụ 1 500 µF); pin → UBEC 5 V → 2 ESP32.
- Giải thích: UART là hai dây một chiều, chân gửi của bên này phải nối vào chân nhận của bên kia, nên nối "TX vào TX" là
  lỗi hay gặp nhất và nhìn sơ đồ sẽ thấy dây bắt chéo. Tụ lớn đặt sát pad nguồn vì motor đổi ga liên tục tạo xung điện áp
  trên dây pin. Hai bo ESP32 dùng UBEC riêng để xung dòng của Wi-Fi không đi chung đường với bo bay.
- Thuật ngữ: **pad** (chỗ hàn trên bo mạch), **UBEC** (bộ hạ áp xung cho mạch phụ), **cáp stack** (cáp nối ESC lên bo bay).

---

## S08 · Phần 2 · Phần cứng

**Tiêu đề**: Một pin 4S nuôi cả drone, UBEC 5 V 3 A tách riêng cho 2 ESP32

**Bố cục**: trái (1,0; 1,6; 11,4; 8,9): F07. Phải (12,8; 1,6; 6,1; 8,9): 3 ô số trên (mỗi ô 6,1 × 1,5 in, xếp dọc)
và thẻ "Ngưỡng pin" dưới (12,8; 6,5; 6,1; 4,0).

**Khối nội dung**:
- Ô số 1: **2,5 A** · BEC 5 V của stack; tải ~200 mA (GPS, bộ thu, TFmini)
- Ô số 2: **3 A** · UBEC riêng cho DroneBridge + camera
- Ô số 3: **11 đến 12 A** · dòng khi treo, sụt ~0,3 V
- Thẻ ngưỡng pin (bảng 3 dòng không viền dọc):
  - 16,8 V · pin đầy (4,20 V/cell)
  - 14,0 V · `BATT_LOW_VOLT` → ==RTL== sau 10 s
  - 13,2 V · `BATT_CRT_VOLT` → ==LAND== tại chỗ
  - dòng chân: Đo dòng `BATT_AMP_PERVLT` 370,4 A/V, dung lượng 5 300 mAh, giữ lại 20 % (1 060 mAh)

**Hình**: F07, TikZ 2D cây nguồn từ trái sang phải. Gốc: khối pin "LiPo 4S 5 300 mAh" (đỏ `BB2025`) → dây XT60 dày nhãn
"12 đến 14 AWG" → nút "pad nguồn ESC" có tụ "1 500 µF 35 V" song song. Nhánh 1: ESC OX32 → 4 motor (dây 16 AWG). Nhánh 2:
cáp 10 chân → FC → "BEC 5 V 2,5 A" → TFmini (110 mA), và "4V5" → GPS (~40 mA), bộ thu (~50 mA). Nhánh 3 (xanh `326CE5`):
"UBEC 5 V 3 A" → bảng chia nguồn → ESP32 DroneBridge (VIN), camera ESP32-S3 (5 V). Nét dày theo cỡ dây; một chú thích
"GND chung qua pin". Nguồn: F01 mục 3.

**Hiệu ứng**: pin `zoom` → ba nhánh `wipe-r` lần lượt 600 ms mỗi nhánh → 3 ô số `rise` stagger 120 ms → thẻ ngưỡng `fade`.

**Nguồn**: F01 mục 3 (`data-cables.js`, `02-avoid-tfmini.param` dòng 20 đến 23 cho tải BEC); dòng treo F01 mục 4
(`docs/phan-cung-thuc-te.md` hàng Pin); ngưỡng và đo dòng F02 mục 4.2 (`01-base.param` dòng 121 đến 151).

**Ghi chú người nói**: Toàn bộ drone chạy từ một pin LiPo bốn cell. Pin cắm vào pad nguồn của ESC qua đầu XT60, ở đó có
thêm tụ 1 500 micro fara để hấp thụ xung điện áp khi motor tăng giảm ga. Từ đây chia ba nhánh. Nhánh lớn nhất đi vào
bốn motor. Nhánh thứ hai qua cáp mười chân lên bo bay; BEC 5 vôn của stack chịu 2,5 ampe nhưng chỉ phải nuôi GPS, bộ thu
và TFmini, tổng khoảng 200 mili ampe. Nhánh thứ ba là một UBEC 5 vôn 3 ampe riêng cho hai bo ESP32, vì Wi-Fi của chúng
kéo dòng theo xung và nhóm em không muốn xung đó chung đường với bo bay. Bên phải là ngưỡng pin: dưới 14 vôn đủ 10 giây
thì drone tự bay về, dưới 13,2 vôn thì hạ cánh tại chỗ.

**Để học**:
- Ba nhánh nguồn: motor, FC và cảm biến, UBEC cho ESP32.
- Hai ngưỡng pin: 14,0 V về nhà, 13,2 V hạ cánh.
- Tách nguồn ESP32 để Wi-Fi không gây sụt áp lên bo bay.
- Giải thích: BEC là mạch hạ áp từ pin xuống 5 V. Bo ESP32 khi phát Wi-Fi kéo dòng thành từng đợt ngắn, dễ làm điện áp
  5 V dao động. Đặt chúng trên một UBEC riêng giữ đường 5 V của bo bay sạch. Ngưỡng pin tính theo cell: 3,5 V mỗi cell
  là lúc nên về, 3,3 V là lúc phải hạ ngay để không làm hỏng pin. ArduPilot còn bù điện áp cho bộ điều khiển
  (`MOT_BAT_VOLT_MAX` 16,8, `MIN` 13,2) để cảm giác ga không đổi khi pin yếu dần.
- Thuật ngữ: **BEC / UBEC** (mạch hạ áp, UBEC là bản đứng riêng dạng xung), **RTL** (Return To Launch, tự bay về điểm cất cánh).

---

## S09 · Phần 2 · Phần cứng

**Tiêu đề**: Lắp ráp theo 7 chặng A tới G, tổng 76 bước có tick

**Bố cục**: trên (1,0; 1,6; 17,9; 1,5): F09 dải 7 chevron. Dưới trái (1,0; 3,4; 8,6; 7,0): F08. Dưới phải
(9,9; 3,4; 9,0; 7,0): 7 dòng mô tả chặng (mỗi dòng 1,0 in), chữ cái chặng trong ô vuông đỏ.

**Khối nội dung** (7 dòng):
- **A · Chuẩn bị** (4 bước): chỗ làm, dụng cụ, tập hàn, 6 luật an toàn
- **B · Kiểm hàng** (9): đếm 24 món hộp stack, chia ren motor 2 + 2, đo từng cell pin
- **C · RC + GPS trên bàn** (9): bind FS-i6X, gán kênh, failsafe 2 lớp, hàn còi
- **D · Nguồn + motor + ESC** (14): hàn XT60, tụ, UBEC; cấp pin qua smoke stopper; Motor Test
- **E · ESP32 + TFmini + camera** (11): hotspot, telemetry Wi-Fi, TFmini vào R3/T3, kiểm 10 phút cả chuỗi
- **F · Lắp khung S500** (18): motor đúng ren, stack trên bát chống rung, đi dây, cân trọng tâm
- **G · Hiệu chỉnh trên khung** (11): accel, la bàn, radio, failsafe, rào ảo, gắn cánh
- Chú thích F08: Mô hình 3D trong trang hướng dẫn lắp ráp `docs/huong-dan/lap-rap-phan-cung.html`

**Hình**:
- F09, TikZ 2D: 7 mũi chevron nối nhau, chiều rộng tỉ lệ số bước (4, 9, 9, 14, 11, 18, 11). Màu: A, B xám `4B5563`; C, D, E
  xanh `326CE5` (làm trên bàn); F đỏ `BB2025` (lắp khung); G xanh lá `15803D` (hiệu chỉnh). Trong mỗi chevron: chữ cái
  + số bước. Dưới dải: ngoặc nhọn "trên bàn, chưa lắp khung" phủ C đến E. Nguồn: F01 mục 8.
- F08, ảnh render mô hình 3D, góc trên chéo thấy stack, GPS cột, TFmini mũi. Nguồn: `img/lap-rap-3d-*.png`.

**Hiệu ứng**: dải chevron `wipe-r` 900 ms → F08 `fade` → 7 dòng `rise` stagger 100 ms.

**Nguồn**: F01 mục 8 (`docs/huong-dan/lap-rap/src/data-steps.js`, `data-steps2.js`); 24 món hộp F01 mục 8 chặng B.

**Ghi chú người nói**: Nhóm em chia việc lắp thành bảy chặng, tổng 76 bước, mỗi bước có ô tick trong trang hướng dẫn tương tác. Ý chính là ba chặng C, D, E làm trên bàn khi chưa lắp khung: bộ thu RC, GPS, nguồn, motor, ESC, hai bo ESP32 và TFmini đều được nối và kiểm từng phần. Lần cấp pin đầu tiên đi qua smoke stopper, một mạch ngắt khi có chập. Chỉ khi mọi thứ chạy đúng trên bàn mới chuyển sang chặng F lắp vào khung S500, chặng dài nhất với 18 bước, trong đó có nối dài mười hai mối dây motor và cân trọng tâm. Chặng G là hiệu chỉnh trên khung và gắn cánh cuối cùng. Ảnh bên trái chụp drone thật từ trên xuống, các số đánh dấu GPS, bo DroneBridge, stack bo bay, tụ chống xung, UBEC và bộ thu.

**Để học**:
- 7 chặng, 76 bước; chặng F dài nhất (18 bước).
- Kiểm từng phần trên bàn trước, lắp khung sau.
- Cánh gắn sau cùng, ở chặng G.
- Giải thích: lắp drone theo kiểu "từng khối một" giúp khoanh vùng lỗi. Nếu nối hết rồi mới cấp điện, khi có sự cố sẽ
  không biết do mối hàn, do dây hay do linh kiện. Kiểm trên bàn từng chuỗi (RC tới FC, pin tới ESC tới motor, FC tới ESP32
  tới laptop) rồi mới đóng vào khung thì mỗi lỗi chỉ có vài chỗ để tìm. Cánh luôn tháo cho tới bước cuối vì motor 2216
  với cánh 10 inch đủ sức gây thương tích.
- Thuật ngữ: **smoke stopper** (mạch bảo vệ ngắt dòng khi chập, dùng cho lần cấp điện đầu), **trọng tâm / CG** (điểm cân bằng, phải nằm giữa 4 motor).

---

## S10 · Phần 3 · Firmware

**Tiêu đề**: ArduPilot 54 tính năng, nạp và đọc lại bằng 3 lệnh, 34/34 dòng

**Bố cục**: trái (1,0; 1,6; 11,6; 5,2): F10. Dưới trái (1,0; 7,1; 11,6; 3,3): 2 thẻ "Bật thêm" và "Tắt bớt" cạnh nhau
(5,7 × 3,3 in mỗi thẻ). Phải (12,9; 1,6; 6,0; 5,6): F11. Dưới phải (12,9; 7,5; 6,0; 2,9): 3 dòng số.

**Khối nội dung**:
- Thẻ **Bật thêm 6 tính năng** (xanh lá): Proximity · Proximity Rangefinder · OA Path Planner · Avoid AltHold ·
  CrashCatcher · EKF3 ước lượng gió
- Thẻ **Tắt bớt** (xám): OSD, MSP, VTX (không bay FPV) · CRSF, SBUS, PPM (chỉ giữ iBUS) · NMEA GPS · khung Hexa, Octa, Tri
- 3 dòng số phải:
  - `ArduCopter V4.7.1 (dbe79216)` · board `speedybeef4v5`
  - Ghi 32,6 s, kiểm 5,6 s · `Download verified successfully`
  - 850 → 861 tham số sau khi nạp `01-base.param`

**Hình**:
- F10, TikZ 2D: ba khối lệnh lớn nối mũi tên ngang, mỗi khối tên script `mono` + 2 đến 3 dòng việc:
  `nap_dfu.py` (hỏi tên bo qua MSP · vào DFU không bấm BOOT · kiểm RDP 0xAA · sao lưu flash gốc · ghi + đọc lại so từng byte),
  `kiem_fc.py` (banner · cảm biến · hướng gyro đúng dấu · chụp 850 tham số), `nap_param.py` (nạp `.param` · reboot · đọc
  lại từng dòng · 34/34). Khối 1 đỏ, khối 2 xanh, khối 3 xanh lá. Dưới khối 1 dòng nhỏ "STM32CubeProgrammer CLI". Nguồn: F02 mục 2.
- F11, biểu đồ native doughnut: 2 lát "Firmware 759 588 B" (đỏ `BB2025`) và "Còn trống 239 820 B" (xám `DDE1E6`), giữa
  vòng chữ "1 MB flash · trống 24 %". Nguồn: `firmware/ardupilot/build-d450a747/NOTES.md` dòng 71 đến 74 (F02 mục 1).

**Hiệu ứng**: 3 khối F10 `wipe-r` stagger 300 ms → F11 `zoom` → 2 thẻ `rise` → 3 dòng số `fade` stagger 100 ms.

**Nguồn**: F02 mục 1 (yaml custom build dòng 5 đến 30, NOTES.md); F02 mục 2 (`docs/so-tay/14-hang-ve-nap-firmware.md` mục 1, 2).
Tỉ lệ 24 % = 239 820 / 999 424.

**Ghi chú người nói**: Bo F405 chỉ có 1 MB flash, và bản ArduCopter dựng sẵn cho bo này không có nhóm tính năng
Proximity, tức là không dùng được LiDAR để tránh vật cản. Nhóm em dựng bản riêng trên custom.ardupilot.org: bật sáu tính
năng cần cho tránh vật cản và ước lượng gió, tắt các phần cho bay FPV và các giao thức tay cầm không dùng. Kết quả là 54
tính năng, firmware chiếm khoảng 760 nghìn byte, còn trống 24 % flash. Việc nạp chỉ có ba lệnh. Script thứ nhất kiểm đúng
tên bo, đưa bo vào DFU bằng lệnh phần mềm, sao lưu flash gốc, ghi firmware và đọc lại so từng byte. Script thứ hai kiểm
cảm biến và hướng gyro. Script thứ ba nạp file tham số rồi đọc lại; bo thật nhận đủ 34 trên 34 dòng.

**Để học**:
- Custom build vì cần Proximity cho TFmini mà flash chỉ 1 MB.
- 54 tính năng, còn trống 24 % flash.
- Ba script: nạp DFU, kiểm FC, nạp tham số; mỗi bước đều đọc lại để xác nhận.
- Giải thích: DFU là chế độ nạp có sẵn trong ROM của chip STM32, hoạt động kể cả khi flash trống. Thông thường phải giữ
  nút BOOT khi cắm cáp; ở đây script gửi lệnh MSP_REBOOT để bo tự vào DFU. Sau khi ghi, công cụ đọc ngược toàn bộ vùng
  vừa ghi và so từng byte, nên một lần nạp hỏng sẽ báo lỗi ngay chứ không để drone chạy firmware lệch. Với tham số cũng
  vậy: có tham số chỉ hiện sau khi khởi động lại, nên script tự khởi động lại và nạp tiếp tới khi đọc lại khớp.
- Thuật ngữ: **DFU** (Device Firmware Upgrade), **custom build** (firmware dựng với danh sách tính năng tự chọn), **RDP** (mức khoá đọc flash của STM32).

---

## S11 · Phần 3 · Firmware

**Tiêu đề**: DroneBridge 115 200 baud ↔ UDP; camera VGA 7,6 khung/s qua Wi-Fi

**Bố cục**: hai cột. Trái (1,0; 1,6; 8,7; 8,9): thẻ DroneBridge, ảnh `dbesp32_webinterface.png` (1,0; 1,6; 8,7; 3,6),
dưới là 6 dòng thông số. Phải (10,2; 1,6; 8,7; 8,9): F12 (10,2; 1,6; 3,6; 3,6), cạnh ảnh 5 dòng thông số
(14,0; 1,6; 4,9; 3,6), dưới cùng F13 (10,2; 5,5; 8,7; 4,9).

**Khối nội dung**:
- Cột trái tiêu đề nhỏ **ESP32 DroneBridge** (xanh), 6 dòng:
  - ESP32-D0WD, flash 4 MB, firmware DroneBridge 2.4.1
  - UART: TX GPIO17, RX GPIO16, **115 200 baud**, gói 576 byte
  - Wi-Fi STA vào hotspot laptop, tên `DroneBridgeESP32.mshome.net`
  - Đẩy UDP tới `192.168.137.1:14550`
  - Cấu hình ghi thẳng vào NVS qua USB bằng `dronebridge-nvs.ps1`
  - Backend chào bo mỗi 2 s; bo trả gói đầu sau 0,27 s
- Cột phải tiêu đề nhỏ **Camera ESP32-S3 + OV3660** (hổ phách), 5 dòng:
  - PlatformIO, Arduino core, PSRAM 8 MB giữ 2 khung
  - XCLK 10 MHz, VGA 640×480, JPEG chất lượng 12
  - `/stream` cổng 81; `/status`, `/set` cổng 80
  - Nạp qua USB hoặc Wi-Fi (OTA): 793 KB trong ~6,5 s
  - Kiểm: 150/150 khung sạch, **7,6 khung/s**, RSSI −28 dBm
- Chú thích F13: Backend tự tăng số chất lượng khi dưới 4 khung/s (tối đa 40), khung nhỏ đi ~37 %.

**Hình**:
- F12, ảnh `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg`, cắt vuông quanh bo; có tem shop thì cắt khỏi khung.
- F13, biểu đồ native line: trục X "chất lượng JPEG" 12, 19, 26, 30, 33, 40, 50 (bỏ điểm 63 vì nằm ngoài dải dùng 12 đến 40);
  trục Y "KB/khung" 0 đến 16. Đường đỏ có điểm tròn, nhãn số ở 12 (15,2) và 40 (9,5). Tô nền xanh nhạt `EAF0FC` vùng
  12 đến 40 nhãn "dải tự chỉnh". Nguồn: `D/jpeg-quality-kich-thuoc-20261115.csv`, cột `jpeg_quality`, `kb_moi_khung`, 7 dòng đầu.

**Hiệu ứng**: cột trái `rise` → cột phải `rise` → F13 `wipe-r` 800 ms → chú thích `fade`.

**Nguồn**: DroneBridge F02 mục 7 (`firmware/dronebridge/README.md`, `db_params.iotcv.csv`, `backend/config.py` dòng 90 đến 97);
0,27 s F04 mục 4; camera F02 mục 8 (`firmware/camera/platformio.ini`, `src/main.cpp` dòng 22 đến 33, `README.md`);
150/150, 7,6 khung/s `plans/reports/261115-kiem-phan-cung-that.md` mục 1; tự chỉnh F03 mục 3.7.

**Ghi chú người nói**: Hai bo ESP32 chạy hai firmware khác nhau. Bo cầu MAVLink dùng DroneBridge, một firmware mã nguồn
mở được tài liệu ArduPilot giới thiệu. Nhóm em không tự viết phần này vì DroneBridge đã lo việc nối lại, đệm gói và có
giao diện web cấu hình. Bo đọc UART 115 200 baud từ bo bay, đóng gói tối đa 576 byte rồi đẩy UDP về laptop. Cấu hình được
ghi thẳng vào vùng NVS bằng script để mật khẩu hotspot không nằm trong repo. Bo camera thì nhóm em tự viết firmware trên
PlatformIO: chạy XCLK 10 MHz để giữ Wi-Fi của bo sạch, phát VGA MJPEG ở cổng 81 và nạp lại được qua Wi-Fi. Lúc kiểm, camera
gửi 150 trên 150 khung sạch ở 7,6 khung mỗi giây. Biểu đồ dưới cho thấy tăng số chất lượng từ 12 lên 40 thì mỗi khung nhẹ
hơn khoảng 37 %.

**Để học**:
- DroneBridge: firmware có sẵn, nhóm chỉ cấu hình.
- Camera: firmware tự viết, MJPEG cổng 81, OTA.
- Số chất lượng JPEG càng lớn thì khung càng nhẹ và càng mờ; backend tự chỉnh 12 đến 40.
- Giải thích: trong JPEG của thư viện ESP32, "quality" là chỉ số nén ngược: 12 là nét, 40 là nén mạnh. Khi drone bay xa,
  sóng yếu làm số khung/s giảm. Backend đo khung/s trong cửa sổ 5 giây; dưới 4 khung/s thì tăng chỉ số thêm 7 qua lệnh
  `/set?quality=N`, trên 6,5 khung/s liền 10 giây thì hạ dần về 12. Đổi nhẹ khung thay vì đổi độ phân giải giúp AI luôn
  nhận ảnh cùng kích thước 640×480. Bo camera giữ hai khung trong PSRAM và luôn gửi khung mới nhất, nên người xem không thấy hình cũ dồn lại.
- Thuật ngữ: **NVS** (vùng nhớ lưu cấu hình của ESP32), **OTA** (nạp firmware qua mạng), **PSRAM** (RAM ngoài, đủ chứa khung ảnh).

---

## S12 · Phần 3 · Firmware

**Tiêu đề**: 11 công cụ PC và 51 script lo mọi việc trên laptop

**Bố cục**: trái (1,0; 1,6; 9,4; 8,9): bảng công cụ 11 dòng. Phải (10,8; 1,6; 8,1; 8,9): 5 thẻ nhóm script xếp dọc
(8,1 × 1,6 in), mỗi thẻ có số lớn bên trái.

**Khối nội dung**:
- Bảng (Công cụ | Việc trong dự án):

| Công cụ | Việc |
|---|---|
| Mission Planner 1.3.83 | hiệu chỉnh, Motor Test (người vận hành bấm) |
| STM32CubeProgrammer 2.23.0 | nạp ArduPilot qua DFU |
| MAVProxy 1.8.74 | chia cổng USB cho nhiều chương trình |
| pymavlink | thư viện MAVLink cho backend và script |
| PlatformIO 6.2.0 | build và nạp firmware camera |
| esptool 5.4.0 | nạp DroneBridge |
| WSL2 Ubuntu 24.04 + SITL | drone ảo ArduCopter 4.7.1 |
| Python 3.13 + uv | backend FastAPI, script |
| Node.js 24 + pnpm 11 | build web React |
| ONNX Runtime GPU 1.24.4 | chạy model AI trên CUDA |
| `cua-driver` + Playwright | tự động bấm GUI và kiểm web |

- 5 thẻ script:
  - **11** · `scripts/fc/` · nạp, kiểm FC, kiểm phần cứng, tải và phân tích log
  - **12** · `scripts/esp32/` · nạp camera, cấu hình DroneBridge, hotspot, tường lửa
  - **14** · `scripts/sitl/` · harness + runner drone ảo
  - **5** · `scripts/vision/` · lấy và kiểm model, đo ms
  - **9** · laptop, gốc và khác · chế độ bay cho laptop, dò WebSocket, dead-man

**Hình**: F14, lưới logo nhỏ ở đầu bảng (cao 0,45 in): Python, React, TypeScript, GitHub, Docker, Ubuntu, Linux (icons có
trong `build/assets/icons/`: `b_react`, `b_typescript`, `b_github`, `b_docker`, `b_ubuntu`, `b_linux`; Python dùng chip chữ
nếu thiếu). Không phải biểu đồ.

**Hiệu ứng**: hàng logo `float` stagger 60 ms → bảng `wipe-d` 700 ms → 5 thẻ `rise` stagger 120 ms.

**Nguồn**: F02 mục 9 (`plans/PROGRESS.md` dòng 54, 100; `pyproject.toml`); 51 script và từng nhóm F02 mục 10 (đếm
`ls scripts/*/` ngày 26/11/2026). Nhóm "9" = `laptop` 1 + gốc và thư mục khác 8.

**Ghi chú người nói**: Đây là các công cụ trên laptop. Mission Planner chỉ dùng cho hiệu chỉnh cảm biến và Motor Test,
những việc cần người vận hành nhìn và bấm. STM32CubeProgrammer nạp firmware, MAVProxy chia một cổng USB của bo bay cho
nhiều chương trình cùng lúc. Backend viết bằng Python 3.13, web viết bằng React, model AI chạy bằng ONNX Runtime trên GPU.
Bên phải là phần nhóm em coi trọng: 51 script tự động hoá. Nạp firmware, đọc ghi tham số, kiểm toàn bộ phần cứng, tải log,
bật hotspot, chỉnh chế độ nguồn cho laptop trước buổi bay đều là một lệnh. Phần mềm có giao diện như Mission Planner thì
điều khiển qua `cua-driver`, đọc cây giao diện rồi mới bấm, sau đó kiểm lại trạng thái. Riêng các nút làm motor quay thì
người vận hành tự bấm.

**Để học**:
- Mission Planner chỉ cho hiệu chỉnh và Motor Test.
- 51 script chia 5 nhóm; nhóm SITL nhiều nhất (14).
- Nút làm motor quay luôn do người bấm.
- Giải thích: tự động hoá bằng script có hai lợi ích. Một là lặp lại được: nạp lại firmware hay kiểm phần cứng lần thứ
  mười giống hệt lần đầu. Hai là có bằng chứng: script in ra số đo và mã thoát, ghi được vào báo cáo. MAVProxy hữu ích vì
  một cổng USB nối tiếp chỉ mở được bởi một chương trình; MAVProxy giữ cổng rồi phát lại luồng MAVLink ra nhiều cổng UDP,
  nên Mission Planner và script ghi số đo chạy cùng lúc.
- Thuật ngữ: **MAVProxy** (trạm mặt đất dòng lệnh, chuyển tiếp MAVLink), **uv** (công cụ quản lý môi trường Python), **pnpm** (trình quản lý gói Node).

---

## S13 · Phần 4 · Cấu hình

**Tiêu đề**: Rào ảo 100 m, trần 20 m, mất sóng RC hay pin 14,0 V là tự về

**Bố cục**: trái (1,0; 1,6; 9,6; 8,9): F15. Phải (11,0; 1,6; 7,9; 7,2): bảng 9 dòng. Dưới phải (11,0; 9,0; 7,9; 1,4): thẻ đỏ nhạt 1 dòng.

**Khối nội dung**:
- Bảng (Tình huống | Tham số | Drone làm gì):

| Tình huống | Tham số | Phản ứng |
|---|---|---|
| Ra quá 100 m quanh home | `FENCE_RADIUS 100` | RTL |
| Lên quá 20 m | `FENCE_ALT_MAX 20`, lề 2 m | chặn leo ở 18 m; vượt thì RTL |
| Mất sóng tay cầm | `FS_THR_ENABLE 1`, ngưỡng 975 µs | RTL |
| Pin dưới 14,0 V đủ 10 s | `BATT_FS_LOW_ACT 2` | RTL |
| Pin dưới 13,2 V | `BATT_FS_CRT_ACT 1` | LAND |
| EKF hỏng | `FS_EKF_ACTION 1` | LAND |
| Mất Wi-Fi | `FS_GCS_ENABLE 0` | không đổi, vẫn nghe RC |
| Độ cao về nhà | `RTL_ALT_M 15` | leo/giữ 15 m rồi về |
| Motor chưa đủ vòng khi ARM | `TKOFF_RPM_MIN 1000` | giữ vòng chờ, chưa cất cánh |

- Thẻ đỏ nhạt: Tốc độ Loiter và mission giới hạn **3 m/s** (`LOIT_SPEED_MS`, `WP_SPD`).

**Hình**: F15, TikZ 3D. Mặt đất là lưới phẳng xám nhạt phối cảnh. Hình trụ trong suốt đỏ `BB2025` (độ mờ 15 %, viền đỏ
đậm) bán kính nhãn "100 m", chiều cao nhãn "20 m"; một mặt phẳng ngang nét đứt hổ phách ở 18 m nhãn "lề 2 m"; một mặt
ngang xanh `326CE5` ở 15 m nhãn "RTL 15 m". Tâm đáy chấm navy "home". Một drone nhỏ gần thành trụ có mũi tên cong quay về
home nhãn "RTL". Góc trái dưới chú giải 3 màu. Không vẽ vòng 95 m (để slide S21). Nguồn: F02 mục 4.4.

**Hiệu ứng**: F15 `zoom` 800 ms → bảng `wipe-d` 700 ms → thẻ đỏ `fade`.

**Nguồn**: F02 mục 4.2, 4.3, 4.4 (`01-base.param` dòng 108 đến 174, `02-avoid-tfmini.param` dòng 81 đến 106, [SNAP]
`snapshot-20261115-kiem-phan-cung.param`); `TKOFF_RPM_MIN` F02 mục 4.1.

**Ghi chú người nói**: Slide này là lưới an toàn nằm ngay trong bo bay, tức là vẫn hoạt động kể cả khi laptop tắt. Hình
trụ bên trái là rào ảo: bán kính 100 mét quanh điểm cất cánh và trần 20 mét. Khi người lái đẩy cần lên, bo bay chặn leo
ở 18 mét vì có lề 2 mét; nếu vẫn vượt rào thì drone tự bay về. Bảng bên phải liệt kê các tình huống. Mất sóng tay cầm thì
về nhà. Pin dưới 14 vôn đủ 10 giây thì về nhà, dưới 13,2 vôn thì hạ tại chỗ. Mất Wi-Fi thì nhóm em cố ý không làm gì, vì
tay cầm mới là đường lái chính. Khi về nhà, drone lên 15 mét, thấp hơn trần, rồi mới bay ngang. Thêm một chốt khi ARM: bốn
ESC phải báo đủ 1 000 vòng mỗi phút thì bo bay mới cho cất cánh.

**Để học**:
- Rào trụ: 100 m bán kính, 20 m trần, lề 2 m.
- Mất RC hoặc pin thấp → RTL; pin rất thấp hoặc EKF hỏng → LAND.
- Mất Wi-Fi không kích failsafe, có chủ ý.
- Giải thích: failsafe là phản ứng tự động khi một điều kiện an toàn bị vi phạm. Đặt các phản ứng này trong firmware
  thay vì trong backend vì firmware chạy trên chính drone với vòng lặp hàng trăm lần mỗi giây, không phụ thuộc mạng.
  Ngưỡng 975 µs đặt thấp hơn mọi giá trị tay cầm gửi lúc bình thường; khi mất sóng, bộ thu được cài để đẩy kênh ga
  xuống 911 µs, bo bay thấy dưới ngưỡng nên biết là mất sóng.
- Thuật ngữ: **geofence** (rào ảo), **failsafe** (phản ứng an toàn tự động), **EKF** (bộ lọc Kalman mở rộng ước lượng vị trí và tư thế).

---

## S14 · Phần 4 · Cấu hình

**Tiêu đề**: Tay cầm FS-i6X: 5 công tắc, 3 chế độ tay, ARM ở SwB

**Bố cục**: trái (1,0; 1,6; 9,0; 8,9): F16. Phải (10,4; 1,6; 8,5; 5,6): 5 thẻ công tắc (8,5 × 1,0 in, khe 0,12).
Dưới phải (10,4; 7,5; 8,5; 2,9): thẻ "Kiểm 15/11" với 3 dòng số.

**Khối nội dung**:
- 5 thẻ (chip kênh | công tắc | chức năng):
  - `CH5` · **SwC 3 nấc** · lên Stabilize · giữa AltHold · xuống Loiter
  - `CH6` · **SwD** · xuống = RTL
  - `CH7` · **SwA** · bật quyền lái cho web (backend đọc)
  - `CH8` · **SwB** · ==xuống ARM, lên DISARM==
  - `CH9` · **Núm VrB** · xoay quá ~1 800 µs = AUTO, lùi về = chế độ của SwC
- Thẻ kiểm 15/11:
  - 4 cần đủ 1 000 đến 2 000 µs, về giữa 1 498 đến 1 501 µs
  - Tắt tay phát: CH3 xuống 911 µs, FC báo `Radio Failsafe` < 0,1 s
  - VrB: qua 1 831 µs vào AUTO, xuống 1 779 µs về Stabilize

**Hình**: F16, TikZ 2D trên nền ảnh `D:\Coding\IOT-CV\assignment\_build\img\official\flysky\fs_2.png` (giữa vùng trái,
cao 6,5 in). Năm đường chú thích (leader line) từ vị trí công tắc trên ảnh ra nhãn màu: SwA xanh `326CE5`, SwB đỏ
`BB2025` (đậm, có icon khoá), SwC navy, SwD xanh lá `15803D`, VrB hổ phách `B45309`. Hai cần gạt nhãn "ga / xoay" và
"tiến lùi / nghiêng". Nguồn: F02 mục 5.

**Hiệu ứng**: ảnh tay cầm `fade` → 5 đường chú thích `wipe-l` stagger 150 ms → 5 thẻ `rise` stagger 100 ms → thẻ kiểm `fade`.

**Nguồn**: F02 mục 5 ([SNAP] `FLTMODE_CH`, `FLTMODE1/4/6`, `RC6..10_OPTION`); kiểm 15/11 F04 mục 1 "Tay cầm"
(`plans/reports/261115-kiem-phan-cung-that.md` mục 3).

**Ghi chú người nói**: Tay phát FS-i6X có bốn công tắc và hai núm xoay; nhóm em dùng năm. Công tắc SwC ba nấc chọn ba chế
độ lái tay: Stabilize là lái hoàn toàn bằng tay, AltHold giữ độ cao, Loiter giữ cả vị trí bằng GPS. SwD gạt xuống là drone
tự bay về. SwA cho phép web lái; công tắc này bo bay không dùng, backend đọc giá trị kênh để biết người cầm tay cầm có đồng
ý giao quyền hay không. SwB là công tắc ARM: gạt xuống thì motor được phép quay, gạt lên là motor tắt, nên khi đang bay
tuyệt đối không chạm vào. Núm VrB xoay hết thì vào AUTO để bay mission. Lần kiểm ngày 15/11 cho thấy đủ dải tín hiệu và
failsafe báo trong chưa tới 0,1 giây.

**Để học**:
- SwC: Stabilize, AltHold, Loiter. SwD: RTL. VrB: AUTO.
- SwB là ARM; gạt lên khi bay là motor tắt.
- SwA là chốt đồng ý cho web lái.
- Giải thích: ba chế độ lái tay khác nhau ở phần bo bay tự lo. Stabilize chỉ giữ thăng bằng, người lái tự giữ độ cao và
  vị trí. AltHold dùng baro để giữ độ cao, người lái chỉ lo hướng. Loiter thêm GPS để giữ cả vị trí, thả tay là drone đứng
  yên. Người mới nên cất cánh ở Loiter. Gán ARM vào một công tắc riêng thay vì gạt cần giúp tắt motor rất nhanh khi cần,
  nhưng cũng là lý do phải nhớ không chạm SwB lúc bay.
- Thuật ngữ: **ARM** (cho phép motor quay), **AltHold / Loiter** (giữ độ cao / giữ vị trí), **kênh RC** (giá trị 1 000 đến 2 000 µs cho mỗi cần hay công tắc).

---

## S15 · Phần 4 · Cấu hình

**Tiêu đề**: 5 bước hiệu chỉnh, scale accel lệch ≤ 0,35 %, la bàn khớp 0,5 %

**Bố cục**: F17 dải 5 ô ngang (1,0; 1,7; 17,9; 6,2), mỗi ô 3,4 × 6,2 in có mũi tên nối. Dưới (1,0; 8,3; 17,9; 2,1): 2 thẻ
cạnh nhau (8,85 × 2,1 in).

**Khối nội dung**:
- 5 ô F17 (tên · cách làm · kết quả):
  1. **Accel 6 mặt** · đặt drone 6 tư thế · scale 1,0013 / 1,0035 / 1,0002, lệch ≤ 0,35 %
  2. **Level** · đặt trên mặt phẳng · nằm yên đọc pitch −0,11°, roll +0,12°
  3. **La bàn ngoài trời** · xoay mọi hướng · offset 67 (chặn khi > 1 800), `COMPASS_SCALE` 1,005, khớp mô hình WMM 0,5 %
  4. **Radio** · gạt hết cần · `RC3_MIN` 1 006 > ngưỡng failsafe + 10
  5. **ESC OX32** · cấu hình cho motor KV thấp · 41 lần khởi động, 0 lần khựng, lệch vòng ≤ 2,8 %
- Thẻ trái: **Người bấm, máy kiểm** · Người vận hành làm theo hướng dẫn trong Mission Planner; agent đọc lại toàn bộ
  tham số sau mỗi bước và đối chiếu.
- Thẻ phải: **GPS ngoài trời** · fix 3D, 18 vệ tinh, HDOP 0,65; khi bay 15 đến 28 vệ tinh, HDOP ≤ 0,89.

**Hình**: F17, TikZ 2D: 5 ô bo tròn nối mũi tên, mỗi ô có icon vẽ đơn giản phía trên (hộp lập phương 6 mặt; mặt phẳng
+ bọt thuỷ; la bàn tròn có kim; tay cầm; motor với vòng quay). Ô nền trắng viền `DDE1E6`, dải màu đầu ô: 1, 2 xanh
`326CE5`, 3 xanh lá `15803D`, 4 hổ phách `B45309`, 5 đỏ `BB2025`. Con số kết quả in đậm 20 pt ở đáy ô. Nguồn: F02 mục 6.

**Hiệu ứng**: 5 ô `rise` stagger 180 ms → mũi tên `wipe-r` → 2 thẻ `fade`.

**Nguồn**: F02 mục 6 ([SNAP]; `plans/reports/261025-hieu-chinh-bay-trong-nha.md` mục 2;
`plans/reports/261101-cau-hinh-bay-ngoai-troi.md` mục 6, 8; `firmware/esc-ox32/README.md`;
`plans/reports/261115-kiem-phan-cung-that.md` mục 1, 2); vệ tinh khi bay `D/chat-luong-bay.csv` cột `ve_tinh_it_nhat`,
`hdop_max` (F04 mục 1).

**Ghi chú người nói**: Trước khi bay phải hiệu chỉnh năm thứ. Accel hiệu chỉnh bằng cách đặt drone sáu tư thế; hệ số
scale ba trục lệch không quá 0,35 % so với 1. Level là cho bo bay biết thế nào là nằm ngang; sau hiệu chỉnh, drone nằm
yên đọc lệch khoảng một phần mười độ. La bàn phải hiệu chỉnh ngoài trời, xa sắt thép; offset đạt 67, rất xa ngưỡng 1 800
mà bo bay chặn ARM, và cường độ từ trường khớp mô hình địa từ trong 0,5 %. Radio để bo bay biết dải của từng cần. ESC được
chỉnh thông số cho motor KV thấp, sau đó 41 lần khởi động không lần nào khựng. Cách làm chung: người vận hành bấm trong
Mission Planner, còn agent đọc lại tham số để xác nhận.

**Để học**:
- Thứ tự: accel, level, la bàn, radio, ESC.
- La bàn hiệu chỉnh ngoài trời.
- Mỗi bước có một số đo xác nhận.
- Giải thích: cảm biến MEMS rẻ có sai số riêng của từng con chip. Hiệu chỉnh accel đo vector trọng lực ở sáu hướng để
  tìm offset và scale của từng trục. La bàn bị nhiễu bởi kim loại và dòng điện gần nó (nhiễu "hard iron"), xoay drone đủ
  mọi hướng cho phép tính phần nhiễu cố định đó rồi trừ đi. WMM là mô hình từ trường Trái Đất; số đo khớp mô hình nghĩa
  là la bàn không bị nhiễu thêm. HDOP thấp (dưới 1) nghĩa là vệ tinh phân bố tốt, vị trí GPS chính xác.
- Thuật ngữ: **offset / scale** (độ lệch gốc / hệ số nhân của cảm biến), **HDOP** (hệ số suy giảm độ chính xác ngang), **WMM** (World Magnetic Model).

---

## S16 · Phần 5 · MAVLink

**Tiêu đề**: Xin 10 loại gói 1 đến 10 Hz, bỏ HEARTBEAT không phải của FC

**Bố cục**: trên (1,0; 1,6; 17,9; 4,1): F18. Dưới trái (1,0; 6,0; 10,4; 4,5): bảng 10 dòng. Dưới phải (11,8; 6,0; 7,1; 4,5):
2 thẻ xếp dọc.

**Khối nội dung**:
- Bảng (ID | Gói | Hz | Dùng cho), cỡ chữ 13 pt:

| ID | Gói | Hz | Dùng cho |
|---|---|---|---|
| 0 | HEARTBEAT | 1 | chế độ, ARM, mất liên kết |
| 1 | SYS_STATUS | 2 | sức khoẻ cảm biến |
| 24 | GPS_RAW_INT | 2 | fix, số vệ tinh |
| 30 | ATTITUDE | 10 | chân trời giả |
| 33 | GLOBAL_POSITION_INT | 5 | vị trí bản đồ |
| 74 | VFR_HUD | 5 | tốc độ, tốc độ leo |
| 132 | DISTANCE_SENSOR | 5 | khoảng cách TFmini |
| 147 | BATTERY_STATUS | 1 | dòng, % pin |
| 193 | EKF_STATUS_REPORT | 2 | EKF ổn |
| 330 | OBSTACLE_DISTANCE | 5 | nhánh cho cảm biến 360° |

- Thẻ 1 **Lọc HEARTBEAT**: cổng 14550 nhận HEARTBEAT từ 3 nguồn: FC (1,1), bo DroneBridge (1,68) và GCS. Backend chỉ tin
  gói có `autopilot` khác `INVALID`, nên chế độ và trạng thái ARM luôn là của FC.
- Thẻ 2 **Lệnh đi xuống**: `COMMAND_LONG` (mode, ARM, cất cánh, RTL, LAND) chờ `COMMAND_ACK` tối đa 3 s;
  `SET_POSITION_TARGET_LOCAL_NED` cho lái tay bằng vận tốc; bộ gói `MISSION_*` cho mission.

**Hình**: F18, TikZ 2D ngang. Trái: khối FC navy. Mũi tên "UART2 · MAVLink2 · 115 200" tới khối ESP32 xanh. Mũi tên Wi-Fi
"UDP 14550" tới khối "Cổng lọc" hình phễu đỏ `BB2025` trong backend; ba gói HEARTBEAT nhỏ đi vào phễu, nhãn (1,1) xanh lá
có dấu tích, (1,68) và (255,…) xám có dấu gạch chéo nhãn "autopilot = INVALID". Ra khỏi phễu: khối "telemetry 8 Hz" →
"WebSocket /ws" → trình duyệt. Mũi tên ngược màu hổ phách "lệnh + chờ ACK 3 s" từ web về FC. Một nhánh mũi tên mảnh
"`SET_MESSAGE_INTERVAL` sau mỗi lần nối lại" từ backend về FC. Nguồn: F03 mục 3.1 đến 3.3.

**Hiệu ứng**: F18 `wipe-r` 1 000 ms → bảng `wipe-d` → thẻ 1 `rise` → thẻ 2 `rise`.

**Nguồn**: `backend/mavlink/connection.py` dòng 49 đến 73, 285 đến 314; `backend/mavlink/telemetry.py` dòng 183 đến 194;
`backend/config.py` dòng 102 đến 105, 135 (F03 mục 1, 3.1 đến 3.3).

**Ghi chú người nói**: MAVLink giữa bo bay và laptop gồm các gói nhị phân có mã số. Mỗi lần nối hoặc nối lại, backend gửi
lệnh SET_MESSAGE_INTERVAL để xin đúng mười loại gói trong bảng với tần số cần dùng: tư thế 10 lần mỗi giây cho chân trời
giả, vị trí và khoảng cách TFmini 5 lần, pin 1 lần. Như vậy không tốn băng thông Wi-Fi cho gói không dùng. Thẻ bên phải
là một chi tiết quan trọng. Cổng UDP 14550 nhận HEARTBEAT từ nhiều nguồn, trong đó bo DroneBridge cũng tự phát HEARTBEAT
mượn mã hệ thống của bo bay. Nếu chỉ lọc theo mã hệ thống, web sẽ hiển thị sai chế độ bay. Backend bỏ mọi HEARTBEAT có
trường autopilot là INVALID. Chiều xuống, mỗi lệnh đều chờ bo bay xác nhận tối đa 3 giây.

**Để học**:
- 10 loại gói, xin nhịp bằng `SET_MESSAGE_INTERVAL`.
- HEARTBEAT 1 Hz cho chế độ và ARM; ATTITUDE 10 Hz.
- Lọc HEARTBEAT theo trường `autopilot`; sysid của bo cầu nối trùng với FC.
- Giải thích: mỗi thiết bị MAVLink có cặp mã (system id, component id). Bo bay là (1,1). HEARTBEAT là gói "tôi còn sống"
  gửi mỗi giây, kèm loại thiết bị, chế độ bay và trạng thái ARM. Bo cầu nối cũng phát HEARTBEAT để báo nó còn sống, nhưng
  nó không phải autopilot nên điền `MAV_AUTOPILOT_INVALID`. Trạm mặt đất đọc nhầm gói này sẽ tưởng drone đổi chế độ liên
  tục. Lọc theo trường autopilot là cách phân biệt chắc chắn. Mọi lệnh COMMAND_LONG có phản hồi COMMAND_ACK, nên web biết
  lệnh được nhận hay bị từ chối.
- Thuật ngữ: **HEARTBEAT** (gói nhịp tim 1 Hz), **sysid / compid** (mã hệ thống / mã thành phần), **COMMAND_ACK** (gói xác nhận lệnh).

---

## S17 · Phần 5 · MAVLink

**Tiêu đề**: Mạng ngoài bãi: 0/150 gói mất, camera 9,2 khung/s, MAVLink tới 49 m

**Bố cục**: trái (1,0; 1,6; 8,0; 5,0): F19. Dưới trái (1,0; 6,9; 8,0; 3,6): 3 ô số ngang. Phải trên (9,4; 1,6; 9,5; 4,3):
F20. Phải dưới (9,4; 6,1; 9,5; 4,4): F21.

**Khối nội dung**:
- 3 ô số:
  - **0/150** · gói ping mất ở cả 2 bo khi đứng đất
  - **9,2** · khung/s camera, cùng phép đo
  - **3,9 %** · mất gói MAVLink trung vị mỗi chuyến, xa tới ~49 m
- Chú thích F19 (14 pt): iPhone cấp internet qua cáp USB; card Wi-Fi laptop chỉ phát hotspot và tắt quét nền
  (`che_do_bay.ps1 -Bat`).
- Tiêu đề nhỏ F20: Camera khung/s theo khoảng cách tới home (02/11)
- Tiêu đề nhỏ F21: RSSI DroneBridge theo khoảng cách, chuyến 10:14

**Hình**:
- F19, TikZ 2D: iPhone (trái) nối cáp USB nét liền xám tới laptop (giữa, nhãn "Mobile Hotspot `IOTCV-HOTSPOT` 2,4 GHz ·
  192.168.137.1"); từ laptop 2 cung sóng xanh `326CE5` tới "ESP32 DroneBridge" và hổ phách `B45309` tới "Camera ESP32-S3";
  nhãn tên mạng `DroneBridgeESP32.mshome.net`, `iotcv-camera.mshome.net`. Một chú thích nhỏ trên laptop "không nối Wi-Fi
  nào khác". Nguồn: F03 mục 8.
- F20, biểu đồ native bar dọc, 4 cột hổ phách `B45309`: 0…5 m 7,8; 5…15 m 7,6; 15…25 m 3,1; > 25 m 1,8 khung/s; nhãn số trên
  cột; trục Y 0 đến 9. Nguồn: `D/camera-fps-theo-khoang-cach-20261102.csv`, cột `khoang_cach_home`, `fps_tb` (đổi nhãn
  gạch ngang trong cột `khoang_cach_home` thành "0…5 m" khi vẽ).
- F21, biểu đồ native scatter: X = `dist_home_m` (0 đến 50), Y = `rssi_dbm` (−95 đến −55), điểm xanh `326CE5` cỡ 4, chỉ lấy
  dòng có cả hai cột; đường ngang nét đứt đỏ ở −90 dBm nhãn "gần ngưỡng mất". Nguồn: `D/chuoi-20261102-101435.csv`.

**Hiệu ứng**: F19 `fade` → 3 ô số `zoom` stagger 120 ms → F20 `wipe-u` 700 ms → F21 `fade` 700 ms.

**Nguồn**: 0/150, 9,2 khung/s `docs/so-tay/12-hotspot-laptop.md` dòng 184 đến 185 (F03 mục 8;
`D/mang-hotspot-cau-hinh-20261102.csv` dòng cuối); 3,9 % và 49 m `plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md`
mục 5, 11.1, cột `link_loss_pct` của `D/chuyen-bay-tom-tat.csv` (F04 mục 4); khung/s theo khoảng cách F04 mục 4.

**Ghi chú người nói**: Ngoài bãi bay không có Wi-Fi nhà, nên laptop phát một mạng hotspot 2,4 GHz cho cả hai bo ESP32.
Internet cho laptop lấy từ iPhone qua cáp USB, để card Wi-Fi chỉ làm một việc là phát hotspot, và nhóm em tắt chế độ tự
quét mạng của card bằng một script trước buổi bay. Với cấu hình này, ping hai bo 150 lần không mất gói nào và camera đạt
9,2 khung mỗi giây khi đứng gần. Khi bay, biểu đồ trên cho thấy camera giữ gần 8 khung mỗi giây trong 15 mét đầu rồi giảm
dần khi ra xa. Biểu đồ dưới là cường độ sóng của bo DroneBridge trong chuyến bay xa nhất: ở gần 50 mét RSSI xuống khoảng
âm 90 dBm. MAVLink vẫn dùng được tới khoảng 49 mét, mất trung vị 3,9 % gói mỗi chuyến.

**Để học**:
- Laptop phát hotspot; internet từ iPhone qua cáp.
- Đứng đất 0/150 gói mất; camera tốt nhất trong 15 m.
- MAVLink dùng được tới ~49 m; ngoài tầm Wi-Fi thì tay cầm RC lo.
- Giải thích: card Wi-Fi laptop chỉ có một radio. Nếu vừa nối mạng ngoài vừa phát hotspot, nó phải chia thời gian phát
  giữa hai việc, và mỗi lần tự quét mạng mới nó ngừng phát vài giây. Cho card chỉ phát hotspot và tắt quét nền giữ sóng
  liên tục cho hai bo. RSSI là cường độ tín hiệu tính bằng dBm, càng gần 0 càng mạnh; dưới khoảng −90 dBm thì gói bắt
  đầu rơi nhiều. Video MJPEG cần khoảng 1,6 Mbit/s cho 8 khung/s nên nhạy với sóng yếu hơn telemetry.
- Thuật ngữ: **hotspot** (laptop làm điểm phát Wi-Fi), **RSSI** (cường độ tín hiệu nhận), **mất gói** (tỉ lệ gói gửi đi không tới).

---

## S18 · Phần 6 · Trạm mặt đất

**Tiêu đề**: Backend FastAPI 11 671 dòng: 19 REST, 1 WebSocket, 10 loại lệnh

**Bố cục**: trái (1,0; 1,6; 11,0; 8,9): F22. Phải (12,4; 1,6; 6,5; 8,9): 4 thẻ dọc (6,5 × 2,1 in).

**Khối nội dung**:
- 4 thẻ:
  - **WebSocket `/ws`** · phong bì `{v, type, ts, id?, data}` · 10 loại lệnh lên, 7 loại message xuống · 12 mã lỗi;
    message hỏng chỉ trả `error`, không đóng socket
  - **Trần nhịp lệnh** · `cmd.velocity` 30/s · `cmd.arm` 2/s · `cmd.mission.upload` 1/s · chỉ một tab giữ quyền lái
  - **19 route REST** · trạng thái, mission, sự kiện, video, ghi hình, lịch sử bay
  - **Hợp đồng sinh tự động** · Pydantic → `ws-contract.schema.json` → kiểu TypeScript cho web
- Dòng chân trái (13 pt): 512 test pytest chạy đạt ngày 26/11/2026.

**Hình**: F22, TikZ 2D. Khung lớn viền navy "backend FastAPI · cổng 8000". Bên trong 3 tầng ngang:
tầng dưới "Thread MAVLink" gồm các ô `connection` (486 dòng), `telemetry` (568), `control` (451), `mission` (850),
`deadman` (321), `safety` (278), `proximity` (179); tầng giữa "Hub" gồm `ws.py` (1 145), `schemas.py` (864), `api.py`
(375), `events.py`; tầng trên "Thread riêng" gồm `vision/` 16 file (3 140 dòng) và `flights/` 8 file (2 031 dòng).
Ngoài khung: trái là ESP32 → `udpin:0.0.0.0:14550` vào `connection`; camera MJPEG vào `vision`; phải là trình duyệt
nối `ws.py` bằng mũi tên hai chiều "WebSocket" và nối `api.py` bằng "REST". Ô `deadman` tô đỏ nhạt có nhãn "thread riêng,
không trong asyncio". Kích thước ô tỉ lệ số dòng (tương đối). Màu: MAVLink xanh `326CE5`, hub navy, vision hổ phách,
flights xanh lá. Nguồn: F03 mục 2.

**Hiệu ứng**: khung F22 `fade` → 3 tầng `rise` stagger 200 ms → 4 thẻ `rise` stagger 120 ms.

**Nguồn**: số dòng `wc -l` 26/11/2026 (F03 mục 2); route `backend/api.py` dòng 80 (F03 mục 2.1); lệnh và trần nhịp
`backend/schemas.py` dòng 40 đến 62, 748 đến 815 (F03 mục 2.2); một người lái `backend/ws.py` dòng 7 đến 18; 512 test
F03 mục 6.

**Ghi chú người nói**: Backend viết bằng FastAPI, khoảng 11 nghìn 7 trăm dòng Python không tính test. Hình bên trái chia
ba tầng. Tầng dưới là các thread nói chuyện với bo bay: nối kết nối, đọc telemetry, gửi lệnh, nạp mission, dead-man, máy
trạng thái an toàn và vật cản. Dead-man chạy trên thread riêng, không nằm trong vòng asyncio, để nếu phần web bị chậm thì
lệnh dừng vẫn đi đúng giờ. Tầng giữa là hub WebSocket và REST. Tầng trên là camera với AI, và phần lịch sử bay. Web chỉ
nói chuyện với backend qua một WebSocket hai chiều và mười chín route REST. Mọi message đều có schema Pydantic, từ đó sinh
ra kiểu TypeScript cho web, nên hai bên không lệch nhau. Mỗi loại lệnh có trần nhịp, và chỉ một tab được giữ quyền lái.

**Để học**:
- Frontend không đọc MAVLink; backend chuẩn hoá thành JSON.
- Dead-man ở thread riêng.
- Một hợp đồng schema sinh ra kiểu cho cả hai phía.
- Giải thích: FastAPI là framework web Python chạy bất đồng bộ (asyncio). Việc nặng hoặc cần đúng giờ như đọc cổng
  MAVLink, dead-man, AI được đẩy ra thread riêng để không chặn vòng sự kiện phục vụ web. WebSocket là kết nối hai chiều
  giữ mở, hợp cho telemetry 8 Hz đi xuống và lệnh đi lên mà không phải mở request mới mỗi lần. Giới hạn nhịp từng loại
  lệnh ngăn một tab lỗi gửi dồn dập làm nghẽn đường MAVLink. Lịch sử telemetry 900 giây được giữ trong RAM để vẽ biểu đồ, khoảng 7 200 gói ở 8 Hz.
- Thuật ngữ: **WebSocket** (kết nối hai chiều lâu dài), **Pydantic** (thư viện kiểm kiểu dữ liệu Python), **rate limit** (trần số lệnh mỗi giây).

---

## S18b · Phần 6 · Trạm mặt đất

**Tiêu đề**: 4 kiểu trao đổi dữ liệu giữa camera, backend và trình duyệt

**Bố cục**: trái (1,0; 2,05; 11,6; 8,45): hình `img/asg/f5_mohinh.png`. Phải (12,95; 2,05; 5,95): 4 ô số.

**Khối nội dung**:
- **REST** · đọc trạng thái, nạp mission rồi đọc lại cho khớp
- **200** · sự kiện giữ trong vòng đệm, tab mới mở vẫn thấy lịch sử
- **1 → N** · một kết nối tới camera, mọi người xem dùng chung khung mới nhất
- **8 Hz** · telemetry qua WebSocket; đóng tab là backend gửi vận tốc 0 ngay

**Hình**: `img/asg/f5_mohinh.png`, vẽ lại từ hình 5.4 của báo cáo môn với các kênh thật của backend
(`tex/asg/f5_mohinh.tex`).

**Hiệu ứng**: hình `fade` → 4 ô `rise` stagger 130 ms.

**Nguồn**: `img/asg/README.md`; bus sự kiện `backend/events.py`; telemetry 8 Hz và dead-man S19, S21.

**Ghi chú người nói**: Môn học có bốn mô hình trao đổi dữ liệu, và backend của nhóm em dùng cả bốn. Thứ nhất là yêu cầu phản hồi qua REST: trình duyệt hỏi trạng thái, hay nạp mission rồi đọc lại để chắc bo bay nhận đúng. Thứ hai là xuất bản và đăng ký: telemetry, AI và dead-man cùng đẩy sự kiện vào một bus, ai đăng ký thì nhận. Bus giữ 200 sự kiện gần nhất nên tab vừa mở vẫn thấy lịch sử. Thứ ba là đẩy kéo cho video: camera đẩy khung vào một ô nhớ, AI và các tab tự kéo khung mới nhất, nên chỉ có một kết nối tới camera. Thứ tư là cặp độc quyền qua WebSocket: tab người lái giữ một kết nối suốt phiên, nhận telemetry tám lần mỗi giây và gửi lệnh lái. Đóng tab là backend gửi vận tốc 0 ngay.

**Để học**:
- REST: hỏi một lần, đáp một lần.
- Bus sự kiện: một nguồn, nhiều nơi nhận, vòng đệm 200.
- MJPEG: một kết nối camera, nhiều người xem.
- WebSocket: kết nối giữ suốt phiên, hai chiều.
- Giải thích: mỗi kiểu hợp với một loại dữ liệu. Lệnh nạp mission cần biết chắc thành công nên dùng yêu cầu phản hồi.
  Sự kiện cần đến nhiều nơi cùng lúc nên dùng xuất bản và đăng ký. Video nặng, camera yếu, nên chỉ mở một kết nối và để
  mọi người xem dùng chung. Lái tay cần trễ thấp và hai chiều nên giữ một WebSocket; khi nó đóng, backend biết ngay
  người lái đã rời đi và dừng drone.
- Thuật ngữ: **REST** (kiểu API theo tài nguyên trên HTTP), **WebSocket** (kết nối hai chiều giữ mở), **dead-man** (dừng khi người điều khiển không còn giữ).

---

## S19 · Phần 6 · Trạm mặt đất

**Tiêu đề**: Trang Bay: telemetry 8 Hz, radar vật cản, lái bằng 10 phím

**Bố cục**: trái (1,0; 1,6; 12,2; 6,9): F23. Dưới trái (1,0; 8,7; 12,2; 1,8): hàng 11 chip trang (Alt+1 … Alt+0, Alt+L).
Phải (13,5; 1,6; 5,4; 8,9): sơ đồ bàn phím nhỏ (vẽ bằng shape, 5,4 × 3,6 in) và 3 thẻ dưới.

**Khối nội dung**:
- Sơ đồ phím (ô vuông bo góc, phím chữ `mono`): `W` tiến · `S` lùi · `A` trái · `D` phải · `R` lên · `F` xuống · `Q` xoay trái ·
  `E` xoay phải · `Space` ==dừng ngay== · `H` HOLD
- Thẻ 1: **Gửi đều 10 Hz** · giữ phím chỉ đổi trạng thái; một bộ hẹn giờ 10 Hz là nơi duy nhất gửi `cmd.velocity`;
  thả phím gửi thêm 3 nhịp 0.
- Thẻ 2: **Trần an toàn** · vận tốc 1,0 m/s, xoay 45°/s; chỉ chạy khi SwA bật và tab giữ quyền.
- Thẻ 3: **Radar vật cản** · trạng thái OFF / NEAR / ACTIVE theo `DISTANCE_SENSOR`, cảnh báo khi gần hơn 5 m.
- Chip trang: Bay · Nhiệm vụ · 3D · Camera & AI · Tổng quan · Dữ liệu bay · Nhật ký · Lịch sử bay · Kiểm tra trước bay ·
  Hệ thống · Cài đặt

**Hình**: F23, ảnh chụp màn hình `D:\Coding\IOT-CV\frontend\screenshots\day-flight.png` (1707×900, SITL). **Cắt/che nhãn**:
che chú giải bản đồ (dòng "Giới hạn phần mềm…" và chữ "Phase"), che khung video có nhãn "NGUỒN GIẢ"/"fake" bằng thẻ xám
ghi "Video camera". Viền 0,03 in `DDE1E6`, bóng nhẹ. Thêm 3 callout số đỏ lên ảnh: (1) chân trời giả, (2) radar vật cản,
(3) bàn phím lái.

**Hiệu ứng**: F23 `fade` 600 ms → 3 callout `zoom` stagger 150 ms → sơ đồ phím `rise` → 3 thẻ `rise` stagger 120 ms → chip trang `float` stagger 50 ms.

**Nguồn**: phím `frontend/src/lib/velocityMapping.ts` dòng 26 đến 55, `manualControl.ts` dòng 1 đến 31, `useHoldShortcut.ts`
dòng 12 (F03 mục 4); trần 1,0 m/s, 45°/s `backend/config.py` dòng 115 đến 125 (F03 mục 3.5); trạng thái vật cản
`backend/schemas.py` dòng 112, `AVOID_DIST_MAX_M 5` `backend/config.py` dòng 148 đến 153 (F03 mục 3.6); 11 trang
`frontend/src/app/routes.tsx` dòng 55 đến 176; telemetry 8 Hz F03 mục 1.

**Ghi chú người nói**: Đây là trang người vận hành nhìn nhiều nhất. Trang được thiết kế để vừa một màn hình laptop không
phải cuộn, radar vật cản và bàn phím lái luôn hiện. Telemetry cập nhật tám lần mỗi giây: chân trời giả, độ cao, tốc độ,
pin, GPS, chất lượng liên kết. Lái tay dùng bàn phím như chơi game: W, A, S, D để đi, R và F để lên xuống, Q và E để xoay,
phím cách để dừng ngay. Điểm thiết kế quan trọng là giữ phím không gửi lệnh trực tiếp. Một bộ hẹn giờ 10 Hz là nơi duy
nhất gửi lệnh vận tốc, nên tốc độ gửi không phụ thuộc tốc độ lặp phím của hệ điều hành; thả phím thì gửi thêm ba lệnh
không. Trần vận tốc 1 mét mỗi giây. Ngoài trang này web còn mười trang khác, mở nhanh bằng Alt cộng số.

**Để học**:
- Telemetry 8 Hz; lái tay gửi đều 10 Hz.
- Space dừng ngay; thả phím gửi 3 nhịp 0.
- Web chỉ lái được khi SwA bật, tab giữ quyền và FC ở GUIDED.
- Giải thích: điều khiển bằng vận tốc nghĩa là web không nói "đi tới điểm X" mà nói "đi với vận tốc v trong 0,1 giây tới".
  Nếu lệnh ngừng tới, bo bay và dead-man ở backend sẽ dừng drone. Vì thế web phải gửi đều đặn. Tách "trạng thái phím"
  khỏi "nhịp gửi" là cách làm của vòng lặp game: phím chỉ đặt cờ, vòng 10 Hz đọc cờ và gửi. Mất tiêu điểm cửa sổ cũng
  coi như thả hết phím.
- Thuật ngữ: **HUD** (màn hình số liệu bay), **lệnh vận tốc** (`SET_POSITION_TARGET_LOCAL_NED` với các thành phần vận tốc), **HOLD** (đứng yên tại chỗ).

---

## S20 · Phần 6 · Trạm mặt đất

**Tiêu đề**: Nạp mission khi đang bay AUTO: GUIDED giữ chỗ dưới 0,1 s

**Bố cục**: trái (1,0; 1,6; 10,2; 8,9): F24. Phải trên (11,6; 1,6; 7,3; 4,3): F25. Phải dưới (11,6; 6,1; 7,3; 4,4): 4 ô
số 2×2 (3,55 × 2,1 in).

**Khối nội dung**:
- 4 ô số:
  - **10** · điểm tối đa mỗi mission, độ cao 2 đến 18 m
  - **3 s × 8** · chờ mỗi item, số lần thử lại (~24 s cho Wi-Fi ngoài trời)
  - **< 0,1 s** · chuyển GUIDED giữ chỗ (SITL)
  - **0,09 m** · hạ cách home, chuyến 02/11 10:40 sau khi nạp lúc bay
- Chú thích F25: Trang Nhiệm vụ: vẽ điểm trên bản đồ, hồ sơ độ cao, xem trước 3D, nạp và đọc lại.

**Hình**:
- F24, TikZ 2D sơ đồ tuần tự 3 cột dọc: "Web" (xanh `326CE5`), "Backend" (navy), "FC" (đỏ `BB2025`). Các mũi tên ngang
  đánh số: 1 web → backend `cmd.mission.upload`; 2 backend kiểm mission (≤ 10 điểm, 2 đến 18 m, ≤ 95 m); 3 backend → FC
  `DO_SET_MODE GUIDED` (nhãn hổ phách "đang AUTO: giữ chỗ trước"); 4 FC → backend `COMMAND_ACK`; 5 `MISSION_COUNT`;
  6 vòng lặp `MISSION_REQUEST_INT` ↔ `MISSION_ITEM_INT` (khung lặp, nhãn "3 s × 8 lần"); 7 `MISSION_ACK`; 8 đọc lại
  `MISSION_REQUEST_LIST`, so khớp từng trường (sai số cao 0,1 m); 9 `DO_SET_MISSION_CURRENT 1`; 10 backend → web `ack`.
  Cuối cột FC chú thích "người lái gạt AUTO → bay từ điểm 1". Nguồn: F03 mục 3.2, 3.4.
- F25, ảnh chụp màn hình `D:\Coding\IOT-CV\frontend\screenshots\day-mission.png`. **Cắt/che nhãn**: soát trước khi dùng; dòng
  nào ghi "Phase", "50 m" hay chip phiên bản thì che bằng nền trắng.

**Hiệu ứng**: 3 cột F24 `fade` → mũi tên 1 tới 10 `wipe-r` stagger 120 ms → F25 `fade` → 4 ô số `zoom` stagger 100 ms.

**Nguồn**: `backend/mavlink/mission.py` dòng 470 đến 779 (F03 mục 3.2, 3.4); `backend/config.py` dòng 115 đến 125, 160 đến 163;
`chay-drone-that.bat` dòng 28 đến 30 (95 m); SITL `run_nap_khi_bay.py` `docs/so-tay/07-backend-mission-proximity-safety.md`
dòng 308 đến 318 (F04 mục 3); chuyến 10:40 `plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md` mục 3.1 (F04 mục 3).

**Ghi chú người nói**: Trên trang Nhiệm vụ, người vận hành bấm điểm trên bản đồ, chỉnh độ cao và xem trước lộ trình 3D.
Backend kiểm mission trước khi gửi: tối đa mười điểm, độ cao từ 2 tới 18 mét, không quá 95 mét tính từ home. Sơ đồ bên
trái là trường hợp khó nhất: nạp mission mới khi drone đang bay AUTO. Nếu thay mission ngay giữa lúc bo bay đang đi theo
mission cũ thì không rõ drone sẽ đi đâu, nên backend chuyển sang GUIDED để drone đứng giữ chỗ trước, rồi mới gửi từng điểm
theo giao thức MISSION. Mỗi điểm chờ 3 giây và thử lại tối đa 8 lần cho Wi-Fi ngoài trời. Nạp xong backend đọc lại toàn bộ
và so từng trường, rồi đặt điểm hiện tại về 1. Người lái gạt AUTO là drone bay mission mới. Ngày 02/11 việc này chạy trên
drone thật và drone hạ cách home 9 centimet.

**Để học**:
- Kiểm mission ở backend: 10 điểm, 2 đến 18 m, 95 m.
- Đang AUTO thì GUIDED giữ chỗ trước, nạp sau.
- Nạp xong đọc lại so khớp, đặt điểm hiện tại về 1.
- Giải thích: giao thức mission của MAVLink kiểu "kéo": trạm mặt đất báo có N điểm (`MISSION_COUNT`), bo bay lần lượt
  xin từng điểm (`MISSION_REQUEST_INT`), trạm gửi (`MISSION_ITEM_INT`), cuối cùng bo bay trả `MISSION_ACK`. Gói nào mất
  thì bo bay xin lại, nên giao thức chịu được Wi-Fi chập chờn nếu thời gian chờ đủ dài. Đọc lại sau khi nạp là bước kiểm
  chứng: thứ nằm trong bo bay đúng là thứ người vận hành đã vẽ. Backend còn chặn waypoint dưới 2 m vì SITL cho thấy bo bay không tự chặn điểm thấp.
- Thuật ngữ: **mission / waypoint** (lộ trình / điểm trên lộ trình), **AUTO** (chế độ tự bay mission), **giữ chỗ** (đứng yên tại vị trí hiện tại ở GUIDED).

---

## S21 · Phần 6 · Trạm mặt đất

**Tiêu đề**: 4 lớp an toàn; dead-man dừng drone 6 đến 7 ms sau khi đóng tab

**Bố cục**: trái (1,0; 1,6; 8,6; 8,9): F26. Giữa phải (10,0; 1,6; 8,9; 4,6): bảng thời gian dead-man 3 dòng dạng thẻ.
Dưới phải (10,0; 6,4; 8,9; 4,1): F27 với tiêu đề nhỏ.

**Khối nội dung**:
- Khối dead-man (3 dòng, cột: Sự cố | Backend làm gì | Thời gian):
  - Đóng tab hoặc rớt mạng · gửi vận tốc 0 ngay · ==6 đến 7 ms== (SITL, đo 2 lần)
  - Trình duyệt treo, socket còn mở · hết hạn 300 ms, nhịp 50 ms gửi 0 · ≤ 350 ms
  - Backend chết · ArduPilot tự huỷ lệnh vận tốc · ~3 s
- Dòng dưới khối: Mỗi lần gửi 0 ghi vào `logs/deadman.jsonl`; gửi lặp 5 nhịp.
- Tiêu đề nhỏ F27: SITL: Loiter giữ cần tiến thẳng vào cột

**Hình**:
- F26, TikZ 2D: 4 vòng tròn đồng tâm, ngoài vào trong: "Web · chỉ lái ở GUIDED, SwA bật, 1 tab" (xanh nhạt `EAF0FC`),
  "Backend · dead-man, trần 1,0 m/s, 2 đến 18 m, 95 m" (navy nhạt), "FC · rào 100 m, trần 20 m, failsafe, AVOID TFmini dừng
  cách 2 m" (đỏ nhạt `FCEBEC`), lõi "Tay cầm RC · luôn thắng" (đỏ đậm `8E1418`, chữ trắng). Mũi tên nhỏ từ ngoài vào trong
  nhãn "lớp trong thắng lớp ngoài". Nguồn: F03 mục 3.5, 3.6; F02 mục 4.4, 4.5.
- F27, biểu đồ native clustered bar 2 nhóm chỉ số × 2 lần chạy: nhóm "Gần cột nhất (m)": AVOID tắt −0,83 (xám, nhãn "xuyên
  cột"), AVOID bật 1,07 (xanh lá `15803D`); nhóm "Tốc độ 5 s cuối (m/s)": 3,99 (xám), 0,78 (xanh lá). Trục 0 ở giữa cho
  giá trị âm. Nguồn: `D/tranh-vat-can-sitl.csv`, cột `lan_chay`, `be_mat_min_m`, `toc_do_5s_cuoi_ms`.

**Hiệu ứng**: F26 vòng `zoom` từ lõi ra ngoài stagger 200 ms → khối dead-man `rise` stagger 120 ms → F27 `wipe-u` 700 ms.

**Nguồn**: `backend/mavlink/deadman.py` dòng 7 đến 29, `backend/config.py` dòng 126 đến 142 (F03 mục 3.5); 6 đến 7 ms
`docs/so-tay/10-web-dieu-khien-obstacle-video.md` dòng 213, ≤ 350 ms `docs/so-tay/06-backend-dieu-khien-deadman.md` dòng 133
(`D/do-tre.csv`); `backend/mavlink/safety.py` dòng 1 đến 23; F27 `logs/sitl/run_avoid_brake-20261101.log` (F04 mục 6).

**Ghi chú người nói**: An toàn được xếp thành bốn lớp lồng nhau, lớp trong luôn thắng lớp ngoài. Trong cùng là tay cầm
RC. Tiếp theo là bo bay với rào ảo, failsafe và tránh vật cản bằng TFmini. Lớp thứ ba là backend, có dead-man và các giới
hạn phần mềm chặt hơn bo bay. Ngoài cùng là web, chỉ lái được ở GUIDED và chỉ một tab. Dead-man trả lời câu hỏi: chuyện gì
xảy ra khi web ngừng gửi lệnh? Đóng tab thì backend gửi vận tốc không ngay, đo trên SITL mất 6 tới 7 mili giây. Trình duyệt
treo mà socket vẫn mở thì sau 300 mili giây không có lệnh mới, backend tự gửi không. Nếu chính backend chết, ArduPilot tự
huỷ lệnh vận tốc sau khoảng ba giây. Biểu đồ dưới là bài tránh vật cản trên SITL: bật AVOID thì drone dừng cách cột 1,07
mét, tắt đi thì bay xuyên cột.

**Để học**:
- 4 lớp: RC, FC, backend, web; lớp trong thắng.
- Dead-man: 6 đến 7 ms khi đóng tab, ≤ 350 ms khi treo, ~3 s nếu backend chết.
- TFmini + AVOID: dừng cách cột 1,07 m, tốc độ còn 0,78 m/s.
- Giải thích: "dead-man switch" lấy tên từ cần gạt trên tàu hoả: người lái phải giữ cần, buông ra là tàu dừng. Ở đây
  "giữ cần" là web gửi lệnh đều đặn. Ba tầng thời gian tương ứng ba kiểu hỏng: mất kết nối (phát hiện ngay vì socket
  đóng), treo (phát hiện bằng hạn 300 ms), và chính backend hỏng (bo bay tự hết hạn lệnh). Bài đối chứng có cùng mọi thứ,
  chỉ khác AVOID tắt hay bật, nên khác biệt 1,07 m so với xuyên cột là do tính năng tránh vật cản.
- Thuật ngữ: **dead-man** (cơ chế dừng khi người điều khiển ngừng tác động), **AVOID** (thư viện tránh vật cản của ArduPilot), **đối chứng** (lần chạy tắt tính năng để so sánh).

---

## S22 · Phần 6 · Trạm mặt đất

**Tiêu đề**: Lịch sử bay ghép log FC, tlog và video theo giờ GPS từng 0,5 s

**Bố cục**: trên (1,0; 1,6; 17,9; 3,0): F28. Dưới trái (1,0; 4,9; 11,4; 5,6): F29. Dưới phải (12,8; 4,9; 6,1; 5,6): 4 dòng số
dạng danh sách có icon.

**Khối nội dung**:
- 4 dòng số:
  - **97** file tlog · mỗi gói kèm 8 byte giờ nhận, Mission Planner đọc được
  - **7** thư mục log dataflash FC
  - **11** phiên video camera ghi đoạn 300 s
  - **0,5 s** · bước lưới chung khi ghép
- Chú thích F29: Chuyến 02/11 10:40: danh sách chuyến, đường bay, hình camera, thanh phát lại.
- Dòng lệnh (mono 13 pt): `uv run python -m backend.flights --events`

**Hình**:
- F28, TikZ 2D: một trục thời gian ngang "giờ GPS" (navy) với 3 dải song song phía trên: "Log FC `.bin`: GPS, độ cao, tư
  thế, pin, rung, TFmini" (đỏ `BB2025`), "tlog backend: RSSI, mất gói" (xanh `326CE5`), "Video MJPEG: khung/s, hình"
  (hổ phách `B45309`). Các vạch dọc nét đứt cắt qua cả 3 dải mỗi 0,5 s (vẽ thưa, nhãn "lưới 0,5 s"). Phải trục: mũi tên
  vào khối "trang `/flights` (Alt+L)". Nguồn: F03 mục 3.8, F04 mục 2 "Chuỗi thời gian".
- F29, ảnh chụp màn hình trang `/flights` chuyến 02/11 10:40, `img/real/lsb-1040-tong-quan.png`. **Cắt/che nhãn**:
  che chip tên model có số ở khung ảnh rõ; che danh sách chuyến ở cột trái nếu thấy số chuyến khác 11 (giữ phần
  video + biểu đồ).

**Hiệu ứng**: trục F28 `wipe-r` → 3 dải `wipe-r` stagger 200 ms → F29 `fade` → 4 dòng số `rise` stagger 100 ms.

**Nguồn**: `backend/flights/*.py` 8 file 2 031 dòng (F03 mục 2); tlog định dạng `backend/mavlink/connection.py` dòng 85 đến 100,
video 300 s `backend/config.py` dòng 326 đến 336 (F03 mục 3.8); 97 tlog, 7 thư mục log, 11 phiên video F06 (b); lưới 0,5 s
F04 mục 2 "Chuỗi thời gian".

**Ghi chú người nói**: Mỗi chuyến bay để lại ba nguồn dữ liệu ở ba nơi. Bo bay ghi log dataflash với GPS, tư thế, pin, rung và TFmini. Backend ghi tlog, tức là mọi gói MAVLink nhận qua Wi-Fi kèm giờ nhận. Camera thì được backend ghi thành video từng đoạn năm phút. Trang Lịch sử bay đọc cả ba, đưa về chung trục giờ GPS với bước nửa giây, rồi phát lại: đường bay trên bản đồ, độ cao, pin, cường độ sóng, mất gói và hình camera cùng một thời điểm. Từ đây nhóm em đo được những thứ chỉ một nguồn không cho biết, ví dụ khung hình mỗi giây của camera ở từng khoảng cách. Ảnh chụp bên trái là trang này mở chuyến 10:40 ngày 02/11: danh sách chuyến, đường bay trên ảnh vệ tinh, hình camera đã ghi và thanh phát lại tô màu theo chế độ bay. Lệnh dòng lệnh bên dưới in cùng bảng chuyến và sự kiện.

**Để học**:
- Ba nguồn: log FC, tlog, video.
- Ghép theo giờ GPS, lưới 0,5 s.
- Dùng để phân tích sau bay, ví dụ khung/s theo khoảng cách.
- Giải thích: mỗi thiết bị có đồng hồ riêng và chúng lệch nhau. Giờ GPS là đồng hồ chung đáng tin nhất vì bo bay nhận nó
  từ vệ tinh. Khi đưa mọi mẫu về cùng một lưới thời gian, ta có thể đặt RSSI bên cạnh khoảng cách, hay khung/s bên cạnh độ
  cao, và trả lời các câu hỏi kiểu "camera chậm lại ở đâu". tlog có định dạng chuẩn nên mở được bằng Mission Planner để
  đối chiếu. Lệnh dòng lệnh in cùng bảng chuyến, nên số trên slide kiểm lại được bất cứ lúc nào.
- Thuật ngữ: **dataflash** (log nhị phân ghi trên bo bay), **tlog** (telemetry log do trạm mặt đất ghi), **lưới thời gian** (các mốc cách đều để ghép dữ liệu).

---

## S23 · Phần 7 · SITL

**Tiêu đề**: 10/10 runner SITL đạt, 512 test backend, 320 test web

**Bố cục**: trái (1,0; 1,6; 7,6; 5,2): F30. Dưới trái (1,0; 7,0; 7,6; 3,5): 3 ô số xếp ngang (2,4 × 3,5 in). Phải
(8,9; 1,6; 10,0; 8,9): bảng 10 dòng.

**Khối nội dung**:
- 3 ô số: **512** test pytest backend · **320** test Vitest web · **9/9** bài nghiệm thu web trên SITL
- Bảng (Runner | Kiểm gì | Kết quả), 13 pt:

| Runner | Kiểm gì | Kết quả |
|---|---|---|
| `run_mode_chain` | 7 chế độ bay | 7/7, RTL về home 0,0 m |
| `run_rtl_alt` | độ cao RTL | đỉnh 20,0 m và 50,0 m |
| `run_mission_auto` | nạp, đọc lại, bay | 6 item khớp, đủ WP 1 đến 5 |
| `run_mission_low_alt` | waypoint 3 m | FC không chặn → backend chặn 2 m |
| `run_log_dump` | rút log FC | 1 218 mẫu CTUN |
| `run_param_load` | bộ tham số dự án | 51/51 dòng |
| `run_avoid_brake` | TFmini ảo + AVOID | dừng cách cột 1,07 m |
| `run_backend_avoid` | backend báo vật cản | OFF → NEAR → ACTIVE |
| `run_nap_khi_bay` | nạp khi bay AUTO | GUIDED < 0,1 s, lệch 0,42 m |
| `run_ngoai_troi` | cấu hình ngoài trời | 8/8 bài |

**Hình**: F30, TikZ 2D vòng kín: khối "WSL2 Ubuntu · ArduCopter 4.7.1 SITL `-f bfx` (thứ tự motor kiểu Betaflight)"
(navy) ↔ "harness.py · MAVLink thật" (xanh `326CE5`) ↔ "backend" (đỏ) ↔ "web" (xanh lá). Mũi tên `tcp:127.0.0.1:5760`
từ SITL tới backend. Dưới vòng: khối nhỏ "`run-all.sh` · 8 runner nối tiếp ~17 phút · mã thoát ≠ 0 khi hỏng". Nguồn: F03 mục 7.

**Hiệu ứng**: F30 `fade` → 3 ô số `zoom` stagger 120 ms → bảng `wipe-d` 900 ms.

**Nguồn**: 512 và 320 test chạy 26/11/2026 (F03 mục 6); runner `D/sitl-runner.csv`, `plans/PROGRESS.md` dòng 280 đến 346,
`logs/sitl/run_avoid_brake-20261101.log` (F04 mục 6); 9/9 `docs/so-tay/10-web-dieu-khien-obstacle-video.md` dòng 205 đến 217;
`run-all.sh` F03 mục 7.

**Ghi chú người nói**: SITL là drone ảo: chạy đúng mã ArduCopter 4.7.1 trong WSL trên laptop, với mô hình vật lý khớp thứ
tự motor của drone thật. Backend nối vào drone ảo giống hệt cách nối vào drone thật. Nhóm em viết thư viện harness nói
chuyện với SITL bằng MAVLink thật, và trên đó là các runner, mỗi runner một bài kiểm có PASS hoặc FAIL. Bảng bên phải là mười
runner, tất cả đều đạt. Có những bài không thể làm an toàn trên drone thật, như cố tình bay ra rào, vượt trần hay tắt tay
phát giữa chừng. Một bài cho kết quả đáng chú ý: bo bay không chặn waypoint thấp 3 mét, nên backend phải tự chặn dưới 2
mét. Ngoài SITL còn 512 test cho backend và 320 test cho web, chạy đạt ngày 26/11.

**Để học**:
- SITL chạy đúng firmware bay thật.
- 10 runner đạt; `run-all.sh` chạy 8 runner trong ~17 phút.
- 512 test backend, 320 test web.
- Giải thích: kiểm thử có nhiều tầng. Unit test (pytest, Vitest) kiểm từng hàm, chạy trong vài giây, không cần drone.
  Runner SITL là kiểm thử tích hợp: firmware thật, giao thức thật, chỉ có vật lý là giả lập. Bài nghiệm thu web chạy cả
  chuỗi từ trình duyệt tới drone ảo. Mỗi tầng bắt một kiểu lỗi khác nhau, và tầng nào chạy càng nhanh thì càng được chạy
  thường xuyên. Runner `run_ngoai_troi` một mình có 8 bài, cố tình vượt trần, ra rào, tắt tay phát, hạ pin, để chứng minh cấu hình ngoài trời giữ được drone.
- Thuật ngữ: **harness** (thư viện điều khiển môi trường kiểm thử), **kiểm thử tích hợp** (kiểm nhiều thành phần chạy cùng nhau), **mã thoát** (số chương trình trả về, 0 là thành công).

---

## S24 · Phần 8 · AI

**Tiêu đề**: Camera bay thật cho ảnh hỏng 5 kiểu, ám hồng ở 31 % số khung

**Bố cục**: trái (1,0; 1,6; 10,4; 7,8): F31. Dưới trái (1,0; 9,6; 10,4; 0,9): chú thích. Phải (11,8; 1,6; 7,1; 8,9): 5 thẻ
lỗi xếp dọc (7,1 × 1,6 in, khe 0,15), số thứ tự khớp callout trên ảnh.

**Khối nội dung**:
- 5 thẻ (tên lỗi · số đo):
  1. **Ám hồng vùng sáng** · ==31 %== số khung có hơn 0,5 % điểm hồng
  2. **Mờ như sương** · dark channel trung vị 143,7/255, bão hoà màu 16/255
  3. **Tối bốn góc** · góc chỉ sáng bằng 0,81 tâm
  4. **Khối vuông 8×8** · nén JPEG chất lượng 12, tỉ lệ biên khối 2,68
  5. **Sọc mép trái** · rộng 14 px, mọi model bỏ 16 cột đầu
- Chú thích ảnh: Khung bay thật 640×480 từ camera OV3660. Đo trên 1 115 khung; người trong khung cao trung vị ~54 px,
  độ cao bay trung vị 12,3 m.

**Hình**: F31, ảnh `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_raw.jpg`, fit (1,0; 1,6; 10,4; 7,8). Thêm 5 callout tròn đỏ đánh số
1 tới 5 đặt đúng chỗ: vệt hồng, vùng mù giữa ảnh, góc tối, một ô khối (phóng nhỏ khung vuông), dải mép trái. Đường viền đỏ
nét đứt quanh dải 16 cột trái.

**Hiệu ứng**: F31 `fade` → 5 callout `zoom` stagger 200 ms, mỗi callout đi cùng thẻ tương ứng `rise` (xen kẽ).

**Nguồn**: `D:\XLA\configs\camera_profile.yaml` (khoá `magenta.frac_frames_gt_0p5pct`, `haze.dark_channel_15px_0_255.p50`,
`haze.saturation_0_255.p50`, `vignette.corner_center_ratio.p50`, `blocking.ratio_8x8.p50`, `left_strip`,
`person_box_px.short_side.p50`, `altitude_m.flight_frames.p50`) theo F05 A1.

**Ghi chú người nói**: Phần AI bắt đầu từ câu hỏi: ảnh camera thật trên drone trông thế nào? Nhóm em đo trên hơn một
nghìn khung bay thật và thấy năm kiểu lỗi lặp lại. Nặng nhất là ám hồng ở vùng sáng, gặp ở 31 % số khung, do kênh xanh lá
của cảm biến bão hoà trước hai kênh còn lại. Ảnh bị mờ như sương, thiếu tương phản và gần như mất màu. Bốn góc tối hơn tâm
khoảng 19 %. JPEG chất lượng 12 để lại các khối vuông tám nhân tám. Và có một dải sọc rộng 14 điểm ảnh ở mép trái, nên mọi
model đều bỏ 16 cột đầu. Thêm vào đó, người trong khung rất nhỏ, chỉ cao khoảng 54 điểm ảnh khi drone bay ở 12 mét. Đây là
lý do không thể lấy một model nhận diện người có sẵn rồi dùng ngay.

**Để học**:
- 5 lỗi: ám hồng, mờ sương, tối góc, khối JPEG, sọc mép trái.
- Ám hồng nặng nhất: 31 % số khung.
- Người nhỏ (~54 px) làm bài toán khó hơn ảnh thường.
- Giải thích: dark channel là giá trị nhỏ nhất của ba kênh màu trong một vùng lân cận. Ảnh trời trong có dark channel gần
  0 ở hầu hết vùng; ảnh mờ sương thì cao vì có một lớp sáng phủ đều. Trung vị 143,7 trên 255 nghĩa là ảnh rất mờ. Tối góc
  (vignette) do ống kính rẻ đưa ít ánh sáng tới mép cảm biến. Ám hồng xảy ra khi một kênh bão hoà: kênh xanh lá chạm trần
  trước, hai kênh còn lại tiếp tục tăng, nên vùng sáng ngả sang tím hồng.
- Thuật ngữ: **dark channel** (kênh tối, thước đo độ mờ), **vignette** (tối góc), **artifact khối** (vết ô vuông do nén JPEG).

---

## S25 · Phần 8 · AI

**Tiêu đề**: 1 115 khung bay để học, 198 khung test do người duyệt từng hộp

**Bố cục**: trái (1,0; 1,6; 8,4; 4,6): F32. Dưới trái (1,0; 6,5; 8,4; 4,0): bảng 4 dòng. Phải (9,8; 1,6; 9,1; 8,9): 3 thẻ dọc
(9,1 × 2,8 in).

**Khối nội dung**:
- Bảng (Tập | Khung | Ghi chú):

| Tập | Khung | Ghi chú |
|---|---|---|
| dev | 1 115 | học và hiệu chỉnh, 224 khung có người |
| test | 198 | 39 khung có người, 149 người, chấm một lần |
| neg | 300 | trong nhà, không người, đo báo nhầm |
| bản kê bay | 2 915 | 24 khối 30 s, 13 khối làm test |

- Thẻ 1 **Chia theo khối 30 s**: khung liền nhau gần như trùng nhau, chia ngẫu nhiên sẽ để bản sao lọt vào test. Khối 30 s,
  đệm 5 s, khung test cách nhau ≥ 1 s, phân tầng theo độ cao 3 đến 8, 8 đến 14, trên 14 m.
- Thẻ 2 **Gán nhãn hai vòng**: máy gán trước bằng RT-DETR-x + YOLO11x (cắt ô SAHI, gộp WBF), rồi chủ dự án duyệt đủ 198/198
  khung test trên Label Studio. Người duyệt sửa 39/151 hộp (25,8 %).
- Thẻ 3 **Dữ liệu ngoài nhìn từ trên**: VisDrone 3 006 cửa sổ (19 792 người), HERIDAL 1 684 ảnh, WiSARD 110, TinyPerson 173.
  Người HERIDAL và WiSARD cao 42 đến 47 px, gần cỡ camera thật.

**Hình**: F32, biểu đồ native bar ngang 3 thanh: dev 1 115 (đỏ `BB2025`), test 198 (navy `1E293B`), neg 300 (xám `9CA3AF`);
trong thanh dev và test có đoạn đậm hơn cho số khung có người (224 và 39), chú giải "có người". Nguồn: F05 A2
(đường dẫn gốc ở dòng Nguồn).

**Hiệu ứng**: F32 `wipe-r` 800 ms → bảng `fade` → 3 thẻ `rise` stagger 150 ms.

**Nguồn**: `D:\XLA\results\data\split_report.json` (`counts`, `rules`, `blocks`, `flight_frames_in_manifest`);
`D:\XLA\results\v2\system\README.md` mục 4; `D:\XLA\data\real\labels\README.md` mục "Quy trình", "Kết quả duyệt";
dữ liệu ngoài `D:\XLA\results\baseline\baseline.json` (F05 A2).

**Ghi chú người nói**: Mọi điểm số của phần AI chấm trên khung bay thật của chính drone này, không chấm trên ảnh tự tạo.
Tập dev có 1 115 khung để học và hiệu chỉnh ngưỡng. Tập test có 198 khung, chỉ chấm một lần ở cuối. Thêm 300 khung trong
nhà không có người để đo báo nhầm. Cách chia rất quan trọng: hai khung liền nhau trong video gần như giống hệt, nên nếu chia
ngẫu nhiên thì test sẽ chứa bản sao của dev và điểm số bị đẩy lên. Nhóm em chia theo khối 30 giây, có vùng đệm giữa các
khối. Nhãn được máy gán trước bằng hai model lớn, sau đó người duyệt từng khung test; người duyệt đã sửa một phần tư số hộp.
Ngoài ra còn dữ liệu công khai chụp từ trên xuống, trong đó HERIDAL và WiSARD có người cỡ gần với camera của nhóm em.

**Để học**:
- dev 1 115, test 198, neg 300.
- Chia theo khối 30 s để tránh rò rỉ dữ liệu.
- Nhãn test do người duyệt: sửa 25,8 % số hộp.
- Giải thích: rò rỉ dữ liệu (data leakage) là khi tập test chứa thông tin mà model đã thấy lúc học, làm điểm số đẹp hơn
  thực tế. Với video, hai khung cách nhau 0,1 giây gần như là một ảnh. Chia theo khối thời gian dài và để vùng đệm giữa các
  khối đảm bảo test là những đoạn bay model chưa thấy. Phân tầng theo độ cao để test có đủ cả khung bay thấp lẫn cao, vì
  người ở 14 m nhỏ hơn nhiều so với ở 5 m.
- Thuật ngữ: **tập dev / test** (tập để phát triển / tập chấm cuối), **rò rỉ dữ liệu** (test lẫn thông tin của tập học), **gán nhãn trước** (máy đề xuất hộp, người sửa).

---

## S26 · Phần 8 · AI

**Tiêu đề**: Tìm người qua 3 tầng: YOLO11s, bộ xác minh, lọc theo track

**Bố cục**: trên (1,0; 1,6; 17,9; 4,4): F33. Dưới trái (1,0; 6,3; 7,6; 4,2): F34. Dưới phải (8,9; 6,3; 10,0; 4,2): 3 thẻ
ngang (3,2 × 4,2 in).

**Khối nội dung**:
- 3 thẻ:
  - **Tầng 1 · Nhận diện** · YOLO11s, ảnh vào 1 280 px, học chuyển từ COCO sang 1 lớp người, ngưỡng 0,0767
  - **Tầng 2 · Xác minh** · EfficientNet-B0 xem lại từng hộp trên vùng cắt 96×96 (rộng 1,5 lần hộp), giữ khi điểm ≥ 0,35
  - **Tầng 3 · Lọc track** · ghép hộp qua các khung (IoU 0,3), cooldown sự kiện theo từng track
- Chú thích F34: Khung test có 4 người sau tầng 2: giữ đủ 4.
- Dòng chân (13 pt): Ngưỡng 0,35 chọn trên lưới 720 điểm, chỉ dùng tập hiệu chỉnh.

**Hình**:
- F33, TikZ 2D luồng ngang: "Khung JPEG mới nhất" (icon camera, hổ phách) → "Giải mã" → khối đỏ "Tầng 1 YOLO11s" → khối
  xanh `326CE5` "Tầng 2 EfficientNet-B0" → khối xanh lá `15803D` "Tầng 3 lọc track" → hai đầu ra: "hộp người → WebSocket
  `detection`" và "sự kiện `vision.person_detected` → nhật ký". Nhánh song song phía dưới, tách từ "Khung JPEG", màu hổ
  phách nét đứt: "Ảnh rõ (5 bước) → `/api/video/stream`", nhãn "không đưa vào nhận diện". Khung bao ngoài nét chấm nhãn
  "thread AI riêng · ONNX Runtime GPU · chậm thì bỏ khung cũ". Nguồn: F05 A3, A4; F03 mục 1.
- F34, ảnh `D:\XLA\docs\nop-bai-src\slide-v4\img\box_005_00809_t2.jpg`, cắt quanh 4 hộp.

**Hiệu ứng**: F33 các khối `wipe-r` lần lượt stagger 200 ms → nhánh Ảnh rõ `fade` → F34 `zoom` → 3 thẻ `rise` stagger 120 ms.

**Nguồn**: `backend/vision/pipeline.py` docstring đầu file, `backend/config.py` dòng 202, 243; `D:\XLA\results\v2\system\README.md`
mục 1, 3, 4; `D:\XLA\docs\nop-bai-src\slide-v4\OUTLINE.md` slide 10, 12, 15 (F05 A3).

**Ghi chú người nói**: Hệ tìm người chạy trên GPU của laptop, trong một thread riêng của backend. Mỗi lần nó lấy khung mới
nhất từ camera; nếu xử lý chậm thì bỏ khung cũ chứ không xếp hàng, nên video, telemetry và lệnh lái không bao giờ phải chờ
AI. Tầng một là YOLO11s nhận ảnh 1 280 điểm, được học lại để chỉ tìm một lớp là người. Ngưỡng đặt rất thấp để không bỏ sót.
Vì ngưỡng thấp nên có nhiều hộp sai, ví dụ trên các vệt hồng. Tầng hai là một mạng EfficientNet nhỏ xem lại từng hộp trên
vùng cắt, chỉ giữ hộp có điểm từ 0,35 trở lên. Tầng ba ghép hộp qua các khung thành track để mỗi người chỉ sinh một sự kiện.
Nhánh Ảnh rõ chạy song song, chỉ để người xem, không đưa vào nhận diện.

**Để học**:
- Tầng 1 tìm nhiều (ngưỡng thấp), tầng 2 lọc sai, tầng 3 chống lặp sự kiện.
- AI ở thread riêng, chậm thì bỏ khung.
- Ảnh rõ không đi vào nhận diện.
- Giải thích: đây là kiến trúc "tìm rộng rồi xác minh". Detector một lần nhìn cả khung nên nhanh nhưng dễ nhầm trên nền
  nhiễu. Bộ xác minh chỉ nhìn một vùng cắt nhỏ quanh hộp, có thêm ngữ cảnh xung quanh (rộng 1,5 lần), nên phân biệt người
  với rác hồng tốt hơn và chạy rất nhanh vì vùng cắt chỉ 96×96. Track là chuỗi hộp của cùng một vật qua các khung, ghép
  bằng IoU, tức tỉ lệ diện tích chồng lên nhau của hai hộp.
- Thuật ngữ: **detector** (model vẽ hộp quanh vật), **verifier** (model chấm lại từng hộp), **IoU** (giao trên hợp của hai hộp).

---

## S27 · Phần 8 · AI

**Tiêu đề**: Ảnh rõ: lọc cổ điển 5 bước, 9,2 ms, bớt 89 % điểm hồng

**Bố cục**: trái (1,0; 1,6; 11,0; 5,6): F35 hai ảnh cạnh nhau (5,4 × 4,1 in mỗi ảnh, nhãn "Gốc" / "Ảnh rõ" trên).
Dưới trái (1,0; 7,4; 11,0; 3,1): 4 ô số ngang. Phải (12,4; 1,6; 6,5; 8,9): F36 với 5 nhãn bước.

**Khối nội dung**:
- 4 ô số (đo trên 198 khung test):
  - **−89,2 %** · điểm hồng (0,94 % → 0,10 %)
  - **−51,6 %** · dark channel (140,8 → 68,1)
  - **×3,1** · bão hoà màu (15,2 → 47,0)
  - **×6,8** · độ nét Laplacian (38,7 → 265,1)
- 5 nhãn bước cạnh F36: 1 Khử khối 8×8 · 2 Khử hồng (R, B ≥ 230, G thấp → xám) · 3 Bù tối góc cos⁴, tiêu cự 1 016 px ·
  4 Khử mù dark channel + guided filter, ω 0,85, t ≥ 0,4 · 5 Làm nét unsharp có chặn vọt
- Dòng chân phải (12 pt): Khử hồng trước khử mù: bớt 93 % điểm hồng. Bật sẵn trên web, chạy ONNX trên GPU.

**Hình**:
- F35, cặp ảnh `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_raw.jpg` và `ab_classic.jpg`, cùng khung cắt, cùng kích thước.
- F36, biểu đồ native bar ngang 5 thanh (ms p50 trên CPU): khử khối 2,2; khử hồng 2,6; bù tối góc 0,15; khử mù 2,2;
  làm nét 1,6; thanh tổng 9,2 tô đỏ đậm `8E1418` (chú thích p95 10,2). Các thanh bước màu hổ phách `B45309`. Nguồn:
  `D:\XLA\results\enhance\classic_bench.json` (`step_order`, `ms.steps`), số chép ở F05 A4.

**Hiệu ứng**: ảnh gốc `fade` → ảnh rõ `wipe-r` 900 ms (như kéo màn) → 4 ô số `zoom` stagger 120 ms → F36 `wipe-r` → nhãn `fade`.

**Nguồn**: F05 A4 (`D:\XLA\results\enhance\classic_bench.json` 200 khung dev, CPU Ryzen 9 7945HX; chỉ số hiệu quả
`D:\XLA\results\enhance\enhance_eval.json` `physical.metrics`, 198 khung test, bản numpy); bật sẵn `backend/config.py:279`.

**Ghi chú người nói**: Song song với tìm người, nhóm em làm một bộ lọc cho người vận hành nhìn rõ hơn, gọi là Ảnh rõ. Đây
là xử lý ảnh cổ điển năm bước, mỗi bước sửa đúng một lỗi đã đo ở slide trước. Bước một làm mịn biên khối JPEG. Bước hai kéo
các điểm hồng về màu xám. Bước ba bù sáng bốn góc theo mô hình cos mũ bốn của ống kính. Bước bốn khử mù bằng dark channel
prior. Bước năm làm nét nhẹ. Thứ tự có lý do: khử mù sẽ khuếch đại màu, nên phải khử hồng trước, làm vậy bớt được 93 %
điểm hồng. Cả năm bước chỉ mất 9,2 mili giây trên CPU. Trên 198 khung test, điểm hồng giảm 89 %, độ mù giảm một nửa, màu
đậm gấp ba. Ảnh rõ được bật sẵn trên web.

**Để học**:
- 5 bước theo đúng 5 lỗi đo được.
- Khử hồng trước khử mù.
- 9,2 ms trên CPU; điểm hồng −89 %, độ mù −52 %.
- Giải thích: dark channel prior của He và cộng sự dựa trên quan sát: ảnh ngoài trời không mù thì trong mỗi vùng nhỏ luôn
  có điểm rất tối ở ít nhất một kênh màu. Khi có sương, lớp sáng phủ làm các điểm đó sáng lên. Đo mức sáng đó cho ta độ
  truyền qua t của mỗi vùng, rồi đảo ngược mô hình sương để lấy lại ảnh. Giữ t ≥ 0,4 để không khuếch đại nhiễu quá tay.
  Guided filter làm mịn bản đồ t theo biên của ảnh gốc, tránh quầng sáng quanh vật.
- Thuật ngữ: **dark channel prior** (giả định kênh tối để khử mù), **cos⁴** (mô hình suy giảm sáng về mép ống kính), **unsharp mask** (làm nét bằng cách cộng phần chi tiết).

---

## S28 · Phần 8 · AI

**Tiêu đề**: Ba tầng nâng mAP50 từ 0,120 lên 0,210, báo nhầm giảm 67 %

**Bố cục**: trái (1,0; 1,6; 9,0; 5,4): F37. Dưới trái (1,0; 7,2; 9,0; 3,3): bảng 4 dòng. Phải trên (10,4; 1,6; 8,5; 4,4): F38
hai ảnh cạnh nhau (4,15 × 3,6 in, nhãn "Chỉ tầng 1" / "Sau tầng 2"). Phải dưới (10,4; 6,3; 8,5; 4,2): ô A/B lớn.

**Khối nội dung**:
- Bảng (Chỉ số | Chỉ YOLO11s | Ba tầng | Hiệu [CI 95 %]), 13 pt:

| Chỉ số | Chỉ YOLO11s | Ba tầng | Hiệu ghép cặp |
|---|---|---|---|
| mAP50 | 0,120 | **0,210** | +0,090 [+0,026; +0,189] |
| Báo nhầm / khung bay không người | 0,881 | **0,289** | −0,591 [−1,033; −0,273] |
| Recall ở ngưỡng vận hành | 0,396 | 0,396 | 0, không mất người |
| Báo nhầm / khung trong nhà | 0,003 | 0,003 | 0 |

- Ô A/B (nền `E6F4EA`, viền xanh lá): số lớn **25/25** · Người chấm mù chọn Ảnh rõ hơn ảnh gốc ở cả 25 cặp · Wilson 95 %
  [0,867; 1,000]
- Chú thích F38: Khung không người: 8 hộp sai còn 1.
- Dòng chân trái (12 pt): Chấm một lần trên 198 khung test; CI 95 % bootstrap 2 000 lần theo khối 30 s.

**Hình**:
- F37, biểu đồ native clustered bar: 2 nhóm "mAP50" và "Báo nhầm / khung không người"; mỗi nhóm 2 cột "Chỉ YOLO11s" (xám
  `9CA3AF`) và "Ba tầng" (đỏ `BB2025`): 0,120 / 0,210 và 0,881 / 0,289. Nhãn số trên cột. Thanh sai số CI cho cột ba tầng:
  mAP50 [0,122; 0,312], báo nhầm [0,036; 0,631]. Trục Y 0 đến 1,0. Nguồn: F05 A5 (bảng "cho biểu đồ cột").
- F38, cặp ảnh `D:\XLA\docs\nop-bai-src\slide-v4\img\box_002_00005_t1.jpg` và `box_002_00005_t2.jpg`, cùng khung cắt.

**Hiệu ứng**: F37 `wipe-u` 800 ms → bảng `fade` → F38 ảnh trái `fade`, ảnh phải `wipe-r` → ô A/B `zoom` 600 ms.

**Nguồn**: `D:\XLA\results\v2\system\README.md` mục 1, 4 (bảng tầng, bảng hiệu ghép cặp, "giảm 67 %"); A/B 25/25 và Wilson:
`docs/thuyet-trinh/facts/05-ai.md` mục A5 (gốc là file `decision.json` của vòng A/B trong `D:\XLA\results`, khoá `rounds.full`);
ảnh minh hoạ `D:\XLA\docs\nop-bai-src\slide-v4\OUTLINE.md` slide 19.

**Ghi chú người nói**: Kết quả chấm một lần trên 198 khung test. So với chỉ dùng detector, hệ ba tầng tăng mAP50 từ 0,120
lên 0,210, và số hộp báo nhầm trên mỗi khung bay không người giảm từ 0,881 xuống 0,289, tức giảm 67 %. Recall ở ngưỡng vận
hành giữ nguyên 0,396, nghĩa là tầng xác minh bỏ hộp sai mà không làm mất người nào. Khoảng tin cậy 95 % tính bằng bootstrap
theo khối 30 giây; khoảng của hai hiệu số đều không chứa 0. Hai ảnh bên phải là ví dụ: một khung không có người, detector vẽ
8 hộp sai trên vệt hồng, sau tầng hai còn 1. Với Ảnh rõ, nhóm em làm phép thử mù: người chấm xem hai ảnh mà không biết bên
nào đã xử lý, và chọn Ảnh rõ ở cả 25 trên 25 cặp.

**Để học**:
- mAP50 0,120 → 0,210; báo nhầm −67 %; recall không đổi.
- Khoảng tin cậy của hiệu số không chứa 0.
- A/B mù 25/25 cho Ảnh rõ.
- Giải thích: mAP50 là độ chính xác trung bình khi coi một hộp là đúng nếu chồng với hộp nhãn từ 50 % trở lên (IoU ≥ 0,5);
  nó tổng hợp cả độ chính xác lẫn độ phủ ở mọi ngưỡng. Con số 0,21 nghe thấp nhưng đây là người cao khoảng 54 điểm ảnh
  trên ảnh mờ và ám hồng. Bootstrap theo khối nghĩa là lấy mẫu lại nhiều lần theo khối 30 giây chứ không theo từng khung,
  vì các khung trong một khối không độc lập. Khoảng Wilson cho tỉ lệ 25/25 cho biết dù chỉ 25 cặp, tỉ lệ thật vẫn trên 86 %.
- Thuật ngữ: **mAP50** (mean Average Precision ở IoU 0,5), **recall** (tỉ lệ người thật được tìm thấy), **A/B mù** (so sánh hai phương án mà người chấm không biết bên nào là bên nào).

---

## S29 · Phần 8 · AI

**Tiêu đề**: AI chạy trên GPU laptop, p95 89,5 ms mỗi khung kể cả Ảnh rõ

**Bố cục**: trái (1,0; 1,6; 9,6; 5,4): F39. Dưới trái (1,0; 7,2; 9,6; 3,3): 3 ô số ngang. Phải (11,0; 1,6; 7,9; 6,0): F40.
Dưới phải (11,0; 7,8; 7,9; 2,7): 2 thẻ "Trang Bay / Camera & AI" và "Lịch sử bay".

**Khối nội dung**:
- 3 ô số: **89,5 ms** p95 cả hệ · **4,2 đến 4,7 %** khung bị bỏ · **0** lỗi pipeline
- Thẻ 1 **Trang Bay, Camera & AI**: video có hộp người vẽ chồng, nút Ảnh rõ bật sẵn, khung "Model AI" báo từng model chạy
  CUDA kèm ms p50/p95; sự kiện "phát hiện người" vào nhật ký.
- Thẻ 2 **Lịch sử bay**: gốc và Ảnh rõ cạnh nhau hoặc thanh trượt theo đầu phát, bật tắt hộp người, zoom chung một khung nhìn.
- Dòng chân trái (12 pt): Phát lại 600 khung bay theo nhịp thật ~7,2 khung/s, RTX 4060 Laptop, GPU ở xung 780 đến 802 MHz.

**Hình**:
- F39, biểu đồ native bar ngang xếp chồng, 2 thanh: "p50" = detector 57,4 + verifier 0,03 + Ảnh rõ 15,4 (tổng ghi 76,3);
  "p95" = detector 63,4 + verifier 8,9 + Ảnh rõ 19,3 (tổng ghi 89,5, cộng các bước 91,6 vì p95 từng bước không cộng thẳng;
  ghi nhãn tổng theo số đo, không theo tổng thanh, và thêm chú thích nhỏ "tổng đo trực tiếp"). Màu: detector đỏ `BB2025`,
  verifier xanh `326CE5`, Ảnh rõ hổ phách `B45309`. Đường dọc nét đứt navy ở 138 ms nhãn "1 khung ở 7,2 khung/s". Nguồn:
  F05 A6, bảng ms từng bước (đường dẫn gốc ở dòng Nguồn).
- F40, ảnh chụp màn hình `D:\XLA\docs\nop-bai-src\slide-v4\img\web_vision_full.jpg`. **Cắt/che nhãn**: cắt nhãn "Nguồn giả",
  che mọi chip tên model có số phiên bản bằng chip trơn "detector", "verifier", "Ảnh rõ".

**Hiệu ứng**: F39 `wipe-r` 800 ms → 3 ô số `zoom` stagger 120 ms → F40 `fade` → 2 thẻ `rise` stagger 120 ms.

**Nguồn**: `D:\XLA\results\v2\iotcv\README.md` mục 2, 3 (`bench.json` cùng thư mục) theo F05 A6; 138 ms = 1 000 / 7,2;
Lịch sử bay `frontend/src/components/flights/AiViewer.tsx`, `AiCompare.tsx`, `lib/zoom.ts`, `backend/flights/ai.py` (F05 A6).

**Ghi chú người nói**: Ba model, gồm detector, verifier và bộ lọc Ảnh rõ, đều chạy bằng ONNX Runtime trên GPU của laptop.
Nhóm em đo bằng cách phát lại 600 khung từ một chuyến bay thật đúng nhịp camera, khoảng 7,2 khung mỗi giây. Tổng thời gian
mỗi khung ở phân vị 95 là 89,5 mili giây, nhỏ hơn khoảng 138 mili giây giữa hai khung, nên AI theo kịp camera. Khoảng 4 tới
5 % khung bị bỏ khi AI bận, và không có lỗi nào trong pipeline. Số đo này lấy lúc GPU chạy xung thấp, khoảng 800 MHz; ghi
kèm điều kiện để số đo lặp lại được. Trên web, video ở trang Bay và Camera và AI có hộp người vẽ chồng, khung Model AI báo
từng model đang chạy và mất bao nhiêu mili giây. Ở trang Lịch sử bay, người xem đặt khung gốc và Ảnh rõ cạnh nhau, phóng
to cùng một chỗ ở cả hai bên.

**Để học**:
- p95 89,5 ms < 138 ms giữa hai khung: theo kịp camera.
- Detector chiếm phần lớn thời gian; verifier gần như miễn phí.
- Số đo kèm điều kiện GPU.
- Giải thích: p50 là trung vị, p95 là mức mà 95 % số khung nhanh hơn. Với hệ thời gian thực, p95 quan trọng hơn trung bình
  vì các khung chậm mới làm video giật. Verifier có p50 gần 0 vì phần lớn khung không có hộp nào qua tầng một, nên không cần
  chạy. Chính sách "lấy khung mới nhất, chậm thì bỏ" giữ độ trễ thấp: thà bỏ vài khung còn hơn hiển thị hộp người của ảnh
  đã cũ một giây.
- Thuật ngữ: **p50 / p95** (phân vị 50 và 95), **ONNX Runtime** (bộ chạy model định dạng ONNX), **CUDA** (nền tảng tính toán GPU của NVIDIA).

---

## S30 · Phần 9 · Thực nghiệm

**Tiêu đề**: Kiểm phần cứng 12/12 đạt; 4 motor 41 lần khởi động, 0 lần khựng

**Bố cục**: trái (1,0; 1,6; 9,4; 8,9): bảng 12 dòng. Phải trên (10,8; 1,6; 8,1; 4,4): F41. Phải dưới (10,8; 6,2; 8,1; 4,3): F42.

**Khối nội dung**:
- Bảng (Hạng mục | Số đo chính), 12 pt, cột kết quả là dấu tích xanh lá:

| Hạng mục | Số đo chính |
|---|---|
| FC F405 V5 | lỗi nội bộ 0, CPU ≤ 40 %, RAM trống 49 đến 54 KB |
| IMU | \|a\| 998 mG, rung đứng 0,01 đến 0,07 m/s², clip 0 |
| Baro | 1 010,2 hPa, ồn 0,2 đến 0,3 Pa |
| La bàn IST8310 | 385 đến 388 mG, dao động 0,5 mG |
| Tham số FC | 889 tham số, đủ ID accel và la bàn |
| 4 ESC + 4 motor | 41 lần khởi động, 0 khựng, lệch vòng ≤ 2,8 % |
| Bộ thu + FS-i6X | 1 000 đến 2 000 µs, failsafe < 0,1 s |
| TFmini Plus | bám 10 đến 260 cm, giữ ~113 cm ±2 cm |
| Pin 4S | 15,20 V = 3,80 V/cell |
| ESP32 DroneBridge | FC trả `AUTOPILOT_VERSION` sau 0,21 s |
| Camera ESP32-S3 | 150/150 khung, VGA 7,6 khung/s |
| Cơ khí | motor quay êm, mối hàn và tụ lành |

- Tiêu đề nhỏ F41: Motor Test không cánh: vòng quay ở ga 13 % và 30 %
- Tiêu đề nhỏ F42: Vòng quay 4 motor trong 283 s Motor Test

**Hình**:
- F41, biểu đồ native clustered bar: trục X M1 (sau-phải), M2 (trước-phải), M3 (sau-trái), M4 (trước-trái); 2 cột mỗi motor:
  ga 13 % (xanh `326CE5`), ga 30 % (đỏ `BB2025`); nhãn số 2 100 / 4 514, 2 100 / 4 514, 2 042 / 4 471, 2 071 / 4 509. Trục Y 0
  đến 5 000. Nguồn: `D/motor-test-rpm-20261115.csv`, cột `motor`, `rpm_ga_13pct`, `rpm_ga_30pct`.
- F42, biểu đồ native line 4 đường (`rpm_m1` đỏ, `rpm_m2` xanh, `rpm_m3` xanh lá, `rpm_m4` hổ phách), X = `t_s` 0 đến 283.
  Dùng cả 483 dòng. Không marker, nét 1,25 pt. Nguồn: `D/motor-test-chuoi-20261115.csv`.

**Hiệu ứng**: bảng `wipe-d` 900 ms → F41 `wipe-u` 700 ms → F42 `wipe-r` 900 ms.

**Nguồn**: `plans/reports/261115-kiem-phan-cung-that.md` mục 1, 2, 3 (`D/kiem-phan-cung-20261115.csv`,
`D/motor-test-esc-20261115.csv`; F04 mục 1).

**Ghi chú người nói**: Ngày 15/11 nhóm em kiểm toàn bộ phần cứng với drone không lắp cánh, pin cắm suốt, đọc số liệu qua
MAVLink bằng script. Mười hai hạng mục đều đạt. Bo bay không có lỗi nội bộ, tải CPU dưới 40 %. Cảm biến gia tốc đọc 998
mili g khi nằm yên, gần đúng 1 g, rung gần như bằng không. TFmini bám vật từ 10 tới 260 centimet. Bo DroneBridge cho thấy
MAVLink hai chiều: laptop hỏi, bo bay trả lời sau 0,21 giây. Phần motor do người vận hành bấm Motor Test trong Mission
Planner, script chỉ ghi số đo. Bốn motor khởi động tổng 41 lần, không lần nào khựng. Ở ga 30 %, bốn motor quay từ 4 471
tới 4 514 vòng mỗi phút, lệch nhau không quá 2,8 %. Biểu đồ dưới là vòng quay theo thời gian của cả phiên thử.

**Để học**:
- 12/12 hạng mục đạt, kiểm không cánh.
- 41 lần khởi động, 0 khựng, lệch vòng ≤ 2,8 %.
- Motor Test do người bấm, script chỉ đọc.
- Giải thích: ESC gửi telemetry vòng quay từng motor về bo bay, nên Motor Test có số đo thật thay vì chỉ nghe tiếng. Lệch
  vòng quay nhỏ giữa bốn motor ở cùng mức ga cho thấy motor, ESC và dây pha đồng đều. "Khựng" là khi motor không bắt được
  vòng quay lúc khởi động; 0 trên 41 lần là bằng chứng cài đặt ESC hợp với motor KV thấp. MAVProxy chia một cổng USB cho
  Mission Planner (người bấm) và script (ghi số đo) cùng lúc.
- Thuật ngữ: **Motor Test** (cho từng motor quay ở mức ga cố định), **telemetry ESC** (ESC gửi vòng quay, nhiệt, dòng), **clip** (số lần gia tốc kế chạm trần đo).

---

## S31 · Phần 9 · Thực nghiệm

**Tiêu đề**: 11 chuyến bay thật: 25,1 phút trên không, 1 547 m, cao 18,3 m

**Bố cục**: trên (1,0; 1,6; 17,9; 1,6): 5 ô số ngang (3,4 × 1,6 in). Dưới trái (1,0; 3,5; 10,6; 7,0): bảng 11 dòng. Dưới phải
(11,9; 3,5; 7,0; 7,0): F43.

**Khối nội dung**:
- 5 ô số: **11** chuyến cất cánh · **25,1** phút trên không · **1 547 m** quãng đường ngang · **9/11** chuyến bay mission AUTO ·
  **4 338 mAh** pin dùng
- Bảng (Chuyến | Giây | Chế độ | Cao | Xa | mAh), 12 pt:

| Chuyến | Trên không (s) | Chế độ | Cao (m) | Xa (m) | mAh |
|---|---|---|---|---|---|
| 01/11 20:12 | 207 | Stabilize, Loiter, RTL | 15,3 | 35,3 | 562 |
| 01/11 20:18 | 171 | Loiter, AUTO, RTL | 15,4 | 34,9 | 506 |
| 01/11 20:24 | 81 | Loiter, AUTO | 8,2 | 3,9 | 239 |
| 01/11 20:26 | 86 | Loiter, AUTO | 15,1 | 5,1 | 251 |
| 01/11 20:28 | 114 | Loiter, AUTO | 18,1 | 29,3 | 345 |
| 02/11 10:10 | 103 | Loiter, RTL | 18,2 | 42,0 | 285 |
| 02/11 10:14 | 136 | Loiter, AUTO | 18,3 | 49,6 | 380 |
| 02/11 10:23 | 119 | Loiter, AUTO | 15,6 | 28,9 | 339 |
| 02/11 10:26 | 143 | Loiter, AUTO | 16,6 | 28,7 | 407 |
| 02/11 10:30 | 149 | Loiter, AUTO | 15,2 | 27,2 | 428 |
| 02/11 10:40 | 199 | Loiter, AUTO, GUIDED | 18,1 | 27,8 | 596 |

**Hình**: F43, biểu đồ native combo: cột "giây trên không" (đỏ `BB2025`, trục trái 0 đến 250) cho 11 chuyến lấy cột `bay_s`
của `D/chat-luong-bay.csv`; đường "độ cao lớn nhất (m)" (navy `1E293B`, marker tròn, trục phải 0 đến 20) lấy cột
`max_alt_m` của `D/chuyen-bay-tom-tat.csv` theo cùng thứ tự dòng. Nhãn trục X theo cột "Chuyến" của bảng trên (dòng 1 dùng
"01/11 20:12" dù CSV ghi 20:13). Đường ngang nét đứt hổ phách ở 18 m trục phải nhãn "trần 20 m trừ lề 2 m".

**Hiệu ứng**: 5 ô số `zoom` stagger 100 ms → bảng `wipe-d` 900 ms → F43 `wipe-r` 900 ms.

**Nguồn**: tổng 11 chuyến, 1 547 m, 4 338 mAh: `uv run python -m backend.flights --events` ngày 26/11/2026,
`D/chuyen-bay-tom-tat.csv` cột `path_m`, `used_mah`; 25,1 phút: cột `bay_s` của `D/chat-luong-bay.csv` (tổng 1 508 s) từ
`logs/fc-dataflash-2026110*-bay-ngoai-troi/phan-tich-00*.md`; bảng F04 mục 2.

**Ghi chú người nói**: Đây là bằng chứng bay thật: 11 chuyến cất cánh trong hai buổi, tối 01/11 và sáng 02/11. Tổng thời
gian trên không là 25,1 phút, quãng đường ngang cộng lại 1 547 mét, dùng 4 338 mAh pin. Chín trong mười một chuyến bay
mission tự động. Bảng bên trái liệt kê từng chuyến. Chuyến xa nhất ra tới 49,6 mét, chuyến cao nhất 18,3 mét, đúng bằng
trần 20 mét trừ lề 2 mét của rào ảo. Chuyến dài nhất là chuyến 10:40 ngày 02/11, kéo dài 199 giây, cũng là chuyến nạp
mission mới khi drone đang bay mà em trình bày ở phần trạm mặt đất. Biểu đồ bên phải đặt thời gian trên không cạnh độ cao
lớn nhất của từng chuyến; đường nét đứt cho thấy không chuyến nào vượt mức 18 mét mà bo bay cho phép leo.

**Để học**:
- 11 chuyến, 25,1 phút, 1 547 m, 4 338 mAh.
- 9/11 chuyến AUTO.
- Cao nhất 18,3 m = trần 20 m trừ lề 2 m.
- Giải thích: một chuyến được tính khi drone lên quá 1 mét sau khi ARM. "Thời gian trên không" khác "thời gian ARM" vì drone
  còn đứng đất lúc chờ trước khi cất cánh và sau khi hạ. Mức 18,3 m đến từ rào ảo: khi người lái đẩy ga lên, bo bay dừng
  leo ở trần trừ lề, và các chuyến cao nhất đều chạm đúng giới hạn này. Rào ảo đã chạy trên SITL và chạy đúng như vậy
  trên drone thật.
- Thuật ngữ: **mAh** (miliampe giờ, lượng điện đã dùng), **thời gian trên không** (lúc độ cao > 1 m), **quãng đường ngang** (tổng chiều dài vệt bay chiếu xuống mặt đất).

---

## S31b · Phần 9 · Thực nghiệm

**Tiêu đề**: Ngoài bãi bay: Mission Planner kiểm GPS, web ghi lại từng chuyến

**Bố cục**: trái (1,0; 2,05; 7,4; 5,95): ảnh `img/real/mp-bay-that-ban-do.png`, dưới là 3 chip số và chú thích. Giữa
(8,75; 2,05; 5,2; 8,45): `img/real/lsb-danh-sach-hai-ngay.png`. Phải (14,25; 2,05; 4,65): `img/real/lsb-1040-ban-do.png`
và 2 thẻ.

**Khối nội dung**:
- Chip: **21 vệ tinh** · **HDOP 0,6** · **GPS 3D dgps**
- Chú thích trái: Mission Planner trên laptop ngoài bãi, 01/11; kiểm GPS và la bàn trước khi cất cánh
- Chú thích phải: Đường bay chuyến 02/11 10:40
- **Mỗi lần ARM một dòng** · ghi giờ, độ cao, quãng xa, chế độ bay
- **Bấm là phát lại** · bản đồ, camera, biểu đồ chạy cùng đầu phát

**Hình**: ảnh chụp Mission Planner hôm bay (cắt bản đồ, bỏ dòng HUD đỏ và thanh tác vụ); danh sách chuyến 01/11 và 02/11
và bản đồ chuyến 10:40 chụp từ trang `/flights` (`img/MANIFEST-2.md`).

**Hiệu ứng**: ảnh MP + chip `fade` → danh sách `wipe-d` → bản đồ `zoom` → 2 thẻ `rise` stagger 120 ms.

**Nguồn**: ảnh MP của người dùng 01/11/2026; `img/MANIFEST-2.md`; số chuyến S31.

**Ghi chú người nói**: Slide này là hai buổi bay thật ngoài bãi. Ảnh bên trái chụp Mission Planner trên laptop ngay tại bãi ngày 01/11, trước khi cất cánh. Lúc đó GPS thấy 21 vệ tinh, HDOP 0,6, tức là vị trí đủ tin để bay mission. Ở giữa là danh sách chuyến trên trang Lịch sử bay của web. Mỗi lần ARM là một dòng, ghi giờ, độ cao lớn nhất, quãng xa nhất và các chế độ đã đi qua. Lần ARM mà drone không rời đất cũng có dòng riêng, ghi rõ không cất cánh, nên 11 chuyến trên slide trước chỉ đếm những lần bay thật. Bên phải là đường bay của chuyến 10:40 trên ảnh vệ tinh. Bấm vào một dòng là bản đồ, hình camera và các biểu đồ phát lại cùng một mốc thời gian.

**Để học**:
- Trước khi bay: kiểm GPS (số vệ tinh, HDOP) và la bàn.
- Web ghi mỗi lần ARM thành một chuyến, kể cả lần không cất cánh.
- Phát lại theo một đầu phát chung.
- Giải thích: HDOP đo độ phân tán hình học của các vệ tinh đang thấy; càng nhỏ thì vị trí càng chính xác, dưới 1 là tốt.
  Số vệ tinh nhiều và HDOP thấp là điều kiện để chế độ Loiter, AUTO giữ vị trí ổn. Ghi cả lần ARM không cất cánh giúp tách
  các lần chỉ thử motor khỏi chuyến bay thật khi tính thời gian bay và quãng đường.
- Thuật ngữ: **HDOP** (độ suy giảm độ chính xác theo phương ngang), **dgps** (GPS có hiệu chỉnh vi sai), **ARM** (mở khoá motor).

---

## S32 · Phần 9 · Thực nghiệm

**Tiêu đề**: Chuyến 10:40: 2 mission nối nhau, 199 s, pin 15,56 xuống 15,14 V

**Bố cục**: trái (1,0; 1,6; 8,4; 8,9): F44. Phải trên (9,8; 1,6; 9,1; 4,4): F45. Phải dưới (9,8; 6,2; 9,1; 4,3): F46.

**Khối nội dung**:
- Chú thích F44 (dưới hình, 13 pt): Vệt GPS 3D, mét Đông/Bắc tính từ home; màu theo chế độ bay.
- Chú giải mode chung cho F44, F45: Loiter xám `9CA3AF` · AUTO đỏ `BB2025` · GUIDED hổ phách `B45309`.
- Nhãn sự kiện trên F45 (chữ 10 pt, mũi tên dọc): 28,3 s "1 Takeoff" · 76,8 s GUIDED giữ chỗ · 77,9 s "Flight plan received" ·
  106,7 s AUTO từ điểm 1 · 170,2 s "8 RTL" · 213,5 s DISARM
- Tiêu đề nhỏ F46: Điện áp và dòng pin

**Hình**:
- F44, TikZ 3D (pgfplots `\addplot3`): đọc `D/chuoi-20261102-104039.csv`, bỏ dòng trống `lat_deg`; x = (lon_deg − 105,7292325)
  × 103 900 (m Đông), y = (lat_deg − 21,0437839) × 110 574 (m Bắc), z = `alt_m`. Phối cảnh `view={-35}{25}`, lưới đáy xám,
  bóng vệt chiếu xuống đáy màu xám nhạt. Đường tô theo cột `mode`: LOITER xám, AUTO đỏ, GUIDED hổ phách, nét 1,5 pt. Chấm
  navy "home" ở gốc; ngôi sao hổ phách tại điểm GUIDED (t 76,8 s). Trục z 0 đến 20 m.
- F45, biểu đồ native line: X `t_since_arm_s` 0 đến 215, Y `alt_m` 0 đến 20. Một đường navy. Tô nền theo `mode` bằng hình chữ
  nhật mờ phía sau vùng vẽ (Loiter xám, AUTO đỏ nhạt `FCEBEC`, GUIDED hổ phách nhạt `FDF2E1`); tính ranh giới từ chỗ cột `mode`
  đổi giá trị. Nguồn: `D/chuoi-20261102-104039.csv`.
- F46, biểu đồ native line 2 trục: `batt_v` (đỏ, trục trái 14,5 đến 17) và `batt_a` (xanh `326CE5`, trục phải 0 đến 18) theo
  `t_since_arm_s`. Đường ngang nét đứt đỏ đậm ở 14,0 V nhãn "ngưỡng RTL". Nguồn: cùng CSV.

**Hiệu ứng**: F44 `zoom` 800 ms → F45 `wipe-r` 1 000 ms → nhãn sự kiện `fade` stagger 120 ms → F46 `wipe-r` 900 ms.

**Nguồn**: CSV xuất từ `backend/flights` (log `logs/fc-dataflash-20261102-bay-ngoai-troi/009-20261102-034039.bin`, tlog
`logs/tlog/20261102-104243.tlog`), F04 mục 2 "Chuỗi thời gian"; mốc sự kiện F04 mục 2 (sự kiện `[FL]`); 199 s và pin
15,56 → 15,14 V F04 bảng chuyến; home theo F04 mục 2 "Lưu ý khi vẽ".

**Ghi chú người nói**: Em đi sâu vào một chuyến, chuyến 10 giờ 40 ngày 02/11. Hình trái là vệt GPS ba chiều tính bằng mét
quanh điểm cất cánh, tô màu theo chế độ bay. Biểu đồ trên bên phải là độ cao theo thời gian. Drone cất cánh ở Loiter, tới
giây thứ 28 chuyển AUTO và bay mission thứ nhất qua các điểm 2 tới 6. Ở giây 76,8, từ web dưới đất nhóm em gửi một mission
mới; backend chuyển GUIDED, drone đứng giữ chỗ, một giây sau bo bay báo đã nhận lộ trình. Người lái gạt AUTO ở giây 106,7
và drone bay mission mới từ điểm 1, qua bảy điểm rồi tự về hạ cánh, cách home 9 centimet. Biểu đồ dưới là pin: điện áp đi
từ 15,56 xuống 15,14 vôn, còn cách xa ngưỡng về nhà 14 vôn, dòng có lúc lên khoảng 16 ampe khi leo.

**Để học**:
- Hai mission nối nhau trong một chuyến, nạp mission thứ hai khi đang bay.
- GUIDED giữ chỗ ở 76,8 s, AUTO lại ở 106,7 s.
- Pin cuối chuyến 15,14 V, còn xa ngưỡng 14,0 V.
- Giải thích: chuyến này cho thấy cả chuỗi phần mềm làm việc với drone thật ngoài trời. Ba nguồn dữ liệu (log bo bay, tlog
  của backend, video) được ghép trên cùng trục thời gian nên có thể đặt sự kiện "Flight plan received" đúng lên đường độ
  cao. Dòng tăng vọt lúc leo và lúc tăng tốc là bình thường; điện áp sụt theo dòng rồi hồi lại khi treo. Hạ cánh cách home
  0,09 m là nhờ GPS M10 có 28 vệ tinh và HDOP 0,53 ở chuyến này.
- Thuật ngữ: **vệt GPS** (chuỗi vị trí theo thời gian), **toạ độ ENU** (Đông, Bắc, Lên tính từ một gốc), **sụt áp** (điện áp pin giảm khi dòng lớn).

---

## S33 · Phần 9 · Thực nghiệm

**Tiêu đề**: Bay ổn định: rung ≤ 26,1, EKF ≤ 0,45, hạ cách home 0,03 đến 0,24 m

**Bố cục**: trên (1,0; 1,6; 17,9; 1,6): 4 ô số ngang (4,3 × 1,6 in). Dưới trái (1,0; 3,5; 8,8; 7,0): F47. Dưới phải
(10,1; 3,5; 8,8; 7,0): F48.

**Khối nội dung**:
- 4 ô số:
  - **26,1 m/s²** · rung lớn nhất (ngưỡng tốt < 30), clip 0
  - **0,45** · tỉ số kiểm EKF lớn nhất (< 1 là tốt)
  - **0,6 đến 1,6°** · bám góc RMS roll và pitch
  - **54 °C** · nhiệt ESC lớn nhất
- Tiêu đề nhỏ F47: Rung p95 trục Z từng chuyến
- Tiêu đề nhỏ F48: Khoảng cách hạ cánh tới home
- Dòng chân (12 pt): GPS 15 đến 28 vệ tinh, HDOP ≤ 0,89 ở mọi chuyến; dòng trung bình 8,2 đến 10,1 A.

**Hình**:
- F47, biểu đồ native bar dọc 11 cột (đỏ `BB2025`), Y = `vibe_z_p95_ms2` (10,8 đến 19,5), trục Y 0 đến 32; đường ngang nét
  đứt xanh lá `15803D` ở 30 nhãn "ngưỡng tốt 30". Nhãn X theo `chuyen_vn` (dòng 1 hiển thị "01/11 20:12"). Nguồn:
  `D/chat-luong-bay.csv`.
- F48, biểu đồ native bar dọc 11 cột (navy `1E293B`), Y = `ha_cach_home_m` (0,03 đến 0,24), trục 0 đến 0,3 m, nhãn số trên
  cột dạng "0,13". Nguồn: `D/chat-luong-bay.csv`.

**Hiệu ứng**: 4 ô số `zoom` stagger 100 ms → F47 `wipe-u` 800 ms → F48 `wipe-u` 800 ms.

**Nguồn**: `D/chat-luong-bay.csv` (cột `vibe_z_p95_ms2`, `vibe_max_ms2`, `roll_rms_deg`, `pitch_rms_deg`, `ekf_ty_so_max`,
`ve_tinh_it_nhat`, `hdop_max`, `dong_tb_a`, `esc_nhiet_max_c`, `ha_cach_home_m`), gốc `logs/fc-dataflash-20261101-bay-ngoai-troi/phan-tich-001.md`,
`logs/fc-dataflash-20261102-bay-ngoai-troi/phan-tich-00n.md`, `plans/reports/261102-phan-tich-bay-01-11.md` mục 3 (F04 mục 2).

**Ghi chú người nói**: Slide này trả lời câu hỏi drone bay có ổn định không, dựa trên log của bo bay ở cả 11 chuyến. Rung
là chỉ số đầu tiên: ArduPilot coi dưới 30 mét trên giây bình phương là tốt, rung lớn nhất của nhóm em là 26,1 và không chuyến
nào có clip, tức gia tốc kế chưa lần nào chạm trần đo. Biểu đồ trái là rung phân vị 95 trục Z, buổi sáng 02/11 thấp hơn
rõ so với buổi tối hôm trước. EKF, bộ lọc ước lượng vị trí, có tỉ số kiểm lớn nhất 0,45, dưới mức 1 là tốt. Bo bay bám góc
lệnh với sai số trung bình dưới 1,6 độ. Biểu đồ phải là độ chính xác hạ cánh: mọi chuyến tự hạ, dù bằng RTL hay hết mission,
đều cách điểm cất cánh từ 3 tới 24 centimet.

**Để học**:
- Rung lớn nhất 26,1 < 30, clip 0.
- EKF ≤ 0,45; bám góc RMS ≤ 1,6°.
- Hạ cách home 0,03 đến 0,24 m.
- Giải thích: rung cao làm gia tốc kế đọc sai, EKF ước lượng sai độ cao và vị trí, drone có thể tự leo hay trôi. "Clip" là
  khi rung vượt dải đo của cảm biến, khi đó số đo mất hẳn thông tin. Tỉ số kiểm EKF so sai lệch giữa dự đoán và số đo thật
  của GPS, baro, la bàn với mức cho phép; dưới 1 nghĩa là các cảm biến đồng thuận. Hạ cánh chính xác tới vài centimet nói
  lên chất lượng của GPS và la bàn đã hiệu chỉnh.
- Thuật ngữ: **rung (VIBE)** (độ rung gia tốc kế bo bay ghi lại), **tỉ số kiểm EKF** (innovation test ratio), **RMS** (căn trung bình bình phương sai số).

---

## S34 · Phần 9 · Thực nghiệm

**Tiêu đề**: Sản phẩm hoàn chỉnh: bay mission ngoài trời, lái từ web, tìm người

**Bố cục**: trái (1,0; 1,6; 6,6; 8,9): F02 (render 3D) với nhãn dưới. Phải (7,9; 1,6; 11,0; 8,9): lưới 3 cột × 4 hàng ô số
(3,55 × 2,1 in, khe 0,15), mỗi ô một số lớn 30 pt + mô tả 13 pt; viền trái màu theo nhóm.

**Khối nội dung** (12 ô, nhóm màu):
- Phần cứng (đỏ): **12/12** hạng mục kiểm đạt · **0/41** lần motor khựng · **24 %** flash còn trống sau 54 tính năng
- Bay thật (navy): **11** chuyến, **25,1** phút trên không · **9/11** chuyến bay AUTO · **0,03 đến 0,24 m** hạ cách home
- Mạng và an toàn (xanh): **0/150** gói mất khi đứng đất · **6 đến 7 ms** dead-man khi đóng tab · **1,07 m** dừng trước cột (SITL)
- Phần mềm và AI (xanh lá): **512 + 320** test đạt · **10/10** runner SITL · **89,5 ms** p95 AI mỗi khung
- Nhãn F02: Drone S500 · ArduCopter 4.7.1 · 2 ESP32 · web GCS tự viết

**Hình**: F02 render 3D (dùng lại), góc khác S02 nếu agent ảnh có nhiều góc. Nguồn: `img/lap-rap-3d-*.png`.

**Hiệu ứng**: F02 `fade` → 12 ô `zoom` theo hàng, stagger 90 ms.

**Nguồn**: 12/12, 0/41 F04 mục 1; 24 % F02 mục 1; 11 chuyến, 25,1 phút, 9/11, hạ 0,03 đến 0,24 m F04 mục 2; 0/150 F03 mục 8;
6 đến 7 ms F04 mục 5; 1,07 m F04 mục 6; 512 + 320 F03 mục 6; 10/10 `D/sitl-runner.csv`; 89,5 ms F05 A6.

**Ghi chú người nói**: Đây là các con số của sản phẩm cuối cùng. Về phần cứng, mười hai hạng mục kiểm đều đạt, motor không
khựng lần nào trong 41 lần khởi động, firmware 54 tính năng vẫn còn trống một phần tư flash. Về bay thật, drone đã bay 11
chuyến ngoài trời, tổng 25 phút, chín chuyến bay mission tự động, chuyến nào cũng tự hạ cách điểm cất cánh dưới 25
centimet. Về mạng và an toàn, cấu hình mạng ngoài bãi không mất gói nào khi đứng đất, dead-man dừng drone trong vài mili
giây khi tab đóng, và trên SITL drone tự dừng trước cột cách hơn một mét. Về phần mềm, 512 test backend và 320 test web
đều đạt, mười runner SITL đều đạt, còn AI xử lý mỗi khung trong dưới 90 mili giây ở phân vị 95. Ảnh bên trái là chính chiếc drone đó.

**Để học**:
- Nhớ 4 nhóm số: phần cứng, bay thật, mạng và an toàn, phần mềm và AI.
- Ba số nên thuộc: 11 chuyến, 0,03 đến 0,24 m, 512 + 320 test.
- Mỗi số đều có nguồn ở slide trước.
- Giải thích: slide tổng hợp gom lại số liệu đã trình bày, xếp theo bốn khâu của hệ thống để người nghe thấy mỗi khâu đều có
  bằng chứng đo được. Khi thầy cô hỏi về một con số, có thể quay lại slide tương ứng: phần cứng ở S30, bay ở S31 đến S33,
  mạng ở S17, dead-man ở S21, kiểm thử ở S23, AI ở S28 và S29. Ba con số khó có được nhất là hạ cánh 0,03 đến 0,24 m, 0 lần khựng và 25/25 ở phép thử mù, vì mỗi số cần cả phần cứng lẫn phần mềm chạy đúng.
- Thuật ngữ: **bằng chứng đo được** (số đọc từ log, báo cáo, test chứ không ước lượng), **phân vị 95** (95 % trường hợp tốt hơn mức này).

---

## S35 · Kết

**Tiêu đề**: Em xin cảm ơn thầy cô đã lắng nghe

**Bố cục**: slide kết theo `chrome.py` (nền đỏ hoặc trắng như slide bìa). Giữa trái (1,0; 3,0; 10,0; 2,0): chữ "Cảm ơn thầy cô"
56 pt; dưới (1,0; 5,2; 10,0; 1,0): "Hỏi đáp" 30 pt. Phải (11,0; 2,0; 7,9; 6,8): F01 (dùng lại, bản nhỏ hơn hoặc màu trắng
nếu nền đỏ). Dưới cùng (1,0; 9,0; 17,9; 0,8): 1 dòng repo.

**Khối nội dung**:
- Cảm ơn thầy cô · Hỏi đáp
- Dòng dưới (14 pt): Drone quadcopter tuần tra tự hành · môn Internet of Things · PTIT

**Hình**: F01 dùng lại (TikZ 3D drone).

**Hiệu ứng**: chữ cảm ơn `rise` 600 ms → "Hỏi đáp" `fade` → F01 `float` 800 ms.

**Nguồn**: không có số.

**Ghi chú người nói**: Phần trình bày của em đến đây là hết. Em xin cảm ơn thầy cô đã lắng nghe. Nếu thầy cô có câu hỏi về
bất kỳ phần nào, từ phần cứng, cấu hình bay, đường truyền MAVLink, phần mềm trạm mặt đất cho tới phần AI hay số liệu các
chuyến bay, em xin được trả lời. Những con số chi tiết hơn như log từng chuyến, bảng tham số hay kết quả kiểm thử, em có
thể mở trực tiếp từ repo của dự án để thầy cô xem.

**Để học**:
- Chuẩn bị mở nhanh: trang Lịch sử bay, file tham số `01-base.param`, bảng chuyến bay.
- Câu hỏi hay gặp: vì sao tách UBEC, vì sao mất Wi-Fi không RTL, vì sao custom build, AI chạy ở đâu.
- Trả lời ngắn, dẫn về slide có số.
- Giải thích: phần hỏi đáp thường xoay quanh lý do của các lựa chọn thiết kế. Bốn câu trả lời nên thuộc: UBEC tách để Wi-Fi
  của ESP32 không gây sụt áp lên bo bay; `FS_GCS_ENABLE 0` vì tay cầm là đường lái chính và tầm Wi-Fi ngắn hơn tầm RC;
  custom build vì bản dựng sẵn thiếu Proximity mà flash chỉ 1 MB; AI chạy bằng ONNX Runtime trên GPU laptop, còn bo camera chỉ
  nén và gửi ảnh MJPEG. Mọi câu trả lời nên dẫn về một con số đã có trên slide.
- Thuật ngữ: **lựa chọn thiết kế** (quyết định kỹ thuật kèm lý do), **repo** (kho mã nguồn của dự án).
