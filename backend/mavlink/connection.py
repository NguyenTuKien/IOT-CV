"""Kết nối MAVLink — GIAI ĐOẠN 5, mở rộng ở Phase 05.

Module này chỉ làm một việc: mở link tới flight controller (SITL hoặc drone thật
qua ESP32 bridge), chờ HEARTBEAT, và là CỬA DUY NHẤT để ghi ra socket. Không
parse telemetry ở đây (xem `telemetry.py`), không quyết định lệnh ở đây (xem
`control.py`).

╔══════════════════════════════════════════════════════════════════════════╗
║  LUẬT CHO PHASE 06 VÀ 07 — ĐỌC TRƯỚC KHI GỬI BẤT KỲ LỆNH NÀO             ║
║                                                                          ║
║  MỌI lời gọi `master.mav.*_send()` PHẢI đi qua `MavlinkConnection.send`: ║
║                                                                          ║
║      conn.send(conn.master.mav.command_long_send, ...)   # ĐÚNG          ║
║      conn.master.mav.command_long_send(...)              # SAI           ║
║                                                                          ║
║  Vì sao: từ Phase 06 sẽ có HAI thread cùng ghi vào một socket — thread   ║
║  đọc telemetry và vòng dead-man. Hai thread ghi xen kẽ làm byte của hai  ║
║  gói đan vào nhau; flight controller bỏ gói TRONG IM LẶNG. Không có      ║
║  exception, không có log, lệnh chỉ đơn giản là không tới nơi. Đây là     ║
║  loại bug khó tìm nhất trong cả dự án.                                   ║
║                                                                          ║
║  Kiểm bằng:  grep -rn "\\.mav\\." backend/                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

Chạy trực tiếp để kiểm tra CỔNG PASS 5A:

    python -m backend.mavlink.connection
"""

from __future__ import annotations

import contextlib
import logging
import queue
import socket
import struct
import threading
import time
from pathlib import Path

from backend import config

log = logging.getLogger(__name__)

# MAV_CMD id — đặt tên thay vì rải số trần trong code.
MAV_CMD_SET_MESSAGE_INTERVAL = 511
MAV_CMD_REQUEST_MESSAGE = 512

# HEARTBEAT.autopilot của thiết bị KHÔNG phải flight controller (GCS, cầu ESP32).
MAV_AUTOPILOT_INVALID = 8

# HOME_POSITION không có stream rate: nó là message sự kiện, phải xin từng lần.
MSG_ID_HOME_POSITION = 242

# Tần số ta CHỦ ĐỘNG xin flight controller gửi, message_id -> Hz.
#
# Mặc định ArduPilot gửi một số message rất chậm (ATTITUDE có khi chỉ 1-4 Hz),
# HUD sẽ giật. Xin lại sau MỖI lần nối lại, không phải chỉ lần đầu.
#
# KHÔNG đặt interval cho STATUSTEXT (253) và nhóm MISSION_*: chúng là message
# sự kiện, FC tự đẩy khi có việc — xin nhịp cho chúng là vô nghĩa.
STREAM_RATES: dict[int, float] = {
    0: 1,  # HEARTBEAT            — phát hiện mất link
    1: 2,  # SYS_STATUS           — cờ sức khoẻ cảm biến, điện áp dự phòng
    24: 2,  # GPS_RAW_INT         — fix type + số vệ tinh (đổi chậm)
    30: 10,  # ATTITUDE           — chân trời giả phải mượt
    33: 5,  # GLOBAL_POSITION_INT — marker bản đồ
    74: 5,  # VFR_HUD             — tốc độ mặt đất, tốc độ leo
    132: 5,  # DISTANCE_SENSOR    — khoảng cách vật cản (Phase 07)
    147: 1,  # BATTERY_STATUS     — dòng điện + % pin
    193: 2,  # EKF_STATUS_REPORT  — nguồn DUY NHẤT của `ekf_ok`, xem telemetry.py
    330: 5,  # OBSTACLE_DISTANCE  — mảng 72 cung proximity (Phase 07)
}

# GHI CHO PHASE 07 — đo trên SITL ArduCopter 4.7-dev ngày 2026-09-22:
# xin nhịp cho OBSTACLE_DISTANCE (330) bị flight controller trả lời bằng
# STATUSTEXT "No ap_message for mavlink id (330)", tức là ArduPilot KHÔNG lập
# lịch được message này qua SET_MESSAGE_INTERVAL — nó do driver proximity tự
# đẩy khi có cảm biến. Dòng 330 ở trên vì thế vô hại nhưng cũng vô tác dụng;
# đừng mất công gỡ lỗi "sao xin rồi mà không thấy". DISTANCE_SENSOR (132) thì
# xin được, chỉ là SITL này chưa gắn rangefinder nên đo ra 0 Hz.

# Nghỉ giữa hai lệnh SET_MESSAGE_INTERVAL. Dội 9 lệnh trong 1 ms thì FC hoặc
# link nối tiếp chậm sẽ rớt bớt — mất nhịp của đúng message đó, im lặng.
_STREAM_REQUEST_GAP_S = 0.02

# Bộ đệm file tlog. Link Wi-Fi tới FC chở tối đa ~11 KB/s (UART 115200), nên 4 KB đệm
# = laptop tắt ngang mất dưới 1 s telemetry. Mặc định của Python (8 KB) là gần 1 s.
_TLOG_BUFFER_BYTES = 4096

# `_recv` trả cái này thay cho message khi bỏ qua một reset UDP giả của Windows, để
# người gọi phân biệt được với None = hết giờ chờ.
_UDP_RESET = object()


class _TlogWriter:
    """Ghi gói MAVLink ra file .tlog: 8 byte giờ nhận (µs, big-endian, 2 bit cuối = 0)
    + gói MAVLink nguyên vẹn — đúng định dạng Mission Planner / MAVExplorer / pymavlink đọc.

    KHÔNG dùng `mavfile.setup_logfile()` của pymavlink: ĐÃ ĐO 01/11/2026 (pymavlink
    2.4.50) — `mavudp.recv_msg` không bao giờ ghi `self.logfile`, nên với link UDP (đúng
    đường Wi-Fi của drone) file tlog tạo ra nhưng RỖNG, không báo lỗi gì. Ở đây móc vào
    `post_message`, chỗ mọi lớp kết nối của pymavlink (UDP, serial, TCP) đều đi qua.

    Đóng mà chưa ghi gói nào thì XOÁ file: mỗi lần nối hỏng (chưa bật pin drone, ESP32 chưa
    vào hotspot) backend thử lại vài giây một lần, và 01/11/2026 để lại 66 file 0 byte trong
    75 file tlog của buổi chiều — tìm chuyến bay thật giữa đống đó rất mệt."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._file = open(path, "wb", buffering=_TLOG_BUFFER_BYTES)  # noqa: SIM115
        self._bao_loi = False
        self.packets = 0

    def write(self, msg) -> None:
        f = self._file
        if f is None or msg.get_type() == "BAD_DATA":
            return
        usec = int(time.time() * 1.0e6) & ~3
        try:
            f.write(struct.pack(">Q", usec) + msg.get_msgbuf())
            self.packets += 1
        except (OSError, ValueError) as exc:
            # Đầy đĩa / file đã đóng: thôi ghi tlog, không được làm chết thread đọc.
            if not self._bao_loi:
                self._bao_loi = True
                log.warning("Ghi tlog %s hỏng: %s — bỏ tlog, telemetry vẫn chạy", self.path, exc)

    def close(self) -> bool:
        """Đóng file. Trả False nếu file rỗng và đã bị xoá."""
        f, self._file = self._file, None  # tháo trước, đóng sau: thread đọc thấy None thì bỏ qua
        if f is not None:
            with contextlib.suppress(OSError, ValueError):
                f.close()
        if self.packets:
            return True
        try:
            self.path.unlink(missing_ok=True)
        except OSError as exc:
            log.warning("Không xoá được tlog rỗng %s: %s", self.path, exc)
            return True
        return False


class MavlinkConnection:
    """Bọc `mavutil.mavlink_connection` với endpoint lấy từ config."""

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint or config.MAVLINK_ENDPOINT
        self.master = None
        self.target_system: int | None = None
        self.target_component: int | None = None
        # Xem khối LUẬT ở đầu file.
        self._send_lock = threading.Lock()
        # command_id -> danh sách hàng đợi của những người đang chờ ack.
        self._ack_waiters: dict[int, list[queue.Queue]] = {}
        self._ack_lock = threading.Lock()
        # File .tlog của lần nối hiện tại (TLOG_ENABLE), None khi tắt hoặc mở hỏng.
        self.tlog_path: Path | None = None
        self._tlog: _TlogWriter | None = None

    def connect(self, timeout: float | None = None) -> tuple[int, int]:
        """Mở link và chờ heartbeat đầu tiên.

        Raises:
            TimeoutError: không nhận được heartbeat trong `timeout` giây.
        """
        # Import trong hàm để unit test (pure logic) không phụ thuộc pymavlink.
        from pymavlink import mavutil

        wait = config.HEARTBEAT_TIMEOUT_S if timeout is None else timeout
        log.info(
            "Mở MAVLink tới %s (sysid=%s compid=%s)",
            self.endpoint,
            config.MAVLINK_SOURCE_SYSTEM,
            config.MAVLINK_SOURCE_COMPONENT,
        )
        self.master = mavutil.mavlink_connection(
            self.endpoint,
            baud=config.MAVLINK_BAUD,
            source_system=config.MAVLINK_SOURCE_SYSTEM,
            source_component=config.MAVLINK_SOURCE_COMPONENT,
        )
        # Mở tlog TRƯỚC khi chờ heartbeat để file có cả những gói đầu tiên.
        self._open_tlog()

        heartbeat = self._wait_vehicle_heartbeat(wait, self._udp_hello_target())
        if heartbeat is None:
            # Đóng trước khi ném: `self.master` đã bind cổng UDP ở dòng trên,
            # để nguyên là bỏ lại một cổng đã chiếm cho gc dọn hộ.
            self.close()
            raise TimeoutError(
                f"Không nhận được HEARTBEAT của flight controller từ {self.endpoint} "
                f"sau {wait:.0f}s"
            )

        # Lấy sysid từ CHÍNH gói của máy bay. `master.target_system` của pymavlink
        # chỉ đổi khi nó tự đoán gói là của máy bay, nên trước đó vẫn là 0.
        self.target_system = heartbeat.get_srcSystem()
        self.target_component = heartbeat.get_srcComponent()
        self.master.target_system = self.target_system
        self.master.target_component = self.target_component
        log.info(
            "Heartbeat OK — system=%s component=%s",
            self.target_system,
            self.target_component,
        )
        return self.target_system, self.target_component

    def _open_tlog(self) -> None:
        """Ghi mọi gói nhận được ra `TLOG_DIR/<YYYYMMDD-HHMMSS>.tlog` (xem `_TlogWriter`).
        Mở hỏng thì chỉ cảnh báo: thiếu tlog không được chặn việc nối tới máy bay."""
        self.tlog_path = None
        self._tlog = None
        if not config.TLOG_ENABLE:
            return
        stamp = time.strftime("%Y%m%d-%H%M%S")
        path = Path(config.TLOG_DIR) / f"{stamp}.tlog"
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            n = 1
            while path.exists():  # nối lại trong cùng một giây: thêm hậu tố, không ghi đè
                n += 1
                path = path.with_name(f"{stamp}-{n}.tlog")
            writer = _TlogWriter(path)
        except OSError as exc:
            log.warning("Không mở được tlog %s: %s — vẫn nối MAVLink, không ghi tlog", path, exc)
            return
        goc = getattr(self.master, "post_message", None)
        if goc is not None:

            def post_message(msg, _goc=goc, _w=writer):
                # pymavlink tự chặn post hai lần một gói bằng cờ `_posted`; ghi theo cùng cờ.
                moi = "_posted" not in msg.__dict__
                _goc(msg)
                if moi:
                    _w.write(msg)

            self.master.post_message = post_message
        self._tlog = writer
        self.tlog_path = path
        log.info("Ghi telemetry MAVLink vào %s", path)

    def _close_tlog(self) -> None:
        writer, self._tlog = self._tlog, None
        if writer is not None and not writer.close():
            self.tlog_path = None  # file rỗng đã bị xoá

    def _udp_hello_target(self) -> tuple[str, int] | None:
        """Địa chỉ bo DroneBridge cần chào khi nghe UDP (`config.MAVLINK_UDP_HELLO`), hoặc None.

        Tìm tên ở MỖI lần nối: IP DHCP của bo đổi mỗi lần hotspot khởi động lại. pymavlink coi
        cả `udp:` lẫn `udpin:` là NGHE; `udpout:`, tcp, cổng COM thì không chào."""
        if not self.endpoint.startswith(("udpin:", "udp:")) or not config.MAVLINK_UDP_HELLO:
            return None
        host, _, port = config.MAVLINK_UDP_HELLO.rpartition(":")
        try:
            return socket.gethostbyname(host), int(port)
        except (OSError, ValueError) as exc:
            log.warning(
                "Không tìm được %s để chào DroneBridge (%s), chỉ chờ bo tự gửi",
                config.MAVLINK_UDP_HELLO,
                exc,
            )
            return None

    def _say_hello(self, addr: tuple[str, int]) -> None:
        """Gửi một HEARTBEAT kiểu GCS tới `addr` từ chính cổng đang nghe: bo DroneBridge thấy
        gói tới là thêm laptop vào danh sách client UDP và bắt đầu đẩy gói của FC về."""
        from pymavlink import mavutil

        # pymavlink ở chế độ udpin chỉ gửi cho địa chỉ ĐÃ TỪNG gửi tới nó. Chưa nhận gói nào
        # thì danh sách rỗng và gói chào không đi đâu cả, nên tự thêm địa chỉ bo vào.
        self.master.clients.add(addr)
        self.master.clients_last_alive[addr] = time.time()
        self.send(
            self.master.mav.heartbeat_send,
            mavutil.mavlink.MAV_TYPE_GCS,
            mavutil.mavlink.MAV_AUTOPILOT_INVALID,
            0,
            0,
            0,
        )

    def _wait_vehicle_heartbeat(self, wait: float, hello: tuple[str, int] | None = None):
        """Chờ HEARTBEAT của flight controller, bỏ qua heartbeat của thiết bị khác.
        Có `hello` thì chào bo DroneBridge mỗi `MAVLINK_UDP_HELLO_PERIOD_S` giây trong lúc chờ.

        ĐÃ ĐO trên drone thật 25/10/2026 (ESP32 DroneBridge, UDP 14550): cổng nhận ba
        nguồn heartbeat — (255,0) type GCS và (255,68) DroneBridge type
        ONBOARD_CONTROLLER, đều autopilot INVALID, cùng FC (1,1). Gói GCS tới TRƯỚC.
        `wait_heartbeat()` trả gói đầu tiên bất kể nguồn, backend chốt sysid 0 rồi
        `_tu_flight_controller` lọc bỏ sạch gói của FC: web hiện toàn ô trống. SITL
        không lộ lỗi này vì chỉ có FC phát heartbeat.
        """
        deadline = time.monotonic() + wait
        next_hello = time.monotonic()
        while (remaining := deadline - time.monotonic()) > 0:
            step = remaining
            if hello is not None:
                if time.monotonic() >= next_hello:
                    self._say_hello(hello)
                    next_hello = time.monotonic() + config.MAVLINK_UDP_HELLO_PERIOD_S
                step = min(remaining, max(next_hello - time.monotonic(), 0.01))
            msg = self._recv(type="HEARTBEAT", blocking=True, timeout=step)
            if msg is _UDP_RESET:
                continue
            if msg is None:
                if hello is None:
                    return None
                continue  # hết `step` (tới lượt chào lại), chưa hết `wait`
            if getattr(msg, "autopilot", MAV_AUTOPILOT_INVALID) != MAV_AUTOPILOT_INVALID:
                return msg
        return None

    @property
    def connected(self) -> bool:
        return self.master is not None and self.target_system is not None

    def recv_match(self, *, blocking: bool = True, timeout: float = 1.0):
        """Nhận message MAVLink kế tiếp (bất kể loại nào)."""
        if self.master is None:
            return None
        msg = self._recv(blocking=blocking, timeout=timeout)
        return None if msg is _UDP_RESET else msg

    def _recv(self, **kwargs):
        """`master.recv_match`, trừ một lỗi giả của Windows với UDP.

        Windows: gửi UDP tới một địa chỉ không còn ai nghe (ESP32 vừa khởi động lại đổi
        cổng nguồn — pymavlink ở chế độ udpin gửi cho MỌI địa chỉ từng gửi tới nó) thì lần
        `recvfrom` kế tiếp ném WSAECONNRESET, dù socket vẫn nhận bình thường. Coi đó là mất
        link thì web báo "Mất liên lạc" và nối lại vô cớ. Với UDP, mất link thật đã có
        `LINK_TIMEOUT_S` lo; với TCP (SITL) reset là đứt thật, vẫn ném lên để nối lại."""
        try:
            return self.master.recv_match(**kwargs)
        except ConnectionResetError as exc:
            if not self.endpoint.startswith("udp"):
                raise
            log.debug("Bỏ qua reset UDP (ICMP từ một địa chỉ cũ): %s", exc)
            return _UDP_RESET

    # -- ghi ----------------------------------------------------------------
    def send(self, fn, *args, **kwargs):
        """Cửa DUY NHẤT để ghi ra socket MAVLink. Xem khối LUẬT ở đầu file.

        Raises:
            ConnectionError: chưa có link. Gọi được thì ít nhất socket đã mở —
                không im lặng nuốt lệnh khi chưa nối.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không gửi được lệnh")
        with self._send_lock:
            return fn(*args, **kwargs)

    # -- COMMAND_ACK --------------------------------------------------------
    #
    # Chỉ MỘT thread được đọc socket (thread telemetry). Hàm gửi lệnh chạy ở
    # thread khác nên không tự `recv_match` được — làm thế là hai bên cùng đọc
    # và mỗi bên nuốt mất message của bên kia, biểu hiện ra ngoài là lệnh
    # "treo vĩnh viễn ở accepted". Thay vào đó thread đọc gọi `route_ack()`,
    # còn người gửi đăng ký một hàng đợi TRƯỚC KHI gửi.
    def expect_ack(self, command_id: int) -> queue.Queue:
        """Đăng ký chờ COMMAND_ACK của `command_id`. GỌI TRƯỚC KHI GỬI.

        Đăng ký sau khi gửi là một cuộc đua có thật: SITL trên loopback trả ack
        trong chưa tới một mili-giây, kịp về trước khi ta kịp đăng ký, và ack
        đó rơi vào hư không.
        """
        waiter: queue.Queue = queue.Queue(maxsize=8)
        with self._ack_lock:
            self._ack_waiters.setdefault(command_id, []).append(waiter)
        return waiter

    def stop_expecting(self, command_id: int, waiter: queue.Queue) -> None:
        """Bỏ đăng ký. Luôn gọi trong `finally`, nếu không hàng đợi rò rỉ."""
        with self._ack_lock:
            danh_sach = self._ack_waiters.get(command_id)
            if not danh_sach:
                return
            if waiter in danh_sach:
                danh_sach.remove(waiter)
            if not danh_sach:
                del self._ack_waiters[command_id]

    def route_ack(self, msg) -> None:
        """Thread đọc gọi hàm này với MỖI COMMAND_ACK nhận được."""
        command_id = getattr(msg, "command", None)
        if command_id is None:
            return
        with self._ack_lock:
            waiters = list(self._ack_waiters.get(int(command_id), ()))
        for waiter in waiters:
            # Hàng đợi đầy = người chờ đã bỏ đi. Bỏ qua, không chặn thread đọc.
            with contextlib.suppress(queue.Full):
                waiter.put_nowait(msg)

    def request_streams(self, rates: dict[int, float] | None = None) -> None:
        """Xin FC gửi từng message ở tần số trong `STREAM_RATES`.

        PHẢI gọi lại sau MỖI lần nối lại. Đặt ngoài vòng reconnect là lỗi kinh
        điển: nối lại xong HUD giật mà không ai hiểu vì sao.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không xin được stream")
        table = STREAM_RATES if rates is None else rates
        for msg_id, hz in table.items():
            self.send(
                self.master.mav.command_long_send,
                self.target_system,
                self.target_component,
                MAV_CMD_SET_MESSAGE_INTERVAL,
                0,  # confirmation
                msg_id,
                int(1_000_000 / hz),  # param2: chu kỳ tính bằng micro-giây
                0,
                0,
                0,
                0,
                0,
            )
            time.sleep(_STREAM_REQUEST_GAP_S)
        log.info("Đã xin %d stream rate", len(table))

    def request_message(self, msg_id: int) -> None:
        """Xin FC gửi MỘT message, một lần (MAV_CMD_REQUEST_MESSAGE).

        Dùng cho message sự kiện không có nhịp, như HOME_POSITION.
        """
        if self.master is None:
            raise ConnectionError("Chưa có link MAVLink — không xin được message")
        self.send(
            self.master.mav.command_long_send,
            self.target_system,
            self.target_component,
            MAV_CMD_REQUEST_MESSAGE,
            0,
            msg_id,
            0,
            0,
            0,
            0,
            0,
            0,
        )

    def close(self) -> None:
        self._close_tlog()
        if self.master is not None:
            self.master.close()
            self.master = None
        self.target_system = None
        self.target_component = None


def _main() -> int:
    """CỔNG PASS 5A — in ra system ID và trạng thái heartbeat."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    conn = MavlinkConnection()
    print(f"Đang kết nối tới {conn.endpoint} ...")
    try:
        system, component = conn.connect()
    except (TimeoutError, OSError) as exc:
        print(f"FAIL: {exc}")
        print("Kiểm tra SITL đã chạy chưa:  make sitl")
        return 1

    print()
    print("=== CỔNG PASS 5A ===")
    print("Python connected   : yes")
    print(f"System ID          : {system}")
    print(f"Component ID       : {component}")
    print("Heartbeat received : yes")

    try:
        conn.request_streams()
        print(f"Stream rates       : đã xin {len(STREAM_RATES)} message")
    except Exception as exc:  # noqa: BLE001 — chỉ là bước kiểm, không chặn cổng pass
        print(f"Stream rates       : FAIL ({exc})")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
