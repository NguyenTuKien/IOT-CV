# Firmware và phần mềm

Drone có ba bo vi điều khiển, mỗi bo chạy một firmware riêng: bo bay SpeedyBee F405 V5 chạy ArduCopter, bo ESP32
DevKit chạy DroneBridge để chuyển MAVLink từ UART sang Wi-Fi, bo ESP32-S3 chạy firmware camera do nhóm em viết.
Chương này trình bày từng firmware, cách nạp và cách kiểm sau khi nạp, rồi đến các phần mềm và script trên laptop
dùng cho mọi việc từ nạp firmware tới chạy drone ảo.

Bảng: Ba firmware trên drone {#tab:c3-ba-firmware}

| Bo | Firmware | Nguồn | Nạp bằng |
|---|---|---|---|
| SpeedyBee F405 V5 (STM32F405) | ArduCopter 4.7.1, bản dựng riêng | custom.ardupilot.org | STM32CubeProgrammer qua DFU |
| ESP32 DevKit (CP2102, COM4) | DroneBridge for ESP32 2.4.1 | mã nguồn mở, có sẵn | esptool qua USB |
| ESP32-S3 N16R8 + OV3660 (COM7) | firmware camera của nhóm | `firmware/camera/` | PlatformIO qua USB hoặc OTA |

## Firmware bo bay ArduCopter

### Bo bay giữ drone trên không thế nào

ArduCopter là phần điều khiển nhiều cánh quạt của dự án mã nguồn mở ArduPilot, chạy trên hệ điều hành thời gian thực
ChibiOS của bo STM32F405. Việc của nó chia làm hai nửa: ước lượng trạng thái và điều khiển.

Phần ước lượng dùng bộ lọc Kalman mở rộng EKF3 (`AHRS_EKF_TYPE 3`, `EK3_ENABLE 1`). Bộ lọc dự đoán tư thế, vận tốc
và vị trí bằng con quay và gia tốc kế ở tần số cao, sau đó sửa dự đoán bằng các phép đo chậm hơn nhưng không trôi:
baro cho độ cao, la bàn cho hướng mũi, GPS cho vị trí. Mỗi phép đo được gán trọng số theo độ tin cậy của nó, nên
khi GPS kém thì EKF dựa nhiều hơn vào IMU và ngược lại. Kết quả là một ước lượng trạng thái duy nhất cho mọi vòng
điều khiển phía sau.

Phần điều khiển là các vòng xếp tầng. Vòng ngoài nhận mục tiêu (cần gạt của người lái, điểm mission, vận tốc từ web)
và sinh góc nghiêng mong muốn. Vòng góc dùng bộ điều khiển P để đổi sai lệch góc thành tốc độ quay mong muốn. Vòng
tốc độ quay dùng PID, tức lệnh u = Kp·e + Ki·∫e dt + Kd·de/dt với e là sai lệch tốc độ quay, để sinh mô-men cần có. Bộ
trộn motor chia mô-men đó ra bốn motor theo kiểu khung, rồi gửi lệnh số DShot300 tới ESC.

Bảng: Các tầng điều khiển và hệ số đang chạy trên bo (trục roll) {#tab:c3-tang-dieu-khien}

| Tầng | Vào | Ra | Tham số |
|---|---|---|---|
| Ước lượng | IMU, baro, la bàn, GPS | tư thế, vận tốc, vị trí | EKF3 |
| Vòng góc | góc mong muốn, góc ước lượng | tốc độ quay mong muốn | `ATC_ANG_RLL_P` 4,5 |
| Vòng tốc độ quay | tốc độ quay mong muốn, con quay | mô-men | P 0,135, I 0,135, D 0,0036 |
| Trộn motor | mô-men, lực nâng | lệnh 4 motor | khung Quad X, DShot300 |

Nhóm em giữ nguyên hệ số PID mặc định của ArduCopter cho khung cỡ S500. Lực ga treo do bo tự học trong lúc bay,
giá trị đang lưu là `MOT_THST_HOVER` 0,189. Các con số trong bảng đọc từ bản chụp 889 tham số của bo ngày 15/11/2026.

### Bản dựng riêng 54 tính năng

Bo F405 chỉ có 1 MB flash, nên bản ArduCopter dựng sẵn cho bo này đã bị cắt bớt tính năng. Bản đó không có nhóm
Proximity, tức là ArduCopter không coi TFmini Plus là cảm biến tránh vật cản được. Nhóm em dựng bản riêng trên
custom.ardupilot.org: chọn tính năng trong một file yaml (`firmware/ardupilot/custombuild/speedybeef4v5-copter471-tfminiplus.yaml`),
kéo thả lên trang, máy chủ biên dịch và trả về file firmware. ArduPilot có 410 tính năng chọn được, bản dựng sẵn của
bo bật 110. File yaml của nhóm bật thêm 6, tắt bớt 62, còn lại 54 tính năng.

Bảng: Sáu tính năng bật thêm và cờ biên dịch tương ứng {#tab:c3-bat-them}

| Tính năng | Cờ trong `extra_hwdef.dat` | Dùng để |
|---|---|---|
| `PROXIMITY` | `HAL_PROXIMITY_ENABLED 1` | có nhóm tham số `PRX1_*` |
| `PROXIMITY_RANGEFINDER` | `AP_PROXIMITY_RANGEFINDER_ENABLED 1` | dùng TFmini làm cảm biến proximity |
| `AC_AVOID_ALTHOLD` | `AP_AVOIDANCE_ALTHOLD_ENABLED 1` | tránh vật cản bằng góc nghiêng ở AltHold |
| `AC_OAPATHPLANNER` | `AP_OAPATHPLANNER_ENABLED 1` | bộ tìm đường tránh vật (`OA_*`) |
| `EKF3_WINDEST` | `EK3_FEATURE_DRAG_FUSION 1` | EKF3 ước lượng gió |
| `CRASHCATCHER` | `AP_CRASHDUMP_ENABLED 1` | lưu bản dump khi firmware lỗi |

Phần tắt bớt đều là thứ drone không có: OSD, MSP, VTX và điều khiển camera (không bay FPV); các giao thức tay cầm
CRSF, GHST, SBUS, SRXL, PPM (chỉ giữ iBUS cho bộ thu FlySky); telemetry FrSky, CRSF, Spektrum (telemetry đi bằng
MAVLink); GPS kiểu NMEA (GPS M10 là u-blox); khung Hexa, Octa, Tri; dù, rally, càng thu, cảm biến tốc độ gió; các
LiDAR TF02, TF03. Trong tám driver la bàn chỉ giữ IST8310, IST8308 và QMC5883L. Ba tính năng được cân nhắc nhưng
không bật: telemetry iBUS về tay phát (hết UART trống), GyroFFT (F405 yếu) và script Lua (1 MB không đủ chỗ).

Bảng: Dung lượng và file của bản dựng `d450a747` {#tab:c3-flash}

| Mục | Giá trị |
|---|---|
| Vùng flash dành cho firmware | 999 424 byte |
| Firmware chiếm | 759 588 byte |
| Còn trống | 239 820 byte (24 %) |
| File nạp lần đầu `arducopter_with_bl.hex` | 2 224 308 byte, gồm bootloader |
| File cập nhật `arducopter.apj` | 700 098 byte, nạp qua Mission Planner |

Muốn biết bo đang chạy đúng bản dựng riêng, chỉ cần tìm ba tham số mà bản dựng sẵn không có: `PRX1_TYPE`,
`AVOID_ANG_MAX` và `SERVO_BLH_POLES`. Bo thật có đủ cả ba, banner khởi động in `ArduCopter V4.7.1 (dbe79216)` và tên
bo `speedybeef4v5`.

### Nạp firmware và tham số bằng ba lệnh

Chip STM32 có sẵn trong ROM một chương trình nạp theo chuẩn DFU (Device Firmware Upgrade) qua USB. Chương trình này
chạy được kể cả khi flash trống, nên không thể "hỏng hẳn" do nạp lỗi. Cách thường làm là giữ nút BOOT trong lúc cắm
cáp. Script của nhóm gửi lệnh `MSP_REBOOT` kiểu bootloader tới firmware đang có trên bo, bo tự khởi động vào DFU mà
không cần bấm nút. Trước khi ghi, script đọc mức RDP (Read Protection) của chip: giá trị `0xAA` nghĩa là flash
không bị khoá đọc, sao lưu và đọc lại được.

![Chuỗi nạp gồm ba script: nạp firmware qua DFU, kiểm bo bay, nạp tham số và đọc lại.](docs/thuyet-trinh/img/tikz/F10.png){#fig:c3-chuoi-nap w=15}

```
uv run --with pyserial python scripts/fc/nap_dfu.py
uv run --with pyserial python scripts/fc/kiem_fc.py COM6 --nghieng 60 `
    --luu-param firmware/ardupilot/params/00-after-flash.param
uv run --with pyserial python scripts/fc/nap_param.py COM6 firmware/ardupilot/params/01-base.param
```

Mỗi bước trong @fig:c3-chuoi-nap đều đọc lại thứ vừa ghi. `nap_dfu.py` ghi file hex rồi đọc ngược toàn bộ vùng
vừa ghi để so từng byte, sau đó chạy chương trình bằng lệnh `-s 0x08000000` và đợi cổng USB `1209:5741` của
ArduPilot đứng yên 8 s. `kiem_fc.py` đọc banner, danh sách cảm biến, yêu cầu người cầm nghiêng bo để kiểm dấu của
con quay, rồi chụp toàn bộ tham số ra file. `nap_param.py` ghi file `.param`, khởi động lại bo bằng
`MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN`, đọc lại từng dòng; tham số nào chỉ xuất hiện sau khi khởi động lại thì nạp nốt,
tối đa ba lần. Script trả mã thoát có nghĩa: 1 là lỗi hoặc cần bấm BOOT, 2 là sai bo, 3 là chip khoá đọc, 4 là cần
rút cắm cáp.

Bảng: Kết quả lần nạp trên bo thật {#tab:c3-ket-qua-nap}

| Bước | Kết quả |
|---|---|
| Hỏi tên bo qua MSP | `SPEEDYBEEF405V5`, đúng bo |
| Mức khoá đọc | RDP `0xAA` |
| Sao lưu flash gốc của hãng | 1 048 576 byte, đọc trong 7,2 s, lưu ở ổ D |
| Ghi và kiểm firmware | xoá sector 0 đến 10, ghi 32,6 s, kiểm 5,6 s, `Download verified successfully` |
| Kiểm cảm biến | pitch tới −68°, roll tới +53°, đúng dấu; baro 1012,6 hPa |
| Chụp tham số | 850 tham số vào `00-after-flash.param` |
| Nạp `01-base.param` | 34/34 dòng nhận, 0 dòng bị từ chối, số tham số 850 → 861 |

## Firmware cầu MAVLink DroneBridge

Bo bay chỉ nói chuyện qua cổng nối tiếp, còn laptop ở xa vài chục mét. Cầu nối cần đọc luồng byte MAVLink từ UART2
của bo bay, đóng gói, gửi qua Wi-Fi về laptop và làm ngược lại cho chiều lệnh. Nhóm em dùng DroneBridge for ESP32
2.4.1 thay vì tự viết, vì đây là firmware có sẵn được tài liệu ArduPilot giới thiệu, đã lo việc nối lại Wi-Fi, đệm
gói và có trang web cấu hình (@fig:c3-dronebridge-web).

![Trang cấu hình của DroneBridge for ESP32: chế độ Wi-Fi, chân UART, giao thức, baud và cỡ gói (ảnh từ tài liệu của DroneBridge).](assignment/_build/img/official/dronebridge/dbesp32_webinterface.png){#fig:c3-dronebridge-web w=6.5}

Bảng: Cấu hình DroneBridge đang chạy (`firmware/dronebridge/db_params.iotcv.csv`) {#tab:c3-dronebridge}

| Khoá | Giá trị | Nghĩa |
|---|---|---|
| `esp32_mode` | 2 | STA: nối vào hotspot của laptop |
| `wifi_hostname` | `DroneBridgeESP32` | gọi bằng `DroneBridgeESP32.mshome.net` |
| `gpio_tx`, `gpio_rx` | 17, 16 | UART2 của ESP32, nối T2/R2 của bo bay |
| `baud` | 115200 | khớp `SERIAL2_BAUD 115` của bo bay |
| `proto` | 4 | MAVLink: cắt gói theo khung MAVLink |
| `trans_pack_size`, `serial_timeout` | 576 byte, 20 ms | gom byte tới 576 hoặc khi UART im 20 ms |
| `udp_client_ip`, `udp_client_port` | 192.168.137.1, 14550 | laptop trên mạng hotspot |
| `rep_rssi_dbm` | 1 | báo RSSI tính bằng dBm |

Cấu hình không nhập tay trên trang web mà ghi thẳng vào phân vùng NVS (vùng lưu cấu hình của ESP32, địa chỉ
`0x9000`, dài `0x6000`) qua USB bằng `scripts/esp32/dronebridge-nvs.ps1`. Script tự đọc tên và mật khẩu hotspot của
Windows rồi ghi vào bo, nên mật khẩu không nằm trong repo. Firmware nạp bằng esptool, chỉ chạy được ở 115 200 baud
với chip CP2102 của bo, mất khoảng 1,5 phút:

```
esptool --chip esp32 -p COM4 -b 115200 write-flash --flash-mode dio --flash-size 2MB `
    --flash-freq 40m 0x1000 bootloader.bin 0x8000 partition-table.bin `
    0x10000 db_esp32.bin 0x190000 www.bin
```

Khi kiểm ngày 15/11/2026, laptop hỏi gói `AUTOPILOT_VERSION` qua Wi-Fi và bo bay trả lời sau 0,21 s, tức liên kết
chạy đủ hai chiều. Bo DroneBridge cũng tự phát gói HEARTBEAT của riêng nó mỗi giây; chương 5 nói cách backend tách
gói này khỏi HEARTBEAT của bo bay.

## Firmware camera ESP32-S3

Bo camera là ESP32-S3 N16R8 (flash 16 MB, PSRAM 8 MB) gắn module OV3660. Firmware do nhóm em viết trên PlatformIO,
framework Arduino, dùng thư viện camera của Espressif. Nó phải làm ba việc: phát video cho backend qua Wi-Fi, cho
backend đổi mức nén trong lúc bay, và cho nạp lại khi bo đã gắn lên khung.

!![Bo camera ESP32-S3 N16R8 với module OV3660: mặt trên và mặt dưới.](docs/thuyet-trinh/img/anh-camera-s3.jpg|docs/thuyet-trinh/img/anh-camera-s3-duoi.jpg){#fig:c3-bo-camera w=6.5}

Bảng: Cấu hình build của firmware camera (`firmware/camera/platformio.ini`) {#tab:c3-pio}

| Mục | Giá trị |
|---|---|
| Môi trường | `esp32s3_n16r8`, `board = esp32-s3-devkitc-1` |
| Bộ nhớ | `memory_type = qio_opi` (flash QIO, PSRAM octal), phân vùng `default_16MB.csv` |
| Cờ build | `-DCAMERA_MODEL_ESP32S3_EYE -DBOARD_HAS_PSRAM` |
| Toolchain | espressif32 7.1.3, Arduino core 2.0.17 |
| Ảnh | VGA 640×480, JPEG chất lượng 12, XCLK 10 MHz |
| Bộ đệm | 2 khung trong PSRAM, chế độ `CAMERA_GRAB_LATEST` |

Firmware chạy hai máy chủ HTTP trên hai cổng. Máy chủ HTTP của ESP-IDF xử lý từng yêu cầu một, mà `/stream` thì không
bao giờ kết thúc; nếu chung cổng, lệnh đổi chất lượng sẽ phải chờ tới khi luồng video đóng. Vì vậy luồng video ở cổng
81, các lệnh còn lại ở cổng 80.

Bảng: Các đường dẫn HTTP của firmware camera {#tab:c3-camera-http}

| Đường dẫn | Cổng | Việc |
|---|---|---|
| `GET /stream` | 81 | luồng MJPEG liên tục, `multipart/x-mixed-replace` |
| `GET /set?quality=N` | 80 | đổi chất lượng JPEG lúc đang chạy, N từ 0 đến 63 |
| `GET /status` | 80 | JSON: `quality`, `rssi`, `frames_sent`, `free_psram`, `firmware_sha`, `partition`… |
| `POST /update` | 80 | nạp firmware qua Wi-Fi, kèm token và MD5 |

MJPEG là cách phát video đơn giản nhất qua HTTP: máy chủ trả một phản hồi không kết thúc, chia thành nhiều phần, mỗi
phần là một ảnh JPEG trọn vẹn kèm tiêu đề riêng. Bên nhận chỉ cần tách theo chuỗi ranh giới là có từng khung, không
phải giải mã liên khung như H.264, nên AI xử lý được bất kỳ khung nào. Mỗi khung mang tiêu đề `X-Jpeg-Quality` ghi
mức nén thật của nó. Sau một lệnh `/set`, firmware bỏ 4 khung chuyển tiếp còn nằm trong hàng đợi rồi mới gắn nhãn mới,
để backend luôn đọc đúng mức đang dùng.

Hai lựa chọn phần cứng trong firmware có lý do đo được. Xung nhịp XCLK cấp cho cảm biến đặt 10 MHz: ở 20 MHz, nhiễu từ
đường xung nhịp lọt sang Wi-Fi của chính bo, thông lượng chỉ còn khoảng 60 KB/s so với khoảng 295 KB/s ở 10 MHz, và có
khung JPEG hỏng. Bộ đệm hai khung với chế độ lấy khung mới nhất làm cho người xem luôn nhận hình hiện tại, không bị
khung cũ dồn lại khi Wi-Fi chậm.

Chỉ số "quality" của JPEG trên ESP32 là chỉ số nén ngược: 12 là nét, số càng lớn thì nén càng mạnh.
@fig:c3-jpeg cho thấy cỡ khung VGA theo chỉ số này. Backend tự chỉnh trong dải 12 đến 40: dưới 4 khung/s thì tăng chỉ
số thêm 7, trên 6,5 khung/s liền 10 s thì giảm lại. Từ 12 lên 40 khung nhẹ đi khoảng 37 %. Quá khoảng 50 khung không
còn nhỏ đi nữa (mức 63 ra 10,0 KB, to hơn mức 50), nên dải tự chỉnh dừng ở 40.

```chart
type: line
csv: docs/thuyet-trinh/facts/data/jpeg-quality-kich-thuoc-20261115.csv
x: jpeg_quality
y: kb_moi_khung
xlabel: Chỉ số chất lượng JPEG
ylabel: KB mỗi khung (VGA)
caption: Cỡ một khung VGA theo chỉ số chất lượng JPEG, đo trên camera thật ngày 15/11/2026.
id: fig:c3-jpeg
w: 13
```

Nạp có hai đường, cùng một lệnh `scripts\esp32\nap_camera.ps1`. Qua USB, script sinh file `secrets.h` (tên, mật khẩu
hotspot, token OTA), tìm đúng cổng của chip CH343P theo VID `1A86` PID `55D3` để không bao giờ nạp nhầm sang bo khác
đang cắm, build, nạp và đọc log tới khi bo báo IP. Thêm `-Ota` thì firmware được gửi qua Wi-Fi tới `POST /update`.
Chip ghi vào khe ứng dụng còn trống (`app0` hoặc `app1`), kiểm MD5, khởi động lại; script so `firmware_sha` mà chip
báo với SHA-256 của file vừa build để chứng minh chip chạy đúng bản mới. Một bản 793 KB gửi trong khoảng 6,5 s, chạy
lại xong sau khoảng 9 s.

Kiểm qua Wi-Fi bằng `scripts/esp32/camera_check.py --frames 150` ngày 15/11/2026: nhận 150/150 khung, không khung hỏng, VGA 7,6 khung/s,
RSSI −28 dBm, PSRAM còn trống 8,2 MB.

## Phần mềm trên laptop

Laptop Windows là trạm mặt đất và cũng là nơi làm mọi việc với phần cứng. @tab:c3-cong-cu liệt kê các công cụ, phiên
bản đã ghi nhận và việc của chúng trong dự án.

Bảng: Công cụ trên laptop {#tab:c3-cong-cu}

| Công cụ | Phiên bản | Việc trong dự án |
|---|---|---|
| Mission Planner | 1.3.83 | hiệu chỉnh cảm biến, Motor Test, xem tlog |
| STM32CubeProgrammer CLI | 2.23.0 | nạp ArduPilot qua DFU, sao lưu flash |
| MAVProxy | 1.8.74 | chia một cổng USB của bo bay cho nhiều chương trình |
| pymavlink | 2.4.49 trở lên | thư viện MAVLink của backend và script |
| PlatformIO Core | 6.2.0 | build và nạp firmware camera |
| esptool | 5.4.0 | nạp DroneBridge, sao lưu flash ESP32 |
| WSL2 Ubuntu + SITL | 24.04.4, ArduCopter 4.7.1 | drone ảo, cùng commit `dbe79216` với bo thật |
| Python + uv | 3.13.7, uv 0.12.12 | backend FastAPI, mọi script |
| Node.js + pnpm | 24.13.0, 11.10.0 | build web React, Vite |
| ONNX Runtime GPU | 1.24.4 | chạy model AI trên CUDA 12, cuDNN 9 |
| `cua-driver`, Playwright | | điều khiển phần mềm có giao diện, kiểm web |

Mission Planner chỉ dùng cho việc cần người vận hành nhìn và bấm: hiệu chỉnh accel, level, la bàn, radio và Motor
Test (@fig:c3-mission-planner). Mọi việc còn lại đi qua script. MAVProxy cần vì một cổng nối tiếp chỉ mở được bởi một
chương trình; MAVProxy giữ cổng COM6 rồi phát lại luồng MAVLink ra UDP 14551 cho Mission Planner và UDP 14552 cho
script ghi số đo, hai bên chạy cùng lúc.

![Mission Planner nối drone thật ngoài bãi: chân trời giả, bảng số Quick và bản đồ vệ tinh.](docs/thuyet-trinh/img/real/mp-bay-that-full.png){#fig:c3-mission-planner w=12}

Với phần mềm có giao diện đồ hoạ, agent làm việc qua MCP server `cua-driver`: đọc cây giao diện UI Automation của
cửa sổ, bấm vào phần tử theo mã định danh (biết mình đang bấm nút nào, nút có bật không) rồi gọi `verify_state` để
kiểm trạng thái sau khi bấm. Web GCS thì kiểm bằng Playwright trên Chrome headless ở đúng cỡ 1707×900. Riêng các nút
làm motor quay (ARM, Motor Test) luôn do người vận hành bấm, tay giữ tay phát.

Python được quản lý bằng uv: mỗi lệnh `uv run ...` tự dựng môi trường đúng phiên bản thư viện khoá trong `uv.lock`, cache đặt ở `D:\DevCache`.

## Bộ script tự động hoá

Thư mục `scripts/` có 51 file chạy được, chia theo đối tượng (@tab:c3-script). Mỗi script in số đo và trả mã thoát
rõ nghĩa, nên kết quả chạy lần thứ mười giống lần đầu và ghi thẳng được vào báo cáo.

Bảng: Các nhóm script trong `scripts/` {#tab:c3-script}

| Nhóm | Số file | Việc chính |
|---|---|---|
| `scripts/fc/` | 11 | nạp DFU, kiểm bo bay, nạp tham số, kiểm toàn bộ phần cứng, đọc tay cầm, TFmini qua bo bay, tải và phân tích log |
| `scripts/esp32/` | 12 | cấu hình DroneBridge, nạp camera (USB, OTA), kiểm camera, đọc log ESP32, ping hai bo, bật hotspot, mở tường lửa |
| `scripts/sitl/` | 14 | thư viện `harness.py` nói MAVLink thật với SITL, 11 runner, `sitl-headless.sh` bật SITL nền, `run-all.sh` chạy cả bộ |
| `scripts/vision/` | 5 | chép và kiểm bundle model, đo ms từng bước, xuất dự đoán |
| `scripts/laptop/` và gốc | 9 | chế độ bay cho laptop, bật SITL và backend, dò WebSocket, kiểm dead-man |

Hai ví dụ cho thấy cách làm này. `scripts/fc/kiem_phan_cung.py` chỉ đọc, rà lỗi nội bộ của bo bay, IMU, baro, la bàn, GPS, bộ thu, TFmini, bốn ESC và pin trong một lần chạy. Script thứ hai
chuẩn bị laptop: không ngủ, Energy Saver không tự bật, card Wi-Fi chạy Maximum Performance ở cả bốn power scheme và tắt
tự quét mạng; `-Tat` trả lại như cũ khi về.
