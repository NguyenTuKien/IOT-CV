"""Nạp các model AI lúc backend khởi động và giữ trạng thái cho `/api/status` (`status.vision`).

Bốn model (hợp đồng XLA `docs/hop-dong-model.md` §5, §9, §11, §13): detector, enhancer, verifier
(sau detector) và enhancer-offline (chỉ kiểm rồi đóng session → `ready`; job offline dùng sau).
Model nào không qua kiểm hợp đồng thì: log ERROR một lần, sự kiện `vision.model_rejected`
`{model, reason}`, trạng thái `rejected` kèm lý do — phần còn lại của backend chạy bình thường.
Env đường dẫn rỗng (`VERIFIER_ONNX`, `ENHANCER_OFFLINE_ONNX`) = model đó `disabled`, không sự kiện.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from backend import config
from backend.events import BUS, EventBus
from backend.schemas import VisionModelStatus, VisionStatus
from backend.vision.detector import PersonDetector
from backend.vision.enhancer import Enhancer
from backend.vision.model_bundle import BundleRejected, LoadedBundle, load_bundle
from backend.vision.pipeline import VisionPipeline
from backend.vision.track_filter import TrackEvent
from backend.vision.verifier import BoxVerifier

log = logging.getLogger(__name__)


def _model_status(bundle: LoadedBundle) -> VisionModelStatus:
    return VisionModelStatus(
        state=bundle.state,
        version=bundle.version,
        providers=bundle.providers,
        cpu_only=bundle.cpu_only,
    )


def load_enhancer_offline_from_config() -> LoadedBundle | None:
    """Kiểm bundle `ENHANCER_OFFLINE_ONNX` (session CPU mở rồi đóng, §13); None khi env rỗng."""
    if not config.ENHANCER_OFFLINE_ONNX:
        return None
    return load_bundle(
        config.ENHANCER_OFFLINE_ONNX, config.ENHANCER_OFFLINE_SHA256, "enhancer-offline"
    )


class VisionRuntime:
    def __init__(
        self,
        reader: Any,
        *,
        bus: EventBus = BUS,
        position: Callable[[], tuple[float | None, float | None, float | None]] | None = None,
        load_detector: Callable[[], PersonDetector] = PersonDetector.from_config,
        load_enhancer: Callable[[], Enhancer] = Enhancer.from_config,
        load_verifier: Callable[[], BoxVerifier | None] = BoxVerifier.from_config,
        load_enhancer_offline: Callable[
            [], LoadedBundle | None
        ] = load_enhancer_offline_from_config,
    ) -> None:
        self.reader = reader
        self.bus = bus
        self.position = position
        self._load_detector = load_detector
        self._load_enhancer = load_enhancer
        self._load_verifier = load_verifier
        self._load_enhancer_offline = load_enhancer_offline
        self.detector: PersonDetector | None = None
        self.enhancer: Enhancer | None = None
        self.verifier: BoxVerifier | None = None
        # Bundle offline đã kiểm (`ready`, session đóng); job offline mở lại session khi chạy.
        self.enhancer_offline: LoadedBundle | None = None
        self.detector_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.enhancer_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.verifier_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.enhancer_offline_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.pipeline: VisionPipeline | None = None

    def _reject(self, kind: str, reason: str) -> VisionModelStatus:
        log.error("Model %s KHÔNG nạp: %s", kind, reason)
        self.bus.emit(
            "error",
            "vision",
            "vision.model_rejected",
            f"Model {kind} không nạp: {reason}",
            {"model": kind, "reason": reason},
        )
        return VisionModelStatus(state="rejected", reason=reason)

    def _try(
        self, kind: str, loader, env_key: str | None = None, disabled_reason: str | None = None
    ):
        try:
            model = loader()
        except BundleRejected as exc:
            return None, self._reject(kind, exc.reason)
        if model is None:
            reason = disabled_reason or (f"{env_key} chưa đặt (tắt)" if env_key else "tắt")
            return None, VisionModelStatus(state="disabled", reason=reason)
        bundle = model if isinstance(model, LoadedBundle) else model.bundle
        return model, _model_status(bundle)

    def load(self) -> None:
        self.detector, self.detector_status = self._try("detector", self._load_detector)
        self.enhancer, self.enhancer_status = self._try("enhancer", self._load_enhancer)
        self.verifier, self.verifier_status = self._try(
            "verifier", self._load_verifier, "VERIFIER_ONNX"
        )
        self.enhancer_offline, self.enhancer_offline_status = self._try(
            "enhancer-offline",
            self._load_enhancer_offline,
            "ENHANCER_OFFLINE_ONNX",
            config.ENHANCER_OFFLINE_DISABLED_REASON,
        )
        if self.detector is None and self.verifier is not None:
            # Verifier chỉ chạy sau detector (§9): không có detector thì nó không dùng được.
            self.verifier = None
            self.verifier_status = VisionModelStatus(
                state="disabled", reason="detector chưa nạp — verifier chạy sau detector"
            )
        self._build_pipeline()

    def _build_pipeline(self) -> None:
        if self.detector is None and self.enhancer is None:
            return
        try:
            self.pipeline = self._new_pipeline()
        except ValueError as exc:
            # Tham số lọc track k/n sai (env DETECTION_TRACK_* + recommended_track): detector
            # không chạy được đúng hợp đồng §10 → coi như detector bị từ chối, enhancer vẫn chạy.
            self.detector_status = self._reject("detector", f"lọc track: {exc}")
            self.detector = None
            if self.verifier is not None:
                self.verifier = None
                self.verifier_status = VisionModelStatus(
                    state="disabled", reason="detector bị từ chối — verifier chạy sau detector"
                )
            if self.enhancer is not None:
                self.pipeline = self._new_pipeline()

    def _new_pipeline(self) -> VisionPipeline:
        return VisionPipeline(
            self.reader,
            self.detector,
            self.enhancer,
            verifier=self.verifier,
            on_event=self._on_event,
        )

    def start(self) -> None:
        if self.pipeline is not None:
            self.pipeline.start()

    def stop(self) -> None:
        if self.pipeline is not None:
            self.pipeline.stop()

    def _on_event(self, event: TrackEvent) -> None:
        lat, lon, alt = self.position() if self.position else (None, None, None)
        # GPS là toạ độ UAV, KHÔNG phải toạ độ người (backend/vision/events.py).
        verifier = None if event.verifier_score is None else round(event.verifier_score, 3)
        self.bus.emit(
            "warn",
            "vision",
            "vision.person_detected",
            f"Phát hiện người (độ tin {event.confidence:.2f}) — vị trí ghi là của UAV",
            {
                "confidence": round(event.confidence, 3),
                "uav_lat": lat,
                "uav_lon": lon,
                "uav_alt": alt,
                "track_id": event.track_id,
                "hits": event.hits,
                "window": event.window,
                "verifier_score": verifier,
            },
        )

    def status(self) -> VisionStatus:
        stats = self.pipeline.stats() if self.pipeline is not None else {}
        return VisionStatus(
            detector=self.detector_status,
            enhancer=self.enhancer_status,
            verifier=self.verifier_status,
            enhancer_offline=self.enhancer_offline_status,
            enhancer_default_on=config.ENHANCER_DEFAULT_ON,
            ms=stats.get("ms", {}),
            frames_processed=stats.get("frames_processed", 0),
            frames_dropped=stats.get("frames_dropped", 0),
            errors=stats.get("errors", 0),
        )
