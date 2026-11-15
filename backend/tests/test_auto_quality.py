"""Camera tự hạ/nâng chất lượng JPEG theo khung/s (backend/vision/auto_quality.py, 15/11/2026)."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import pytest

from backend import config
from backend.events import BUS
from backend.vision import auto_quality
from backend.vision.auto_quality import (
    AutoQualityPolicy,
    AutoQualitySettings,
    CameraQualityController,
    make_controller,
)
from backend.vision.stream import MjpegFrame, MjpegLatestFrameReader

S = AutoQualitySettings(
    best=12,
    worst=40,
    step=7,
    fps_low=4.0,
    fps_high=6.5,
    window_s=5.0,
    recover_s=10.0,
    recover_max_s=120.0,
)


def _frame(t: float, q: int | None) -> MjpegFrame:
    return MjpegFrame(
        jpeg=b"\xff\xd8\xff\xd9",
        frame_id=None,
        timestamp_ms=None,
        jpeg_quality=q,
        framesize="VGA",
        received_at=t,
    )


def _ctl(setter, settings: AutoQualitySettings = S) -> CameraQualityController:
    return CameraQualityController(
        MjpegLatestFrameReader("http://127.0.0.1:9/stream"),
        settings,
        "http://cam:80",
        setter=setter,
        clock=lambda: 0.0,
    )


# -- chính sách -------------------------------------------------------------------------------
def test_tut_khung_thi_ha_tung_buoc_va_dung_o_worst():
    p = AutoQualityPolicy(S)
    assert p.decide(100.0, 3.0, 12) == 19
    p.commit(100.0, 12, 19)
    assert p.decide(104.9, 3.0, 19) is None, "phải chờ đủ một cửa sổ đo ở mức mới"
    assert p.decide(105.0, 3.0, 19) == 26
    assert p.decide(105.0, 3.0, 36) == 40, "bước cuối kẹp ở worst"
    assert p.decide(105.0, 1.0, 40) is None, "đã ở worst thì thôi"


def test_khoe_lien_recover_s_moi_nang_net_va_dung_o_best():
    p = AutoQualityPolicy(S)
    assert p.decide(0.0, 8.0, 26) is None
    assert p.decide(9.9, 8.0, 26) is None
    assert p.decide(10.0, 8.0, 26) == 19
    assert p.decide(50.0, 8.0, 12) is None, "đã ở best thì không nâng nữa"


def test_khung_s_trong_dai_giua_thi_giu_va_dem_lai_tu_dau():
    p = AutoQualityPolicy(S)
    assert p.decide(0.0, 8.0, 26) is None
    assert p.decide(5.0, 5.0, 26) is None  # trong dải [4; 6,5]: xoá đếm giờ khoẻ
    assert p.decide(12.0, 8.0, 26) is None
    assert p.decide(21.9, 8.0, 26) is None
    assert p.decide(22.0, 8.0, 26) == 19


def test_khong_co_so_do_thi_khong_doi():
    p = AutoQualityPolicy(S)
    assert p.decide(0.0, None, 12) is None, "mất hình hẳn không phải thiếu băng thông"
    assert p.decide(0.0, 2.0, None) is None, "nguồn không gắn nhãn chất lượng"


def test_len_net_hong_thi_cho_gap_doi_dung_duoc_thi_ve_nhip_goc():
    p = AutoQualityPolicy(S)
    p.commit(0.0, 26, 19)  # lên nét
    assert p.decide(5.0, 3.0, 19) == 26
    p.commit(5.0, 19, 26)  # vừa lên đã phải hạ
    assert p.recover_s == 20.0
    for t in (10.0, 20.0, 30.0, 40.0):
        p.commit(t, 26, 19)
        p.commit(t + 3.0, 19, 26)
    assert p.recover_s == 120.0, "phạt có trần"
    p.commit(100.0, 26, 19)
    assert p.decide(219.9, 5.0, 19) is None
    assert p.recover_s == 120.0
    assert p.decide(220.0, 5.0, 19) is None
    assert p.recover_s == 10.0, "lên nét đứng được trọn quãng chờ thì về nhịp gốc"


def test_muc_ngoai_khoang_cau_hinh_khong_bi_day_sai_chieu():
    p = AutoQualityPolicy(S)
    assert p.decide(0.0, 2.0, 50) is None, "đang kém hơn worst: tụt khung không được nâng nét"
    assert p.decide(0.0, 2.0, 8) == 15
    assert p.decide(0.0, 8.0, 8) is None


@pytest.mark.parametrize(
    ("thay_doi", "loi"),
    [
        ({"best": 41}, "CAMERA_QUALITY_BEST"),
        ({"worst": 64}, "CAMERA_QUALITY_WORST"),
        ({"step": 0}, "CAMERA_QUALITY_STEP"),
        ({"fps_low": 7.0}, "CAMERA_AUTO_FPS_LOW"),
        ({"window_s": 0.0}, "CAMERA_AUTO_WINDOW_S"),
        ({"recover_s": 200.0}, "CAMERA_AUTO_RECOVER_S"),
    ],
)
def test_cau_hinh_sai_bi_neu_ten(thay_doi, loi):
    s = AutoQualitySettings(**{**S.__dict__, **thay_doi})
    assert any(loi in p for p in s.problems())
    assert S.problems() == []


# -- bộ điều khiển ----------------------------------------------------------------------------
def test_chua_du_mot_cua_so_thi_chua_do():
    ctl = _ctl(lambda q: True)
    assert ctl.fps(5.0) is None
    ctl.on_frame(_frame(0.0, 12))
    assert ctl.fps(4.9) is None
    assert ctl.fps(5.0) == pytest.approx(1 / 5)
    assert ctl.fps(10.0) is None, "không còn khung nào trong cửa sổ"


def test_khung_s_thap_thi_goi_set_va_bao_su_kien():
    calls: list[int] = []
    ctl = _ctl(lambda q: calls.append(q) or True)
    for i in range(13):  # 2 khung/s trong 6 s
        ctl.on_frame(_frame(i * 0.5, 12))
    assert ctl.step(6.0) == 19
    assert calls == [19]
    ev = [e for e in BUS.recent() if e.code == "camera.quality"]
    assert len(ev) == 1
    assert ev[0].source == "vision"
    assert ev[0].detail == {"from": 12, "to": 19, "fps": pytest.approx(11 / 5, abs=0.01)}
    assert "12 → 19" in ev[0].message


def test_luong_dung_mot_giay_khong_bi_ha_net_oan():
    """Đo thật 15/11/2026 (Wi-Fi laptop vừa nối mạng nhà vừa phát hotspot): khung/giây 4, 5, 0, 9,
    8. Cửa sổ 5 s thấy ≥ 5 khung/s; cửa sổ 3 s thấy 3 và hạ nét oan — lý do của mặc định 5 s."""
    calls: list[int] = []
    ctl = _ctl(lambda q: calls.append(q) or True)
    per_sec = [8] * 6 + [4, 5, 0, 9, 8] + [8] * 6
    for sec, n in enumerate(per_sec):
        for k in range(n):
            ctl.on_frame(_frame(sec + (k + 0.5) / n, 12))
        ctl.step(float(sec + 1))
    assert calls == []


def test_goi_camera_hong_thi_giu_muc_va_thu_lai_sau_mot_cua_so():
    calls: list[int] = []
    ctl = _ctl(lambda q: calls.append(q) and False)
    for i in range(13):
        ctl.on_frame(_frame(i * 0.5, 12))
    assert ctl.step(6.0) is None
    assert ctl.step(7.0) is None
    assert calls == [19], "gọi hỏng thì chờ một cửa sổ, không dội camera mỗi giây"
    assert ctl.step(11.0) is None
    assert calls == [19, 19]
    assert ctl.changes == 0
    assert BUS.recent() == []


def test_nguon_khong_gan_nhan_thi_khong_lam_gi():
    calls: list[int] = []
    ctl = _ctl(lambda q: calls.append(q) or True)
    for i in range(13):
        ctl.on_frame(_frame(i * 0.5, None))
    assert ctl.step(6.0) is None
    assert calls == []


# Cỡ khung đo trên camera thật 15/11/2026 (VGA, cảnh trong nhà, KB) nhân 25/15,2 cho ra cỡ khung
# ngoài bãi 02/11 (25 KB ở mức 12). Mức 63 còn TO hơn mức 50, nên worst để 40.
_CO_KHUNG_KB = {12: 15.2, 19: 12.4, 26: 11.0, 33: 10.1, 40: 9.5}
_NGOAI_BAI = 25.0 / 15.2
_FPS_CHUP_TOI_DA = 8.0  # cảm biến chụp ~8 khung/s ở VGA, băng thông thừa cũng không nhanh hơn


def test_mo_phong_bay_xa_roi_ve_gan():
    """Băng thông: 0–60 s gần (300 KB/s), 60–180 s xa quá 25 m (45 KB/s = 1,8 khung/s × 25 KB
    như 02/11), sau 180 s về gần. Camera đổi nhãn sau 4 khung như firmware."""
    cam = {"q": 12, "label": 12, "settle": 0}

    def setter(q: int) -> bool:
        cam["q"], cam["settle"] = q, 4
        return True

    ctl = _ctl(setter)
    t, next_tick, lich_su = 0.0, 1.0, []
    while t < 300.0:
        bang_thong = 45.0 if 60.0 <= t < 180.0 else 300.0
        fps = min(_FPS_CHUP_TOI_DA, bang_thong / (_CO_KHUNG_KB[cam["q"]] * _NGOAI_BAI))
        t += 1.0 / fps
        if cam["settle"] > 0:
            cam["settle"] -= 1
        else:
            cam["label"] = cam["q"]
        ctl.on_frame(_frame(t, cam["label"]))
        while next_tick <= t:
            ctl.step(next_tick)
            lich_su.append((next_tick, ctl.quality, ctl.fps(next_tick)))
            next_tick += 1.0

    xa = [(q, f) for (tt, q, f) in lich_su if 100.0 <= tt < 180.0]
    assert {q for q, _ in xa} == {40}, "ở xa phải đứng yên ở một mức, không lật qua lại"
    # 1,8 khung/s ở mức 12 thành ~2,9: khung chỉ nhỏ đi ~37 %, đó là trần của riêng cách này.
    assert min(f for _, f in xa) >= 2.5
    assert lich_su[-1][1] == 12, "về gần phải nét lại như cũ"
    assert ctl.changes == 8, "12→19→26→33→40 khi ra xa, ngược lại khi về"


# -- gọi HTTP thật tới một máy chủ giả làm firmware camera ------------------------------------
class _FirmwareGia(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 — tên do http.server đặt
        parts = urlsplit(self.path)
        q = parse_qs(parts.query).get("quality", [""])[0]
        if parts.path == "/set" and q.isdigit() and 0 <= int(q) <= 63:
            code, body = 200, {"quality": int(q)}
        else:
            code, body = 400, {"error": "quality phai la so nguyen trong 0..63"}
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


@pytest.fixture
def firmware_gia():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _FirmwareGia)
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


def test_http_set_qua_may_chu_gia(firmware_gia):
    ctl = CameraQualityController(
        MjpegLatestFrameReader("http://127.0.0.1:9/stream"), S, firmware_gia
    )
    assert ctl._http_set(19) is True
    assert ctl._http_set(64) is False, "firmware trả 400 thì coi như chưa đổi"


def test_http_set_camera_tat_thi_false_khong_nem():
    ctl = CameraQualityController(
        MjpegLatestFrameReader("http://127.0.0.1:9/stream"), S, "http://127.0.0.1:9"
    )
    assert ctl._http_set(19) is False


# -- cấu hình ---------------------------------------------------------------------------------
def test_url_dieu_khien_lay_tu_url_stream(monkeypatch):
    monkeypatch.setattr(config, "CAMERA_FAKE", False)
    monkeypatch.setattr(config, "CAMERA_STREAM_URL", "http://iotcv-camera.mshome.net:81/stream")
    assert config.camera_control_url() == "http://iotcv-camera.mshome.net:80"
    monkeypatch.setattr(config, "CAMERA_CONTROL_PORT", 8080)
    assert config.camera_control_url() == "http://iotcv-camera.mshome.net:8080"
    monkeypatch.setattr(config, "CAMERA_FAKE", True)
    assert config.camera_control_url() is None


def test_make_controller_tat_gia_va_cau_hinh_sai(monkeypatch, caplog):
    reader = MjpegLatestFrameReader("http://127.0.0.1:9/stream")
    monkeypatch.setattr(config, "CAMERA_AUTO_QUALITY", True)
    monkeypatch.setattr(config, "CAMERA_FAKE", False)
    monkeypatch.setattr(config, "CAMERA_STREAM_URL", "http://iotcv-camera.mshome.net:81/stream")
    assert isinstance(make_controller(reader), CameraQualityController)

    monkeypatch.setattr(config, "CAMERA_AUTO_QUALITY", False)
    assert make_controller(reader) is None, "công tắc tắt"

    monkeypatch.setattr(config, "CAMERA_AUTO_QUALITY", True)
    monkeypatch.setattr(config, "CAMERA_FAKE", True)
    assert make_controller(reader) is None, "nguồn giả không có /set"

    monkeypatch.setattr(config, "CAMERA_FAKE", False)
    monkeypatch.setattr(config, "CAMERA_QUALITY_WORST", 70)
    with caplog.at_level("ERROR", logger=auto_quality.__name__):
        assert make_controller(reader) is None
    assert "CAMERA_QUALITY_WORST" in caplog.text


def test_start_stop_dang_ky_va_go_khoi_reader():
    reader = MjpegLatestFrameReader("http://127.0.0.1:9/stream")
    ctl = CameraQualityController(reader, S, "http://cam:80", setter=lambda q: True, tick_s=0.05)
    ctl.start()
    reader.publish(_frame(1.0, 26))
    assert ctl.quality == 26
    ctl.stop()
    assert ctl._thread is None
    reader.publish(_frame(2.0, 33))
    assert ctl.quality == 26, "đã gỡ khỏi reader"
