# Nghiên cứu: tài sản 3D, ảnh tham chiếu và video cho hướng dẫn sạc SkyRC iMAX B6AC V2 + pin Ovonic 4S 5300 mAh

Ngày 26/10/2026. Mọi nguồn [retrieved 2026-10-26]. Chỉ nghiên cứu, không sửa file nào khác trong repo.

## Tóm tắt

- **Không có mô hình 3D nào của B6AC V2** với giấy phép tự do, trên các trang đã tìm: Sketchfab (API), Printables (GraphQL) và tìm kiếm web. Printables chỉ có giá đỡ, vỏ, quạt cho B6. Vì vậy phải **tự dựng thân máy bằng hình khối trong three.js**, theo kích thước trong sách hướng dẫn (135 × 144 × 36 mm, 632 g) và ảnh ở mục 2.
- **XT60 và JST-XH:** đã tải bản STEP từ thư viện KiCad (CC-BY-SA 4.0 kèm điều khoản miễn trừ). Đây là bản **hàn lên mạch (PCB)**, không phải đầu cắm dây. three.js không đọc thẳng STEP, phải đổi sang GLB (FreeCAD hoặc `occt-import-js`).
- **Hộp đồ thật (ảnh Pololu) KHÁC đề bài.** Dây sạc chính là **bắp chuối 4 mm → T-plug (Deans)**. XT60 chỉ có trong **4 dây chuyển T → (kẹp cá sấu, servo JR, JST-RCY, XT60 đực)**. Không thấy bo chuyển cân bằng (balance board). Ổ điện AC là **IEC C6 ba chấu kiểu "tai chuột"**, nên dây nguồn là **C5**, không phải dây số 8. Cách đóng gói có thể đổi theo người bán: **chưa xác minh** với hộp người dùng đang có.
- **Pin Ovonic 4S 5300 mAh:** không tìm thấy trang sản phẩm chính thức (ovonicshop.com chỉ có loại 6S 5300 EC5). Kích thước **chưa xác minh**, nên đo pin thật.

## 1. Mô hình 3D

| Món | Nguồn / URL | Định dạng | Giấy phép | Độ chính xác | Đã tải |
|---|---|---|---|---|---|
| XT60 cái (PCB, đứng) | gitlab.com/kicad/libraries/kicad-packages3D, `Connector_AMASS.3dshapes/AMASS_XT60-F_1x02_P7.2mm_Vertical.step` | STEP | CC-BY-SA 4.0 + miễn trừ KiCad | Cao (theo datasheet AMASS). Khác đầu cắm dây ở phần đuôi hàn | Có |
| XT60 đực (PCB, đứng) | cùng repo, `AMASS_XT60-M_1x02_P7.2mm_Vertical.step` | STEP | như trên | như trên | Có |
| JST-XH 5 chân, chân cắm đứng (cân bằng 4S) | `Connector_JST.3dshapes/JST_XH_B5B-XH-A_1x05_P2.50mm_Vertical.step` | STEP | như trên | Cao. Đây là **ổ trên mạch**, không phải vỏ XHP trên dây pin | Có |
| JST-XH 5 chân, nằm ngang | `JST_XH_S5B-XH-A_1x05_P2.50mm_Horizontal.step` | STEP | như trên | như trên | Có |
| Drone_Lipo_battery_4s (3dArenaRaj) | sketchfab.com/3d-models/2279697ec4b44d75813fd365d96a4e07 | Sketchfab (GLB khi tải) | CC-BY | Chung chung, không phải Ovonic, kích thước chưa xác minh | Không (phải đăng nhập) |
| "[CC0] Safety Banana Plug Cable with Test Probe" (literallylara) | sketchfab.com/3d-models/f23a52f1c30544b5a2ff6d7949e85bbd | Sketchfab | Trang ghi CC-BY, tiêu đề ghi CC0 (mâu thuẫn) | Bắp chuối có vỏ an toàn, khác bắp chuối RC | Không (phải đăng nhập) |
| IMAX B6 V2 30mm fan mount (xsytes) | printables.com/model/1271645 | STL/STEP? | CC-BY-SA | Chỉ là phụ kiện, có thể dùng để dò kích thước V2: chưa xác minh | Không |
| B6AC Neo Screen Protector (TomTheGeek) | printables.com/model/1294754 | STL | CC0 | Dành cho B6AC **Neo**, không phải V2 | Không |
| Gridfinity IMAX B6AC Stand | printables.com/model/1017414 | STL | GPL-2.0 | Phụ kiện | Không |
| Các mẫu XT60 trên GrabCAD ("XT60 H Connector (correct contact spacing)"…) | grabcad.com | STEP | Điều khoản GrabCAD, không phải CC: **chưa xác minh** | Có ghi chú "đúng khoảng cách chân" | Không |
| Thingiverse, Cults3D, TurboSquid, 3D Warehouse | — | — | — | **Chưa tìm** (hết lượt) | — |

**Ghi công cho file đã tải:** "3D models from the KiCad libraries (kicad-packages3D), © KiCad Library Team, CC-BY-SA 4.0 with KiCad exception, https://gitlab.com/kicad/libraries/kicad-packages3D". Bản giấy phép nằm ở `LICENSE.md` cùng thư mục.

**Đề xuất:** (1) Dựng thân B6AC V2, bắp chuối, kẹp cá sấu và khối pin bằng hình khối three.js tự viết. Như vậy không vướng giấy phép, và chỉ cần kích thước ở mục 2. (2) Dùng XT60 và JST-XH của KiCad, đổi sang GLB và lược bớt chân hàn.

## 2. Ảnh tham chiếu

Ảnh của SkyRC và Pololu có bản quyền. **Chỉ dùng để tham chiếu khi dựng hình, không nhúng vào trang.**

| URL | Nội dung |
|---|---|
| https://www.skyrc.com/iMAX_B6AC_V2_Charger | Trang chính thức (mã SK-100008) |
| https://www.skyrc.com/image/catalog/product/thumbimg/V2/charger/100008.png | Toàn thân, nhìn nghiêng 3/4 từ trước-phải: mặt trên có LCD và 4 nút, cạnh phải có cổng ra và ổ cân bằng |
| https://www.skyrc.com/image/catalog/product/charger/b6acv2/B6AC2.jpg | Mặt trên, nhìn 3/4 rõ nét: chữ trên LCD, nhãn nút, nhãn ổ cân bằng |
| https://www.skyrc.com/image/catalog/product/charger/b6acv2/B6AC1.png , B6AC3.png , B6AC4.png | Cạnh trái: ổ AC, giắc DC, PC LINK, cổng nhiệt độ, khe gió |
| https://www.skyrc.com/files/27/iMAX%20B6AC%20V2_Instruction_Manual_EN_V3.10.pdf | Sách hướng dẫn. Trang thông số ghi Case Size 135x144x36mm, Weight 632g |
| https://www.pololu.com/product/2588/pictures (ảnh `https://a.pololu-files.com/picture/<ID>.1200.jpg`) | 0J6156 ảnh chính · 0J6153 toàn bộ hộp đồ · 0J6151 các dây đi kèm · 0J6152 **mặt đáy** (tem hologram) · 0J6154 **cạnh trái** nhìn thẳng · 0J6155 **cạnh phải** nhìn thẳng |

**Chưa có ảnh:** mặt sau (cánh tản nhiệt) nhìn thẳng, mặt trên nhìn thẳng từ trên xuống, và mọi ảnh của pin Ovonic 4S 5300.

### Bố cục và tỉ lệ suy ra

- **Hướng đặt máy:** máy nằm ngang. Mặt trên chia hai bậc. Bậc trước thấp hơn, chứa LCD 16×2 và 4 nút tròn xếp một hàng song song cạnh trước (BATT/PROG, DEC, INC, ENTER). Bậc sau cao hơn, in logo. Mặt sau là cánh tản nhiệt nhôm. Vỏ nhôm xanh, 4 chân đen. *Tin cậy: cao.*
- **Cạnh trái, từ sau ra trước:** nhãn CAUTION, ổ AC IEC C6, giắc DC 11–18 V, khe gió, micro-USB "PC LINK", cổng 3 chân cảm biến nhiệt, khe gió. *Tin cậy: cao* (ảnh 0J6154).
- **Cạnh phải, từ trước ra sau:**
  - hai lỗ bắp chuối 4 mm: **đen (−) phía trước, đỏ (+) phía sau**;
  - một lỗ tròn nhỏ phía trên, công dụng chưa xác minh;
  - khối ổ cân bằng JST-XH. Hàng trên có 3 ổ (5, 4, 3 chân). Hàng dưới có 2 ổ (7, 6 chân). Tỉ lệ bề rộng các ổ trên ảnh khớp với bước chân 2,5 mm, nên ổ 5 chân là ổ cho 4S. *Tin cậy: trung bình–cao.*
- **Kích thước ước lượng:** thang đo lấy từ ảnh 0J6155, lấy ổ XH 7 chân (19,9 mm) làm chuẩn, được khoảng 7,7 px/mm. Thân máy đo ra khoảng 140 mm, khớp với 144 mm. *Tin cậy: trung bình.*
  - Hai lỗ bắp chuối cách tâm khoảng 13–14 mm, viền mỗi lỗ đường kính khoảng 11 mm.
  - Khối ổ cân bằng rộng khoảng 40 mm, mỗi hàng cao khoảng 6 mm.
  - Chân đế cao khoảng 4–5 mm.
- **Mặt trên:** cửa sổ LCD khoảng 66 × 20 mm. Nút đường kính khoảng 8 mm, cách nhau khoảng 18–20 mm theo tâm. Bậc trước thấp hơn bậc sau khoảng 6–8 mm. *Tin cậy: thấp, ảnh chụp phối cảnh.* Nên đo trên máy thật.
- **Pin Ovonic 4S 5300 mAh:** chưa xác minh. Pin 4S 5300 cùng loại của hãng khác:
  - Tattu 140 × 41 × 42 mm, khoảng 548 g;
  - ZOP 139 × 46 × 50 mm.

  Cần đo pin thật: dài/rộng/cao, độ dài dây XT60 và dây cân bằng, vị trí dây ra.

## 3. Video

Đã kiểm qua YouTube oEmbed (HTTP 200 nghĩa là video tồn tại). Độ dài và kênh lấy từ trang tìm kiếm YouTube.

| # | Tiêu đề | Kênh | URL | Dài | Nội dung | oEmbed |
|---|---|---|---|---|---|---|
| 1 | SkyRC B6AC V2 Charger Review and Usage | AndyRC | https://www.youtube.com/watch?v=OcyGH5DeFLc | 46:20 | Review đầy đủ cách dùng, nhắc cả firmware và ChargeMaster; 185 nghìn lượt xem | 200 |
| 2 | Review / How to Use SkyRC Imax B6AC V2 | RC Films / RCF | https://www.youtube.com/watch?v=Ekxdjj5ZWbo | 7:46 | Cách dùng cơ bản, sạc cân bằng | 200 |
| 3 | SkyRC iMax B6AC V2 – Charger Review | Mark Robinson | https://www.youtube.com/watch?v=1k6sVFOy-pk | 14:01 | Review, sạc LiPo | 200 |
| 4 | SKYRC B6AC V2 Balance Charger Review | haloboyvash | https://www.youtube.com/watch?v=KF7vMp4Ixuc | 12:18 | Review, sạc cân bằng | 200 |
| 5 | IMAX B6AC V2 Basic Functions / PC Link | RVDrones | https://www.youtube.com/watch?v=9Cz0HpdnUSU | 22:56 | Chức năng cơ bản và nối máy tính | 200 |
| 6 | imax b6ac v2 installer pc monitor software | TeslaBike Man | https://www.youtube.com/watch?v=_-gqxrLLm78 | 3:12 | Cài phần mềm ChargeMaster | 200 |
| 7 | SkyRC B6 mini & B6AC V2 charger Calibration | Shawn Tong | https://www.youtube.com/watch?v=nEpgzfjXU7I | 3:31 | Hiệu chuẩn bằng ChargeMaster (liên quan firmware) | 200 |
| 8 | iMAX B6AC V2 充電器教學 從開箱到平衡充電 & 保存模式 | WPC Systems | https://www.youtube.com/watch?v=nEynb3iW2Kc | 3:21 | Mở hộp, sạc cân bằng, chế độ Storage (tiếng Trung, ngắn gọn) | 200 |
| 9 | skyrc imax b6ac v2 Lipo balance & storage | beginner rc hobby | https://www.youtube.com/watch?v=XJtVuXciJBg | 9:35 | Sạc cân bằng và Storage (tiếng Indonesia) | 200 |
| 10 | iMAX B6 AC Storage Mode | EEEian Arena | https://www.youtube.com/watch?v=VMPeu5MHlFI | 4:03 | Chế độ Storage | 200 |
| 11 | How to check the battery resistance (B6neo+) | SkyRC | https://www.youtube.com/watch?v=lEe2-Vbskjw | 1:04 | Đo nội trở (video chính hãng nhưng là máy **B6neo**, không phải V2) | 200 |
| 12 | IMAX B6 AC V2 (review bản ac v2) | TỚIMV Battery | https://www.youtube.com/watch?v=vy4wbICDETw | 8:21 | Review B6AC V2, **tiếng Việt** | 200 |
| 13 | sạc b6 AC v2 có đo nội trở – làm bộ nguồn đa năng | Đại Vlogs | https://www.youtube.com/watch?v=nP3Csg3rcXc | 18:31 | Đo nội trở trên B6AC V2, **tiếng Việt** | 200 |
| 14 | Bộ sạc xả đa năng imax B6 SkyRC v2 phiên bản mới | Chiro Kotaro | https://www.youtube.com/watch?v=Cs3hr_UCDJc | 7:21 | B6 V2, **tiếng Việt** (chưa xác minh là bản AC) | 200 |
| 15 | Hướng dẫn sạc pin imax b6 sạc pin lipo | NamPack | https://www.youtube.com/watch?v=mtuzj8OEegU | 4:38 | Sạc LiPo trên B6, **tiếng Việt** (không chắc là V2) | 200 |

**Chưa xác minh được:**

- SkyRC iMAX B6AC Version V2 unboxing (Michaelblog456): https://www.youtube.com/watch?v=rWLk9jd9Kiw. oEmbed trả 401, nhiều khả năng video tắt nhúng.
- Video chính hãng SkyRC hướng dẫn cập nhật firmware riêng cho B6AC V2: **chưa tìm thấy**.

Chất lượng nội dung từng video chưa xem trực tiếp; đánh giá chỉ dựa trên tiêu đề, lượt xem và kênh.

## 4. File đã tải (D:\IOT_Tools\downloads\b6ac-v2\)

| Thư mục | File | Giấy phép |
|---|---|---|
| `kicad-3d\` | `AMASS_XT60-F_1x02_P7.2mm_Vertical.step`, `AMASS_XT60-M_1x02_P7.2mm_Vertical.step`, `JST_XH_B5B-XH-A_1x05_P2.50mm_Vertical.step`, `JST_XH_S5B-XH-A_1x05_P2.50mm_Horizontal.step`, `LICENSE.md` | CC-BY-SA 4.0 + miễn trừ KiCad |
| `ref-photos-skyrc\` | `100008.png`, `B6AC1.png`, `B6AC2.jpg`, `B6AC3.png`, `B6AC4.png`, `B6AC-V2_2.jpg` | © SkyRC, chỉ để tham chiếu |
| `ref-photos-pololu\` | `0J6151/52/53/54/55/56.jpg` | © Pololu, chỉ để tham chiếu |
| `docs\` | `iMAX_B6AC_V2_Manual_EN_V3.10.pdf`, `manual.txt` (chữ trích từ PDF) | © SkyRC |

## Nguồn

- https://www.skyrc.com/iMAX_B6AC_V2_Charger
- https://www.pololu.com/product/2588/pictures
- https://gitlab.com/kicad/libraries/kicad-packages3D
- https://api.sketchfab.com/v3/search
- https://api.printables.com/graphql/
- https://www.getfpv.com/tattu-5300mah-4s-35c-lipo-battery.html
- https://besomi.com/ae_en/4s-5300mah-60c-zop-power.html
- https://www.ovonicshop.com/

Tất cả [retrieved 2026-10-26].
