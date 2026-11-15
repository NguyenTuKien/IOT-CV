# Nghiên cứu: SkyRC iMAX B6AC V2 (SK-100008), tư liệu để viết hướng dẫn tiếng Việt

Ngày 26/10/2026. Chỉ nghiên cứu, không sửa file nào khác trong repo.

## 1. Tóm tắt

- Mã hàng chính hãng: **SK-100008**, in trên trang sản phẩm SkyRC [1]. Sách hướng dẫn chính thức bằng tiếng Anh là bản **V3.10**: 25 trang nội dung (PDF 28 trang), in tháng 09/2022, mã in 7504-0479-07. Bản này đã được tải về và đọc hết.
- Firmware mới nhất là **V1.13**, đăng ngày 27/02/2023. Bản này **thêm chế độ LiHV** và **thêm tuỳ chọn bật/tắt yêu cầu cắm dây cân bằng**. Sách V3.10 có LiHV nhưng *không* nhắc tới tuỳ chọn cân bằng mới.
- Phần mềm PC là **Charger Master V1.55**, chỉ chạy trên Windows, đăng 21/07/2026. Máy nhận sạc qua USB dạng **HID** nên không cần cài driver. Đây là suy luận từ chương trình nạp firmware, xem mục 9.
- Sách có hai chỗ tự mâu thuẫn và một số chỗ không ghi rõ. Tất cả đều được đánh dấu **[KHÔNG RÕ]** hoặc **[SUY LUẬN]** bên dưới.

## 2. File đã tải (ổ D)

`D:\IOT_Tools\downloads\b6ac-v2\`

| File | Nguồn | Ghi chú |
|---|---|---|
| `B6AC_V2_Manual_EN_V3.10.pdf` | [2] | 2 248 634 B, bản chính để dịch |
| `B6AC_V2_Firmware_Update_V1.13.zip` (đã giải nén vào `fw\`) | [3] | `B6AC_SK_V1.13.exe`, `DFU.dll`, `Upgrade instructions升级说明.txt` |
| `ChargeMaster_V1.55.zip` | [4] | chứa `charger master V1.55.exe` (65 MB), **chưa chạy, chưa cài** |
| `manual.txt` | sinh bằng `pdftotext -layout` | để tra chữ |
| `page.html` | [1] | bản lưu trang sản phẩm |
| `pages\*.png` | render từ PDF | ảnh trang 2, 10–12, 20 dùng để đối chiếu |

Chưa tải bản tiếng Tây Ban Nha V2.20 (`/files/140`, URL vẫn trả 200). Bản này cũ hơn, không cần.

## 3. Thông số kỹ thuật (sách tr.22 [2], trang sản phẩm [1])

| Mục | Giá trị |
|---|---|
| Nguồn AC vào | 100–240 V, 50/60 Hz, có bộ nguồn xung tích hợp |
| Nguồn DC vào | 11–18 V |
| Công suất sạc / xả tối đa | **50 W / 5 W** |
| Dòng sạc | 0,1–6,0 A |
| Dòng xả | 0,1–2,0 A (vẫn bị giới hạn bởi 5 W: pin 4S 16 V chỉ xả được khoảng 0,3 A) [SUY LUẬN từ 5 W] |
| Dòng cân bằng | 200 mA/cell |
| Số cell được cân bằng | 2–6 cell |
| Loại pin / số cell | LiPo, LiIon, LiFe, LiHV: 1–6S · NiMH, NiCd: 1–15 cell · Pb (chì): 2–20 V |
| Điện áp sạc đầy (TVC chỉnh được) | LiPo 4,18–4,25 · LiIon 4,08–4,20 · LiFe 3,58–3,70 · LiHV 4,25–4,35 V/cell |
| Điện áp ngắt khi xả | LiPo 3,0–3,3 · LiIon 2,9–3,2 · LiFe 2,6–2,9 · LiHV 3,1–3,4 · NiMH/NiCd 0,1–1,1 V/cell · Pb 1,8 V/cell |
| Dải dung lượng | 100–50 000 mAh với mọi loại pin |
| Dải đo điện áp | 0,1–25,8 V |
| Delta-peak (NiMH/NiCd) | 5–15 mV/cell, mặc định 4 mV/cell. **Sách tự mâu thuẫn: mặc định nằm ngoài dải** [KHÔNG RÕ] |
| Ngắt theo nhiệt độ | 20–80 °C (68–176 °F), phải mua thêm đầu dò nhiệt **SK-600040** |
| Hẹn giờ an toàn | 1–720 phút hoặc OFF |
| Bộ nhớ | 10 hồ sơ sạc/xả |
| Cách sạc | CC/CV cho Li và Pb; dò delta-peak cho NiMH/NiCd |
| Màn hình | LCD 2×16 ký tự, đèn nền xanh dương |
| Vỏ | kim loại, 4 nút bấm |
| Kích thước | 135 × 144 × 36 mm (trang sản phẩm ghi D 144 × R 135 × C 36) |
| Khối lượng | 632 g |
| Cổng | 2–6S XH (cân bằng), đầu dò nhiệt, cổng pin (banana 4 mm), DC in, micro USB |
| Chứng nhận | CE (EN 55014-1/-2, EN 61000-3-2/-3-3, EN 60335-1, EN 60335-2-29), FCC Part 15B |
| Bảo hành | 1 năm, chỉ ở nước mua và qua nhà phân phối chính thức |

Bảng thông số pin chuẩn (sách tr.5):

| | LiPo | LiIon | LiFe | LiHV | NiCd | NiMH | Pb |
|---|---|---|---|---|---|---|---|
| Danh định (V/cell) | 3,7 | 3,6 | 3,3 | 3,7 | 1,2 | 1,2 | 2,0 |
| Sạc tối đa (V/cell) | 4,2 | 4,1 [sic] | 3,6 | 4,35 | 1,5 | 1,5 | 2,46 |
| Lưu kho (V/cell) | 3,8 | 3,7 | 3,3 | 3,85 | – | – | – |
| Sạc nhanh cho phép | 1C | 1C | 4C | 1C | 1–2C | 1–2C | 0,4C |
| Xả tối thiểu (V/cell) | 3,0–3,3 | 2,9–3,2 | 2,6–2,9 | 3,1–3,4 | 0,1–1,1 | 0,1–1,1 | 1,8 |

Ghi chú [sic]: bảng ghi LiIon sạc tối đa 4,1 V. Phần thông số và màn hình mẫu lại ghi 4,2 V (2S = 8,4 V). Nên viết dải TVC 4,08–4,20 V.

## 4. Bố trí vật lý (cho mô hình 3D), theo hình sách tr.2

Thân là hộp nhôm dẹt. Hai cạnh dài có **cánh tản nhiệt** dạng sọc ngang. Bốn góc mặt trên bắt vít lục giác. Mặt trên chia hai bậc: bậc cao có logo "iMAX B6AC V2 / AC/DC Dual Power / Professional Balance Charger/Discharger" và chữ "SKYRC". Bậc thấp ở phía trước chứa LCD và các nút.

| Mặt | Thành phần (theo thứ tự) |
|---|---|
| **Mặt trên, phía trước** | Cửa sổ LCD 2×16. Bên dưới LCD có dải nhãn màu ghi các chế độ (LiPo/LiFe/LiIon, NiMH/NiCd, Pb Lead Acid, Charge/Discharge…) và chữ "DISPLAY". Bốn nút tròn xếp hàng ngang từ trái qua phải: **BATT/PROG·Stop**, **DEC·◄Status**, **INC·Status►**, **ENTER·Start** |
| **Mặt bên phải** (cạnh ngắn gần nút) | Hai lỗ **banana 4 mm** ghi "OUTPUT" (+ đỏ, − đen) ở phía gần người dùng. Khối **ổ cân bằng JST-XH** ghi "Balance Socket" với vạch 2S…6S, gồm 5 ổ XH xếp hai hàng [SUY LUẬN từ hình; số ổ cần đối chiếu máy thật] |
| **Mặt sau** (từ trái qua phải) | Nhãn "CAUTION – Risk of electric shock, do not open". **Ổ AC IN 100–240 V 50/60 Hz**: hình vẽ là ổ 3 chân kiểu lá cỏ ba (IEC C6) [SUY LUẬN từ hình, cần kiểm máy]. Jack tròn **DC IN 11–18 V**, tâm dương theo ký hiệu ⊖–◯–⊕ in bên cạnh [SUY LUẬN, đường kính không có trong sách]. Dãy khe thoát gió. **Micro USB "PC LINK"**. **Ổ đầu dò nhiệt** 3 chân, có biểu tượng nhiệt kế |
| Mặt bên trái, mặt đáy | Sách không mô tả. Mặt bên trái chỉ thấy cánh tản nhiệt |
| Đèn LED | Sách **không có LED rời**. Chỉ có đèn nền LCD |
| Quạt | Sách không nhắc tới. Có khe gió ở mặt sau [KHÔNG RÕ] |

Nhận diện hàng thật: Pololu ghi máy có **tem hologram chống giả kèm mã bảo mật 12 chữ số** [6]. Serial 6 chữ số xem trong System Setting.

## 5. Trong hộp (sách tr.21, trang sản phẩm [1])

1. Máy sạc iMAX B6AC V2
2. Dây nguồn AC (phích cắm theo thị trường; bản Mỹ là phích 3 chấu [6])
3. Dây sạc **banana 4 mm → T-plug (Deans) đực**
4. Dây nguồn DC: **jack tròn → kẹp cá sấu** (dùng ắc quy 12 V làm nguồn vào)
5. T-plug cái → **kẹp cá sấu**
6. T-plug cái → **Futaba** đực
7. T-plug cái → **JST (RCY)** đực
8. T-plug cái → **XT60** đực
9. Sách hướng dẫn

**Không có trong hộp:** cáp USB A↔micro-B, đầu dò nhiệt SK-600040, mạch cân bằng rời. Máy có sẵn ổ XH nên không cần mạch rời. Mô-đun Wi-Fi điều khiển bằng điện thoại **SK-600075** cũng phải mua thêm [1].

## 6. Cây menu đầy đủ (sách tr.8, 9)

Khi bật máy, máy vào thẳng **LiPo BALANCE CHG**. Bấm BATT/PROG để ra danh sách chương trình. Dùng INC/DEC để chuyển, bấm ENTER để vào.

| Chương trình (BATT/PROGRAM) | Các chế độ (INC/DEC) | Màn hình mặc định |
|---|---|---|
| **LiPo BATT** | BALANCE CHG → CHARGE → FAST CHARGE → STORAGE → DISCHARGE | 2.0A 7.4V(2S) |
| **LiFe BATT** | như trên | 2.0A 6.6V(2S) |
| **LiIo BATT** | như trên | 2.0A 7.2V(2S) |
| **LiHV BATT** | như trên | 2.0A 7.6V(2S) |
| **NiMH BATT** | CHARGE (CURRENT x.xA) → Auto CHARGE (CURRENT = giới hạn trên) → DISCHARGE (0.1A CUT:1.0V) → RE-PEAK (1–3 lần) → CYCLE (CHG>DCHG hoặc DCHG>CHG, 1–5 lần) | 2.0A |
| **NiCd BATT** | như NiMH | 2.0A |
| **Pb BATT** | CHARGE → DISCHARGE | 2.0A 2.0V(1P); số "P" từ 1 đến 10 tương ứng 2–20 V [SUY LUẬN từ dải 2–20 V] |
| **BATT MEMORY** | [BATT MEMORY 1…10]: ENTER SET-> hoặc LOAD | xem mục 6.3 |
| **SYSTEM SETTING** | xem mục 7 | |
| **BATT METER** | MAIN x.xxV → điện áp từng cell → MAIN/H/L | |
| **BATT RESISTANCE** | điện trở từng cell (mΩ) → TOTAL/H/L | |

Chú ý thứ tự: trong lưu đồ, màn STORAGE của LiFe/LiIo/LiHV nằm xen ở cột STORAGE, còn NiMH/NiCd RE-PEAK nằm ở cùng cột. Vị trí xen này là do bố cục bản in. Khi viết hướng dẫn chỉ cần theo thứ tự trong bảng trên.

### 6.1 Bốn nút (sách tr.9)

| Nút | Bấm nhanh | Bấm giữ |
|---|---|---|
| BATT/PROG · Stop | dừng tiến trình, lùi một màn | – |
| DEC | lùi menu, giảm giá trị, xem trạng thái khi đang chạy | – |
| INC | tiến menu, tăng giá trị, xem trạng thái | – |
| ENTER · Start | sửa hoặc lưu: giá trị nhấp nháy, chỉnh bằng INC/DEC, bấm ENTER để lưu. Nếu màn có trường thứ hai, trường đó nhấp nháy tiếp | **giữ ≥ 3 s để bắt đầu** sạc/xả hoặc gọi bộ nhớ |

### 6.2 Quy trình chạy (sách tr.10–13), lấy LiPo BALANCE CHG làm ví dụ

1. Cắm nguồn AC (hoặc DC 11–18 V).
2. Cắm dây sạc **vào máy trước, rồi mới cắm vào pin**. Khi tháo thì làm ngược lại. Mỗi lần **chỉ cắm một pin** vào ổ cân bằng. Dây đen của jack cân bằng phải nằm đúng phía cực âm. Cắm sai sẽ hỏng máy.
3. Chọn chương trình (BATT/PROGRAM), rồi chọn chế độ.
4. Bấm ENTER: dòng sạc nhấp nháy, chỉnh rồi bấm ENTER. Tiếp theo số cell nhấp nháy, chỉnh rồi bấm ENTER.
5. Giữ ENTER 3 s. Màn hiện `BATTERY CHECK WAIT...`, rồi `R:3SER S:3SER`. R là số cell máy dò được, S là số cell đã đặt. Nếu hai số khác nhau, bấm STOP (`CANCEL(STOP)`) để quay lại. Nếu khớp, bấm ENTER (`CONFIRM(ENTER)`).
6. Theo dõi trên màn hình (mục 8). Bấm STOP để dừng. Khi xong, máy kêu bíp.

Bảng chế độ (sách tr.13):

| Loại | Chế độ | Ý nghĩa |
|---|---|---|
| Li (LiPo/LiIon/LiFe/LiHV) | CHARGE | sạc thường, không cân bằng |
| | BAL CHARGE | sạc có cân bằng từng cell |
| | FAST CHG | sạc nhanh hơn, dung lượng nạp hơi thấp hơn |
| | STORAGE | sạc hoặc xả về điện áp lưu kho (để lâu không dùng) |
| | DISCHARGE | xả |
| NiMH/NiCd | CHARGE | sạc theo dòng người dùng đặt |
| | AUTO CHG | máy tự chọn dòng. Phải đặt **giới hạn dòng trên** để tránh nạp quá dòng cho pin dung lượng nhỏ, nội trở thấp |
| | DISCHARGE | xả |
| | RE-PEAK | sạc tới đỉnh 1, 2 hoặc 3 lần liên tiếp |
| | CYCLE | 1–5 chu kỳ sạc>xả hoặc xả>sạc |
| Pb | CHARGE / DISCHARGE | sạc hoặc xả ắc quy chì |

### 6.3 Bộ nhớ (sách tr.14–15, lưu đồ tr.8)

Vào `[BATT MEMORY n] ENTER SET->`. Các trường cần đặt theo thứ tự:

- **Li:** BATT TYPE → BATT VOLTS (1–6S) → CHARGE CURRENT (0,1–6,0 A) → DSCH CURRENT (0,1–2,0 A) → DSCH VOLTAGE (ví dụ LiPo 3,0–3,3 V/cell) → **TVC=YOUR RISK** (LiPo 4,18–4,25 V; chỉ dành cho người có kinh nghiệm) → SAVE PROGRAM (bấm ENTER, màn hiện `SAVE....`).
- **NiMH/NiCd:** BATT TYPE → BATT VOLTS → CHARGE CURRENT → **TRICKLE** (ví dụ 100 mA) → **PEAK DELAY** (ví dụ 1 Min) → DSCH VOLTAGE (ví dụ 1,1 V/cell) → DSCH CURRENT → SAVE. Dải của TRICKLE và PEAK DELAY: [KHÔNG RÕ, sách chỉ có giá trị ví dụ].
- **Pb:** BATT TYPE → BATT VOLTS (ví dụ 4,0 V(2P)) → CHARGE CURRENT → DSCH CURRENT → DSCH VOLTAGE (ví dụ 1,7 V/cell, **mâu thuẫn với thông số 1,8 V**) → SAVE.
- Màn tóm tắt: `[BATT MEMORY 1] LiPo 7.4V(2S)` và `C:4.9A D:2.2A`. Giữ ENTER 3 s, màn hiện `ENTER CHARGER LOAD......`, rồi máy vào màn chế độ với các thông số đã nạp. Giữ ENTER 3 s nữa để chạy.
- Lỗi in ấn trong sách: "STARG/ENTER", "MiMH", "TATAL", "Lilo". Khi dịch thì sửa lại cho đúng.

## 7. SYSTEM SETTING (sách tr.16–17)

| Trường (màn LCD) | Lựa chọn / dải | Mặc định | Ý nghĩa |
|---|---|---|---|
| Safety Timer | OFF / ON 1–720 min | ON 120 min | hết giờ thì dừng sạc, phòng khi máy không nhận ra pin đầy |
| Capacity Cut-Off | OFF / ON 100–50 000 mAh | ON 5000 mAh | nạp tới dung lượng đặt thì dừng |
| Temp Cut-Off | OFF / ON 20–80 °C (68–176 °F) | ON 50 °C / 122 °F | cần đầu dò nhiệt |
| Temperature Unit | Celsius / Fahrenheit | Celsius | |
| Rest Time | CHG>DCHG 1–60 min | 10 min | thời gian nghỉ cho pin nguội giữa các bước của CYCLE |
| NiMH Sensitivity (D.Peak) | Default (4 mV) hoặc 5–15 mV/cell | Default | |
| NiCd Sensitivity (D.Peak) | như trên | Default | |
| Key Beep | ON/OFF | ON | tiếng bíp khi bấm nút |
| Buzzer | ON/OFF | ON | tiếng báo khi đổi trạng thái hoặc khi xong |
| Input Power Low Cut-Off | 10,0–11,0 V | 11,0 V | bảo vệ ắc quy nguồn khi chạy bằng DC |
| Load Factory Set | Enter | – | khôi phục cài đặt gốc |
| Version | HW:1.00 FW:x.xx | – | chỉ để xem |
| Serial Number | 6 chữ số | – | chỉ để xem |
| *(FW ≥ 1.13)* Bật/tắt yêu cầu cắm dây cân bằng khi chạy CHARGE, FAST, STORAGE | ON/OFF | [KHÔNG RÕ] | Có trong ghi chú firmware [3], **sách không có**. Tên trường trên LCD: [KHÔNG RÕ] |

Sách không có các mục sau, nên **đừng bịa ra khi viết hướng dẫn**: waste time riêng, trickle toàn cục (trickle chỉ có trong bộ nhớ NiMH/NiCd), độ sáng hay tương phản LCD, NiZn, chế độ Synchronous.

## 8. Màn hình khi đang chạy (sách tr.12)

Ví dụ màn `LP4s 2.0A 16.79V` / `BAL 022:43 01234`:

| Trường | Ý nghĩa |
|---|---|
| `LP` | loại pin: LiPo. Sách chỉ in mẫu LP. Các mã LF/Li/LH/Ni/Pb: [SUY LUẬN, cần chụp máy thật] |
| `4s` | số cell |
| `2.0A` | dòng hiện tại |
| `16.79V` | điện áp pin |
| `BAL` | chế độ đang chạy. Sách chỉ in BAL. Các mã CHG/FAS/STO/DSC: [SUY LUẬN] |
| `022:43` | thời gian đã chạy, phút:giây (mẫu `000:50` = 50 s) [SUY LUẬN theo định dạng] |
| `01234` | dung lượng đã nạp hoặc xả, mAh |

Bấm **INC** để xem lần lượt: điện áp từng cell (`4.07 4.06 4.11 V` / `0.00 0.00 0.00 V`, 6 ô), rồi `Fuel= 90%` / `Cell= 4.10V` (% dung lượng ước tính và điện áp trung bình mỗi cell).
Bấm **DEC** để xem lần lượt: `End Voltage 12.6V(3S)` (điện áp kết thúc), `IN Power Voltage 12.56V` (điện áp nguồn vào), `Ext. Temp ---- / Int. Temp 37°C`, `Temp Cut-Off 50°C`, `Safety Time ON 200min`, `Capacity Cut-Off ON 5000mAh`.

**BATT METER** (sách tr.18): cắm cả dây sạc chính lẫn dây cân bằng. Màn hiện 6 ô điện áp cell. Bấm INC để xem `MAIN 25.13V` / `H4.200V L4.182V` (tổng, cell cao nhất, cell thấp nhất).
**BATT RESISTANCE** (sách tr.19): cách cắm như trên. Màn hiện điện trở từng cell (mΩ, 6 ô `012 005 005` / `006`). Bấm INC để xem `TOTAL:28mΩ` / `H:12mΩ L:5mΩ`.

## 9. Thông báo lỗi (sách tr.20), đủ 16 mục

| LCD | Nghĩa |
|---|---|
| REVERSE POLARITY | cắm ngược cực |
| CONNECTION BREAK | mạch pin bị đứt |
| CONNECT ERROR / CHECK MAIN PORT | cắm pin sai |
| BALANCE CONNECT ERROR | cắm dây cân bằng sai |
| DC IN TOO LOW | điện áp vào < 11 V |
| DC IN TOO HIGH | điện áp vào > 18 V |
| CELL ERROR / LOW VOLTAGE | một cell áp quá thấp |
| CELL ERROR / HIGH VOLTAGE | một cell áp quá cao |
| CELL ERROR / VOLTAGE-INVALID | một cell áp không hợp lệ |
| CELL NUMBER INCORRECT | sai số cell |
| INT.TEMP.TOO HI | máy sạc quá nóng |
| EXT.TEMP.TOO HI | pin quá nóng (theo đầu dò) |
| OVER CHARGE CAPACITY LIMIT | nạp vượt Capacity Cut-Off |
| OVER TIME LIMIT | quá Safety Timer |
| BATTERY WAS FULL | áp pin cao hơn mức tối đa đã đặt (chế độ cân bằng) |
| NO BALANCE CABLE DETECTED | chưa cắm dây cân bằng; nếu pin không có dây cân bằng thì bấm ENTER để chạy tiếp |

## 10. Nối PC, phần mềm, firmware

| Mục | Thông tin | Nguồn |
|---|---|---|
| Cổng | micro USB "PC LINK" ở mặt sau. Cáp A↔micro-B **không kèm** | sách tr.21 |
| Phần mềm | **Charger Master V1.55** (Windows), đăng 21/07/2026. URL: [4] (đã kiểm 200) | [1] |
| Chức năng | xem điện áp pin và từng cell, đồ thị thời gian thực, bắt đầu và điều khiển sạc, cập nhật firmware | sách tr.3, 21 |
| Driver | **Không cần.** Chương trình nạp `B6AC_SK_V1.13.exe` và `DFU.dll` gọi `HID.DLL` (HidD_*) và `SETUPAPI`, tức máy hiện ra dưới dạng thiết bị HID dùng driver có sẵn của Windows | [SUY LUẬN từ `strings` trên file trong [3]] |
| Cập nhật firmware | 1) cắm USB vào PC, 2) cấp điện cho sạc, 3) chạy `B6AC_SK_V1.13.exe`, bấm "upgrade/update", 4) xong thì **Load Factory Set** | [3] |
| Mâu thuẫn phiên bản | ghi chú firmware nói "cần Charger Master **V2.04** để hiện LiHV", nhưng trang chính hãng hiện chỉ có V1.55 (bản 2026). Kết quả tìm kiếm cũ trỏ tới V1.42. Có thể SkyRC đã đánh số lại phiên bản. Cần cài V1.55 rồi kiểm xem có LiHV không | [1][3] |
| Lỗi Windows 11 | **Không tìm thấy nguồn chính hãng nào.** Lời khuyên chung với thiết bị HID cũ: cắm thẳng cổng USB 2.0, không qua hub. Một diễn đàn ghi máy SkyRC khác dùng VID/PID không chuẩn nên không chạy được qua máy ảo VirtualBox | [7] (bài về B6Neo+, không phải B6AC V2) |
| Wi-Fi | mô-đun tuỳ chọn SK-600075, điều khiển bằng app trên iOS/Android | [1] |

## 11. Khoảng trống, việc cần làm khi có máy thật

1. Chụp ảnh đủ 6 mặt để chốt: loại ổ AC (C6 hay C8), đường kính jack DC, số ổ XH, có quạt hay không, kích thước nút và LCD.
2. Chụp các mã loại pin và mã chế độ trên LCD (mục 8). Đọc FW trong System Setting: nếu < 1.13 thì sẽ không có LiHV.
3. Ghi dải của TRICKLE và PEAK DELAY, và tên trường bật/tắt cân bằng của FW 1.13.
4. Cài Charger Master V1.55 trên Win 11 để kiểm khả năng nhận máy và LiHV. **Chưa làm, vì việc này nằm ngoài phạm vi nghiên cứu.**

## Nguồn

1. SkyRC, trang sản phẩm iMAX B6AC V2 (SK-100008): https://www.skyrc.com/iMAX_B6AC_V2_Charger [retrieved 2026-10-26, HTTP 200]
2. Sách V3.10: https://www.skyrc.com/files/27/iMAX%20B6AC%20V2_Instruction_Manual_EN_V3.10.pdf, chuyển hướng 302 tới /download/…, cuối cùng 200, application/pdf [retrieved 2026-10-26]
3. Firmware V1.13: https://www.skyrc.com/files/111/B6AC_V2_Firmware_Update_V1.13.zip (302, rồi 200) [retrieved 2026-10-26]
4. Charger Master V1.55: https://www.skyrc.com/files/129/Charger%20Master%20V1.55.zip (302, rồi 200) [retrieved 2026-10-26]
5. Sách tiếng Tây Ban Nha V2.20: https://www.skyrc.com/files/140/B6AC_V2_Instruction_Manual_Spanish.pdf (200) [retrieved 2026-10-26]
6. Pololu #2588: https://www.pololu.com/product/2588/resources (200) [retrieved 2026-10-26]. Trang sản phẩm đọc qua WebFetch: hàng đã ngừng bán, ghi 145×135×35 mm, ~640 g, có tem hologram 12 số
7. IntoFPV, chủ đề về B6Neo+ (khác model, chỉ để tham khảo): https://intofpv.com/archive/index.php/thread-29281.html [chưa kiểm HEAD]
8. Không kiểm được: https://shop.robitronic.com/en/skyrc-b6ac-v2-sk100008 (HTTP 429)
