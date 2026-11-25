"""Test hợp đồng XLA v1.1 phía IOT-CV (`D:/XLA/docs/hop-dong-model.md` §9–§14.1): nạp verifier và
enhancer-offline, lọc track k/n + sự kiện (§10, ba khác biệt (a)–(c) so với bộ đếm cũ), pipeline
detector → verifier → track, trạng thái `status.vision` mới, `scripts/vision/replay_pred.py`.

Bundle giả dựng ngay trong test bằng `onnx.helper`, cùng dạng bundle giả của XLA
(`xla/contract.py` `make_dummy_bundle`: meta 1.1 đủ khoá, golden 3 khung) — không import `xla`,
không cần GPU (ORT CPU).
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
cv2 = pytest.importorskip("cv2")
onnx = pytest.importorskip("onnx")
pytest.importorskip("onnxruntime")

from onnx import TensorProto, helper  # noqa: E402

from backend import config  # noqa: E402
from backend.events import EventBus  # noqa: E402
from backend.schemas import DetectionPayload, VisionModelStatus, VisionStatus  # noqa: E402
from backend.vision.avi_writer import MjpegAviWriter  # noqa: E402
from backend.vision.detector import PersonDetector  # noqa: E402
from backend.vision.events import EventThrottle  # noqa: E402
from backend.vision.model_bundle import BundleRejected, load_bundle  # noqa: E402
from backend.vision.pipeline import VisionPipeline  # noqa: E402
from backend.vision.runtime import VisionRuntime, load_enhancer_offline_from_config  # noqa: E402
from backend.vision.stream import MjpegFrame  # noqa: E402
from backend.vision.track_filter import (  # noqa: E402
    TrackBox,
    TrackFilter,
    TrackParams,
    resolve_track,
)
from backend.vision.verifier import BoxVerifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CPU = ["CPUExecutionProvider"]
F32, U8, I64 = TensorProto.FLOAT, TensorProto.UINT8, TensorProto.INT64
# Detector giả: hai hộp hằng, cả hai ≥ ngưỡng detector 0,5. Verifier giả: điểm = 1 − x1/640, nên
# hộp trái (x1 = 10) qua (0,984), hộp phải (x1 = 500) bị loại (0,219) ở ngưỡng verifier 0,5.
DET_BOXES = [[10.0, 20.0, 110.0, 220.0], [500.0, 100.0, 600.0, 200.0]]
DET_SCORES = [0.9, 0.8]
DET_CONF = 0.5
VER_CONF = 0.5
TRACK_FALLBACK = TrackParams(3, 3, 0.3, 1)


def _vscore(x1: float) -> float:
    return 1.0 - x1 / 640.0


def _const(name: str, dtype: int, dims: list[int], vals: list) -> object:
    return helper.make_node(
        "Constant", [], [name], value=helper.make_tensor(name + "_v", dtype, dims, vals)
    )


def _finish(nodes, name, inputs, outputs) -> bytes:
    model = helper.make_model(
        helper.make_graph(nodes, name, inputs, outputs), opset_imports=[helper.make_opsetid("", 17)]
    )
    model.ir_version = 8
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _frame_in(name: str = "frame"):
    return helper.make_tensor_value_info(name, U8, [480, 640, 3])


def _dep(src: str = "frame") -> list:
    """`dep` = 0 · max(src): output phụ thuộc input như bundle giả của XLA."""
    return [
        helper.make_node("Cast", [src], ["f"], to=F32),
        helper.make_node("ReduceMax", ["f"], ["fmax"], keepdims=0),
        _const("zero", F32, [], [0.0]),
        helper.make_node("Mul", ["fmax", "zero"], ["dep"]),
    ]


def detector_graph(boxes=DET_BOXES, scores=DET_SCORES) -> bytes:
    nodes = [
        *_dep(),
        _const("b0", F32, [len(boxes), 4], sum(boxes, [])),
        _const("s0", F32, [len(scores)], scores),
        helper.make_node("Add", ["b0", "dep"], ["boxes"]),
        helper.make_node("Add", ["s0", "dep"], ["scores"]),
    ]
    outs = [
        helper.make_tensor_value_info("boxes", F32, ["N", 4]),
        helper.make_tensor_value_info("scores", F32, ["N"]),
    ]
    return _finish(nodes, "det", [_frame_in()], outs)


def verifier_graph(*, with_boxes: bool = True, fixed_scores: list[float] | None = None) -> bytes:
    """`scores` = 1 − x1/640 (+ 0 · max(frame)). `fixed_scores`: ra hằng số (sai shape khi chạy
    thử)."""
    inputs = [_frame_in()]
    if with_boxes:
        inputs.append(helper.make_tensor_value_info("boxes", F32, ["N", 4]))
    if fixed_scores is not None or not with_boxes:
        vals = fixed_scores if fixed_scores is not None else [0.5]
        nodes = [
            *_dep(),
            _const("s0", F32, [len(vals)], vals),
            helper.make_node("Add", ["s0", "dep"], ["scores"]),
        ]
    else:
        nodes = [
            *_dep(),
            _const("st", I64, [1], [0]),
            _const("en", I64, [1], [1]),
            _const("ax", I64, [1], [1]),
            helper.make_node("Slice", ["boxes", "st", "en", "ax"], ["x1c"]),
            _const("flat", I64, [1], [-1]),
            helper.make_node("Reshape", ["x1c", "flat"], ["x1"]),
            _const("w", F32, [], [640.0]),
            _const("one", F32, [], [1.0]),
            helper.make_node("Div", ["x1", "w"], ["r"]),
            helper.make_node("Sub", ["one", "r"], ["s1"]),
            helper.make_node("Add", ["s1", "dep"], ["scores"]),
        ]
    outs = [helper.make_tensor_value_info("scores", F32, ["N"])]
    return _finish(nodes, "ver", inputs, outs)


def offline_graph(temporal_window: int = 1) -> bytes:
    """Nearest ×2 như bundle giả offline của XLA; T > 1 nhận `frames` và lấy khung giữa."""
    if temporal_window == 1:
        inputs, src, pre = [_frame_in()], "frame", []
    else:
        inputs = [helper.make_tensor_value_info("frames", U8, [temporal_window, 480, 640, 3])]
        src = "mid"
        pre = [
            _const("ti", I64, [], [temporal_window // 2]),
            helper.make_node("Gather", ["frames", "ti"], ["mid"], axis=0),
        ]
    nodes = [
        *pre,
        _const("scales", F32, [3], [2.0, 2.0, 1.0]),
        helper.make_node(
            "Resize",
            [src, "", "scales"],
            ["frame_out"],
            mode="nearest",
            coordinate_transformation_mode="asymmetric",
            nearest_mode="floor",
        ),
    ]
    outs = [helper.make_tensor_value_info("frame_out", U8, [960, 1280, 3])]
    return _finish(nodes, "off", inputs, outs)


def _meta(kind: str, contract: str) -> dict:
    meta = {
        "contract_version": contract,
        "model": kind,
        "version": "0.0.1",
        "frame_size": [640, 480],
        "crop_left": 16,
        "camera_profile_version": "0.0.0",
        "train_run": "dummy",
        "created": "2026-11-25T00:00:00+00:00",
    }
    if kind == "detector":
        meta |= {
            "imgsz": 640,
            "score_floor": 0.05,
            "nms_iou": 0.7,
            "max_det": 100,
            "conf_threshold": DET_CONF,
            "input_variant": "raw",
        }
    elif kind == "verifier":
        meta |= {
            "crop_px": 64,
            "context_scale": 1.5,
            "min_side_px": 32,
            "conf_threshold": VER_CONF,
            "input_variant": "raw",
            "backbone": "dummy",
        }
    elif kind == "enhancer-offline":
        meta |= {
            "scale": 2,
            "output_size": [1280, 960],
            "temporal_window": 1,
            "network": "dummy-nearest-x2",
            "fp16": False,
            "peak_vram_mb": 0.0,
            "s_per_frame": 0.0,
            "machine": "none (bundle giả)",
        }
    return meta


_GRAPHS = {
    "detector": detector_graph,
    "verifier": verifier_graph,
    "enhancer-offline": offline_graph,
}


def make_bundle(
    tmp_path: Path, kind: str, *, contract: str = "1.1", data: bytes | None = None, **meta_kw
):
    """Bundle giả ở `tmp_path/<kind>-v0.0.1/`; `meta_kw` ghi đè khoá meta. Trả (.onnx, sha256)."""
    d = tmp_path / f"{kind}-v0.0.1"
    d.mkdir(parents=True, exist_ok=True)
    data = data if data is not None else _GRAPHS[kind]()
    path = d / f"{kind}.onnx"
    path.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    meta = _meta(kind, contract) | {"onnx_sha256": sha} | meta_kw
    (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    return path, sha


ZERO = np.zeros((480, 640, 3), np.uint8)


# -- §9 verifier: nạp / từ chối --------------------------------------------------------------
def test_verifier_nap_dung_hop_dong(tmp_path):
    b = load_bundle(*make_bundle(tmp_path, "verifier"), "verifier", CPU)
    assert (b.state, b.version, b.providers) == ("loaded", "0.0.1", CPU)
    ver = BoxVerifier(b)
    assert ver.confidence == VER_CONF  # từ meta.json khi VERIFIER_CONFIDENCE rỗng
    scores = ver.verify(ZERO, np.asarray(DET_BOXES, np.float32))
    assert scores.tolist() == pytest.approx([_vscore(10.0), _vscore(500.0)])
    assert BoxVerifier(b, confidence=0.9).confidence == 0.9  # env/đối số ghi đè meta
    assert ver.verify(np.zeros((240, 320, 3), np.uint8), np.zeros((1, 4))) is None


@pytest.mark.parametrize(
    ("sua", "loi"),
    [
        ({"contract": "1.0"}, "kind verifier có từ 1.1"),
        ({"contract": "2.1"}, "major 2"),
        ({"sha": ""}, "VERIFIER_SHA256 chưa đặt"),
        ({"sha": "0" * 64}, "sha256 lệch"),
        ({"data": "no_boxes"}, "có 1 input, hợp đồng cần 2"),
        ({"data": "fixed2"}, "chạy thử 1 hộp ra scores shape \\[2\\]"),
        ({"meta": {"input_variant": "enhanced"}}, "cần 'raw'"),
        ({"meta": {"conf_threshold": "cao"}}, "conf_threshold thiếu"),
        ({"meta": {"model": "detector"}}, "meta.model = 'detector'"),
    ],
)
def test_verifier_bi_tu_choi_dung_ly_do(tmp_path, sua, loi):
    data = {
        "no_boxes": verifier_graph(with_boxes=False),
        "fixed2": verifier_graph(fixed_scores=[0.5, 0.5]),
    }.get(sua.get("data"))
    path, sha = make_bundle(
        tmp_path, "verifier", contract=sua.get("contract", "1.1"), data=data, **sua.get("meta", {})
    )
    with pytest.raises(BundleRejected, match=loi):
        load_bundle(path, sua.get("sha", sha), "verifier", CPU)


def test_verifier_n0_khong_goi_session(tmp_path):
    ver = BoxVerifier(load_bundle(*make_bundle(tmp_path, "verifier"), "verifier", CPU))
    real = ver.bundle.session
    calls = []

    class _Counting:
        def run(self, names, feeds):
            calls.append(feeds["boxes"].shape)
            return real.run(names, feeds)

    ver.bundle.session = _Counting()
    out = ver.verify(ZERO, np.zeros((0, 4), np.float32))
    assert out.shape == (0,) and out.dtype == np.float32 and calls == []
    ver.verify(ZERO, [[100.0, 100.0, 140.0, 180.0]])
    assert calls == [(1, 4)]


def test_verifier_from_config_rong_la_tat(monkeypatch):
    monkeypatch.setattr(config, "VERIFIER_ONNX", "")
    assert BoxVerifier.from_config() is None


# -- §11 enhancer-offline: kiểm rồi đóng session → ready ---------------------------------------
def test_enhancer_offline_ready_khong_giu_session(tmp_path):
    path, sha = make_bundle(tmp_path, "enhancer-offline")
    b = load_bundle(path, sha, "enhancer-offline")  # mặc định: session CPU mở rồi đóng
    assert (b.state, b.session, b.providers, b.cpu_only) == ("ready", None, [], False)
    kept = load_bundle(path, sha, "enhancer-offline", CPU, keep_session=True)
    assert kept.state == "loaded"
    (out,) = kept.session.run(["frame_out"], {"frame": ZERO})
    assert out.shape == (960, 1280, 3)


def test_enhancer_offline_video_nhan_frames(tmp_path):
    path, sha = make_bundle(tmp_path, "enhancer-offline", data=offline_graph(3), temporal_window=3)
    assert load_bundle(path, sha, "enhancer-offline").state == "ready"


@pytest.mark.parametrize(
    ("sua", "loi"),
    [
        ({"sha": ""}, "ENHANCER_OFFLINE_SHA256 chưa đặt"),
        ({"contract": "1.0"}, "kind enhancer-offline có từ 1.1"),
        ({"meta": {"temporal_window": 2}}, "temporal_window = 2"),
        ({"meta": {"scale": 4}}, "meta.scale = 4"),
        ({"meta": {"output_size": [640, 480]}}, "output_size"),
        ({"meta": {"temporal_window": 3}}, "input tên 'frame', hợp đồng cần 'frames'"),
    ],
)
def test_enhancer_offline_bi_tu_choi(tmp_path, sua, loi):
    path, sha = make_bundle(
        tmp_path, "enhancer-offline", contract=sua.get("contract", "1.1"), **sua.get("meta", {})
    )
    with pytest.raises(BundleRejected, match=loi):
        load_bundle(path, sua.get("sha", sha), "enhancer-offline")


@pytest.mark.parametrize(
    ("track", "loi"),
    [
        ({"k": 4, "n": 3, "iou": 0.3, "max_gap": 1}, "k=4 > n=3"),
        ({"k": 2, "n": 3, "iou": 0.0, "max_gap": 1}, "iou"),
        ({"k": 2, "n": 3, "iou": 0.3}, "thiếu max_gap"),
        ({"k": 2.5, "n": 3, "iou": 0.3, "max_gap": 1}, "k phải là số nguyên"),
    ],
)
def test_recommended_track_sai_tu_choi_detector(tmp_path, track, loi):
    path, sha = make_bundle(tmp_path, "detector", recommended_track=track)
    with pytest.raises(BundleRejected, match=loi):
        load_bundle(path, sha, "detector", CPU)


def test_bundle_v10_van_nap(tmp_path):
    """D1: detector contract 1.0 (không `recommended_track`) vẫn nạp; bundle 1.1 cũng nạp."""
    for contract in ("1.0", "1.1"):
        sub = tmp_path / contract
        assert load_bundle(*make_bundle(sub, "detector", contract=contract), "detector", CPU)


# -- §10 lọc track k/n ---------------------------------------------------------------------------
def _b(x: float = 10.0, score: float = 0.9, v: float | None = None) -> TrackBox:
    return TrackBox(x, 20.0, x + 100.0, 220.0, score, v)


def _old_counter(frames: list[list[float]], times: list[float], min_frames=3, cooldown=4.0):
    """Bộ đếm cũ (trước 25/11/2026, `EventThrottle.should_emit(confidence, now)`), giữ làm mốc so
    sánh: đếm khung liên tiếp có điểm cao nhất ≥ 0,5, đủ `min_frames` thì phát, rồi cooldown."""
    count, last, out = 0, None, []
    for confs, now in zip(frames, times, strict=True):
        if max(confs, default=0.0) < 0.5:
            count = 0
            out.append(False)
            continue
        count += 1
        ok = count >= min_frames and (last is None or now - last >= cooldown)
        last = now if ok else last
        out.append(ok)
    return out


def _run(tf: TrackFilter, frames: list[list[TrackBox]], dt: float = 0.5):
    return [tf.update(boxes, i * dt) for i, boxes in enumerate(frames)]


def _fallback(**kw) -> TrackFilter:
    return TrackFilter(TRACK_FALLBACK, cooldown_s=4.0, per_track_cooldown=False, **kw)


def test_track_nhap_nhay_khong_phat():
    # Trúng một khung, hụt một khung: không bao giờ đủ 3/3. Hộp lẻ mỗi khung một chỗ: cũng không.
    flicker = [[_b()] if i % 2 == 0 else [] for i in range(12)]
    assert not any(r.events for r in _run(_fallback(), flicker))
    scatter = [[_b(x=(120.0 * i) % 540)] for i in range(10)]  # hộp 100 px, dịch 120: IoU 0
    res = _run(_fallback(), scatter)
    assert not any(r.events or r.confirmed for r in res)


def test_track_on_dinh_phat_mot_lan_roi_cooldown():
    res = _run(_fallback(), [[_b()] for _ in range(12)])  # 0,5 s/khung, 6 s liền
    fired = [i for i, r in enumerate(res) if r.events]
    assert fired == [2, 10]  # đủ 3 khung (t = 1,0 s), hết cooldown 4 s (t = 5,0 s)
    ev = res[2].events[0]
    assert (ev.track_id, ev.hits, ev.window, ev.verifier_score) == (1, 3, 3, None)
    assert ev.confidence == pytest.approx(0.9)
    assert [len(r.confirmed) for r in res[:4]] == [0, 0, 1, 1]  # hộp của track đã xác nhận


def test_track_cooldown_toan_cuc_khi_khong_recommended_track():
    """Không `recommended_track`: hai người đứng yên cùng lúc → mỗi cooldown đúng MỘT sự kiện,
    của track có điểm detector cao hơn."""
    th = EventThrottle(cooldown_s=4.0, confidence_threshold=0.5, meta={})
    assert th.filter.per_track_cooldown is False
    events = [th.update([_b(10.0, 0.7), _b(400.0, 0.95)], i * 0.5) for i in range(12)]
    fired = [(i, e.track_id, e.confidence) for i, evs in enumerate(events) for e in evs]
    assert fired == [(2, 2, pytest.approx(0.95)), (10, 2, pytest.approx(0.95))]


def test_track_cooldown_theo_track_khi_co_recommended_track(monkeypatch):
    for key in ("K", "N", "IOU", "MAX_GAP"):
        monkeypatch.setattr(config, f"DETECTION_TRACK_{key}", None)
    meta = {"recommended_track": {"k": 2, "n": 4, "iou": 0.5, "max_gap": 2}}
    th = EventThrottle(cooldown_s=4.0, confidence_threshold=0.5, meta=meta)
    assert th.filter.per_track_cooldown is True
    assert th.params == TrackParams(2, 4, 0.5, 2)
    events = [th.update([_b(10.0, 0.7), _b(400.0, 0.95)], i * 0.5) for i in range(4)]
    assert [sorted(e.track_id for e in evs) for evs in events] == [[], [1, 2], [], []]
    # env ghi đè meta, cooldown vẫn theo track (có recommended_track).
    monkeypatch.setattr(config, "DETECTION_TRACK_K", 4)
    params, per_track = resolve_track(meta)
    assert (params, per_track) == (TrackParams(4, 4, 0.5, 2), True)
    # Không meta, không env: k = n = DETECTION_MIN_FRAMES, iou/max_gap mặc định.
    monkeypatch.setattr(config, "DETECTION_TRACK_K", None)
    params, per_track = resolve_track({})
    assert per_track is False
    assert (params.k, params.n) == (config.DETECTION_MIN_FRAMES, config.DETECTION_MIN_FRAMES)
    monkeypatch.setattr(config, "DETECTION_TRACK_K", 9)
    with pytest.raises(ValueError, match="k=9 > n=4"):
        resolve_track(meta)


def test_khac_biet_a_hop_nhay_cho():
    """(a) Hộp nhảy chỗ (IoU < iou giữa hai khung): cũ vẫn đếm liên tiếp và phát ở khung 3; mới
    là ba track khác nhau, không track nào đủ 3/3 → không phát."""
    xs = [10.0, 250.0, 490.0]
    assert _old_counter([[0.9]] * 3, [0.0, 0.5, 1.0]) == [False, False, True]
    res = _run(_fallback(), [[_b(x)] for x in xs])
    assert not any(r.events for r in res)
    # Dịch ít (IoU ≥ 0,3) vẫn là một track → phát ở khung 3 như cũ.
    res = _run(_fallback(), [[_b(10.0 + 20.0 * i)] for i in range(3)])
    assert [bool(r.events) for r in res] == [False, False, True]


def test_khac_biet_b_hai_nguoi():
    """(b) Hai người: A ở khung 0–1, B ở khung 1–2. Cũ đếm chung (khung nào cũng có người) → phát
    ở khung 2; mới đếm riêng từng track (mỗi người 2/3) → không phát."""
    frames = [[_b(10.0)], [_b(10.0), _b(400.0)], [_b(400.0)]]
    assert _old_counter([[0.9], [0.9, 0.9], [0.9]], [0.0, 0.5, 1.0])[-1] is True
    assert not any(r.events for r in _run(_fallback(), frames))


def test_khac_biet_c_track_mat_roi_tao_lai():
    """(c) Hụt ≤ max_gap khung: track còn sống và vẫn xác nhận → hết cooldown phát ngay khi người
    quay lại (cũ: khung hụt đặt lại bộ đếm, phải đủ 3 khung mới). Hụt > max_gap: track bị xoá,
    người quay lại là track MỚI (id mới), phải xác nhận lại 3/3."""
    on, off = [_b()], []
    short_gap = [on] * 3 + [on] * 7 + [off] + [on] * 3  # khung 10 hụt; t = 5,5 s quay lại
    res = _run(_fallback(), short_gap)
    assert [i for i, r in enumerate(res) if r.events] == [2, 11]
    assert {e.track_id for r in res for e in r.events} == {1}
    old = _old_counter([[0.9] if b else [] for b in short_gap], [i * 0.5 for i in range(14)])
    assert [i for i, x in enumerate(old) if x] == [2, 13]
    long_gap = [on] * 3 + [off] * 2 + [on] * 3  # hụt 2 > max_gap 1: xoá
    res = _run(TrackFilter(TRACK_FALLBACK, cooldown_s=0.0, per_track_cooldown=True), long_gap)
    fired = [(i, e.track_id, e.hits) for i, r in enumerate(res) for e in r.events]
    assert fired == [(2, 1, 3), (7, 2, 3)]  # track 2 xác nhận lại ở khung thứ 3 sau khi quay lại
    assert [len(r.confirmed) for r in res[5:]] == [0, 0, 1]


def test_track_reset_xoa_track_va_cooldown():
    tf = _fallback()
    _run(tf, [[_b()]] * 3)
    assert tf.tracks == 1
    tf.reset()
    assert tf.tracks == 0
    res = _run(tf, [[_b()]] * 3)
    assert res[2].events and res[2].events[0].track_id == 2  # id không đặt lại, cooldown có


def test_track_params_sai():
    for bad in ((0, 1, 0.3, 1), (2, 1, 0.3, 1), (1, 1, 1.5, 1), (1, 1, 0.3, -1)):
        with pytest.raises(ValueError):
            TrackParams(*bad)


# -- pipeline: detector → verifier → track; runtime + status ---------------------------------------
class _Reader:
    def subscribe(self, fn):
        pass

    def unsubscribe(self, fn):
        pass


def _jpeg(value: int = 100) -> bytes:
    ok, buf = cv2.imencode(".jpg", np.full((480, 640, 3), value, np.uint8))
    assert ok
    return buf.tobytes()


def _models(tmp_path: Path, **det_meta):
    det = PersonDetector(
        load_bundle(*make_bundle(tmp_path, "detector", **det_meta), "detector", CPU)
    )
    ver = BoxVerifier(load_bundle(*make_bundle(tmp_path, "verifier"), "verifier", CPU))
    return det, ver


def test_pipeline_hop_ws_la_hop_sau_verifier(tmp_path):
    det, ver = _models(tmp_path)
    seen = []
    pipe = VisionPipeline(
        _Reader(), det, None, verifier=ver, on_event=seen.append, clock=lambda: 7.0
    )
    for i in range(3):
        payload = pipe.process(MjpegFrame(_jpeg(), i, 1000 + i, 12, "VGA", 0.0))
    assert isinstance(payload, DetectionPayload)
    again = DetectionPayload.model_validate(payload.model_dump())
    assert set(again.model_dump()) == {"frame_id", "frame_ts", "width", "height", "boxes"}
    assert [(b.x1, b.confidence) for b in again.boxes] == [
        (10.0, pytest.approx(0.9))
    ]  # hộp phải bị loại
    assert {"decode", "detector", "verifier", "total"} <= set(pipe.stats()["ms"])
    assert len(seen) == 1
    ev = seen[0]
    assert (ev.track_id, ev.hits, ev.window) == (1, 3, config.DETECTION_MIN_FRAMES)
    assert ev.verifier_score == pytest.approx(_vscore(10.0))


def test_pipeline_khong_verifier_chay_chi_detector(tmp_path):
    det, _ = _models(tmp_path)
    pipe = VisionPipeline(_Reader(), det, None)
    payload = pipe.process(MjpegFrame(_jpeg(), 1, 1000, 12, "VGA", 0.0))
    assert len(payload.boxes) == 2 and "verifier" not in pipe.stats()["ms"]


def _runtime(tmp_path, bus, **kw):
    det, ver = _models(tmp_path)
    off = load_bundle(*make_bundle(tmp_path, "enhancer-offline"), "enhancer-offline")
    loaders = {
        "load_detector": lambda: det,
        "load_enhancer": lambda: (_ for _ in ()).throw(BundleRejected("thiếu enhancer: thử")),
        "load_verifier": lambda: ver,
        "load_enhancer_offline": lambda: off,
    } | kw
    rt = VisionRuntime(_Reader(), bus=bus, position=lambda: (21.0, 105.8, 12.5), **loaders)
    rt.load()
    return rt


def test_runtime_su_kien_co_track_va_status_moi(tmp_path):
    bus = EventBus()
    rt = _runtime(tmp_path, bus)
    for i in range(3):
        rt.pipeline.process(MjpegFrame(_jpeg(), i, 1000 + i, 12, "VGA", 0.0))
    ev = [e for e in bus.recent() if e.code == "vision.person_detected"]
    assert len(ev) == 1
    assert (ev[0].level, ev[0].source) == ("warn", "vision")
    assert ev[0].message.startswith("Phát hiện người (độ tin 0.90)")
    assert ev[0].detail == {
        "confidence": 0.9,
        "uav_lat": 21.0,
        "uav_lon": 105.8,
        "uav_alt": 12.5,
        "track_id": 1,
        "hits": 3,
        "window": config.DETECTION_MIN_FRAMES,
        "verifier_score": round(_vscore(10.0), 3),
    }
    st = VisionStatus.model_validate(rt.status().model_dump())
    assert (st.detector.state, st.verifier.state, st.enhancer.state) == (
        "loaded",
        "loaded",
        "rejected",
    )
    assert st.enhancer_offline == VisionModelStatus(state="ready", version="0.0.1")
    assert st.enhancer_default_on is config.ENHANCER_DEFAULT_ON
    assert "verifier" in st.ms
    rejected = [e.detail["model"] for e in bus.recent() if e.code == "vision.model_rejected"]
    assert rejected == ["enhancer"]


def test_runtime_verifier_env_rong_la_disabled_khong_su_kien(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "VERIFIER_ONNX", "")
    monkeypatch.setattr(config, "ENHANCER_OFFLINE_ONNX", "")
    bus = EventBus()
    rt = _runtime(
        tmp_path,
        bus,
        load_verifier=BoxVerifier.from_config,
        load_enhancer_offline=load_enhancer_offline_from_config,
    )
    st = rt.status()
    assert (st.verifier.state, st.verifier.reason) == ("disabled", "VERIFIER_ONNX chưa đặt (tắt)")
    assert st.enhancer_offline.state == "disabled"
    assert st.enhancer_offline.reason == config.ENHANCER_OFFLINE_DISABLED_REASON
    assert "A/B" in st.enhancer_offline.reason  # web nói vì sao tắt, không chỉ tên biến env
    assert rt.pipeline is not None and rt.pipeline.verifier is None
    assert [e.detail["model"] for e in bus.recent() if e.code == "vision.model_rejected"] == [
        "enhancer"
    ]


def test_runtime_verifier_bi_tu_choi_van_chay_detector(tmp_path):
    bus = EventBus()
    reject = lambda: (_ for _ in ()).throw(BundleRejected("sha256 lệch: thử"))  # noqa: E731
    rt = _runtime(tmp_path, bus, load_verifier=reject)
    st = rt.status()
    assert (st.verifier.state, st.verifier.reason) == ("rejected", "sha256 lệch: thử")
    assert st.detector.state == "loaded"
    payload = rt.pipeline.process(MjpegFrame(_jpeg(), 1, 1000, 12, "VGA", 0.0))
    assert len(payload.boxes) == 2  # không verifier: hộp detector
    models = {e.detail["model"] for e in bus.recent() if e.code == "vision.model_rejected"}
    assert models == {"enhancer", "verifier"}


def test_runtime_track_env_sai_tu_choi_detector(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DETECTION_TRACK_K", config.DETECTION_MIN_FRAMES + 2)
    monkeypatch.setattr(config, "DETECTION_TRACK_N", None)
    bus = EventBus()
    rt = _runtime(tmp_path, bus)
    st = rt.status()
    assert st.detector.state == "rejected" and "lọc track" in st.detector.reason
    assert rt.pipeline is None  # enhancer cũng bị từ chối trong ca này: không pipeline


def test_status_schema_moi():
    st = VisionStatus(
        detector=VisionModelStatus(state="loaded"), enhancer=VisionModelStatus(state="disabled")
    )
    assert st.verifier.state == "disabled" and st.enhancer_offline.state == "disabled"
    assert st.enhancer_default_on is False
    assert VisionModelStatus(state="ready").state == "ready"
    with pytest.raises(ValueError):
        VisionModelStatus(state="running")


def test_config_mac_dinh_v11(monkeypatch, tmp_path):
    """Nạp lại `backend/config.py` thành module riêng, không env, không `.env`: mặc định của hợp
    đồng §9–§13 và bundle v2 (phase 15 plan XLA 261125-ai-v2).

    Chép config.py sang `tmp_path/backend/` để `PROJECT_ROOT` = `tmp_path`: `.env` của máy chủ dự
    án (vd. còn ghim bundle v1) không lọt vào phép thử mặc định."""
    import importlib.util
    import shutil

    for key in (
        "ENHANCER_DEFAULT_ON",
        "DETECTOR_ONNX",
        "DETECTOR_SHA256",
        "ENHANCER_ONNX",
        "ENHANCER_SHA256",
        "VERIFIER_ONNX",
        "VERIFIER_SHA256",
        "VERIFIER_CONFIDENCE",
        "ENHANCER_OFFLINE_ONNX",
        "ENHANCER_OFFLINE_SHA256",
        "FLIGHT_AI_CACHE_DIR",
        "FLIGHT_AI_JPEG_QUALITY",
        "FLIGHT_AI_LINK_GRACE_S",
        "FLIGHT_AI_MIN_FREE_MB",
        *(f"DETECTION_TRACK_{k}" for k in ("K", "N", "IOU", "MAX_GAP")),
    ):
        monkeypatch.delenv(key, raising=False)
    (tmp_path / "backend").mkdir()
    shutil.copy(ROOT / "backend" / "config.py", tmp_path / "backend" / "config.py")
    spec = importlib.util.spec_from_file_location(
        "_config_fresh", tmp_path / "backend" / "config.py"
    )
    fresh = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fresh)
    root = tmp_path.resolve()
    assert fresh.ENHANCER_DEFAULT_ON is True  # classic enhancer-v2.0.0, quyết định chủ dự án
    vision = root / "models" / "vision"
    assert Path(fresh.DETECTOR_ONNX) == vision / "detector-v1.0.1" / "detector.onnx"
    assert Path(fresh.VERIFIER_ONNX) == vision / "verifier-v1.0.0" / "verifier.onnx"
    assert Path(fresh.ENHANCER_ONNX) == vision / "enhancer-v2.0.0" / "enhancer.onnx"
    assert (fresh.DETECTOR_SHA256, fresh.VERIFIER_SHA256, fresh.ENHANCER_SHA256) == (
        "23b1da69165ffe05760bda23b4a41c858930e8a8fd8b0aebc039f1e0c5c59aef",
        "d566343a5487775b9f6334d9df0bb0a1d9c9b2d2b76e2b8bfa4738facc012d58",
        "83d96e8b0f628d0e6cc271ed9550220962de897cac2d57ed306a1db51cb5477b",
    )
    # enhancer-offline-v1.0.0 không ship (XLA results/ab-v2/decision.json: offline_ship false).
    assert (fresh.ENHANCER_OFFLINE_ONNX, fresh.VERIFIER_CONFIDENCE) == ("", None)
    assert Path(fresh.FLIGHT_AI_CACHE_DIR) == root / "logs" / ".cache" / "flights-ai"
    assert (fresh.FLIGHT_AI_JPEG_QUALITY, fresh.FLIGHT_AI_LINK_GRACE_S) == (92, 300.0)
    assert fresh.FLIGHT_AI_MIN_FREE_MB == 3000.0
    assert fresh.DETECTION_TRACK_K is None and fresh.DETECTION_TRACK_MAX_GAP is None
    monkeypatch.setenv("DETECTION_TRACK_K", "ba")
    with pytest.raises(ValueError, match="DETECTION_TRACK_K='ba'"):
        spec.loader.exec_module(importlib.util.module_from_spec(spec))


# -- §14.1 scripts/vision/replay_pred.py -----------------------------------------------------------
REC = "20261125-090000"
T0 = 1_764_000_000.0
N_FRAMES = 10


@pytest.fixture(scope="module")
def vision_scripts():
    path = str(ROOT / "scripts" / "vision")
    sys.path.insert(0, path)
    import kiem_bundle
    import lay_model
    import replay_pred

    yield {"replay_pred": replay_pred, "kiem_bundle": kiem_bundle, "lay_model": lay_model}
    sys.path.remove(path)


def _recording(root: Path, n: int = N_FRAMES) -> Path:
    rec = root / REC
    rec.mkdir(parents=True)
    w = MjpegAviWriter(rec / "video-001.avi", fps=10, width=640, height=480)
    rows = ["segment,video_frame,unix_time,frame_id,width,height"]
    for k in range(n):
        w.write_jpeg(_jpeg(), T0 + k * 0.1)
        rows.append(f"1,{k},{T0 + k * 0.1:.3f},{k},640,480")
    w.close()
    (rec / "frames.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    return rec


def _name(k: int) -> str:
    return f"{REC}_001_{k:05d}.jpg"


def _list(path: Path, ks) -> Path:
    path.write_text("".join(_name(k) + "\n" for k in ks), encoding="utf-8")
    return path


@pytest.fixture
def replay_env(tmp_path, monkeypatch):
    for key in ("K", "N", "IOU", "MAX_GAP"):
        monkeypatch.setattr(config, f"DETECTION_TRACK_{key}", None)
    monkeypatch.setattr(config, "VERIFIER_ONNX", "")
    rec = _recording(tmp_path / "rec")
    det, _ = make_bundle(tmp_path / "b", "detector")
    ver, _ = make_bundle(tmp_path / "b", "verifier")
    return {"tmp": tmp_path, "rec": rec, "det": det, "ver": ver}


def _call(scripts, env, capsys, *extra, stage="track", frames=None, blank=None):
    tmp = env["tmp"]
    frames = _list(tmp / "frames.txt", range(N_FRAMES) if frames is None else frames)
    argv = [
        "--recording", str(env["rec"]),
        "--frames", str(frames),
        "--stage", stage,
        "--out", str(tmp / "out" / f"{stage}.csv"),
        "--detector-onnx", str(env["det"]),
        "--cpu", "--json", *extra,
    ]  # fmt: skip
    if blank is not None:
        argv += ["--blank", str(_list(tmp / "blank.txt", blank))]
    code = scripts["replay_pred"].main(argv)
    out = capsys.readouterr().out.strip().splitlines()
    return code, (json.loads(out[-1]) if out else None), tmp / "out" / f"{stage}.csv"


def _csv(path: Path) -> list[list[str]]:
    return [ln.split(",") for ln in path.read_text(encoding="utf-8").splitlines()]


def test_replay_pred_stage_detector_va_verifier(vision_scripts, replay_env, capsys):
    code, res, out = _call(vision_scripts, replay_env, capsys, stage="detector", frames=[0, 4])
    assert code == 0
    rows = _csv(out)
    assert rows[0] == ["frame", "x1", "y1", "x2", "y2", "conf"]
    assert rows[1:] == [
        [_name(0), "10.00", "20.00", "110.00", "220.00", "0.900000"],
        [_name(0), "500.00", "100.00", "600.00", "200.00", "0.800000"],
        [_name(4), "10.00", "20.00", "110.00", "220.00", "0.900000"],
        [_name(4), "500.00", "100.00", "600.00", "200.00", "0.800000"],
    ]
    assert (res["frames_written"], res["frames_replayed"], res["stage"]) == (
        2,
        N_FRAMES,
        "detector",
    )
    assert res["bundles"]["detector"]["version"] == "0.0.1" and res["bundles"]["verifier"] is None
    code, res, out = _call(
        vision_scripts, replay_env, capsys, "--verifier-onnx", str(replay_env["ver"]),
        stage="verifier", frames=[0],
    )  # fmt: skip
    assert code == 0
    confs = [float(r[5]) for r in _csv(out)[1:]]
    assert confs == pytest.approx([_vscore(10.0), _vscore(500.0)], abs=1e-6)  # không lọc ngưỡng
    assert res["bundles"]["verifier"]["version"] == "0.0.1"


def test_replay_pred_track_blank_xoa_track(vision_scripts, replay_env, capsys):
    """k = n = 3. Khung 3–4 blank: không vào detector, không có dòng; track bị xoá khi vào (khung
    3) và khi ra (khung 5) → phải xác nhận lại 3 khung (5, 6, 7) mới có dòng."""
    written = [k for k in range(N_FRAMES) if k not in (3, 4)]
    code, res, out = _call(
        vision_scripts, replay_env, capsys, "--verifier-onnx", str(replay_env["ver"]),
        "--track-k", "3", "--track-n", "3", frames=written, blank=[3, 4],
    )  # fmt: skip
    assert code == 0
    rows = _csv(out)[1:]
    assert sorted({r[0] for r in rows}) == [_name(k) for k in (2, 7, 8, 9)]
    assert all(r[1] == "10.00" for r in rows)  # hộp phải bị verifier loại, chỉ còn hộp trái
    assert float(rows[0][5]) == pytest.approx(_vscore(10.0), abs=1e-6)
    assert res == res | {
        "frames_written": 8,
        "frames_replayed": 8,
        "frames_blank": 2,
        "track_resets": 2,
        "stage": "track",
        "track": {"k": 3, "n": 3, "iou": 0.3, "max_gap": 1},
    }
    # Đoạn blank chạm cuối bản ghi: chỉ có lần vào.
    code, res, _ = _call(vision_scripts, replay_env, capsys, frames=[0, 1, 2], blank=[3, 4, 8, 9])
    assert code == 0 and (res["track_resets"], res["frames_blank"]) == (3, 4)


def test_replay_pred_track_khong_verifier_dung_diem_detector(vision_scripts, replay_env, capsys):
    code, res, out = _call(vision_scripts, replay_env, capsys, frames=[2])
    assert code == 0 and res["bundles"]["verifier"] is None
    assert [(r[1], r[5]) for r in _csv(out)[1:]] == [("10.00", "0.900000"), ("500.00", "0.800000")]


@pytest.mark.parametrize(
    ("extra", "kw", "code"),
    [
        ((), {"frames": [1, 2], "blank": [2, 3]}, 2),  # --frames giao --blank
        ((), {"stage": "verifier"}, 2),  # stage verifier mà không có verifier
        (("--track-k", "5", "--track-n", "3"), {}, 2),  # k > n
        (("--khong-co",), {}, 2),
        ((), {"frames": [N_FRAMES + 5]}, 1),  # khung của bản ghi này nhưng không có
    ],
)
def test_replay_pred_ma_thoat(vision_scripts, replay_env, capsys, extra, kw, code):
    got, res, _ = _call(vision_scripts, replay_env, capsys, *extra, **kw)
    assert got == code
    if res is not None and "error" in res:
        assert res["exit"] == code


def test_replay_pred_bundle_sai_ma_1(vision_scripts, replay_env, capsys):
    bad, _ = make_bundle(replay_env["tmp"] / "bad", "detector", contract="2.0")
    replay_env["det"] = bad
    code, res, _ = _call(vision_scripts, replay_env, capsys)
    assert code == 1 and "major 2" in res["error"]


def test_replay_pred_bo_khung_ban_ghi_khac(vision_scripts, replay_env, capsys):
    frames = _list(replay_env["tmp"] / "f.txt", [0])
    frames.write_text(frames.read_text() + "20260101-000000_001_00000.jpg\n", encoding="utf-8")
    argv = [
        "--recording", str(replay_env["rec"]), "--frames", str(frames), "--stage", "detector",
        "--out", str(replay_env["tmp"] / "o.csv"), "--detector-onnx", str(replay_env["det"]),
        "--cpu", "--json",
    ]  # fmt: skip
    assert vision_scripts["replay_pred"].main(argv) == 0
    assert json.loads(capsys.readouterr().out)["frames_written"] == 1


# -- lay_model.py / kiem_bundle.py: golden verifier (boxes.json) và offline (1280×960) -------------
def _golden(bundle_dir: Path, kind: str, temporal_window: int = 1) -> None:
    import onnxruntime as ort

    g = bundle_dir / "golden"
    g.mkdir()
    imgs = {}
    for i, name in enumerate(("000.jpg", "001.jpg", "002.jpg")):
        ok, buf = cv2.imencode(".jpg", np.full((480, 640, 3), 60 + 40 * i, np.uint8))
        (g / name).write_bytes(buf.tobytes())
        imgs[name] = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    sess = ort.InferenceSession(str(bundle_dir / f"{kind}.onnx"), providers=CPU)
    names = sorted(imgs)
    expected = {}
    if kind == "verifier":
        boxes = {"000.jpg": [[100.0, 100.0, 150.0, 160.0]], "001.jpg": [], "002.jpg": DET_BOXES}
        (g / "boxes.json").write_text(json.dumps(boxes), encoding="utf-8")
        for n in names:
            b = np.asarray(boxes[n], np.float32).reshape(-1, 4)
            (s,) = sess.run(["scores"], {"frame": imgs[n], "boxes": b})
            expected[n] = {"scores": s.tolist()}
    else:
        for i, n in enumerate(names):
            if temporal_window == 1:
                feeds = {"frame": imgs[n]}
            else:
                idx = [min(max(j, 0), 2) for j in range(i - 1, i + 2)]
                feeds = {"frames": np.stack([imgs[names[j]] for j in idx])}
            (out,) = sess.run(["frame_out"], feeds)
            cv2.imwrite(str(g / n.replace(".jpg", ".out.png")), out)
            expected[n] = {"sha256_out": hashlib.sha256(out.tobytes()).hexdigest()}
    (g / "expected.json").write_text(json.dumps(expected), encoding="utf-8")


@pytest.mark.parametrize(
    ("kind", "t"), [("verifier", 1), ("enhancer-offline", 1), ("enhancer-offline", 3)]
)
def test_kiem_bundle_va_lay_model_kind_moi(vision_scripts, tmp_path, capsys, kind, t):
    kw = {"data": offline_graph(3), "temporal_window": 3} if t == 3 else {}
    path, sha = make_bundle(tmp_path / "src", kind, **kw)
    _golden(path.parent, kind, t)
    res = vision_scripts["kiem_bundle"].check(path.parent, None, CPU)
    assert res["pass"], res
    assert len(res["golden"]) == 3
    dest = tmp_path / "dest"
    argv = ["--from", str(path.parent), "--dest-root", str(dest), "--json"]
    assert vision_scripts["lay_model"].main(argv) == 0
    out = json.loads(capsys.readouterr().out)
    prefix = kind.replace("-", "_").upper()
    assert out["env"][f"{prefix}_SHA256"] == sha and f"{prefix}_ONNX" in out["env"]
    assert (dest / path.parent.name / "golden" / "expected.json").is_file()


def test_lay_model_tu_choi_golden_thieu(vision_scripts, tmp_path, capsys):
    lay = vision_scripts["lay_model"].main
    path, _ = make_bundle(tmp_path / "src", "verifier")
    _golden(path.parent, "verifier")
    (path.parent / "golden" / "boxes.json").unlink()
    assert lay(["--from", str(path.parent), "--dest-root", str(tmp_path / "d")]) == 1
    assert "boxes.json" in capsys.readouterr().err
    off, _ = make_bundle(tmp_path / "src2", "enhancer-offline")
    _golden(off.parent, "enhancer-offline")
    small = cv2.imencode(".png", np.zeros((480, 640, 3), np.uint8))[1].tobytes()
    (off.parent / "golden" / "001.out.png").write_bytes(small)
    assert lay(["--from", str(off.parent), "--dest-root", str(tmp_path / "d")]) == 1
    assert "cần 1280x960" in capsys.readouterr().err
