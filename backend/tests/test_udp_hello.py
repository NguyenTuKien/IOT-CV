"""Backend nghe UDP phải tự chào bo DroneBridge (config.MAVLINK_UDP_HELLO).

Đo 02/11/2026 trên drone thật: sau một lần hotspot đổi kênh, `udp_clients` của bo rỗng. Bo vẫn
đọc FC nhưng không gửi gì về laptop, backend chờ mãi tới khi rút cắm pin drone. Một gói gửi
tới bo là bo thêm lại client và đẩy gói về sau 0,27 s. Bo giả ở đây làm đúng như vậy: im lặng
tới khi nhận được gói, rồi mới phát heartbeat của FC về địa chỉ vừa gửi tới nó.
"""

from __future__ import annotations

import socket
import threading

import pytest
from pymavlink import mavutil

from backend import config
from backend.mavlink import connection as connection_mod
from backend.mavlink.connection import MavlinkConnection

MAV = mavutil.mavlink


def _cong_udp_trong() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _BoDroneBridge:
    """Bo giả: chỉ đẩy heartbeat của FC (1,1) cho địa chỉ đã từng gửi gói tới nó."""

    def __init__(self) -> None:
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.settimeout(0.05)
        self.port = self.sock.getsockname()[1]
        self.nhan: list[tuple[tuple[str, int], object]] = []  # (địa chỉ nguồn, tin MAVLink)
        self._dung = threading.Event()
        self._t = threading.Thread(target=self._chay, daemon=True)

    def _chay(self) -> None:
        enc = MAV.MAVLink(None, srcSystem=1, srcComponent=1)
        parser = MAV.MAVLink(None)
        khach = None
        while not self._dung.is_set():
            try:
                data, khach = self.sock.recvfrom(4096)
                self.nhan.extend((khach, m) for m in parser.parse_buffer(data) or [])
            except TimeoutError:
                pass
            if khach is not None:
                hb = MAV.MAVLink_heartbeat_message(
                    MAV.MAV_TYPE_QUADROTOR, MAV.MAV_AUTOPILOT_ARDUPILOTMEGA, 0, 0, 0, 3
                )
                self.sock.sendto(hb.pack(enc), khach)

    def __enter__(self) -> _BoDroneBridge:
        self._t.start()
        return self

    def __exit__(self, *exc) -> None:
        self._dung.set()
        self._t.join(timeout=2)
        self.sock.close()


def _ket_noi(cong: int) -> MavlinkConnection:
    try:
        return MavlinkConnection(f"udpin:127.0.0.1:{cong}")
    except OSError as exc:  # máy chặn socket: không kết luận được, không giả PASS
        pytest.skip(f"không mở được UDP loopback: {exc}")


def test_cho_udp_thi_chao_bo_va_noi_duoc(monkeypatch):
    cong = _cong_udp_trong()
    with _BoDroneBridge() as bo:
        monkeypatch.setattr(config, "MAVLINK_UDP_HELLO", f"127.0.0.1:{bo.port}")
        monkeypatch.setattr(config, "MAVLINK_UDP_HELLO_PERIOD_S", 0.2)
        conn = _ket_noi(cong)
        try:
            assert conn.connect(timeout=5) == (1, 1)
        finally:
            conn.close()
    nguon, chao = bo.nhan[0]
    # Chào từ CHÍNH cổng đang nghe: bo ghi nhớ địa chỉ này và đẩy gói về đúng cổng backend.
    assert nguon[1] == cong
    assert chao.get_type() == "HEARTBEAT" and chao.type == MAV.MAV_TYPE_GCS
    # Sysid của backend, không phải MAV_GCS_SYSID 255: không bật được failsafe GCS của FC.
    assert chao.get_srcSystem() == config.MAVLINK_SOURCE_SYSTEM != 255


def test_tat_chao_thi_bo_im_lang_va_het_gio(monkeypatch):
    """Đối chứng: cùng bo giả, không chào (conftest để trống) thì không bao giờ nối được."""
    assert config.MAVLINK_UDP_HELLO == ""
    with _BoDroneBridge() as bo:
        conn = _ket_noi(_cong_udp_trong())
        try:
            with pytest.raises(TimeoutError):
                conn.connect(timeout=0.6)
        finally:
            conn.close()
    assert bo.nhan == []


@pytest.mark.parametrize("endpoint", ["udpin:0.0.0.0:14550", "udp:0.0.0.0:14550"])
def test_endpoint_nghe_udp_thi_chao(monkeypatch, endpoint):
    monkeypatch.setattr(config, "MAVLINK_UDP_HELLO", "127.0.0.1:14550")
    assert MavlinkConnection(endpoint)._udp_hello_target() == ("127.0.0.1", 14550)


@pytest.mark.parametrize("endpoint", ["udpout:127.0.0.1:14550", "tcp:127.0.0.1:5760", "COM6"])
def test_endpoint_khong_nghe_udp_thi_khong_chao(monkeypatch, endpoint):
    monkeypatch.setattr(config, "MAVLINK_UDP_HELLO", "127.0.0.1:14550")
    assert MavlinkConnection(endpoint)._udp_hello_target() is None


def test_ten_bo_khong_tim_thay_thi_chi_cho(monkeypatch):
    """Hotspot tắt thì tên *.mshome.net không có: không chào, không ném, vẫn chờ như cũ."""

    def khong_co(_host):
        raise socket.gaierror(11001, "getaddrinfo failed")

    monkeypatch.setattr(config, "MAVLINK_UDP_HELLO", "DroneBridgeESP32.mshome.net:14550")
    monkeypatch.setattr(connection_mod.socket, "gethostbyname", khong_co)
    assert MavlinkConnection("udpin:0.0.0.0:14550")._udp_hello_target() is None


def test_gia_tri_sai_thi_khong_chao(monkeypatch):
    monkeypatch.setattr(config, "MAVLINK_UDP_HELLO", "127.0.0.1")  # thiếu cổng
    assert MavlinkConnection("udpin:0.0.0.0:14550")._udp_hello_target() is None
