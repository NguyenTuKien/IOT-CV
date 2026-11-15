# Computer Use — Dùng `cua-driver`, `gui.ps1` Là Đường Lui

Quyết định của chủ dự án, 21/09/2026. Bản global cùng tên nằm ở `~/.claude/rules/`; file này là bản của dự án, tự đủ để người mới clone repo đọc được ngay.

## Rule

Mọi tác vụ **computer use** — nhìn màn hình, đọc cây giao diện, bấm nút, gõ chữ vào phần mềm có giao diện đồ hoạ (Mission Planner, STM32CubeProgrammer, trình nạp web DroneBridge, Arduino IDE) — đi qua MCP server **`cua-driver`** đã đăng ký trong `.mcp.json`.

**`scripts/gui/gui.ps1` là đường lui, không phải lựa chọn đầu.** Không gọi nó, và không viết thêm script PowerShell điều khiển GUI nào khác, khi `cua-driver` còn chạy được.

File `gui.ps1` **vẫn giữ lại**, không xoá — lý do ghi trong `scripts/gui/README.md`: một MCP server bên ngoài có thể crash, đổi API, hoặc bị chặn bởi ranh giới UIPI, khi đó script vẫn chạy.

## Vì sao — ba điểm hơn đo được, không phải suy đoán

Kiểm chứng trên Mission Planner 1.3.83 ngày 21/09/2026 (xem `plans/phase-00-cai-cong-cu-pc.md` §00.8):

| | `gui.ps1` | `cua-driver` |
|---|---|---|
| Cửa sổ con / hộp thoại | không thấy (chỉ đọc `MainWindowTitle`, một tiến trình ra đúng một dòng) | thấy, kèm `window_id` riêng |
| Biết mình đang bấm gì | không, bấm mù theo toạ độ | có — `role`, `label`, `enabled`, `actions` |
| Kiểm chứng sau khi bấm | tự chụp lại rồi tự nhìn | `verify_state` trả `satisfied` / `unsatisfied` / `unknown` |

Cụ thể: Mission Planner lần chạy đầu bật popup **"Altitude Angel"** che cửa sổ chính. `gui.ps1` không thấy popup đó tồn tại; `cua-driver` liệt kê cả hai cửa sổ.

## Vòng lặp chuẩn mỗi lượt

`list_windows(pid)` → `get_window_state(pid, window_id)` → thao tác bằng `element_token` → `verify_state`.

Bảng chỉ mục phần tử bị thay mới sau mỗi `get_window_state` của **cùng** cửa sổ, nên phải snapshot lại trước mỗi lượt.

**Luôn mở `start_session` với một nhãn ngắn và truyền nhãn đó cho mọi lệnh.** Phiên implicit (khi bỏ trống `session`) hết hạn giữa các lượt và trả `this session has ended; call start_session explicitly to reuse its label` — lệnh tiếp theo hỏng giữa chừng công việc, đã gặp ngày 21/09/2026. Nhãn có tên thì hồi sinh lại được, phiên implicit thì không.

**App Java Swing (installer của ST, một số tool cũ) không có cây UIA** — Java Access Bridge mặc định tắt, `get_window_state` chỉ trả về đúng `TitleBar`. Đây là trường hợp hợp lệ để bấm theo `x, y` đọc từ ảnh chụp mà `get_window_state` trả về.

## Hai bẫy đã sập thật

1. **`element_token` lấy từ snapshot cửa sổ CHA không bấm được nút của cửa sổ CON.** Cây UIA của cửa sổ chính Mission Planner có lồng nguyên popup "Altitude Angel" vào, kể cả nút `Cancel` — nhìn thì tưởng bấm được. Bấm bằng token từ cha trả `route: synthetic_events` và popup **vẫn còn**. Phải `get_window_state` đúng `window_id` của popup, khi đó token mới đi đường `route: accessibility` và đóng được.
2. **`effect: "unverifiable"` nghĩa là "đã gửi", không phải "đã xong".** Cả hai lần bấm đều trả `unverifiable` — lần hỏng và lần được giống hệt nhau ở trường này. Thứ phân biệt là `verify_state`. Đây đúng là bài học "báo xanh giả" ở `plans/phase-00-cai-cong-cu-pc.md` §00.0 dịch sang ngôn ngữ GUI: **transport thành công không phải là kết quả**.

## Ba bẫy nữa — nối Mission Planner vào SITL, 25/09/2026

Màn hình máy dự án là 2560×1600, scale **150%**. Cả ba bẫy đều làm cú bấm rơi sai chỗ mà không báo lỗi; chủ dự án phải nhìn màn hình và chỉ ra "chuột tới nhầm toạ độ".

3. **Toạ độ `x, y` thuộc hệ toạ độ của ẢNH CHỤP GẦN NHẤT của cửa sổ đó — kể cả khi ảnh đã bị thu nhỏ bằng `max_dimension`.** Chụp MP với `max_dimension: 1100` (nhỏ đi 1,29 lần) rồi bấm theo toạ độ thật của nút: con trỏ văng ra mép màn hình (2559, 310). Thêm nữa, với cửa sổ WinForms của MP ở scale 150%, ảnh chụp chỉ vẽ nội dung trong **2/3** khung, phần còn lại trắng/đen, nên toạ độ đọc từ ảnh lệch 1,5 lần. **Cách đúng:** lấy toạ độ từ `frame` của phần tử UIA (toạ độ màn hình vật lý) trừ `window_bounds`, và chụp lại **không** `max_dimension` (lưu ra file bằng `screenshot_out_file` nếu không cần xem) để hệ toạ độ về 1:1 trước khi bấm. Sau cú bấm, `get_cursor_position` cho biết nó thật sự rơi vào đâu.
4. **UIA Invoke một nút mở hộp thoại modal sẽ KHOÁ kênh UIA của cả tiến trình** tới khi hộp thoại đóng. Nút CONNECT của MP mở hộp thoại "remote host": Invoke không trả về, mọi lệnh sau báo `UIA pixel click busy` hoặc `get_window_state timed out`. Nhìn như app treo, nhưng `Get-Process` báo `Responding: True`. **Nút nào mở hộp thoại modal thì bấm bằng `click` `delivery_mode: foreground` theo toạ độ**, không dùng `element_token`. Ô nhập trong hộp thoại thì vẫn `set_value` + `verify_state` bình thường.
5. **Cửa sổ toàn màn hình của người dùng (VS Code) nằm đè lên đích.** Click foreground trả `foreground_unavailable` với HWND của VS Code, và cú bấm rơi vào VS Code. `bring_to_front` cũng không giữ được, vì VS Code giành lại ngay. Trước mỗi chuỗi bấm foreground: `list_windows(on_screen_only: true)` và kiểm đích có `z_index` cao nhất. Không phải thì nhờ người dùng thu nhỏ cửa sổ đè, đừng bấm mù.

6. **`launch_app` không nhận tham số `session`**, nên nó chạy trên phiên implicit — phiên này hết hạn giữa các lượt và trả `this session has ended`. Gọi `start_session()` **không nhãn** (hồi sinh phiên implicit) ngay trước `launch_app`. Các lệnh còn lại vẫn dùng nhãn riêng.

Thêm một điều về chính MP, không phải `cua-driver`: ô **Sonar Range** của MP luôn 0 với rangefinder nhìn ngang (TFmini dự án), vì ArduPilot chỉ gửi gói `RANGEFINDER` cho rangefinder nhìn xuống. Chi tiết: `docs/so-tay/04-param-va-tranh-vat-can-ao.md` mục 9.

## Sáu bẫy nữa — nghiệm thu Phase 09 (web + Mission Planner), 25/09/2026

7. **Tiêu đề cửa sổ MP không cho biết đã nối hay chưa, và số trên HUD của MP có thể là số cũ đứng yên.** Đã kết luận nhầm "MP đang nối" vì thấy HUD có số và ô cổng ghi `TCP5762`; bấm Read ra `Please Connect First!`. Bằng chứng đúng: nhãn nút ở góc phải là **DISCONNECT** (đọc qua cây UIA), hoặc `netstat -ano` có dòng `ESTABLISHED` từ PID của MP tới cổng SITL.
8. **Nút Read (tab PLAN) mở hộp `Confirm` modal khi bảng đang có điểm** — đúng bẫy #4: Invoke qua token thì lệnh treo, người dùng phải tự đóng hộp. Bấm Read, OK của `Confirm`, OK của hộp `remote host`/`remote Port` bằng `click` `delivery_mode: foreground` theo toạ độ. Đọc xong MP còn hỏi `Reset Home Coords` — chọn **No** là không đổi gì.
9. **Hộp `Error` của MP: Enter kích link `Details...` (mở thêm hộp `Exception Details`), Escape không đóng.** Bấm pixel vào nút `Close`. Và `press_key` báo `delivery_failed` nhưng hộp vẫn đóng thật — cả hai chiều đều phải kết luận theo `list_windows`, không theo trường báo của driver. Tương tự, click foreground hay báo `foreground_unavailable` khi chính cú bấm vừa mở một hộp mới (hộp mới giành foreground): đọc `list_windows` trước khi bấm lại.
10. **Ảnh chụp bị trần `max_image_dimension` (~1568 px) nên KHÔNG BAO GIỜ 1:1 với cửa sổ 2560 px**, kể cả khi không truyền `max_dimension`. Toạ độ bấm = `frame` UIA (trừ `window_bounds`) × (chiều rộng ảnh / chiều rộng cửa sổ). Bấm xong đọc `get_cursor_position` — lần này rơi đúng (2512, 71) trên nút CONNECT. Hộp thoại nhỏ (<1568 px) thì ảnh mới 1:1.
11. **Trình duyệt: `browser_click` nhận x, y theo CSS px của viewport, còn ảnh `get_browser_state` bị thu nhỏ khi hiển thị.** `css = px_trên_ảnh × viewport_css_width / chiều_rộng_ảnh_đang_xem`. Bấm theo tỉ lệ `pixel_to_css_scale` (0.667) của ảnh gốc là rơi lệch ~18% về góc trên trái. `browser_type` nền bị từ chối ở ô `type=number`, `page execute_javascript` bị chặn (cần chế độ unrestricted) — đổi giá trị bằng thanh trượt/nút thay vì gõ phím xoá.
12. **Trình duyệt riêng của driver (`browser_prepare` isolated) bị dọn cùng lúc phiên hết hạn** — mất mạng giữa chừng là mất cả tab lẫn state trong trang (vệt đường, bản nháp). Bài nghiệm thu nào dựa vào state trong trang thì làm liền một mạch, và chụp ảnh bằng chứng ngay khi đạt.

## Khi nào mới được lùi về `gui.ps1`

Chỉ hai trường hợp, và **phải nói rõ lý do đã lùi**, không lùi lặng lẽ:

- Tool `mcp__cua-driver__*` không nạp được trong phiên này (nạp lúc phiên khởi động — nếu thiếu thì khởi động lại Claude Code trước đã).
- MCP server lỗi hoặc treo — đã thử và có lỗi cụ thể để dẫn ra.

"Script nhanh hơn" và "việc này đơn giản" **không** nằm trong danh sách.

⚠️ **UIPI KHÔNG phải lý do để lùi về `gui.ps1` — lùi cũng vô ích.** Cửa sổ đích chạy High integrity (manifest `requireAdministrator`) thì mọi tiến trình Medium integrity đều bị Windows chặn, và `gui.ps1` cũng ở Medium integrity. `scripts/gui/README.md` § "Giới hạn đã biết" đã ghi đúng điều này từ đầu.

Khác biệt duy nhất, và nó quan trọng: `cua-driver` **từ chối và nói thẳng** — *"the call would return success but no input would land"* — còn `gui.ps1` sẽ gửi, không báo lỗi, rồi ta tưởng đã bấm. Gặp UIPI thì đường ra là cài/chạy bằng dòng lệnh, hoặc để người vận hành tự bấm; **không** phải đổi công cụ.

Kiểm chứng ngày 21/09/2026 trên wizard STM32CubeProgrammer 2.23.0 (§00.4): bấm pixel vào nút `Next` trả thẳng lỗi `UIPI: target hwnd ... is at High integrity; cua-driver is at Medium integrity`. `escalate_session` **không** chữa được — nó là tool deprecated cho capture-scope cũ, không nâng integrity level.

Nếu vẫn phải chạy `gui.ps1`, luôn kèm `-NoProfile` — profile người dùng chạy `fastfetch` nên khoảng 40 dòng ASCII art sẽ trộn vào stdout trước kết quả thật.

## An toàn — luật cứng, không có ngoại lệ

Không dùng bất kỳ công cụ computer use nào (`cua-driver` lẫn `gui.ps1`) cho ARM, Motor Test, hay bất cứ thao tác nào làm motor quay. Những nút đó người vận hành tự bấm, tay luôn cầm RC. Xem `SAFETY.md` mục 1 và 2.

## Related

`scripts/gui/README.md` (bốn rào an toàn của `gui.ps1`, so sánh hai công cụ) · `plans/phase-00-cai-cong-cu-pc.md` §00.8 (nơi ghi bằng chứng) · `plans/reports/260921-research-windows-computer-use-mcp.md` (so sánh 21 MCP server và lý do chọn `cua-driver`) · `SAFETY.md`
