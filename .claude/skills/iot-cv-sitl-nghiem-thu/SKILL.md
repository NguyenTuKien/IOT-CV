---
name: iot-cv-sitl-nghiem-thu
description: Tự chạy nghiệm thu IOT-CV trên drone ảo SITL — bật SITL nền, chạy runner harness, nối backend, dò WebSocket, dọn tiến trình. Dùng khi cần kiểm backend điều khiển/telemetry/mission trên SITL thật, chạy scripts/sitl/*.py, hoặc khi định nói "không tự chạy được bài này".
---

# Nghiệm thu trên SITL (IOT-CV)

Đây là **ghi chép kinh nghiệm**, không phải luật cứng. Dự án còn đổi nhiều, nên
gặp tình huống mới hoặc thấy chỗ nào sai thì sửa thẳng vào file này, kèm lý do.

SITL là máy bay **ảo**, nên tôi tự chạy nghiệm thu được từ đầu tới cuối. Thứ
duy nhất để người vận hành tự làm là thao tác làm **motor thật** quay (xem `SAFETY.md`).

## Các công cụ có sẵn

| Muốn kiểm | Công cụ |
|---|---|
| Hành vi ArduPilot (mode, RTL, mission) | Các runner trong `scripts/sitl/`. Mỗi runner tự bật, tự tắt phiên riêng và in `KET QUA: PASS/FAIL`. Danh sách ở `scripts/sitl/README.md` |
| Backend nối SITL | `scripts/sitl/sitl-headless.sh start` → backend với `MAVLINK_ENDPOINT=tcp:127.0.0.1:5760` → `scripts/ws_probe.py` / `scripts/sitl_deadman_check.py` → `stop` |
| Logic backend thuần | `uv run pytest` (hook dự án có thể tự chạy, cấu hình ở `.claude/iot-cv-hooks.json`) |
| Phần mềm GUI | MCP `cua-driver` |

Tất cả đều có thể thay: script mới tốt hơn thì cứ dùng, rồi cập nhật bảng này.

## Những điều đã học được (và vì sao)

- **Gọi WSL bằng `wsl -d Ubuntu --exec bash -lc '...'`.** Với `--`, wsl.exe cho
  lệnh đi qua thêm một lớp shell, và lớp đó mở rộng `$?` quá sớm, nên mã thoát
  luôn hiện 0 (đo ngày 25/09/2026). Distro tên `Ubuntu`.
- **Chạy python bằng `~/venv-ardupilot/bin/python3`**, vì chỉ venv này có `pymavlink`.
- **Bài có đo thời gian thì để `SITL_SPEEDUP=1`**, nếu không số đo sẽ lệch.
  Bài chỉ kiểm logic thì tăng speedup cho nhanh cũng được.
- **Mỗi CỔNG của SITL `--no-mavproxy` chỉ nhận một client TCP**, nhưng có ba cổng:
  5760 (SERIAL0), 5762 (SERIAL1), 5763 (SERIAL2). Cách dùng đã chạy được
  (25/09/2026): harness/runner 5760, Mission Planner 5762, backend 5763
  (`scripts/sitl/run_backend_avoid.py` làm đúng thế). Nếu bản sửa "không có
  tác dụng", kiểm xem tiến trình giữ cổng 8000 có phải backend mới chạy không.
  Đã từng kết luận sai vì code cũ vẫn đang giữ cổng.
- **FC chuyển tiếp gói giữa các cổng.** Mission Planner nối cùng lúc thì backend
  nhận cả HEARTBEAT/STATUSTEXT của MP. Từ Phase 07 thread đọc đã lọc theo sysid;
  nếu thấy mode nhảy GUIDED ↔ STABILIZE mỗi giây thì kiểm lại chỗ lọc đó trước.
- **`plans/samples/takeoff.jsonl` bật WEB CONTROL rồi đóng socket**, nên dead-man
  gửi velocity 0 và GUIDED huỷ lệnh takeoff: máy bay nằm đất, tự disarm sau 10 s.
  Muốn máy bay bay lên để thử tiếp thì gửi mode/arm/takeoff trong MỘT socket giữ
  mở, không bật WEB CONTROL (mấy lệnh đó không cần nó).
- **Muốn thử khoảng cách / AVOID thì cần phiên SITL riêng có TFmini ảo + lưới
  cột** (`run_avoid_brake.py`, `run_backend_avoid.py`); phiên `sitl-headless.sh`
  mặc định không có cảm biến khoảng cách. FC chỉ gửi `DISTANCE_SENSOR` khi có
  vật trong tầm, nên "không có số đo" chưa chắc là cảm biến hỏng.
- **Script Python chạy nền thì dùng `python -u`**, không thì output bị đệm và
  file log rỗng tới lúc thoát, trông như script bị treo.
- **Dọn bằng `sitl-headless.sh stop` rồi xem `status`.** Lệnh này đếm cả cửa sổ
  `xterm -hold`, thứ mà `pgrep arducopter` không thấy. Tránh `pkill -f arducopter`
  trong lệnh wsl vì nó giết luôn shell đang chạy chính lệnh đó.
- `ps` in "screen size is bogus" thì vô hại. `export COLUMNS=200` là hết.
- **Mẫu cho máy bay bay mà không bật WEB CONTROL** (Phase 09, 25/09/2026):
  `plans/samples/cat-canh-dung-yen.jsonl` (GUIDED → arm → takeoff 5 m, treo tới khi
  có lệnh mới), rồi `--send` `cmd.mode AUTO` để bay mission đang có trên FC;
  `bay-mission-auto.jsonl` gộp arm + nạp + AUTO. `mission-thieu-takeoff.json` là
  mission sai để thử cổng chặn backend. `ws_probe --script`/`--send-mission` **chỉ
  nhận file nằm trong repo** — file ở scratchpad bị từ chối.
- **RTL của phiên SITL leo lên 15 m**, cao hơn `MAX_ALT` 10 m của backend. Đó là
  param độ cao RTL của FC, không phải lỗi web/backend. Bài nào kiểm "không vượt trần"
  thì đừng tính chặng RTL, hoặc chỉnh param trước.
- **Poll telemetry bằng `ws_probe --field ... --count 1`** trong vòng lặp để biết lúc
  máy bay hạ cánh/disarm. Output in `armed=false` (không có dấu ngoặc kép) — viết
  điều kiện dừng theo đúng dạng đó.
- **Sáu bẫy khi viết `run_ngoai_troi.py` (01/11/2026)** — runner đó là mẫu cho bài
  "cố tình vượt lưới an toàn":
  1. Lệnh RTL nằm **trong** mission thì HEARTBEAT vẫn báo `AUTO` (submode RTL). Kiểm
     chặng RTL cuối mission bằng `MISSION_CURRENT.seq`, không bằng mode — không thì
     điều kiện "RTL không leo" xanh mà chẳng đo gì.
  2. RC ảo của SITL để **ga 1000**: ở LOITER/ALT_HOLD mà không gửi RC override (ga 1500)
     là drone tự hạ rồi tự disarm.
  3. **RC override MAVLink cũng tính là "có sóng"** (`RC_Channels::read_input`). Bài mất
     sóng (`SIM_RC_FAIL 1`) phải NGỪNG gửi override, không thì failsafe không bao giờ tới.
  4. Dòng ảo ~35 A: cả buổi ~9 phút bay ảo là vượt `BATT_LOW_MAH` → failsafe dung lượng
     chen vào bài khác. Đặt lại pin về 100 % trước mỗi bài bằng `MAV_CMD_BATTERY_RESET`
     (42651, param1 mask, param2 %).
  5. Áp FC đọc = `SIM_BATT_VOLTAGE` × `BATT_VOLT_MULT` / 10,1 (SITL giả định bộ chia
     10,1; bo dự án 11,0) → 16,8 V ảo thành 18,3 V. Muốn FC đọc một mức áp thì chia
     theo tỉ lệ, đừng trừ như thể sụt áp.
  6. Waypoint "đã tới" khi vào trong `WP_RADIUS_M` (2 m): mission đi–về quay đầu trước
     điểm xa ~1,5 m. Ngưỡng kiểm phải là `xa − WP_RADIUS_M`, không phải "tới trong 1 m".
- **Bốn điều học được khi nghiệm thu tham số mới + web (01–02/11/2026):**
  1. **pytest trong phiên agent:** sandbox chặn socket lúc được lúc không (`WinError 10013`), kể cả
     khi đã tắt sandbox. Chạy qua `Start-Process cmd.exe` rồi đọc file kết quả:
     `cd /d D:\Coding\IOT-CV && set "PYTHONUTF8=1" && uv run pytest backend/tests -q -p no:cacheprovider -rs > <file> 2>&1`.
     Viết `set PYTHONUTF8=1 && ...` (không ngoặc kép) thì biến dính dấu cách cuối →
     `Fatal Python error: invalid PYTHONUTF8`.
  2. **SITL headless lúc đầu chỉ mở cổng 5760**; 5762/5763 chỉ mở sau khi đã có client nối 5760.
     Nối backend vào 5762/5763 thì cho harness/runner nối 5760 trước.
  3. **`TKOFF_RPM_MIN` trên SITL:** ESC ảo báo 0 vòng nên takeoff bị chặn
     (`Takeoff blocked: ESC RPM out of range` mỗi 2 s) mà FC vẫn ARM ở GUIDED, lần 01/11 tới 6 phút.
     Runner nào nạp `01-base.param` phải bù `SITL_BU_RPM` (`scripts/sitl/run_param_load.py`); máy bay
     ARM mà không lên thì đọc STATUSTEXT trước khi nghi code.
  4. **Playwright MCP (chế độ extension):** chạy Vite bằng `pnpm dev --host 127.0.0.1` và mở
     `http://127.0.0.1:5173`; Vite nghe `[::1]` thì trình duyệt báo `ERR_NETWORK_ACCESS_DENIED`. Tab đã
     rơi vào `chrome-error://` thì không điều hướng tiếp được, mở tab mới. Playwright chỉ ghi file trong
     `.playwright-mcp/` hoặc repo; ảnh chụp xong thì dọn.

## Báo kết quả

Dẫn output thật (dòng `KET QUA:`, số test pass/fail). Bước nào bỏ qua hay chưa
chạy được thì nói rõ, kèm lỗi cụ thể.
