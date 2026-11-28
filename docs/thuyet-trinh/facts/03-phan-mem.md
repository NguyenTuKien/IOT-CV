# Facts 03: Phần mềm (backend, web GCS, SITL, mạng)

Thu thập 26/11/2026 trên `main` (HEAD `361e56c`). Chỉ trạng thái cuối. Mỗi số có nguồn ngay cạnh.
Đường dẫn tương đối tính từ `D:\Coding\IOT-CV\`.

## 1. Kiến trúc tổng thể

Đường chính (drone thật):

```
SpeedyBee F405 V5 (ArduPilot)
   │ UART2 = SERIAL2, MAVLink2, 115200 baud
ESP32 DroneBridge (cầu MAVLink Wi-Fi)
   │ Wi-Fi 2,4 GHz, UDP 14550 (hotspot IOTCV-HOTSPOT của laptop)
Laptop: backend FastAPI (udpin:0.0.0.0:14550), cổng HTTP 8000
   │ WebSocket /ws (telemetry 8 Hz xuống, lệnh lên) + REST /api/*
Web React/Vite (localhost:5173)

Camera ESP32-S3 N16R8 + OV3660
   │ MJPEG http://iotcv-camera.mshome.net:81/stream
Backend: đọc 1 kết nối, giữ khung mới nhất, AI chạy thread riêng
   │ /api/video/stream (gốc hoặc ảnh rõ) + message `detection` trên /ws
Web
```

Nguồn:
- SERIAL2 = DroneBridge, `SERIAL2_PROTOCOL 2`, `SERIAL2_BAUD 115`: `firmware/ardupilot/params/01-base.param` dòng 44–48.
- Backend nghe `udpin:0.0.0.0:14550`, camera qua tên mshome.net, `MAX_ALT=18`, `MAX_DISTANCE_HOME=95`: `chay-drone-that.bat` dòng 22–33.
- Cổng backend 8000, nhịp telemetry 8 Hz: `backend/config.py` dòng 102–105.
- Một socket `/ws` hai chiều: `backend/ws.py` dòng 1–18; route `@app.websocket("/ws")` ở `backend/app.py`.
- Đọc MJPEG một kết nối, fan-out cho N tab: `backend/vision/stream.py` dòng 1–25.
- Pipeline AI thread riêng, chậm thì bỏ khung cũ: `backend/vision/pipeline.py` dòng 1–12.
- Luật "Frontend không đọc MAVLink trực tiếp, FC → MAVLink → backend → JSON chuẩn hoá → web": `backend/mavlink/telemetry.py` dòng 3–6.

Đường phụ:
- **Mission Planner**: dùng để hiệu chỉnh (accel, level, la bàn, tay cầm) và Motor Test do người vận hành bấm. Mission Planner và backend không nghe chung UDP 14550 (`AGENTS.md`, mục "Lắp ráp phần cứng").
- **MAVProxy chia cổng USB**: MAVProxy giữ COM6 và chia ra UDP 14551 cho Mission Planner, UDP 14552 cho `scripts/fc/kiem_phan_cung.py --ghi` (`AGENTS.md`, mục "Kiểm toàn bộ phần cứng").
- **SITL**: drone ảo trong WSL; `chay-tat-ca.bat` ép backend vào `tcp:127.0.0.1:5760` (`AGENTS.md`). Runner nạp-khi-bay dùng `tcp:127.0.0.1:5763` (`scripts/sitl/README.md`, bảng runner).
- Backend tự chào bo DroneBridge mỗi 2 s bằng gói tới `DroneBridgeESP32.mshome.net:14550` để bo nhớ địa chỉ laptop: `backend/config.py` dòng 96–97 (`MAVLINK_UDP_HELLO`, `MAVLINK_UDP_HELLO_PERIOD_S`).
- Backend nhận diện mình là GCS sysid 254, compid 190: `backend/config.py` dòng 87–88.

## 2. Backend: module, số dòng

Đếm bằng `wc -l` ngày 26/11/2026 (không tính `backend/tests/`, `__pycache__`). Tổng **11.671 dòng Python**
trong `backend/` (không tính test). Test backend: 31 file `.py`, **8.107 dòng**.

| Khối | File | Dòng | Việc |
|---|---|---|---|
| Liên kết MAVLink | `backend/mavlink/connection.py` | 486 | nối UDP/TCP/serial, xin nhịp message, lọc HEARTBEAT, ghi tlog, chào DroneBridge |
| Telemetry | `backend/mavlink/telemetry.py` | 568 | hàm thuần `update_state()`, `build_telemetry()`, thread đọc |
| Lệnh bay | `backend/mavlink/control.py` | 451 | mode, ARM, takeoff, velocity GUIDED, RTL, LAND, chờ COMMAND_ACK |
| Mission | `backend/mavlink/mission.py` | 850 | kiểm mission, nạp theo giao thức MISSION_*, đọc lại so khớp, GUIDED giữ chỗ khi đang AUTO |
| Dead-man | `backend/mavlink/deadman.py` | 321 | thread riêng, tự gửi velocity 0 |
| An toàn | `backend/mavlink/safety.py` | 278 | quyền web chỉ ở GUIDED, RC luôn ưu tiên |
| Vật cản | `backend/mavlink/proximity.py` | 179 | `DISTANCE_SENSOR` TFmini → `avoid_state` |
| Hub WebSocket | `backend/ws.py` | 1145 | phát telemetry, nhận lệnh, giới hạn nhịp, một người lái |
| Hợp đồng | `backend/schemas.py` | 864 | mọi message WS + REST bằng Pydantic, sinh `backend/ws-contract.schema.json` |
| REST | `backend/api.py` | 375 | 19 route `/api/*` |
| App | `backend/app.py` | 248 | dựng FastAPI, nối các thread |
| Cấu hình | `backend/config.py` | 398 | mọi ngưỡng đọc từ biến môi trường |
| Sự kiện | `backend/events.py` | 93 | bus sự kiện, vòng đệm cho `GET /api/events` |
| Lịch sử telemetry | `backend/history.py` | 70 | vòng đệm 900 s cho biểu đồ |
| Lịch sử bay | `backend/flights/*.py` (8 file) | 2.031 | ghép log FC `.bin` + tlog + video theo giờ GPS |
| Camera + AI | `backend/vision/*.py` (16 file) | 3.140 | đọc MJPEG, tự chỉnh chất lượng JPEG, ghi video AVI, detector, verifier, enhancer |
| MQTT | `backend/mqtt/publisher.py` | 54 | chỉ là khung, CHƯA hiện thực (xem mục 9) |

Số dòng từng file vision: `stream.py` 344, `auto_quality.py` 302, `fake_stream.py` 294, `pipeline.py` 287,
`track_filter.py` 286, `video_recorder.py` 414, `model_bundle.py` 388, `avi_writer.py` 242, `runtime.py` 191,
`verifier.py` 134, `events.py` 99, `jpeg_tables.py` 90, `detector.py` 76, `enhancer.py` 51, `recorder.py` 35, `__init__.py` 5.
Flights: `offline.py` 538, `index.py` 525, `sources.py` 342, `ai.py` 256, `binlog.py` 143, `video.py` 138, `__main__.py` 63, `__init__.py` 26.

### 2.1 REST: 19 endpoint + 1 WebSocket

Nguồn: `backend/api.py` (APIRouter prefix `/api`, dòng 80), `backend/app.py` dòng 205.

| Nhóm | Endpoint |
|---|---|
| Trạng thái | `GET /api/health`, `GET /api/status`, `GET /api/config`, `GET /api/system` |
| Mission | `GET /api/mission`, `POST /api/mission` |
| Sự kiện, biểu đồ | `GET /api/events`, `GET /api/telemetry/history` |
| Video | `GET /api/video/stream`, `GET /api/video/fake-source`, `GET /api/recording`, `POST /api/recording/start`, `POST /api/recording/stop` |
| Lịch sử bay | `GET /api/flights`, `GET /api/flight`, `GET /api/flights/frame`, `GET /api/flights/ai`, `GET/POST /api/flights/enhance-offline` |
| WebSocket | `/ws` |

### 2.2 WebSocket: 10 loại lệnh lên, 7 loại message xuống

Nguồn: `backend/schemas.py` dòng 748–815. Phong bì chung `{v, type, ts, id?, data}` (dòng 40–62).

| Chiều lên | Trần nhịp (msg/s) |
|---|---|
| `ping` | 2 |
| `cmd.web_control_enable` | 5 |
| `cmd.mode` | 5 |
| `cmd.arm` | 2 |
| `cmd.takeoff` | 2 |
| `cmd.velocity` | 30 |
| `cmd.hold`, `cmd.rtl`, `cmd.land` | 5 mỗi loại |
| `cmd.mission.upload` | 1 |

Chiều xuống: `telemetry`, `status`, `event`, `detection`, `ack`, `error`, `pong`.
12 mã lỗi hợp đồng: `unknown_type`, `unsupported_version`, `bad_payload`, `not_implemented`, `not_connected`,
`web_control_disabled`, `wrong_mode`, `command_denied`, `validation_failed`, `rate_limited`, `timeout`, `internal`
(`backend/schemas.py` dòng 802–815). Message hỏng không đóng socket, chỉ trả `error`; chỉ một tab giữ quyền lái
(`backend/ws.py` dòng 7–18).

## 3. MAVLink

### 3.1 Message backend xin FC gửi, kèm nhịp (Hz)

Nguồn: `backend/mavlink/connection.py` dòng 62–73 (`STREAM_RATES`, xin bằng `MAV_CMD_SET_MESSAGE_INTERVAL` sau mỗi lần nối lại).

| ID | Message | Hz | Dùng cho |
|---|---|---|---|
| 0 | HEARTBEAT | 1 | mode, armed, phát hiện mất link |
| 1 | SYS_STATUS | 2 | cờ sức khoẻ cảm biến |
| 24 | GPS_RAW_INT | 2 | fix, số vệ tinh |
| 30 | ATTITUDE | 10 | chân trời giả |
| 33 | GLOBAL_POSITION_INT | 5 | vị trí trên bản đồ |
| 74 | VFR_HUD | 5 | tốc độ, tốc độ leo |
| 132 | DISTANCE_SENSOR | 5 | khoảng cách TFmini |
| 147 | BATTERY_STATUS | 1 | dòng, % pin |
| 193 | EKF_STATUS_REPORT | 2 | `ekf_ok` |
| 330 | OBSTACLE_DISTANCE | 5 | nhánh dự phòng cho cảm biến 360° |

Message sự kiện nhận thêm (không xin nhịp): STATUSTEXT, COMMAND_ACK, HOME_POSITION (xin từng lần bằng
`MAV_CMD_REQUEST_MESSAGE`, id 242), MISSION_REQUEST/MISSION_REQUEST_INT, MISSION_ITEM_INT, MISSION_COUNT, MISSION_ACK
(`backend/mavlink/connection.py` dòng 52–60; `backend/mavlink/mission.py`).

### 3.2 Message và lệnh backend gửi

Nguồn: grep `mav.*_send` và `MAV_CMD_*` trong `backend/` (26/11/2026).
- Gói: `HEARTBEAT` (type GCS), `COMMAND_LONG`, `SET_POSITION_TARGET_LOCAL_NED` (lái tay bằng vận tốc),
  `MISSION_COUNT`, `MISSION_ITEM_INT`, `MISSION_REQUEST_LIST`, `MISSION_REQUEST_INT`, `MISSION_ACK`, `MISSION_CLEAR_ALL`
  (`backend/mavlink/control.py` dòng 132, 434; `backend/mavlink/mission.py` dòng 470, 630, 735, 746, 766, 779).
- Lệnh `MAV_CMD_*`: `DO_SET_MODE`, `COMPONENT_ARM_DISARM`, `NAV_TAKEOFF`, `NAV_LAND`, `NAV_RETURN_TO_LAUNCH`,
  `MISSION_START`, `DO_SET_MISSION_CURRENT`, `SET_MESSAGE_INTERVAL`, `REQUEST_MESSAGE`.
- Chờ `COMMAND_ACK` tối đa 3 s (`backend/config.py` dòng 135).

### 3.3 Lọc HEARTBEAT `autopilot = INVALID`

- Cổng UDP 14550 nhận ba nguồn HEARTBEAT: (255,0) GCS, (255,68) DroneBridge, (1,1) FC. Hai nguồn đầu có
  `autopilot = MAV_AUTOPILOT_INVALID` (8). Backend chỉ chốt link khi gặp HEARTBEAT có autopilot khác INVALID
  (`backend/mavlink/connection.py` dòng 49–50, 285–314).
- Khi đọc telemetry, mọi HEARTBEAT `autopilot == INVALID` bị bỏ, kể cả khi cùng sysid với FC (bo DroneBridge
  phát từ (1,68), `custom_mode 0`): `backend/mavlink/telemetry.py` dòng 183–194; `AGENTS.md` mục "Bẫy đã gặp".

### 3.4 Nạp mission khi đang bay AUTO

- Đang AUTO thì backend chuyển GUIDED đứng giữ chỗ TRƯỚC khi gửi gói mission nào; không chuyển được thì dừng,
  không gửi gì (`backend/mavlink/mission.py` dòng 501–570). Nạp xong đọc lại so khớp rồi `DO_SET_MISSION_CURRENT 1`;
  người lái gạt AUTO để bay mission mới từ điểm 1 (`AGENTS.md`).
- Chờ mỗi item 3 s, thử lại 8 lần (≈ 24 s, tính cho Wi-Fi ngoài trời): `backend/config.py` dòng 160–161.
- Đọc lại: sai số độ cao cho phép 0,1 m (`backend/config.py` dòng 163).
- SITL `run_nap_khi_bay.py`: PASS, chuyển GUIDED < 0,1 s, lệch vị trí 0,42 m, FC về item 1, AUTO bay thẳng điểm 1
  (`plans/reports/261102-phan-tich-bay-01-11.md` dòng 300). Drone thật 02/11, chuyến 10:40: GUIDED → nạp →
  "Flight plan received" → item 1 → gạt AUTO → bay lại từ "1 Takeoff" (cùng file, dòng 300–302).

### 3.5 Dead-man và lớp an toàn phần mềm

- Ba lớp: đóng tab/rớt mạng → gửi velocity 0 ngay (< 50 ms); trình duyệt treo → hết hạn 300 ms, nhịp kế gửi 0
  (≤ 350 ms); backend chết → ArduPilot tự huỷ lệnh movement (~3 s) (`backend/mavlink/deadman.py` dòng 19–29).
- Vòng dead-man chạy `threading.Thread` riêng, không trong asyncio (cùng file, dòng 7–17).
- Ngưỡng: `MANUAL_COMMAND_TIMEOUT_MS 300`, `DEADMAN_TICK_MS 50`, gửi 0 lặp 5 nhịp (`backend/config.py` dòng 126–133).
- Mọi lần gửi 0 ghi vào `logs/deadman.jsonl` (`backend/config.py` dòng 142).
- Web chỉ lái được ở GUIDED; người lái gạt RC sang mode khác là web mất quyền ngay (`backend/mavlink/safety.py` dòng 1–23).
- Giới hạn phần mềm (lớp phụ, FC mới là chính): trần vận tốc lái tay 1,0 m/s, xoay 45°/s, mission tối đa 10 điểm,
  độ cao 2–18 m, cách home tối đa 95 m khi bay thật (`backend/config.py` dòng 115–125; `chay-drone-that.bat` dòng 28–30).
- Geofence trên FC: `FENCE_TYPE 3` (trần + vòng tròn), trần 20 m, bán kính 100 m, lề 2 m, `FENCE_ACTION 1` = RTL
  (`firmware/ardupilot/params/02-avoid-tfmini.param` dòng 82–106).

### 3.6 Vật cản TFmini

- SITL đo: `DISTANCE_SENSOR` tới từ đúng một nguồn id 10, hướng 0, 10–600 cm; `OBSTACLE_DISTANCE` không có gói;
  sức khoẻ lấy từ bit PROXIMITY (0x4000000) của SYS_STATUS; AC_Avoid phanh không phát STATUSTEXT
  (`backend/mavlink/proximity.py` dòng 6–20).
- Ngưỡng backend: `AVOID_MARGIN_M 2`, `AVOID_DIST_MAX_M 5`, `RANGEFINDER_MAX_M 6`, số đo cũ hơn 2 s → UNKNOWN
  (`backend/config.py` dòng 148–153). Trạng thái `avoid_state`: OFF, NEAR, ACTIVE, UNKNOWN (`backend/schemas.py` dòng 112).

### 3.7 Camera tự chỉnh chất lượng JPEG

- Khung/s đo trên cửa sổ 5 s: dưới 4 khung/s thì tăng số chất lượng thêm 7 (khung nhỏ hơn), trên 6,5 khung/s
  liền 10 s thì giảm lại; dải 12 (nét nhất) tới 40; lật qua lại thì thời gian chờ nhân đôi tới 120 s
  (`backend/config.py` dòng 306–321; `backend/vision/auto_quality.py` dòng 1–25).
- Đổi chất lượng lúc chạy qua `GET /set?quality=N` của firmware camera (`backend/vision/auto_quality.py` dòng 7–8).
- Số đo camera thật 15/11/2026 (VGA, trong nhà): mức 12 → 15,2 KB/khung, 40 → 9,5 KB/khung; khung nhỏ đi tối đa
  ~37 %, khung/s lúc xa tăng tối đa ~1,6 lần (`backend/vision/auto_quality.py` dòng 18–21).

### 3.8 Ghi dữ liệu bay

- tlog: mỗi gói MAVLink kèm 8 byte giờ nhận, đúng định dạng Mission Planner đọc, bộ đệm 4 KB (~< 1 s telemetry)
  (`backend/mavlink/connection.py` dòng 85–100). Thư mục `logs/tlog` (`backend/config.py` dòng 341–342).
- Video ghi đoạn 300 s vào `logs/recordings`, dừng khi ổ còn < 2 GB (`backend/config.py` dòng 326–336).
- Lịch sử telemetry trong RAM 900 s × 8 Hz = 7.200 gói (`backend/config.py` dòng 106–108).

## 4. Frontend (web GCS)

- `frontend/src`: **147 file** `.ts/.tsx`, **20.689 dòng** (đếm 26/11/2026). Test frontend: 3.897 dòng.
- 11 trang + trang 404 (`frontend/src/app/routes.tsx` dòng 55–176). Phím tắt trang: Alt + số (`frontend/src/components/shell/AppShell.tsx` dòng 34–35).

| Phím | Đường dẫn | Trang | Việc chính (mô tả lấy từ `routes.tsx`) |
|---|---|---|---|
| Alt+1 | `/` | Bay | buồng lái: màn hình bay, bản đồ hoặc 3D, chế độ bay, lái tay, vật cản, video |
| Alt+2 | `/mission` | Nhiệm vụ | soạn lộ trình trên bản đồ, hồ sơ độ cao, xem trước 3D, nạp xuống FC và đọc lại |
| Alt+3 | `/3d` | Không gian 3D | bản sao số của drone trên ảnh vệ tinh: tư thế thật, vệt bay, rào ảo, tia đo vật cản |
| Alt+4 | `/vision` | Camera & AI | luồng camera, khung nhận diện, thống kê bộ nhận diện |
| Alt+5 | `/overview` | Tổng quan | sức khoẻ từng khối, mức sẵn sàng bay, chuyến bay trong phiên |
| Alt+6 | `/telemetry` | Dữ liệu bay | biểu đồ thời gian thực mọi trường telemetry, xuất CSV |
| Alt+7 | `/logs` | Nhật ký | sự kiện backend và web, lọc theo mức, nguồn; lịch sử lệnh kèm độ trễ xác nhận |
| Alt+L | `/flights` | Lịch sử bay | phát lại từng chuyến từ log: đường bay, độ cao, hình camera, sóng, mất gói, pin, sự kiện |
| Alt+8 | `/preflight` | Kiểm tra trước bay | cổng kiểm tự động từ telemetry + việc người vận hành tự xác nhận |
| Alt+9 | `/system` | Hệ thống | kiến trúc, trạng thái backend, giới hạn an toàn, thông số kết nối |
| Alt+0 | `/settings` | Cài đặt | giao diện, bản đồ, chất lượng 3D, âm thanh cảnh báo, phím tắt |

Lái tay bằng bàn phím (`frontend/src/lib/velocityMapping.ts` dòng 26–55, `frontend/src/lib/manualControl.ts` dòng 1–31):
- W/↑ tiến, S/↓ lùi, D/→ phải, A/← trái, R lên, F xuống (hệ số 0,5), Q xoay trái, E xoay phải; **Space dừng ngay**.
- H = HOLD đứng yên (`frontend/src/hooks/useHoldShortcut.ts` dòng 12).
- Giữ phím chỉ đổi trạng thái; một bộ hẹn giờ 10 Hz là nơi duy nhất gửi `cmd.velocity` (dưới trần 30/s); thả phím
  gửi thêm 3 nhịp 0. Space và mất tiêu điểm cửa sổ gửi 0 ngay.
- Chỉ chạy khi WEB CONTROL bật, backend xác nhận và tab giữ quyền. Hỗ trợ tay cầm game tuỳ chọn
  (`frontend/src/hooks/useManualControl.ts` dòng 11–15).

Lịch sử bay: ảnh chụp 26/11 cho thấy danh sách 16 chuyến, ngày 02/11/2026 có 9 chuyến, xem gốc và ảnh rõ cạnh nhau
hoặc thanh trượt, biểu đồ độ cao, tốc độ, điện áp pin theo thời gian
(`plans/reports/261126-phase15-lich-su-bay-classic-1707x900.png`). Dòng lệnh tương đương:
`uv run python -m backend.flights --events` (`AGENTS.md`).

## 5. Công nghệ và phiên bản

Backend (`pyproject.toml`): Python ≥ 3.13,< 3.14; pymavlink ≥ 2.4.49; FastAPI ≥ 0.141.1; Pydantic ≥ 2.12;
uvicorn[standard] ≥ 0.53.0; websockets ≥ 17.1; paho-mqtt ≥ 2.1 (khai báo, chưa dùng); numpy ≥ 2.5.3.
Nhóm vision: opencv-python-headless ≥ 4.12, Pillow ≥ 11.0, onnxruntime-gpu 1.24.4 (Windows, CUDA 12 + cuDNN 9).
Dev: pytest ≥ 9.1.1, pytest-asyncio ≥ 1.4.0, httpx ≥ 0.28.1, ruff ≥ 0.16.8, pytest-cov ≥ 7.0. Quản lý gói: uv.

Frontend (`frontend/package.json`): pnpm 11.10.0; React 19.3.1; react-router 8.5.1; Vite 8.3.5; TypeScript ~7.0.2;
Tailwind CSS 4.3.3; radix-ui 1.8.1 + shadcn 4.23.0; zustand 5.0.16; zod 4.6.7; Leaflet 1.9.4 + react-leaflet 5.0.0;
terra-draw 1.39.0 (vẽ mission); three 0.186.1 + @react-three/fiber 9.8.2 + drei 10.7.9 (3D); uPlot 1.6.32 (biểu đồ);
lucide-react 1.64.0; sonner 2.0.8. Test: vitest 5.0.5, @testing-library/react 16.3.3, jsdom 30.1.3,
@playwright/test 1.64.1. Lint: oxlint 1.90.0. Type của hợp đồng sinh từ `backend/ws-contract.schema.json`
bằng json-schema-to-typescript 16.0.0 (`pnpm gen:protocol`).

Firmware FC: ArduPilot 4.7.1 bản custom build (`AGENTS.md` dòng đầu).

## 6. Kiểm thử

| Bộ | Số lượng | Kết quả | Nguồn |
|---|---|---|---|
| pytest backend | 27 file test, **512 test** (đã tính parametrize) | chạy cả bộ 26/11/2026: mã thoát 0, không test nào F/E | `uv run pytest --collect-only -q`, `uv run pytest -q` chạy trong phiên này |
| Vitest frontend | **26 file, 320 test** | **320 passed**, 6,29 s | `pnpm test` chạy trong phiên này 26/11/2026 |
| Playwright E2E | 6 file spec, 13–14 test (`acceptance`, `avoid`, `camera-loss`, `deadman`, `pages`, `smoke`) | CHƯA CÓ NGUỒN cho lần chạy cuối | `frontend/tests/e2e/*.spec.ts`, đếm `test(` tĩnh |

Nhiều test nhất: `test_vision_v2.py` 56, `test_mission_upload.py` 45, `test_proximity.py` 38, `test_telemetry.py` 38,
`test_mission_validation.py` 27 (kết quả `--collect-only`).
Ngưỡng coverage đặt ra: ≥ 80 % cho safety, mission, deadman, proximity (`pyproject.toml`, chú thích nhóm dev).

## 7. SITL (drone ảo ArduCopter trong WSL)

- `scripts/run_sitl.sh` (86 dòng): chạy `sim_vehicle.py` trong WSL, chọn mạng mirrored/NAT bằng `WSL_MIRRORED`.
- `scripts/sitl/harness.py`: lớp `SitlInstance` với `wait_ready`, `set_mode`, `arm`, `takeoff`, `wait_altitude`,
  `upload_mission`, `download_mission`, `rc_override`, `set_param`… (`scripts/sitl/README.md`, mục "harness.py").
- Mô hình vật lý khung `-f bfx` khớp `FRAME_TYPE 12` (`AGENTS.md`).
- `bash scripts/sitl/run-all.sh`: chạy tuần tự 8 runner, in bảng tổng, mã thoát khác 0 nếu có runner hỏng
  (`scripts/sitl/run-all.sh` dòng 22–23; ~17 phút theo `scripts/sitl/README.md`).
- Python SITL: 13 file, 4.093 dòng trong `scripts/sitl/`.

| Runner | Kiểm gì | Kết quả ghi lại |
|---|---|---|
| `run_mode_chain.py` | 7 mode đổi được và có tác dụng | PASS 7/7 mode, RTL về home 0,0 m (`plans/PROGRESS.md` dòng 280) |
| `run_log_dump.py` | rút độ cao + lần đổi mode từ `.BIN` ra CSV | PASS, 1.218 mẫu CTUN (`plans/PROGRESS.md` dòng 284) |
| `run_rtl_alt.py` | `RTL_ALT_M` 15 m và 50 m khác nhau thế nào | PASS, đỉnh 20,0 m và 50,0 m (`plans/PROGRESS.md` dòng 281) |
| `run_mission_auto.py` | mission 5 waypoint nạp, đọc lại, bay AUTO | PASS, 6 item, đọc lại khớp từng trường, tới đủ [1..5] (`plans/PROGRESS.md` dòng 282) |
| `run_mission_low_alt.py` | FC có chặn waypoint 3 m không | PASS: FC KHÔNG chặn (xuống 3,2 m) nên backend phải tự chặn `MIN_ALT 2` (`plans/PROGRESS.md` dòng 283–289) |
| `run_param_load.py` | param nào SITL nhận, từ chối, tự đổi | PASS (`plans/PROGRESS.md` dòng 797) |
| `run_avoid_brake.py` | TFmini ảo + file avoid làm drone phanh trước cột, có đối chứng AVOID tắt | PASS (`plans/PROGRESS.md` dòng 352, 928) |
| `run_ngoai_troi.py` | cấu hình bay ngoài trời giữ drone khi lỡ tay | **8/8 PASS** với rào 100 m (`plans/reports/261115-lich-su-bay-va-phan-tich-01-02-11.md` dòng 256–268) |
| `run_nap_khi_bay.py` (ngoài run-all, cần backend chạy kèm) | nạp mission khi đang AUTO | PASS (mục 3.4) |
| `run_proximity_probe.py`, `run_backend_avoid.py` | đo dữ liệu proximity thật; backend thấy AVOID như FC | số đo dùng để viết `proximity.py` (mục 3.6) |

Chi tiết `run_ngoai_troi.py` 8/8 (rào 100 m, trần 20 m), nguồn như trên:
- S1/S1B mission đi–về 5 m: xa nhất 5,1 / 4,3 m, RTL không leo, hạ đúng home.
- S2 Loiter ga hết cỡ: dừng ở 18,1 m (trần 20, lề 2).
- S3 Stabilize vượt trần: chạm trần lúc leo 7 m/s → RTL, cao nhất 23,2 m, hạ cách home 0,1 m.
- S4 Loiter tiến hết cỡ: tự dừng ở 98,1 m, trước rào.
- S5 AltHold bay ra rào: chạm rào ở 99,6 m lúc 4,1 m/s → RTL, xa nhất 103,4 m, hạ đúng home.
- S6 mất sóng tay cầm: RTL sau ~1 s, hạ đúng home.
- S7 pin yếu: `Battery Failsafe` → RTL, hạ đúng home.

## 8. Mạng ngoài bãi

- Laptop phát Mobile Hotspot SSID `IOTCV-HOTSPOT`, băng 2,4 GHz. Hai bo gọi bằng tên `DroneBridgeESP32.mshome.net`
  và `iotcv-camera.mshome.net` (IP DHCP đổi mỗi lần hotspot khởi động lại): `docs/so-tay/12-hotspot-laptop.md` dòng 28–50.
- Internet cho laptop: iPhone qua cáp USB; Wi-Fi laptop không nối mạng nào; `scripts\laptop\che_do_bay.ps1 -Bat`
  tắt quét nền của card, chống ngủ, đặt card Wi-Fi Maximum Performance ở cả 4 power scheme; về nhà chạy `-Tat`
  (`docs/so-tay/12-hotspot-laptop.md` dòng 154–160, 187–188; `AGENTS.md`).
- `scripts\esp32\hotspot-on.ps1 [-Ssid IOTCV-HOTSPOT] [-Restart]` bật lại hotspot sau khi đã có đúng mạng
  (`scripts/esp32/hotspot-on.ps1` dòng 3; `AGENTS.md`). `chay-drone-that.bat` luôn chạy bước này.
- Kiểm sóng trước khi nghi bo: `py -3.13 scripts\esp32\wifi_ping_check.py` (`AGENTS.md`).

Số đo 02/11/2026 với cấu hình cuối (iPhone qua cáp + tắt quét nền), ping 1 lần/giây trong 150 s:
**DroneBridge mất 0/150, camera mất 0/150, camera 9,2 khung/s** (`docs/so-tay/12-hotspot-laptop.md` dòng 184–185).

Tầm sóng đo khi bay 02/11/2026:
- MAVLink còn sống tới ~49 m (mất 2–12 % gói, RSSI −90 dBm); camera VGA ổn trong ~15 m
  (`firmware/ardupilot/params/02-avoid-tfmini.param` dòng 86–88).
- Camera theo khoảng cách: trong 15 m 7,6–7,8 khung/s, 15–25 m 3,1, quá 25 m 1,8 (`docs/phan-cung-thuc-te.md` dòng 105–106).
- Ngoài tầm Wi-Fi, tay cầm FS-i6X là đường lái chính; `FS_GCS_ENABLE 0` nên mất Wi-Fi không tự RTL
  (`firmware/ardupilot/params/02-avoid-tfmini.param` dòng 87–88).

## 9. Phần IoT (MQTT, dashboard sự kiện)

- **MQTT chưa hiện thực**: `backend/mqtt/publisher.py` chỉ khai báo 5 topic (`uav/telemetry`, `uav/status`,
  `uav/mission`, `uav/detection/person`, `uav/link`), còn `connect()` và `publish()` ném `NotImplementedError`
  (dòng 20–53). Không file nào khác trong `backend/` gọi nó (grep `mqtt` 26/11/2026).
- `plans/phase-23-iot-mqtt-su-kien-dashboard.md` dòng 5: trạng thái "chưa bắt đầu".
- KHÔNG đưa MQTT/Mosquitto/dashboard MQTT lên slide như thứ đã chạy.
- Phần đã chạy có thể trình bày dưới góc IoT: chuỗi cảm biến → truyền (UART, Wi-Fi UDP) → xử lý (backend) → hiển thị
  (web); bus sự kiện nội bộ + `GET /api/events` (`backend/events.py`); sự kiện `vision.person_detected` có chống
  spam theo k/n khung và cooldown 4 s (`backend/vision/pipeline.py` dòng 5–7; `backend/config.py` dòng 217–218);
  ghi tlog, video, lịch sử bay.

## 10. Git

Đếm trên `main` ngày 26/11/2026:
- **89 commit** (`git log --oneline | wc -l`).
- **51 PR đã merge** (số `(#N)` khác nhau trong tiêu đề commit; repo merge kiểu squash nên `git log --merges` = 0).
  PR lớn nhất là #62.
- Commit đầu: 17/08/2026 ("first commit"). Commit cuối: 26/11/2026 (#62).

## Ảnh dùng được

Ảnh trình duyệt 1707×900, giao diện hiện tại. Thứ tự ưu tiên từ trên xuống.

| Đường dẫn tuyệt đối | Trang | Ghi chú cho slide |
|---|---|---|
| `D:\Coding\IOT-CV\frontend\screenshots\day-flight.png` | Bay (nền ngày) | nối SITL, có số: chân trời giả, GPS, pin 100 %, link 72 ms, bàn phím lái, radar vật cản. Thanh menu chưa có mục "Lịch sử bay"; chú giải bản đồ ghi "Giới hạn phần mềm 50 m" và có "Phase 19"; video có nhãn "NGUỒN GIẢ", "fake 99%". Nên cắt chú giải / cắt khung video |
| `D:\Coding\IOT-CV\logs\drone-that\web-drone-that-20261101.png` | Bay, drone THẬT | link 67 ms, pin 99 % 16,8 V, vật cản 0,4 m, nhật ký PreArm. Bản đồ xám ("Map data not yet available"), camera offline, EKF "LỖI", GPS chưa fix (trong nhà). Chỉ dùng nếu cần ảnh "drone thật nối web" |
| `D:\Coding\IOT-CV\plans\reports\261126-phase18-trang-bay-1707x900.png` | Bay (bản mới nhất, có "Lịch sử bay" trên menu) | backend chưa nối drone: ô số trống, "Mất liên lạc", nhật ký lỗi kết nối. Dùng để chỉ bố cục, không để chỉ số liệu |
| `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-classic-1707x900.png` | Lịch sử bay | 16 chuyến, gốc và ảnh rõ cạnh nhau, biểu đồ theo giờ. Nhãn khung phải có tên bundle có số: phải che/cắt |
| `D:\Coding\IOT-CV\plans\reports\261126-phase18-lich-su-bay-offline-1707x900.png` | Lịch sử bay | chưa xem nội dung; tên file cho thấy trạng thái nút ảnh rõ offline |
| `D:\Coding\IOT-CV\plans\reports\261126-phase15-lich-su-bay-offline-tat-1707x900.png` | Lịch sử bay | chưa xem; tránh dùng (chủ đề tính năng không ship) |
| `D:\Coding\IOT-CV\plans\reports\261126-phase15-vision-model-1707x900.png`, `D:\Coding\IOT-CV\plans\reports\261126-phase18-vision-model-status-1707x900.png` | Camera & AI | chưa xem; có thể chứa tên bundle, kiểm trước |
| `D:\Coding\IOT-CV\frontend\screenshots\day-mission.png` / `night-mission.png` | Nhiệm vụ | ảnh 15/11 (commit `84f462b`), chưa xem |
| `D:\Coding\IOT-CV\frontend\screenshots\day-3d.png`, `v3-3d-chase.png`, `v3-3d-field.png`, `v3-hangar.png`, `v3-hangar-exploded.png` | Không gian 3D | 15/11, chưa xem; tên file có "v2/v3" nhưng đó là tên ảnh, không cần nhắc |
| `D:\Coding\IOT-CV\frontend\screenshots\day-overview.png`, `day-telemetry.png`, `day-logs.png`, `day-preflight.png`, `day-system.png`, `day-settings.png`, `day-vision.png` (và bản `night-*`) | Tổng quan, Dữ liệu bay, Nhật ký, Kiểm tra trước bay, Hệ thống, Cài đặt, Camera & AI | 15/11, chưa xem từng ảnh |
| `D:\Coding\IOT-CV\logs\sitl\web-ngoai-troi-nap-di-ve-sitl.png`, `web-ngoai-troi-bay-rec.png` | Bay/Nhiệm vụ trên SITL, mission đi–về | chưa xem; có thể còn rào 50 m cũ |
| `D:\Coding\IOT-CV\.playwright-mcp\flights-1.png`, `flights-full.jpg` | Lịch sử bay (15/11) | chưa xem |
| `D:\Coding\IOT-CV\.playwright-mcp\ai-1040-day-side.png`, `ai-1040-day-slider.png` | Lịch sử bay, AI chuyến 10:40 | 19/11, chưa xem; có thể có tên bundle |

Không nên dùng: `D:\Coding\IOT-CV\docs\so-tay\anh\08-*.png`, `09-*.png` và `D:\Coding\IOT-CV\tmp\p08-*.png`
(giao diện cũ tháng 9, trước khi làm lại web 15/11); `D:\Coding\IOT-CV\frontend\screenshots\debug-nav.png` (ảnh gỡ lỗi).
Ảnh Mission Planner trên SITL (`D:\Coding\IOT-CV\docs\so-tay\anh\03-mp-wp-list.png`, `04-mp-avoid-phanh.png`,
`07-mp-read-wps.png`) và đồ thị phanh `D:\Coding\IOT-CV\docs\so-tay\anh\04-avoid-phanh.png` dùng được cho slide SITL.

## Số liệu thiếu nguồn

- Kết quả lần chạy cuối của Playwright E2E (13–14 test): CHƯA CÓ NGUỒN. Có thư mục `frontend/test-results/` với 3 thư mục kết quả nhưng chưa đọc.
- Tổng số dòng in ra của `uv run pytest -q` bị `addopts = "-q"` làm mất dòng tổng; "512 test, 0 lỗi" dựa trên `--collect-only` + mã thoát 0 + không có ký tự F/E trong output.
- Độ trễ dead-man đo thực tế trên trình duyệt (test `deadman.spec.ts` đọc `logs/deadman.jsonl`): CHƯA CÓ NGUỒN; chỉ có ngưỡng thiết kế 350 ms.
- Độ trễ đầu-cuối web ↔ FC: chỉ có số "Liên lạc 72 ms" (SITL) và "67 ms" (drone thật) đọc trên ảnh chụp, không có phép đo có hệ thống.
- Số chuyến bay tổng cộng: "16 chuyến" chỉ đọc từ ảnh chụp 26/11; chưa chạy `uv run python -m backend.flights`.
- Mất gói MAVLink ngoài bãi lúc đang bay (ngoài phép ping đứng yên 0/150): chỉ có "2–12 % ở ~49 m".
- MQTT/dashboard IoT: không có, vì chưa hiện thực.
