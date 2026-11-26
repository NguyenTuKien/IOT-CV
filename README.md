# IOT-CV

Quadcopter S500 chạy ArduPilot 4.7.1 (bản custom build) trên SpeedyBee F405 V5, điều khiển qua web GCS tự viết (FastAPI +
Vite/React), cầu MAVLink Wi-Fi bằng ESP32 chạy DroneBridge, tránh vật cản bằng TFmini Plus, và nhận diện người bằng model AI
chạy trên ảnh từ camera ESP32-S3 N16R8 + OV3660 trên drone. Model AI do repo XLA (GitHub Localhost218/XLA) huấn luyện và xuất
ra ONNX; repo này chỉ nạp và chạy nó. Bản AI đang chạy là **AI v2** (26/11/2026).

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
| GPU | không bắt buộc. Có GPU NVIDIA (máy nhóm: RTX 4060 Laptop 8 GB) thì model AI chạy CUDA; không có thì chạy CPU, chậm hơn |
| CUDA | không cài CUDA Toolkit riêng: nhóm `vision` cài `onnxruntime-gpu[cuda,cudnn]==1.24.4`, kéo DLL CUDA 12 + cuDNN 9 dạng gói pip. Chỉ cần driver NVIDIA. Mọi thư mục `site-packages/nvidia/*/bin` phải nằm trong `PATH` (backend tự thêm, xem mục "GPU trên Windows") |

Quy ước ổ đĩa: tải về để ở `D:\IOT_Tools\downloads\`, app ở `D:\IOT_Tools\apps\`, toolchain và cache (uv, pip, npm, pnpm,
PlatformIO) ở `D:\DevCache\`. Không để ở ổ C. `scripts/setup-d-drive.ps1` đặt các biến cache này (cache uv nằm ở
`D:\DevCache\cache\uv`).

## Cài đặt

Đường chính là uv, đọc đúng `uv.lock`. Chạy từng bước trong PowerShell:

```powershell
cd D:\Coding\IOT-CV
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-d-drive.ps1 -Apply   # một lần mỗi máy: cache về D:\DevCache (bỏ -Apply là chạy thử)
uv sync --extra dev --extra vision    # backend + test + khối AI
copy .env.example .env                # rồi sửa theo máy (xem mục Môi trường)

cd frontend
pnpm install --frozen-lockfile
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
`uv.lock` (lần chạy gần nhất 26/11/2026, file không đổi so với `uv.lock` hiện tại):

```powershell
uv export --format requirements-txt --no-hashes --no-emit-project --all-extras --locked -o requirements.txt
```

## Môi trường

`backend/config.py` đọc `.env` ở gốc repo (không cần thư viện thêm); biến đã có trong shell luôn thắng giá trị trong file, và
giá trị trong `.env` thắng mặc định của `config.py`. `.env` không được commit; mọi biến kèm giải thích nằm ở
[`.env.example`](.env.example). Các biến hay đổi:

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
| MAVLink | ép `MAVLINK_ENDPOINT=tcp:127.0.0.1:5760` (Mission Planner dùng 5762) | `MAVLINK_ENDPOINT=udpin:0.0.0.0:14550` từ ESP32 DroneBridge |
| Camera | video mẫu (`CAMERA_FAKE` mặc định) | `CAMERA_FAKE=0`, `CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream`, ghi video + tlog |
| Web | http://localhost:5173 | http://localhost:5173 |

`chay-tat-ca.bat` **chỉ dành cho drone ảo**: nó ép endpoint TCP 5760 và tắt backend đang chạy. Trước buổi bay thật: cắm pin
drone trước rồi mới cắm USB, chạy `scripts\laptop\che_do_bay.ps1 -Bat` (máy không ngủ, card Wi-Fi không tự quét), xong buổi chạy
`-Tat`. Mission Planner và backend không nghe chung cổng UDP 14550.

Chạy tay từng phần (drone thật thì đặt ba biến ở cột "Drone thật" trước lệnh backend):

```powershell
uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000   # backend, http://127.0.0.1:8000
cd frontend; pnpm dev                                          # web, http://localhost:5173
docker compose up -d mosquitto                                 # MQTT broker cho phần IoT
uv run python scripts/ws_probe.py --count 20                   # xem 20 message telemetry qua WebSocket
```

Mở web bằng `localhost:5173`, không bằng `127.0.0.1:5173`. Backend cũng tự phục vụ bản build `frontend/dist` ở cổng 8000.
Nghiệm thu trên SITL (trong WSL): `bash scripts/sitl/run-all.sh`, khoảng 17 phút, mỗi runner kết bằng `KET QUA: PASS` hoặc
`KET QUA: FAIL` (xem [`scripts/sitl/README.md`](scripts/sitl/README.md)). Kiểm phần cứng thật, chỉ đọc, không ARM:
`uv run --offline --with pyserial python scripts/fc/kiem_phan_cung.py COM6`.

## AI nhận diện người (vision)

Ba model ONNX đến từ repo XLA theo hợp đồng `docs/hop-dong-model.md` của XLA. Tiền và hậu xử lý (letterbox, NMS) nằm trong
graph; backend chỉ nạp và chạy.

| Bundle | Làm gì | sha256 `.onnx` (đầu) |
|---|---|---|
| `detector-v1.0.1` | YOLO11s tinh chỉnh trên ảnh làm xấu theo camera, input `frame` uint8 [480, 640, 3] BGR, output `boxes` + `scores`. Cùng ONNX với v1.0.0, thêm `recommended_track` (k1/n1) trong `meta.json` | `23b1da69165f…` |
| `verifier-v1.0.0` | tầng 2 sau detector (EfficientNet-B0), chấm lại từng hộp, giữ hộp có điểm ≥ 0,35 (`conf_threshold` của bundle) | `d566343a5487…` |
| `enhancer-v2.0.0` | "Ảnh rõ" trực tiếp: bộ lọc classic xuất ONNX (deblock, khử hồng, bù tối góc, khử mù, unsharp) | `83d96e8b0f62…` |

Số đo ở XLA (`D:\XLA\results\v2\README.md`) trên khung bay thật: mAP50 cả hệ 0,120 (v1) → 0,210 (v2, detector → verifier);
báo nhầm trên khung bay trống 0,881 → 0,289; "Ảnh rõ" classic thắng ảnh gốc 25/25 lượt A/B mù (Wilson [0,867; 1,000]).

`enhancer-offline-v1.0.0` (dựng ảnh ×2 cho trang Lịch sử bay) **không ship**: A/B mù cả khung không phân biệt được nó với
classic (16/25 lượt). `ENHANCER_OFFLINE_ONNX` để rỗng, `POST /api/flights/enhance-offline` trả 503
`enhancer_offline_unavailable`, web tắt nút dựng kèm lý do.

**1. Lấy bundle.** Một bundle là thư mục `<model>-v<semver>/` gồm `<model>.onnx`, `meta.json`, `golden/`. Bản phát hành ở
GitHub Release `models-v2.0.0` của XLA (mỗi bundle một file zip, giải nén vào `D:\IOT_Tools\downloads\`), hoặc có sẵn trong
`D:\XLA\models\release\` nếu máy có repo XLA. Chép vào `models/vision/<bundle>/`:

```powershell
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/detector-v1.0.1
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/verifier-v1.0.0
uv run python scripts/vision/lay_model.py --from D:/XLA/models/release/enhancer-v2.0.0
```

Lệnh kiểm cấu trúc bundle và sha256 khớp `meta.json` rồi mới chép, in `đã chép <nguồn> -> <đích>` và hai dòng
`<MODEL>_ONNX=…`, `<MODEL>_SHA256=…`. Nó không sửa `.env`. Đường dẫn và sha256 của ba bundle trên đã là mặc định trong
`backend/config.py`, nên chép xong là backend nạp được, không cần đặt gì thêm. File `.onnx` bị `.gitignore` chặn
(`/models/vision/`), không vào git. Mã thoát: 0 đã chép, 1 bundle sai, 2 sai cách gọi.

**2. Kiểm bundle** bằng chính bộ nạp của backend và 3 khung golden:

```powershell
uv run python scripts/vision/kiem_bundle.py models/vision/detector-v1.0.1 --json
uv run python scripts/vision/kiem_bundle.py models/vision/verifier-v1.0.0 --json
uv run python scripts/vision/kiem_bundle.py models/vision/enhancer-v2.0.0 --json
uv run python scripts/vision/kiem_bundle.py models/vision/enhancer-v2.0.0 --cpu --json   # ép chạy CPU
```

Dung sai: detector cùng số hộp, mỗi hộp IoU ≥ 0,95 và lệch score ≤ 0,02; verifier lệch điểm từng hộp ≤ 0,02; enhancer sai khác
trung bình ≤ 1,0 và lớn nhất ≤ 8 (thang 0 đến 255). Mã thoát 0 đạt, 1 bị từ chối hoặc golden lệch.

**3. Biến môi trường.** Mặc định đã trỏ vào ba bundle v2; chỉ đặt khi muốn đổi:

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `VISION_ENABLED` | `1` | `0` tắt hẳn khối vision |
| `DETECTOR_ONNX`, `DETECTOR_SHA256` | `models/vision/detector-v1.0.1/detector.onnx`, `23b1da69…` | đường dẫn tương đối gốc repo; sha256 lệch là model không nạp |
| `VERIFIER_ONNX`, `VERIFIER_SHA256` | `models/vision/verifier-v1.0.0/verifier.onnx`, `d566343a…` | `VERIFIER_ONNX=` rỗng: chạy chỉ detector |
| `VERIFIER_CONFIDENCE` | rỗng | rỗng = `conf_threshold` của bundle verifier (0,35) |
| `ENHANCER_ONNX`, `ENHANCER_SHA256` | `models/vision/enhancer-v2.0.0/enhancer.onnx`, `83d96e8b…` | |
| `ENHANCER_DEFAULT_ON` | `1` | "Ảnh rõ" bật sẵn khi người xem chưa chọn (web nhớ lựa chọn trong `localStorage`) |
| `ENHANCER_OFFLINE_ONNX` | rỗng | rỗng = API dựng offline trả 503 |
| `VISION_ORT_PROVIDERS` | `CUDAExecutionProvider,CPUExecutionProvider` | thứ tự ưu tiên provider của ONNX Runtime |
| `VISION_CUDA_OPTIONS` | `prefer_nhwc=1` | tuỳ chọn CUDA EP `khoá=giá trị;…`; `prefer_nhwc=1` nhanh hơn khoảng 17 % |
| `DETECTION_CONFIDENCE` | rỗng | rỗng = `conf_threshold` trong `meta.json` của bundle detector |
| `DETECTION_MIN_FRAMES`, `DETECTION_COOLDOWN_S` | `3`, `4` | chống spam sự kiện phát hiện người |
| `ENHANCED_JPEG_QUALITY` | `85` | chất lượng JPEG của luồng "Ảnh rõ" |

**`.env` cũ ghim bundle v1.** `.env` tạo trước 26/11/2026 thường còn dòng `DETECTOR_ONNX`/`ENHANCER_ONNX` (kèm sha256) trỏ vào
`detector-v1.0.0`/`enhancer-v1.0.0`. Giá trị trong `.env` thắng mặc định, nên backend vẫn chạy enhancer v1. Xoá các dòng đó
(hoặc chép lại khối Vision từ `.env.example`), rồi khởi động lại backend và đọc phiên bản trong `GET /api/status`.

`backend/vision/model_bundle.py` kiểm bốn bước lúc nạp: file tồn tại; sha256 của file = env `*_SHA256` = `meta.onnx_sha256`;
major của `contract_version` đúng hợp đồng; tên, kiểu, shape I/O đúng hợp đồng. Sai bước nào thì model đó không nạp, phát sự
kiện `vision.model_rejected`, còn MAVLink, WebSocket và luồng video gốc chạy bình thường. Trạng thái từng model (`loaded`,
`rejected`, `disabled`, kèm `providers`, `cpu_only` và ms p50/p95 từng bước) nằm trong khối `vision` của `GET /api/status`.

Pipeline (`backend/vision/pipeline.py`): detector rồi verifier chạy trên **khung gốc** mỗi khung, hộp gửi lên WebSocket là hộp
sau verifier; enhancer chạy khi có người xem `/api/video/stream?variant=enhanced`, tức nút **"Ảnh rõ"** trên web (bật sẵn).
Nhận diện không chạy trên ảnh đã làm rõ. Pipeline chạy thread riêng, chậm thì bỏ khung cũ chứ không xếp hàng. Không có enhancer
thì luồng `enhanced` trả 503 `enhancer_unavailable`.

**GPU trên Windows.** ORT-GPU cần DLL CUDA 12 + cuDNN 9 từ các gói pip `nvidia-*`. `preload_dlls()` chưa đủ: mọi thư mục
`site-packages/nvidia/*/bin` phải có trong `PATH`, vì cuDNN 9 nạp thư viện con lúc chạy Conv đầu tiên. Thiếu thì ORT vẫn báo
`CUDAExecutionProvider` rồi lặng lẽ chạy CPU. `model_bundle.py` tự thêm các thư mục đó vào `PATH`, chạy thử một khung đen, rồi
mới đọc `get_providers()`; nếu chỉ còn CPU thì log dòng `CPU-ONLY` và `cpu_only: true`. `onnxruntime-gpu` ghim 1.24.4 vì 1.25
trở lên đòi CUDA 13.

**Đo tốc độ** trên một bản ghi camera thật, ghi `logs/vision-bench/<thời điểm>.json`:

```powershell
uv run python scripts/vision/replay_bench.py --recording logs/recordings/20261102-100941 --json
```

Số ms phụ thuộc GPU có đang hạ xung không: đọc khối `machine` trong file bench trước khi so. Đừng chạy bench khi có job GPU khác
(khoá `D:\DevCache\locks\gpu.lock`).

## Kết quả mong đợi

Test backend (`uv run pytest`, khoảng 25 s, đo 26/11/2026):

```
512 passed, 1 warning in 23.93s
```

Test web (`pnpm test` trong `frontend/`, chạy từ PowerShell):

```
 Test Files  26 passed (26)
      Tests  320 passed (320)
```

`kiem_bundle.py models/vision/detector-v1.0.1 --json` khi đạt (rút gọn):

```json
{"pass": true, "model": "detector", "version": "1.0.1", "onnx_sha256": "23b1da69…",
 "providers": ["CUDAExecutionProvider", "CPUExecutionProvider"],
 "golden": [{"frame": "000.jpg", "n_expected": 1, "n_got": 1, "min_iou": 0.9998, "max_dscore": 0.0002, "pass": true}, "…"]}
```

Golden của cả ba bundle đạt trên CUDA và CPU (`D:\XLA\results\v2\iotcv\kiem_bundle.jsonl`): detector IoU ≥ 0,9998, verifier
lệch điểm ≤ 0,0003, enhancer sai khác lớn nhất ≤ 2.

Dòng log khi backend nạp được model trên GPU:

```
INFO backend.vision.model_bundle: Đã nạp detector 1.0.1, provider ['CUDAExecutionProvider', 'CPUExecutionProvider']
```

Sha256 sai thì model bị từ chối với lý do dạng `sha256 lệch: file 23b1da69165f…, env 00…, meta 23b1da69165f…`.

Trên web: trang Bay hiện "Ảnh rõ" bật sẵn; ô trạng thái model ghi detector v1.0.1, verifier v1.0.0, enhancer v2.0.0 đang chạy
CUDA, ảnh rõ offline tắt kèm lý do.

Tốc độ đo 26/11/2026 (`D:\XLA\results\v2\iotcv\README.md` mục 2): RTX 4060 Laptop, bản ghi `20261102-100941` khung 284 đến 884,
nhịp thật của camera (~7,2 khung/s), có người xem "Ảnh rõ", gộp hai lượt. GPU hạ xung còn 780 đến 802 MHz, 70 đến 72 °C suốt
buổi đo; ở xung đầy đủ detector p95 khoảng 26 ms.

| ms, p95 (p50) | v1 (`detector-v1.0.0` + `enhancer-v1.0.0`) | v2 (ba bundle đang chạy) |
|---|---|---|
| detector | 63,3 (53,2) | 63,4 (57,4) |
| verifier | không có | 8,9 (0,03) |
| enhancer | 34,4 (29,7) | 19,3 (15,4) |
| tổng | 99,1 (84,5) | 89,5 (76,3) |
| khung bỏ (2 lượt) | 7,8 % · 8,2 % | 4,2 % · 4,7 % |
| lỗi pipeline | 0 | 0 |

## Test

```powershell
uv run pytest                          # backend, backend/tests (CI chạy với --extra dev)
uv run pytest --collect-only           # chỉ liệt kê test
uv run ruff check .                    # lint Python
cd frontend; pnpm test; pnpm lint; pnpm build   # web; PowerShell
```

Test AI (`backend/tests/test_vision_ai.py`, `backend/tests/test_vision_v2.py`) tự dựng bundle ONNX giả bằng `onnx.helper`, không
cần model thật hay GPU. Kiểm với model thật là `kiem_bundle.py` ở trên. Nghiệm thu điều khiển, telemetry, mission trên drone ảo:
`bash scripts/sitl/run-all.sh` trong WSL.

## Gỡ lỗi

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| Web vẫn ghi enhancer v1.0.0 | `.env` còn ghim `DETECTOR_ONNX`/`ENHANCER_ONNX` cũ. Xoá các dòng đó, khởi động lại backend |
| Model báo CUDA nhưng chậm, `cpu_only: true` | thiếu DLL cuDNN trong `PATH`. Dùng `uv sync --extra vision` (gói `nvidia-*`), đừng cài `onnxruntime-gpu` tay; đọc provider sau một lần chạy thử |
| Model không nạp, sự kiện `vision.model_rejected` | sha256 lệch (thường do `.env` ghim sha của bundle khác) hoặc chưa chép bundle. Chạy lại `lay_model.py`, rồi `kiem_bundle.py` |
| Nút dựng ảnh offline tắt, API trả 503 | đúng thiết kế: bundle offline không ship |
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
  vision/    nạp bundle ONNX của XLA (model_bundle.py), detector, verifier, enhancer, pipeline, camera, ghi video
  flights/   trang Lịch sử bay: ghép log FC + tlog + video theo giờ GPS
frontend/    Vite + React + TypeScript; build ra frontend/dist, FastAPI phục vụ
firmware/    ArduPilot custom build + param, firmware camera ESP32-S3, DroneBridge, ESC OX32
models/      models/vision/<bundle>/ chép từ XLA (đã gitignore)
ml/          phần còn lại của luồng AI cũ, không dùng: phần AI nay ở repo XLA (ml/README.md)
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
| DroneBridge, camera ESP32-S3, ESC | [`firmware/dronebridge/README.md`](firmware/dronebridge/README.md), [`firmware/camera/README.md`](firmware/camera/README.md), [`firmware/esc-ox32/README.md`](firmware/esc-ox32/README.md) |
| SITL tự động | [`scripts/sitl/README.md`](scripts/sitl/README.md) |
| Kiểm phần cứng thật 15/11/2026 | [`plans/reports/261115-kiem-phan-cung-that.md`](plans/reports/261115-kiem-phan-cung-that.md) |
| AI cũ, trỏ sang XLA | [`ml/README.md`](ml/README.md) |
| Deploy web lên AWS | [`infra/README.md`](infra/README.md) |
| Phần AI (thiết kế, thí nghiệm, dữ liệu) | repo XLA (GitHub Localhost218/XLA, trên máy nhóm ở `D:\XLA`): `BAO_CAO_DO_AN.md`, plan `plans/261125-ai-v2/plan.md` |
| Hợp đồng model ONNX | XLA `docs/hop-dong-model.md` |
| Kết quả AI v2 cả hệ, tích hợp IOT-CV | XLA `results/v2/README.md`, `results/v2/iotcv/README.md`, A/B mù `results/ab-v2/decision.json` |

Kế hoạch 92 giai đoạn cũ đã chuyển sang [`docs/archive/plan-nhap-92-giai-doan.md`](docs/archive/plan-nhap-92-giai-doan.md),
giữ làm tham khảo, không phải kế hoạch đang bám theo.
