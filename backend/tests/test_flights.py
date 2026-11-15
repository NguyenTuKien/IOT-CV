"""Trang Lịch sử bay (`backend/flights/`): đọc tlog, ghép chuyến, chỉnh lệch đồng hồ laptop,
lấy khung từ AVI (kể cả file ghi dở), và ba endpoint REST.

Số liệu mẫu theo buổi bay thật 02/11/2026: laptop chậm ~55 s so với giờ GPS của FC, log FC mất
bản ghi ARM đầu tiên sau khi bật nguồn, hai lần ARM liền nhau cách 2,5 s là hai chuyến.
"""

from __future__ import annotations

import struct
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymavlink.dialects.v20 import ardupilotmega as mavlink

from backend.flights import index, sources, video
from backend.flights.index import FlightStore, Scan, align_clocks
from backend.vision.avi_writer import MjpegAviWriter

T0 = 1_793_588_000.0  # 02/11/2026 sáng, giờ GPS


# ---------------------------------------------------------------- dựng dữ liệu giả
def _track(kind: str, arms, t0=None, t1=None, cols=None, **extra) -> dict:
    t0 = arms[0][0] - 5 if t0 is None else t0
    t1 = arms[-1][1] + 5 if t1 is None else t1
    tr = {
        "ok": True,
        "kind": kind,
        "file": f"{kind}-{t0}",
        "t0": t0,
        "t1": t1,
        "arms": arms,
        "cols": cols or {},
        "modes": [[t0, "LOITER"]],
        "events": [],
        "home": None,
    }
    if kind == "tlog":
        tr["link"] = [[s, 25, 0] for s in range(int(t0), int(t1) + 1)]
        tr["clock_offset"] = None
    tr.update(extra)
    return tr


def _write_tlog(path: Path, packets: list[tuple[float, int, int, object]]) -> None:
    """tlog = (8 byte giờ µs big-endian + gói MAVLink) nối nhau, như backend ghi."""
    links: dict[tuple[int, int], mavlink.MAVLink] = {}
    with path.open("wb") as f:
        for t, sysid, compid, msg in packets:
            mav = links.setdefault(
                (sysid, compid), mavlink.MAVLink(None, srcSystem=sysid, srcComponent=compid)
            )
            f.write(struct.pack(">Q", int(t * 1e6)) + msg.pack(mav))
            mav.seq = (mav.seq + 1) % 256  # pack() không tự tăng seq, send() mới tăng


def _hb(armed: bool, custom_mode: int = 5):
    base = mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED | (
        mavlink.MAV_MODE_FLAG_SAFETY_ARMED if armed else 0
    )
    return mavlink.MAVLink_heartbeat_message(
        mavlink.MAV_TYPE_QUADROTOR, mavlink.MAV_AUTOPILOT_ARDUPILOTMEGA, base, custom_mode, 4, 3
    )


# ---------------------------------------------------------------- arm_spans
def test_arm_spans_mat_ban_ghi_arm_dau_tien_lay_luc_dat_home():
    # 02/11 log 001: mở 10:10:15, ARM thật 10:10:46 (lúc đặt home), DISARM 10:12:51.
    assert sources.arm_spans([(156.0, False)], fallback_on=31.0, last_t=160.0) == [[31.0, 156.0]]


def test_arm_spans_binh_thuong_va_chua_disarm_khi_het_log():
    changes = [(1.0, True), (5.0, False), (8.0, True)]
    assert sources.arm_spans(changes, None, 12.0) == [[1.0, 5.0], [8.0, 12.0]]


def test_arm_spans_disarm_ma_khong_co_moc_nao_thi_bo():
    assert sources.arm_spans([(5.0, False)], None, 9.0) == []


# ---------------------------------------------------------------- đọc tlog
def test_doc_tlog_arm_mat_goi_song_va_lech_dong_ho(tmp_path):
    p = tmp_path / "a.tlog"
    pk = []
    for k in range(40):  # 10 gói/s trong 4 s
        t = 100.0 + k * 0.1
        pk.append((t, 1, 1, _hb(armed=1.0 <= t - 100 < 3.0)))
        pk.append((t + 0.01, 1, 1, mavlink.MAVLink_system_time_message(int((t + 55.0) * 1e6), 0)))
    pk.append((101.5, 1, 68, mavlink.MAVLink_radio_status_message(255, 182, 0, 255, 255, 0, 0)))
    _write_tlog(p, pk)
    tr = sources.read_tlog(p)
    assert tr["ok"]
    assert tr["arms"][0] == pytest.approx([101.0, 103.0], abs=0.15)
    assert tr["clock_offset"] == pytest.approx(55.0, abs=0.02)
    assert tr["cols"]["rssi"][0][1] == -74.0  # 182 = −74 dBm số có dấu 8 bit
    assert sum(lo for _, _, lo in tr["link"]) == 0


def test_doc_tlog_tinh_goi_mat_theo_seq(tmp_path):
    p = tmp_path / "b.tlog"
    mav = mavlink.MAVLink(None, srcSystem=1, srcComponent=1)
    with p.open("wb") as f:
        for k in range(20):
            data = _hb(False).pack(mav)
            mav.seq = (mav.seq + 1) % 256
            if k % 4 == 3:
                continue  # gói này "rơi trên Wi-Fi": seq đã tăng nhưng không tới laptop
            f.write(struct.pack(">Q", int((200 + k * 0.05) * 1e6)) + data)
    tr = sources.read_tlog(p)
    rx = sum(r for _, r, _ in tr["link"])
    lost = sum(lo for _, _, lo in tr["link"])
    assert (rx, lost) == (15, 4)  # gói cuối (k=19) rơi ở đuôi, không có gói sau để thấy


def test_tlog_sitl_bi_loai(tmp_path):
    p = tmp_path / "sitl.tlog"
    _write_tlog(
        p,
        [
            (10.0, 1, 1, _hb(False)),
            (10.5, 1, 1, mavlink.MAVLink_statustext_message(6, b"EKF3 IMU1 initialised")),
            (11.0, 1, 1, _hb(True)),
            (20.0, 1, 1, _hb(False)),
        ],
    )
    tr = sources.read_tlog(p)
    assert not tr["ok"] and "SITL" in tr["reason"]


def test_tlog_drone_that_bao_imu1_van_giu_neu_co_dronebridge(tmp_path):
    p = tmp_path / "that.tlog"
    _write_tlog(
        p,
        [
            (10.0, 1, 68, _hb(False)),
            (10.5, 1, 1, mavlink.MAVLink_statustext_message(6, b"EKF3 IMU1 initialised")),
            (11.0, 1, 1, _hb(True)),
            (20.0, 1, 1, _hb(False)),
        ],
    )
    assert sources.read_tlog(p)["ok"]


# ---------------------------------------------------------------- chỉnh đồng hồ + ghép chuyến
def test_align_clocks_khop_lan_arm_roi_doi_ca_video():
    df = _track("dataflash", [[T0 + 55, T0 + 84.4], [T0 + 600, T0 + 762.4]])
    tl = _track("tlog", [[T0, T0 + 29.0], [T0 + 545, T0 + 707.0]])  # cùng hai lần ARM, giờ laptop
    vid = {
        "ok": True,
        "kind": "video",
        "rec": "r",
        "times": [T0 + 10.0],
        "t0": T0 + 10,
        "t1": T0 + 10,
        "width": 640,
        "height": 480,
    }
    align_clocks([df, tl], [vid])
    assert tl["clock_offset"] == pytest.approx(55.0, abs=0.5)
    assert tl["arms"][0][0] == pytest.approx(T0 + 55, abs=0.5)
    assert vid["times"][0] == pytest.approx(T0 + 65, abs=0.5)


def test_align_clocks_system_time_thang_khop_arm():
    df = _track("dataflash", [[T0 + 55, T0 + 84.4]])
    tl = _track("tlog", [[T0, T0 + 29.0]], clock_offset=50.4)
    align_clocks([df, tl], [])
    assert tl["clock_how"] == "SYSTEM_TIME"
    assert tl["arms"][0][0] == pytest.approx(T0 + 50.4)


def _store(tmp_path) -> FlightStore:
    return FlightStore(tmp_path, tmp_path / "tlog", tmp_path / "rec", tmp_path / "cache")


def test_hai_log_fc_lien_nhau_la_hai_chuyen_tlog_dut_doan_la_mot(tmp_path):
    # 02/11 10:23: log 004 ARM 4,5 s, log 005 ARM 2,5 s sau; tlog bị cắt đôi vì mất link.
    df4 = _track("dataflash", [[T0, T0 + 4.5]])
    df5 = _track("dataflash", [[T0 + 7.0, T0 + 144.6]])
    tl_a = _track("tlog", [[T0 + 7.2, T0 + 60.0]], t1=T0 + 60.0)
    tl_b = _track("tlog", [[T0 + 75.0, T0 + 144.0]], t0=T0 + 75.0)
    # Một đoạn ARM của tlog chồng lên CẢ HAI log FC (như khi đồng hồ laptop lệch): trước đây nó
    # bắc cầu gộp hai lần ARM thành một chuyến 145 s.
    tl_x = _track("tlog", [[T0 + 3.0, T0 + 8.0]])
    flights = _store(tmp_path)._assemble(Scan(tracks=[df4, df5, tl_a, tl_b, tl_x]))
    assert [round(f["summary"]["duration_s"], 1) for f in flights] == [4.5, 137.6]


def test_mat_goi_none_ngoai_vung_tlog_100_khi_im_lang_trong_vung(tmp_path):
    lat = [[T0 + k, 21.0] for k in range(0, 60)]
    df = _track(
        "dataflash",
        [[T0 + 10, T0 + 50]],
        cols={"lat": lat, "lon": [[t, 105.0] for t, _ in lat], "alt": [[t, 5.0] for t, _ in lat]},
    )
    tl = _track("tlog", [[T0 + 10, T0 + 30]], t0=T0 + 5, t1=T0 + 30, clock_offset=0.0)
    tl["link"] = [
        [s, 0 if T0 + 20 <= s < T0 + 25 else 25, 0] for s in range(int(T0 + 5), int(T0 + 31))
    ]
    fl = _store(tmp_path)._assemble(Scan(tracks=[df, tl]))[0]
    ws = fl["window_start"]
    t = fl["series"]["t"]
    loss = fl["series"]["link_loss"]

    def at(x):
        return loss[min(range(len(t)), key=lambda i: abs(ws + t[i] - x))]

    assert at(T0 + 15) == 0.0
    assert at(T0 + 24) == 100.0  # backend chạy, FC im: mất link thật
    assert at(T0 + 45) is None  # ngoài mọi tlog: không biết, khác 0 %
    assert fl["summary"]["took_off"] is True


# ---------------------------------------------------------------- video
def _jpeg(tag: int) -> bytes:
    return b"\xff\xd8" + bytes([tag]) * (50 + tag) + b"\xff\xd9"


def _recording(root: Path, n: int, close: bool = True) -> Path:
    rec = root / "20261102-100941"
    rec.mkdir(parents=True)
    w = MjpegAviWriter(rec / "video-001.avi", fps=10, width=640, height=480)
    rows = [
        "segment,video_frame,unix_time,frame_id,width,height,lat,lon,rel_alt_m,heading_deg,mode,armed"
    ]
    vf = 0
    for k in range(n):
        if k == 2:
            w.write_jpeg(_jpeg(1), T0 + k * 0.1)  # khung lấp: có trong AVI, không có dòng CSV
            vf += 1
        w.write_jpeg(_jpeg(k + 10), T0 + k * 0.1)
        rows.append(f"1,{vf},{T0 + k * 0.1:.3f},{k},640,480,,,,,LOITER,True")
        vf += 1
    w.close()
    if not close:  # backend chết giữa chừng: chưa có idx1, chunk cuối ghi dở
        avi = rec / "video-001.avi"
        data = avi.read_bytes()
        avi.write_bytes(
            data[: data.rindex(b"idx1")] + b"00dc" + struct.pack("<I", 1000) + b"\xff\xd8 cut"
        )
    (rec / "frames.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    return rec


@pytest.mark.parametrize("close", [True, False], ids=["da-dong", "ghi-do-chua-idx1"])
def test_lay_khung_theo_dong_csv_bo_qua_khung_lap(tmp_path, close):
    rec = _recording(tmp_path, 5, close=close)
    r = video.Recording(rec)
    assert [r.frame(i) for i in range(5)] == [_jpeg(k + 10) for k in range(5)]
    assert r.frame(5) is None
    meta = video.read_recording_meta(rec)
    assert meta["ok"] and len(meta["times"]) == 5 and meta["width"] == 640


def test_recording_cache_chan_ten_la(tmp_path):
    cache = video.RecordingCache(tmp_path)
    assert cache.get("../etc") is None
    assert cache.get("20261102-000000") is None


# ---------------------------------------------------------------- API
def test_api_danh_sach_chi_tiet_va_khung(tmp_path, monkeypatch):
    from backend import config
    from backend.api import build_router

    rec_root = tmp_path / "recordings"
    _recording(rec_root, 5)
    (tmp_path / "tlog").mkdir()
    p = tmp_path / "tlog" / "x.tlog"
    pk = [(T0 - 2 + k * 0.1, 1, 1, _hb(True)) for k in range(60)]
    pk.append((T0 + 5, 1, 1, _hb(False)))
    _write_tlog(p, pk)
    monkeypatch.setattr(config, "FLIGHT_LOGS_DIR", str(tmp_path))
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path / "tlog"))
    monkeypatch.setattr(config, "RECORD_DIR", str(rec_root))
    monkeypatch.setattr(config, "FLIGHT_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setattr(index, "MIN_ARM_S", 1.0)
    app = FastAPI()
    app.include_router(build_router(hub=None))
    c = TestClient(app)
    body = c.get("/api/flights").json()
    assert len(body["flights"]) == 1
    fid = body["flights"][0]["id"]
    d = c.get("/api/flight", params={"id": fid}).json()
    assert d["video"] and d["video"][0]["rec"] == "20261102-100941"
    clip = d["video"][0]
    r = c.get("/api/flights/frame", params={"rec": clip["rec"], "n": clip["row0"]})
    assert (
        r.status_code == 200
        and r.headers["content-type"] == "image/jpeg"
        and r.content[:2] == b"\xff\xd8"
    )
    assert c.get("/api/flights/frame", params={"rec": "..", "n": 0}).status_code == 422
    assert c.get("/api/flight", params={"id": "20991231-000000"}).status_code == 404
    assert (tmp_path / "cache").is_dir()  # đã lưu đệm
