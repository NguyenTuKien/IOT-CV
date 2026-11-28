# Kết luận và hướng phát triển

Chương này tóm lại những gì sản phẩm đã làm được, đối chiếu với các chương trước, rồi nêu các hướng nhóm em thấy đáng
làm tiếp, kèm đặc điểm hiện tại của hệ thống ở từng chỗ.

## Kết quả đạt được

Nhóm em đã làm ra một hệ thống IoT hoàn chỉnh quanh một quadcopter S500 bay được thật: nút cảm biến và chấp hành là
drone, đường truyền là Wi-Fi 2,4 GHz qua hai bo ESP32, máy chủ xử lý là laptop chạy backend và AI, người dùng làm việc
qua website. Cụ thể:

1. **Phần cứng.** Drone S500 với FC SpeedyBee F405 V5, ESC OX32 55A, bốn motor 920 KV, GPS u-blox M10, cảm biến
   khoảng cách TFmini Plus, bo DroneBridge ESP32 và camera ESP32-S3 + OV3660, pin 4S 5300 mAh. Kiểm trên bàn 12/12
   hạng mục đạt; Motor Test 41 lần khởi động không lần nào khựng, vòng quay bốn motor lệch nhau không quá 2,8 %.
2. **Firmware và cấu hình.** ArduPilot 4.7.1 bản build riêng có thêm tính năng dùng rangefinder làm cảm biến vật cản.
   Bộ tham số lưu thành file trong repo, nạp bằng chuỗi script; rào ảo trần 20 m và bán kính quanh home, failsafe mất
   sóng tay cầm, failsafe pin hai mức 14,0 V và 13,2 V.
3. **Truyền thông.** MAVLink 2 từ FC qua UART tới ESP32 DroneBridge rồi qua UDP 14550 tới laptop; camera MJPEG qua
   HTTP. Cấu hình mạng ngoài bãi cho 0/150 gói mất khi đứng gần; lúc bay MAVLink dùng được tới khoảng 49 m với mất gói
   trung vị 3,9 % mỗi chuyến.
4. **Trạm mặt đất.** Backend FastAPI giữ một kết nối MAVLink, phát telemetry 8 Hz qua WebSocket, nhận 10 loại lệnh có
   giới hạn nhịp, có dead-man riêng dừng drone 6 đến 7 ms sau khi đóng tab (đo trên SITL). Website React có 11 trang: buồng lái, soạn
   và nạp mission, không gian 3D, camera và AI, lịch sử bay ghép log FC, tlog và video theo giờ GPS.
5. **AI xử lý ảnh chất lượng thấp.** Ba model chạy trên GPU laptop: bộ phát hiện người, tầng xác minh và bộ làm rõ ảnh.
   Tầng xác minh tăng mAP50 từ 0,120 lên 0,210 và giảm báo nhầm khoảng 67 % mà không mất người nào; trong đánh giá mù,
   người chấm chọn ảnh đã làm rõ ở 25/25 cặp. Cả hệ chạy p95 89,5 ms mỗi khung.
6. **Kiểm thử.** 10/10 runner SITL đạt, trong đó cấu hình ngoài trời 8/8; web 9/9 bài nghiệm thu trên SITL; 512 test
   backend và 320 test frontend đạt.
7. **Bay thật.** 11 chuyến ngoài trời, 25,1 phút trên không, 1 547 m quãng đường; 9 chuyến bay mission AUTO, mọi
   chuyến tự hạ cách home 0,03 đến 0,24 m; nạp được mission mới khi đang bay; rào và trần độ cao giữ đúng; rung, EKF,
   pin đều trong ngưỡng.

Bảng: Đối chiếu yêu cầu của đề tài với sản phẩm {#tab:c10-doi-chieu}
| Yêu cầu | Sản phẩm | Chương |
|---|---|---|
| Thu thập dữ liệu cảm biến | IMU, GPS, la bàn, khí áp, TFmini, pin, camera | 2, 3 |
| Truyền dữ liệu không dây | MAVLink qua Wi-Fi UDP, MJPEG qua HTTP | 5 |
| Xử lý ở máy chủ | backend FastAPI, AI trên GPU laptop | 6, 8 |
| Giám sát và điều khiển từ xa | website 11 trang, lệnh qua WebSocket | 6 |
| An toàn khi mất liên kết | failsafe FC, dead-man backend, rào ảo | 4, 6 |
| Kiểm chứng | SITL, test tự động, 11 chuyến bay thật | 7, 9 |

## Hướng phát triển

**Tăng tầm hình ảnh.** Hiện camera giữ 7,6 đến 7,8 khung/s trong bán kính khoảng 15 m, xa hơn thì thưa dần vì card
Wi-Fi trong laptop vừa là điểm phát vừa là máy thu. Hướng làm tiếp là thay điểm phát bằng một bộ phát Wi-Fi ngoài có
anten tốt hơn, chỉnh vị trí anten của hai bo trên khung, hoặc giảm băng thông bằng khung nhỏ hơn khi bay xa. MAVLink
cần ít băng thông nên sẽ được lợi theo.

**Tránh vật cản nhiều hướng và trong AUTO.** TFmini Plus là một tia hẹp 3,6° nhìn thẳng trước, nên FC chỉ tránh vật
cản khi bay LOITER, ALT_HOLD và GUIDED, còn AUTO bay đúng lộ trình đã soạn (`OA_TYPE 0`). Backend đã có sẵn nhánh đọc
`OBSTACLE_DISTANCE` cho cảm biến 360°. Khi gắn thêm cảm biến quét quanh thân, có thể bật bộ tìm đường tránh vật cản của
ArduPilot cho cả mission.

**Đưa lái tay từ web ra bãi bay.** Lái bằng bàn phím, dead-man và bài tay cầm giành lại quyền từ web đã đạt trên SITL.
Bước tiếp theo là chạy cùng bộ bài đó trên drone thật ở tốc độ 0,5 m/s rồi 1,0 m/s, có người cầm tay phát.

**AI.** Bộ làm rõ ảnh hiện dùng thuật toán cổ điển chạy trực tiếp. Một model siêu phân giải lớn hơn có thể chạy sau
chuyến bay trên video đã ghi; nhóm em chỉ đưa nó vào sản phẩm khi thắng rõ bản cổ điển trong đánh giá mù. Dữ liệu bay
thật càng nhiều thì bộ phát hiện người càng có thêm khung để huấn luyện và chấm điểm.

**Giám sát từ xa qua Internet.** Hiện mọi dữ liệu nằm trên laptop ở bãi bay. Backend đã có bus sự kiện nội bộ (phát hiện
người, pin yếu, mất liên kết, tiến độ mission), nên có thể đẩy các sự kiện này lên một máy chủ đám mây để người ở xa theo dõi
chuyến bay mà không cần đứng cạnh laptop.
