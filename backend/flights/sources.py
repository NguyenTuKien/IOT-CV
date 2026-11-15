"""Đọc một file log thành "track": chuỗi thời gian theo giờ Unix, các lần ARM, mode, sự kiện.

Hai nguồn, cùng một hình dạng đầu ra (dict thuần JSON để `index.py` lưu đệm ra đĩa — đọc lại
một file `.bin` 14 MB mất hàng chục giây, đọc đệm thì tức thì):

- **Dataflash** (`.bin` tải từ FC): đầy đủ nhất, mẫu dày. Giờ thật lấy từ GPS (tuần + ms GPS),
  nên log chưa có GPS fix lần nào thì không biết giờ → `ok: False`.
- **tlog** (backend ghi mỗi gói MAVLink nhận được): giờ là đồng hồ laptop lúc nhận gói. Có
  thứ dataflash không có: chất lượng link (gói mất theo số `seq`, RSSI của DroneBridge).

Mẫu được gom về lưới `STEP_S` (giữ mẫu cuối mỗi ô) ngay khi đọc, đủ mịn cho biểu đồ và bản đồ.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from datetime import timedelta
from pathlib import Path
from typing import Any

from backend.flights.binlog import GIAY_NHUAN_GPS, GPS_EPOCH, LogBin
from backend.mavlink.telemetry import mode_name

STEP_S = 0.2
LINK_GAP_S = 2.0  # tlog im quá mức này = mất link (FC gửi ~25 gói/s)
# Số chữ số thập phân khi lưu đệm, theo cột.
_DECIMALS = {"lat": 7, "lon": 7, "volt": 2, "curr": 1, "mah": 0, "hdop": 2, "sats": 0}

# Copter `LogErrorSubsystem` (ArduPilot 4.7, `libraries/AP_Logger/AP_Logger.h`).
ERR_SUBSYS = {
    1: "MAIN",
    2: "RADIO",
    3: "COMPASS",
    5: "Failsafe tay phát",
    6: "Failsafe pin",
    7: "Failsafe GPS",
    8: "Failsafe GCS",
    9: "Failsafe fence",
    10: "Đổi mode",
    11: "GPS",
    12: "Phát hiện rơi",
    16: "Kiểm tra EKF",
    17: "Failsafe EKF",
    18: "Baro",
    19: "CPU",
    22: "Dẫn đường",
    24: "EKF đổi lõi chính",
    25: "Mất lực đẩy",
    26: "Failsafe cảm biến",
    28: "Lệnh tay cầm",
    29: "Failsafe rung",
    30: "Lỗi nội bộ",
    31: "Failsafe dead-reckon",
}
_ERR_LOUD = {12, 25}  # rơi, mất lực đẩy → mức error
_WARN_WORDS = (
    "prearm",
    "failsafe",
    "fail",
    "error",
    "crash",
    "not healthy",
    "bad ",
    "lost",
    "blocked",
    "unhealthy",
    "too high",
    "too low",
    "not armable",
    "warning",
)


class _Cols:
    """Gom mẫu (t, v) theo ô `STEP_S`, giữ mẫu cuối của mỗi ô."""

    def __init__(self) -> None:
        self.cells: dict[str, dict[int, float]] = defaultdict(dict)

    def add(self, name: str, t: float, v: Any) -> None:
        if v is None:
            return
        v = float(v)
        if math.isnan(v) or math.isinf(v):
            return
        self.cells[name][round(t / STEP_S)] = v

    def to_json(self, offset: float) -> dict[str, list[list[float]]]:
        out = {}
        for name, cells in self.cells.items():
            nd = _DECIMALS.get(name, 2)
            out[name] = [
                [round(k * STEP_S + offset, 2), round(cells[k], nd)] for k in sorted(cells)
            ]
        return out


def arm_spans(
    changes: list[tuple[float, bool]], fallback_on: float | None, last_t: float
) -> list[list[float]]:
    """Các khoảng ARM từ dãy (giờ, đang ARM?).

    Log dataflash hay mất bản ghi ARM đầu tiên sau khi bật nguồn (02/11/2026: log 001 mở lúc
    10:10:15, ARM thật 10:10:46). Gặp DISARM mà chưa thấy ARM nào thì ARM lấy ở `fallback_on`
    (lúc FC đặt home — chính là lúc ARM); không có thì bỏ khoảng đó.
    """
    spans: list[list[float]] = []
    on: float | None = None
    for t, armed in changes:
        if armed:
            on = t if on is None else on
            continue
        if on is None and not spans and fallback_on is not None and fallback_on <= t:
            on = fallback_on
        if on is not None:
            spans.append([on, t])
            on = None
    if on is not None:
        spans.append([on, last_t])
    return spans


def _level_of_text(text: str) -> str:
    low = text.lower()
    return "warning" if any(w in low for w in _WARN_WORDS) else "info"


def err_text(subsys: int, code: int) -> tuple[str, str]:
    """(mức, câu) cho một bản ghi ERR của Copter."""
    ten = ERR_SUBSYS.get(subsys, f"hệ con {subsys}")
    if code == 0:
        return "info", f"ERR {ten}: hết lỗi"
    level = "error" if subsys in _ERR_LOUD else "warning"
    return level, f"ERR {ten}: mã {code}"


def read_dataflash(path: Path, fmt_from: Path | None = None) -> dict[str, Any]:
    log = LogBin(path, fmt_from)
    cols = _Cols()
    changes: list[tuple[float, bool]] = []
    modes: list[list[Any]] = []
    events: list[list[Any]] = []
    home: list[float] | None = None
    home_t: float | None = None
    offset: float | None = None
    first_t = last_t = None
    types = ["POS", "GPS", "ATT", "BAT", "RFND", "VIBE", "MODE", "EV", "ARM", "MSG", "ERR", "ORGN"]
    for m in log.doc(types):
        typ = m.get_type()
        t = m.TimeUS / 1e6
        first_t = t if first_t is None else first_t
        last_t = t
        if typ == "POS":
            cols.add("lat", t, m.Lat)
            cols.add("lon", t, m.Lng)
            cols.add("alt", t, m.RelHomeAlt)
        elif typ == "GPS":
            if getattr(m, "I", 0) != 0:
                continue
            if offset is None and m.Status >= 3 and m.GWk > 0:
                utc = GPS_EPOCH + timedelta(
                    weeks=m.GWk, milliseconds=m.GMS, seconds=-GIAY_NHUAN_GPS
                )
                offset = utc.timestamp() - t
            cols.add("sats", t, m.NSats)
            cols.add("hdop", t, m.HDop)
            cols.add("speed", t, m.Spd)
            cols.add("gps_fix", t, m.Status)
        elif typ == "ATT":
            cols.add("roll", t, m.Roll)
            cols.add("pitch", t, m.Pitch)
            cols.add("heading", t, m.Yaw)
        elif typ == "BAT":
            if getattr(m, "Inst", 0) == 0:
                cols.add("volt", t, m.Volt)
                cols.add("curr", t, m.Curr)
                cols.add("mah", t, m.CurrTot)
        elif typ == "RFND":
            cols.add("rangefinder", t, m.Dist)
        elif typ == "VIBE":
            if getattr(m, "IMU", 0) == 0:
                cols.add("vibe", t, max(m.VibeX, m.VibeY, m.VibeZ))
        elif typ == "MODE":
            modes.append([t, mode_name(int(m.ModeNum))])
        elif typ == "EV" and m.Id in (10, 11):
            changes.append((t, m.Id == 10))
        elif typ == "ARM":
            changes.append((t, bool(m.ArmState)))
        elif typ == "MSG":
            events.append([t, _level_of_text(m.Message), "fc", m.Message])
        elif typ == "ERR":
            level, text = err_text(int(m.Subsys), int(m.ECode))
            events.append([t, level, "fc", text])
        elif typ == "ORGN" and home is None and getattr(m, "Type", 0) == 1:
            home = [round(m.Lat, 7), round(m.Lng, 7)]
            home_t = t
    if offset is None or first_t is None:
        return {"ok": False, "reason": "log không có giờ GPS (chưa fix 3D lần nào)"}
    spans = arm_spans(changes, home_t, last_t)
    if not changes:  # LOG_DISARMED 0 và mất bản ghi ARM: ARM từ lúc đặt home tới hết log
        spans = [[home_t if home_t is not None else first_t, last_t]]

    def shift(t: float) -> float:
        return round(t + offset, 2)

    return {
        "ok": True,
        "kind": "dataflash",
        "t0": shift(first_t),
        "t1": shift(last_t),
        "arms": [[shift(a), shift(b)] for a, b in spans],
        "cols": cols.to_json(offset),
        "modes": [[shift(t), name] for t, name in modes],
        "events": [[shift(t), lv, src, text] for t, lv, src, text in events],
        "home": home,
        "fmt_skew_bytes": log.lech,
    }


def _radio_dbm(raw: int) -> float | None:
    """`remrssi` của DroneBridge (Wi-Fi) là dBm có dấu 8 bit; 0, 255, −127 = không biết."""
    if raw in (0, 255):
        return None
    dbm = raw - 256 if raw > 127 else raw
    return None if dbm <= -127 or dbm >= 0 else float(dbm)


def read_tlog(path: Path) -> dict[str, Any]:
    from pymavlink import mavutil

    conn = mavutil.mavlink_connection(str(path), robust_parsing=True)
    cols = _Cols()
    changes: list[tuple[float, bool]] = []
    clock: list[float] = []  # giờ GPS của FC − giờ laptop, từ SYSTEM_TIME
    sim = 0
    via_bridge = False  # có gói của DroneBridge (sys 1, comp 68): drone thật qua Wi-Fi
    two_sensors = False  # FC báo IMU/baro thứ hai: SITL (F405 V5 chỉ có một IMU, một baro)
    modes: list[list[Any]] = []
    events: list[list[Any]] = []
    home: list[float] | None = None
    rx: dict[int, int] = defaultdict(int)
    lost: dict[int, int] = defaultdict(int)
    first_t = last_t = None
    prev_any = prev_fc = None
    last_seq: int | None = None
    mode = armed = gps_ok = None
    while (g := conn.recv_match(blocking=False)) is not None:
        typ = g.get_type()
        if typ == "BAD_DATA":
            continue
        t = float(getattr(g, "_timestamp", 0.0))
        first_t = t if first_t is None else first_t
        if prev_any is not None and t - prev_any > LINK_GAP_S:
            events.append([prev_any, "warning", "link", f"Mất link {t - prev_any:.1f} s"])
        prev_any = last_t = t
        src = (g.get_srcSystem(), g.get_srcComponent())
        via_bridge = via_bridge or src == (1, 68)
        if typ == "RADIO_STATUS" and src == (1, 68):
            cols.add("rssi", t, _radio_dbm(int(g.remrssi)))
            continue
        if src != (1, 1):
            continue
        sec = int(t)
        seq = g.get_seq()
        if last_seq is not None and prev_fc is not None and t - prev_fc < 1.0:
            lost[sec] += (seq - last_seq - 1) % 256
        rx[sec] += 1
        last_seq, prev_fc = seq, t
        if typ == "HEARTBEAT":
            new_mode = mavutil.mode_string_v10(g)
            new_armed = bool(g.base_mode & 128)
            if new_mode != mode:
                modes.append([t, new_mode])
                mode = new_mode
            if new_armed != armed:
                if new_armed or armed is not None:  # gói đầu đã disarm: chưa có lần ARM nào
                    changes.append((t, new_armed))
                armed = new_armed
        elif typ == "GLOBAL_POSITION_INT":
            if g.lat or g.lon:
                cols.add("lat", t, g.lat / 1e7)
                cols.add("lon", t, g.lon / 1e7)
            cols.add("alt", t, g.relative_alt / 1000)
            cols.add("speed", t, math.hypot(g.vx, g.vy) / 100)
            if g.hdg != 65535:
                cols.add("heading", t, g.hdg / 100)
        elif typ == "ATTITUDE":
            cols.add("roll", t, math.degrees(g.roll))
            cols.add("pitch", t, math.degrees(g.pitch))
        elif typ == "SYS_STATUS":
            if g.voltage_battery not in (0, 65535):
                cols.add("volt", t, g.voltage_battery / 1000)
            if g.current_battery >= 0:
                cols.add("curr", t, g.current_battery / 100)
            gps_bit = 32  # MAV_SYS_STATUS_SENSOR_GPS
            if g.onboard_control_sensors_present & gps_bit:
                ok = bool(g.onboard_control_sensors_health & gps_bit)
                if gps_ok is not None and ok != gps_ok:
                    lv, text = (
                        ("info", "Cờ GPS khoẻ bật lại") if ok else ("warning", "Cờ GPS khoẻ tắt")
                    )
                    events.append([t, lv, "fc", text])
                gps_ok = ok
        elif typ == "GPS_RAW_INT":
            cols.add("sats", t, None if g.satellites_visible == 255 else g.satellites_visible)
            cols.add("hdop", t, None if g.eph == 65535 else g.eph / 100)
            cols.add("gps_fix", t, g.fix_type)
        elif typ == "DISTANCE_SENSOR":
            cols.add("rangefinder", t, g.current_distance / 100)
        elif typ == "HOME_POSITION" and home is None:
            home = [round(g.latitude / 1e7, 7), round(g.longitude / 1e7, 7)]
        elif typ == "SYSTEM_TIME" and g.time_unix_usec > 0:
            clock.append(g.time_unix_usec / 1e6 - t)
        elif typ in ("SIMSTATE", "SIM_STATE"):
            sim += 1  # chỉ SITL gửi
        elif typ == "STATUSTEXT":
            sev = int(g.severity)
            level = "error" if sev <= 3 else "warning" if sev == 4 else _level_of_text(g.text)
            events.append([t, level, "fc", g.text])
            two_sensors = two_sensors or any(w in g.text for w in ("IMU1", "IMU2", "Barometer 2"))
    if first_t is None:
        return {"ok": False, "reason": "tlog rỗng"}
    if sim or (two_sensors and not via_bridge):
        return {"ok": False, "reason": "SITL (drone ảo)", "sim": True}
    link = [[s, rx.get(s, 0), lost.get(s, 0)] for s in range(int(first_t), int(last_t) + 1)]
    return {
        "ok": True,
        "kind": "tlog",
        "t0": round(first_t, 2),
        "t1": round(last_t, 2),
        "arms": [[round(a, 2), round(b, 2)] for a, b in arm_spans(changes, None, last_t)],
        "cols": cols.to_json(0.0),
        "modes": [[round(t, 2), name] for t, name in modes],
        "events": [[round(t, 2), lv, src, text] for t, lv, src, text in events],
        "home": home,
        "link": link,
        # Đồng hồ laptop trôi (~7 s/ngày, Windows chỉ đồng bộ mỗi tuần): 01/11 chậm 50,4 s so
        # với giờ GPS. None = tlog không có SYSTEM_TIME; index.py tự dò bằng cách khớp lần ARM.
        "clock_offset": round(statistics.median(clock), 2) if len(clock) >= 3 else None,
    }
