# Hình bài làm (asg): bản vẽ lại theo hệ thật cuối cùng

Nguồn TikZ: `docs/thuyet-trinh/tex/asg/fig/<tên>.tex` (chỉ thân `tikzpicture`). Dựng:

```
cd docs\thuyet-trinh\tex\asg
py -3.13 prep_img.py        # một lần: ảnh linh kiện nền trong suốt vào tex/asg/img/
py -3.13 mkasg.py           # mọi hình -> img/asg/<tên>.png (300 dpi, nền trong suốt)
py -3.13 mkasg.py f5_daydien --zoom 0.6 0.0 0.4 0.5   # thêm ảnh cắt 600 dpi để soát (tex/asg/_build/)
```

Mỗi hình vẽ đúng cỡ in trên slide (đơn vị mm), nên chữ 14 pt trong nguồn là 14 pt trên slide. Font Be Vietnam Pro,
bảng màu PTIT giống `tex/mkfig.py`. Bản xem trên nền trắng: `tex/asg/_build/<tên>-white.png`.
Ảnh gốc ở `assignment/` chỉ được đọc, không sửa gì ở đó.

| PNG | Cỡ in (in) | Tỉ lệ | Cho thấy |
|---|---|---|---|
| `f5_daydien.png` | 17,91 × 8,82 | 2,03 : 1 | sơ đồ nối dây đầy đủ (hình 5.6): FC, ESC, 4 motor, GPS, bộ thu, tay phát, TFmini, ESP32 DroneBridge, camera ESP32-S3, còi, pin, tụ, UBEC, bảng chia, laptop, chú giải màu dây |
| `f5_lienket.png` | 17,91 × 8,82 | 2,03 : 1 | liên kết thiết bị và giao thức theo ba vùng: trên drone, laptop trạm mặt đất, người dùng |
| `f5_botri.png` | 12,01 × 8,82 | 1,36 : 1 | bố trí linh kiện nhìn từ trên, số motor, chiều quay, 7 chú thích |
| `f5_logic.png` | 12,01 × 8,82 | 1,36 : 1 | thiết kế logic theo khối chức năng IoT: ứng dụng, dịch vụ, truyền thông, thiết bị, cột quản lý và an toàn |
| `f5_mohinh.png` | 12,01 × 8,82 | 1,36 : 1 | bốn mô hình giao tiếp, mỗi mô hình là một kênh đang chạy: REST, bus sự kiện, MJPEG, WebSocket |
| `f5_level.png` | 12,01 × 8,82 | 1,36 : 1 | hệ đặt vào IoT mức 6: nút đầu cuối, máy chủ trung tâm (laptop), người dùng |

Kiểm chung cho cả 6 hình: không còn ESP32-CAM, OV2640, XIAO, AI-Thinker, MQTT, Mosquitto, YOLO, em-dash hay en-dash
(grep trên `fig/*.tex`), không số phiên bản phần mềm.

## f5_daydien: sửa gì so với hình cũ (`assignment/_build/out/f5_daydien.png`)

Dữ kiện (đối chiếu `facts/01-phan-cung.md` mục 1 đến 3, `facts/02-firmware-cau-hinh.md` bảng SERIAL):

1. Khối **ESP32-CAM (OV2640)** bỏ hẳn. Thay bằng ảnh thật bo **Camera ESP32-S3 N16R8 + OV3660** (`img/anh-camera-s3.jpg`,
   cắt theo viền bo), ghi "không nối FC", nhận 5V và GND từ bảng chia của UBEC.
2. TFmini: dây **trắng RXD không còn "để trống"**; nối pad **T3** (dây xanh TXD vào R3, đỏ vào 5V, đen vào G của FC).
3. Tụ **1000 µF 35 V** sửa thành **1500 µF 35 V**, vẽ song song hai pad nguồn ESC.
4. Bỏ khối **PDB "đế dưới khung S500"**: pin XT60 nối thẳng pad + / − của ESC; UBEC hàn song song cùng hai pad đó
   (facts 01 mục 3). Bỏ "UBEC vào 2–6S" (chưa có nguồn), ghi "vào thẳng pin 4S".
5. Thêm **bảng chia nguồn 5 V** sau UBEC, nuôi ESP32 DroneBridge (VIN 5V, GND) và camera (5V, GND). Hình cũ kéo GND
   UBEC chập vào dây GND UART của ESP32.
6. Nhãn cổng đổi từ "UART2/3/4/6" sang bảng SERIAL thật: **SERIAL2** MAVLink2 115200 (DroneBridge), **SERIAL3** TFmini
   115200, **SERIAL4** GPS 230400 (+ I2C la bàn), **SERIAL6** i-BUS, **SERIAL5** = pad T của cáp stack (telemetry ESC).
7. Laptop "FastAPI, MQTT, YOLO, web" sửa thành **"FastAPI · AI ONNX GPU · web React"**. Hai liên kết Wi-Fi ghi
   MAVLink2 UDP 14550 và MJPEG :81.
8. Cáp stack: bỏ "cáp SH1.0 10 chân (kèm theo stack)" vì facts lệch nhau về số chân (facts 01 ghi 10, facts 02 ghi 8);
   chỉ vẽ 8 tín hiệu V G C T M1 đến M4 và ghi nghĩa từng nhóm.
9. Phụ đề FC bỏ số phiên bản ArduPilot; giữ STM32F405, ICM-42688, SPA06. TFmini bỏ "0,1–12 m" (dải dùng là 0,1 đến
   6 m, ghi ở `f5_botri`). Motor thêm vị trí (trước trái, sau phải...) cạnh chiều quay.

Bố cục:

10. Lưới đều: hàng pad cách 9 mm, cao 7 mm; bốn cột pad cố định (thiết bị trái, FC trái, FC phải, thiết bị phải). Mọi
    dây vẽ bằng anchor của chính pad, nên **dây nằm ngang và chạm đúng mép pad** ở cả hai đầu (đã soát bằng ảnh cắt 600 dpi).
11. **Không nhãn nào nằm trên dây**: tên cổng thành tiêu đề nhóm đặt ở khoảng trống giữa hai nhóm pad; ghi chú cáp stack
    đặt trong khối FC. Dây không đi qua chữ hay ảnh.
12. Chỗ cắt duy nhất (dây − của ESC đi qua thanh VBAT) vẽ bằng **cầu vượt** chuẩn sơ đồ; điểm nối có chấm.
13. Pad + / − vẽ trùng hai pad đồng thật trên ảnh ESC; hàng pad V G C T 1 2 3 4 trùng đầu cắm in trên ảnh ESC.
14. Ảnh linh kiện nền trong suốt, cỡ nhìn gần nhau (GPS 25 mm, bộ thu 36, tay phát 23, motor 15, ESP32 42 cao, TFmini 21,
    camera 52; FC 56 và ESC 44 lớn hơn để đọc pad).
15. Màu dây khớp chú giải: thêm màu riêng cho "tín hiệu ESC" (C, M1 đến M4) và "vô tuyến" (mọi liên kết Wi-Fi và AFHDS
    đều nét đứt xanh). Chú giải là một hàng ở đáy, tự dàn theo bề rộng chữ, không còn hộp chật.
16. Bỏ lời chú "phía trên hình không tương ứng với mũi": đây là sơ đồ điện, vị trí thật nằm ở `f5_botri`.
17. Chữ nhỏ nhất 14 pt ở cỡ in 17,9 × 8,8 in (hình cũ 5,4 đến 5,8 pt trên khổ 260 mm, phóng ra cỡ này chỉ khoảng 9,5 pt).

## Các hình còn lại: sửa gì

- `f5_lienket`: ESP32-CAM OV2640 thành Camera ESP32-S3 (OV3660, không nối FC). Bỏ MQTT broker, Mosquitto, dashboard,
  `mqtt_probe`, "MQTT publish/subscribe". Bộ nhận diện YOLO thành "AI ONNX GPU, thread riêng: tìm người, ảnh rõ". Liên kết
  ghi đúng thứ đang chạy: Wi-Fi UDP 14550, Wi-Fi MJPEG :81, TCP 5760 (SITL), REST + WS 8 Hz, video MJPEG tới trình duyệt.
  Giao thức của từng thiết bị đặt trong hộp (SERIALn), nên không nhãn nào nằm trên dây. Cỡ đổi sang 17,9 × 8,8 in vì ba
  vùng ngang cần chỗ cho chữ 14 pt.
- `f5_botri`: chú thích 6 cũ ("ESP32-CAM nhìn thẳng xuống, 2 UBEC") sửa theo hướng dẫn lắp ráp: camera ESP32-S3 ở mép
  trước chĩa xuống khoảng 30°; ESP32 DroneBridge, một UBEC, bảng chia ở tầng dưới phía sau. Thêm chú thích 7 (pin dưới
  tấm đế), bát chống rung 30,5 × 30,5 mm, GPS cao 8 đến 10 cm, bộ thu cách dây nguồn từ 5 cm, đường chéo 480 mm.
  Khung vẽ theo tỉ lệ 0,3 (cánh 10 in đúng cỡ so với càng). Bỏ khoảng trống lớn của hình cũ; chữ 14 pt.
- `f5_logic`: bỏ "Dashboard IoT (MQTT)", "Xuất bản MQTT 4 topic", "MQTT TCP 1883", "YOLO", "ESP32-CAM OV2640", "hợp đồng
  có phiên bản v", "Wi-Fi WPA2" (không có nguồn). Thêm dịch vụ có thật: AI ONNX GPU, ghi tlog/video, lịch sử bay, bus sự
  kiện (vòng đệm 200, `GET /api/events`). Cột an toàn ghi số có nguồn: dead-man 350 ms, rào 100 m, trần 20 m, 12 mã lỗi.
- `f5_mohinh`: ô (b) "Xuất bản, đăng ký (MQTT)" thay bằng bus sự kiện nội bộ đang chạy (`backend/events.py`: nguồn
  telemetry, AI camera, dead-man; nơi nhận mỗi tab `/ws` và `GET /api/events`). Ô (c) nguồn ảnh là Camera ESP32-S3, nơi
  kéo là AI và các tab. Bỏ en-dash trong tiêu đề.
- `f5_level`: bỏ MQTT broker và "Nút quan sát dashboard MQTT, mqtt_probe"; lưu trữ ghi tlog, video, log FC, sự kiện; nút
  quan sát thành "Xem lại sau bay, trang Lịch sử bay". Camera ESP32-S3 thay ESP32-CAM. Bỏ cụm "đóng vai trò" (luật BRIEF).
  Thêm mũi tên hai chiều trực tiếp giữa bộ điều khiển và ứng dụng.

## Còn lưu ý

- Pad B+ của còi tô màu 5 V: theo nhãn pad của FC, facts không ghi điện áp còi.
- Ảnh ESP32 DevKit, TFmini, GPS, motor là ảnh hãng (`assignment/_build/img/parts/`), không phải ảnh chụp bo của nhóm;
  camera là ảnh chụp thật.
- Số chân cáp stack chưa thống nhất trong facts (8 hay 10), hình không ghi số chân.
