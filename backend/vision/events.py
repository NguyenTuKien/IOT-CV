"""Sinh detection event, chống spam — GIAI ĐOẠN 74, 75; từ 25/11/2026 theo hợp đồng XLA §10.

Detector chạy ~10 khung/s có thể tạo hàng trăm event cho cùng một người. Luật:

    hộp ≥ ngưỡng detector (DETECTION_CONFIDENCE, rỗng = conf_threshold của bundle)
    -> (verifier, nếu nạp) -> lọc track k/n (`backend/vision/track_filter.py`)
    -> track xác nhận + trúng ở khung này + hết cooldown DETECTION_COOLDOWN_S
    -> tạo event

`EventThrottle` chỉ còn là lớp tương thích: mọi trạng thái nằm trong `TrackFilter` (cài đặt duy
nhất, D4), không còn bộ đếm khung liên tiếp riêng.

Ghi rất rõ trong báo cáo: GPS tại thời điểm phát hiện là TOẠ ĐỘ UAV, KHÔNG PHẢI
toạ độ chính xác của người (cần camera calibration + attitude + độ cao + phép
chiếu tia — để Version 2).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from backend import config
from backend.vision.track_filter import (
    TrackBox,
    TrackEvent,
    TrackFilter,
    TrackParams,
    resolve_track,
)


@dataclass
class DetectionEvent:
    event: str
    confidence: float
    timestamp: str
    uav_lat: float | None
    uav_lon: float | None
    uav_alt: float | None
    snapshot: str | None


class EventThrottle:
    """Lớp tương thích quanh `TrackFilter`. Test ở `backend/tests/test_vision_ai.py` và
    `backend/tests/test_vision_v2.py`.

    `update(boxes, now)` nhận các hộp của một khung (đã qua verifier nếu có), bỏ hộp dưới
    `confidence_threshold`, đưa vào lọc track, trả các sự kiện phát ở khung này.

    Tham số track: `track` nếu truyền; không thì `resolve_track(meta)` (env `DETECTION_TRACK_*`,
    `recommended_track` trong meta detector); `min_frames` (cách gọi cũ) = k = n khi không có hai
    thứ đó. Cooldown theo track chỉ khi meta có `recommended_track`.
    """

    def __init__(
        self,
        min_frames: int | None = None,
        cooldown_s: float | None = None,
        confidence_threshold: float | None = None,
        *,
        meta: Mapping[str, Any] | None = None,
        track: TrackParams | None = None,
        per_track_cooldown: bool | None = None,
    ) -> None:
        threshold = (
            config.DETECTION_CONFIDENCE if confidence_threshold is None else confidence_threshold
        )
        if threshold is None:
            raise ValueError(
                "EventThrottle cần ngưỡng: truyền conf_threshold của detector hoặc đặt "
                "DETECTION_CONFIDENCE"
            )
        self.confidence_threshold = float(threshold)
        resolved, per_track = resolve_track(meta, k=min_frames, n=min_frames)
        if track is not None:
            resolved = track
        if per_track_cooldown is not None:
            per_track = per_track_cooldown
        self.filter = TrackFilter(
            resolved,
            cooldown_s=config.DETECTION_COOLDOWN_S if cooldown_s is None else cooldown_s,
            per_track_cooldown=per_track,
        )

    @property
    def params(self) -> TrackParams:
        return self.filter.params

    def update(self, boxes: Sequence[TrackBox], now: float) -> list[TrackEvent]:
        kept = [b for b in boxes if b.score >= self.confidence_threshold]
        return self.filter.update(kept, now).events

    def should_emit(self, boxes: Sequence[TrackBox], now: float) -> bool:
        return bool(self.update(boxes, now))

    def reset(self) -> None:
        self.filter.reset()
