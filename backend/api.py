"""Router REST — Phase 05 việc 5.3.5, hoàn thiện ở Phase 07 §7.8.

REST dùng cho HỎI–ĐÁP (mở trang, đọc cấu hình, nạp mission). Telemetry và lệnh
lái đi bằng WebSocket. Mọi endpoint trả model pydantic trong `schemas.py` —
không tự dựng dict rời.

`GET /api/status` trả CHÍNH `StatusPayload` của message `status` trên WebSocket,
dựng bằng CÙNG một hàm (`WebSocketHub.build_status`). Một schema, hai đường vận
chuyển — lệch nhau là bug. (Trước Phase 07 endpoint này có hình dạng riêng,
"telemetry phẳng + safety + limits"; Phase 07 bỏ hình dạng đó để khỏi nuôi hai
hợp đồng. Không có frontend hay script nào đọc hình dạng cũ.)
"""

from __future__ import annotations

import asyncio
import os
import platform
import sys
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response, StreamingResponse

from backend import __version__, config
from backend.flights import store_from_config
from backend.flights.ai import EnhancerUnavailable, FlightFrameAIService, FrameNotFound
from backend.flights.offline import OfflineEnhanceJob, OfflineRefused, RecordingNotFound
from backend.flights.video import RecordingCache
from backend.schemas import (
    CONTRACT_VERSION,
    CmdMissionUpload,
    ConfigPayload,
    EventsPayload,
    FlightDetail,
    FlightFrameAI,
    FlightListPayload,
    FlightSkippedFile,
    LimitsPayload,
    MissionPayload,
    MissionUploadResult,
    MissionWaypoint,
    OfflineEnhanceAccepted,
    OfflineEnhanceStatus,
    RecordingStatus,
    StatusPayload,
    SystemPayload,
    TelemetryHistoryPayload,
    VersionsPayload,
)
from backend.vision.stream import MJPEG_MEDIA_TYPE, mjpeg_multipart

# Mã lỗi hợp đồng -> mã HTTP cho `POST /api/mission`. Thân trả về LUÔN là
# `MissionUploadResult` (có `code`), mã HTTP chỉ để curl/trình duyệt phân loại.
_HTTP_STATUS = {
    "validation_failed": 422,
    "command_denied": 409,
    "not_connected": 503,
    "timeout": 504,
    "internal": 500,
}

_EVENTS_MAX = 200
# Trần số điểm một lần hỏi lịch sử: 2400 gói ≈ 1,5 MB JSON — đủ cho biểu đồ
# 1600 px, không làm trình duyệt đứng khi parse.
_HISTORY_MAX_POINTS = 4000

# Mốc backend khởi động (import module = lúc uvicorn nạp app).
STARTED_AT = time.time()


def build_router(hub) -> APIRouter:
    """Dựng router với hub được tiêm vào (hub giữ state, safety, mission, camera).

    Tiêm chứ không import biến toàn cục từ `app.py`: import thì
    `app -> api -> app` thành vòng, và test không thay được hub giả.
    """
    router = APIRouter(prefix="/api")

    @router.get("/health")
    async def health() -> dict:
        return {"status": "ok", "version": __version__}

    @router.get("/status", response_model=StatusPayload)
    async def status() -> StatusPayload:
        return hub.build_status()

    @router.get("/config", response_model=ConfigPayload)
    async def get_config() -> ConfigPayload:
        return ConfigPayload(
            limits=LimitsPayload(**config.safety_limits()),
            endpoint=config.MAVLINK_ENDPOINT,
            telemetry_hz=config.TELEMETRY_HZ,
            versions=VersionsPayload(backend=__version__, contract=CONTRACT_VERSION),
        )

    @router.get("/mission", response_model=MissionPayload)
    async def get_mission() -> MissionPayload:
        mission = hub.mission
        if mission is None:
            return MissionPayload(source="none", count=0)
        return MissionPayload(
            source=mission.source,  # type: ignore[arg-type]
            count=len(mission.current),
            uploaded_at=mission.uploaded_at,
            waypoints=[
                MissionWaypoint(
                    seq=w.seq, lat=w.lat, lon=w.lon, alt=w.alt, command=w.command, hold_s=w.hold_s
                )
                for w in mission.current
            ],
        )

    @router.post("/mission", response_model=MissionUploadResult)
    async def post_mission(body: CmdMissionUpload):
        # DÙNG CHUNG đường với `cmd.mission.upload` trên WebSocket — không viết
        # lại logic. Mọi cổng (link, quyền lái, EKF/GPS, validate) ở một chỗ.
        result = await hub.upload_mission(body, socket_id=None)
        if result.ok:
            return result
        return JSONResponse(
            status_code=_HTTP_STATUS.get(result.code or "", 400),
            content=result.model_dump(),
        )

    @router.get("/events", response_model=EventsPayload)
    async def events(limit: int = Query(100, ge=1, le=_EVENTS_MAX)) -> EventsPayload:
        return EventsPayload(events=hub.bus.recent(limit=limit))

    @router.get("/telemetry/history", response_model=TelemetryHistoryPayload)
    async def telemetry_history(
        seconds: float = Query(600.0, gt=0, le=86_400),
        max_points: int = Query(2400, ge=10, le=_HISTORY_MAX_POINTS),
    ) -> TelemetryHistoryPayload:
        history = hub.history
        return TelemetryHistoryPayload(
            samples=history.samples(seconds=seconds, max_points=max_points),
            hz=history.hz,
            capacity_s=history.seconds,
        )

    @router.get("/system", response_model=SystemPayload)
    async def system() -> SystemPayload:
        now = time.time()
        return SystemPayload(
            backend_version=__version__,
            contract_version=CONTRACT_VERSION,
            python=platform.python_version(),
            platform=f"{platform.system()} {platform.release()} ({sys.platform})",
            pid=os.getpid(),
            started_at=STARTED_AT,
            uptime_s=now - STARTED_AT,
            endpoint=config.MAVLINK_ENDPOINT,
            telemetry_hz=config.TELEMETRY_HZ,
            ws_clients=hub.client_count,
            link_alive=hub.build_status().connected,
            vision_enabled=config.VISION_ENABLED,
            camera_fake=config.CAMERA_FAKE,
            camera_source=config.camera_source_url(),
            history_samples=len(hub.history),
            history_capacity_s=hub.history.seconds,
            events_buffered=len(hub.bus.recent(limit=_EVENTS_MAX)),
        )

    @router.get("/video/stream", response_model=None)
    async def video_stream(
        variant: Literal["raw", "enhanced"] = Query("raw"),
    ) -> StreamingResponse | JSONResponse:
        """`raw` = khung camera nguyên vẹn (hành vi cũ). `enhanced` = khung qua enhancer của
        XLA (hợp đồng §8); enhancer chưa nạp -> 503 `{error, reason}`."""
        reader = hub.camera
        if reader is None:
            raise HTTPException(503, "Khối vision đang tắt (VISION_ENABLED=0)")
        if variant == "raw":
            reader.start()
            return StreamingResponse(mjpeg_multipart(reader), media_type=MJPEG_MEDIA_TYPE)
        vision = getattr(hub, "vision", None)
        pipeline = vision.pipeline if vision is not None else None
        if pipeline is None or pipeline.enhancer is None:
            reason = vision.enhancer_status.reason if vision is not None else None
            return JSONResponse(
                {"error": "enhancer_unavailable", "reason": reason or "enhancer chưa nạp"},
                status_code=503,
            )
        reader.start()

        async def enhanced():
            pipeline.acquire_enhanced()
            try:
                async for part in mjpeg_multipart(pipeline.enhanced_view):
                    yield part
            finally:
                pipeline.release_enhanced()

        return StreamingResponse(enhanced(), media_type=MJPEG_MEDIA_TYPE)

    def _recording(action: str | None = None) -> RecordingStatus:
        """Đèn REC của web. Không có bộ ghi (vision tắt) thì trả trạng thái 'không ghi'
        kèm lý do, không 404: trang web chỉ cần hiện lý do."""
        recorder = getattr(hub, "recorder", None)
        if recorder is None:
            return RecordingStatus(
                auto=config.RECORD_VIDEO,
                running=False,
                writing=False,
                reason="Khối vision đang tắt (VISION_ENABLED=0), không có camera để ghi",
            )
        if action == "start":
            return RecordingStatus(**recorder.start())
        if action == "stop":
            return RecordingStatus(**recorder.stop())
        return RecordingStatus(**recorder.status())

    @router.get("/recording", response_model=RecordingStatus)
    async def recording() -> RecordingStatus:
        return _recording()

    @router.post("/recording/start", response_model=RecordingStatus)
    async def recording_start() -> RecordingStatus:
        return await asyncio.to_thread(_recording, "start")

    @router.post("/recording/stop", response_model=RecordingStatus)
    async def recording_stop() -> RecordingStatus:
        # stop() join thread ghi tới 5 s — chạy ngoài event loop cho telemetry khỏi khựng.
        return await asyncio.to_thread(_recording, "stop")

    @router.get("/video/fake-source")
    async def video_fake_source() -> StreamingResponse:
        """Nguồn GIẢ (§7.8.3). `stream.py` đọc endpoint này như đọc một ESP32."""
        if not config.CAMERA_FAKE:
            raise HTTPException(404, "Nguồn video giả đang tắt (CAMERA_FAKE=0)")
        # Import tại chỗ: thiếu OpenCV chỉ hỏng ĐÚNG endpoint này, không hỏng
        # cả backend bay (SAFETY.md mục 9).
        from backend.vision.fake_stream import FakeMjpegSource

        source = FakeMjpegSource()
        try:
            # Mở clip TRƯỚC khi trả 200: hỏng thì trả 503 có lời giải thích,
            # thay vì một luồng 200 đứt ngay byte đầu.
            first = await asyncio.to_thread(source.next_part)
        except RuntimeError as exc:
            source.close()
            raise HTTPException(503, str(exc)) from exc

        async def body():
            yield first
            async for part in source.parts():
                yield part

        return StreamingResponse(body(), media_type=MJPEG_MEDIA_TYPE)

    # ---- Lịch sử bay (15/11/2026, backend/flights/) — chỉ ĐỌC log trên đĩa -------------
    # Lần đầu đọc hết log (.bin lớn ~ chục giây) rồi lưu đệm; chạy ngoài event loop để
    # telemetry của chuyến đang bay không khựng.
    flights_store = store_from_config()
    recordings = RecordingCache(Path(config.RECORD_DIR))
    # AI trên khung đã ghi dùng chung model của khối vision (hub.vision), không nạp lần hai.
    frame_ai = FlightFrameAIService(recordings, lambda: getattr(hub, "vision", None))
    # Job ảnh rõ offline ×2 (hợp đồng XLA §13): app.py dựng sẵn ở `hub.offline_job` (để lifespan
    # dừng được); thiếu (test dựng router riêng) thì dựng ở đây, cùng bộ đọc lần ghi.
    offline_job: OfflineEnhanceJob = getattr(hub, "offline_job", None) or OfflineEnhanceJob(
        recordings,
        vision=lambda: getattr(hub, "vision", None),
        telemetry=lambda: getattr(hub, "state", None),
    )

    def _flight_list() -> FlightListPayload:
        scan = flights_store.scan()
        return FlightListPayload(
            flights=[f["summary"] for f in flights_store.flights()],
            skipped=[FlightSkippedFile(file=f, reason=r) for f, r in scan.skipped],
        )

    @router.get("/flights", response_model=FlightListPayload)
    async def flights() -> FlightListPayload:
        return await asyncio.to_thread(_flight_list)

    @router.get("/flight", response_model=FlightDetail)
    async def flight(id: str = Query(..., pattern=r"^\d{8}-\d{6}$")) -> FlightDetail:  # noqa: A002
        found = await asyncio.to_thread(flights_store.flight, id)
        if found is None:
            raise HTTPException(404, f"Không có chuyến {id}")
        return FlightDetail(**found)

    @router.get("/flights/frame")
    async def flight_frame(
        rec: str = Query(..., pattern=r"^\d{8}-\d{6}$"),
        n: int = Query(..., ge=0),
        variant: Literal["raw", "enhanced", "offline"] = Query("raw"),
    ) -> Response:
        """Khung JPEG thứ `n` (thứ tự dòng `frames.csv`) của lần ghi `rec`.

        `variant=enhanced` = khung đó sau enhancer của XLA (để so với gốc trên trang Lịch sử
        bay); enhancer không dùng được -> 503 `{error: "enhancer_unavailable", reason}`.
        `variant=offline` = ảnh 1280×960 job offline đã dựng (§13); chưa có -> 404
        `{error: "not_cached", reason}`."""
        if variant == "offline":
            data, why = await asyncio.to_thread(offline_job.cached_frame, rec, n)
            if data is None:
                return JSONResponse({"error": "not_cached", "reason": why}, status_code=404)
            return Response(
                data,
                media_type="image/jpeg",
                headers={"Cache-Control": "private, max-age=3600"},
            )
        if variant == "enhanced":
            try:
                enhanced = await asyncio.to_thread(frame_ai.enhanced_jpeg, rec, n)
            except FrameNotFound as exc:
                raise HTTPException(404, str(exc)) from exc
            except EnhancerUnavailable as exc:
                return JSONResponse(
                    {"error": "enhancer_unavailable", "reason": exc.reason}, status_code=503
                )
            return Response(
                enhanced,
                media_type="image/jpeg",
                headers={"Cache-Control": "private, max-age=3600"},
            )

        def read() -> bytes | None:
            item = recordings.get(rec)
            return item.frame(n) if item else None

        data = await asyncio.to_thread(read)
        if data is None:
            raise HTTPException(404, "Không có khung hình này")
        return Response(
            data,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400, immutable"},
        )

    @router.get("/flights/ai", response_model=FlightFrameAI)
    async def flight_frame_ai(
        rec: str = Query(..., pattern=r"^\d{8}-\d{6}$"),
        n: int = Query(..., ge=0),
        detect: bool = Query(True),
    ) -> FlightFrameAI:
        """Hộp người (detector trên khung gốc) + số đo ảnh + trạng thái model cho khung `n`.

        `detect=false`: bỏ detector, chỉ chạy enhancer (người xem tắt hộp người)."""
        try:
            return await asyncio.to_thread(frame_ai.analyze, rec, n, detect)
        except FrameNotFound as exc:
            raise HTTPException(404, str(exc)) from exc

    @router.post("/flights/enhance-offline", response_model=OfflineEnhanceAccepted, status_code=202)
    async def flight_enhance_offline_start(
        rec: str = Query(..., pattern=r"^\d{8}-\d{6}$"),
    ) -> OfflineEnhanceAccepted | JSONResponse:
        """Dựng ảnh rõ offline ×2 cho cả lần ghi `rec` (nền, một job một lúc, §13).

        409 `armed` / `link_recent` / `busy` (kèm `rec` đang chạy), 503
        `enhancer_offline_unavailable` (kèm `reason`, cả khi mở session lỗi), 507 `disk_full`."""
        try:
            return await asyncio.to_thread(offline_job.start, rec)
        except OfflineRefused as exc:
            return JSONResponse(exc.body, status_code=exc.status)
        except RecordingNotFound as exc:
            raise HTTPException(404, str(exc)) from exc

    @router.get("/flights/enhance-offline", response_model=OfflineEnhanceStatus)
    async def flight_enhance_offline_status(
        rec: str = Query(..., pattern=r"^\d{8}-\d{6}$"),
    ) -> OfflineEnhanceStatus:
        """Trạng thái job offline của `rec`: none | queued | running | paused | done | failed."""
        try:
            return await asyncio.to_thread(offline_job.status, rec)
        except RecordingNotFound as exc:
            raise HTTPException(404, str(exc)) from exc

    return router
