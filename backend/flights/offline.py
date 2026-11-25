"""Job ảnh rõ offline ×2 cho trang Lịch sử bay — hợp đồng XLA `docs/hop-dong-model.md` §11, §13.

Tính trước `enhancer-offline.onnx` (ảnh 1280×960) cho MỌI khung của một lần ghi, lưu JPEG trên đĩa:

    <FLIGHT_AI_CACHE_DIR>/<rec>/enhancer-offline-v<ver>/<n:06d>.jpg + manifest.json

Một job một lúc, chạy thread nền, không bao giờ tự chạy khi backend khởi động. An toàn với chuyến
bay: trước **mỗi** khung kiểm (1) drone đang ARM, (2) liên kết FC mất chưa quá
`FLIGHT_AI_LINK_GRACE_S` (có thể đang bay ngoài tầm), (3) khoá GPU của XLA đang có người giữ — trúng
điều kiện nào thì `paused` kèm `reason` và **đóng** session ORT (trả VRAM); hết điều kiện thì mở lại
session và chạy tiếp từ `done`. Job không điều khiển bay, chỉ chiếm GPU.

`manifest.onnx_sha256` khác bundle đang nạp → cache cũ coi như không có, xoá và dựng lại. Ổ còn
trống dưới `FLIGHT_AI_MIN_FREE_MB` → POST trả 507, job đang chạy chuyển `failed`.

Khoá GPU của XLA chỉ được ĐỌC (bản ghi người giữ ở đầu file, như `xla.gpu_lock.read_holder`), không
import gói `xla`, không giữ khoá. Đường dẫn: env `XLA_GPU_LOCK_FILE` (cùng tên env XLA dùng).
"""

from __future__ import annotations

import gc
import json
import logging
import os
import shutil
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

from backend import config
from backend.flights.video import REC_NAME, RecordingCache
from backend.mavlink.telemetry import is_link_alive
from backend.schemas import (
    OfflineEnhanceAccepted,
    OfflineEnhanceError,
    OfflineEnhanceManifest,
    OfflineEnhanceStatus,
)
from backend.vision.model_bundle import (
    FRAME_SHAPE,
    OFFLINE_SHAPE,
    BundleRejected,
    LoadedBundle,
    load_bundle,
)

log = logging.getLogger(__name__)

KIND = "enhancer-offline"
MANIFEST = "manifest.json"
DEFAULT_GPU_LOCK_FILE = r"D:\DevCache\locks\gpu.lock"
_GPU_LOCK_INFO_BYTES = 512  # bản ghi người giữ ở đầu file khoá (xla/gpu_lock.py `_INFO_BYTES`)
# Ghi manifest ít nhất mỗi chừng này khung / giây (và luôn ghi khi dừng, xong, lỗi): backend chết
# giữa chừng thì lần sau làm lại vài khung, không mất cả chuyến.
_MANIFEST_EVERY_FRAMES = 25
_MANIFEST_EVERY_S = 2.0
_NO_VISION = "khối vision chưa chạy trong backend"


class OfflineRefused(Exception):
    """POST bị từ chối: `status` HTTP + thân `OfflineEnhanceError` (§13)."""

    def __init__(self, status: int, error: OfflineEnhanceError) -> None:
        super().__init__(f"{status} {error.error}")
        self.status = status
        self.error = error

    @property
    def body(self) -> dict[str, Any]:
        return self.error.model_dump(exclude_none=True)


class RecordingNotFound(LookupError):
    """Không có lần ghi `rec` (hoặc nó không có khung nào)."""


def gpu_lock_file() -> Path:
    return Path(os.environ.get("XLA_GPU_LOCK_FILE") or DEFAULT_GPU_LOCK_FILE)


def read_gpu_holder(path: Path | None = None) -> str | None:
    """Người đang giữ khoá GPU của XLA (`pid=… label=…`), None khi khoá rảnh / chưa có file.

    XLA ghi `pid=…` lúc vào khối `gpu_lock` và `free (lần cuối: …)` lúc ra (kể cả khi lỗi)."""
    p = path or gpu_lock_file()
    try:
        with open(p, "rb", buffering=0) as f:
            text = f.read(_GPU_LOCK_INFO_BYTES).decode("utf-8", errors="replace").strip()
    except OSError:
        return None
    return text if text.startswith("pid=") else None


def disk_free_mb(path: Path) -> float:
    """MB (2^20 byte) còn trống trên ổ chứa `path` (thư mục chưa có thì đo thư mục cha gần nhất)."""
    p = path
    while not p.exists() and p.parent != p:
        p = p.parent
    return shutil.disk_usage(p).free / (1 << 20)


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _default_open_session(bundle: LoadedBundle) -> LoadedBundle:
    """Mở session chạy thật (provider theo `VISION_ORT_PROVIDERS`); kiểm lại sha của file so với
    sha đã kiểm lúc khởi động — file bị thay giữa chừng thì `BundleRejected`."""
    return load_bundle(
        bundle.onnx_path, str(bundle.meta.get("onnx_sha256", "")), KIND, keep_session=True
    )


@dataclass
class _Job:
    rec: str
    total: int
    version: str
    sha: str
    out_dir: Path
    state: str = "queued"
    done: int = 0
    reason: str | None = None
    started: str = field(default_factory=_now_iso)
    finished: str | None = None
    wall_s: float = 0.0  # cộng dồn qua các lần chạy (manifest), không tính lúc paused
    run_frames: int = 0  # khung đã chạy model trong lần này (đo s/khung)
    run_s: float = 0.0
    skipped: int = 0  # khung hỏng / sai cỡ: không có file cache, GET frame trả 404

    @property
    def s_per_frame(self) -> float | None:
        if self.run_frames:
            return round(self.run_s / self.run_frames, 4)
        if self.done and self.wall_s:
            return round(self.wall_s / self.done, 4)
        return None


class OfflineEnhanceJob:
    def __init__(
        self,
        recordings: RecordingCache,
        *,
        vision: Callable[[], Any],
        telemetry: Callable[[], Any],
        open_session: Callable[[LoadedBundle], LoadedBundle] = _default_open_session,
        cache_dir: Path | None = None,
        gpu_holder: Callable[[], str | None] = read_gpu_holder,
        free_mb: Callable[[Path], float] = disk_free_mb,
        poll_s: float = 2.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.recordings = recordings
        self._vision = vision
        self._telemetry = telemetry
        self._open_session = open_session
        self._cache_dir = cache_dir
        self._gpu_holder = gpu_holder
        self._free_mb = free_mb
        self.poll_s = poll_s
        self._clock = clock
        self._lock = threading.Lock()
        self._job: _Job | None = None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._session: LoadedBundle | None = None
        self.opens = 0  # số lần mở session (test: đóng khi paused, mở lại khi chạy tiếp)
        self.last_s_per_frame: float | None = None

    # -- đường dẫn, bundle -------------------------------------------------------------
    @property
    def cache_root(self) -> Path:
        return self._cache_dir or Path(config.FLIGHT_AI_CACHE_DIR)

    def _bundle(self) -> tuple[LoadedBundle | None, str | None]:
        v = self._vision()
        if v is None:
            return None, _NO_VISION
        bundle = getattr(v, "enhancer_offline", None)
        if bundle is None:
            status = getattr(v, "enhancer_offline_status", None)
            return None, (getattr(status, "reason", None) or "enhancer-offline chưa nạp")
        return bundle, None

    def _out_dir(self, rec: str, version: str) -> Path:
        return self.cache_root / rec / f"{KIND}-v{version}"

    def _total(self, rec: str) -> int:
        item = self.recordings.get(rec) if REC_NAME.match(rec) else None
        if item is None or not item.rows:
            raise RecordingNotFound(f"không có lần ghi {rec}")
        return len(item.rows)

    @property
    def session_open(self) -> bool:
        return self._session is not None

    # -- điều kiện an toàn (kiểm trước mỗi khung) -------------------------------------------
    def _flight_blocker(self) -> tuple[str, str] | None:
        """(mã, lý do) khi có thể đang bay: `armed` | `link_recent`; None khi an toàn."""
        state = self._telemetry()
        if state is None:
            return None
        alive = state.last_update is not None and is_link_alive(state, now=self._clock())
        if getattr(state, "armed", False):
            note = "" if alive else " (trạng thái cuối trước khi mất liên kết)"
            return "armed", f"drone đang ARM{note}"
        if state.last_update is not None and not alive:
            lost_s = self._clock() - state.last_update
            if lost_s < config.FLIGHT_AI_LINK_GRACE_S:
                return "link_recent", (
                    f"mất liên kết FC {lost_s:.0f} s trước (< {config.FLIGHT_AI_LINK_GRACE_S:.0f} s"
                    " — có thể đang bay)"
                )
        return None

    def _blocker(self) -> str | None:
        flight = self._flight_blocker()
        if flight is not None:
            return flight[1]
        holder = self._gpu_holder()
        if holder:
            return f"khoá GPU của XLA đang bị giữ ({holder[:120]})"
        return None

    # -- manifest ----------------------------------------------------------------------
    def _read_manifest(self, out_dir: Path) -> OfflineEnhanceManifest | None:
        try:
            raw = json.loads((out_dir / MANIFEST).read_text(encoding="utf-8"))
            return OfflineEnhanceManifest.model_validate(raw)
        except (OSError, ValueError):
            return None

    def _write_manifest(self, job: _Job) -> None:
        m = OfflineEnhanceManifest(
            bundle_version=job.version,
            onnx_sha256=job.sha,
            total=job.total,
            done=job.done,
            jpeg_quality=config.FLIGHT_AI_JPEG_QUALITY,
            started=job.started,
            finished=job.finished,
            wall_s=round(job.wall_s, 3),
        )
        job.out_dir.mkdir(parents=True, exist_ok=True)
        tmp = job.out_dir / (MANIFEST + ".tmp")
        tmp.write_text(m.model_dump_json(indent=2), encoding="utf-8")
        os.replace(tmp, job.out_dir / MANIFEST)

    def _valid_manifest(self, rec: str, bundle: LoadedBundle) -> OfflineEnhanceManifest | None:
        m = self._read_manifest(self._out_dir(rec, bundle.version))
        if m is None or m.onnx_sha256 != str(bundle.meta.get("onnx_sha256", "")):
            return None
        return m

    # -- API ---------------------------------------------------------------------------
    def _active(self) -> _Job | None:
        job = self._job
        return job if job is not None and job.state in ("queued", "running", "paused") else None

    def start(self, rec: str) -> OfflineEnhanceAccepted:
        """Bắt đầu (hoặc chạy tiếp từ `done`) job cho `rec`. Ném `OfflineRefused` (409/503/507)
        hoặc `RecordingNotFound`. Mở session ngay khi không bị chặn: mở lỗi → 503."""
        with self._lock:
            active = self._active()
            if active is not None:
                if active.rec != rec:
                    raise OfflineRefused(409, OfflineEnhanceError(error="busy", rec=active.rec))
                return self._accepted(active)
            flight = self._flight_blocker()
            if flight is not None:
                raise OfflineRefused(409, OfflineEnhanceError(error=flight[0], reason=flight[1]))
            bundle, why = self._bundle()
            if bundle is None:
                raise OfflineRefused(
                    503, OfflineEnhanceError(error="enhancer_offline_unavailable", reason=why)
                )
            total = self._total(rec)
            free = self._free_mb(self.cache_root)
            if free < config.FLIGHT_AI_MIN_FREE_MB:
                raise OfflineRefused(
                    507, OfflineEnhanceError(error="disk_full", free_mb=round(free, 1))
                )
            job = self._new_job(rec, total, bundle)
            if job.done < job.total and self._blocker() is None:
                try:
                    self._open(bundle)
                except BundleRejected as exc:
                    raise OfflineRefused(
                        503,
                        OfflineEnhanceError(
                            error="enhancer_offline_unavailable", reason=exc.reason
                        ),
                    ) from exc
                job.state = "running"
            self._job = job
            self._spawn(bundle)
            return self._accepted(job)

    @staticmethod
    def _accepted(job: _Job) -> OfflineEnhanceAccepted:
        state = "running" if job.state == "running" else "queued"
        return OfflineEnhanceAccepted(rec=job.rec, state=state, done=job.done, total=job.total)

    def _new_job(self, rec: str, total: int, bundle: LoadedBundle) -> _Job:
        sha = str(bundle.meta.get("onnx_sha256", ""))
        out_dir = self._out_dir(rec, bundle.version)
        job = _Job(rec=rec, total=total, version=bundle.version, sha=sha, out_dir=out_dir)
        old = self._read_manifest(out_dir)
        if old is not None and old.onnx_sha256 == sha and old.total == total:
            job.done = min(old.done, total)
            job.started, job.wall_s = old.started, old.wall_s
        elif out_dir.exists():
            # Bundle khác (cùng phiên bản, sha khác) hoặc lần ghi đã dài thêm: dựng lại từ đầu.
            log.info("Cache offline %s không khớp bundle/lần ghi — xoá, dựng lại", out_dir)
            shutil.rmtree(out_dir, ignore_errors=True)
        return job

    def _spawn(self, bundle: LoadedBundle) -> None:
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, args=(self._job, bundle), name="flight-ai-offline", daemon=True
        )
        self._thread.start()

    def status(self, rec: str) -> OfflineEnhanceStatus:
        """Trạng thái job (§13). Lần ghi không phải job hiện tại: đọc manifest trên đĩa —
        xong hết là `done`, dựng dở (backend đã dừng) là `none` kèm `done` để POST chạy tiếp."""
        with self._lock:
            job = self._job
            if job is not None and job.rec == rec:
                return OfflineEnhanceStatus(
                    rec=rec,
                    state=job.state,  # type: ignore[arg-type]
                    done=job.done,
                    total=job.total,
                    bundle_version=job.version,
                    s_per_frame=job.s_per_frame,
                    reason=job.reason,
                )
        total = self._total(rec)
        bundle, why = self._bundle()
        if bundle is None:
            return OfflineEnhanceStatus(rec=rec, state="none", done=0, total=total, reason=why)
        m = self._valid_manifest(rec, bundle)
        done = min(m.done, total) if m is not None and m.total == total else 0
        s_per = round(m.wall_s / m.done, 4) if m is not None and m.done and m.wall_s else None
        return OfflineEnhanceStatus(
            rec=rec,
            state="done" if total and done >= total else "none",
            done=done,
            total=total,
            bundle_version=bundle.version,
            s_per_frame=s_per,
        )

    def cached_frame(self, rec: str, n: int) -> tuple[bytes | None, str | None]:
        """(JPEG 1280×960 của khung `n`, None) khi đã cache với đúng bundle đang nạp; không thì
        (None, lý do) — API trả 404 `not_cached`."""
        bundle, why = self._bundle()
        if bundle is None:
            return None, why
        if not REC_NAME.match(rec):
            return None, "tên lần ghi sai"
        if self._valid_manifest(rec, bundle) is None:
            return None, "chuyến này chưa dựng ảnh offline với bundle đang nạp"
        path = self._out_dir(rec, bundle.version) / f"{n:06d}.jpg"
        try:
            return path.read_bytes(), None
        except OSError:
            return None, f"khung {n} chưa dựng"

    def stop(self, timeout: float = 10.0) -> None:
        """Dừng thread (backend tắt): ghi manifest, đóng session. Lần sau POST chạy tiếp."""
        self._stop.set()
        self._wake.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)
        self._close()

    # -- session -----------------------------------------------------------------------
    def _open(self, bundle: LoadedBundle) -> None:
        if self._session is None:
            self._session = self._open_session(bundle)
            self.opens += 1
            log.info(
                "Job offline: mở session %s, provider %s", bundle.version, self._session.providers
            )

    def _close(self) -> None:
        if self._session is not None:
            self._session = None
            gc.collect()  # ORT nhả VRAM khi session hết tham chiếu
            log.info("Job offline: đã đóng session (trả VRAM)")

    # -- vòng chạy ---------------------------------------------------------------------
    def _set(self, job: _Job, state: str, reason: str | None = None) -> None:
        with self._lock:
            job.state, job.reason = state, reason

    def _run(self, job: _Job, bundle: LoadedBundle) -> None:
        t_window = int(bundle.meta.get("temporal_window", 1) or 1)
        decoded: OrderedDict[int, np.ndarray | None] = OrderedDict()
        last_write = (self._clock(), job.done)
        try:
            while not self._stop.is_set():
                if job.done >= job.total:
                    job.finished = _now_iso()
                    self._close()
                    self._write_manifest(job)
                    self._set(job, "done")
                    log.info(
                        "Job offline %s xong: %d khung, %.1f s", job.rec, job.total, job.wall_s
                    )
                    return
                reason = self._blocker()
                if reason is not None:
                    if job.state != "paused":
                        self._close()
                        self._write_manifest(job)
                        self._set(job, "paused", reason)
                        log.info("Job offline %s tạm dừng: %s", job.rec, reason)
                    else:
                        with self._lock:
                            job.reason = reason
                    self._wake.wait(self.poll_s)
                    self._wake.clear()
                    continue
                free = self._free_mb(self.cache_root)
                if free < config.FLIGHT_AI_MIN_FREE_MB:
                    self._fail(
                        job,
                        f"disk_full: ổ còn {free:.0f} MB (< {config.FLIGHT_AI_MIN_FREE_MB:.0f} MB)",
                    )
                    return
                if self._session is None:
                    try:
                        self._open(bundle)
                    except BundleRejected as exc:
                        self._fail(job, f"enhancer_offline_unavailable: {exc.reason}")
                        return
                if job.state != "running":
                    self._set(job, "running")
                t0 = self._clock()
                self._process(job, job.done, t_window, decoded)
                dt = self._clock() - t0
                with self._lock:
                    job.done += 1
                    job.wall_s += dt
                    job.run_s += dt
                    job.run_frames += 1
                    self.last_s_per_frame = job.s_per_frame
                if (
                    job.done - last_write[1] >= _MANIFEST_EVERY_FRAMES
                    or self._clock() - last_write[0] >= _MANIFEST_EVERY_S
                ):
                    self._write_manifest(job)
                    last_write = (self._clock(), job.done)
            # Backend tắt giữa chừng: lưu tiến độ, job dừng (POST lần sau chạy tiếp).
            self._write_manifest(job)
        except Exception as exc:  # noqa: BLE001 — lỗi job không được làm chết backend
            log.exception("Job offline %s lỗi", job.rec)
            self._fail(job, f"lỗi: {exc}")
        finally:
            self._close()

    def _fail(self, job: _Job, reason: str) -> None:
        self._close()
        try:
            self._write_manifest(job)
        except OSError:
            log.warning("Job offline %s: không ghi được manifest", job.rec)
        self._set(job, "failed", reason)
        log.error("Job offline %s dừng hẳn: %s", job.rec, reason)

    def _decode(self, rec: str, n: int, cache: OrderedDict[int, np.ndarray | None], keep: int):
        if n in cache:
            cache.move_to_end(n)
            return cache[n]
        import cv2

        item = self.recordings.get(rec)
        jpeg = item.frame(n) if item else None
        img = None
        if jpeg is not None:
            img = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
            if img is not None and img.shape != FRAME_SHAPE:
                img = None  # khung sai cỡ: model chỉ nhận 640×480 (§1), không tự resize
        cache[n] = img
        while len(cache) > keep:
            cache.popitem(last=False)
        return img

    def _process(self, job: _Job, n: int, t_window: int, cache) -> None:
        import cv2

        keep = t_window + 1
        target = self._decode(job.rec, n, cache, keep)
        if target is None:
            job.skipped += 1
            return
        if t_window > 1:
            half = t_window // 2
            frames = []
            for k in range(n - half, n + half + 1):
                # Đầu/cuối chuyến lặp khung biên (§11); khung hàng xóm hỏng thì lấy khung đích.
                img = self._decode(job.rec, min(max(k, 0), job.total - 1), cache, keep)
                frames.append(target if img is None else img)
            feeds = {"frames": np.ascontiguousarray(np.stack(frames))}
        else:
            feeds = {"frame": np.ascontiguousarray(target)}
        session = self._session
        if session is None:
            raise RuntimeError("session offline đã đóng giữa khung")
        (out,) = session.session.run(["frame_out"], feeds)
        if tuple(out.shape) != OFFLINE_SHAPE:
            raise ValueError(f"enhancer-offline ra {list(out.shape)}, cần {list(OFFLINE_SHAPE)}")
        ok, buf = cv2.imencode(
            ".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, config.FLIGHT_AI_JPEG_QUALITY]
        )
        if not ok:
            raise ValueError("không nén được JPEG ảnh offline")
        job.out_dir.mkdir(parents=True, exist_ok=True)
        path = job.out_dir / f"{n:06d}.jpg"
        tmp = path.with_suffix(".jpg.tmp")
        tmp.write_bytes(buf.tobytes())
        os.replace(tmp, path)
