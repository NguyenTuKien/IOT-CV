"""Sinh detection event, chống spam — GIAI ĐOẠN 74, 75.

YOLO chạy 10 FPS có thể tạo hàng trăm event cho cùng một người. Luật:

    confidence >= ngưỡng (DETECTION_CONFIDENCE, rỗng = conf_threshold của bundle)
    -> detected >= DETECTION_MIN_FRAMES frame liên tiếp
    -> tạo event
    -> cooldown DETECTION_COOLDOWN_S giây

Ghi rất rõ trong báo cáo: GPS tại thời điểm phát hiện là TOẠ ĐỘ UAV, KHÔNG PHẢI
toạ độ chính xác của người (cần camera calibration + attitude + độ cao + phép
chiếu tia — để Version 2).
"""

from __future__ import annotations

from dataclasses import dataclass

from backend import config


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
    """Đếm frame liên tiếp và giữ cooldown giữa hai event. Logic thuần, test ở
    `backend/tests/test_vision_ai.py`.

    `confidence` là điểm cao nhất của khung (0 khi khung không có người). Khung dưới
    ngưỡng đặt lại bộ đếm. Đủ `min_frames` khung liên tiếp thì phát, rồi im ít nhất
    `cooldown_s` giây; người vẫn đứng đó thì hết cooldown phát tiếp.
    """

    def __init__(
        self,
        min_frames: int | None = None,
        cooldown_s: float | None = None,
        confidence_threshold: float | None = None,
    ) -> None:
        self.min_frames = config.DETECTION_MIN_FRAMES if min_frames is None else min_frames
        self.cooldown_s = config.DETECTION_COOLDOWN_S if cooldown_s is None else cooldown_s
        threshold = (
            config.DETECTION_CONFIDENCE if confidence_threshold is None else confidence_threshold
        )
        if threshold is None:
            raise ValueError(
                "EventThrottle cần ngưỡng: truyền conf_threshold của detector hoặc đặt "
                "DETECTION_CONFIDENCE"
            )
        self.confidence_threshold = float(threshold)
        self.consecutive_frames = 0
        self.last_event_time: float | None = None

    def should_emit(self, confidence: float, now: float) -> bool:
        if confidence < self.confidence_threshold:
            self.consecutive_frames = 0
            return False
        self.consecutive_frames += 1
        if self.consecutive_frames < self.min_frames:
            return False
        if self.last_event_time is not None and now - self.last_event_time < self.cooldown_s:
            return False
        self.last_event_time = now
        return True
