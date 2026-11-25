"""Cấu hình tập trung của backend.

Mọi giá trị đều override được qua biến môi trường hoặc file `.env`
(xem `.env.example`). Không hardcode endpoint hoặc giới hạn an toàn ở nơi khác —
GIAI ĐOẠN 59 đổi từ SITL sang drone thật chỉ bằng cách đổi `MAVLINK_ENDPOINT`.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path | None = None) -> None:
    """Nạp `.env` vào os.environ, không cần thêm dependency.

    Biến môi trường có sẵn trong shell luôn thắng giá trị trong file.
    """
    env_path = path or PROJECT_ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv()


def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ[key])
    except (KeyError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ[key])
    except (KeyError, ValueError):
        return default


def _env_bool(key: str, default: bool) -> bool:
    """Đọc cờ bật/tắt. Không phân biệt hoa thường; giá trị lạ thì lấy mặc định.

    Cố ý KHÔNG coi mọi chuỗi khác rỗng là True: `VISION_ENABLED=off` phải tắt
    được vision, chứ không phải bật nó lên vì chuỗi "off" khác rỗng.
    """
    raw = os.environ.get(key)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in ("1", "true", "yes", "on"):
        return True
    if value in ("0", "false", "no", "off"):
        return False
    return default


# ---------------------------------------------------------------------------
# MAVLink (GIAI ĐOẠN 5)
# ---------------------------------------------------------------------------
# SITL:               udp:127.0.0.1:14550
# ESP32 bridge:       udp:0.0.0.0:14550
# USB trực tiếp:      /dev/ttyACM0
MAVLINK_ENDPOINT = _env_str("MAVLINK_ENDPOINT", "udp:127.0.0.1:14550")
MAVLINK_BAUD = _env_int("MAVLINK_BAUD", 115200)
HEARTBEAT_TIMEOUT_S = _env_float("HEARTBEAT_TIMEOUT_S", 10.0)
# Không nhận heartbeat trong khoảng này thì coi như mất link.
LINK_TIMEOUT_S = _env_float("LINK_TIMEOUT_S", 3.0)

# "Số nhà" của backend trên mạng MAVLink (Phase 05, việc 5.1.1).
# Mặc định của pymavlink là 255 — đúng quy ước GCS, nhưng Mission Planner CŨNG
# dùng 255. Chạy song song hai GCS mà trùng số thì COMMAND_ACK của flight
# controller không phân biệt được ai hỏi. Nhường 255 cho Mission Planner.
MAVLINK_SOURCE_SYSTEM = _env_int("MAVLINK_SOURCE_SYSTEM", 254)
MAVLINK_SOURCE_COMPONENT = _env_int("MAVLINK_SOURCE_COMPONENT", 190)  # MISSIONPLANNER

# Nghe UDP (`udpin:`) thì backend tự CHÀO bo DroneBridge trong lúc chờ heartbeat của FC: gửi
# HEARTBEAT kiểu GCS mỗi MAVLINK_UDP_HELLO_PERIOD_S giây. Bo chỉ đẩy gói cho các client UDP nó
# đang giữ. 02/11/2026, sau một lần hotspot đổi kênh, `udp_clients` của bo rỗng: bo vẫn đọc FC
# nhưng không gửi gì về laptop, backend chờ mãi tới khi rút cắm pin drone. Một gói gửi tới là
# bo thêm lại client ngay (đo: 0,27 s). Sysid ở trên là 254, không phải `MAV_GCS_SYSID` 255,
# nên heartbeat này không bật được failsafe GCS của FC. Để trống thì tắt; tcp/USB bỏ qua.
MAVLINK_UDP_HELLO = _env_str("MAVLINK_UDP_HELLO", "DroneBridgeESP32.mshome.net:14550")
MAVLINK_UDP_HELLO_PERIOD_S = _env_float("MAVLINK_UDP_HELLO_PERIOD_S", 2.0)

# ---------------------------------------------------------------------------
# Web backend (GIAI ĐOẠN 7)
# ---------------------------------------------------------------------------
BACKEND_HOST = _env_str("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = _env_int("BACKEND_PORT", 8000)
# 5-10 Hz là đủ cho UI. Không cần 50 Hz.
TELEMETRY_HZ = _env_float("TELEMETRY_HZ", 8.0)
# Backend giữ lại chừng này giây gói telemetry đã gửi (`GET /api/telemetry/history`)
# để biểu đồ của web có dữ liệu ngay khi mở trang. 900 s × 8 Hz = 7200 gói, vài MB.
TELEMETRY_HISTORY_S = _env_float("TELEMETRY_HISTORY_S", 900.0)

# ---------------------------------------------------------------------------
# Giới hạn an toàn PHẦN MỀM (GIAI ĐOẠN 14)
# Đây là giới hạn của project, không phải giới hạn kỹ thuật của ArduPilot.
# Lớp authoritative vẫn là geofence trên flight controller (GIAI ĐOẠN 83).
# ---------------------------------------------------------------------------
MAX_ALT = _env_float("MAX_ALT", 10.0)
MIN_ALT = _env_float("MIN_ALT", 2.0)
MAX_DISTANCE_HOME = _env_float("MAX_DISTANCE_HOME", 50.0)
MAX_WAYPOINTS = _env_int("MAX_WAYPOINTS", 10)

# Manual control qua web (GIAI ĐOẠN 10, 11, 64)
MAX_VELOCITY = _env_float("MAX_VELOCITY", 1.0)
# Tốc độ xoay tối đa, ĐỘ/GIÂY. Có khoá riêng vì `MAX_VELOCITY` tính bằng m/s —
# dùng chung một hằng số cho hai đơn vị là kẹp yaw xuống 1 độ/giây, tức là
# xoay nửa vòng mất ba phút. Lỗi lẫn đơn vị kiểu này không báo gì cả.
MAX_YAW_RATE = _env_float("MAX_YAW_RATE", 45.0)
MANUAL_COMMAND_TIMEOUT_MS = _env_int("MANUAL_COMMAND_TIMEOUT_MS", 300)
# Vòng dead-man của Phase 06 quét mỗi chừng này ms. Phải NHỎ HƠN HẲN
# MANUAL_COMMAND_TIMEOUT_MS, nếu không timeout 300 ms sẽ thành 300+tick ms.
DEADMAN_TICK_MS = _env_int("DEADMAN_TICK_MS", 50)
# Một lần dead-man nổ thì gửi (0,0,0) bao nhiêu nhịp liên tiếp. MAVLink chạy
# trên UDP: một gói rơi là lệnh dừng biến mất không dấu vết. Lặp 5 nhịp ở 20 Hz
# = 250 ms, rẻ hơn nhiều so với cái giá của việc drone không dừng.
ZERO_VELOCITY_REPEAT = _env_int("ZERO_VELOCITY_REPEAT", 5)
# Chờ COMMAND_ACK của flight controller tối đa bao lâu (mode / arm / takeoff).
COMMAND_ACK_TIMEOUT_S = _env_float("COMMAND_ACK_TIMEOUT_S", 3.0)
# Sổ kiểm cho mọi lần gửi zero-velocity. Đây là HỢP ĐỒNG với Phase 10 §10.7:
# test Playwright đọc chính file này để đo độ trễ dead-man.
#
# Đường dẫn TƯƠNG ĐỐI được neo vào gốc repo, không vào CWD. Neo vào CWD thì
# chạy backend từ thư mục khác là bằng chứng an toàn rơi sang chỗ khác — im
# lặng, và chỉ phát hiện ra khi cần dựng lại một sự việc.
DEADMAN_LOG_PATH = str(
    (PROJECT_ROOT / _env_str("DEADMAN_LOG_PATH", "logs/deadman.jsonl")).resolve()
)

# Tránh vật cản (Phase 07). Khai báo ngay từ Phase 05 vì hợp đồng WebSocket
# nói UI đọc MỌI ngưỡng từ `limits` — Phase 08 dựng UI trước khi Phase 07 xong.
AVOID_MARGIN_M = _env_float("AVOID_MARGIN_M", 2.0)
AVOID_DIST_MAX_M = _env_float("AVOID_DIST_MAX_M", 5.0)
RANGEFINDER_MAX_M = _env_float("RANGEFINDER_MAX_M", 6.0)
# Số đo khoảng cách cũ hơn chừng này thì `avoid_state` = UNKNOWN (đang mù),
# KHÁC với OFF (trống trải). Không có khoá tương ứng trong param của FC.
PROXIMITY_STALE_S = _env_float("PROXIMITY_STALE_S", 2.0)

# Mission protocol (Phase 07 §7.3). Chờ mỗi MISSION_REQUEST tối đa bao lâu, và
# gửi lại MISSION_COUNT bao nhiêu lần trước khi bỏ cuộc. Tính cho Wi-Fi của drone
# thật (01/11/2026): link rớt 5–7 s, cứ ~15 s một lần, nên phải kiên nhẫn quá một
# chu kỳ (3 s × 8 lần ≈ 24 s). FC tự hỏi lại mỗi ~1 s và huỷ phiên sau 8 s im lặng.
# Mức cũ 2 s × 3 lần bỏ cuộc trước khi sóng về.
MISSION_ITEM_TIMEOUT_S = _env_float("MISSION_ITEM_TIMEOUT_S", 3.0)
MISSION_RETRIES = _env_int("MISSION_RETRIES", 8)
# Readback: sai số cho phép khi so mission đọc lại với mission vừa gửi.
MISSION_READBACK_ALT_TOL_M = _env_float("MISSION_READBACK_ALT_TOL_M", 0.1)
# Pin dưới ngưỡng này thì phát cảnh báo (Phase 07 §7.7) — CHỈ cảnh báo, không
# tự RTL. Failsafe pin thật nằm trên FC.
BATTERY_WARN_PCT = _env_int("BATTERY_WARN_PCT", 25)

# ---------------------------------------------------------------------------
# Vision (GIAI ĐOẠN 19, 74, 75)
# ---------------------------------------------------------------------------
CAMERA_STREAM_URL = _env_str("CAMERA_STREAM_URL", "http://192.168.4.1:81/stream")
VISION_ENABLED = _env_bool("VISION_ENABLED", True)  # tắt hẳn vision khi test bay

# Model AI từ repo XLA (D:\XLA, docs/hop-dong-model.md §5). Bundle chép bằng
# `scripts/vision/lay_model.py --from <bundle XLA>` vào models/vision/ (file .onnx đã gitignore).
# sha256 lệch (hoặc env đặt rỗng) là model KHÔNG nạp, backend bay vẫn chạy (SAFETY.md mục 9).
# Mặc định = bundle v2 (plan XLA 261125-ai-v2 phase 15, 26/11/2026): detector-v1.0.1 (cùng ONNX
# với v1.0.0, thêm `recommended_track`), verifier-v1.0.0, enhancer-v2.0.0 (classic ONNX).
# Về bundle v1: đặt DETECTOR_ONNX/ENHANCER_ONNX (+ sha) trong .env, VERIFIER_ONNX= rỗng.
DETECTOR_ONNX = str(
    (
        PROJECT_ROOT / _env_str("DETECTOR_ONNX", "models/vision/detector-v1.0.1/detector.onnx")
    ).resolve()
)
DETECTOR_SHA256 = (
    _env_str("DETECTOR_SHA256", "23b1da69165ffe05760bda23b4a41c858930e8a8fd8b0aebc039f1e0c5c59aef")
    .strip()
    .lower()
)
ENHANCER_ONNX = str(
    (
        PROJECT_ROOT / _env_str("ENHANCER_ONNX", "models/vision/enhancer-v2.0.0/enhancer.onnx")
    ).resolve()
)
ENHANCER_SHA256 = (
    _env_str("ENHANCER_SHA256", "83d96e8b0f628d0e6cc271ed9550220962de897cac2d57ed306a1db51cb5477b")
    .strip()
    .lower()
)
VISION_ORT_PROVIDERS = tuple(
    p.strip()
    for p in _env_str("VISION_ORT_PROVIDERS", "CUDAExecutionProvider,CPUExecutionProvider").split(
        ","
    )
    if p.strip()
)
# Tuỳ chọn CUDA EP dạng "khoá=giá trị;…". prefer_nhwc=1: conv theo NHWC, detector nhanh hơn ~17 %
# trên RTX 4060 Laptop (28,6 so với 34,3 ms p50, 19/11/2026), golden vẫn đạt. Rỗng = mặc định ORT.
VISION_CUDA_OPTIONS = dict(
    kv.split("=", 1)
    for kv in _env_str("VISION_CUDA_OPTIONS", "prefer_nhwc=1").split(";")
    if "=" in kv
)
# Ngưỡng hộp: rỗng = dùng `conf_threshold` trong meta.json của bundle (chọn trên tập dev ở XLA).
_conf_raw = _env_str("DETECTION_CONFIDENCE", "").strip()
DETECTION_CONFIDENCE: float | None = float(_conf_raw) if _conf_raw else None
DETECTION_MIN_FRAMES = _env_int("DETECTION_MIN_FRAMES", 3)
DETECTION_COOLDOWN_S = _env_float("DETECTION_COOLDOWN_S", 4.0)
# Chất lượng JPEG (thang OpenCV 0–100) của luồng `variant=enhanced` nén lại sau enhancer.
ENHANCED_JPEG_QUALITY = _env_int("ENHANCED_JPEG_QUALITY", 85)


def _env_optional(key: str, cast: type[int] | type[float]) -> int | float | None:
    """Env tuỳ chọn: chưa đặt hoặc rỗng = None (dùng giá trị của bundle); đặt sai kiểu thì lỗi
    ngay lúc khởi động, không lặng lẽ bỏ qua (như `DETECTION_CONFIDENCE`)."""
    raw = _env_str(key, "").strip()
    if not raw:
        return None
    try:
        return cast(raw)
    except ValueError:
        raise ValueError(f"{key}={raw!r} không phải {cast.__name__}") from None


def _bundle_path(key: str, default: str) -> str:
    """Đường dẫn bundle tương đối `PROJECT_ROOT`; rỗng = tắt model đó (trả chuỗi rỗng)."""
    raw = _env_str(key, default).strip()
    return str((PROJECT_ROOT / raw).resolve()) if raw else ""


# Hợp đồng XLA v1.1 (`D:/XLA/docs/hop-dong-model.md` §9–§13, plan XLA 261125-ai-v2, 25/11/2026).
# §9 verifier (tầng 2, sau detector). VERIFIER_ONNX rỗng = tắt: chạy chỉ detector.
VERIFIER_ONNX = _bundle_path("VERIFIER_ONNX", "models/vision/verifier-v1.0.0/verifier.onnx")
VERIFIER_SHA256 = (
    _env_str("VERIFIER_SHA256", "d566343a5487775b9f6334d9df0bb0a1d9c9b2d2b76e2b8bfa4738facc012d58")
    .strip()
    .lower()
)
# Ngưỡng giữ hộp sau verifier: rỗng = `conf_threshold` trong meta.json của bundle verifier.
VERIFIER_CONFIDENCE: float | None = _env_optional("VERIFIER_CONFIDENCE", float)
# §10 lọc track k/n (backend/vision/track_filter.py). Rỗng = `recommended_track` của detector;
# không có cả hai thì k = n = DETECTION_MIN_FRAMES, cooldown toàn cục như trước 25/11.
DETECTION_TRACK_K: int | None = _env_optional("DETECTION_TRACK_K", int)
DETECTION_TRACK_N: int | None = _env_optional("DETECTION_TRACK_N", int)
DETECTION_TRACK_IOU: float | None = _env_optional("DETECTION_TRACK_IOU", float)
DETECTION_TRACK_MAX_GAP: int | None = _env_optional("DETECTION_TRACK_MAX_GAP", int)
# §11 enhancer-offline (×2, chỉ job offline của trang Lịch sử bay, không chạy trực tiếp).
# ENHANCER_OFFLINE_ONNX rỗng = tắt: API offline trả 503 (§13). Mặc định rỗng:
# enhancer-offline-v1.0.0 không ship (A/B mù 26/11: offline thắng classic 16/25, cận dưới
# Wilson 0,45 < 0,5; D:/XLA/results/ab-v2/decision.json).
ENHANCER_OFFLINE_ONNX = _bundle_path("ENHANCER_OFFLINE_ONNX", "")
ENHANCER_OFFLINE_SHA256 = _env_str("ENHANCER_OFFLINE_SHA256", "").strip().lower()
# §13 job offline: cache ảnh ×2 theo chuyến (logs/.cache/ đã gitignore), JPEG thang OpenCV 0–100.
FLIGHT_AI_CACHE_DIR = str(
    (PROJECT_ROOT / _env_str("FLIGHT_AI_CACHE_DIR", "logs/.cache/flights-ai")).resolve()
)
FLIGHT_AI_JPEG_QUALITY = _env_int("FLIGHT_AI_JPEG_QUALITY", 92)
# Mất liên kết FC chưa quá chừng này giây thì không chạy job (có thể đang bay, §13).
FLIGHT_AI_LINK_GRACE_S = _env_float("FLIGHT_AI_LINK_GRACE_S", 300.0)
# Ổ còn trống dưới chừng này MB thì job dừng, API trả 507 (§13).
FLIGHT_AI_MIN_FREE_MB = _env_float("FLIGHT_AI_MIN_FREE_MB", 3000.0)
# Web: "Ảnh rõ" bật sẵn khi người xem chưa chọn (localStorage `iot-cv.video-enhanced` trống, §13).
# Mặc định BẬT từ enhancer-v2.0.0 classic (quyết định chủ dự án; A/B mù v2 classic thắng gốc 25/25).
ENHANCER_DEFAULT_ON = _env_bool("ENHANCER_DEFAULT_ON", True)

# Nguồn video GIẢ (Phase 07 §7.8.3) — camera thật chỉ có từ Phase 17. Bật thì
# backend tự phục vụ một luồng MJPEG lặp video mẫu ở `/api/video/fake-source`
# và `stream.py` đọc từ ĐÓ, như đọc từ bất kỳ URL nào khác. Tắt (0) thì đọc
# `CAMERA_STREAM_URL` (camera ESP32-S3 + OV3660 thật).
CAMERA_FAKE = _env_bool("CAMERA_FAKE", True)
CAMERA_FAKE_CLIP = str(
    (PROJECT_ROOT / _env_str("CAMERA_FAKE_CLIP", "backend/vision/assets/sample-clip.mp4")).resolve()
)
CAMERA_FAKE_FPS = _env_float("CAMERA_FAKE_FPS", 15.0)
# Cỡ khung của nguồn giả, theo tên của esp32-camera (QVGA 320x240, VGA 640x480,
# SVGA 800x600). Mặc định VGA: QVGA hiển thị đúng 320 pixel CSS trên màn 2560 px
# thì bé và vỡ (người dùng thấy thật 25/09/2026). QVGA vẫn là mốc THIẾT KẾ cho
# ESP32 (44 fps so với 14 fps ở VGA) — đặt QVGA để thử đúng cỡ đó.
CAMERA_FAKE_FRAMESIZE = _env_str("CAMERA_FAKE_FRAMESIZE", "VGA").upper()
# Chất lượng JPEG theo thang esp32-camera 0–63, SỐ NHỎ = NÉT HƠN. 12 = mức camera thật tự
# đặt lúc khởi động: khung giả nén bằng ĐÚNG bảng DQT + 4:2:2 đo từ camera (19/11/2026).
CAMERA_FAKE_JPEG_QUALITY = _env_int("CAMERA_FAKE_JPEG_QUALITY", 12)
# Box giả gửi mỗi chừng này ms (§7.8.3: 300 ms).
FAKE_DETECTION_INTERVAL_MS = _env_int("FAKE_DETECTION_INTERVAL_MS", 300)
# Khung mới nhất cũ hơn chừng này thì camera coi như MẤT (`camera.available`).
CAMERA_STALE_S = _env_float("CAMERA_STALE_S", 2.0)

# Camera thật tự hạ chất lượng JPEG khi khung/s tụt vì xa (15/11/2026,
# backend/vision/auto_quality.py, cách chạy ghi ở đầu file đó). 0 = tắt, camera giữ mức đang có.
# Không chạy với nguồn giả (CAMERA_FAKE=1). Thang esp32-camera 0–63, SỐ LỚN = khung NHỎ, kém nét.
CAMERA_AUTO_QUALITY = _env_bool("CAMERA_AUTO_QUALITY", True)
# Cổng HTTP điều khiển của firmware camera (`/set`, `/status`), cùng máy với CAMERA_STREAM_URL.
CAMERA_CONTROL_PORT = _env_int("CAMERA_CONTROL_PORT", 80)
# 12 = mức firmware tự đặt lúc khởi động (JPEG_QUALITY_DEFAULT): gần nhà luôn quay về đây.
CAMERA_QUALITY_BEST = _env_int("CAMERA_QUALITY_BEST", 12)
CAMERA_QUALITY_WORST = _env_int("CAMERA_QUALITY_WORST", 40)
CAMERA_QUALITY_STEP = _env_int("CAMERA_QUALITY_STEP", 7)
# Ngưỡng khung/s. Trong 15 m camera đạt 7,6–7,8 (02/11/2026), nên HIGH phải dưới mức đó,
# không thì gần nhà cũng không bao giờ nâng nét lại được.
CAMERA_AUTO_FPS_LOW = _env_float("CAMERA_AUTO_FPS_LOW", 4.0)
CAMERA_AUTO_FPS_HIGH = _env_float("CAMERA_AUTO_FPS_HIGH", 6.5)
# Cửa sổ đo 5 s: luồng thật thỉnh thoảng đứng 1 s (đo 15/11: 4, 5, 0, 9, 8 khung/s) — cửa sổ 3 s
# coi đó là tụt (3 khung/s) và hạ nét oan; 5 s ra 5,2. Xa thật (≤ 3,1 khung/s) vẫn bắt được.
CAMERA_AUTO_WINDOW_S = _env_float("CAMERA_AUTO_WINDOW_S", 5.0)
CAMERA_AUTO_RECOVER_S = _env_float("CAMERA_AUTO_RECOVER_S", 10.0)
CAMERA_AUTO_RECOVER_MAX_S = _env_float("CAMERA_AUTO_RECOVER_MAX_S", 120.0)

# Ghi video camera về laptop (01/11/2026) — người dùng không có thẻ nhớ cho bo camera,
# nên laptop là nơi duy nhất giữ hình (backend/vision/video_recorder.py). Mặc định chỉ
# tự ghi với camera THẬT; nguồn giả của SITL không ghi cho khỏi đầy đĩa (bật tay được).
RECORD_VIDEO = _env_bool("RECORD_VIDEO", not CAMERA_FAKE)
# Đường dẫn tương đối neo vào gốc repo (như DEADMAN_LOG_PATH). logs/ đã gitignore.
RECORD_DIR = str((PROJECT_ROOT / _env_str("RECORD_DIR", "logs/recordings")).resolve())
# Mỗi đoạn video tối đa chừng này giây: laptop tắt ngang thì chỉ mất đoạn cuối.
RECORD_SEGMENT_S = _env_float("RECORD_SEGMENT_S", 300.0)
# Không có khung mới lâu hơn chừng này thì đóng đoạn đang ghi, có hình lại mở đoạn mới.
# Quãng mất ngắn hơn được lấp bằng khung cuối (video giữ đúng giờ). 30 s: camera rớt Wi-Fi
# vài giây một lần ngoài bãi; ngưỡng cũ 2 s cắt một buổi 33 phút thành 223 file (01/11/2026).
RECORD_GAP_S = _env_float("RECORD_GAP_S", 30.0)
# Ổ còn trống dưới chừng này GB thì dừng ghi (repo nằm ở ổ D).
RECORD_MIN_FREE_GB = _env_float("RECORD_MIN_FREE_GB", 2.0)

# Telemetry MAVLink: ghi MỌI gói nhận được ra file .tlog (Mission Planner, MAVExplorer
# mở được) — mỗi lần nối link một file. Đây là bản sao phía laptop; log dataflash trên
# FC (scripts/fc/tai_log.py) vẫn là bản đầy đủ nhất.
TLOG_ENABLE = _env_bool("TLOG_ENABLE", True)
TLOG_DIR = str((PROJECT_ROOT / _env_str("TLOG_DIR", "logs/tlog")).resolve())

# Trang Lịch sử bay (backend/flights/, 15/11/2026): đọc log dataflash tải từ FC ở
# FLIGHT_LOGS_DIR/fc-dataflash-*/*.bin, cùng TLOG_DIR và RECORD_DIR ở trên. Kết quả đọc
# từng file lưu đệm JSON ở FLIGHT_CACHE_DIR (xoá thư mục đó là đọc lại từ đầu).
FLIGHT_LOGS_DIR = str((PROJECT_ROOT / _env_str("FLIGHT_LOGS_DIR", "logs")).resolve())
FLIGHT_CACHE_DIR = str(
    (PROJECT_ROOT / _env_str("FLIGHT_CACHE_DIR", "logs/.cache/flights")).resolve()
)


def camera_source_url() -> str:
    """URL mà `stream.py` đọc. `stream.py` không biết nguồn là giả hay thật —
    chỗ DUY NHẤT phân biệt là ở đây."""
    if CAMERA_FAKE:
        return f"http://127.0.0.1:{BACKEND_PORT}/api/video/fake-source"
    return CAMERA_STREAM_URL


def camera_control_url() -> str | None:
    """Gốc HTTP điều khiển camera thật (`<gốc>/set?quality=N`), cùng máy với CAMERA_STREAM_URL
    nhưng ở CAMERA_CONTROL_PORT. None với nguồn giả hoặc URL không có tên máy."""
    if CAMERA_FAKE:
        return None
    parts = urlsplit(CAMERA_STREAM_URL)
    if not parts.hostname:
        return None
    return f"{parts.scheme or 'http'}://{parts.hostname}:{CAMERA_CONTROL_PORT}"


# ---------------------------------------------------------------------------
# MQTT (GIAI ĐOẠN 76)
# ---------------------------------------------------------------------------
MQTT_BROKER = _env_str("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = _env_int("MQTT_PORT", 1883)
MQTT_CLIENT_ID = _env_str("MQTT_CLIENT_ID", "uav-gcs")


def safety_limits() -> dict[str, float | int]:
    """Giới hạn phần mềm, để frontend hiển thị và để mission validation dùng.

    Đây là `limits` trong hợp đồng WebSocket. UI đọc MỌI ngưỡng từ đây —
    Phase 08/09/10 không được hardcode con số nào.
    """
    return {
        "max_alt": MAX_ALT,
        "min_alt": MIN_ALT,
        "max_distance_home": MAX_DISTANCE_HOME,
        "max_waypoints": MAX_WAYPOINTS,
        "max_velocity": MAX_VELOCITY,
        "manual_command_timeout_ms": MANUAL_COMMAND_TIMEOUT_MS,
        "deadman_tick_ms": DEADMAN_TICK_MS,
        "avoid_margin_m": AVOID_MARGIN_M,
        "avoid_dist_max_m": AVOID_DIST_MAX_M,
        "rangefinder_max_m": RANGEFINDER_MAX_M,
        "proximity_stale_s": PROXIMITY_STALE_S,
    }
