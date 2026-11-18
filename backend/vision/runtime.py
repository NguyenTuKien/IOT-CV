"""Nạp hai model AI lúc backend khởi động và giữ trạng thái cho `/api/status` (`status.vision`).

Model nào không qua kiểm hợp đồng (§5) thì: log ERROR một lần, sự kiện `vision.model_rejected`
`{model, reason}`, trạng thái `rejected` kèm lý do — phần còn lại của backend chạy bình thường.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from backend.events import BUS, EventBus
from backend.schemas import VisionModelStatus, VisionStatus
from backend.vision.detector import PersonDetector
from backend.vision.enhancer import Enhancer
from backend.vision.model_bundle import BundleRejected
from backend.vision.pipeline import VisionPipeline

log = logging.getLogger(__name__)


def _loaded_status(bundle) -> VisionModelStatus:
    return VisionModelStatus(
        state="loaded",
        version=bundle.version,
        providers=bundle.providers,
        cpu_only=bundle.cpu_only,
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
    ) -> None:
        self.reader = reader
        self.bus = bus
        self.position = position
        self._load_detector = load_detector
        self._load_enhancer = load_enhancer
        self.detector: PersonDetector | None = None
        self.enhancer: Enhancer | None = None
        self.detector_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.enhancer_status = VisionModelStatus(state="disabled", reason="chưa nạp")
        self.pipeline: VisionPipeline | None = None

    def _try(self, kind: str, loader):
        try:
            model = loader()
        except BundleRejected as exc:
            log.error("Model %s KHÔNG nạp: %s", kind, exc.reason)
            self.bus.emit(
                "error",
                "vision",
                "vision.model_rejected",
                f"Model {kind} không nạp: {exc.reason}",
                {"model": kind, "reason": exc.reason},
            )
            return None, VisionModelStatus(state="rejected", reason=exc.reason)
        return model, _loaded_status(model.bundle)

    def load(self) -> None:
        self.detector, self.detector_status = self._try("detector", self._load_detector)
        self.enhancer, self.enhancer_status = self._try("enhancer", self._load_enhancer)
        if self.detector is None and self.enhancer is None:
            return
        self.pipeline = VisionPipeline(
            self.reader, self.detector, self.enhancer, on_person=self._on_person
        )

    def start(self) -> None:
        if self.pipeline is not None:
            self.pipeline.start()

    def stop(self) -> None:
        if self.pipeline is not None:
            self.pipeline.stop()

    def _on_person(self, confidence: float) -> None:
        lat, lon, alt = self.position() if self.position else (None, None, None)
        # GPS là toạ độ UAV, KHÔNG phải toạ độ người (backend/vision/events.py).
        self.bus.emit(
            "warn",
            "vision",
            "vision.person_detected",
            f"Phát hiện người (độ tin {confidence:.2f}) — vị trí ghi là của UAV",
            {"confidence": round(confidence, 3), "uav_lat": lat, "uav_lon": lon, "uav_alt": alt},
        )

    def status(self) -> VisionStatus:
        stats = self.pipeline.stats() if self.pipeline is not None else {}
        return VisionStatus(
            detector=self.detector_status,
            enhancer=self.enhancer_status,
            ms=stats.get("ms", {}),
            frames_processed=stats.get("frames_processed", 0),
            frames_dropped=stats.get("frames_dropped", 0),
            errors=stats.get("errors", 0),
        )
