"""Test khối AI: nạp bundle theo hợp đồng XLA (`docs/hop-dong-model.md` §2–§5, §8), pipeline,
chống spam sự kiện, luồng `variant=enhanced`.

Bundle giả dựng NGAY TRONG test bằng `onnx.helper` đúng hợp đồng — không phụ thuộc repo XLA hay
file model thật, chạy được trên CI Linux (ORT CPU).
"""

from __future__ import annotations

import hashlib
import json

import pytest

np = pytest.importorskip("numpy")
cv2 = pytest.importorskip("cv2")
onnx = pytest.importorskip("onnx")
pytest.importorskip("onnxruntime")

from onnx import TensorProto, helper  # noqa: E402

from backend.events import BUS  # noqa: E402
from backend.schemas import DetectionPayload  # noqa: E402
from backend.vision.detector import PersonDetector  # noqa: E402
from backend.vision.enhancer import Enhancer  # noqa: E402
from backend.vision.events import EventThrottle  # noqa: E402
from backend.vision.model_bundle import BundleRejected, load_bundle  # noqa: E402
from backend.vision.pipeline import VisionPipeline  # noqa: E402
from backend.vision.runtime import VisionRuntime  # noqa: E402
from backend.vision.stream import MjpegFrame  # noqa: E402

CPU = ["CPUExecutionProvider"]
BOXES = [[10.0, 20.0, 110.0, 220.0], [300.0, 100.0, 340.0, 200.0]]
SCORES = [0.9, 0.06]
CONF = 0.5


def _model(kind: str, *, input_name: str = "frame") -> bytes:
    frame = helper.make_tensor_value_info(input_name, TensorProto.UINT8, [480, 640, 3])
    if kind == "detector":
        # Hai hộp hằng, một trên một dưới ngưỡng CONF.
        nodes = [
            helper.make_node(
                "Constant",
                [],
                ["b"],
                value=helper.make_tensor("bv", TensorProto.FLOAT, [2, 4], sum(BOXES, [])),
            ),
            helper.make_node(
                "Constant",
                [],
                ["s"],
                value=helper.make_tensor("sv", TensorProto.FLOAT, [2], SCORES),
            ),
            helper.make_node("Identity", ["b"], ["boxes"]),
            helper.make_node("Identity", ["s"], ["scores"]),
        ]
        outs = [
            helper.make_tensor_value_info("boxes", TensorProto.FLOAT, ["N", 4]),
            helper.make_tensor_value_info("scores", TensorProto.FLOAT, ["N"]),
        ]
    else:
        # "Làm rõ" giả: đảo ảnh (255 - x), đủ để phân biệt với khung gốc.
        nodes = [
            helper.make_node(
                "Constant", [], ["c"], value=helper.make_tensor("cv", TensorProto.UINT8, [], [255])
            ),
            helper.make_node("Sub", ["c", input_name], ["frame_out"]),
        ]
        outs = [helper.make_tensor_value_info("frame_out", TensorProto.UINT8, [480, 640, 3])]
    graph = helper.make_graph(nodes, kind, [frame], outs)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 9
    onnx.checker.check_model(model)
    return model.SerializeToString()


def make_bundle(tmp_path, kind: str = "detector", *, contract: str = "1.0", **kw):
    """Bundle giả đúng hợp đồng §4. Trả (đường dẫn .onnx, sha256)."""
    d = tmp_path / f"{kind}-v0.0.1"
    d.mkdir()
    data = _model(kind, **kw)
    path = d / f"{kind}.onnx"
    path.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    meta = {
        "contract_version": contract,
        "model": kind,
        "version": "0.0.1",
        "onnx_sha256": sha,
        "frame_size": [640, 480],
        "crop_left": 16,
    }
    if kind == "detector":
        meta |= {
            "imgsz": 640,
            "score_floor": 0.05,
            "nms_iou": 0.5,
            "max_det": 100,
            "conf_threshold": CONF,
            "input_variant": "raw",
        }
    (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    return path, sha


def _jpeg(w: int = 640, h: int = 480) -> bytes:
    ok, buf = cv2.imencode(".jpg", np.full((h, w, 3), 100, np.uint8))
    assert ok
    return buf.tobytes()


def _frame(jpeg: bytes, frame_id: int = 7) -> MjpegFrame:
    return MjpegFrame(jpeg, frame_id, 123_456, 12, "VGA", 0.0)


class _Reader:
    def __init__(self):
        self.subs = []

    def subscribe(self, fn):
        self.subs.append(fn)

    def unsubscribe(self, fn):
        if fn in self.subs:
            self.subs.remove(fn)


# -- nạp bundle (§5) -----------------------------------------------------------------------
def test_nap_dung_hop_dong(tmp_path):
    path, sha = make_bundle(tmp_path)
    b = load_bundle(path, sha, "detector", CPU)
    assert b.version == "0.0.1" and b.providers == CPU and b.cpu_only


@pytest.mark.parametrize(
    ("sua", "loi"),
    [
        ({"sha": "0" * 64}, "sha256 lệch"),
        ({"sha": ""}, "DETECTOR_SHA256 chưa đặt"),
        ({"contract": "2.0"}, "major 2"),
        ({"input_name": "images"}, "tên 'images'"),
    ],
)
def test_bundle_sai_bi_tu_choi(tmp_path, sua, loi):
    path, sha = make_bundle(
        tmp_path,
        contract=sua.get("contract", "1.0"),
        input_name=sua.get("input_name", "frame"),
    )
    with pytest.raises(BundleRejected, match=loi):
        load_bundle(path, sua.get("sha", sha), "detector", CPU)


def test_thieu_file_bi_tu_choi(tmp_path):
    with pytest.raises(BundleRejected, match="không thấy file"):
        load_bundle(tmp_path / "khong-co.onnx", "a" * 64, "detector", CPU)


def test_detector_loc_nguong_va_khung_sai_co(tmp_path):
    path, sha = make_bundle(tmp_path)
    det = PersonDetector(load_bundle(path, sha, "detector", CPU))
    assert det.confidence == CONF  # lấy từ meta.json khi DETECTION_CONFIDENCE rỗng
    dets = det.detect(np.zeros((480, 640, 3), np.uint8))
    assert [(d.x1, d.y2, d.confidence) for d in dets] == [(10.0, 220.0, pytest.approx(0.9))]
    assert det.detect(np.zeros((240, 320, 3), np.uint8)) == []


# -- pipeline ------------------------------------------------------------------------------
def _pipeline(tmp_path, *, enhancer=False, **kw):
    path, sha = make_bundle(tmp_path)
    det = PersonDetector(load_bundle(path, sha, "detector", CPU))
    enh = None
    if enhancer:
        epath, esha = make_bundle(tmp_path, "enhancer")
        enh = Enhancer(load_bundle(epath, esha, "enhancer", CPU))
    return VisionPipeline(_Reader(), det, enh, **kw)


def test_pipeline_gui_detection_dung_schema(tmp_path):
    pipe = _pipeline(tmp_path)
    payload = pipe.process(_frame(_jpeg()))
    assert isinstance(payload, DetectionPayload)
    again = DetectionPayload.model_validate(payload.model_dump())
    assert (again.frame_id, again.frame_ts, again.width, again.height) == (7, 123.456, 640, 480)
    assert [b.label for b in again.boxes] == ["person"]
    assert pipe.latest_detection() is payload
    assert "detector" in pipe.stats()["ms"]


def test_khung_320x240_khong_box_khong_ngoai_le(tmp_path):
    pipe = _pipeline(tmp_path)
    assert pipe.process(_frame(_jpeg(320, 240))) is None
    assert pipe.latest_detection() is None


def test_enhancer_chi_chay_khi_co_nguoi_xem(tmp_path):
    pipe = _pipeline(tmp_path, enhancer=True)
    pipe.process(_frame(_jpeg()))
    assert pipe.enhanced_view.latest() is None  # chưa ai xem enhanced
    pipe.acquire_enhanced()
    pipe.process(_frame(_jpeg()))
    out = pipe.enhanced_view.latest()
    assert out is not None and out.frame_id == 7
    img = cv2.imdecode(np.frombuffer(out.jpeg, np.uint8), cv2.IMREAD_COLOR)
    assert img.shape == (480, 640, 3) and abs(float(img.mean()) - 155) < 3  # 255 - 100
    pipe.release_enhanced()
    assert pipe.enhanced_view.latest() is None and pipe.enhanced_clients == 0


def test_pipeline_bo_khung_cu_khong_xep_hang(tmp_path):
    pipe = _pipeline(tmp_path)
    for i in range(3):
        pipe._on_frame(_frame(_jpeg(), i))  # thread chưa chạy: chỉ khung cuối được giữ
    assert pipe.frames_dropped == 2 and pipe._pending.frame_id == 2


def test_pipeline_phat_su_kien_nguoi_sau_du_khung(tmp_path):
    seen = []
    pipe = _pipeline(tmp_path, on_person=seen.append, clock=lambda: 1000.0)
    for _ in range(3):
        pipe.process(_frame(_jpeg()))
    assert seen == [pytest.approx(0.9)]


# -- chống spam (GIAI ĐOẠN 75) ---------------------------------------------------------------
def test_should_emit_du_ca():
    # Từ 25/11/2026 nhận HỘP, chạy qua TrackFilter (hợp đồng XLA §10). Không recommended_track:
    # k = n = 3, cooldown toàn cục; iou/max_gap ghi rõ để test không phụ thuộc env.
    from backend.vision.track_filter import TrackBox, TrackParams

    def hop(score: float = 0.9) -> list[TrackBox]:
        return [TrackBox(10.0, 20.0, 110.0, 220.0, score)]

    t = EventThrottle(cooldown_s=4.0, confidence_threshold=0.5, track=TrackParams(3, 3, 0.3, 1))
    assert [t.should_emit(hop(), 0.0), t.should_emit(hop(), 0.1)] == [False, False]
    assert t.should_emit(hop(), 0.2) is True  # đủ 3 khung cùng một track
    assert t.should_emit(hop(), 1.0) is False  # trong cooldown
    assert t.should_emit(hop(0.4), 4.5) is False  # dưới ngưỡng = track hụt 1 khung (≤ max_gap)
    # Khác cũ (§10 (c)): track đã xác nhận còn sống, hết cooldown là phát ngay (cũ chờ tới 4.8).
    assert t.should_emit(hop(), 4.6) is True
    assert t.should_emit(hop(0.5), 9.0) is True  # đúng ngưỡng tính là trên ngưỡng (>=)
    assert t.should_emit([], 9.1) is False  # khung không hộp


def test_should_emit_can_nguong():
    with pytest.raises(ValueError, match="ngưỡng"):
        EventThrottle(confidence_threshold=None)


# -- backend vẫn sống khi model bị từ chối; luồng enhanced -------------------------------------
def _rejecting():
    raise BundleRejected("sha256 lệch: thử")


def test_model_bi_tu_choi_backend_van_song(monkeypatch):
    from fastapi.testclient import TestClient

    from backend import app as app_mod

    rt = VisionRuntime(_Reader(), load_detector=_rejecting, load_enhancer=_rejecting)
    rt.load()
    assert rt.pipeline is None
    ev = [e for e in BUS.recent() if e.code == "vision.model_rejected"]
    assert {e.detail["model"] for e in ev} == {"detector", "enhancer"}
    monkeypatch.setattr(app_mod.HUB, "vision", rt)
    client = TestClient(app_mod.app)
    assert client.get("/api/health").status_code == 200
    st = client.get("/api/status").json()["vision"]
    assert st["detector"] == {**st["detector"], "state": "rejected", "reason": "sha256 lệch: thử"}
    r = client.get("/api/video/stream", params={"variant": "enhanced"})
    assert r.status_code == 503
    assert r.json() == {"error": "enhancer_unavailable", "reason": "sha256 lệch: thử"}


def test_variant_sai_bi_422():
    from fastapi.testclient import TestClient

    from backend import app as app_mod

    assert TestClient(app_mod.app).get("/api/video/stream?variant=xyz").status_code == 422
