"""Job ảnh rõ offline ×2 + API của trang Lịch sử bay (hợp đồng XLA `docs/hop-dong-model.md` §13).

Bundle giả `enhancer-offline` của `test_vision_v2` (nearest ×2; bản video T = 3 lấy khung giữa),
chạy ORT CPU. `STATE` giả là `SimpleNamespace(armed, last_update)`; khoá GPU và chỗ trống ổ đĩa
tiêm qua hàm giả. Lần ghi là AVI MJPEG thật, mỗi khung một mức xám riêng để biết job đã đọc
đúng khung nào (và đúng cửa sổ trượt của bản video).
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

np = pytest.importorskip("numpy")
cv2 = pytest.importorskip("cv2")
pytest.importorskip("onnx")
pytest.importorskip("onnxruntime")

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import config  # noqa: E402
from backend.api import build_router  # noqa: E402
from backend.flights.offline import OfflineEnhanceJob, read_gpu_holder  # noqa: E402
from backend.flights.video import RecordingCache  # noqa: E402
from backend.schemas import VisionModelStatus  # noqa: E402
from backend.tests.test_vision_v2 import CPU, DET_BOXES, make_bundle  # noqa: E402
from backend.vision.avi_writer import MjpegAviWriter  # noqa: E402
from backend.vision.detector import PersonDetector  # noqa: E402
from backend.vision.model_bundle import BundleRejected, load_bundle  # noqa: E402
from backend.vision.verifier import BoxVerifier  # noqa: E402

REC = "20261102-100941"
REC2 = "20261102-110000"
T0 = 1_762_050_000.0
# Mức xám từng khung; khung 4 là 320×240 (sai cỡ): job bỏ qua, không có file cache.
LEVELS = [40, 70, 100, 130, 160, 190]
BAD = 4
LOADED = VisionModelStatus(state="loaded", version="0.0.1", providers=CPU)
READY = VisionModelStatus(state="ready", version="0.0.1")


def _jpeg(value: int, w: int = 640, h: int = 480) -> bytes:
    ok, buf = cv2.imencode(
        ".jpg", np.full((h, w, 3), value, np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]
    )
    assert ok
    return buf.tobytes()


def _recording(root: Path, rec: str = REC, levels=LEVELS, bad: int | None = BAD) -> None:
    d = root / rec
    d.mkdir(parents=True)
    w = MjpegAviWriter(d / "video-001.avi", fps=10, width=640, height=480)
    rows = ["segment,video_frame,unix_time,frame_id,width,height"]
    for k, v in enumerate(levels):
        fw, fh = (320, 240) if k == bad else (640, 480)
        w.write_jpeg(_jpeg(v, fw, fh), T0 + k * 0.1)
        rows.append(f"1,{k},{T0 + k * 0.1:.3f},{k},{fw},{fh}")
    w.close()
    (d / "frames.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")


class _Hooked:
    """Session ORT thật bọc lại: đếm lần chạy, gọi `hook(lần)` sau mỗi lần."""

    def __init__(self, real, hook):
        self.real, self.hook, self.runs = real, hook, 0

    def run(self, names, feeds):
        out = self.real.run(names, feeds)
        self.runs += 1
        if self.hook is not None:
            self.hook(self.runs)
        return out


class Env:
    def __init__(self, tmp_path: Path, monkeypatch, *, temporal_window: int = 1, **job_kw):
        self.tmp = tmp_path
        self.rec_root = tmp_path / "recordings"
        _recording(self.rec_root)
        _recording(self.rec_root, REC2, levels=[50, 60], bad=None)
        monkeypatch.setattr(config, "RECORD_DIR", str(self.rec_root))
        monkeypatch.setattr(config, "FLIGHT_LOGS_DIR", str(tmp_path / "logs"))
        monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path / "tlog"))
        monkeypatch.setattr(config, "FLIGHT_CACHE_DIR", str(tmp_path / "cache"))
        monkeypatch.setattr(config, "FLIGHT_AI_MIN_FREE_MB", 3000.0)
        monkeypatch.setattr(config, "FLIGHT_AI_LINK_GRACE_S", 300.0)
        self.bundle_dir = tmp_path / f"b{temporal_window}"
        meta = {"temporal_window": temporal_window}
        if temporal_window > 1:
            from backend.tests.test_vision_v2 import offline_graph

            meta["data"] = offline_graph(temporal_window)
        data = meta.pop("data", None)
        path, self.sha = make_bundle(self.bundle_dir, "enhancer-offline", data=data, **meta)
        self.ready = load_bundle(path, self.sha, "enhancer-offline")
        self.state = SimpleNamespace(armed=False, last_update=None)
        self.vision = SimpleNamespace(
            enhancer_offline=self.ready,
            enhancer_offline_status=READY,
            detector=None,
            enhancer=None,
            verifier=None,
            detector_status=VisionModelStatus(state="disabled", reason="thử"),
            enhancer_status=VisionModelStatus(state="disabled", reason="thử"),
        )
        self.hook = None
        self.sessions: list[_Hooked] = []
        self.holder: str | None = None
        self.free = 50_000.0
        self.cache = tmp_path / "flights-ai"
        self.job = OfflineEnhanceJob(
            RecordingCache(self.rec_root),
            vision=lambda: self.vision,
            telemetry=lambda: self.state,
            open_session=job_kw.pop("open_session", self._open),
            cache_dir=self.cache,
            gpu_holder=lambda: self.holder,
            free_mb=lambda _p: self.free,
            poll_s=0.01,
        )
        app = FastAPI()
        hub = SimpleNamespace(vision=self.vision, state=self.state, offline_job=self.job)
        app.include_router(build_router(hub=hub))
        self.c = TestClient(app)

    def _open(self, bundle):
        kept = load_bundle(bundle.onnx_path, self.sha, "enhancer-offline", CPU, keep_session=True)
        kept.session = _Hooked(kept.session, lambda n: self.hook and self.hook(n))
        self.sessions.append(kept.session)
        return kept

    def post(self, rec: str = REC):
        return self.c.post("/api/flights/enhance-offline", params={"rec": rec})

    def get(self, rec: str = REC) -> dict:
        r = self.c.get("/api/flights/enhance-offline", params={"rec": rec})
        assert r.status_code == 200, r.text
        return r.json()

    def wait(self, pred, rec: str = REC, timeout: float = 20.0) -> dict:
        end = time.monotonic() + timeout
        body = self.get(rec)
        while not pred(body):
            if time.monotonic() > end:
                raise AssertionError(f"hết giờ chờ, trạng thái cuối {body}")
            time.sleep(0.01)
            body = self.get(rec)
        return body

    def frame(self, n: int, rec: str = REC):
        return self.c.get("/api/flights/frame", params={"rec": rec, "n": n, "variant": "offline"})

    def manifest(self) -> dict:
        p = self.cache / REC / "enhancer-offline-v0.0.1" / "manifest.json"
        return json.loads(p.read_text(encoding="utf-8"))

    def teardown(self):
        self.job.stop()


@pytest.fixture
def env(tmp_path, monkeypatch):
    e = Env(tmp_path, monkeypatch)
    yield e
    e.teardown()


def _decode(content: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    assert img is not None
    return img


def _check_frames(e: Env, levels=LEVELS, bad=BAD):
    for n, v in enumerate(levels):
        r = e.frame(n)
        if n == bad:
            assert r.status_code == 404 and r.json()["error"] == "not_cached"
            continue
        assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
        img = _decode(r.content)
        assert img.shape == (960, 1280, 3)
        assert abs(float(img.mean()) - v) < 4, (n, float(img.mean()), v)


# -- chạy hết, cache, manifest ----------------------------------------------------------------
def test_chay_het_ghi_cache_va_manifest(env):
    assert env.frame(0).json() == {
        "error": "not_cached",
        "reason": "chuyến này chưa dựng ảnh offline với bundle đang nạp",
    }
    assert env.get() == {
        "rec": REC,
        "state": "none",
        "done": 0,
        "total": 6,
        "bundle_version": "0.0.1",
        "s_per_frame": None,
        "reason": None,
    }
    r = env.post()
    assert r.status_code == 202
    assert r.json() == {"rec": REC, "state": "running", "done": 0, "total": 6}
    body = env.wait(lambda b: b["state"] == "done")
    assert (body["done"], body["total"], body["bundle_version"]) == (6, 6, "0.0.1")
    assert body["s_per_frame"] is not None and body["reason"] is None
    m = env.manifest()
    assert set(m) == {
        "bundle_version",
        "onnx_sha256",
        "total",
        "done",
        "jpeg_quality",
        "started",
        "finished",
        "wall_s",
    }
    assert (m["bundle_version"], m["onnx_sha256"], m["total"], m["done"]) == (
        "0.0.1",
        env.sha,
        6,
        6,
    )
    assert m["jpeg_quality"] == config.FLIGHT_AI_JPEG_QUALITY and m["finished"]
    assert m["wall_s"] >= 0
    _check_frames(env)
    # Khung sai cỡ không chạy model: 5 lần chạy cho 6 khung; session đóng khi xong.
    assert env.sessions[0].runs == 5 and not env.job.session_open
    assert env.job.last_s_per_frame is not None


def test_ban_video_doc_cua_so_truot(tmp_path, monkeypatch):
    e = Env(tmp_path, monkeypatch, temporal_window=3)
    try:
        assert e.post().status_code == 202
        e.wait(lambda b: b["state"] == "done")
        # Bundle giả lấy khung giữa cửa sổ: ảnh ra = khung đích, kể cả ở biên (lặp khung biên)
        # và cạnh khung hỏng (thay bằng khung đích).
        _check_frames(e)
    finally:
        e.teardown()


def test_get_va_post_lan_ghi_khong_co_404(env):
    assert (
        env.c.get("/api/flights/enhance-offline", params={"rec": "20261231-235959"}).status_code
        == 404
    )
    assert (
        env.c.post("/api/flights/enhance-offline", params={"rec": "20261231-235959"}).status_code
        == 404
    )
    assert env.c.post("/api/flights/enhance-offline", params={"rec": "../x"}).status_code == 422


# -- tạm dừng an toàn: armed, liên kết vừa mất, khoá GPU ----------------------------------------
@pytest.mark.parametrize("why", ["armed", "link", "gpu"])
def test_tam_dung_dong_session_roi_chay_tiep_tu_done(env, why):
    def trip(runs):
        if runs != 2:
            return
        if why == "armed":
            env.state.armed = True
        elif why == "link":
            env.state.last_update = time.monotonic() - 10.0
        else:
            env.holder = "pid=4560 label=v2 phase10 since=2026-11-26T01:00:00"

    env.hook = trip
    assert env.post().status_code == 202
    body = env.wait(lambda b: b["state"] == "paused")
    assert body["done"] == 2  # điều kiện kiểm trước MỖI khung: dừng ngay khung kế
    expect = {"armed": "drone đang ARM", "link": "mất liên kết FC", "gpu": "khoá GPU của XLA"}
    assert expect[why] in body["reason"]
    assert not env.job.session_open and env.job.opens == 1
    assert env.manifest()["done"] == 2
    time.sleep(0.1)
    assert env.get()["done"] == 2  # đứng yên khi còn điều kiện
    env.hook = None
    env.state.armed = False
    env.state.last_update = None
    env.holder = None
    body = env.wait(lambda b: b["state"] == "done")
    assert body["done"] == 6 and env.job.opens == 2
    # Lần mở thứ hai chạy đúng phần còn lại (khung 2, 3, 5; khung 4 hỏng), không làm lại từ 0.
    assert [s.runs for s in env.sessions] == [2, 3]
    _check_frames(env)


def test_khoa_gpu_bi_giu_luc_post_thi_cho_khong_mo_session(env):
    env.holder = "pid=1 label=xla"
    r = env.post()
    assert r.status_code == 202 and r.json()["state"] == "queued"
    body = env.wait(lambda b: b["state"] == "paused")
    assert "pid=1 label=xla" in body["reason"] and env.job.opens == 0
    env.holder = None
    env.wait(lambda b: b["state"] == "done")


def test_doc_ban_ghi_khoa_gpu_cua_xla(tmp_path):
    p = tmp_path / "gpu.lock"
    assert read_gpu_holder(p) is None  # chưa có file
    p.write_bytes(b"free (l\xe1\xba\xa7n cu\xe1\xbb\x91i: pid=4560 label=v2)".ljust(511) + b"\n")
    assert read_gpu_holder(p) is None
    p.write_bytes(b"pid=99 label=phase11 since=2026-11-26T02:00:00 cmd=x".ljust(511) + b"\n")
    assert read_gpu_holder(p).startswith("pid=99 label=phase11")


# -- mã lỗi POST (§13) ------------------------------------------------------------------------
def test_409_armed_va_link_recent(env):
    env.state.armed = True
    r = env.post()
    assert r.status_code == 409 and r.json()["error"] == "armed"
    env.state.armed = False
    env.state.last_update = time.monotonic() - 30.0
    r = env.post()
    assert r.status_code == 409 and r.json()["error"] == "link_recent"
    assert "30 s" in r.json()["reason"]
    # Mất liên kết lâu hơn FLIGHT_AI_LINK_GRACE_S: không còn bị chặn.
    env.state.last_update = time.monotonic() - 400.0
    assert env.post().status_code == 202
    env.wait(lambda b: b["state"] == "done")


def test_409_busy_mot_job_mot_luc(env):
    gate = threading.Event()
    env.hook = lambda runs: gate.wait(10)
    assert env.post().status_code == 202
    r = env.post(REC2)
    assert r.status_code == 409 and r.json() == {"error": "busy", "rec": REC}
    again = env.post()  # cùng lần ghi: trả trạng thái job đang chạy, không mở job thứ hai
    assert again.status_code == 202 and again.json()["state"] == "running"
    env.hook = None
    gate.set()
    env.wait(lambda b: b["state"] == "done")
    assert env.post(REC2).status_code == 202  # job trước xong thì nhận lần ghi khác
    env.wait(lambda b: b["state"] == "done", rec=REC2)


def test_503_khi_thieu_bundle_hoac_khong_co_vision(env):
    env.vision.enhancer_offline = None
    env.vision.enhancer_offline_status = VisionModelStatus(
        state="disabled", reason="ENHANCER_OFFLINE_ONNX chưa đặt (tắt)"
    )
    r = env.post()
    assert r.status_code == 503
    assert r.json() == {
        "error": "enhancer_offline_unavailable",
        "reason": "ENHANCER_OFFLINE_ONNX chưa đặt (tắt)",
    }
    assert env.get()["reason"] == "ENHANCER_OFFLINE_ONNX chưa đặt (tắt)"
    assert env.frame(0).status_code == 404


def test_503_khi_khong_co_khoi_vision(tmp_path, monkeypatch):
    e = Env(tmp_path, monkeypatch)
    e.vision = None
    try:
        r = e.post()
        assert r.status_code == 503 and "vision" in r.json()["reason"]
    finally:
        e.teardown()


def test_503_khi_mo_session_loi(tmp_path, monkeypatch):
    def broken(_bundle):
        raise BundleRejected("onnxruntime không mở được graph: hỏng")

    e = Env(tmp_path, monkeypatch, open_session=broken)
    try:
        r = e.post()
        assert r.status_code == 503
        assert r.json() == {
            "error": "enhancer_offline_unavailable",
            "reason": "onnxruntime không mở được graph: hỏng",
        }
        assert e.get()["state"] == "none"  # không để lại job treo
    finally:
        e.teardown()


def test_507_khi_o_day_va_failed_khi_day_giua_job(env):
    env.free = 1200.0
    r = env.post()
    assert r.status_code == 507 and r.json() == {"error": "disk_full", "free_mb": 1200.0}

    env.free = 50_000.0

    def fill(runs):
        if runs == 3:
            env.free = 10.0

    env.hook = fill
    assert env.post().status_code == 202
    body = env.wait(lambda b: b["state"] == "failed")
    assert body["done"] == 3 and body["reason"].startswith("disk_full")
    assert not env.job.session_open
    env.free = 50_000.0
    env.hook = None
    assert env.post().status_code == 202  # job failed không chặn lần thử lại; chạy tiếp từ 3
    env.wait(lambda b: b["state"] == "done")
    assert env.sessions[-1].runs == 2  # khung 3 và 5 (khung 4 hỏng)


# -- sha đổi → làm lại; chạy tiếp từ done sau khi backend dừng ---------------------------------
def test_sha_khac_thi_dung_lai_tu_dau(env):
    out = env.cache / REC / "enhancer-offline-v0.0.1"
    out.mkdir(parents=True)
    (out / "000000.jpg").write_bytes(_jpeg(255))
    old = {
        "bundle_version": "0.0.1",
        "onnx_sha256": "0" * 64,
        "total": 6,
        "done": 6,
        "jpeg_quality": 92,
        "started": "2026-11-25T00:00:00+07:00",
        "finished": "2026-11-25T00:01:00+07:00",
        "wall_s": 1.0,
    }
    (out / "manifest.json").write_text(json.dumps(old), encoding="utf-8")
    # Cache của bundle cũ không được phục vụ.
    assert env.frame(0).status_code == 404 and env.get()["state"] == "none"
    assert env.post().json()["done"] == 0
    env.wait(lambda b: b["state"] == "done")
    assert env.manifest()["onnx_sha256"] == env.sha
    _check_frames(env)  # khung 0 là ảnh mới, không phải ảnh trắng cũ


def test_backend_dung_giua_chung_roi_post_chay_tiep(env):
    gate = threading.Event()

    def hold(runs):
        if runs == 3:
            gate.wait(10)

    env.hook = hold
    assert env.post().status_code == 202
    env.wait(lambda b: b["done"] >= 2)
    threading.Timer(0.05, gate.set).start()
    env.job.stop()  # backend tắt: khung đang chạy xong rồi ghi manifest
    m = env.manifest()
    assert m["done"] == 3 and m["finished"] is None
    # Backend mới (job mới): GET đọc manifest dựng dở, POST chạy tiếp từ done.
    env.hook = None
    fresh = OfflineEnhanceJob(
        RecordingCache(env.rec_root),
        vision=lambda: env.vision,
        telemetry=lambda: env.state,
        open_session=env._open,
        cache_dir=env.cache,
        gpu_holder=lambda: None,
        free_mb=lambda _p: 50_000.0,
        poll_s=0.01,
    )
    try:
        st = fresh.status(REC)
        assert (st.state, st.done, st.total) == ("none", 3, 6)
        assert fresh.start(REC).done == 3
        end = time.monotonic() + 20
        while fresh.status(REC).state != "done":
            assert time.monotonic() < end
            time.sleep(0.01)
        assert env.sessions[-1].runs == 2
    finally:
        fresh.stop()


# -- /api/flights/ai: hộp sau verifier ---------------------------------------------------------
def test_ai_tra_hop_sau_verifier(env):
    det = PersonDetector(load_bundle(*make_bundle(env.tmp / "m", "detector"), "detector", CPU))
    ver = BoxVerifier(load_bundle(*make_bundle(env.tmp / "m", "verifier"), "verifier", CPU))
    env.vision.detector, env.vision.detector_status = det, LOADED
    env.vision.verifier, env.vision.verifier_status = ver, LOADED
    body = env.c.get("/api/flights/ai", params={"rec": REC, "n": 0}).json()
    # Detector giả ra hai hộp (0,9 và 0,8, đều qua ngưỡng 0,5); verifier giả 1 − x1/640 loại
    # hộp phải (0,22) ở ngưỡng 0,5 — đúng như luồng trực tiếp (test_vision_v2).
    assert [[b["x1"], b["y1"], b["x2"], b["y2"]] for b in body["boxes"]] == [DET_BOXES[0]]
    assert body["verifier"]["state"] == "loaded" and body["verifier_ms"] is not None
    # Không có verifier: hộp detector nguyên vẹn, trạng thái verifier `disabled`.
    env.vision.verifier = None
    env.vision.verifier_status = VisionModelStatus(state="disabled", reason="VERIFIER_ONNX tắt")
    body = env.c.get("/api/flights/ai", params={"rec": REC, "n": 1}).json()
    assert len(body["boxes"]) == 2 and body["verifier"]["state"] == "disabled"
    assert body["verifier_ms"] is None
