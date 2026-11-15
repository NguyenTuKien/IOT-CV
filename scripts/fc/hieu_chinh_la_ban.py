#!/usr/bin/env python3
"""Hiệu chỉnh la bàn ngay trên FC (Onboard Mag Calibration) — thay nút "Start" ở Mission Planner.

Người cầm drone xoay nó qua mọi hướng (mũi lên trời, mũi xuống đất, nằm nghiêng trái, nghiêng
phải, úp ngược, mỗi tư thế quay một vòng) tới khi script báo 100 %. Script chỉ gửi lệnh
`MAV_CMD_DO_START_MAG_CAL` và đọc tiến độ; KHÔNG arm, KHÔNG lệnh motor.

    uv run --with pyserial python scripts/fc/hieu_chinh_la_ban.py COM6
    uv run python scripts/fc/hieu_chinh_la_ban.py udpin:0.0.0.0:14550   # qua Wi-Fi DroneBridge

Làm ở ngoài trời, cách xe, cột sắt, sàn bê tông có thép vài mét, pin cắm sẵn trên drone (dây
pin cũng làm lệch la bàn, nên hiệu chỉnh phải có nó). Để tay cầm TẮT trong lúc xoay: không có
sóng RC thì FC không thể arm. FC phải khởi động lúc ĐÃ có pin, không thì la bàn chưa được dò
(`COMPASS_DEV_ID` = 0) — script báo và dừng.

Kết quả tự lưu (autosave). ArduPilot chỉ dùng offset mới sau khi khởi động lại: `--reboot`.
Mã thoát 0 = mọi la bàn báo thành công.

Bẫy (FC thật, 01/11/2026): đã BẮT ĐẦU hiệu chỉnh thì kể cả huỷ giữa chừng, FC vẫn chặn arm bằng
`PreArm: Compass calibrated requires reboot` tới khi khởi động lại; offset cũ không đổi. Hết giờ mà
có `--reboot` thì script huỷ rồi khởi động lại luôn.

Người dùng quen tay với Mission Planner (SETUP > Mandatory Hardware > Compass > Onboard Mag
Calibration > Start) — cùng một lệnh MAVLink; script này là đường dự phòng, ví dụ khi chỉ nối được
qua Wi-Fi.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import SitlError  # noqa: E402
from kiem_fc import noi_fc  # noqa: E402
from nap_param import reboot  # noqa: E402
from pymavlink import mavutil  # noqa: E402

MAV = mavutil.mavlink
CMD_START = 42424  # MAV_CMD_DO_START_MAG_CAL
CMD_CANCEL = 42426  # MAV_CMD_DO_CANCEL_MAG_CAL
TRANG_THAI = {
    0: "chưa bắt đầu",
    1: "chờ bắt đầu",
    2: "đang đo (bước 1)",
    3: "đang đo (bước 2)",
    4: "THÀNH CÔNG",
    5: "HỎNG",
    6: "HỎNG — sai hướng lắp (COMPASS_ORIENT)",
    7: "HỎNG — bán kính lệch",
}
THANH_CONG = 4
# Độ khớp (fitness) là sai số trung bình của các điểm đo so với mặt cầu, mG. ArduPilot nhận
# tới COMPASS_CAL_FIT (mặc định 16); dưới 10 là tốt.
FIT_TOT = 10.0


def doc_param(fc, ten: str) -> float | None:
    fc.master.mav.param_request_read_send(
        fc.master.target_system, fc.master.target_component, ten.encode(), -1
    )
    het = time.monotonic() + 5
    while time.monotonic() < het:
        m = fc.master.recv_match(type="PARAM_VALUE", blocking=True, timeout=1)
        if m is not None and m.param_id.rstrip("\x00") == ten:
            return m.param_value
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx của FC, hoặc udpin:0.0.0.0:14550 qua Wi-Fi")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--giay", type=float, default=240, help="bỏ cuộc sau chừng này giây")
    ap.add_argument("--reboot", action="store_true", help="khởi động lại FC khi xong")
    args = ap.parse_args()

    fc = noi_fc(args.ket_noi, args.baud)
    ket: dict[int, object] = {}
    try:
        hb = fc.recv_match("HEARTBEAT", timeout=5)
        if hb is not None and hb.base_mode & MAV.MAV_MODE_FLAG_SAFETY_ARMED:
            raise SitlError("FC đang ARM — không hiệu chỉnh.")
        dev = doc_param(fc, "COMPASS_DEV_ID")
        if not dev:
            raise SitlError(
                f"COMPASS_DEV_ID = {dev}: FC chưa thấy la bàn. Cắm pin rồi khởi động lại FC."
            )
        cu = [doc_param(fc, f"COMPASS_OFS_{t}") for t in "XYZ"]
        print(f"La bàn {dev:.0f}, offset hiện tại {cu}", flush=True)

        fc.master.mav.command_long_send(
            fc.master.target_system, fc.master.target_component, CMD_START, 0,
            0, 1, 1, 0, 0, 0, 0,  # mọi la bàn, tự thử lại, tự lưu, không chờ, không tự reboot
        )  # fmt: skip
        ack = fc.recv_match("COMMAND_ACK", condition=f"COMMAND_ACK.command=={CMD_START}", timeout=5)
        if ack is None or ack.result != MAV.MAV_RESULT_ACCEPTED:
            raise SitlError(f"FC không nhận lệnh bắt đầu: {ack}")
        print("BẮT ĐẦU — xoay drone qua mọi hướng, chậm và đều.", flush=True)

        in_luc, tien_do = 0.0, {}
        het = time.monotonic() + args.giay
        while time.monotonic() < het:
            m = fc.master.recv_match(
                type=["MAG_CAL_PROGRESS", "MAG_CAL_REPORT", "STATUSTEXT"], blocking=True, timeout=1
            )
            if m is None:
                continue
            t = m.get_type()
            if t == "STATUSTEXT":
                print(f"  FC: {m.text}", flush=True)
            elif t == "MAG_CAL_PROGRESS":
                tien_do[m.compass_id] = m.completion_pct
                if time.monotonic() - in_luc > 2:
                    phan = ", ".join(f"la bàn {k}: {v}%" for k, v in sorted(tien_do.items()))
                    print(f"  {phan}", flush=True)
                    in_luc = time.monotonic()
            elif t == "MAG_CAL_REPORT":
                ket[m.compass_id] = m
                if all(r.cal_status in (THANH_CONG, 5, 6, 7) for r in ket.values()) and set(
                    ket
                ) >= set(tien_do):
                    break
        else:
            fc.master.mav.command_long_send(
                fc.master.target_system, fc.master.target_component, CMD_CANCEL, 0,
                0, 0, 0, 0, 0, 0, 0,
            )  # fmt: skip
            if args.reboot:
                reboot(fc)
            raise SitlError(
                f"Hết {args.giay:.0f} s chưa xong — đã huỷ. Chạy lại, xoay đủ hướng hơn. "
                + ("Đã khởi động lại FC." if args.reboot else "FC đòi khởi động lại trước khi arm.")
            )

        dat = True
        for k, r in sorted(ket.items()):
            ofs = tuple(round(v, 1) for v in (r.ofs_x, r.ofs_y, r.ofs_z))
            trang_thai = TRANG_THAI.get(r.cal_status, r.cal_status)
            tot = " (tốt)" if r.fitness < FIT_TOT else ""
            print(
                f"La bàn {k}: {trang_thai}, độ khớp {r.fitness:.1f} mG{tot}, offset {ofs}, "
                f"đã lưu={bool(r.autosaved)}"
            )
            dat &= r.cal_status == THANH_CONG and bool(r.autosaved)
            if r.cal_status == THANH_CONG:
                print(f"  độ dài vector offset {math.sqrt(sum(v * v for v in ofs)):.0f} mG")
        if dat and args.reboot:
            print("Khởi động lại FC để dùng offset mới…", flush=True)
            reboot(fc)
            fc = noi_fc(args.ket_noi, args.baud)
            print(f"Offset sau reboot: {[doc_param(fc, f'COMPASS_OFS_{t}') for t in 'XYZ']}")
        elif dat:
            print("Xong. Khởi động lại FC trước khi bay (offset mới chỉ dùng sau reboot).")
        print("KET QUA:", "PASS" if dat else "FAIL")
        return 0 if dat else 1
    except SitlError as exc:
        print(f"LỖI: {exc}")
        print("KET QUA: FAIL")
        return 1
    finally:
        fc.stop()


if __name__ == "__main__":
    sys.exit(main())
