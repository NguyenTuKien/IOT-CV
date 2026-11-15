"""Hợp đồng WebSocket — NGUỒN SỰ THẬT DUY NHẤT của giao tiếp backend ↔ web.

Văn bản hợp đồng nằm ở `plans/phase-05-backend-mavlink-telemetry.md`, mục
"Hợp đồng WebSocket". File này là hiện thực của văn bản đó bằng pydantic v2.

Đổi hợp đồng thì sửa theo ĐÚNG thứ tự này, trong CÙNG một commit:

    1. mục "Hợp đồng WebSocket" trong plan
    2. file này
    3. `backend/ws-contract.schema.json`  (sinh lại, xem `contract_json_schema`)
    4. `frontend/src/lib/protocol.ts`     (Phase 08 sinh từ file JSON Schema)

Phase 06, 07, 08, 09, 10 IMPORT từ đây. Không phase nào được định nghĩa lại
hình dạng của một message đã có ở đây.

Vì sao pydantic chứ không phải dataclass: pydantic xuất được JSON Schema, nên
Phase 08 sinh type TypeScript từ máy thay vì gõ tay — bớt hẳn một lớp sai lệch
giữa hai bên.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from pydantic.json_schema import models_json_schema

# Phiên bản hợp đồng. Client gửi `v` khác số này sẽ nhận error
# `unsupported_version`.
CONTRACT_VERSION = 1


# ---------------------------------------------------------------------------
# Phong bì chung
# ---------------------------------------------------------------------------
class Envelope(BaseModel):
    """Lớp bọc chung cho MỌI message, cả hai chiều.

    `data` để kiểu dict chứ không phải union phân biệt theo `type`. Cố ý:
    union sẽ gộp "type không tồn tại" và "data sai kiểu" thành cùng một lỗi
    validation, trong khi hợp đồng đòi hai mã lỗi KHÁC nhau (`unknown_type` vs
    `bad_payload`). Nên việc kiểm `data` được tách thành bước hai, tra bảng
    `UPLINK_MODELS` — xem `backend/ws.py`.
    """

    # KHÔNG đặt giá trị mặc định cho `v`. Đây là trường duy nhất có nhiệm vụ
    # CHẶN LẠI, nên nó phải fail-closed: có mặc định thì client bỏ hẳn `v` đi
    # vẫn lọt qua như thể nó là v1 — đúng thứ trường này sinh ra để ngăn.
    v: int
    type: str
    ts: float | None = None
    # Chỉ chiều LÊN mới có `id`; server echo lại ở `ack.ref` / `error.ref`.
    id: str | None = None
    # `None` được chấp nhận và quy về `{}` — JSON.stringify của trình duyệt hay
    # gửi `"data": null`. Hợp đồng nói `data` KHÔNG BAO GIỜ null, nên ta chuẩn
    # hoá tại cửa thay vì bắt mọi handler tự đoán.
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("data", mode="before")
    @classmethod
    def _null_thanh_rong(cls, value: Any) -> Any:
        return {} if value is None else value


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------
class TelemetryFields(BaseModel):
    """Các trường telemetry dùng chung cho cả bản LƯU và bản GỬI ĐI.

    Khai báo một lần ở đây rồi cho hai lớp dưới kế thừa, để không có hai danh
    sách trường phải giữ khớp tay.

    Các trường của Phase 07 (obstacle_*, rangefinder_healthy, avoid_state) CÓ
    MẶT ngay từ Phase 05 với giá trị rỗng, để Phase 08 dựng được UI trước khi
    Phase 07 xong.
    """

    mode: str = "UNKNOWN"
    armed: bool = False

    lat: float | None = None
    lon: float | None = None
    relative_alt: float | None = None  # m, so với home
    absolute_alt: float | None = None  # m, AMSL
    heading: int | None = None  # độ, 0-359
    ground_speed: float | None = None  # m/s
    climb_rate: float | None = None  # m/s, dương là lên

    roll: float | None = None  # độ
    pitch: float | None = None  # độ
    yaw: float | None = None  # độ, chuẩn hoá 0-359

    # 0 no-gps · 1 no-fix · 2 2D · 3 3D · 4 DGPS · 5 RTK-float · 6 RTK-fixed
    gps_fix_type: int | None = None
    satellites: int | None = None

    battery_voltage: float | None = None  # V
    battery_current: float | None = None  # A, None khi FC báo -1
    battery_remaining: int | None = None  # %

    home_lat: float | None = None
    home_lon: float | None = None

    # -- Phase 07 (proximity) ------------------------------------------------
    obstacle_distance: float | None = None  # m, hướng trước
    obstacle_sectors: list[float | None] = Field(
        default_factory=lambda: [None] * 8,
        description="8 cung 45°, index 0 = mũi, theo chiều kim đồng hồ",
    )
    rangefinder_healthy: bool = False
    avoid_state: Literal["OFF", "NEAR", "ACTIVE", "UNKNOWN"] = "UNKNOWN"

    # None = CHƯA BIẾT, không phải "không ổn". Xem chú thích trong telemetry.py.
    ekf_ok: bool | None = None


class TelemetryState(TelemetryFields):
    """Bản LƯU — thread telemetry ghi vào đây, không bao giờ gửi thẳng ra dây.

    Khác bản gửi đi ở hai chỗ, cả hai đều là cố ý:

    - có `last_update` (thời điểm monotonic của message cuối) — dùng để tính
      `link_age_ms` lúc serialize, KHÔNG lưu sẵn giá trị dẫn xuất đó;
    - `connected` ở đây nghĩa là "đã từng nhận heartbeat", còn `connected` trên
      dây nghĩa là "link CÒN SỐNG". Hai nghĩa khác nhau, tính lại lúc gửi.
    """

    connected: bool = False
    last_update: float | None = None
    # Phase 07 — số liệu THÔ của proximity. `avoid_state` và việc che số đo cũ
    # được tính lúc serialize (build_telemetry), không lưu sẵn: chúng phụ thuộc
    # ĐỒNG HỒ, lưu là chắc chắn thành số cũ. Hai trường này không lên dây.
    proximity_updated: float | None = None  # monotonic của DISTANCE_SENSOR cuối
    proximity_clear: bool = False  # số đo cuối ở đầu trên tầm = trống trải

    def as_dict(self) -> dict[str, Any]:
        """Giữ tên cũ để code và test có sẵn không phải đổi."""
        return self.model_dump()


class Telemetry(TelemetryFields):
    """Bản GỬI ĐI — `telemetry.data` trong hợp đồng."""

    connected: bool = False  # link CÒN SỐNG (is_link_alive), không phải "từng nối"
    link_age_ms: int | None = None  # dẫn xuất, tính lúc serialize


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
class SafetyStatus(BaseModel):
    """Trạng thái quyền lái. Dựng từ `SafetyState` + chủ sở hữu do hub giữ.

    `SafetyState` (backend/mavlink/safety.py) không biết socket nào đang giữ
    quyền — đó là việc của `WebSocketHub`. Hai trường `deadman_tripped` và
    `last_zero_velocity_reason` là chỗ trống Phase 06 sẽ điền.
    """

    web_control_enabled: bool = False
    web_control_owner: str | None = None  # socket_id, hoặc None
    current_mode: str = "UNKNOWN"
    rc_available: bool = True
    deadman_tripped: bool = False  # Phase 06
    last_zero_velocity_reason: str | None = None  # Phase 06


class LimitsPayload(BaseModel):
    """Mọi ngưỡng UI cần. Phase 08/09/10 KHÔNG được hardcode số nào."""

    max_alt: float
    min_alt: float
    max_distance_home: float
    max_waypoints: int
    max_velocity: float
    manual_command_timeout_ms: int
    deadman_tick_ms: int
    avoid_margin_m: float
    avoid_dist_max_m: float
    rangefinder_max_m: float
    # Phase 07: số đo cũ hơn chừng này (giây) thì `avoid_state` = UNKNOWN.
    proximity_stale_s: float


class MissionStatus(BaseModel):
    count: int = 0
    uploaded_at: float | None = None
    # none      : chưa có mission
    # readback  : đã đọc lại từ FC — đáng tin
    # local     : chỉ trong bộ nhớ backend, FC chưa xác nhận
    source: Literal["none", "readback", "local"] = "none"


class CameraStatus(BaseModel):
    available: bool = False
    url: str = "/api/video/stream"
    fake: bool = True


class StatusPayload(BaseModel):
    """`status.data` — gửi 1 lần lúc mở socket, và mỗi lần có gì đổi."""

    backend_version: str
    endpoint: str
    connected: bool
    safety: SafetyStatus
    limits: LimitsPayload
    mission: MissionStatus = Field(default_factory=MissionStatus)
    camera: CameraStatus = Field(default_factory=CameraStatus)


# ---------------------------------------------------------------------------
# Event / Detection
# ---------------------------------------------------------------------------
class EventPayload(BaseModel):
    """`code` là khoá máy đọc (UI lọc và tô màu theo nó).
    `message` là tiếng Việt cho người đọc."""

    level: Literal["info", "warn", "error"] = "info"
    source: Literal["mavlink", "safety", "mission", "vision", "backend"] = "backend"
    code: str
    message: str
    detail: dict[str, Any] | None = None
    ts: float | None = None


class DetectionBox(BaseModel):
    """Toạ độ là PIXEL trong hệ của khung gốc (width×height) — không phải tỉ lệ
    0-1, không phải pixel màn hình. Frontend tự quy đổi."""

    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    label: str


class DetectionPayload(BaseModel):
    frame_id: int
    frame_ts: float
    width: int
    height: int
    # Được phép rỗng — Phase 07..10 thường rỗng hoặc chỉ có box giả.
    boxes: list[DetectionBox] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Ack / Error / Pong
# ---------------------------------------------------------------------------
class AckPayload(BaseModel):
    """`accepted` = backend nhận và thấy hợp lệ. `done` = FC đã xác nhận.

    Lệnh chậm (mode, arm, takeoff, mission) gửi CẢ HAI. Lệnh nhanh chỉ `done`.
    `cmd.velocity` KHÔNG sinh ack — nó chạy 5-20 Hz, ack sẽ làm ngập socket.
    """

    ref: str | None = None
    command: str
    status: Literal["accepted", "done"]
    detail: dict[str, Any] | None = None


class ErrorPayload(BaseModel):
    ref: str | None = None
    command: str | None = None
    code: str
    message: str
    detail: dict[str, Any] | None = None


class PongPayload(BaseModel):
    server_ts: float


# ---------------------------------------------------------------------------
# Lệnh chiều LÊN
#
# Phase 05 chỉ định nghĩa HÌNH DẠNG. Hành vi: Phase 06 (điều khiển) và
# Phase 07 (mission). Model không đặt `extra="forbid"` — hợp đồng nói bên nhận
# bỏ qua trường lạ trong `data` để tương thích tiến.
# ---------------------------------------------------------------------------
WEB_MODE_WHITELIST = (
    "GUIDED",
    "LOITER",
    "ALT_HOLD",
    "POSHOLD",
    "BRAKE",
    "RTL",
    "LAND",
    "AUTO",
    "STABILIZE",
)


class CmdPing(BaseModel):
    pass


class CmdWebControlEnable(BaseModel):
    enabled: bool


class CmdMode(BaseModel):
    mode: Literal[WEB_MODE_WHITELIST]  # type: ignore[valid-type]


class CmdArm(BaseModel):
    """`false` = disarm. CẤM mọi tham số force — xem SAFETY.md mục 1."""

    arm: bool


class CmdTakeoff(BaseModel):
    """Phải nằm trong [MIN_ALT, MAX_ALT]. Vượt thì trả error, KHÔNG im lặng kẹp
    — kiểm ở Phase 06, nơi có config trong tay."""

    altitude: float


class CmdVelocity(BaseModel):
    """m/s, body frame. `vz` DƯƠNG = XUỐNG (quy ước NED, đừng đảo)."""

    vx: float = 0.0
    vy: float = 0.0
    vz: float = 0.0
    yaw_rate: float = 0.0  # độ/s


class CmdSimple(BaseModel):
    """Dùng chung cho `cmd.hold`, `cmd.rtl`, `cmd.land` — không có tham số."""

    pass


# MAV_CMD của mission item mà web được gửi (Phase 07 §7.1). Bốn lệnh, không
# hơn: DO_SET_SERVO, DO_MOTOR_TEST... cũng là "mission item" hợp lệ với FC, và
# đó chính là lý do phải có danh sách trắng ở đây chứ không nhận mọi số nguyên.
MISSION_CMD_WAYPOINT = 16
MISSION_CMD_RTL = 20
MISSION_CMD_LAND = 21
MISSION_CMD_TAKEOFF = 22
MISSION_COMMANDS = (MISSION_CMD_WAYPOINT, MISSION_CMD_RTL, MISSION_CMD_LAND, MISSION_CMD_TAKEOFF)
# ArduCopter cất "dừng tại waypoint" (param1 của NAV_WAYPOINT) vào `p1` kiểu uint16, đơn vị
# GIÂY NGUYÊN: 2.5 thành 2, quá 65535 thì tràn — đọc lại lệch cái đã gửi. Đây là giới hạn của
# giao thức, không phải ngưỡng an toàn (01/11/2026).
MISSION_MAX_HOLD_S = 65535


class MissionWaypoint(BaseModel):
    """`command` thêm ở Phase 07, mặc định NAV_WAYPOINT để client Phase 05
    (chưa biết trường này) vẫn gửi được. Lệnh ngoài `MISSION_COMMANDS` thì
    `validate_mission` từ chối, không phải pydantic — để lỗi về đúng mã
    `validation_failed` kèm số thứ tự item, thay vì `bad_payload` chung chung.

    `hold_s` (01/11/2026): số giây dừng tại điểm, chỉ NAV_WAYPOINT. 0 = bay lướt
    qua — ArduCopter vào cua trước khi tới điểm, chặng đi–về 8 m quay đầu sớm ~1,5 m.
    Kiểu `float` cùng lý do với `command`: số lẻ về `validation_failed` có số item."""

    seq: int
    lat: float
    lon: float
    alt: float
    command: int = MISSION_CMD_WAYPOINT
    hold_s: float = 0.0


class CmdMissionUpload(BaseModel):
    """Backend KHÔNG tự chèn takeoff/RTL còn thiếu — báo `validation_failed`
    để người sửa (Phase 07)."""

    waypoints: list[MissionWaypoint]
    auto_start: bool = False


# ---------------------------------------------------------------------------
# REST (Phase 07 §7.8). Không phải message WebSocket, nhưng cùng một nguồn sự
# thật: `GET /api/status` trả CHÍNH `StatusPayload` ở trên — một schema, hai
# đường vận chuyển. Các model dưới đây cũng xuất vào JSON Schema (khoá `rest`)
# để Phase 08 sinh type TypeScript từ máy.
# ---------------------------------------------------------------------------
class VersionsPayload(BaseModel):
    backend: str
    contract: int


class ConfigPayload(BaseModel):
    """`GET /api/config` — UI đọc ngưỡng từ đây, không hardcode."""

    limits: LimitsPayload
    endpoint: str
    telemetry_hz: float
    versions: VersionsPayload


class MissionPayload(BaseModel):
    """`GET /api/mission`. `waypoints` chỉ đáng tin khi `source == "readback"`."""

    source: Literal["none", "readback", "local"]
    count: int
    uploaded_at: float | None = None
    waypoints: list[MissionWaypoint] = Field(default_factory=list)


class MissionUploadResult(BaseModel):
    """`POST /api/mission`. `code` là mã lỗi hợp đồng khi `ok` là false."""

    ok: bool
    errors: list[str] = Field(default_factory=list)
    count: int = 0
    readback_ok: bool = False
    code: str | None = None


class EventsPayload(BaseModel):
    """`GET /api/events` — lịch sử từ EventBus, cũ trước mới sau."""

    events: list[EventPayload]


class TelemetrySample(BaseModel):
    """Một gói telemetry đã gửi, kèm thời điểm gửi (Unix epoch GIÂY)."""

    ts: float
    data: Telemetry


class TelemetryHistoryPayload(BaseModel):
    """`GET /api/telemetry/history` — vòng đệm của backend (`backend/history.py`).

    Chỉ có mẫu lúc link CÒN SỐNG; khoảng mất link là khoảng trống, không phải
    chuỗi `None`. `hz` là nhịp ghi danh nghĩa, `capacity_s` là độ dài vòng đệm.
    """

    samples: list[TelemetrySample]
    hz: float
    capacity_s: float


class SystemPayload(BaseModel):
    """`GET /api/system` — thông tin vận hành cho trang Hệ thống của web.

    Chỉ ĐỌC. Không có ngưỡng an toàn nào ở đây (ngưỡng ở `limits`).
    """

    backend_version: str
    contract_version: int
    python: str
    platform: str
    pid: int
    started_at: float  # Unix epoch giây
    uptime_s: float
    endpoint: str
    telemetry_hz: float
    ws_clients: int
    link_alive: bool
    vision_enabled: bool
    camera_fake: bool
    camera_source: str
    history_samples: int
    history_capacity_s: float
    events_buffered: int


class RecordingStatus(BaseModel):
    """`GET/POST /api/recording…` — bộ ghi video camera về laptop (01/11/2026).

    Không nằm trong WebSocket: trang web hỏi REST mỗi vài giây là đủ cho đèn REC.
    """

    auto: bool  # RECORD_VIDEO — tự ghi khi backend bật
    running: bool  # bộ ghi đang chạy (có thể đang chờ hình)
    writing: bool  # đang có đoạn video mở, khung đang được ghi
    session_dir: str | None = None  # thư mục của lần ghi này
    segment_file: str | None = None  # file .avi đang ghi / ghi gần nhất
    segments: int = 0
    frames_written: int = 0  # khung đã ghi; mỗi khung camera đúng một khung video
    bad_frames: int = 0  # khung camera gửi bị đứt (thiếu đầu/đuôi JPEG), bỏ qua
    dropped_frames: int = 0  # khung phải bỏ vì đĩa ghi không kịp
    bytes_written: int = 0
    started_at: float | None = None  # Unix epoch giây, lúc bật ghi
    last_frame_at: float | None = None  # Unix epoch giây, khung camera mới nhất đã ghi
    reason: str | None = None  # vì sao KHÔNG ghi (tiếng Việt), None khi đang ghi


# ---------------------------------------------------------------------------
# Lịch sử bay (15/11/2026) — `backend/flights/`. Một chuyến = một lần ARM → DISARM,
# ghép từ log FC (dataflash), tlog của backend và video đã ghi. Chỉ ĐỌC log.
# ---------------------------------------------------------------------------
FlightSource = Literal["dataflash", "tlog", "video"]


class FlightSummary(BaseModel):
    """Một dòng của danh sách chuyến. Số liệu tính trong khoảng ARM → DISARM."""

    id: str  # giờ VN lúc ARM, YYYYMMDD-HHMMSS
    start: float  # Unix epoch giây, ARM
    end: float  # Unix epoch giây, DISARM
    duration_s: float
    took_off: bool  # có lên quá 1 m
    sources: list[FlightSource]
    modes: list[str]
    max_alt_m: float | None = None  # so với home
    max_dist_m: float | None = None  # ngang, so với home
    path_m: float | None = None  # quãng đường ngang lúc cao trên 0,5 m
    battery_start_v: float | None = None
    battery_min_v: float | None = None
    used_mah: float | None = None
    link_loss_pct: float | None = None  # % gói FC mất (tlog); None = laptop không ghi
    video_fps: float | None = None  # khung/s trung bình đã ghi về laptop
    video_coverage_pct: float | None = None  # % số giây có ít nhất 1 khung
    warnings: int = 0  # số sự kiện mức warning/error trong cửa sổ chuyến


class FlightSkippedFile(BaseModel):
    file: str
    reason: str


class FlightListPayload(BaseModel):
    """`GET /api/flights` — mọi chuyến, cũ trước mới sau."""

    flights: list[FlightSummary]
    skipped: list[FlightSkippedFile]


class FlightPoint(BaseModel):
    lat: float
    lon: float


class FlightSeries(BaseModel):
    """Chuỗi số liệu trên một lưới thời gian chung. `t` tính bằng giây từ `window_start`;
    mọi cột dài bằng `t`, `None` = không có dữ liệu lúc đó (khác 0)."""

    t: list[float]
    lat: list[float | None]
    lon: list[float | None]
    alt: list[float | None]  # m, so với home
    speed: list[float | None]  # m/s, tốc độ ngang
    heading: list[float | None]  # độ
    roll: list[float | None]
    pitch: list[float | None]
    volt: list[float | None]
    curr: list[float | None]  # A
    mah: list[float | None]  # mAh đã dùng (cộng dồn từ lúc cắm pin)
    sats: list[float | None]
    hdop: list[float | None]
    rangefinder: list[float | None]  # m, TFmini nhìn ngang
    vibe: list[float | None]  # m/s², lớn nhất 3 trục
    rssi: list[float | None]  # dBm, sóng Wi-Fi DroneBridge ↔ hotspot
    dist_home: list[float | None]  # m
    link_loss: list[float | None]  # % gói FC mất trong 3 s gần nhất
    cam_fps: list[float | None]  # khung/s về laptop trong 2 s gần nhất


class FlightModeSpan(BaseModel):
    t0: float
    t1: float
    mode: str


class FlightEvent(BaseModel):
    t: float
    level: Literal["info", "warning", "error"]
    source: Literal["fc", "link", "camera", "arm"]
    text: str


class FlightVideoClip(BaseModel):
    """Khung video thuộc chuyến. Khung thứ i: `GET /api/flights/frame?rec=…&n=row0+i`."""

    rec: str  # tên thư mục ghi hình
    row0: int
    width: int
    height: int
    times: list[float]  # giây từ `window_start` của từng khung thật


class FlightDetail(BaseModel):
    """`GET /api/flight?id=…` — đủ để phát lại một chuyến."""

    summary: FlightSummary
    window_start: float  # Unix epoch giây; cửa sổ = ARM − 10 s … DISARM + 10 s
    window_end: float
    home: FlightPoint | None = None
    series: FlightSeries
    column_sources: dict[str, Literal["dataflash", "tlog"]]
    modes: list[FlightModeSpan]
    events: list[FlightEvent]
    video: list[FlightVideoClip]
    files: list[str]
    # Giờ GPS của FC − giờ laptop, đã cộng vào tlog và video (đồng hồ laptop trôi ~7 s/ngày).
    clock_offset_s: float | None = None
    clock_note: str | None = None  # đo bằng gì: SYSTEM_TIME / khớp lần ARM / tlog gần nhất


REST_MODELS: dict[str, type[BaseModel]] = {
    "GET /api/status": StatusPayload,
    "GET /api/config": ConfigPayload,
    "GET /api/mission": MissionPayload,
    "POST /api/mission": MissionUploadResult,
    "GET /api/events": EventsPayload,
    "GET /api/telemetry/history": TelemetryHistoryPayload,
    "GET /api/system": SystemPayload,
    "GET /api/recording": RecordingStatus,
    "POST /api/recording/start": RecordingStatus,
    "POST /api/recording/stop": RecordingStatus,
    "GET /api/flights": FlightListPayload,
    "GET /api/flight": FlightDetail,
}


# ---------------------------------------------------------------------------
# Bảng tra: type -> model.  `backend/ws.py` dispatch theo bảng này.
# ---------------------------------------------------------------------------
UPLINK_MODELS: dict[str, type[BaseModel]] = {
    "ping": CmdPing,
    "cmd.web_control_enable": CmdWebControlEnable,
    "cmd.mode": CmdMode,
    "cmd.arm": CmdArm,
    "cmd.takeoff": CmdTakeoff,
    "cmd.velocity": CmdVelocity,
    "cmd.hold": CmdSimple,
    "cmd.rtl": CmdSimple,
    "cmd.land": CmdSimple,
    "cmd.mission.upload": CmdMissionUpload,
}

DOWNLINK_MODELS: dict[str, type[BaseModel]] = {
    "telemetry": Telemetry,
    "status": StatusPayload,
    "event": EventPayload,
    "detection": DetectionPayload,
    "ack": AckPayload,
    "error": ErrorPayload,
    "pong": PongPayload,
}

# Giới hạn nhịp chiều lên, message/giây. Vượt thì message bị BỎ và server trả
# error `rate_limited` tối đa 1 lần/giây (không spam ngược lại client).
UPLINK_RATE_LIMITS: dict[str, float] = {
    "ping": 2,
    "cmd.web_control_enable": 5,
    "cmd.mode": 5,
    "cmd.arm": 2,
    "cmd.takeoff": 2,
    "cmd.velocity": 30,
    "cmd.hold": 5,
    "cmd.rtl": 5,
    "cmd.land": 5,
    "cmd.mission.upload": 1,
}

# Phase nào hiện thực HÀNH VI của lệnh. Phase 05 trả `not_implemented` kèm số
# phase cho mọi type có số khác 5 ở đây.
UPLINK_IMPLEMENTED_IN: dict[str, int] = {
    "ping": 5,
    "cmd.web_control_enable": 5,
    "cmd.mode": 6,
    "cmd.arm": 6,
    "cmd.takeoff": 6,
    "cmd.velocity": 6,
    "cmd.hold": 6,
    "cmd.rtl": 6,
    "cmd.land": 6,
    "cmd.mission.upload": 7,
}

# Mã lỗi hợp đồng. Giữ ở đây để test và Phase 06/07 tham chiếu một chỗ.
ERROR_CODES = (
    "unknown_type",
    "unsupported_version",
    "bad_payload",
    "not_implemented",
    "not_connected",
    "web_control_disabled",
    "wrong_mode",
    "command_denied",
    "validation_failed",
    "rate_limited",
    "timeout",
    "internal",
)


def contract_json_schema() -> dict[str, Any]:
    """JSON Schema của toàn bộ hợp đồng, cho Phase 08 sinh TypeScript.

    Sinh lại file sau mỗi lần đổi hợp đồng:

        uv run python -m backend.schemas > backend/ws-contract.schema.json
    """
    models = [
        Envelope,
        *DOWNLINK_MODELS.values(),
        *UPLINK_MODELS.values(),
        *REST_MODELS.values(),
    ]
    # dict.fromkeys giữ thứ tự và loại trùng (CmdSimple xuất hiện 3 lần).
    unique = list(dict.fromkeys(models))

    key_map, defs = models_json_schema(
        [(model, "validation") for model in unique],
        ref_template="#/$defs/{model}",
        title="IOT-CV WebSocket contract",
    )

    def ref(model: type[BaseModel]) -> dict[str, Any]:
        return key_map[(model, "validation")]

    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "IOT-CV WebSocket contract",
        "description": (
            "Sinh tu backend/schemas.py. KHONG sua tay file nay — sua schemas.py "
            "roi chay: uv run python -m backend.schemas"
        ),
        "contract_version": CONTRACT_VERSION,
        "envelope": ref(Envelope),
        "downlink": {name: ref(model) for name, model in DOWNLINK_MODELS.items()},
        "uplink": {name: ref(model) for name, model in UPLINK_MODELS.items()},
        "rest": {name: ref(model) for name, model in REST_MODELS.items()},
        "uplink_rate_limits": UPLINK_RATE_LIMITS,
        "error_codes": list(ERROR_CODES),
        **defs,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(contract_json_schema(), indent=2, ensure_ascii=False))
