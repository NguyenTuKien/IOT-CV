"""AI trên khung đã ghi (trang Lịch sử bay).

Hai đường: `/api/flights/ai` và `/api/flights/frame?variant=enhanced`. Model là bundle giả của
`test_vision_ai` (detector trả hai hộp hằng, enhancer đảo ảnh 255 − x), chạy CPU; lần ghi là AVI
MJPEG thật do `MjpegAviWriter` ghi.
"""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import config
from backend.api import build_router
from backend.flights.ai import FlightFrameAIService
from backend.flights.video import RecordingCache
from backend.schemas import VisionModelStatus
from backend.tests.test_vision_ai import BOXES, CPU, make_bundle
from backend.vision.avi_writer import MjpegAviWriter
from backend.vision.detector import PersonDetector
from backend.vision.enhancer import Enhancer
from backend.vision.model_bundle import load_bundle

REC = "20261102-100941"
T0 = 1_762_050_000.0
GRAY = 100


def _jpeg(w: int, h: int) -> bytes:
    img = np.full((h, w, 3), GRAY, np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    assert ok
    return buf.tobytes()


def _recording(root: Path, sizes: list[tuple[int, int]]) -> None:
    rec = root / REC
    rec.mkdir(parents=True)
    w = MjpegAviWriter(rec / "video-001.avi", fps=10, width=640, height=480)
    rows = ["segment,video_frame,unix_time,frame_id,width,height"]
    for k, (fw, fh) in enumerate(sizes):
        w.write_jpeg(_jpeg(fw, fh), T0 + k * 0.1)
        rows.append(f"1,{k},{T0 + k * 0.1:.3f},{k},{fw},{fh}")
    w.close()
    (rec / "frames.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")


def _vision(tmp_path: Path) -> SimpleNamespace:
    det = load_bundle(*make_bundle(tmp_path, "detector"), "detector", providers=CPU)
    enh = load_bundle(*make_bundle(tmp_path, "enhancer"), "enhancer", providers=CPU)
    loaded = VisionModelStatus(state="loaded", version="0.0.1", providers=CPU)
    return SimpleNamespace(
        detector=PersonDetector(det),
        enhancer=Enhancer(enh),
        detector_status=loaded,
        enhancer_status=loaded,
    )


def _client(tmp_path: Path, monkeypatch, vision, sizes=((640, 480), (320, 240))) -> TestClient:
    rec_root = tmp_path / "recordings"
    _recording(rec_root, list(sizes))
    monkeypatch.setattr(config, "RECORD_DIR", str(rec_root))
    monkeypatch.setattr(config, "FLIGHT_LOGS_DIR", str(tmp_path / "logs"))
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path / "tlog"))
    monkeypatch.setattr(config, "FLIGHT_CACHE_DIR", str(tmp_path / "cache"))
    app = FastAPI()
    app.include_router(build_router(hub=SimpleNamespace(vision=vision)))
    return TestClient(app)


def test_ai_tra_hop_nguoi_tren_khung_goc(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch, _vision(tmp_path))
    r = c.get("/api/flights/ai", params={"rec": REC, "n": 0})
    assert r.status_code == 200
    body = r.json()
    assert (body["width"], body["height"]) == (640, 480)
    assert body["detector"]["state"] == "loaded" and body["enhancer"]["state"] == "loaded"
    # Hai hộp hằng của model giả, chỉ hộp 0,9 qua ngưỡng 0,5 trong meta.
    assert [[b["x1"], b["y1"], b["x2"], b["y2"]] for b in body["boxes"]] == [BOXES[0]]
    assert body["boxes"][0]["label"] == "person"
    assert body["detector_ms"] is not None and body["note"] is None
    # Số đo ảnh: khung xám 100 phẳng; enhancer giả đảo thành ~155, vẫn phẳng.
    assert abs(body["quality_raw"]["brightness"] - GRAY) < 2
    assert abs(body["quality_enhanced"]["brightness"] - (255 - GRAY)) < 2
    assert body["quality_raw"]["contrast"] < 2 and body["enhancer_ms"] is not None


def test_anh_ro_cua_khung_da_ghi(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch, _vision(tmp_path))
    r = c.get("/api/flights/frame", params={"rec": REC, "n": 0, "variant": "enhanced"})
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    out = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
    # Enhancer giả đảo ảnh: xám 100 -> ~155 (JPEG lệch vài mức).
    assert abs(float(out.mean()) - (255 - GRAY)) < 4
    raw = c.get("/api/flights/frame", params={"rec": REC, "n": 0})
    assert raw.status_code == 200 and raw.content != r.content


def test_khung_sai_co_co_ghi_chu_khong_hop(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch, _vision(tmp_path))
    body = c.get("/api/flights/ai", params={"rec": REC, "n": 1}).json()
    assert body["boxes"] == [] and "320×240" in body["note"]
    assert body["quality_raw"] is not None and body["quality_enhanced"] is None
    r = c.get("/api/flights/frame", params={"rec": REC, "n": 1, "variant": "enhanced"})
    assert r.status_code == 503 and "320×240" in r.json()["reason"]


def test_khong_co_vision_van_tra_trang_thai(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch, None)
    body = c.get("/api/flights/ai", params={"rec": REC, "n": 0}).json()
    assert body["boxes"] == [] and body["detector"]["state"] == "disabled"
    assert body["enhancer_ms"] is None and body["quality_enhanced"] is None
    r = c.get("/api/flights/frame", params={"rec": REC, "n": 0, "variant": "enhanced"})
    assert r.status_code == 503 and r.json()["error"] == "enhancer_unavailable"


def test_xin_anh_ro_va_so_do_cung_luc_chi_chay_enhancer_mot_lan(tmp_path):
    root = tmp_path / "recordings"
    _recording(root, [(640, 480)])
    vision = _vision(tmp_path)
    calls: list[int] = []
    gate = threading.Event()
    real = vision.enhancer

    class _Slow:
        def enhance(self, img):
            calls.append(1)
            gate.wait(5)
            return real.enhance(img)

    vision.enhancer = _Slow()
    svc = FlightFrameAIService(RecordingCache(root), lambda: vision)
    with ThreadPoolExecutor(2) as ex:
        jpeg = ex.submit(svc.enhanced_jpeg, REC, 0)
        analysis = ex.submit(svc.analyze, REC, 0)
        time.sleep(0.3)  # một lần đang chạy enhancer, lần kia đã đứng chờ
        gate.set()
        data, body = jpeg.result(10), analysis.result(10)
    assert len(calls) == 1
    assert data and body.enhancer_ms is not None and body.quality_enhanced is not None


def test_tat_hop_nguoi_chi_chay_enhancer(tmp_path, monkeypatch):
    vision = _vision(tmp_path)
    calls: list[int] = []
    real = vision.detector

    class _Counting:
        def detect(self, img):
            calls.append(1)
            return real.detect(img)

    vision.detector = _Counting()
    c = _client(tmp_path, monkeypatch, vision)
    body = c.get("/api/flights/ai", params={"rec": REC, "n": 0, "detect": "false"}).json()
    assert calls == [] and body["boxes"] == [] and body["detector_ms"] is None
    assert body["enhancer_ms"] is not None and body["quality_enhanced"] is not None
    # Bật lại hộp người: kết quả không-detector không được lưu đệm, lần này chạy detector thật.
    body = c.get("/api/flights/ai", params={"rec": REC, "n": 0}).json()
    assert len(calls) == 1 and len(body["boxes"]) == 1


@pytest.mark.parametrize(
    ("path", "params", "code"),
    [
        ("/api/flights/ai", {"rec": REC, "n": 99}, 404),
        ("/api/flights/frame", {"rec": REC, "n": 99, "variant": "enhanced"}, 404),
        ("/api/flights/ai", {"rec": "..", "n": 0}, 422),
        ("/api/flights/frame", {"rec": REC, "n": 0, "variant": "nét"}, 422),
    ],
)
def test_loi_dau_vao(tmp_path, monkeypatch, path, params, code):
    c = _client(tmp_path, monkeypatch, _vision(tmp_path))
    assert c.get(path, params=params).status_code == code
