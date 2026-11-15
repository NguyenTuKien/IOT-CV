#!/usr/bin/env python3
"""Rà sức khoẻ toàn bộ phần cứng nối vào FC, drone đứng yên — CHỈ ĐỌC.

Không gửi ARM, không gửi lệnh motor. Lệnh duy nhất gửi đi là xin tốc độ gói tin
(SET_MESSAGE_INTERVAL) và MAV_CMD_RUN_PREARM_CHECKS (FC tự chạy kiểm trước ARM rồi
báo bằng STATUSTEXT, không đổi trạng thái gì).

Ba chế độ:

    # 1. Chụp nhanh: nguồn, IMU, baro, la bàn, GPS, receiver, TFmini, ESC, pin, lỗi nội bộ
    uv run --offline --with pyserial python scripts/fc/kiem_phan_cung.py COM6

    # 2. Ghi CSV trong lúc người vận hành tự bấm Motor Test ở Mission Planner (MP nối
    #    UDP 14550 qua Wi-Fi, script giữ USB). Script không làm motor quay.
    uv run --offline --with pyserial python scripts/fc/kiem_phan_cung.py COM6 \
        --ghi logs/kiem-motor/motor.csv --giay 300

    # 3. Phân tích CSV đã ghi: từng lần motor quay, thời gian bắt vòng, khựng, dòng, rung
    uv run --offline python scripts/fc/kiem_phan_cung.py --phan-tich logs/kiem-motor/motor.csv

Chỉ số ESC theo cổng ra của FC: ESC M1 = sau-phải, M2 = trước-phải, M3 = sau-trái,
M4 = trước-trái (docs/phan-cung-thuc-te.md). Mã thoát 0 = không mục nào FAIL.
"""

from __future__ import annotations

import argparse
import csv
import math
import statistics as st
import sys
import time
from collections import defaultdict
from pathlib import Path

VI_TRI = {1: "sau-phải", 2: "trước-phải", 3: "sau-trái", 4: "trước-trái"}
# Ngưỡng — rút từ số đo thật của drone này (plans/reports/261025-kiem-tra-phan-cung-that.md)
VCC_MIN, VCC_MAX = 4.75, 5.35  # V, đường 5 V của FC
GIA_TOC_SAI_MG = 40.0  # |a| lúc đứng yên được lệch 1 g tối đa chừng này
GYRO_ON_MAX = 8.0  # mrad/s, độ lệch chuẩn khi đứng yên
GYRO_LECH_MAX = 30.0  # mrad/s, trung bình (bias sau hiệu chỉnh lúc boot)
BARO_ON_MAX = 15.0  # Pa, độ lệch chuẩn khi đứng yên (≈ 1,2 m)
TU_MIN, TU_MAX = 250.0, 650.0  # mG; WMM chỗ bay ~456 mG
PIN_4S = (13.2, 16.9)
PIN_6S_TU = 18.5  # V; quá mức này là đang cắm 6S → dừng hỏi người dùng
DONG_NGHI_MAX = 1.5  # A khi motor đứng — cao hơn là offset cảm biến dòng lệch
ESC_NONG_DUNG = 50  # °C lúc motor đứng
VONG_BAT = 300  # rpm: từ mức này coi là motor đã bắt vòng
VONG_DA_QUAY = 1000  # rpm: đã quay hẳn; tụt dưới VONG_BAT sau đó = khựng
LOI_NOI_BO = {
    1 << 10: "constraining_nan",
    1 << 11: "watchdog_reset",
    1 << 14: "spi_fail",
    1 << 15: "main_loop_stuck",
    1 << 19: "i2c_isr",
    1 << 23: "stack_overflow",
    1 << 24: "imu_reset",
    1 << 26: "mem_guard",
    1 << 27: "dma_fail",
    1 << 28: "params_restored",
}
NGUON_CO = {
    1: "BRICK_VALID",
    2: "SERVO_VALID",
    4: "USB",
    8: "PERIPH_OVERCURRENT",
    16: "HIPOWER_OVERCURRENT",
}
TOC_DO_HZ = {  # id gói: Hz
    1: 2,
    26: 20,
    29: 5,
    24: 2,
    36: 20,
    65: 5,
    125: 2,
    132: 10,
    147: 5,
    152: 1,
    193: 2,
    241: 10,
    11030: 20,
}


def _noi(ket_noi: str, baud: int):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from kiem_fc import noi_fc  # noqa: PLC0415 — chỉ cần khi có FC thật

    fc = noi_fc(ket_noi, baud)
    xin_toc_do(fc.master)
    return fc


def xin_toc_do(m) -> None:
    """SET_MESSAGE_INTERVAL cho từng gói. Gọi lại định kỳ: Mission Planner nối cùng kênh
    (qua MAVProxy) gửi REQUEST_DATA_STREAM là ghi đè tốc độ của cả nhóm gói."""
    for msg_id, hz in TOC_DO_HZ.items():
        m.mav.command_long_send(
            m.target_system, m.target_component, 511, 0, msg_id, 1e6 / hz, 0, 0, 0, 0, 0
        )


def thu_goi(fc, giay: float, *, ghi=None, file_ghi=None, prearm: bool = False):
    """Gom gói trong `giay` giây. ghi = csv.writer thì ghi từng mẫu motor (flush từng dòng:
    dừng tiến trình giữa chừng vẫn còn đủ số liệu để chạy --phan-tich)."""
    m = fc.master
    goi: dict[str, list] = defaultdict(list)
    van_ban: list[str] = []
    t0 = time.monotonic()
    da_prearm = False
    servo = [0] * 4
    lan_xin = time.monotonic()
    while time.monotonic() - t0 < giay:
        if time.monotonic() - lan_xin > 2:
            xin_toc_do(m)
            lan_xin = time.monotonic()
        if prearm and not da_prearm and time.monotonic() - t0 > 2:
            m.mav.command_long_send(
                m.target_system, m.target_component, 401, 0, 0, 0, 0, 0, 0, 0, 0
            )
            da_prearm = True
        msg = m.recv_match(blocking=True, timeout=0.5)
        if msg is None or msg.get_srcSystem() != m.target_system:
            continue
        if msg.get_srcComponent() != m.target_component:
            continue  # bỏ bo DroneBridge (1,68) và mọi thành phần khác
        loai = msg.get_type()
        t = time.monotonic() - t0
        if loai == "STATUSTEXT":
            van_ban.append(msg.text)
            if ghi is not None:
                print(f"  [{t:6.1f}s] FC: {msg.text}", flush=True)
            continue
        goi[loai].append((t, msg))
        if ghi is None:
            continue
        if loai == "SERVO_OUTPUT_RAW":
            servo = [msg.servo1_raw, msg.servo2_raw, msg.servo3_raw, msg.servo4_raw]
        elif loai == "ESC_TELEMETRY_1_TO_4":
            v = goi["VIBRATION"][-1][1] if goi["VIBRATION"] else None
            b = goi["BATTERY_STATUS"][-1][1] if goi["BATTERY_STATUS"] else None
            ghi.writerow(
                [
                    f"{t:.3f}",
                    *servo,
                    *msg.rpm,
                    *msg.current,
                    *msg.temperature,
                    *msg.count,
                    *(
                        f"{x:.2f}"
                        for x in ((v.vibration_x, v.vibration_y, v.vibration_z) if v else (0, 0, 0))
                    ),
                    b.current_battery if b else -1,
                    b.voltages[0] if b else -1,
                ]
            )
            if file_ghi is not None:
                file_ghi.flush()
    return goi, van_ban


def _cot(goi, loai, ham):
    return [ham(msg) for _t, msg in goi.get(loai, [])]


def _tk(xs):
    if not xs:
        return None
    return st.mean(xs), (st.pstdev(xs) if len(xs) > 1 else 0.0), min(xs), max(xs)


def danh_gia(goi, van_ban, giay: float) -> tuple[list[tuple[str, str, str]], bool]:
    """Trả (hàng bảng, có FAIL không). Mức: PASS / WARN / FAIL / INFO."""
    rows: list[tuple[str, str, str]] = []

    def hang(muc, ten, chi_tiet):
        rows.append((muc, ten, chi_tiet))

    from pymavlink import mavutil  # noqa: PLC0415

    ss = goi.get("SYS_STATUS", [])
    co_pin = False
    if ss:
        s = ss[-1][1]
        v_pin = s.voltage_battery / 1000
        co_pin = v_pin > 5.0
        loi = s.errors_count1 | (s.errors_count2 << 16)
        ten_loi = [ten for bit, ten in LOI_NOI_BO.items() if loi & bit] or (
            [hex(loi)] if loi else []
        )
        hang(
            "FAIL" if loi else "PASS",
            "Lỗi nội bộ FC",
            f"bitmask {hex(loi)} {' '.join(ten_loi)}, đếm {s.errors_count4}",
        )
        tai = max(x[1].load for x in ss) / 10
        hang("PASS" if tai < 70 else "WARN", "Tải CPU", f"tối đa {tai:.0f} %")
        bit_ten = {
            gia_tri: e.name.replace("MAV_SYS_STATUS_", "")
            for gia_tri, e in mavutil.mavlink.enums["MAV_SYS_STATUS_SENSOR"].items()
        }
        yeu = [
            bit_ten.get(1 << i, str(1 << i))
            for i in range(32)
            if (s.onboard_control_sensors_enabled & (1 << i))
            and not (s.onboard_control_sensors_health & (1 << i))
        ]
        hang("WARN" if yeu else "PASS", "Cảm biến FC tự báo hỏng", ", ".join(yeu) or "không")
    else:
        hang("FAIL", "SYS_STATUS", "không nhận được")

    ps = goi.get("POWER_STATUS", [])
    if ps and not any(x.Vcc for _t, x in ps):
        # hwdef speedybeef4v5 chỉ có ADC đo áp/dòng pin và RSSI, không có VDD_5V_SENS
        hang("INFO", "Nguồn 5 V của FC", "bo không có chân đo 5 V (Vcc = 0), không kiểm được")
    elif ps:
        vcc = _tk(_cot(goi, "POWER_STATUS", lambda x: x.Vcc / 1000))
        co = ps[-1][1].flags
        ten_co = [t for b, t in NGUON_CO.items() if co & b]
        qua_dong = co & 24
        ok = vcc[2] >= VCC_MIN and vcc[3] <= VCC_MAX and not qua_dong
        hang(
            "PASS" if ok else "FAIL",
            "Nguồn 5 V của FC",
            f"{vcc[0]:.3f} V ({vcc[2]:.3f}–{vcc[3]:.3f}), cờ {' '.join(ten_co)}",
        )

    mi = goi.get("MEMINFO", [])
    if mi:
        hang("INFO", "RAM trống", f"{mi[-1][1].freemem32 or mi[-1][1].freemem} byte")

    imu = goi.get("SCALED_IMU", [])
    if imu:
        a = _tk(_cot(goi, "SCALED_IMU", lambda x: math.sqrt(x.xacc**2 + x.yacc**2 + x.zacc**2)))
        hang(
            "PASS" if abs(a[0] - 1000) <= GIA_TOC_SAI_MG else "FAIL",
            "Gia tốc kế |a|",
            f"{a[0]:.0f} mG (cần 1000 ± {GIA_TOC_SAI_MG:.0f}), ồn {a[1]:.1f} mG",
        )
        gy = [
            _tk(_cot(goi, "SCALED_IMU", lambda x, k=k: getattr(x, k)))
            for k in ("xgyro", "ygyro", "zgyro")
        ]
        on = max(g[1] for g in gy)
        lech = max(abs(g[0]) for g in gy)
        hang(
            "PASS" if on <= GYRO_ON_MAX and lech <= GYRO_LECH_MAX else "WARN",
            "Con quay",
            f"ồn {on:.1f} mrad/s, lệch {lech:.1f} mrad/s (drone phải đứng yên)",
        )
        tu = _tk(_cot(goi, "SCALED_IMU", lambda x: math.sqrt(x.xmag**2 + x.ymag**2 + x.zmag**2)))
        if tu[0] < 1:
            hang(
                "WARN" if not co_pin else "FAIL",
                "La bàn",
                "không đọc được (bình thường khi chỉ cắm USB)" if not co_pin else "0 mG",
            )
        else:
            ok = TU_MIN <= tu[0] <= TU_MAX
            hang(
                "PASS" if ok else "FAIL",
                "La bàn |B|",
                f"{tu[0]:.0f} mG ({TU_MIN:.0f}–{TU_MAX:.0f}), dao động {tu[1]:.1f} mG",
            )

    bp = goi.get("SCALED_PRESSURE", [])
    if bp:
        p = _tk(_cot(goi, "SCALED_PRESSURE", lambda x: x.press_abs * 100))
        nhiet = bp[-1][1].temperature / 100
        hang(
            "PASS" if p[1] <= BARO_ON_MAX else "WARN",
            "Baro",
            f"{p[0] / 100:.1f} hPa, ồn {p[1]:.1f} Pa, {nhiet:.1f} °C",
        )

    gps = goi.get("GPS_RAW_INT", [])
    if gps:
        g = gps[-1][1]
        if g.fix_type == 0:
            hang(
                "FAIL" if co_pin else "WARN",
                "GPS",
                "không thấy module" + ("" if co_pin else " (bình thường khi chỉ cắm USB)"),
            )
        else:
            hang(
                "PASS" if g.fix_type >= 3 else "WARN",
                "GPS",
                f"fix {g.fix_type}, {g.satellites_visible} vệ tinh, HDOP {g.eph / 100:.1f} "
                "(trong nhà không fix là bình thường)",
            )

    rc = goi.get("RC_CHANNELS", [])
    if rc:
        r = rc[-1][1]
        kenh = [getattr(r, f"chan{i}_raw") for i in range(1, 11)]
        if r.chancount == 0:
            hang(
                "FAIL" if co_pin else "WARN",
                "Receiver",
                "0 kênh — tay phát tắt hay receiver mất điện",
            )
        else:
            ga = kenh[2]
            hang(
                "PASS" if r.chancount >= 10 and ga < 1100 else "WARN",
                "Receiver",
                f"{r.chancount} kênh, ga {ga} µs, CH1–10 = {kenh}",
            )
            if ga < 975:
                hang(
                    "FAIL",
                    "Tay phát",
                    f"ga {ga} µs < FS_THR_VALUE 975: tay phát tắt (receiver đang ở failsafe)",
                )

    ds = goi.get("DISTANCE_SENSOR", [])
    if ds:
        d = _tk(_cot(goi, "DISTANCE_SENSOR", lambda x: x.current_distance))
        mn, mx = ds[-1][1].min_distance, ds[-1][1].max_distance
        ok = mn <= d[0] <= mx
        hang(
            "PASS" if ok else "WARN",
            "TFmini Plus",
            f"{d[0]:.0f} cm (±{d[1]:.1f}, {d[2]}–{d[3]}), khoảng đo {mn}–{mx} cm, "
            f"{len(ds) / giay:.1f} gói/s qua MAVLink",
        )
    else:
        hang("FAIL" if co_pin else "WARN", "TFmini Plus", "không có DISTANCE_SENSOR")

    esc = goi.get("ESC_TELEMETRY_1_TO_4", [])
    if esc:
        dau, cuoi = esc[0][1], esc[-1][1]
        thoi_gian = esc[-1][0] - esc[0][0] or 1
        for i in range(4):
            tang = (cuoi.count[i] - dau.count[i]) % 65536
            hz = tang / thoi_gian
            nhiet = cuoi.temperature[i]
            ok = hz > 2 and nhiet < ESC_NONG_DUNG
            hang(
                "PASS" if ok else ("FAIL" if co_pin else "WARN"),
                f"ESC M{i + 1} ({VI_TRI[i + 1]})",
                f"{hz:.1f} gói/s, {nhiet} °C, {cuoi.rpm[i]} rpm, {cuoi.current[i] / 100:.2f} A",
            )
    else:
        hang(
            "FAIL" if co_pin else "WARN",
            "ESC telemetry",
            "không có gói (ESC chỉ có điện khi cắm pin)",
        )

    bs = goi.get("BATTERY_STATUS", [])
    if bs and co_pin:
        v = _tk(_cot(goi, "BATTERY_STATUS", lambda x: x.voltages[0] / 1000))
        a = _tk(_cot(goi, "BATTERY_STATUS", lambda x: x.current_battery / 100))
        if v[0] > PIN_6S_TU:
            hang("FAIL", "Pin", f"{v[0]:.2f} V — đây là pin 6S, drone đã chốt 4S. DỪNG.")
        else:
            ok = PIN_4S[0] <= v[0] <= PIN_4S[1]
            hang("PASS" if ok else "FAIL", "Pin 4S", f"{v[0]:.2f} V = {v[0] / 4:.2f} V/cell")
        hang(
            "PASS" if abs(a[0]) <= DONG_NGHI_MAX else "WARN",
            "Cảm biến dòng (motor đứng)",
            f"{a[0]:.2f} A (±{a[1]:.2f})",
        )
    elif not co_pin:
        hang("INFO", "Pin", "chưa cắm pin")

    ek = goi.get("EKF_STATUS_REPORT", [])
    if ek:
        hang("INFO", "EKF flags", hex(ek[-1][1].flags))
    vb = goi.get("VIBRATION", [])
    if vb:
        x = vb[-1][1]
        hang(
            "INFO",
            "Rung (đứng yên)",
            f"{x.vibration_x:.2f}/{x.vibration_y:.2f}/{x.vibration_z:.2f} m/s², "
            f"clip {x.clipping_0}/{x.clipping_1}/{x.clipping_2}",
        )

    prearm = sorted({t for t in van_ban if t.startswith(("PreArm", "Arm"))})
    hang("INFO", "PreArm FC báo", "; ".join(prearm) or "sạch")
    khac = [t for t in van_ban if not t.startswith(("PreArm", "Arm"))]
    if khac:
        hang("INFO", "STATUSTEXT khác", "; ".join(khac[-6:]))
    return rows, any(m == "FAIL" for m, _, _ in rows)


COT_CSV = [
    "t",
    *(f"pwm{i}" for i in range(1, 5)),
    *(f"rpm{i}" for i in range(1, 5)),
    *(f"ca{i}" for i in range(1, 5)),
    *(f"temp{i}" for i in range(1, 5)),
    *(f"cnt{i}" for i in range(1, 5)),
    "vibx",
    "viby",
    "vibz",
    "batt_ca",
    "batt_mv",
]


def phan_tich(duong_dan: Path) -> int:
    """Tách từng lần motor được lệnh quay (pwm vượt mức nghỉ) rồi đo từng lần."""
    with duong_dan.open(encoding="utf-8") as f:
        hang = [{k: float(v) for k, v in r.items()} for r in csv.DictReader(f)]
    if not hang:
        print("CSV rỗng")
        return 1
    nghi = [min(r[f"pwm{i}"] for r in hang) for i in range(1, 5)]
    print(f"{len(hang)} mẫu, {hang[-1]['t'] - hang[0]['t']:.0f} s; pwm nghỉ = {nghi}")
    print(
        "| ESC | Vị trí | Bắt đầu (s) | pwm | Bắt vòng (s) | Khựng | rpm ổn định "
        "| A motor | A pin | Rung x/y/z | °C max |"
    )
    print("|---|---|---|---|---|---|---|---|---|---|---|")
    for i in range(1, 5):
        dang_chay, lan = False, None
        for r in hang + [dict(hang[-1], **{f"pwm{i}": nghi[i - 1]})]:
            chay = r[f"pwm{i}"] > nghi[i - 1] + 20
            if chay and not dang_chay:
                lan = [r]
            elif chay:
                lan.append(r)
            elif dang_chay and lan:
                _in_lan(i, lan, hang)
            dang_chay = chay
    return 0


def _in_lan(i: int, lan: list[dict], hang: list[dict]) -> None:
    t0 = lan[0]["t"]
    bat = next((r["t"] - t0 for r in lan if r[f"rpm{i}"] >= VONG_BAT), None)
    khung, da_quay = 0, False
    for r in lan:
        if r[f"rpm{i}"] >= VONG_DA_QUAY:
            da_quay = True
        elif da_quay and r[f"rpm{i}"] < VONG_BAT:
            khung += 1
            da_quay = False
    on = [r for r in lan if r["t"] - t0 >= 1.0] or lan
    rpm = st.median(r[f"rpm{i}"] for r in on)
    ca = st.median(r[f"ca{i}"] for r in on) / 100
    pin = st.median(r["batt_ca"] for r in on) / 100
    rung = [st.median(r[k] for r in on) for k in ("vibx", "viby", "vibz")]
    nhiet = max(r[f"temp{i}"] for r in lan)
    print(
        f"| M{i} | {VI_TRI[i]} | {t0:.1f} | {st.median(r[f'pwm{i}'] for r in lan):.0f} | "
        f"{'KHÔNG' if bat is None else f'{bat:.2f}'} | {khung} | {rpm:.0f} | {ca:.2f} | "
        f"{pin:.2f} | {rung[0]:.2f}/{rung[1]:.2f}/{rung[2]:.2f} | {nhiet:.0f} |"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", nargs="?", help="COMx của FC")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--giay", type=float, default=15.0, help="thời gian đọc (s)")
    ap.add_argument("--ghi", type=Path, help="ghi CSV motor trong --giay giây")
    ap.add_argument("--phan-tich", type=Path, help="phân tích CSV đã ghi, không nối FC")
    args = ap.parse_args()

    if args.phan_tich:
        return phan_tich(args.phan_tich)
    if not args.ket_noi:
        ap.error("cần cổng COM của FC")

    fc = _noi(args.ket_noi, args.baud)
    try:
        if args.ghi:
            args.ghi.parent.mkdir(parents=True, exist_ok=True)
            with args.ghi.open("w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(COT_CSV)
                print(
                    f"Đang ghi {args.giay:.0f} s vào {args.ghi}. Script KHÔNG làm motor quay; "
                    "người vận hành bấm Motor Test ở Mission Planner.",
                    flush=True,
                )
                thu_goi(fc, args.giay, ghi=w, file_ghi=f)
            return phan_tich(args.ghi)
        goi, van_ban = thu_goi(fc, args.giay, prearm=True)
    finally:
        fc.stop()

    rows, co_fail = danh_gia(goi, van_ban, args.giay)
    print("| Mức | Mục | Chi tiết |\n|---|---|---|")
    for muc, ten, chi_tiet in rows:
        print(f"| {muc} | {ten} | {chi_tiet} |")
    print("KET QUA:", "FAIL" if co_fail else "PASS")
    return 1 if co_fail else 0


if __name__ == "__main__":
    sys.exit(main())
