# Nghiên cứu: pin Ovonic 4S 5300 mAh và cách đo, sạc, cất giữ LiPo

Ngày 26/10/2026. Báo cáo nghiên cứu, chỉ đọc, chưa đo trên pin thật. Mục ghi "chưa xác minh" là chưa
tìm được nguồn thứ hai hoặc chưa đo được.

## Tóm tắt

- **Chưa tìm thấy trang hãng cho Ovonic 4S 5300 mAh.** Toàn bộ 194 sản phẩm của ovonicshop.com (đọc qua
  `products.json`) có 4S 5000 / 5200 / 6000 / 6500 và 6S 5300, nhưng không có 4S 5300. Tìm Amazon, eBay,
  rcdrone.top, Shopee (từ khoá tiếng Việt) cũng không ra. Có thể là mẫu bán theo vùng, hoặc đã ngừng bán.
- Hồ sơ dự án ghi: **Ovonic 4S 5300 mAh 110C, đầu XT60, 423 g, 135 × 40 × 30 mm, cân bằng JST-XH 5 chân**
  (`docs/bao-cao-tong-quan-du-an.md` dòng 176, `docs/linh-kien-s500.html` dòng 2354). Không có link nguồn.
- **Kích thước 135 × 40 × 30 mm đáng ngờ**: 78,4 Wh trong 162 cm³ là ~484 Wh/L, trong khi viên Ovonic 4S
  5000 50C của hãng là 154 × 42 × 32 mm (~357 Wh/L). Cần **đo bằng thước kẹp và cân bếp** trước khi dựng mô
  hình 3D hay tính khối lượng.

## 1. Thông số

### 1.1 Viên của dự án (theo hồ sơ dự án, chưa xác minh với hãng)

| Mục | Giá trị | Trạng thái |
|---|---|---|
| Cấu hình | 4S1P, 14,8 V danh định, 5300 mAh = 78,4 Wh | hồ sơ dự án |
| C | 110C (bảng so sánh cũng có dòng "Ovonic 5300 50C, 508 g": có thể là biến thể khác) | **chưa xác minh** biến thể nào là viên đang có: đọc nhãn |
| Đầu xả | XT60 | hồ sơ dự án |
| Cân bằng | JST-XH 5 chân (4S) | hồ sơ dự án |
| Khối lượng | 423 g | hồ sơ dự án, cần cân lại |
| Kích thước | 135 × 40 × 30 mm | **đáng ngờ**, cần đo |
| Cỡ dây, độ dài dây | — | **chưa xác minh** (viên 5000 4S cùng hãng thường 12 AWG; viên 6S 5300 120C là 10 AWG) |
| Sạc tối đa | — | **chưa xác minh**; hãng chỉ ghi "ngừng sạc ở 4,20 V/cell". Mặc định an toàn: 1C = 5,3 A |
| Bố cục nhãn, màu | — | **chưa xác minh**; chụp 6 mặt viên thật để dựng 3D |

Phép thử C thực tế (hồ sơ dự án): drone rút tối đa ~58 A, tức ~11C; mọi biến thể ≥ 35C đều thừa.
XT60 chịu ~60 A liên tục nên cái giới hạn là đầu cắm, không phải số C.

### 1.2 Các viên Ovonic gần nhất, có trang hãng (đối chiếu kích thước và nhãn)

| Mẫu | C | Kích thước | Khối lượng | Đầu | Nguồn |
|---|---|---|---|---|---|
| 4S 5000 mAh 50C | 50C (burst 100C) | 154 × 42 × 32 mm | 448 g ±20 | XT60 + TRX | [ovonicshop](https://www.ovonicshop.com/products/ovonic-14-8v-5000mah-4s1p-50c-lipo-battery-with-xt60-trx-plug-for-rc-car-trucks) |
| 4S 5200 mAh 80C hardcase | 80C (burst 160C) | 139 × 47 × 49 mm | 450 g ±20 | EC5 | [ovonicshop](https://www.ovonicshop.com/products/ovonic-4s-lipo-battery-5200mah-50c-14-8v-rc-lipo-battery-with-ec5-plug-for-rc-1-10-1-8-vehicles-car-rc-truck) |
| 6S 5300 mAh Rebel 120C | 120C (burst 240C) | 144 × 43 × 58 mm | 740 g ±20 | EC5, cân bằng JST-XHR-7P, 10 AWG | [ovonicshop](https://www.ovonicshop.com/products/ovonic-rebel-120c-6s-5300mah-22-2v-lipo-battery-with-ec5-plug-for-arrma-rc-car) |

Ảnh hãng (đã kiểm HTTP 200, 26/10/2026), dùng tham khảo kiểu nhãn Ovonic, **không phải ảnh viên 5300 4S**:

- 4S 5000 50C: https://cdn.shopify.com/s/files/1/0153/9135/9024/products/1_cea66d4f-e78a-4bbd-b34b-477c13c23ddd.jpg?v=1744855645
- 4S 5000 50C: https://cdn.shopify.com/s/files/1/0153/9135/9024/products/2_12_O-50C-5000-4S1P-XT60_TRX.jpg?v=1760345374
- 4S 5200 80C: https://cdn.shopify.com/s/files/1/0153/9135/9024/files/0_0ee617c8-b0c0-42f3-a2d9-4015cc7473a3.png?v=1776656510
- 6S 5300 120C: https://cdn.shopify.com/s/files/1/0153/9135/9024/products/O-120C-5300-6S1P-EC5_4.jpg?v=1744855341

Pin 6S của người dùng: chưa rõ mẫu. Nếu là 6S 5000–5300 thì nặng ~700–750 g, ~111–118 Wh.

## 2. Số liệu điện hoá LiPo

| Mức (mỗi cell) | Giá trị | 4S | 6S |
|---|---|---|---|
| Danh định | 3,70 V | 14,8 V | 22,2 V |
| Đầy | 4,20 V (không vượt) | 16,8 V | 25,2 V |
| Cất giữ | 3,80–3,85 V (~40–50%) | 15,2–15,4 V | 22,8–23,1 V |
| Hạ cánh (nghỉ) | ~3,7 V (~20–30% còn lại) | 14,8 V | 22,2 V |
| Ngưỡng thấp khi có tải | 3,5 V | **14,0 V** = `BATT_LOW_VOLT` dự án | 21,0 V |
| Ngưỡng tới hạn khi có tải | 3,3 V | **13,2 V** = `BATT_CRT_VOLT` dự án | 19,8 V |
| Tuyệt đối không dưới | 3,0 V (nghỉ) | 12,0 V | 18,0 V |

Ngưỡng FC hiện tại là cho 4S. Bay 6S với ngưỡng này thì failsafe pin không bao giờ kích hoạt (đã ghi ở
`docs/phan-cung-thuc-te.md`).

### Điện áp nghỉ → % dung lượng (đo sau khi nghỉ ≥ 30 phút, không tải)

Bảng kinh nghiệm phổ biến trong giới RC, sai ±5–10%, **chưa xác minh** với đường cong của Ovonic:

| V/cell | % | V/cell | % |
|---|---|---|---|
| 4,20 | 100 | 3,82 | 45 |
| 4,11 | 90 | 3,80 | 40 |
| 4,02 | 80 | 3,77 | 30 |
| 3,95 | 70 | 3,73 | 20 |
| 3,87 | 60 | 3,69 | 10 |
| 3,84 | 50 | 3,27 | 0 |

### Lệch cell

- Pin mới, đang cất giữ: lệch < 0,05 V (hồ sơ dự án, `docs/archive/plan-nhap-92-giai-doan.md`).
- Sau bay: lệch 0,02–0,05 V là bình thường; **> 0,1 V phải theo dõi**; một cell lần nào cũng thấp hơn,
  hoặc lệch > 0,2–0,3 V, thì cho nghỉ hưu ([Oscar Liang](https://oscarliang.com/when-retire-lipo-battery/)).

### Nội trở (IR)

- Oscar Liang chỉ cho số với viên 1500 mAh: < 10 mΩ/cell tốt, 15–20 cũ, > 20 nghỉ hưu.
- Nội suy tỉ lệ nghịch với dung lượng cho viên 5300 mAh: **~2–5 mΩ/cell là khoẻ, > ~6–8 mΩ là cũ** —
  **chưa xác minh**, chỉ là ngoại suy.
- Tiêu chí đáng tin hơn con số tuyệt đối: **ghi IR từng cell lúc pin mới, đo cùng máy, cùng điện áp
  (đầy 4,20 V), cùng nhiệt độ**; một cell có IR gấp đôi các cell khác thì nghỉ hưu. IR đo bằng sạc rẻ như
  B6AC V2 chỉ dùng để so sánh với chính nó, không so với số của máy khác.

### Phồng, nhiệt độ

- Dấu hiệu bỏ pin: phồng (vỏ căng, không phẳng), móp, rách vỏ, dây hở, nóng lên khi sạc ở ≤ 1C, sau bay
  nóng không cầm được quá 10 s. Pin phồng không sửa được.
- Sạc: 0–45 °C ([Battery University BU-410](https://batteryuniversity.com/article/bu-410-charging-at-high-and-low-temperatures)).
  Không sạc pin còn ấm sau bay; chờ nguội.
- Xả: pin sau bay nên < 60 °C. Trời lạnh nội trở tăng, sụt áp mạnh hơn.
- Cất giữ: mát, khô, ở 3,80–3,85 V ([BU-702](https://batteryuniversity.com/article/bu-702-how-to-store-batteries)).
  Để đầy quá vài ngày làm pin già nhanh.

## 3. Cách đo pin

### 3.1 SkyRC iMAX B6AC V2

Thông số hãng ([skyrc.com](https://www.skyrc.com/iMAX_B6AC_V2_Charger)): sạc 0,1–6,0 A, **tối đa 50 W**,
xả 0,1–2,0 A, **tối đa 5 W**, LiPo 1–6S, có đồng hồ điện áp và đo nội trở.

- **Battery Meter**: cắm **chỉ dây cân bằng** vào ô 4S trên máy → hiện điện áp từng cell và tổng.
- **IR (Battery Resistance Meter)**: cắm cả dây xả (qua dây T sang XT60 đi kèm hộp) **và** dây cân bằng →
  hiện mΩ từng cell. Đo lúc pin đầy cho nhất quán.
- Không có số mặc định cho mức cất giữ trên trang hãng; chế độ STORAGE của máy dòng B6 thường đưa về
  ~3,85 V/cell (**chưa xác minh** với tài liệu V2).

### 3.2 Bút đo cell (cell checker)

Cắm dây cân bằng, đọc V từng cell và tổng. Rẻ, nhanh, để kiểm trước mỗi chuyến bay.

### 3.3 Đồng hồ vạn năng trên giắc JST-XH 5 chân (4S)

Tính từ đầu dây **đen** (cùng phía dây âm của pin):

| Chân | Nối với | So với chân 1 |
|---|---|---|
| 1 (đen) | âm pin, GND | 0 V |
| 2 | dương cell 1 | ~3,7–4,2 V |
| 3 | dương cell 2 | ~7,4–8,4 V |
| 4 | dương cell 3 | ~11,1–12,6 V |
| 5 (đỏ) | dương pin | ~14,8–16,8 V |

Điện áp cell N = (chân N+1) − (chân N). Màu dây giữa có thể khác giữa các hãng; luôn xác nhận chân GND bằng
cách đo với dây âm của XT60. Que đo nhọn dễ chập hai chân kề nhau: cẩn thận.

### 3.4 FC / Mission Planner

Tab DATA: ô `battery_voltage`, `current`, `battery_remaining`, `mAh consumed`. FC chỉ đo **tổng** áp
(không đo từng cell). Hiệu chuẩn áp bằng đồng hồ vạn năng (trang ArduPilot
[Power Module Configuration](https://ardupilot.org/copter/docs/common-power-module-configuration-in-mission-planner.html)).

### 3.5 Hiệu chuẩn dòng `BATT_AMP_PERVLT` bằng mAh sạc lại

1. Bay một chuyến (càng dài càng tốt, cảm biến dòng kém chính xác dưới ~3 A).
2. Ghi `mAh consumed` FC báo khi hạ cánh.
3. Sạc lại đầy bằng B6AC V2, ghi số mAh máy báo đã nạp.
4. `BATT_AMP_PERVLT_mới = BATT_AMP_PERVLT_cũ × (mAh sạc vào / mAh FC báo)`.
5. Lặp 2–3 chuyến, lấy trung bình. Sạc có hao tổn vài phần trăm nên kết quả hơi lệch cao; chấp nhận được.

Phương pháp phổ biến trong cộng đồng; trang ArduPilot chỉ nói "so với máy đo công suất và chỉnh hệ số":
nguồn cụ thể cho cách sạc-lại **chưa xác minh** (trang hướng dẫn hiệu chuẩn dòng của ArduPilot và
Oscar Liang đã đổi đường dẫn, trả 404).

### 3.6 Dòng sạc và thời gian

| | 4S 5300 | 6S (~5000) |
|---|---|---|
| 1C | 5,3 A | 5,0 A |
| Trần 50 W của B6AC V2 ở điện áp đầy | 50 / 16,8 ≈ **3,0 A (0,56C)** | 50 / 25,2 ≈ **2,0 A (0,4C)** |
| Từ cất giữ (~45%) lên đầy (~2,9 Ah) | ~1 h 10 – 1 h 20 | ~1 h 30 – 1 h 45 |
| Từ hạ cánh (~20%) lên đầy (~4,2 Ah) | ~1 h 40 (khớp `docs/linh-kien-s500.html`) | ~2 h 15 |

Đặt dòng 3,0 A cho 4S; máy tự giới hạn theo công suất. Thời gian là ước tính, có cộng pha CV cuối.

### 3.7 Cất giữ

Không bay trong ≥ 2–3 ngày → chế độ STORAGE về 3,80–3,85 V/cell. Xả của B6AC chỉ 5 W (~0,3 A ở 4S) nên
xả từ đầy về cất giữ mất ~5–6 giờ; nhanh hơn là bay treo cho tới ~3,85 V nghỉ.

## 4. An toàn

- Sạc **luôn có người trông**, trong túi chống cháy (dự án đã có), trên nền không cháy, xa vật dễ cháy.
  Luôn sạc cân bằng (cắm dây cân bằng).
- Cháy: cắt điện sạc nếu an toàn, để pin cháy hết trong túi hoặc mang ra chỗ trống bằng xẻng, phủ cát;
  không hít khói; dùng bình ABC/CO₂ cho vật xung quanh. Pin đã cháy, phồng vì va đập: để ngoài trời trên
  nền cát ít nhất vài giờ trước khi chạm.
- Vận chuyển máy bay: 4S 5300 = 78,4 Wh (< 100 Wh, xách tay, bọc đầu cắm). 6S ~5000 = ~111 Wh: nhóm
  100–160 Wh cần hãng bay đồng ý, tối đa 2 viên ([FAA PackSafe](https://www.faa.gov/hazmat/packsafe/lithium-batteries)).
  Quy định của hãng bay Việt Nam: **chưa xác minh**, nhưng thường theo IATA tương tự.
- Thải bỏ ở Việt Nam: xả về ~3,0 V/cell bằng B6AC, dán băng keo đầu cắm, mang tới điểm thu gom rác điện tử
  (ví dụ chương trình Việt Nam Tái Chế, có điểm cố định ở Hà Nội và TP.HCM, theo
  [Nông nghiệp và Môi trường](https://nongnghiepmoitruong.vn/thu-hoi-pin-va-rac-thai-dien-tu-can-che-tai-manh-hon-d675124.html)).
  Danh sách điểm thu pin hiện tại: **chưa xác minh**. Không vứt vào rác sinh hoạt.

## 5. Việc nên làm tiếp (tay người dùng, ~5 phút)

1. Chụp 6 mặt viên pin, đọc dòng C và mã trên nhãn → chốt biến thể.
2. Thước kẹp: dài × rộng × cao vỏ; độ dài dây xả và dây cân bằng; cân khối lượng.
3. B6AC V2: Battery Meter + IR từng cell khi đầy → ghi làm mốc vào sổ tay.

## Nguồn [retrieved 2026-10-26]

Đã kiểm HTTP 200:
- https://www.ovonicshop.com/products/ovonic-14-8v-5000mah-4s1p-50c-lipo-battery-with-xt60-trx-plug-for-rc-car-trucks
- https://www.ovonicshop.com/products/ovonic-4s-lipo-battery-5200mah-50c-14-8v-rc-lipo-battery-with-ec5-plug-for-rc-1-10-1-8-vehicles-car-rc-truck
- https://www.ovonicshop.com/products/ovonic-rebel-120c-6s-5300mah-22-2v-lipo-battery-with-ec5-plug-for-arrma-rc-car
- https://www.skyrc.com/iMAX_B6AC_V2_Charger
- https://oscarliang.com/lipo-battery-guide/
- https://oscarliang.com/when-retire-lipo-battery/
- https://batteryuniversity.com/article/bu-410-charging-at-high-and-low-temperatures
- https://batteryuniversity.com/article/bu-702-how-to-store-batteries
- https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries
- https://ardupilot.org/copter/docs/common-power-module-configuration-in-mission-planner.html
- https://ardupilot.org/copter/docs/failsafe-battery.html
- https://www.faa.gov/hazmat/packsafe/lithium-batteries
- https://nongnghiepmoitruong.vn/thu-hoi-pin-va-rac-thai-dien-tu-can-che-tai-manh-hon-d675124.html

Không kiểm được: trang JST (403), các trang Oscar Liang về hiệu chuẩn dòng và nội trở (404), trang
ArduPilot về hiệu chuẩn cảm biến dòng (404), trang Việt Nam Tái Chế (không kết nối được).
