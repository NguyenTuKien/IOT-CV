# IOT-CV

Quadcopter S500 chạy ArduPilot 4.7.1 (bản custom build) trên SpeedyBee F405 V5, điều khiển qua web GCS tự viết (FastAPI +
Vite/React), cầu MAVLink Wi-Fi bằng ESP32 chạy DroneBridge, tránh vật cản bằng TFmini Plus, và nhận diện người bằng model AI
chạy trên ảnh từ camera ESP32-S3 + OV3660 trên drone. Model AI do repo XLA (GitHub Localhost218/XLA) huấn luyện và xuất ra ONNX;
repo này chỉ nạp và chạy nó.

**Đọc [`SAFETY.md`](SAFETY.md) trước khi chạm vào drone thật.** Mọi thao tác làm motor thật quay (ARM, Motor Test) do người vận
hành tự bấm, tay giữ RC.

## Đang ở đâu

Tiến độ thật nằm ở **[`plans/PROGRESS.md`](plans/PROGRESS.md)**, nơi duy nhất ghi phase nào xong, phase nào chưa. Không dùng
công cụ theo dõi nào ngoài repo.

## Đọc gì trước

| Bạn muốn | Đọc file |
|---|---|
| Luật cho mọi agent và các bẫy đã gặp | [`AGENTS.md`](AGENTS.md) |
| Biết kế hoạch và thứ tự làm | [`plans/README.md`](plans/README.md) |
| Biết luật an toàn, **đọc trước khi chạm vào drone** | [`SAFETY.md`](SAFETY.md) |
| Linh kiện thật đang có | [`docs/phan-cung-thuc-te.md`](docs/phan-cung-thuc-te.md) |
| Hiểu một khái niệm từ con số 0 | [`docs/so-tay/`](docs/so-tay/) |

## Yêu cầu hệ thống

| Thứ | Yêu cầu |
|---|---|
| Hệ điều hành | Windows 11 (laptop nhóm). Script `.bat`, `.ps1` và đường dẫn ổ D viết cho Windows |
| Python | 3.13 (`requires-python = ">=3.13,<3.14"`, `.python-version`); uv tự tải nếu máy chưa có |
| uv | bản mới; đã dùng 0.13.8 |
| Node.js, pnpm | Node 24 trở lên (CI dùng 24), pnpm 11.10.0 (khoá `packageManager` trong `frontend/package.json`) |
| WSL2 + Ubuntu | chỉ cần cho drone ảo SITL (distro tên `Ubuntu`) |
| Docker Desktop | không bắt buộc; chỉ để chạy MQTT broker mosquitto cho phần IoT |
| GPU | không bắt buộc. Có GPU NVIDIA (máy nhóm: RTX 4060 Laptop) thì model AI chạy CUDA; không có thì chạy CPU, chậm |
| CUDA | không cài CUDA Toolkit riêng: nhóm `vision` cài `onnxruntime-gpu[cuda,cudnn]==1.24.4`, kéo DLL CUDA 12 + cuDNN 9 dạng gói pip. Chỉ cần driver NVIDIA |

Quy ước ổ đĩa: tải về để ở `D:\IOT_Tools\downloads\`, app ở `D:\IOT_Tools\apps\`, toolchain và cache (uv, pip, npm, pnpm,
PlatformIO) ở `D:\DevCache\`. Không để ở ổ C. `scripts/setup-d-drive.ps1` đặt các biến cache này.

## Cài đặt

Đường chính là uv, đọc đúng `uv.lock`:

```powershell
cd D:\Coding\IOT-CV
uv sync --extra dev --extra vision    # backend + test + khối AI
copy .env.example .env                # rồi sửa theo máy (xem mục Môi trường)

cd frontend
pnpm install --frozen-lockfile        # chạy trong PowerShell
pnpm build                            # build web ra frontend/dist; bắt buộc PowerShell, không dùng Git Bash
```

| Nhóm phụ thuộc | Có gì | Khi nào cần |
|---|---|---|
| (chính) | pymavlink, FastAPI, uvicorn, websockets, paho-mqtt, numpy | luôn luôn; backend bay chạy được chỉ với nhóm này |
| `vision` | OpenCV headless, Pillow, ONNX Runtime (GPU trên Windows, CPU trên Linux), DLL CUDA 12 + cuDNN 9 | camera, video, model AI |
| `dev` | pytest, pytest-asyncio, httpx, ruff, pytest-cov, onnx | chạy test |

Khối `vision` tách riêng có chủ đích: mất camera hay thiếu OpenCV không được kéo telemetry chết theo (`SAFETY.md` mục 9).

Đường dự phòng là pip với `requirements.txt` (Python 3.13, gồm cả `dev` và `vision`):

```powershell
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Repo là ứng dụng (`package = false`), không cần cài chính nó. `requirements.txt` sinh từ `uv.lock`, không sửa tay; mỗi dòng có
điều kiện `sys_platform`, nên Windows nhận `onnxruntime-gpu` còn Linux nhận `onnxruntime` CPU. Sinh lại sau mỗi lần đổi
`uv.lock`:

```powershell
uv export --format requirements-txt --no-hashes --no-emit-project --all-extras --locked -o requirements.txt
```

## Môi trường

`backend/config.py` đọc `.env` ở gốc repo (không cần thư viện thêm); biến đã có trong shell luôn thắng giá trị trong file.
`.env` không được commit; mọi biến kèm giải thích nằm ở [`.env.example`](.env.example). Các biến hay đổi:

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `MAVLINK_ENDPOINT` | `udp:127.0.0.1:14550` | SITL: `udpin:127.0.0.1:14550` (hoặc `tcp:127.0.0.1:5760` như `chay-tat-ca.bat`); drone thật qua DroneBridge: `udpin:0.0.0.0:14550` |
| `MAVLINK_UDP_HELLO` | `DroneBridgeESP32.mshome.net:14550` | backend tự chào bo DroneBridge khi nghe UDP; để trống thì tắt |
| `CAMERA_FAKE` | `1` | `1`: backend tự phát video mẫu ở `/api/video/fake-source`; `0`: đọc camera thật |
| `CAMERA_STREAM_URL` | `http://192.168.4.1:81/stream` | camera thật: `http://iotcv-camera.mshome.net:81/stream` |
| `CAMERA_AUTO_QUALITY` | `1` | tự hạ chất lượng JPEG của camera (12 → 40) khi dưới 4 khung/s |
| `VISION_ENABLED` | `1` | `0` tắt hẳn khối vision |
| `RECORD_VIDEO`, `TLOG_ENABLE` | theo `CAMERA_FAKE`, `1` | ghi video ra `logs/recordings/`, telemetry ra `logs/tlog/` |
| `MAX_ALT`, `MIN_ALT`, `MAX_DISTANCE_HOME` | `10`, `2`, `50` | giới hạn phần mềm của web; geofence trên FC mới là lớp chính |
| `MQTT_BROKER`, `MQTT_PORT` | `127.0.0.1`, `1883` | broker mosquitto |

Biến của model AI: xem mục "AI nhận diện người (vision)".

## Chạy

Drone ảo và drone thật dùng hai file khởi động khác nhau. Hai file **không chạy cùng lúc** (cùng cổng 8000). Tắt hết:
`dung-tat-ca.bat`.

| | Drone ảo (SITL) | Drone thật |
|---|---|---|
| Lệnh | `chay-tat-ca.bat` | `chay-drone-that.bat` |
| Làm gì | tắt bản cũ, bật SITL trong WSL, mosquitto (nếu có Docker), backend, `pnpm dev`, mở trình duyệt | kiểm laptop (chế độ bay, mạng iPhone qua cáp, Wi-Fi không nối mạng ngoài), bật lại hotspot, backend, `pnpm dev`, mở trình duyệt |
| MAVLink | ép `MAVLINK_ENDPOINT=tcp:127.0.0.1:5760` (Mission Planner dùng 5762) | `udpin:0.0.0.0:14550` từ ESP32 DroneBridge |
| Camera | video mẫu (`CAMERA_FAKE` mặc định) | `CAMERA_FAKE=0`, `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`, ghi video + tlog |
| Web | http://localhost:5173 | http://localhost:5173 |

`chay-tat-ca.bat` **chỉ dành cho drone ảo**: nó ép endpoint TCP 5760 và tắt backend đang chạy. Trước buổi bay thật: cắm pin
drone trước rồi mới cắm USB, chạy `scripts\laptop\che_do_bay.ps1 -Bat` (máy không ngủ, card Wi-Fi không tự quét), xong buổi chạy
`-Tat`. Mission Planner và backend không nghe chung cổng UDP 14550.

Chạy tay từng phần:

```powershell
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000   # backend, http://127.0.0.1:8000
cd frontend; pnpm dev                                          # web, http://localhost:5173
docker compose up -d mosquitto                                 # MQTT broker cho phần IoT
uv run python scripts/ws_probe.py --count 20                   # xem 20 message telemetry qua WebSocket
```

Mở web bằng `localhost:5173`, không bằng `127.0.0.1:5173`. Nghiệm thu trên SITL (trong WSL): `bash scripts/sitl/run-all.sh`,
khoảng 17 phút, mỗi runner kết bằng `KET QUA: PASS` hoặc `KET QUA: FAIL` (xem [`scripts/sitl/README.md`](scripts/sitl/README.md)).
Kiểm phần cứng thật, chỉ đọc, không ARM: `uv run --offline --with pyserial python scripts/fc/kiem_phan_cung.py COM6`.

## AI nhận diện người (vision)

Hai model ONNX đến từ repo XLA theo hợp đồng `docs/hop-dong-model.md` của XLA (v1.0): `detector` (YOLO11s tinh chỉnh trên ảnh
làm xấu theo camera, input `frame` uint8 [480, 640, 3] BGR, output `boxes` + `scores`) và `enhancer` (NAFNet, output
`frame_out`). Tiền và hậu xử lý (letterbox, NMS) nằm trong graph; backend chỉ nạp và chạy.

**1. Lấy bundle.** Một bundle là thư mục `<model>-v<semver>/` gồm `<model>.onnx`, `meta.json`, `golden/`. Bản đã phát hành ở
GitHub Release `models-v1.0.0` của XLA, hoặc có sẵn trong `D:\XLA\models\release\` nếu máy có repo XLA. Chép vào
`models/vision/<bundle>/`:

```powershell
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.0
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/enhancer-v1.0.0
```

Lệnh kiểm cấu trúc bundle và sha256 khớp `meta.json` rồi mới chép, in `đã chép <nguồn> -> <đích>` và hai dòng
`DETECTOR_ONNX=…`, `DETECTOR_SHA256=…` để chép vào `.env`. Nó không sửa `.env`. File `.onnx` bị `.gitignore` chặn
(`/models/vision/`), không vào git. Mã thoát: 0 đã chép, 1 bundle sai, 2 sai cách gọi.

**2. Kiểm bundle** bằng chính bộ nạp của backend và 3 khung golden:

```powershell
uv run python scripts/vision/kiem_bundle.py models/vision/detector-v1.0.0 --json
uv run python scripts/vision/kiem_bundle.py models/vision/enhancer-v1.0.0 --cpu --json   # ép chạy CPU
```

Detector đạt khi cùng số hộp, mỗi hộp IoU ≥ 0,95 và lệch score ≤ 0,02; enhancer đạt khi sai khác trung bình ≤ 1,0 và lớn nhất
≤ 8 (thang 0–255). Mã thoát 0 đạt, 1 bị từ chối hoặc golden lệch.

**3. Bật trong backend.** Đặt trong `.env` (hoặc biến môi trường của lệnh chạy backend):

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `VISION_ENABLED` | `1` | `0` tắt hẳn khối vision |
| `DETECTOR_ONNX` | `models/vision/detector-v1.0.0/detector.onnx` | tương đối gốc repo |
| `DETECTOR_SHA256` | rỗng | **bắt buộc**: rỗng hoặc lệch là model không nạp |
| `ENHANCER_ONNX` | `models/vision/enhancer-v1.0.0/enhancer.onnx` | |
| `ENHANCER_SHA256` | rỗng | bắt buộc như trên |
| `VISION_ORT_PROVIDERS` | `CUDAExecutionProvider,CPUExecutionProvider` | thứ tự ưu tiên provider của ONNX Runtime |
| `VISION_CUDA_OPTIONS` | `prefer_nhwc=1` | tuỳ chọn CUDA EP `khoá=giá trị;…`; `prefer_nhwc=1` nhanh hơn khoảng 17 % |
| `DETECTION_CONFIDENCE` | rỗng | rỗng = `conf_threshold` trong `meta.json` của bundle |
| `DETECTION_MIN_FRAMES`, `DETECTION_COOLDOWN_S` | `3`, `4` | chống spam sự kiện phát hiện người |
| `ENHANCED_JPEG_QUALITY` | `85` | chất lượng JPEG của luồng "Ảnh rõ" |

`backend/vision/model_bundle.py` kiểm bốn bước lúc nạp: file tồn tại; sha256 của file = env `*_SHA256` = `meta.onnx_sha256`;
major của `contract_version` = 1; tên, kiểu, shape I/O đúng hợp đồng. Sai bước nào thì model đó không nạp, phát sự kiện
`vision.model_rejected`, còn MAVLink, WebSocket và luồng video gốc chạy bình thường. Trạng thái từng model (`loaded`,
`rejected`, `disabled`, kèm `providers`, `cpu_only` và ms p50/p95 từng bước) nằm trong khối `vision` của `GET /api/status`.

Pipeline (`backend/vision/pipeline.py`): detector chạy trên **khung gốc** mỗi khung; enhancer chỉ chạy khi có người xem
`/api/video/stream?variant=enhanced`, tức nút **"Ảnh rõ"** trên web. Nút này **tắt mặc định**: `enhancer-v1.0.0` đúng hợp đồng
nhưng không đạt A/B ở XLA (người chấm mù: mạng chỉ thắng ảnh gốc 11/25 lượt, thắng bộ lọc cổ điển 1/25 lượt), và ảnh làm rõ còn làm
giảm mAP của detector, nên nhận diện không bao giờ chạy trên ảnh đã làm rõ. Không có enhancer thì luồng `enhanced` trả 503
`enhancer_unavailable`.

**GPU trên Windows.** ORT-GPU cần DLL CUDA 12 + cuDNN 9 từ các gói pip `nvidia-*`. `preload_dlls()` chưa đủ: mọi thư mục
`site-packages/nvidia/*/bin` phải có trong `PATH`, vì cuDNN 9 nạp thư viện con lúc chạy Conv đầu tiên. Thiếu thì ORT vẫn báo
`CUDAExecutionProvider` rồi lặng lẽ chạy CPU. `model_bundle.py` tự thêm các thư mục đó vào `PATH`, chạy thử một khung đen, rồi
mới đọc `get_providers()`; nếu chỉ còn CPU thì log `!!! detector 1.0.0 chạy CPU-ONLY …` và `cpu_only: true`. `onnxruntime-gpu`
ghim 1.24.4 vì 1.25 trở lên đòi CUDA 13.

**Đo tốc độ** trên một bản ghi camera thật, GPU, ghi `logs/vision-bench/<thời điểm>.json`:

```powershell
uv run python scripts/vision/replay_bench.py --recording logs/recordings/20261102-100941 --json
```

Ngân sách: tổng p95 ≤ 50 ms, detector p95 ≤ 30 ms, enhancer p95 ≤ 30 ms. Số ms phụ thuộc GPU có đang hạ xung không: đọc khối
`machine` trong file bench trước khi so.

## Kết quả mong đợi

Test backend (`uv run pytest`, khoảng 15 s):

```
411 passed, 1 warning in 14.98s
```

Test web (`pnpm test` trong `frontend/`, chạy từ PowerShell):

```
 Test Files  22 passed (22)
      Tests  278 passed (278)
```

`kiem_bundle.py models/vision/detector-v1.0.0 --json` khi đạt (rút gọn):

```json
{"pass": true, "model": "detector", "version": "1.0.0", "onnx_sha256": "23b1da69…",
 "providers": ["CUDAExecutionProvider", "CPUExecutionProvider"],
 "golden": [{"frame": "000.jpg", "n_expected": 1, "n_got": 1, "min_iou": 0.9998, "max_dscore": 0.0002, "pass": true}, "…"]}
```

Dòng log khi backend nạp được model trên GPU:

```
INFO backend.vision.model_bundle: Đã nạp detector 1.0.0, provider ['CUDAExecutionProvider', 'CPUExecutionProvider']
```

Sha256 sai thì model bị từ chối với lý do dạng `sha256 lệch: file 23b1da69165f…, env 00…, meta 23b1da69165f…`.

Tốc độ đo ở XLA (`results/reproduce/tables/t6_iotcv_ms.md` của XLA, RTX 4060 Laptop, GPU 72 °C, bản ghi 20261102-100941):

| Chế độ | Detector p50 / p95 ms | Enhancer p50 / p95 ms | Tổng p50 / p95 ms | Khung/s |
|---|---|---|---|---|
| Nhịp thật, có người xem Ảnh rõ | 23,6 / 33,4 | 12,5 / 19,0 | 37,5 / 54,1 | 7,2 |
| Hết tốc lực, hai model | 26,7 / 28,1 | 14,6 / 15,7 | 42,5 / 44,9 | 23,6 |

Ở nhịp camera thật ngân sách p95 không đạt trên laptop này (GPU hạ xung giữa hai khung); nhóm chấp nhận giới hạn đó. Pipeline vẫn
theo kịp camera, bỏ 0,3 % khung.

## Test

```powershell
uv run pytest                          # backend, backend/tests (CI chạy với --extra dev)
uv run pytest --collect-only -q        # chỉ liệt kê test
uv run ruff check .                    # lint Python
cd frontend; pnpm test; pnpm lint; pnpm build   # web; PowerShell
```

Test AI (`backend/tests/test_vision_ai.py`) tự dựng bundle ONNX giả bằng `onnx.helper`, không cần model thật hay GPU.
Nghiệm thu điều khiển, telemetry, mission trên drone ảo: `bash scripts/sitl/run-all.sh` trong WSL.

## Gỡ lỗi

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| Model báo CUDA nhưng chậm, `cpu_only: true` | thiếu DLL cuDNN trong `PATH`. Dùng `uv sync --extra vision` (gói `nvidia-*`), đừng cài `onnxruntime-gpu` tay; đọc provider sau một lần chạy thử |
| Model không nạp, sự kiện `vision.model_rejected` | `DETECTOR_SHA256`/`ENHANCER_SHA256` rỗng hoặc lệch. Lấy sha256 từ dòng in của `lay_model.py` |
| Web thiếu font (404) sau khi build | build từ Git Bash ghi URL font `../../../../../D:/Coding/...` vào CSS. Build lại bằng PowerShell |
| Web mở `127.0.0.1:5173` bị từ chối | mở `http://localhost:5173` |
| E2E Playwright ra trang trắng | `ERR_NETWORK_ACCESS_DENIED` (WinError 10013) khi tải chunk JS trong phiên agent. Đọc ảnh lỗi trước khi kết luận giao diện hỏng |
| Mode hay trạng thái ARM nhảy liên tục | bo DroneBridge phát HEARTBEAT mượn sysid của FC với `autopilot` INVALID. Code đọc HEARTBEAT phải bỏ gói `MAV_AUTOPILOT_INVALID` |
| Backend không thấy drone thật qua Wi-Fi | đừng nối TCP 5760; script pymavlink gửi lệnh tới comp 1 của FC; bo quên laptop sau khi hotspot chập chờn (backend tự chào bằng `MAVLINK_UDP_HELLO`). Xem `firmware/dronebridge/README.md` mục "Bẫy đã gặp" |
| Hai ESP32 mất sóng vài giây, camera chậm | laptop quét Wi-Fi, chạy pin với Energy Saver, hoặc card vừa nối mạng ngoài vừa phát hotspot. Chạy `scripts\laptop\che_do_bay.ps1 -Bat`, lấy internet qua cáp iPhone, kiểm bằng `py -3.13 scripts\esp32\wifi_ping_check.py` |
| Hotspot tự tắt sau 20 phút | mạng có internet mà hotspot bám vào lúc bật đã mất. `scripts\esp32\hotspot-on.ps1 -Restart` sau khi đã có đúng mạng |
| `Check mag field`, la bàn đọc sai | cắm USB trước pin. Cắm pin trước, USB sau; khởi động lại FC khi đang có pin |
| Web báo `Takeoff blocked: ESC RPM out of range` | có motor chưa quay đủ vòng (`TKOFF_RPM_MIN 1000`). Tắt ARM, chờ, ARM lại |
| SITL không khớp drone thật | mô hình vật lý phải khớp `FRAME_TYPE` (`-f bfx`); runner nạp `01-base.param` phải bù RPM vì ESC ảo báo 0 vòng |
| Lệnh `cmd \| tail` báo PASS mà thật ra hỏng | mã thoát của đường ống là của lệnh cuối. Đọc chính kết quả |

Danh sách đầy đủ ở [`AGENTS.md`](AGENTS.md) mục "Bẫy đã gặp, đừng lặp lại".

## Cấu trúc thư mục

```
backend/     FastAPI + MAVLink + MQTT + vision; chạy native, không đóng gói Docker
  vision/    nạp bundle ONNX của XLA (model_bundle.py), detector, enhancer, pipeline, camera, ghi video
frontend/    Vite + React + TypeScript; build ra frontend/dist, FastAPI phục vụ
firmware/    ArduPilot custom build + param, firmware camera ESP32-S3, DroneBridge
models/      models/vision/<bundle>/ chép từ XLA (đã gitignore)
ml/          khung sườn AI cũ, không dùng: phần AI nay ở repo XLA (ml/README.md)
plans/       kế hoạch 25 phase chính + 4 phase AI, và PROGRESS.md
docs/        so-tay/ giải thích cho người mới · huong-dan/ hướng dẫn HTML · archive/ tài liệu đã thay thế
infra/       deploy web lên AWS EC2 (Docker, Terraform)
deploy/      cấu hình mosquitto
scripts/     SITL, FC, ESP32, laptop, vision, GUI automation
```

## Tài liệu

| Tài liệu | File |
|---|---|
| Luật cho agent, bẫy đã gặp | [`AGENTS.md`](AGENTS.md) |
| Luật an toàn | [`SAFETY.md`](SAFETY.md) |
| Tiến độ, thứ tự phase | [`plans/PROGRESS.md`](plans/PROGRESS.md), [`plans/_phase-index.md`](plans/_phase-index.md) |
| Quyết định còn mở | [`plans/QUYET-DINH-CHUA-CHOT.md`](plans/QUYET-DINH-CHUA-CHOT.md) |
| Linh kiện thật | [`docs/phan-cung-thuc-te.md`](docs/phan-cung-thuc-te.md) |
| Biến môi trường | [`.env.example`](.env.example) |
| Hợp đồng luồng MJPEG | [`docs/hop-dong-mjpeg.md`](docs/hop-dong-mjpeg.md) |
| Sổ tay từng phase | [`docs/so-tay/`](docs/so-tay/) |
| Hướng dẫn lắp ráp (mở trong trình duyệt) | [`docs/huong-dan/lap-rap-phan-cung.html`](docs/huong-dan/lap-rap-phan-cung.html) |
| Hotspot laptop | [`docs/so-tay/12-hotspot-laptop.md`](docs/so-tay/12-hotspot-laptop.md) |
| DroneBridge, camera ESP32-S3 | [`firmware/dronebridge/README.md`](firmware/dronebridge/README.md), [`firmware/camera/README.md`](firmware/camera/README.md) |
| SITL tự động | [`scripts/sitl/README.md`](scripts/sitl/README.md) |
| Kiểm phần cứng thật 15/11/2026 | [`plans/reports/261115-kiem-phan-cung-that.md`](plans/reports/261115-kiem-phan-cung-that.md) |
| AI cũ, trỏ sang XLA | [`ml/README.md`](ml/README.md) |
| Deploy web lên AWS | [`infra/README.md`](infra/README.md) |
| Phần AI (thiết kế, thí nghiệm, kết quả, hợp đồng model) | repo XLA (GitHub Localhost218/XLA): `BAO_CAO_DO_AN.md`, `docs/hop-dong-model.md` |

Kế hoạch 92 giai đoạn cũ đã chuyển sang [`docs/archive/plan-nhap-92-giai-doan.md`](docs/archive/plan-nhap-92-giai-doan.md),
giữ làm tham khảo, không phải kế hoạch đang bám theo.
