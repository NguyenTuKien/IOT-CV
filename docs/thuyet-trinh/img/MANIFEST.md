# MANIFEST ảnh cho slide (img/)

Lập ngày 26/11/2026. Mỗi file dưới đây đã được mở xem lại sau khi xuất. Không file nào còn ESP32-CAM, OV2640, XIAO,
mật khẩu, khoá Wi-Fi hay số phiên bản (vX.Y.Z, tên bundle, "ArduCopter 4.7.1", "Mission Planner 1.3.83").
Thư mục `tikz/` không thuộc manifest này (agent khác dựng).

Công cụ: ImageMagick 7.1.2 (đọc HEIC sẵn, không cài thêm gì), Pillow 12.1 trên `py -3.13`, Chrome headless qua
`@playwright/test` của `frontend/`. Script sửa ảnh web/MP: `edit_web.py`; script chụp 3D: `r3d/shoot.cjs` (thư mục
scratchpad của phiên, có thể bị dọn; mọi toạ độ sửa ghi ở cột "Đã sửa").

## 1. Ảnh linh kiện thật (chụp điện thoại)

Chung cho mọi file `anh-*.jpg`: `-auto-orient`, thu về cạnh dài 1600 px, JPEG q90, **bỏ hết EXIF** (`-strip`, ảnh
iPhone có toạ độ GPS nơi chụp). Ảnh HEIC đã đúng chiều sau auto-orient.

| File | Thấy gì | Cỡ (px) | Nguồn gốc | Đã sửa |
|---|---|---|---|---|
| anh-fc-f405-tren.jpg | FC SpeedyBee F405 V5 mặt trên: MCU, nút BOOT, USB-C, hàng pad, chữ "F405V5" | 1200×1600 | `D:\Coding\IOT-CV\picture\FC-speedybee-f405-v5\IMG_8456.HEIC` | HEIC→JPG, chung |
| anh-fc-f405-can-canh-mcu.jpg | cận cảnh MCU, mã QR, nút BOOT, chữ SpeedyBee | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8457.HEIC` | xoay 180° cho chữ đọc xuôi, chung |
| anh-fc-f405-duoi.jpg | FC mặt dưới: 2 cuộn cảm, cổng DJI/HD, pad 4V5/9V/T3/R3, "BARO" | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8458.HEIC` | chung |
| anh-fc-f405-duoi-nghieng.jpg | mặt dưới, góc hơi khác | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8459.HEIC` | chung |
| anh-fc-f405-canh-jst-1.jpg | cạnh bên, 2 đầu cắm JST | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8460.HEIC` | chung |
| anh-fc-f405-canh-usb.jpg | cạnh có cổng USB-C | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8461.HEIC` | chung |
| anh-fc-f405-canh-jst-2.jpg | cạnh bên, 2 đầu JST (gần giống jst-1) | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8462.HEIC` | chung |
| anh-fc-f405-nghieng.jpg | mặt dưới nhìn nghiêng thấp | 1200×1600 | `...\FC-speedybee-f405-v5\IMG_8463.HEIC` | chung |
| anh-esp32-dronebridge.jpg | ESP32 DevKit CP2102 (bo DroneBridge) cả bo, module ESP-32, micro-USB | 1200×1600 | `D:\Coding\IOT-CV\picture\esp32-cp210-m\IMG_8453.HEIC` | chung |
| anh-esp32-dronebridge-can-canh.jpg | cận cảnh chip CP2102, nút BOOT/EN, nhãn chân | 1200×1600 | `...\esp32-cp210-m\IMG_8454.HEIC` | chung |
| anh-esp32-dronebridge-can-canh-2.jpg | cận cảnh CP2102 + LDO, nhãn chân TX2/RX2/D4… | 1200×1600 | `...\esp32-cp210-m\IMG_8455.HEIC` | xoay 180° cho chữ đọc xuôi, chung |
| anh-camera-s3.jpg | bo camera ESP32-S3-N16R8 mặt trên: module "ESP32-S3-N16R8", cáp "OV3660", 2 USB-C, nhãn chân | 1600×839 | `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\IMG_8497.jpg` | cắt sát bo (crop 2060×1080+280+800 trên ảnh gốc 2880×2160), chung. Còn tem bảo hành của shop (chữ "TEM BẢO HÀNH", "PHÚC MINH"): đúng vật thật, tem không được xé |
| anh-camera-s3-duoi.jpg | bo camera mặt dưới: khe microSD, nhãn "Camera / SD Card / PSRAM", "USB-UART / USB-OTG" | 1200×1600 | `...\esp32-s3-n16r8-ov3660\IMG_8498.jpg` | chung |
| anh-khung-camera-ov3660.jpg | một khung VGA thật do camera OV3660 chụp lúc kiểm bo (trong phòng, nét kém) | 640×480 | `D:\Coding\IOT-CV\logs\camera\kiem-20261115.jpg` | chỉ bỏ EXIF |

## 2. Mô hình 3D và sơ đồ của trang hướng dẫn lắp ráp

Nguồn chung: `D:\Coding\IOT-CV\docs\huong-dan\lap-rap-phan-cung.html`. Chụp trên bản sao trong scratchpad: bundle 3D dựng
lại từ `D:\Coding\IOT-CV\docs\huong-dan\lap-rap\src\scene3d.js`, chỉ thêm lệnh để lộ camera/scene/renderer (mô hình giữ
nguyên). Chrome headless, viewport 1707×900, deviceScaleFactor 2. Mô hình ở giai đoạn cuối G9, có cánh; ẩn nhãn, tia
TFmini/camera và lưới sàn; FOV 24°, khung vừa mô hình; nền trong suốt, `magick -trim` + viền trong 40 px. Đã xoá chữ in
"S500", "CẤM KHOAN" trên tấm đáy (hiện ngược khi nhìn từ trước).

| File | Thấy gì | Cỡ (px) | Đã sửa |
|---|---|---|---|
| lap-rap-3d-tren-truoc.png | drone lắp xong, nhìn chéo 3/4 từ trước-phải, cao 28° | 2360×1478 RGBA | như trên |
| lap-rap-3d-ben.png | nhìn ngang bên phải, mũi bên phải, cao ~7° | 2016×1524 RGBA | như trên |
| lap-rap-3d-tren.png | nhìn thẳng từ trên, mũi hướng lên | 1980×1274 RGBA | như trên |
| lap-rap-3d-truoc.png | nhìn từ trước, cao 10° | 2360×1368 RGBA | như trên |
| huong-dan-so-do-day-dien.png | sơ đồ đấu dây đầy đủ (trang "Sơ đồ đấu dây"): FC F405, 4 motor, GPS M10, TFmini Plus, iA6B, ESP32 DevKit, Camera ESP32-S3 / OV3660, UBEC, bảng chia, pin 4S | 2400×1874 RGB nền trắng | SVG dựng riêng trên nền trắng; bỏ tiêu đề và dòng "rê chuột / bấm"; "Laptop (Claude)" → "Laptop", "USB-C (bàn)" → "USB-C" |
| huong-dan-so-do-nguon.png | cây nguồn (trang "Sơ đồ nguồn"): pin 4S → XT60 → ESC / FC / UBEC → tải | 2400×1026 RGB nền trắng | bỏ tiêu đề, ghi chú cuối "Vì sao tách UBEC…", hộp "Smoke stopper" và mũi tên của nó; "≥ 4,7 V (đo ở D7)" → "≥ 4,7 V" |

Giới hạn: đây là mô hình đơn giản hoá của trang hướng dẫn, không phải ảnh drone thật; bo camera dưới mũi gần như không
thấy ở cả bốn góc.

## 3. Ảnh chụp màn hình web GCS

Ảnh gốc 1×, chụp ở 1707×900 (riêng `logs/sitl/*` là 1600×1000). Toạ độ sửa tính trên ảnh gốc, hộp (x0, y0, x1, y1).

| File | Thấy gì | Cỡ (px) | Nguồn gốc | Đã sửa |
|---|---|---|---|---|
| web-bay.png | trang **Bay** bản cuối (menu có "Lịch sử bay"), nối drone ảo SITL: chân trời giả, độ cao/tốc độ/hướng mũi, GPS RTK fixed 10 vệ tinh, tuổi link 51 ms, EKF OK, bản đồ + home, chế độ bay, ARM/TAKEOFF 5 m, bàn phím lái tay, nhật ký sự kiện, radar vật cản | 1707×900 | `D:\Coding\IOT-CV\plans\reports\261126-phase15-trang-bay-1707x900.png` | xoá chip "NGUỒN GIẢ" ở khung Video (587,621)-(663,643); xoá dòng chú giải "Giới hạn phần mềm 50 m — đây chỉ là lớp phụ." (420,196)-(693,213), còn lại tiêu đề "CHÚ GIẢI" |
| web-nhiem-vu-nap.png | trang **Nhiệm vụ** sau khi nạp mẫu Đi–về lên SITL: "Đã nạp xong (6 item)", "đã đọc lại từ FC", danh sách waypoint, hồ sơ độ cao, thống kê (4 waypoint, 70 m, xa home 15 m, cao 5 m, 00:12), mẫu Đi–về 15 m × 2 lượt | 1600×905 | `D:\Coding\IOT-CV\logs\sitl\web-ngoai-troi-nap-di-ve-sitl.png` | cắt bỏ thanh menu + thanh trạng thái (y < 95): bản chụp 15/11, menu khi đó chưa có mục "Lịch sử bay" |
| web-lich-su-bay.png | trang **Lịch sử bay** bản cuối: danh sách 16 chuyến (9 chuyến ngày 02/11/2026), chuyến 10:40 dài 3:34, thanh chế độ bay, khung gốc cạnh khung Ảnh rõ (khung #84), số đo gốc → ảnh rõ (độ sáng 166 → 118, tương phản 31,5 → 52,4, độ nét 64 → 506), biểu đồ độ cao / tốc độ ngang / điện áp pin theo giờ | 1707×900 | `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-classic-1707x900.png` | bỏ nút "Ảnh rõ offline (AI dựng lại)" (tính năng không ship) và kéo cụm zoom sang trái; chip "ẢNH RÕ · enhancer-v2.0.0" → "ẢNH RÕ" (cắt chip, phủ lại nền video bằng vân sỏi lấy 52 px phía dưới, viền mờ 4 px); xoá ghi chú "Enhancer v2.0.0 dựng ảnh rõ…" (1386,667)-(1687,717) |
| web-lich-su-bay-duong-bay.png | trang **Lịch sử bay**: đường bay chuyến 10:40 ngày 02/11 vẽ trên ảnh vệ tinh, khung camera đã ghi (7.5 khung/s), danh sách chuyến (cao, xa, chuỗi chế độ), thanh phát lại | 1707×747 | `D:\Coding\IOT-CV\.playwright-mcp\flights-1.png` | cắt bỏ thanh menu + thanh trạng thái (y < 95), vì thanh trạng thái đang báo "Mất liên lạc" (lúc xem lại không nối drone) |
| web-camera-ai.png | trang **Camera & AI**: khung video có lớp vẽ chồng, nút "Ảnh rõ", khung "Model AI" (Detector CUDA p50 51,1 · p95 74,2 ms; Verifier CUDA p50 0,0 · p95 6,0 ms; Ảnh rõ CUDA p50 19,1 · p95 33,8 ms; cả ba "đang chạy"), khung "Bộ nhận diện" (12 gói/s, khung gốc 640×480) | 1707×880 | `D:\Coding\IOT-CV\plans\reports\261126-phase15-vision-model-1707x900.png` | xoá chip "Nguồn giả" góc phải (1603,189)-(1694,217) và chip "NGUỒN GIẢ" khung video (954,239)-(1032,263); bỏ "v1.0.1 · ", "v1.0.0 · ", "v2.0.0 · " ở ba dòng model và kéo số p95 lên cùng dòng; phụ đề "trạng thái, phiên bản, provider, ms" → "trạng thái, provider, ms"; bỏ hàng "Ảnh rõ offline … ENHANCER_OFFLINE_ONNX chưa đặt (tắt)" (nâng mép dưới thẻ từ y 578 lên 517); cắt đáy ở y 880 (bỏ hàng "Chất lượng: nguồn giả") |

Lưu ý khi viết chú thích slide cho mục 3:
- `web-bay.png` và `web-camera-ai.png` chạy trên **drone ảo SITL**. Khung video là nguồn thử của SITL (ảnh vệ tinh sân
  bay SITL), không phải camera thật; pin "100 % 12,6 V" là pin ảo của SITL, không phải pin 4S. Chú thích nên ghi "chạy
  trên SITL", đừng gọi là khung bay thật. Radar vật cản trong `web-bay.png` báo "Không đọc được" / "cảm biến lỗi" vì
  lúc chụp SITL không có số đo TFmini.
- "Model trên laptop 205 ms (detector 204,8 ms · enhancer 111,1 ms)" trong `web-lich-su-bay.png` là số tức thời lúc
  phát lại, không phải phép đo chuẩn; đừng trích làm số liệu slide (số bench nằm ở `D:\XLA\results\v2\iotcv\README.md`).

## 4. Ảnh AI

| File | Thấy gì | Cỡ (px) | Nguồn gốc | Đã sửa |
|---|---|---|---|---|
| ai-khung-goc.jpg | khung bay thật gốc: mờ, vệt hồng trên đường đất, có người | 624×480 | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_raw.jpg` | sao nguyên |
| ai-khung-anh-ro.jpg | cùng khung sau Ảnh rõ cổ điển | 624×480 | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_classic.jpg` | sao nguyên |
| ai-khung-goc-zoom.jpg | phóng quanh người, khung gốc | 900×309 | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_raw_z.jpg` | sao nguyên |
| ai-khung-anh-ro-zoom.jpg | phóng quanh người, sau Ảnh rõ | 900×309 | `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_classic_z.jpg` | sao nguyên |
| ai-hop-khong-nguoi-tang1.jpg | khung không có người, nhiều hộp đỏ báo nhầm trên vệt hồng (chỉ tầng 1, detector) | 1280×960 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_002_00005_t1.jpg` | sao nguyên |
| ai-hop-khong-nguoi-tang2.jpg | cùng khung sau tầng 2 (verifier): còn 1 hộp | 1280×960 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_002_00005_t2.jpg` | sao nguyên |
| ai-hop-4-nguoi-tang1.jpg | khung có 4 người, sau tầng 1 (hộp xanh đúng + 1 hộp đỏ nhầm) | 1280×960 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_005_00809_t1.jpg` | sao nguyên |
| ai-hop-4-nguoi-tang2.jpg | cùng khung sau tầng 2 | 1280×960 | `D:\XLA\docs\nop-bai-src\slide-v4\img\box_005_00809_t2.jpg` | sao nguyên |
| ai-hop-4-nguoi-tang1-zoom.jpg | phóng vùng 4 người, tầng 1 | 640×360 | `D:\XLA\docs\nop-bai-src\slide-v4\img\boxz_005_00809_t1.jpg` | sao nguyên |
| ai-hop-4-nguoi-tang2-zoom.jpg | phóng vùng 4 người, tầng 2 | 640×360 | `D:\XLA\docs\nop-bai-src\slide-v4\img\boxz_005_00809_t2.jpg` | sao nguyên |
| ai-do-toi-goc-3d.png | mặt 3D hệ số sáng theo (x, y) của khung 640×480: tối dần ra góc | 944×638 | `D:\XLA\docs\nop-bai-src\slide-v4\tex\fig_png\vig3d.png` | sao nguyên |
| ai-khoi-rgb-diem-hong.png | khối RGB: điểm hồng thật tách khỏi điểm sáng thật, trục xám R = G = B | 1112×871 | `D:\XLA\docs\nop-bai-src\slide-v4\tex\fig_png\rgbcube.png` | sao nguyên (chú giải có mã lỗi "D2", không phải số phiên bản) |
| ai-web-goc-anh-ro.png | hai khung gốc ↔ Ảnh rõ trên trang Lịch sử bay | 1036×386 | cắt từ `web-lich-su-bay.png` (gốc `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-classic-1707x900.png`) | crop (341,275)-(1377,661) sau khi đã sửa chip; thay cho `D:\XLA\docs\nop-bai-src\slide-v4\img\web_lichsu.jpg` (cùng ảnh, còn chip "enhancer-v2.0.0") |
| ai-web-model-ai.png | khung "Model AI": ba model đang chạy trên CUDA với p50/p95 ms | 400×336 | cắt từ `web-camera-ai.png` (gốc `D:\Coding\IOT-CV\plans\reports\261126-phase15-vision-model-1707x900.png`) | crop (1300,226)-(1700,542) + mép dưới khung (y 584–604); thay cho `D:\XLA\...\img\web_models.jpg` (còn số phiên bản) |

`D:\XLA\docs\nop-bai-src\slide-v4\img\web_vision_full.jpg` chính là ảnh gốc của `web-camera-ai.png` (RMSE 1,2 %), nên
không sao riêng.

## 5. Mission Planner và công cụ trên SITL

Không mở Mission Planner; chỉ dùng ảnh có sẵn. Cả ba ảnh MP nối SITL qua TCP 5762.

| File | Thấy gì | Cỡ (px) | Nguồn gốc | Đã sửa |
|---|---|---|---|---|
| mp-ke-hoach-waypoint.png | tab PLAN: mission trên bản đồ vệ tinh, bảng lệnh TAKEOFF + WAYPOINT (độ cao 25 m), Home Location | 948×534 | `D:\Coding\IOT-CV\docs\so-tay\anh\03-mp-wp-list.png` | cắt thanh tiêu đề cửa sổ (y < 32: "Mission Planner 1.3.83 build … ArduCopter V4.7.1 (dbe79216)") |
| mp-doc-mission-tu-fc.png | tab PLAN sau khi bấm Read: mission đọc ngược từ FC, độ cao 5–8 m | 940×535 | `D:\Coding\IOT-CV\docs\so-tay\anh\07-mp-read-wps.png` | cắt thanh tiêu đề (y < 32) |
| mp-avoid-phanh.png | tab DATA lúc AVOID phanh: HUD, bản đồ, GroundSpeed 0,13 m/s, Yaw 1,10°, DistToMAV 20,55 | 948×534 | `D:\Coding\IOT-CV\docs\so-tay\anh\04-mp-avoid-phanh.png` | cắt thanh tiêu đề (y < 32). Ô "Sonar Range 0.00" luôn 0 với rangefinder nhìn ngang (giới hạn của MP) |
| sitl-avoid-phanh.png | đồ thị 3 ô: nhìn từ trên (cột ảo), khoảng cách tới mặt cột, tốc độ; so "doi-chung" với "tfmini-that", vạch AVOID_MARGIN 2 m | 1760×536 | `D:\Coding\IOT-CV\docs\so-tay\anh\04-avoid-phanh.png` | cắt dòng tiêu đề (y < 36: "Phase 04 — SITL ArduCopter 4.7.1, …") |
| sitl-log-viewer.png | UAV Log Viewer mở log SITL `mode-chain.BIN`: độ cao CTUN.Alt theo chuỗi chế độ GUIDED → ALT_HOLD → LOITER → AUTO → LAND → RTL, vệt bay 3D | 1567×881 | `D:\Coding\IOT-CV\docs\so-tay\anh\03-log-viewer.png` | cắt thanh tab + URL của trình duyệt (y < 85) |

## Đã xem và không dùng

- `D:\Coding\IOT-CV\picture\esp32-s3-n16r8-ov3660\vn-11134207-*.jpg` (5 ảnh shop): có watermark "PHÚC MINH".
- `D:\Coding\IOT-CV\logs\kiem-hang\esp32s3-ov3660-khung-thu-1.jpg`: khung chụp có mặt người.
- `D:\Coding\IOT-CV\frontend\screenshots\day-*.png` (15/11): có bản mới hơn; `day-flight.png` / `day-mission.png` còn
  chú giải "Giới hạn phần mềm 50 m" + "Phase 19", `day-mission.png` trống mission và trục độ cao lỗi "0.600000000000001 m",
  `day-overview.png` ghi "ArduCopter 4.7".
- `D:\Coding\IOT-CV\plans\reports\261126-phase18-*.png`: chụp lúc "Mất liên lạc"; bản Lịch sử bay đang dựng ảnh rõ offline
  (không ship) và ghi "Enhancer v1.0.0"; bản vision có "v1.0.0", detector 279 ms.
- `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-offline-tat-1707x900.png`: chủ đề tính năng không ship.
- `D:\Coding\IOT-CV\.playwright-mcp\ai-1040-*.png` (19/11): bộ làm rõ cũ.
- `D:\Coding\IOT-CV\.playwright-mcp\page-2026-11-18T19-*.png`: ảnh slide, không phải web.
- `D:\XLA\docs\nop-bai-src\slide-v4\img\ab_offline*.jpg`: siêu phân giải offline, không ship.

## Còn thiếu

- Ảnh chụp drone thật đã lắp hoàn chỉnh: không có trên đĩa; chỉ có ảnh dựng 3D ở mục 2.
- Ảnh Mission Planner trên drone thật (hiệu chỉnh accel / la bàn / radio): không có; mọi ảnh MP là SITL.
- Trang Nhiệm vụ chưa có ảnh chụp từ bản web cuối 26/11 có mission hiện trên bản đồ; `web-nhiem-vu-nap.png` là bản 15/11
  (đã cắt menu). Muốn chụp lại phải chạy backend + SITL, việc này không làm trong lượt này.
