# Thiết kế trang hướng dẫn sạc B6AC V2 + pin Ovonic 4S (đã duyệt 26/10/2026)

Nguồn nghiên cứu (đọc trước khi viết nội dung, đừng bịa số):
- `plans/reports/261026-research-b6ac-v2-manual.md`: manual SkyRC V3.10, menu, 13 cài đặt, 16 lỗi, PC link, firmware V1.13
- `plans/reports/261026-research-ovonic-4s-lipo.md`: số điện hoá LiPo, đo pin, hiệu chỉnh BATT_AMP_PERVLT, an toàn
- `plans/reports/261026-research-b6ac-3d-va-video.md`: bố cục cổng, kích thước ước lượng, model KiCad, 15 video
- Bản chữ của manual: `D:\IOT_Tools\downloads\b6ac-v2\manual.txt`

## Quyết định của người dùng

- Máy SkyRC iMAX B6AC V2 **chính hãng** (SK-100008).
- Giao diện **khác hẳn** trang lắp ráp (người dùng chê: nhiều chữ, rối, điều hướng kém, xấu, 2D/3D sơ sài).
  Kiểu **sách hướng dẫn sản phẩm (Apple/DJI)** + **cục sạc ảo bấm được**.
- 3D: làm mọi cách, tự dựng three.js theo kích thước hãng + model CAD KiCad (XT60, JST-XH) đổi GLB.
- **Không có số đo thật** → chỗ nào ước lượng phải ghi rõ trên trang ("ước lượng từ ảnh").
- Người dùng CHỈ có đúng 8 món trong hộp (manual tr.21), KHÔNG mua dây ngoài. Đường sạc duy nhất: cổng OUTPUT → dây #3 (banana↔T-plug) → dây #8 (T-plug↔XT60) → XT60 của pin; dây cân bằng của pin cắm thẳng ổ "4 cells" trên máy, dây đen về phía dấu ⊖ (manual tr.10). Cáp micro USB có dữ liệu: người dùng có (khai 26/10).
- Phạm vi thêm: tự kiểm Charger Master trên laptop (cua-driver, khi người dùng cắm máy), nối với drone, danh sách video.
- Không 6S trong phạm vi (chỉ nhắc 1 dòng ở ngưỡng điện áp).
- Không Artifact, không commit/push khi chưa được bảo, không Plane.

## Số chốt (dùng thống nhất toàn trang)

| Mục | Giá trị |
|---|---|
| Máy | 135×144×36 mm, 632 g, AC 100–240 V / DC 11–18 V, sạc 0,1–6 A **tối đa 50 W**, xả 0,1–2 A **tối đa 5 W**, cân bằng 200 mA/cell, LCD 2×16 |
| Sạc pin 4S | **3,0 A** (50 W / 16,8 V ≈ 2,98 A); từ lúc hạ cánh ~1 h 40 m; từ storage ~1 h 15 m |
| Cell LiPo | đầy 4,20 · storage 3,80–3,85 · thấp khi tải 3,5 · tới hạn 3,3 · không bao giờ dưới 3,0 (V/cell) |
| Pin 4S | đầy 16,80 · storage 15,2–15,4 · FC `BATT_LOW_VOLT 14.0`, `BATT_CRT_VOLT 13.2` |
| Lệch cell | < 0,05 V bình thường · > 0,1 V theo dõi · một cell luôn thấp → loại |
| Nội trở | ghi mốc khi pin mới; một cell gấp đôi các cell kia là dấu hiệu hỏng (dải mΩ chỉ tham khảo) |
| Pin | Ovonic 4S 5300 mAh, XT60, JST-XH 5 chân; biến thể (C, khối lượng) **chưa xác minh** → hướng dẫn đọc nhãn |
| Hiệu chỉnh dòng | `BATT_AMP_PERVLT mới = cũ × (mAh máy sạc trả ÷ mAh FC báo dùng)`; hiện 370.4 |
| PC | cổng micro USB "PC LINK" ở cạnh trái; Charger Master V1.55; HID (không driver, chưa thử); firmware V1.13 |

## Kiến trúc file

```
docs/huong-dan/sac-pin-b6ac.html      ← bản dựng, một file tự chứa, mở offline
docs/huong-dan/sac-pin/
  README.md  build.py
  src/page.html  styles.css  core.js  app.js         ← khung (phiên chính)
  src/scene3d.js  src/models/*.glb  src/diag-*.js     ← lane 3D/2D
  src/sim.js  src/data-menu.js                        ← lane cục sạc ảo
  src/ch-*.js                                         ← lane nội dung (mỗi chương một file)
```
Build: ghép JS theo thứ tự, nhúng CSS, gói three.js bằng rolldown từ `frontend/node_modules`
(cùng cơ chế `docs/huong-dan/lap-rap/bundle3d.mjs`, tự có bản riêng). Cache ở `D:\DevCache\tmp\sac-pin-build`.

## Giao ước (mọi lane phải theo)

Toàn cục `window.SAC`, khai báo trong `core.js`:
- `SAC.chapter(id, {num, title, lead, render(root)})` đăng ký chương. `root` là `<section>` trống; render chỉ dùng class trong bảng dưới.
- `SAC.h(tag, attrs, ...children)` tạo phần tử; `SAC.icon(name)` trả SVG inline.
- `SAC.store.get(key)/set(key,v)` localStorage có try/catch.
- `SAC.go(chapterId, anchor?)` cuộn tới chương.
- `SAC.view3d(el, opts)` (do `scene3d.js` cung cấp, gói IIFE) → `{setView(name), highlight(partId|null), dispose()}`.
  `opts = {scene:'hero'|'charger'|'battery'|'wiring', view, hotspots:bool, onPick(partId)}`.
  `view ∈ front|top|left|right|back|bottom|iso`.
- `SAC.sim.mount(el)` (do `sim.js`): cục sạc ảo tự chứa.

Sơ đồ 2D (do `diag-*.js`, lane 3D): mỗi hàm trả `SVGElement`, phần tử bộ phận mang `data-part="<ID bộ phận>"`,
màu lấy từ biến CSS (`var(--ink)`, `var(--accent)`…) để đổi theo nền sáng/tối:
- `SAC.diag.face(view)` — hình chiếu máy, `view ∈ front|top|left|right|back|bottom`
- `SAC.diag.battery(view)` — pin, `view ∈ top|side|end`
- `SAC.diag.balancePinout()` — jack JST-XH 5 chân của pin 4S: chân, màu dây, cell nào
- `SAC.diag.wiring(step)` — sơ đồ nối, `step ∈ 'all'|'power'|'main'|'balance'|'wrong-no-balance'|'wrong-reverse'`
- `SAC.diag.boxContents()` — đồ trong hộp
- `SAC.diag.lcd(line1, line2)` — khung LCD 2×16 tĩnh để minh hoạ
`SAC.diag.highlight(svg, partId|null)` tô sáng bộ phận (dùng cho danh sách chú thích `.callout-fig`).

Chia file theo lane (mỗi file chỉ một lane ghi; `core.js`, `app.js`, `styles.css`, `page.html`, `build.py`,
`ch-hero.js` là của phiên chính — cần đổi thì báo):
- **Lane 3D/2D:** `scene3d.js`, `models/*.glb`, `diag-*.js`, `tools/` (script đổi STEP→GLB)
- **Lane máy ảo:** `data-menu.js`, `sim.js`, `ch-may-ao.js`, `ch-lcd.js`, `ch-cai-dat.js`
- **Lane nội dung A:** `ch-may.js`, `ch-pin.js`, `ch-noi-day.js`, `ch-quy-trinh.js`
- **Lane nội dung B:** `ch-loi.js`, `ch-may-tinh.js`, `ch-drone.js`, `ch-an-toan.js`, `ch-tai-lieu.js`

Mẫu phong cách: `src/ch-hero.js`. Tiện ích có sẵn trong `core.js`: `SAC.head`, `SAC.rich`, `SAC.steps`, `SAC.table`, `SAC.icon`.

ID chương (thứ tự): `hero, may, pin, noi-day, may-ao, quy-trinh, lcd, cai-dat, loi, may-tinh, drone, an-toan, tai-lieu`.

ID bộ phận (dùng chung cho 3D, 2D SVG, chú thích):
`btn-batt` `btn-dec` `btn-inc` `btn-enter` `lcd` `out-pos` `out-neg` `bal-2s` `bal-3s` `bal-4s` `bal-5s` `bal-6s`
`ac-inlet` `dc-jack` `usb-pclink` `temp-port` `heatsink` `feet` `label-bottom`
`cable-ac` `cable-banana-t` (dây #3) `adapter-t-xt60` (dây #8) `adapter-t-clips` `adapter-t-futaba` `adapter-t-jst` `cable-dc-clips` (dây #4)
`batt` `batt-xt60` `batt-balance` `batt-label`.

Class giao diện (định nghĩa trong `styles.css`, lane khác KHÔNG viết CSS riêng; cần thêm thì báo phiên chính):
`.ch` `.ch-head` `.kicker` `.lead` · `.grid-2` `.grid-3` · `.card` `.card-title` · `.stat` (`.stat-val` `.stat-unit` `.stat-label`)
`.note` `.warn` `.danger` `.tip` · `.kv` (bảng 2 cột) `.tbl` · `.steps` (`li` có `data-check`) · `.chip`
`.callout-fig` (hình + chú thích đánh số `.pin-label`) · `.est` (badge "ước lượng") · `.kbd` (tên nút máy) · `.lcd-text` (chữ LCD).

Văn phong: tiếng Việt, câu ngắn, mỗi khối ≤ 3 câu; số liệu đặt trong `.stat`/bảng, không chôn trong đoạn văn.
Mọi số phải có trong 3 báo cáo trên; không có thì ghi "chưa xác minh".

## Rủi ro

- Kích thước chi tiết máy và pin là ước lượng → badge `.est`, ghi nguồn.
- Model KiCad là đầu hàn mạch → chỉ lấy vỏ, lược chân; ghi công CC-BY-SA 4.0.
- Phần PC: ảnh chụp thật chỉ có khi người dùng cắm máy vào laptop.
- Mã LCD ngoài LP/BAL là suy luận (báo cáo manual mục 8) → ghi rõ.

## Nghiệm thu

1. `py -3.13 docs/huong-dan/sac-pin/build.py` chạy sạch, ra một file HTML mở offline.
2. Playwright: mọi chương render, không lỗi console, 3D quay được, cục sạc ảo đi hết cây menu, chạy được 1 lần sạc mô phỏng tới `FULL`.
3. Ảnh chụp ở 1440 px và 390 px (điện thoại), không cuộn ngang.
4. Đối chiếu 13 cài đặt + 16 lỗi + toàn bộ cây menu với báo cáo manual: thiếu mục nào là FAIL.

## Hình trong manual (đã dựng ảnh đủ 28 trang, 26/10)

`D:\IOT_Tools\downloads\b6ac-v2\manual-pages\p-01..p-28.png` (110 dpi) và hình nhúng gốc `manual-images\img-000..007.png`.
Trang quan trọng: p-01 bìa (máy 3/4 từ đầu phải), p-04 (tr.02: chú thích từng bộ phận + hình đầu trái), `img-001` đầu trái nét
(ổ AC C6, jack DC vuông, khe gió, micro USB, cổng cảm biến nhiệt), `img-002` đầu phải nét (2 banana, khối 5 ổ XH, vây tản nhiệt
hai cạnh dài), p-08 sơ đồ menu đầy đủ, p-10 sơ đồ nối pin LiPo, p-11/p-12 màn LCD từng bước + màn trạng thái khi sạc,
p-14/15 bộ nhớ, p-16/17 cài đặt, p-18/19 đồng hồ áp và nội trở (hình nối pin), p-20 lỗi, p-21 hộp đồ, p-22 thông số.

## Bổ sung 26/10: bàn thí nghiệm ảo (người dùng yêu cầu)

Chương 04 "Máy ảo" phải cho người dùng **tự cắm** pin ảo vào sạc ảo như dùng thật: kéo-thả (hoặc bấm-rồi-bấm) dây nguồn, dây #3, dây #8,
XT60, dây cân bằng vào đúng ổ, có hoạt hình cắm/rút. Cắm sai (ngược cực, sai ổ cân bằng, quên dây cân bằng, rút giữa chừng) phải ra đúng
phản ứng của máy theo manual. LCD trên mô hình 3D và 4 nút 3D chạy cùng máy trạng thái `SAC.sim.engine`. Tăng tốc thời gian
(1×/10×/60×/600×/dừng), cell sáng dần và cân bằng, dòng điện chạy trên dây, đồ thị, tiếng bíp. File: `scene3d.js`, `sim.js`, `data-menu.js`, `ch-may-ao.js`.
