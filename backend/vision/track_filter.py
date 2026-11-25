"""Lọc theo thời gian (tầng 3) — hợp đồng `D:/XLA/docs/hop-dong-model.md` §10 (từ 1.1).

Đây là cài đặt DUY NHẤT của lọc sự kiện (D4 của plan XLA `261125-ai-v2`): luồng trực tiếp
(`backend/vision/events.py` → `EventThrottle`) và công cụ phát lại `scripts/vision/replay_pred.py`
mà XLA dùng để hiệu chỉnh + chấm tầng 3 đều gọi lớp này. Chỉ numpy, không ultralytics/torch.

Mỗi khung (`TrackFilter.update`):
  1. ghép tham lam hộp ↔ track đang sống theo IoU giảm dần, chỉ nhận cặp IoU ≥ `iou`;
  2. track được ghép: thêm một lần trúng vào cửa sổ `n` khung; hộp lẻ: mở track mới;
  3. track không được ghép: thêm một lần trượt; trượt liên tiếp quá `max_gap` khung thì xoá;
  4. track **xác nhận** khi có ≥ `k` lần trúng trong `n` khung gần nhất của nó. Xác nhận là
     dính (kiểu M-of-N của bám mục tiêu): track đã xác nhận giữ nguyên tới khi bị xoá;
  5. sự kiện: track đã xác nhận VÀ trúng ở khung này VÀ hết cooldown. Cooldown toàn cục (mỗi
     khung tối đa một sự kiện, lấy track điểm detector cao nhất) khi detector KHÔNG có
     `recommended_track`; cooldown theo track khi có.

Không có `recommended_track` và không đặt env `DETECTION_TRACK_*` thì k = n =
`DETECTION_MIN_FRAMES`: gần đúng bộ đếm "đủ N khung liên tiếp" cũ, KHÔNG trùng khít. Ba khác biệt
(hợp đồng §10), test ở `backend/tests/test_vision_v2.py`:
  (a) hộp nhảy chỗ (IoU < `iou` giữa hai khung): cũ vẫn đếm liên tiếp, mới là hai track → chưa phát;
  (b) hai người cùng lúc (hoặc lần lượt): cũ đếm chung một bộ đếm theo điểm cao nhất của khung, mới
      đếm riêng từng track → hai người mỗi người 2 khung xen nhau không đủ phát;
  (c) track mất rồi tạo lại: hụt ≤ `max_gap` khung thì track vẫn sống và vẫn xác nhận, hết cooldown
      là phát ngay (cũ: một khung hụt đặt lại bộ đếm, phải đủ N khung mới); hụt > `max_gap` thì
      track bị xoá, track mới có `track_id` mới và phải xác nhận lại từ đầu.
"""

from __future__ import annotations

import collections
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from backend import config

# Mặc định khi detector không có `recommended_track` và env không đặt (hợp đồng §10 không ghi số):
# IoU 0,3 là mức thường dùng cho ghép hộp người giữa hai khung; max_gap 1 = mức thấp nhất của lưới
# hiệu chỉnh phase 09 (XLA), để một khung hụt do nhấp nháy không xoá track.
FALLBACK_IOU = 0.3
FALLBACK_MAX_GAP = 1


@dataclass(frozen=True)
class TrackParams:
    """`k` lần trúng trong `n` khung thì xác nhận; `iou` ngưỡng ghép; `max_gap` khung được hụt."""

    k: int
    n: int
    iou: float
    max_gap: int

    def __post_init__(self) -> None:
        if not (isinstance(self.k, int) and isinstance(self.n, int)) or self.k < 1 or self.n < 1:
            raise ValueError(f"track k, n phải nguyên dương, có k={self.k!r}, n={self.n!r}")
        if self.k > self.n:
            raise ValueError(f"track k={self.k} > n={self.n}: cần k ≤ n")
        if not 0.0 < float(self.iou) <= 1.0:
            raise ValueError(f"track iou={self.iou!r} phải trong (0, 1]")
        if not isinstance(self.max_gap, int) or self.max_gap < 0:
            raise ValueError(f"track max_gap={self.max_gap!r} phải nguyên ≥ 0")

    def as_dict(self) -> dict[str, Any]:
        return {"k": self.k, "n": self.n, "iou": self.iou, "max_gap": self.max_gap}


def check_recommended_track(track: Any) -> TrackParams:
    """Kiểm `meta.recommended_track` của detector (§10). Sai: `ValueError` nêu lý do."""
    if not isinstance(track, Mapping):
        raise ValueError(f"recommended_track phải là object, có {type(track).__name__}")
    missing = [key for key in ("k", "n", "iou", "max_gap") if key not in track]
    if missing:
        raise ValueError(f"recommended_track thiếu {', '.join(missing)}")
    for key in ("k", "n", "max_gap"):
        if isinstance(track[key], bool) or not isinstance(track[key], int):
            raise ValueError(f"recommended_track.{key} phải là số nguyên, có {track[key]!r}")
    if isinstance(track["iou"], bool) or not isinstance(track["iou"], int | float):
        raise ValueError(f"recommended_track.iou phải là số, có {track['iou']!r}")
    return TrackParams(track["k"], track["n"], float(track["iou"]), track["max_gap"])


def resolve_track(
    meta: Mapping[str, Any] | None,
    *,
    k: int | None = None,
    n: int | None = None,
    iou: float | None = None,
    max_gap: int | None = None,
) -> tuple[TrackParams, bool]:
    """(tham số, cooldown theo track?) theo thứ tự ưu tiên: đối số > env `DETECTION_TRACK_*` >
    `meta.recommended_track` > mặc định (k = n = `DETECTION_MIN_FRAMES`).

    Cooldown theo track chỉ khi detector CÓ `recommended_track` (§10); không có thì cooldown toàn
    cục như cũ, kể cả khi env ghi đè k/n. Kết hợp sai (vd. env k > n của meta): `ValueError`."""
    rec = (meta or {}).get("recommended_track")
    base = check_recommended_track(rec) if rec is not None else None

    def pick(arg, env, from_meta, fallback):
        for value in (arg, env, from_meta):
            if value is not None:
                return value
        return fallback

    params = TrackParams(
        k=pick(k, config.DETECTION_TRACK_K, base and base.k, config.DETECTION_MIN_FRAMES),
        n=pick(n, config.DETECTION_TRACK_N, base and base.n, config.DETECTION_MIN_FRAMES),
        iou=float(pick(iou, config.DETECTION_TRACK_IOU, base and base.iou, FALLBACK_IOU)),
        max_gap=pick(
            max_gap, config.DETECTION_TRACK_MAX_GAP, base and base.max_gap, FALLBACK_MAX_GAP
        ),
    )
    return params, base is not None


@dataclass(frozen=True)
class TrackBox:
    """Một hộp vào lọc: toạ độ px khung gốc, điểm detector, điểm verifier (None khi không có)."""

    x1: float
    y1: float
    x2: float
    y2: float
    score: float
    verifier_score: float | None = None


@dataclass(frozen=True)
class TrackEvent:
    """Một sự kiện `vision.person_detected` (§10): `confidence` = điểm detector cao nhất của track,
    `verifier_score` = điểm verifier cao nhất của track (None khi không chạy verifier)."""

    track_id: int
    confidence: float
    hits: int
    window: int
    verifier_score: float | None
    box: TrackBox


@dataclass
class _Track:
    id: int
    box: TrackBox
    window: collections.deque[bool]
    misses: int = 0
    confirmed: bool = False
    best_score: float = 0.0
    best_verifier: float | None = None
    last_event: float | None = None

    @property
    def hits(self) -> int:
        return sum(self.window)


@dataclass(frozen=True)
class FrameResult:
    """Kết quả một khung: hộp của track đã xác nhận (`confirmed`, cùng thứ tự hộp vào, kèm
    `track_id`) và các sự kiện phát ở khung này."""

    confirmed: list[tuple[int, TrackBox]] = field(default_factory=list)
    events: list[TrackEvent] = field(default_factory=list)


def iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """IoU từng cặp giữa `a` [M,4] và `b` [N,4] xyxy → [M,N]."""
    if a.size == 0 or b.size == 0:
        return np.zeros((len(a), len(b)), np.float64)
    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    union = area_a[:, None] + area_b[None, :] - inter
    return np.where(union > 0, inter / np.where(union > 0, union, 1.0), 0.0)


def _xyxy(boxes: Sequence[TrackBox]) -> np.ndarray:
    return np.asarray([[b.x1, b.y1, b.x2, b.y2] for b in boxes], np.float64).reshape(-1, 4)


class TrackFilter:
    def __init__(self, params: TrackParams, *, cooldown_s: float, per_track_cooldown: bool) -> None:
        if cooldown_s < 0:
            raise ValueError(f"cooldown_s={cooldown_s} phải ≥ 0")
        self.params = params
        self.cooldown_s = float(cooldown_s)
        self.per_track_cooldown = per_track_cooldown
        self._tracks: list[_Track] = []
        self._next_id = 1
        self._last_event: float | None = None  # cooldown toàn cục

    @property
    def tracks(self) -> int:
        return len(self._tracks)

    def reset(self) -> None:
        """Xoá mọi track và cooldown (phát lại: vào/ra đoạn khung blank). Không đặt lại số id."""
        self._tracks.clear()
        self._last_event = None

    def _match(self, boxes: Sequence[TrackBox]) -> dict[int, int]:
        """Ghép tham lam: cặp IoU lớn nhất trước; trả {chỉ số hộp: chỉ số track}."""
        ious = iou_matrix(_xyxy([t.box for t in self._tracks]), _xyxy(boxes))
        pairs: dict[int, int] = {}
        used_tracks: set[int] = set()
        # argsort ổn định: IoU bằng nhau thì track cũ hơn, hộp đứng trước thắng.
        order = np.argsort(-ious, axis=None, kind="stable")
        for flat in order:
            ti, bi = divmod(int(flat), ious.shape[1])
            if ious[ti, bi] < self.params.iou:
                break
            if ti in used_tracks or bi in pairs:
                continue
            pairs[bi] = ti
            used_tracks.add(ti)
        return pairs

    def update(self, boxes: Sequence[TrackBox], now: float) -> FrameResult:
        pairs = self._match(boxes)
        hit_tracks: dict[int, int] = {}  # id track → chỉ số hộp
        matched = set(pairs.values())
        survivors: list[_Track] = []
        for ti, track in enumerate(self._tracks):
            if ti in matched:
                survivors.append(track)
                continue
            track.window.append(False)
            track.misses += 1
            if track.misses <= self.params.max_gap:
                survivors.append(track)
        for bi, box in enumerate(boxes):
            if bi in pairs:
                track = self._tracks[pairs[bi]]
                track.window.append(True)
                track.misses = 0
                track.box = box
            else:
                track = _Track(self._next_id, box, collections.deque([True], maxlen=self.params.n))
                self._next_id += 1
                survivors.append(track)
            track.best_score = max(track.best_score, float(box.score))
            if box.verifier_score is not None:
                track.best_verifier = max(track.best_verifier or 0.0, float(box.verifier_score))
            if track.hits >= self.params.k:
                track.confirmed = True
            hit_tracks[track.id] = bi
        self._tracks = survivors

        by_id = {t.id: t for t in self._tracks}
        confirmed = sorted(
            ((bi, tid) for tid, bi in hit_tracks.items() if by_id[tid].confirmed),
        )
        result = FrameResult(confirmed=[(tid, boxes[bi]) for bi, tid in confirmed])
        candidates = [by_id[tid] for _, tid in confirmed]
        result.events.extend(self._events(candidates, now))
        return result

    def _cooled(self, last: float | None, now: float) -> bool:
        return last is None or now - last >= self.cooldown_s

    def _events(self, candidates: list[_Track], now: float) -> list[TrackEvent]:
        if self.per_track_cooldown:
            chosen = [t for t in candidates if self._cooled(t.last_event, now)]
        elif candidates and self._cooled(self._last_event, now):
            chosen = [max(candidates, key=lambda t: t.best_score)]
            self._last_event = now
        else:
            chosen = []
        for t in chosen:
            t.last_event = now
        return [
            TrackEvent(
                track_id=t.id,
                confidence=t.best_score,
                hits=t.hits,
                window=self.params.n,
                verifier_score=t.best_verifier,
                box=t.box,
            )
            for t in chosen
        ]
