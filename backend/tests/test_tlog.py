"""File .tlog phía laptop (01/11/2026): mọi gói MAVLink backend nhận được phải nằm trong
một file Mission Planner / pymavlink mở lại được — kiểm bằng cách ĐỌC LẠI file, không chỉ
kiểm file có tồn tại (một file rỗng cũng "tồn tại")."""

from __future__ import annotations

import socket
import threading
import time

import pytest
from pymavlink import mavutil

from backend import config
from backend.mavlink.connection import MavlinkConnection
from backend.tests.fakes import FakeMAVLink, FakeMessage

MAV = mavutil.mavlink


class _HeartbeatFC(FakeMessage):
    def __init__(self) -> None:
        super().__init__(
            "HEARTBEAT",
            type=MAV.MAV_TYPE_QUADROTOR,
            autopilot=MAV.MAV_AUTOPILOT_ARDUPILOTMEGA,
            base_mode=0,
            custom_mode=0,
        )

    def get_srcSystem(self) -> int:
        return 1

    def get_srcComponent(self) -> int:
        return 1


def _cong_udp_trong() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_tlog_tat_thi_khong_tao_file(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "TLOG_ENABLE", False)
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path / "tlog"))
    fake = FakeMAVLink([_HeartbeatFC()])
    monkeypatch.setattr(mavutil, "mavlink_connection", lambda *a, **k: fake)
    conn = MavlinkConnection("udpin:127.0.0.1:14550")
    assert conn.connect(timeout=1) == (1, 1)
    assert conn.tlog_path is None
    assert not (tmp_path / "tlog").exists()


def test_mo_tlog_hong_van_noi_duoc_may_bay(tmp_path, monkeypatch):
    chan = tmp_path / "la-file-khong-phai-thu-muc"
    chan.write_text("x", encoding="utf-8")
    monkeypatch.setattr(config, "TLOG_ENABLE", True)
    monkeypatch.setattr(config, "TLOG_DIR", str(chan))  # mkdir sẽ hỏng
    fake = FakeMAVLink([_HeartbeatFC()])
    monkeypatch.setattr(mavutil, "mavlink_connection", lambda *a, **k: fake)
    conn = MavlinkConnection("udpin:127.0.0.1:14550")
    assert conn.connect(timeout=1) == (1, 1)
    assert conn.tlog_path is None


def test_moi_lan_noi_mot_file_khong_ghi_de(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "TLOG_ENABLE", True)
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path))
    conns, fakes = [], []
    for _ in range(2):  # hai lần nối trong cùng một giây, file đầu còn mở
        fake = FakeMAVLink([_HeartbeatFC()])
        monkeypatch.setattr(mavutil, "mavlink_connection", lambda *a, _f=fake, **k: _f)
        conn = MavlinkConnection("udpin:127.0.0.1:14550")
        conn.connect(timeout=1)
        conns.append(conn)
        fakes.append(fake)
    paths = [c.tlog_path for c in conns]
    assert paths[0] != paths[1]
    assert all(p.is_file() for p in paths)
    for conn in conns:
        conn.close()
    assert all(f.closed for f in fakes)


def test_noi_hong_khong_de_lai_file_tlog_rong(tmp_path, monkeypatch):
    """01/11/2026: 66/75 file tlog là 0 byte — mỗi lần thử nối khi drone chưa bật để lại một."""
    monkeypatch.setattr(config, "TLOG_ENABLE", True)
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path))
    for _ in range(3):
        fake = FakeMAVLink([])  # không có heartbeat nào
        monkeypatch.setattr(mavutil, "mavlink_connection", lambda *a, _f=fake, **k: _f)
        conn = MavlinkConnection("udpin:127.0.0.1:14550")
        with pytest.raises(TimeoutError):
            conn.connect(timeout=0.05)
        assert conn.tlog_path is None
    assert list(tmp_path.iterdir()) == []


def test_goi_nhan_qua_udp_doc_lai_duoc_tu_file_tlog(tmp_path, monkeypatch):
    """Đường thật: pymavlink thật, UDP loopback, đọc lại file bằng pymavlink."""
    monkeypatch.setattr(config, "TLOG_ENABLE", True)
    monkeypatch.setattr(config, "TLOG_DIR", str(tmp_path))
    port = _cong_udp_trong()
    try:
        conn = MavlinkConnection(f"udpin:127.0.0.1:{port}")
        fc = mavutil.mavlink_connection(
            f"udpout:127.0.0.1:{port}", source_system=1, source_component=1
        )
    except OSError as exc:  # máy chặn socket: không kết luận được, không giả PASS
        pytest.skip(f"không mở được UDP loopback: {exc}")

    dung = threading.Event()

    def phat():
        while not dung.is_set():
            fc.mav.heartbeat_send(MAV.MAV_TYPE_QUADROTOR, MAV.MAV_AUTOPILOT_ARDUPILOTMEGA, 0, 0, 0)
            fc.mav.sys_status_send(0, 0, 0, 0, 16000, -1, -1, 0, 0, 0, 0, 0, 0)
            time.sleep(0.05)

    t = threading.Thread(target=phat, daemon=True)
    t.start()
    try:
        assert conn.connect(timeout=5) == (1, 1)
        het = time.monotonic() + 1.0
        while time.monotonic() < het:
            conn.recv_match(blocking=True, timeout=0.2)
        path = conn.tlog_path
        conn.close()
    finally:
        dung.set()
        t.join(timeout=2)
        fc.close()

    assert path is not None and path.stat().st_size > 0
    doc = mavutil.mavlink_connection(str(path))
    loai = set()
    while (msg := doc.recv_match(blocking=False)) is not None:
        if msg.get_srcSystem() == 1:
            loai.add(msg.get_type())
    doc.close()
    assert {"HEARTBEAT", "SYS_STATUS"} <= loai
