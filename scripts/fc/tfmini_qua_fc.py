#!/usr/bin/env python3
"""Đọc và cấu hình TFmini Plus qua bo bay, không cần mạch USB-TTL.

Dùng gói MAVLink `SERIAL_CONTROL` với thiết bị `SERIAL_CONTROL_SERIAL0 + 3`: FC đọc/ghi thẳng cổng
SERIAL3 (pad T3/R3) giúp ta, qua đúng đường MAVLink đang nối (USB hoặc Wi-Fi). Cần: dây xanh TFmini
(TXD) → R3, dây trắng (RXD) → T3, PIN ĐANG CẮM (TFmini lấy 5 V từ BEC của stack), và
`RNGFND1_TYPE = 0` — driver rangefinder đang chạy sẽ đọc tranh mất byte trên SERIAL3.

    uv run --with pyserial python scripts/fc/tfmini_qua_fc.py COM6 doc
    uv run --with pyserial python scripts/fc/tfmini_qua_fc.py COM6 phien-ban
    uv run --with pyserial python scripts/fc/tfmini_qua_fc.py COM6 khoi-phuc
    uv run --with pyserial python scripts/fc/tfmini_qua_fc.py udpin:0.0.0.0:14550 doc

doc        đọc 6 s: số khung/giây, khoảng cách, cường độ, nhiệt độ. Không gửi gì xuống cảm biến.
phien-ban  hỏi phiên bản firmware (5A 04 01 5F). Có trả lời nghĩa là chiều T3 → dây trắng thông.
khoi-phuc  về cài đặt gốc (115200, Standard 9 byte đơn vị cm, 100 Hz), lưu, khởi động lại cảm biến
           rồi đọc lại. Đây là cách chữa "Rangefinder 1: No Data" khi cảm biến bị chỉnh sai.

Vì sao không dùng passthrough (`SERIAL_PASS1 0` + `SERIAL_PASS2 3`): trên bo này chiều đọc chạy,
nhưng chiều ghi từ USB kẹt sau vài lần gửi, và kẹt luôn cả MAVLink qua USB sau khi tắt passthrough
— chỉ khởi động lại FC mới gỡ được (25 và 26/10/2026).

Lệnh lấy từ SJ-PM-TFmini Plus A04 Product Manual mục 6.4 (bảng ở `scripts/bench_tfmini.py`).
Chỉ dùng khi drone DISARM: FC xử lý gói này trong vòng lặp chính. Mã thoát 0 = đạt.
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time

from pymavlink import mavutil

MAV = mavutil.mavlink
BAUD = 115200
THIET_BI = MAV.SERIAL_CONTROL_SERIAL0 + 3  # SERIAL3 = pad T3/R3
CO_HOI = MAV.SERIAL_CONTROL_FLAG_RESPOND | MAV.SERIAL_CONTROL_FLAG_MULTI
CHO_MS = 0  # >0 thì FC đứng chờ gom byte NGAY TRONG vòng lặp chính; hỏi dồn 30 ms một lần là đủ
LENH = {
    "phien_ban": bytes.fromhex("5A 04 01 5F"),
    "khoi_dong_lai": bytes.fromhex("5A 04 02 60"),
    "cai_dat_goc": bytes.fromhex("5A 04 10 6E"),
    "luu": bytes.fromhex("5A 04 11 6F"),
}
TAN_SO_TOI_THIEU = 50  # Hz; driver ArduPilot báo No Data nếu 200 ms không có khung hợp lệ


def tach_khung(buf: bytes) -> tuple[list[tuple[int, int, float]], list[bytes]]:
    """Tách luồng byte thành khung đo (59 59 …, 9 byte) và gói trả lời lệnh (5A len id …)."""
    khung, tra_loi, i = [], [], 0
    while i < len(buf) - 3:
        la_khung = buf[i] == 0x59 and buf[i + 1] == 0x59 and i + 9 <= len(buf)
        if la_khung and sum(buf[i:i + 8]) & 0xFF == buf[i + 8]:
            d, s, t = (buf[i + 2] | buf[i + 3] << 8, buf[i + 4] | buf[i + 5] << 8,
                       (buf[i + 6] | buf[i + 7] << 8) / 8 - 256)
            khung.append((d, s, t))
            i += 9
            continue
        n = buf[i + 1]
        la_goi = buf[i] == 0x5A and 4 <= n <= 16 and i + n <= len(buf)
        if la_goi and sum(buf[i:i + n - 1]) & 0xFF == buf[i + n - 1]:
            tra_loi.append(bytes(buf[i:i + n]))
            i += n
            continue
        i += 1
    return khung, tra_loi


class CongQuaFc:
    """SERIAL3 của FC, đọc/ghi bằng SERIAL_CONTROL."""

    def __init__(self, ket_noi: str) -> None:
        self.m = mavutil.mavlink_connection(ket_noi, baud=115200, source_system=255)
        t0 = time.monotonic()
        while time.monotonic() - t0 < 20:
            hb = self.m.recv_match(type="HEARTBEAT", blocking=True, timeout=1)
            # Bỏ heartbeat của GCS khác và của chính DroneBridge, chỉ lấy FC.
            la_fc = hb and hb.autopilot == MAV.MAV_AUTOPILOT_ARDUPILOTMEGA
            if la_fc and hb.type != MAV.MAV_TYPE_GCS:
                self.dich = (hb.get_srcSystem(), hb.get_srcComponent())
                if hb.base_mode & MAV.MAV_MODE_FLAG_SAFETY_ARMED:
                    raise SystemExit("FC đang ARM — không chạy.")
                self.dat_baud = True
                return
        raise SystemExit(f"Không có heartbeat của FC trên {ket_noi} sau 20 s.")

    def tham_so(self, ten: str) -> float:
        for _ in range(5):
            self.m.mav.param_request_read_send(*self.dich, ten.encode(), -1)
            msg = self.m.recv_match(type="PARAM_VALUE", condition=f'PARAM_VALUE.param_id=="{ten}"',
                                    blocking=True, timeout=1.5)
            if msg:
                return msg.param_value
        raise SystemExit(f"FC không trả lời tham số {ten}.")

    def _gui(self, data: bytes = b"") -> None:
        # Gói đầu kèm baud: FC gọi begin() để mở SERIAL3 (không driver nào mở khi
        # RNGFND1_TYPE = 0).
        baud, self.dat_baud = (BAUD if self.dat_baud else 0), False
        self.m.mav.serial_control_send(THIET_BI, CO_HOI, CHO_MS, baud, len(data),
                                       list(data.ljust(70, b"\0")))

    def _nhan(self, buf: bytearray) -> None:
        while msg := self.m.recv_match(type="SERIAL_CONTROL", blocking=False):
            if msg.flags & MAV.SERIAL_CONTROL_FLAG_REPLY and msg.device == THIET_BI:
                buf += bytes(msg.data[:msg.count])

    def ghi(self, data: bytes, buf: bytearray) -> None:
        for i in range(0, len(data), 70):
            self._gui(data[i:i + 70])
            self._nhan(buf)

    def doc(self, giay: float, buf: bytearray | None = None) -> bytearray:
        buf = bytearray() if buf is None else buf
        t0 = time.monotonic()
        while time.monotonic() - t0 < giay:
            self._gui()
            time.sleep(0.03)
            self._nhan(buf)
        return buf


def bao_cao(buf: bytes, giay: float) -> float:
    khung, _ = tach_khung(buf)
    tan_so = len(khung) / giay
    print(f"  {len(buf)} byte, {len(khung)} khung hợp lệ trong {giay:.0f} s "
          f"→ {tan_so:.1f} khung/giây")
    if khung:
        d = [k[0] for k in khung]
        cuong_do = statistics.median(k[1] for k in khung)
        print(f"  khoảng cách: nhỏ nhất {min(d)}, trung vị {statistics.median(d):.0f}, "
              f"lớn nhất {max(d)} (cm nếu đúng cài đặt gốc) · cường độ trung vị {cuong_do:.0f}"
              f" · nhiệt độ chip {khung[-1][2]:.0f} °C")
    elif buf:
        print("  Có byte nhưng không ra khung chuẩn 59 59: sai định dạng/baud. Mẫu:",
              buf[:48].hex(" "))
    return tan_so


def gui_lenh(cong: CongQuaFc, ten: str, cho: float = 5.0, nhac: float = 0.5) -> bytes | None:
    """Gửi một lệnh, nhắc lại mỗi `nhac` giây tới khi có gói trả lời cùng mã lệnh (byte thứ 3).

    Cảm biến đang ở 1 khung/giây ngủ giữa hai lần đo và bỏ lỡ lệnh tới lúc đó: 26/10/2026 cùng
    một lệnh có lần trả lời (trễ gần 1 s), có lần im. Cả bốn lệnh trong LENH lặp lại vô hại."""
    lenh = LENH[ten]
    buf = bytearray()
    t0 = time.monotonic()
    lan_gui, lan_cuoi = 0, -nhac
    while time.monotonic() - t0 < cho:
        if time.monotonic() - lan_cuoi >= nhac:
            cong.ghi(lenh, buf)
            lan_gui, lan_cuoi = lan_gui + 1, time.monotonic()
        cong.doc(0.05, buf)
        for goi in tach_khung(bytes(buf))[1]:
            if goi[2] == lenh[2]:
                print(f"  {ten}: gửi {lenh.hex(' ')} ({lan_gui} lần) → nhận {goi.hex(' ')} "
                      f"sau {time.monotonic() - t0:.1f} s")
                return goi
    print(f"  {ten}: gửi {lenh.hex(' ')} ({lan_gui} lần) → KHÔNG có trả lời sau {cho:g} s")
    return None


def chay(cong: CongQuaFc, viec: str) -> bool:
    if viec == "doc":
        return bao_cao(cong.doc(6), 6) >= TAN_SO_TOI_THIEU
    goi = gui_lenh(cong, "phien_ban")
    if goi is None or len(goi) < 7:
        print("  → Dây trắng không truyền được lệnh: kiểm mối hàn trắng → T3 (không phải R3), "
              "và chạm/chập với pad 9V bên cạnh.")
        return False
    print(f"  Firmware TFmini Plus v{goi[5]}.{goi[4]}.{goi[3]} — chiều FC → cảm biến "
          "(T3 → dây trắng) THÔNG")
    if viec == "phien-ban":
        return True
    print("Trước khi chỉnh:")
    bao_cao(cong.doc(2), 2)
    tra_loi = (gui_lenh(cong, "cai_dat_goc"), gui_lenh(cong, "luu"))
    ok = all(g is not None and g[3] == 0 for g in tra_loi)
    # Gửi đúng một lần: nhắc lại thì cảm biến khởi động lại liên tục. Có bản firmware khởi động lại
    # trước khi kịp trả lời, nên im lặng ở bước này không tính là lỗi.
    gui_lenh(cong, "khoi_dong_lai", cho=1.5, nhac=99)
    print("Sau khi về cài đặt gốc + lưu + khởi động lại:")
    return bao_cao(cong.doc(4), 4) >= TAN_SO_TOI_THIEU and ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("ket_noi", help="COM6, hoặc udpin:0.0.0.0:14550 (Wi-Fi qua DroneBridge)")
    ap.add_argument("viec", choices=["doc", "phien-ban", "khoi-phuc"])
    a = ap.parse_args()

    cong = CongQuaFc(a.ket_noi)
    try:
        if cong.tham_so("RNGFND1_TYPE") != 0:
            raise SystemExit("RNGFND1_TYPE đang bật: driver rangefinder sẽ đọc tranh byte trên "
                             "SERIAL3. Đặt 0, khởi động lại FC rồi chạy lại.")
        dat = chay(cong, a.viec)
    finally:
        cong.m.close()
    print("ĐẠT" if dat else "KHÔNG ĐẠT")
    return 0 if dat else 1


if __name__ == "__main__":
    sys.exit(main())
