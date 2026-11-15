#!/usr/bin/env python3
"""Tóm tắt log dataflash `.bin` của drone thật theo từng chuyến (ARM → DISARM). Chỉ đọc file.

    uv run python scripts/fc/phan_tich_log.py logs/fc-dataflash-<ngày>/<log>.bin
    uv run python scripts/fc/phan_tich_log.py <log-thieu>.bin --fmt-tu <log nguyên vẹn>.bin
    uv run python scripts/fc/phan_tich_log.py <log>.bin --md plans/reports/x.md

Mỗi chuyến: giờ, chế độ, cao/xa nhất, điểm hạ so với home, pin, rung, GPS, EKF, độ bám góc, cân
bằng motor lúc treo, ESC (khởi động hụt = tiếng "khậc", tụt vòng khi bay), lỗi và failsafe.
Ngưỡng so sánh lấy từ wiki ArduPilot (rung, EKF) và từ số đo của dự án (ESC 25/10/2026).
Motor theo ESC OX32: M1 = SERVO1 sau-phải, M2 trước-phải, M3 sau-trái, M4 trước-trái.
"""

from __future__ import annotations

import argparse
import math
import statistics
import sys
from bisect import bisect_left, bisect_right
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from log_bin import LogBin  # noqa: E402

CAN_DOC = [
    "ATT", "CTUN", "POS", "GPS", "GPA", "BAT", "VIBE", "RCIN", "RCOU", "ESC", "XKF4", "POWR",
    "RFND", "PM", "DSF", "MODE", "EV", "ARM", "ERR", "MSG", "ORGN", "MISE",
]  # fmt: skip
TEN_MODE = {0: "STABILIZE", 2: "ALT_HOLD", 3: "AUTO", 4: "GUIDED", 5: "LOITER", 6: "RTL", 9: "LAND",
            17: "BRAKE"}  # fmt: skip
LY_DO = {1: "công tắc chế độ", 2: "lệnh GCS", 3: "failsafe tay cầm", 4: "failsafe pin",
         5: "failsafe GCS", 6: "failsafe EKF", 8: "hết mission", 10: "vượt fence",
         19: "phát hiện rơi", 25: "failsafe", 41: "lệnh mission", 53: "công tắc phụ"}  # fmt: skip
CACH_DISARM = {0: "rudder", 1: "lệnh GCS", 2: "công tắc SwB", 12: "PHÁT HIỆN RƠI",
               13: "tự sau khi hạ", 14: "hết mission", 15: "vượt fence", 16: "failsafe tay cầm",
               17: "hết DISARM_DELAY"}  # fmt: skip
HE_LOI = {2: "tay cầm", 3: "la bàn", 5: "failsafe tay cầm", 6: "failsafe pin", 7: "failsafe GPS",
          8: "failsafe GCS", 9: "failsafe fence", 11: "GPS", 12: "PHÁT HIỆN RƠI", 16: "EKF",
          17: "failsafe EKF", 18: "baro", 24: "EKF đổi lane", 25: "MẤT LỰC ĐẨY",
          29: "failsafe rung"}  # fmt: skip
VI_TRI_MOTOR = ["M1 sau-phải", "M2 trước-phải", "M3 sau-trái", "M4 trước-trái"]
R_TRAI_DAT = 6_371_000.0
VONG_KHOI_DONG = 300  # rpm: dưới mức này coi như motor đứng (số đo 25/10/2026)
VONG_DA_QUAY = 1000
GPS_TRE_MS = 245  # AP_GPS: gói GPS cách nhau quá 245 ms là "trễ"; trễ 2 lần liền = GPS not healthy


def kc(lat1, lng1, lat2, lng2) -> float:
    """Khoảng cách ngang (m), đủ chính xác cho vài km."""
    x = math.radians(lng2 - lng1) * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(x, math.radians(lat2 - lat1)) * R_TRAI_DAT


class DuLieu:
    def __init__(self, log: LogBin) -> None:
        self.ds: dict[str, list[tuple]] = {k: [] for k in CAN_DOC}
        for m in log.doc(CAN_DOC):
            self._them(m.get_type(), m)
        self.t = {k: [r[0] for r in v] for k, v in self.ds.items()}

    def _them(self, loai: str, m) -> None:  # noqa: C901 — một nhánh cho mỗi loại message
        t = m.TimeUS
        r = None
        if loai == "ATT":
            r = (t, m.DesRoll, m.Roll, m.DesPitch, m.Pitch, m.DesYaw, m.Yaw)
        elif loai == "CTUN":
            r = (t, m.ThO, m.ThH, m.Alt, m.CRt)
        elif loai == "POS":
            r = (t, m.Lat, m.Lng, m.RelHomeAlt)
        elif loai == "GPS" and m.I == 0:
            r = (t, m.Status, m.NSats, m.HDop, m.Spd)
        elif loai == "GPA" and m.I == 0:
            r = (t, m.Delta, m.HAcc)
        elif loai == "BAT" and m.Inst == 0:
            r = (t, m.Volt, m.Curr, m.CurrTot)
        elif loai == "VIBE" and m.IMU == 0:
            r = (t, m.VibeX, m.VibeY, m.VibeZ, m.Clip)
        elif loai in ("RCOU", "RCIN"):
            r = (t, m.C1, m.C2, m.C3, m.C4)
        elif loai == "ESC":
            r = (t, m.Instance, m.RPM, m.Temp)
        elif loai == "XKF4" and m.C == 0:
            r = (t, m.SV, m.SP, m.SH, m.SM, m.FS, m.SS)
        elif loai == "POWR":
            r = (t, m.Vcc, m.VServo, m.Flags)
        elif loai == "RFND":
            r = (t, m.Dist, m.Stat)
        elif loai == "PM":
            r = (t, m.Load, m.NLon)
        elif loai == "DSF":
            r = (t, m.Dp)
        elif loai == "MODE":
            r = (t, m.ModeNum, m.Rsn)
        elif loai == "EV":
            r = (t, m.Id)
        elif loai == "ARM":
            r = (t, m.ArmState, m.Method)
        elif loai == "ERR":
            r = (t, m.Subsys, m.ECode)
        elif loai == "MSG":
            r = (t, m.Message)
        elif loai == "ORGN":
            r = (t, m.Type, m.Lat, m.Lng)
        elif loai == "MISE":
            r = (t, m.CNum, m.CId, m.Lat, m.Lng, m.Prm1)
        if r is not None:
            self.ds[loai].append(r)

    def cua(self, loai: str, a: float, b: float) -> list[tuple]:
        ts = self.t[loai]
        return self.ds[loai][bisect_left(ts, a) : bisect_right(ts, b)]

    def truoc(self, loai: str, t: float) -> tuple | None:
        i = bisect_right(self.t[loai], t)
        return self.ds[loai][i - 1] if i else None


def cac_chuyen(d: DuLieu) -> list[tuple[float, float, str]]:
    """[(t_arm, t_disarm, ghi chú)]. Bản ghi ARM có thể rơi mất (bộ đệm log tràn lúc arm đầu sau
    khởi động); khi đó lấy lúc FC đặt home (ORGN loại 1) — FC đặt home đúng lúc arm."""
    moc = sorted([(r[0], r[1]) for r in d.ds["ARM"]] + [(r[0], 1 if r[1] == 10 else 0)
                  for r in d.ds["EV"] if r[1] in (10, 11)])  # fmt: skip
    ra: list[tuple[float, float, str]] = []
    dang_arm: float | None = None
    truoc = 0.0
    for t, trang_thai in moc:
        if trang_thai == 1 and dang_arm is None:
            dang_arm = t
        elif trang_thai == 0 and t - truoc > 1e6:
            ghi_chu = ""
            if dang_arm is None:
                # Lấy lần đặt home ĐẦU: FC còn ghi lại ORGN (cùng MODE, dòng "GPS 1: probing...")
                # thành một loạt giữa chuyến, vd. lúc nạp mission khi đang bay — lấy lần cuối thì
                # log 02/11 008/009 thành "arm 90 s, KHÔNG cất cánh" dù đã bay 18 m (15/11/2026).
                home = [r[0] for r in d.cua("ORGN", truoc, t) if r[1] == 1]
                dang_arm = home[0] if home else (d.ds["ATT"][0][0] if d.ds["ATT"] else t)
                ghi_chu = "giờ arm suy từ lúc đặt home (log mất bản ghi ARM)"
            ra.append((dang_arm, t, ghi_chu))
            dang_arm, truoc = None, t
    return ra


def thong_ke(gt: list[float]) -> str:
    if not gt:
        return "—"
    gt = sorted(gt)
    p95 = gt[int(0.95 * (len(gt) - 1))]
    return f"TB {statistics.fmean(gt):.1f}, p95 {p95:.1f}, max {gt[-1]:.1f}"


def khoi_dong_esc(d: DuLieu, t_arm: float, t_het: float) -> list[str]:
    """Từng motor: bao lâu thì bắt vòng (≥300 rpm) kể từ lúc FC cho quay, và số lần hụt (đã quay
    ≥1000 rpm rồi tụt về ~0 — tiếng "khậc"). ArduCopter giữ motor đứng 2 s sau khi arm
    (ARMING_DELAY_SEC); lúc cho quay là sự kiện MOTORS_INTERLOCK_ENABLED (EV 57)."""
    cho_quay = next((r[0] for r in d.cua("EV", t_arm, t_het) if r[1] == 57), t_arm + 2e6)
    ra = []
    for i, ten in enumerate(VI_TRI_MOTOR):
        mau = [r for r in d.cua("ESC", cho_quay, min(cho_quay + 3e6, t_het)) if r[1] == i]
        if not mau:
            ra.append(f"{ten}: không có telemetry")
            continue
        bat = next((r[0] for r in mau if r[2] >= VONG_KHOI_DONG), None)
        hut, da_quay = 0, False
        for r in mau:
            if r[2] >= VONG_DA_QUAY:
                da_quay = True
            elif da_quay and r[2] < VONG_KHOI_DONG:
                hut, da_quay = hut + 1, False
        lag = f"{(bat - cho_quay) / 1e6:.2f} s" if bat else "KHÔNG bắt vòng trong 3 s"
        ra.append(f"{ten} {lag}" + (f", HỤT {hut} lần" if hut else ""))
    return ra


def tut_vong_khi_bay(d: DuLieu, a: float, b: float) -> list[str]:
    """Motor được lệnh quay mạnh mà ESC báo gần như đứng = mất đồng bộ (desync)."""
    ra = []
    for i, ten in enumerate(VI_TRI_MOTOR):
        dem = 0
        for r in (r for r in d.cua("ESC", a, b) if r[1] == i):
            ou = d.truoc("RCOU", r[0])
            if ou and ou[1 + i] > 1300 and r[2] < VONG_KHOI_DONG:
                dem += 1
        if dem:
            ra.append(f"{ten}: {dem} mẫu")
    return ra


def can_bang_motor(d: DuLieu, a: float, b: float) -> str:
    """Lệnh motor TB lúc treo (nghiêng < 5°, |leo| < 0,5 m/s): lệch trước/sau, trái/phải, CW/CCW."""
    chon = []
    for r in d.cua("RCOU", a, b):
        at, ct = d.truoc("ATT", r[0]), d.truoc("CTUN", r[0])
        if at and ct and abs(at[2]) < 5 and abs(at[4]) < 5 and abs(ct[4]) < 0.5:
            chon.append(r[1:5])
    if len(chon) < 20:
        return "không đủ đoạn treo"
    m1, m2, m3, m4 = (statistics.fmean(c[i] for c in chon) for i in range(4))
    truoc_sau = (m2 + m4) / 2 - (m1 + m3) / 2
    phai_trai = (m1 + m2) / 2 - (m3 + m4) / 2
    cw_ccw = (m1 + m4) / 2 - (m2 + m3) / 2
    return (
        f"M1 {m1:.0f} · M2 {m2:.0f} · M3 {m3:.0f} · M4 {m4:.0f} µs ({len(chon)} mẫu treo); "
        f"trước−sau {truoc_sau:+.0f}, phải−trái {phai_trai:+.0f}, CW−CCW {cw_ccw:+.0f} µs"
    )


def bam_goc(d: DuLieu, a: float, b: float) -> str:
    mau = d.cua("ATT", a, b)
    if not mau:
        return "—"
    loi_r = [r[1] - r[2] for r in mau]
    loi_p = [r[3] - r[4] for r in mau]
    loi_y = [((r[5] - r[6] + 180) % 360) - 180 for r in mau]

    def rms(x):
        return math.sqrt(statistics.fmean(v * v for v in x))

    return (
        f"roll RMS {rms(loi_r):.1f}° (max {max(map(abs, loi_r)):.1f}°), "
        f"pitch RMS {rms(loi_p):.1f}° (max {max(map(abs, loi_p)):.1f}°), "
        f"yaw RMS {rms(loi_y):.1f}° (max {max(map(abs, loi_y)):.1f}°); "
        f"nghiêng thật lớn nhất {max(max(abs(r[2]), abs(r[4])) for r in mau):.0f}°"
    )


def doan_mode(d: DuLieu, a: float, b: float) -> list[tuple[float, float, int]]:
    """[(đầu, cuối, mode)] trong [a, b], tính cả mode đang chạy từ trước a."""
    moc = d.cua("MODE", a, b)
    dau = d.truoc("MODE", a)
    ds = ([(a, dau[1])] if dau else []) + [(r[0], r[1]) for r in moc]
    return [(t, ds[k + 1][0] if k + 1 < len(ds) else b, m) for k, (t, m) in enumerate(ds)]


def nghieng_khi_treo(d: DuLieu, a: float, b: float) -> str:
    """Góc nghiêng TB lúc đứng yên ở LOITER/AUTO (tốc độ < 0,3 m/s): đó là góc FC phải giữ để
    không trôi. Gió làm góc này đổi theo hướng mũi; level sai làm nó cố định theo thân máy."""
    r_, p_, y_ = [], [], []
    for t0, t1, mode in doan_mode(d, a, b):
        if mode not in (3, 5):
            continue
        for at in d.cua("ATT", t0, t1):
            g, c = d.truoc("GPS", at[0]), d.truoc("CTUN", at[0])
            if g and c and g[4] < 0.3 and abs(c[4]) < 0.3:
                r_.append(at[2])
                p_.append(at[4])
                y_.append(at[6])
    if len(r_) < 20:
        return "không đủ đoạn treo đứng yên"
    return (
        f"roll TB {statistics.fmean(r_):+.1f}°, pitch TB {statistics.fmean(p_):+.1f}° "
        f"({len(r_)} mẫu, mũi hướng {statistics.fmean(y_):.0f}°±{statistics.pstdev(y_):.0f})"
    )


def luc_roi_dat(d: DuLieu, t_cat: float) -> str:
    """1,5 s đầu sau khi rời đất: góc lệch lớn nhất giữa lệnh và thật (cú ngóc mũi 27/10)."""
    mau = d.cua("ATT", t_cat, t_cat + 1.5e6)
    if not mau:
        return "—"
    dp = max(mau, key=lambda r: abs(r[4] - r[3]))
    dr = max(mau, key=lambda r: abs(r[2] - r[1]))
    return (
        f"pitch thật−lệnh lớn nhất {dp[4] - dp[3]:+.1f}° · roll {dr[2] - dr[1]:+.1f}° "
        f"(dương: pitch = ngóc mũi, roll = nghiêng phải)"
    )


def stabilize(d: DuLieu, a: float, b: float) -> str | None:
    """Đoạn bay STABILIZE: thời lượng, độ trôi, và cần roll/pitch lệch giữa bao nhiêu."""
    doan = [(t0, t1) for t0, t1, m in doan_mode(d, a, b) if m == 0 and t1 > t0]
    if not doan:
        return None
    gps = [g for t0, t1 in doan for g in d.cua("GPS", t0, t1)]
    rc = [r for t0, t1 in doan for r in d.cua("RCIN", t0, t1)]
    giay = sum(t1 - t0 for t0, t1 in doan) / 1e6
    if not gps or not rc:
        return f"{giay:.0f} s, thiếu dữ liệu GPS/RC"
    lech = [max(abs(r[1] - 1500), abs(r[2] - 1500)) for r in rc]
    return (
        f"{giay:.0f} s · tốc độ đất {thong_ke([g[4] for g in gps])} m/s · "
        f"cần roll/pitch lệch giữa {thong_ke(lech)} µs (1 µs ≈ 0,06° lệnh)"
    )


def diem_mission(d: DuLieu, a: float, b: float) -> list[str]:
    """NAV_WAYPOINT: khoảng cách nhỏ nhất từ drone tới điểm trong lúc điểm đó đang chạy."""
    ra = []
    mise = d.cua("MISE", a, b)
    for k, r in enumerate(mise):
        if r[2] != 16 or not r[3]:
            continue
        het = mise[k + 1][0] if k + 1 < len(mise) else b
        pos = d.cua("POS", r[0], het)
        if pos:
            gan = min(kc(p[1], p[2], r[3], r[4]) for p in pos)
            ra.append(f"WP{r[1]} gần nhất {gan:.2f} m")
    return ra


def mot_chuyen(d: DuLieu, log: LogBin, so: int, a: float, b: float, ghi_chu: str) -> list[str]:
    ev = d.cua("EV", a, b)
    cat = next((r[0] for r in ev if r[1] == 28), None)
    ha = next((r[0] for r in reversed(ev) if r[1] == 18), None)
    bay_a, bay_b = cat or a, ha or b
    home = next((r for r in reversed(d.cua("ORGN", a - 1e6, b)) if r[1] == 1), None)
    dis = next((r for r in d.cua("ARM", a, b + 1e5) if r[1] == 0), None)
    bay = f", bay {(bay_b - bay_a) / 1e6:.0f} s)" if cat else ", KHÔNG cất cánh)"
    dong = [f"## Chuyến {so} — {log.gio(a)} → {log.gio(b)} (arm {(b - a) / 1e6:.0f} s{bay}"]
    if ghi_chu:
        dong.append(f"- Lưu ý: {ghi_chu}")
    modes = [f"{TEN_MODE.get(r[1], r[1])} {log.gio(r[0])} ({LY_DO.get(r[2], r[2])})"
             for r in d.cua("MODE", a - 2e6, b)]  # fmt: skip
    dong.append("- Chế độ: " + " → ".join(modes or ["—"]))
    if dis:
        dong.append(f"- Disarm: {CACH_DISARM.get(dis[2], dis[2])}")
    pos = d.cua("POS", bay_a, bay_b)
    if pos and home:
        xa = max(kc(p[1], p[2], home[2], home[3]) for p in pos)
        cao = max(p[3] for p in pos)
        dong.append(f"- Cao nhất {cao:.1f} m so với home · xa nhất {xa:.1f} m")
        if ha:
            p = d.truoc("POS", ha)
            dong.append(f"- Chạm đất cách home {kc(p[1], p[2], home[2], home[3]):.2f} m")
    gps = d.cua("GPS", bay_a, bay_b)
    if gps:
        dong.append(f"- Tốc độ đất lớn nhất {max(g[4] for g in gps):.1f} m/s · vệ tinh ít nhất "
                    f"{min(g[2] for g in gps)} · HDOP lớn nhất "
                    f"{max(g[3] for g in gps):.2f}")  # fmt: skip
    gpa = [r[1] for r in d.cua("GPA", a, b)]
    if gpa:
        tre = sum(1 for x in gpa if x > GPS_TRE_MS)
        dong.append(f"- Gói GPS cách nhau: {thong_ke(gpa)} ms; {tre} lần > {GPS_TRE_MS} ms")
    ct = d.cua("CTUN", bay_a, bay_b)
    if ct:
        dong.append(f"- Leo nhanh nhất {max(c[4] for c in ct):.1f} m/s, hạ nhanh nhất "
                    f"{min(c[4] for c in ct):.1f} m/s · ga ra (ThO) {thong_ke([c[1] for c in ct])}"
                    f" · hover học được {ct[-1][2]:.3f}")  # fmt: skip
    bat = d.cua("BAT", a, b)
    if bat:
        dong.append(f"- Pin {bat[0][1]:.2f} → {bat[-1][1]:.2f} V (thấp nhất "
                    f"{min(x[1] for x in bat):.2f}) · dòng {thong_ke([x[2] for x in bat])} A · "
                    f"tốn {bat[-1][3] - bat[0][3]:.0f} mAh")  # fmt: skip
    vi = d.cua("VIBE", bay_a, bay_b)
    if vi:
        dong.append(f"- Rung (m/s², tốt < 30, xấu > 60): X {thong_ke([v[1] for v in vi])} · "
                    f"Y {thong_ke([v[2] for v in vi])} · Z {thong_ke([v[3] for v in vi])} · "
                    f"clip +{vi[-1][4] - vi[0][4]}")  # fmt: skip
    kf = d.cua("XKF4", bay_a, bay_b)
    if kf:
        sv, sp, sh, sm = (max(k[i] for k in kf) for i in range(1, 5))  # DFReader đã chia 100
        co_loi = " · CÓ cờ lỗi FS" if any(k[5] for k in kf) else ""
        dong.append(f"- EKF (tỉ số kiểm < 1 là nhận đo): vận tốc max {sv:.2f}, vị trí {sp:.2f}, "
                    f"cao {sh:.2f}, la bàn {sm:.2f}{co_loi}")  # fmt: skip
    dong.append(f"- Bám góc: {bam_goc(d, bay_a, bay_b)}")
    if cat:
        dong.append(f"- Lúc rời đất: {luc_roi_dat(d, cat)}")
    dong.append(f"- Góc giữ chỗ khi treo: {nghieng_khi_treo(d, bay_a, bay_b)}")
    st = stabilize(d, bay_a, bay_b)
    if st:
        dong.append(f"- Đoạn STABILIZE: {st}")
    dong.append(f"- Cân bằng motor: {can_bang_motor(d, bay_a, bay_b)}")
    ou = d.cua("RCOU", bay_a, bay_b)
    if ou:
        tran = sum(1 for r in ou if max(r[1:5]) >= 1950)
        san = sum(1 for r in ou if min(r[1:5]) <= 1100)
        dong.append(f"- Motor chạm trần (≥1950) {tran} mẫu, chạm sàn (≤1100) {san} mẫu / {len(ou)}")
    dong.append("- ESC khởi động: " + "; ".join(khoi_dong_esc(d, a, b)))
    tut = tut_vong_khi_bay(d, bay_a, bay_b)
    dong.append("- ESC tụt vòng khi bay: " + ("; ".join(tut) if tut else "không"))
    nhiet = [r[3] for r in d.cua("ESC", a, b)]
    if nhiet:
        dong.append(f"- Nhiệt ESC lớn nhất {max(nhiet):.0f} °C")
    wp = diem_mission(d, a, b)
    if wp:
        dong.append("- Mission: " + "; ".join(wp))
    for r in d.cua("ERR", a, b):
        dong.append(f"- LỖI {log.gio(r[0])}: {HE_LOI.get(r[1], r[1])} mã {r[2]}")
    for r in d.cua("MSG", a, b):
        dong.append(f"- FC {log.gio(r[0])}: {r[1]}")
    return dong


def tong_quat(d: DuLieu, log: LogBin) -> list[str]:
    dong = ["## Toàn log"]
    if log.lech:
        dong.append(f"- Bảng FMT mượn: lệch {log.lech} byte khi duyệt (0 = khớp hoàn toàn)")
    att = d.ds["ATT"]
    if att:
        dong.append(f"- Có dữ liệu bay từ {log.gio(att[0][0])} tới {log.gio(att[-1][0])}")
    gpa = [r[1] for r in d.ds["GPA"]]
    if gpa:
        tre = sum(x > GPS_TRE_MS for x in gpa)
        dong.append(f"- Gói GPS cách nhau (cả log): {thong_ke(gpa)} ms; {tre} lần > {GPS_TRE_MS}")
    vcc = [p[1] for p in d.ds["POWR"] if not math.isnan(p[1])]
    if d.ds["POWR"]:
        do = f"{thong_ke(vcc)} V" if vcc else "bo không đo (NaN)"
        dong.append(f"- Nguồn bo: Vcc {do}; cờ nguồn gặp: {sorted({p[3] for p in d.ds['POWR']})}")
    pm = d.ds["PM"]
    if pm:
        cham = sum(p[2] for p in pm)
        dong.append(f"- CPU: tải {thong_ke([p[1] / 10 for p in pm])} %, vòng lặp chậm {cham}")
    if d.ds["DSF"]:
        dong.append(f"- Log rơi {d.ds['DSF'][-1][1]} message (bộ đệm ghi đầy)")
    rf = [r[1] for r in d.ds["RFND"] if r[2] == 4]
    if rf:
        dong.append(f"- TFmini (đo được): {thong_ke(rf)} m")
    for r in d.ds["ERR"]:
        dong.append(f"- LỖI {log.gio(r[0])}: {HE_LOI.get(r[1], r[1])} mã {r[2]}")
    return dong


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("log", type=Path)
    ap.add_argument("--fmt-tu", type=Path, help="log nguyên vẹn cùng firmware, mượn bảng FMT")
    ap.add_argument("--md", type=Path, help="ghi báo cáo Markdown ra file này")
    args = ap.parse_args()
    try:
        log = LogBin(args.log, args.fmt_tu)
    except (OSError, ValueError) as exc:
        print(f"[phan_tich_log] {exc}", file=sys.stderr)
        return 2
    d = DuLieu(log)
    dong = [f"# {args.log.name}", ""]
    if log.duong_dan != args.log:
        dong += [f"Đọc qua bản ghép bảng FMT: `{log.duong_dan}`", ""]
    for so, (a, b, ghi_chu) in enumerate(cac_chuyen(d), 1):
        dong += mot_chuyen(d, log, so, a, b, ghi_chu) + [""]
    dong += tong_quat(d, log)
    bao_cao = "\n".join(dong) + "\n"
    print(bao_cao)
    if args.md:
        args.md.write_text(bao_cao, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
