# AGENTS.md — hướng dẫn cho mọi agent làm việc trong IOT-CV

Đọc file này trước khi làm bất cứ việc gì trong repo. Áp dụng cho mọi agent (Claude Code, Codex,
…) và mọi phiên. `CLAUDE.md` chỉ import file này, nên sửa ở **đây**, không sửa ở đó.

Dự án: quadcopter S500 chạy ArduPilot 4.7.1 (bản custom build) trên SpeedyBee F405 V5, điều khiển
qua web GCS tự viết (FastAPI + Vite/React), cầu MAVLink Wi-Fi bằng ESP32 chạy DroneBridge, tránh vật
cản bằng TFmini Plus, camera ESP32-S3 + AI nhận diện người.

## Nguồn sự thật — đọc trước khi hỏi người dùng

| Câu hỏi | File |
|---|---|
| Linh kiện thật đang có | `docs/phan-cung-thuc-te.md` |
| Tham số bay, chia cổng serial, lý do | `firmware/ardupilot/params/*.param` (phần comment đầu file) |
| Feature firmware đã bật | `firmware/ardupilot/custombuild/*.yaml`, `firmware/ardupilot/build-*/NOTES.md` |
| Thứ tự phase, phase nào xong | `plans/_phase-index.md`, `plans/PROGRESS.md` |
| Luật an toàn | `SAFETY.md` |
| Quyết định còn mở | `plans/QUYET-DINH-CHUA-CHOT.md` |
| BOM gốc + lý do chọn | `docs/archive/plan-nhap-92-giai-doan.md` (bản ghi quyết định, không phải tài liệu chết) |
| Các chuyến đã bay (log FC + tlog + video ghép theo giờ GPS) | trang **Lịch sử bay** của web (`/flights`, Alt+L); dòng lệnh `uv run python -m backend.flights --events` |

`plans/reports/260921-*` là báo cáo nghiên cứu ngày 21/09/2026, giữ nguyên như bản ghi lịch sử —
phần cứng trong đó có thể đã đổi.

## Luật cứng của người dùng

1. **Tải về và cài thêm vào ổ D**, không để ổ C: file tải về / installer / bản sao lưu →
   `D:\IOT_Tools\downloads\`; app → `D:\IOT_Tools\apps\`; toolchain và cache (uv, pip, npm, pnpm,
   PlatformIO) → `D:\DevCache\`. Thứ bắt buộc nằm ở C (driver store của Windows) thì nói rõ.
2. **Chỉ ghi file.** Không commit, push, mở PR hay sửa `.gitignore` khi người dùng chưa bảo. Khi
   được bảo commit thì dùng dạng pathspec `git commit -m "..." -- <file>`, không `git add -A`.
3. Không publish Artifact lên tài khoản claude.ai; mọi tài liệu là file trong repo.
4. Không đưa dự án lên Plane, không hỏi về Plane.
5. **Không spawn sub-agent, tự làm đơn luồng** (người dùng đặt lại ngày 01/11/2026: "tự làm toàn bộ
   đơn luồng, không được phép spawn subagent"; thay quyết định 23/10/2026). Không gọi
   Agent/Task/Workflow/TeamCreate, kể cả khi rule của kit khuyên fan-out. Tiến trình dài (SITL,
   backend, build) vẫn chạy nền được — đó là công cụ, không phải agent.
6. **Tự chạy nghiệm thu**, đừng đẩy cho người dùng: SITL (`scripts/run_sitl.sh`,
   `scripts/sitl/harness.py`, `bash scripts/sitl/run-all.sh`), `scripts/ws_probe.py`, và MCP
   `cua-driver` cho phần mềm có giao diện. Ngoại lệ **duy nhất**: thao tác làm motor THẬT quay (ARM,
   Motor Test trên phần cứng) — người vận hành tự bấm, tay giữ RC.
7. Computer use trên Windows đi qua `cua-driver` (`.claude/rules/computer-use-cua-driver-first.md`);
   `scripts/gui/gui.ps1` chỉ là đường lui khi `cua-driver` hỏng.
8. Tự động hoá (hook, skill, script) phải cấu hình được và có công tắc tắt, không hà khắc.
9. **Ghi nhớ liên tục.** Có sự thật, quyết định hay lời dặn mới → ghi ngay vào memory của agent;
   luật chung cho mọi phiên → ghi thêm vào file này. Người dùng không muốn phải nhắc lại.

## Khi có nhiều phiên chạy song song

Người dùng thường mở nhiều phiên cùng lúc trên một working tree. Hai phiên ghi cùng một file thì
bản sau đè bản trước mà không báo gì.

- Trước khi sửa file dùng chung (`plans/`, `docs/`, `PROGRESS.md`): `git status --short` xem file
  nào đang bị sửa dở; liệt kê các phiên đang sống và nhắn để chia file — mỗi file chỉ một phiên ghi.
- Được nhường một phần file thì giữ nguyên các khối phiên kia đã viết.
- Sửa xong báo lại phiên kia danh sách file. Kết thúc dòng LF (`.gitattributes` đặt `eol=lf`);
  file `.param` giữ ASCII thuần.

## Bẫy đã gặp, đừng lặp lại

- ESC OX32 đánh số motor kiểu Betaflight → `FRAME_TYPE 12`; ghi motor theo **vị trí** (trước-phải,
  sau-trái…), đừng dùng sơ đồ "Quad X chuẩn ArduPilot" trên mạng.
- Pad **9V** của F405 V5 nằm sát T3/R3 và chân 1 cổng "HD Unit Plug" là 9V — TFmini Plus chỉ chịu 5 V.
- GPS + la bàn chỉ có điện khi cắm pin, và FC chỉ dò la bàn lúc khởi động: **cắm pin trước, USB
  sau**. Rút pin khi USB còn cắm > 10 s thì FC chốt failsafe pin và la bàn đọc sai (`Check mag
  field`) → khởi động lại FC khi đang có pin. Khôi phục tham số sau khi nạp lại firmware: file
  thiếu `INS_ACC_ID` / `COMPASS_DEV_ID` là FC đòi hiệu chỉnh lại
  (`plans/reports/261025-hieu-chinh-bay-trong-nha.md`).
- Tay phát: **SwB là công tắc ARM** — gạt lên khi đang bay là motor tắt, drone rơi; Auto ở núm VrB.
  Bản đồ đầy đủ: `docs/phan-cung-thuc-te.md` hàng RC.
- Bo ESP32 DroneBridge (CP2102, COM4) chỉ nạp được ở **115200** baud. Các bẫy khác của DroneBridge
  và hotspot (đừng cho laptop nối Wi-Fi không có internet, log boot in lộ mật khẩu Wi-Fi, script
  pymavlink qua Wi-Fi phải gửi lệnh tới comp 1 của FC, đừng nối TCP 5760, bo quên laptop sau khi
  hotspot chập chờn nên backend tự chào bằng `MAVLINK_UDP_HELLO`…): đọc
  `firmware/dronebridge/README.md` mục "Bẫy đã gặp" trước khi đụng vào ESP32.
- Bo camera ESP32-S3 (CH343P, COM7): XCLK phải **10 MHz** — 20 MHz làm nhiễu Wi-Fi của chính bo
  (~3 fps, khung JPEG hỏng). Nạp bằng `scripts\esp32\nap_camera.ps1` (thêm `-Ota` để nạp qua Wi-Fi), kiểm bằng
  `uv run python scripts\esp32\camera_check.py`; bẫy khác: `firmware/camera/README.md`.
- Hai ESP32 nối Mobile Hotspot của laptop: gọi bằng tên `iotcv-camera.mshome.net` /
  `DroneBridgeESP32.mshome.net`, IP DHCP đổi mỗi lần hotspot khởi động lại. Mỗi lần laptop quét
  Wi-Fi, cả hai bo mất sóng 3–6 s — chạy `py -3.13 scripts\esp32\wifi_ping_check.py` trước khi nghi bo.
- Đọc log ESP32 bằng `py -3.13 scripts\esp32\esp32_log.py COMx` (không reset bo, tự che mật khẩu);
  pyserial mở cổng theo mặc định là reset bo.
- TFmini: đọc/chỉnh qua FC bằng `scripts/fc/tfmini_qua_fc.py` (gói `SERIAL_CONTROL`, cần
  `RNGFND1_TYPE 0` lúc chạy). **Đừng dùng passthrough `SERIAL_PASS2`**: chiều ghi từ USB kẹt sau vài
  lần gửi, kẹt luôn MAVLink qua USB tới khi khởi động lại FC (gỡ được bằng lệnh reboot qua Wi-Fi).
  Lúc bay: Stabilize không tránh; AltHold tự nghiêng lùi khi vật cản gần hơn `AVOID_DIST_MAX`.
- SITL: mô hình vật lý phải khớp `FRAME_TYPE` (`-f bfx`); cảm biến dòng ảo cố định 17 A/V.
- Mã thoát của một đường ống (`cmd | tail`) là của lệnh cuối — đọc chính kết quả trước khi kết luận PASS.
- Đã **bắt đầu** hiệu chỉnh la bàn (Mission Planner hay `scripts/fc/hieu_chinh_la_ban.py`) thì kể cả
  huỷ giữa chừng, FC vẫn chặn arm bằng `Compass calibrated requires reboot` tới khi khởi động lại;
  offset cũ không mất (01/11/2026).
- Card Wi-Fi laptop (RZ616, một radio) **vừa nối mạng ngoài vừa phát hotspot là phải chia sóng**:
  02/11/2026 nối Wi-Fi nhà thì DroneBridge mất 32 % gói, camera 1,4 khung/s; internet qua cáp iPhone,
  card chỉ phát hotspot thì 3 %, 4,7 khung/s. Ngoài bãi: iPhone phát mạng **qua cáp**, Wi-Fi laptop
  không nối mạng nào (hồ sơ "iPhone nghaiz" đã để nối tay). Card vẫn **tự quét ~60 s một lần** dù không
  nối gì (mỗi lần hai bo mất 0–3 s) → `che_do_bay.ps1 -Bat` tắt "auto configuration" của card (một hộp
  UAC). 02/11: 0/150 gói mất, camera **9,2 khung/s** dù ăn nguồn UBEC, tức camera chậm là do card quét,
  không phải UBEC. Autoconfig tắt thì Windows không tự nối Wi-Fi nào: về nhà chạy `-Tat`. Chi tiết:
  `docs/so-tay/12-hotspot-laptop.md` mục 6–7.
- **Hotspot bám vào mạng có internet lúc nó được bật.** Mạng đó mất (vd. bật hotspot khi còn Wi-Fi nhà
  rồi mới cắm cáp iPhone) thì đúng 20 phút sau Windows tự tắt hotspot, cả hai ESP32 rớt (02/11/2026).
  Bật lại sau khi đã có đúng mạng: `scripts\esp32\hotspot-on.ps1 -Restart` (`chay-drone-that.bat` luôn làm).
- Laptop **chạy pin + Energy Saver bật** (01/11/2026 tối): hotspot rớt 8 s mỗi ~15 s ở cả hai ESP32,
  nạp mission hỏng. Tắt Energy Saver (Win+A) / cắm sạc. Card Wi-Fi khi chạy pin = Maximum Performance
  CHỈ ở scheme Legion Quiet + Performance (lệnh 01/11 chỉ sửa scheme đang dùng); Legion Balance +
  Balanced vẫn 2 (Medium) — đặt cả 4 bằng `scripts/laptop/che_do_bay.ps1 -Bat`. Sau đó DroneBridge sạch, camera vẫn ~0,6 khung/s dù RSSI −30 dBm khi laptop nối iPhone
  2,4 GHz — đọc `http://iotcv-camera.mshome.net/status` (rssi, frames_sent) trước khi nghi bo.
- Hiệu chỉnh (accel, level, la bàn, tay cầm): người dùng tự làm trong **Mission Planner** theo hướng
  dẫn của agent, agent đọc tham số kiểm lại sau — script hiệu chỉnh accel từng hỏng 25/10.
- Laptop **gập nắp hay bấm nút nguồn là NGỦ** (01/11/2026 19:45–20:33): hotspot tắt, mất trắng tlog,
  video, web của cả buổi bay. Chạy pin thì máy còn tự ngủ sau 10 phút và Energy Saver tự bật ở 40 %.
  Trước khi bay: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\laptop\che_do_bay.ps1 -Bat`
  (xong buổi `-Tat`). Legion có 4 power scheme và tự đổi (Fn+Q, rút sạc), sửa một scheme là chưa đủ:
  02/11 card Wi-Fi ở scheme "Legion Balance" vẫn Medium Power Saving khi chạy pin.
- Mục "Energy recommendations" của Windows áp được hết, **trừ "ngủ sau 10 phút"** (ngủ là mất hotspot,
  tlog, video). Quiet mode chạy pin để Energy Saver tự bật ở **50 %** (Balance 40 %) dù không bật tay.
  Áp các mục đó trước, chạy `che_do_bay.ps1 -Bat` sau cùng (02/11/2026).
- Log FC 16 MB chỉ chứa ~20 phút bay, log cũ nhất bị xoá dần từ đầu: 01/11 mất hết các chuyến rơi.
  Rơi hay mất lái thì **tải log ngay** (`scripts/fc/tai_log.py`) rồi mới bay tiếp. Log mất đầu đọc
  bằng `scripts/fc/phan_tich_log.py <log> --fmt-tu <log nguyên vẹn cùng firmware>`.
- `TKOFF_RPM_MIN 1000` (02/11/2026): ARM mà có motor chưa quay đủ vòng thì FC giữ vòng chờ, web báo
  `Takeoff blocked: ESC RPM out of range` → tắt ARM, chờ, ARM lại. ESC ảo của SITL báo 0 vòng nên
  runner SITL nào nạp `01-base.param` phải bù `SITL_BU_RPM` (`scripts/sitl/run_param_load.py`).
- **Bo DroneBridge mượn sysid của FC**: phát HEARTBEAT từ (1, 68), `autopilot` INVALID, `custom_mode` 0,
  mỗi giây. Code nào đọc HEARTBEAT mà chỉ lọc sysid sẽ thấy drone "STABILIZE, disarmed" nửa thời gian
  (backend trước 15/11/2026 lật 1674 lần trong 15 phút; chuyến 10:30 ngày 02/11 nạp mission lúc AUTO mà
  không GUIDED giữ chỗ). Bỏ mọi HEARTBEAT có `autopilot == MAV_AUTOPILOT_INVALID`. SITL không có bo này
  nên không bắt được lỗi kiểu này — kiểm bằng tlog thật.
- Nạp mission khi đang bay AUTO: backend tự chuyển GUIDED đứng giữ chỗ → nạp → đọc lại →
  `DO_SET_MISSION_CURRENT 1`; người lái gạt/bấm AUTO để bay mission mới từ điểm 1. Đừng thêm chặn "không
  nạp khi armed". Đã chạy đúng trên drone thật (02/11, chuyến 10:40).
- Web: build `frontend/` (`pnpm build`) bằng **PowerShell**, đừng bằng Git Bash — build từ Git Bash ghi URL font
  `../../../../../D:/Coding/...` vào CSS, backend trả 404 font (15/11/2026). Màu, chip, nhãn mode/nguồn sự kiện
  lấy từ `lib/tone.ts`, `lib/eventStyle.ts`, `lib/modes.ts` và `components/kit` — đừng tô màu tại chỗ.
  E2E Playwright trong phiên agent có lúc ra trang trắng (`ERR_NETWORK_ACCESS_DENIED` = WinError 10013 khi tải
  chunk JS): đọc ảnh lỗi trước khi kết luận giao diện hỏng.
  Người dùng xem web ở **1707×900, nền ngày** (laptop 2560×1600 @150 %): kiểm bố cục ở đúng cỡ đó. Trang Bay phải vừa
  một màn hình không cuộn cột (radar vật cản thấy ngay), bàn phím lái tay luôn hiện; danh sách nhãn–giá trị dùng
  `KeyValue` của `components/kit` (icon, chip trạng thái), đừng viết bảng trơn tại chỗ.

## Lắp ráp phần cứng (Phase 14.1 → 19)

Hướng dẫn tương tác (sơ đồ, 3D, 76 bước có tick): `docs/huong-dan/lap-rap-phan-cung.html`, mở thẳng
trong trình duyệt. Nguồn ở `docs/huong-dan/lap-rap/src/`, dựng lại bằng
`py -3.13 docs/huong-dan/lap-rap/build.py` — sửa nguồn, đừng sửa file HTML.

- **Người dùng chỉ làm phần tay**: hàn, cắm cáp, lắp khung, đo đồng hồ, cầm / xoay / đặt drone, đọc số đo.
- **Mọi việc trên laptop do agent tự làm**, không đẩy cho người dùng: nạp firmware và tham số
  (`scripts/fc/`), đọc trạng thái FC, hiệu chỉnh trong Mission Planner qua `cua-driver`, cấu hình ESP32,
  bật hotspot, chạy backend + web, đọc log, ghi sổ tay và `plans/PROGRESS.md`. Việc không tự động được
  (giữ BOOT, rút / cắm cáp) thì dừng lại và nói đúng thao tác cần làm. Ngoại lệ vẫn là luật 6: motor THẬT
  quay (ARM, Motor Test, đo lực đẩy) thì người vận hành tự bấm.
- **Kiểm toàn bộ phần cứng:** `scripts/fc/kiem_phan_cung.py COM6` (chỉ đọc: lỗi nội bộ, IMU, baro, la bàn,
  GPS, receiver, TFmini, 4 ESC, pin). Motor Test có số đo: MAVProxy giữ COM6 và chia ra UDP 14551 cho
  Mission Planner (người vận hành bấm) + 14552 cho `kiem_phan_cung.py --ghi`, đừng qua Wi-Fi. Cách làm và
  số đo mốc 15/11/2026: `plans/reports/261115-kiem-phan-cung-that.md` mục 6. TFmini có chùm tia 3,6°:
  thử chắn tay mà số không đổi thì chắn lại cho trúng hai ô kính trước khi nghi cảm biến.
- `chay-tat-ca.bat` chỉ dành cho drone ảo: nó ép `tcp:127.0.0.1:5760` và tắt backend đang chạy. Drone thật
  thì agent chạy backend với `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550`, `CAMERA_FAKE=0`,
  `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`, rồi `pnpm dev`. Mission Planner và
  backend không nghe chung cổng UDP 14550.
