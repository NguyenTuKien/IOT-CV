#!/usr/bin/env python3
"""Runner cấu hình NGOÀI TRỜI (01/11/2026) — nạp đúng 01-base + 02-avoid lên SITL rồi
thử từng lưới an toàn bằng cách cố tình vượt nó, giống người mới bay sẽ lỡ tay:

    S1  mission đi–về (đúng hình mẫu "Đi – về" mặc định trên web: 5 m, 1 lượt, mỗi đầu
        dừng 2 s): vào AUTO lúc đang bay, hết mission thì RTL. Có dừng thì drone phải tới
        ĐỦ 5 m (sai số dưới nửa mét). Điểm cuối nằm trên home nên chặng RTL KHÔNG được leo
        lên 15 m. Không nhanh quá WP_SPD 3 m/s; hạ đúng chỗ cất cánh. Lệnh RTL nằm TRONG
        mission thì FC vẫn báo mode AUTO (submode RTL), nên chặng đó được nhận ra bằng
        MISSION_CURRENT, không phải bằng mode.
    S1B đối chứng của S1: cùng mission nhưng KHÔNG dừng — đo xem drone quay đầu sớm bao xa
        (lý do web đặt 2 s dừng).
    S2  LOITER đẩy ga hết cỡ: AC_Avoid phải dừng drone dưới trần (20 m − FENCE_MARGIN).
    S3  STABILIZE đẩy ga (mode này không có avoid): vượt trần 20 m -> FENCE_ACTION 1 ->
        RTL về hạ cánh. In độ vọt quá trần để biết lề an toàn thật.
    S4  LOITER đẩy cần tiến hết cỡ: không nhanh quá LOIT_SPEED_MS 3 m/s; không ra khỏi
        vòng FENCE_RADIUS (avoid dừng lại trước rào, hoặc chạm rào thì RTL).
    S5  ALT_HOLD đẩy cần tiến vừa phải (mode này không giữ vị trí): chạm rào -> RTL.
        In quãng vọt ra ngoài rào trước khi quay về.
    S6  Mất sóng tay cầm (SIM_RC_FAIL) khi đang LOITER cách home 20 m -> FS_THR_ENABLE 1
        -> RTL.
    S7  Pin tụt dưới BATT_LOW_VOLT (vẫn trên BATT_CRT_VOLT) -> BATT_FS_LOW_ACT 2 -> RTL.
        Failsafe pin chốt tới khi khởi động lại, nên bài này luôn chạy CUỐI.

Bù cho mô phỏng (GPS ảo ở SERIAL4, TFmini ảo ở SERIAL3, khung bfx, bit RC ảo, hệ số
dòng ảo, pin ảo 4S) lấy NGUYÊN từ `run_param_load.py` — lý do từng thứ ghi ở đó. Thêm
một thứ: trước mỗi bài đặt lại dung lượng pin đã dùng về 100 % (`MAV_CMD_BATTERY_RESET`).
Dòng ảo của SITL ~35 A (run_param_load đo 195 mAh / 20 s), cả buổi ~9 phút bay ảo là
vượt `BATT_LOW_MAH` -> failsafe dung lượng chen vào giữa các bài khác.

Hai điều về RC ảo của SITL mà các bài phải tính tới: ga mặc định 1000 (cần ga thấp nhất),
nên ở LOITER/ALT_HOLD mà không gửi RC override là drone tự hạ; và override MAVLink cũng
tính là "có sóng" (`RC_Channels::read_input`), nên bài mất sóng phải NGỪNG gửi override.

CHẠY TRONG WSL:
    ~/venv-ardupilot/bin/python3 -u scripts/sitl/run_ngoai_troi.py [--chi S1,S6] [--bo-nap]

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
import run_param_load as pl  # noqa: E402
from harness import MODE_ID_TO_NAME, SitlError, SitlInstance, print_ket_qua  # noqa: E402
from pymavlink import mavutil  # noqa: E402

MAV = mavutil.mavlink
USE_DIR = "ngoai-troi"
SPEEDUP = 2
PARAM_FILES = [pl.PARAMS_DIR / "01-base.param", pl.PARAMS_DIR / "02-avoid-tfmini.param"]
EXTRA = pl.SITL_KHUNG + pl.SITL_DI_DAY
CMD_BATTERY_RESET = 42651  # MAV_CMD_BATTERY_RESET (ardupilotmega.xml)

# Hình mẫu "Đi – về" mặc định của web (RoutePlanner.tsx + OUTBACK_HOLD_S trong routeTools.ts):
# 5 m, 1 lượt, cao 5 m (độ cao mặc định của bản nháp), mỗi đầu dừng 2 s. Người dùng đổi từ
# 15 m / 2 lượt sang 5 m chiều 01/11/2026 vì 15 m "quá xa".
DI_VE_XA_M = 5.0
DI_VE_HUONG = 0.0
DI_VE_CAO_M = 5.0
DI_VE_LUOT = 1
DI_VE_DUNG_S = 2.0
# Có dừng thì FC không nối chặng sau vào (ModeAuto::set_next_wp), tới đúng điểm; SITL giữ
# vị trí sai dưới nửa mét.
DI_VE_SAI_SO_M = 0.5
# Không dừng thì Copter vào cua trước điểm xa và chỉ cần vào trong bán kính này. 2 m là mặc
# định trên cả FC thật (00-after-flash.param) lẫn SITL; 01-base không đổi nó. Lần chạy đầu
# 01/11/2026 kiểm "tới trong 1 m" nên báo FAIL oan: drone quay đầu ở 13,5 m của điểm 15 m.
WP_RADIUS_M = 2.0

# Trần và rào đọc từ CHÍNH bộ param nạp lên SITL (15/11/2026 rào đổi 50 -> 100 m; hằng số cũ
# sẽ làm S4/S5 chấm theo rào cũ mà vẫn tưởng đang thử cấu hình thật).
_FENCE = dict(p for f in PARAM_FILES for p in harness.read_param_file(f))
TRAN_M = _FENCE["FENCE_ALT_MAX"]
RAO_M = _FENCE["FENCE_RADIUS"]
PIN_AO_V = pl.SITL_THAY_PARAM["SIM_BATT_VOLTAGE"]  # 16,8 V = 4S đầy
PIN_THU_V = 13.75  # áp FC đọc muốn có ở S7: dưới BATT_LOW_VOLT 14,0, cách CRT 13,2 đủ xa

GIUA = {1: 1500, 2: 1500, 3: 1500, 4: 1500}
GA_LEN = {**GIUA, 3: 1900}
GA_STAB = {**GIUA, 3: 1600}  # STABILIZE: 1500 ≈ ga treo, 1600 = leo vừa phải
TIEN_HET = {**GIUA, 2: 1100}  # kênh 2 = pitch, nhỏ hơn 1500 là chúi mũi tiến
TIEN_VUA = {**GIUA, 2: 1350}
TRA_LAI = {1: 0, 2: 0, 3: 0, 4: 0}  # 0 = trả quyền cho RC ảo của SITL


class Theo:
    """Đọc gói của FC, gom số liệu một bài: độ cao / xa home / tốc độ lớn nhất, chuỗi mode,
    độ cao lớn nhất theo từng mục mission, armed, STATUSTEXT, trạng thái lúc vào RTL."""

    def __init__(self, sitl: SitlInstance, home: tuple[float, float]) -> None:
        self.sitl, self.home = sitl, home
        self.alt = self.dist = self.gs = self.leo = 0.0
        self.max_alt = self.max_dist = self.max_gs = 0.0
        self.max_alt_seq: dict[int, float] = {}
        self.seq: int | None = None
        self.modes: list[str] = []
        self.mode: str | None = None
        self.armed: bool | None = None
        self.texts: list[str] = []
        self.luc_rtl: tuple[float, float, float, float] | None = None  # (cao, xa, gs, leo)

    def _nhan(self, m) -> None:
        t = m.get_type()
        if t == "STATUSTEXT":
            self.sitl.statustext_log.append(m.text)
            self.texts.append(m.text)
        elif t == "HEARTBEAT" and m.get_srcSystem() == self.sitl.master.target_system:
            self.armed = bool(m.base_mode & MAV.MAV_MODE_FLAG_SAFETY_ARMED)
            self.mode = MODE_ID_TO_NAME.get(m.custom_mode, str(m.custom_mode))
            if not self.modes or self.modes[-1] != self.mode:
                self.modes.append(self.mode)
            if self.mode == "RTL" and self.luc_rtl is None:
                self.luc_rtl = (self.alt, self.dist, self.gs, self.leo)
        elif t == "MISSION_CURRENT":
            self.seq = m.seq
        elif t == "GLOBAL_POSITION_INT":
            self.alt = m.relative_alt / 1000
            self.dist = harness.haversine_m(self.home[0], self.home[1], m.lat / 1e7, m.lon / 1e7)
            self.gs = math.hypot(m.vx, m.vy) / 100
            self.leo = -m.vz / 100
            self.max_alt = max(self.max_alt, self.alt)
            self.max_dist = max(self.max_dist, self.dist)
            self.max_gs = max(self.max_gs, self.gs)
            if self.seq is not None and self.mode == "AUTO":
                self.max_alt_seq[self.seq] = max(self.max_alt_seq.get(self.seq, 0.0), self.alt)

    def cho(self, dung, timeout: float, rc: dict[int, int] | None = None) -> bool:
        """Đọc tới khi `dung(self)` đúng (True) hoặc hết `timeout` giây đồng hồ (False).
        `rc`: gửi lại RC override mỗi 0,2 s trong lúc chờ."""
        het = time.monotonic() + timeout
        gui = 0.0
        while time.monotonic() < het:
            if rc is not None and time.monotonic() - gui > 0.2:
                self.sitl.rc_override(rc)
                gui = time.monotonic()
            m = self.sitl.master.recv_match(
                type=["STATUSTEXT", "HEARTBEAT", "GLOBAL_POSITION_INT", "MISSION_CURRENT"],
                blocking=True,
                timeout=0.3,
            )
            if m is not None:
                self._nhan(m)
            if dung(self):
                return True
        return False

    def cho_ha_canh(self, timeout: float = 240.0) -> bool:
        return self.cho(lambda s: s.armed is False, timeout)

    def mode_chuoi(self) -> str:
        return ">".join(self.modes)


def nap_param(d: Path) -> list[str]:
    """Nạp bộ param dự án + phần bù mô phỏng, qua các lần khởi động lại (tham số con chỉ
    xuất hiện sau khi tham số cha bật). Trả tên không tồn tại trên SITL."""
    con: dict[str, float] = {}
    for f in PARAM_FILES:
        con.update(harness.read_param_file(f))
    con.update(pl.SITL_THAY_PARAM)
    con.update(pl.SITL_BU_DONG)
    con.update(pl.SITL_BU_RPM)  # ESC ảo báo 0 vòng: TKOFF_RPM_MIN của FC thật chặn cất cánh
    con["RC_PROTOCOLS"] = int(con.get("RC_PROTOCOLS", 1)) | pl.BIT_RC_SITL_UDP
    for luot in range(3):
        with SitlInstance(d, speedup=5, wipe_eeprom=(luot == 0), extra_args=EXTRA) as sitl:
            co_san = sitl.fetch_all_params()
            for ten in [t for t in con if t in co_san]:
                sitl.set_param(ten, con.pop(ten))
        if not con:
            break
    return sorted(con)


def pin_day(sitl: SitlInstance) -> None:
    sitl.master.mav.command_long_send(
        sitl.master.target_system, sitl.master.target_component,
        CMD_BATTERY_RESET, 0, 0xFF, 100, 0, 0, 0, 0, 0,
    )  # fmt: skip
    ack = sitl.recv_match(
        "COMMAND_ACK", condition=f"COMMAND_ACK.command=={CMD_BATTERY_RESET}", timeout=10
    )
    if ack is None or ack.result != MAV.MAV_RESULT_ACCEPTED:
        raise SitlError(f"Đặt lại dung lượng pin không được: {ack}")


def cat_canh(sitl: SitlInstance, cao: float) -> None:
    sitl.set_mode("GUIDED")
    sitl.arm()
    sitl.takeoff(cao)


def toi(sitl: SitlInstance, home, bac: float, dong: float, cao: float) -> None:
    lat, lon = harness.offset_latlon(home[0], home[1], bac, dong)
    sitl.master.mav.set_position_target_global_int_send(
        0, sitl.master.target_system, sitl.master.target_component,
        MAV.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT, 0x0DF8,
        int(lat * 1e7), int(lon * 1e7), cao, 0, 0, 0, 0, 0, 0, 0, 0,
    )  # fmt: skip


def bay_ra(sitl: SitlInstance, home, bac: float, dong: float) -> None:
    """Cất cánh 8 m, GUIDED tới điểm cách home (bac, dong) mét, rồi sang LOITER."""
    cat_canh(sitl, 8.0)
    toi(sitl, home, bac, dong, 8.0)
    xa = math.hypot(bac, dong)
    if not Theo(sitl, home).cho(lambda s: abs(s.dist - xa) < 1.5 and s.gs < 0.5, 40):
        raise SitlError(f"GUIDED không tới được điểm cách home {xa:.0f} m")
    sitl.set_mode("LOITER")


def mission_di_ve(home, dung_s: float) -> list[dict]:
    b = math.radians(DI_VE_HUONG)
    xa = harness.offset_latlon(home[0], home[1], DI_VE_XA_M * math.cos(b), DI_VE_XA_M * math.sin(b))

    def wp(lat, lon):
        return {
            "command": 16, "x": int(lat * 1e7), "y": int(lon * 1e7), "z": DI_VE_CAO_M,
            "param1": dung_s,
        }  # fmt: skip

    items = [{"command": 16, "frame": 0, "x": int(home[0] * 1e7), "y": int(home[1] * 1e7), "z": 0}]
    items.append({"command": 22, "z": DI_VE_CAO_M})
    for _ in range(DI_VE_LUOT):
        items += [wp(*xa), wp(*home)]
    items.append({"command": 20})
    return items


def kq(ok: bool, chi_tiet: str) -> tuple[bool, str]:
    return ok, f"{'PASS' if ok else 'FAIL'}: {chi_tiet}"


def bai_s1(sitl, home, dung_s: float = DI_VE_DUNG_S):
    items = mission_di_ve(home, dung_s)
    seq_rtl = len(items) - 1
    harness.upload_mission(sitl, items)
    cat_canh(sitl, 3.0)  # như người dùng tự cất cánh ~3 m rồi gạt núm VrB sang AUTO
    sitl.set_mode("AUTO")
    th = Theo(sitl, home)
    xong = th.cho_ha_canh(300)
    cao_rtl = th.max_alt_seq.get(seq_rtl)
    if dung_s > 0:
        toi_du = DI_VE_XA_M - DI_VE_SAI_SO_M <= th.max_dist <= DI_VE_XA_M + 1
    else:
        toi_du = th.max_dist >= DI_VE_XA_M - WP_RADIUS_M
    ok = xong and cao_rtl is not None and cao_rtl <= DI_VE_CAO_M + 1
    ok = ok and toi_du and th.max_alt <= DI_VE_CAO_M + 1
    ok = ok and th.dist <= 3 and th.max_gs <= 3.5
    rtl = "KHÔNG tới" if cao_rtl is None else f"{cao_rtl:.1f} m"
    return kq(ok, f"xa nhất {th.max_dist:.1f} m, cao nhất {th.max_alt:.1f} m, chặng RTL cao nhất "
                  f"{rtl}, nhanh nhất {th.max_gs:.1f} m/s, hạ cách home {th.dist:.1f} m, "
                  f"mode {th.mode_chuoi()}")  # fmt: skip


def bai_s2(sitl, home):
    cat_canh(sitl, 5.0)
    sitl.set_mode("LOITER")
    th = Theo(sitl, home)
    th.cho(lambda s: False, 15, rc=GA_LEN)
    th.cho(lambda s: False, 1, rc=GIUA)
    sitl.set_mode("RTL")
    sitl.rc_override(TRA_LAI)
    Theo(sitl, home).cho_ha_canh()
    ok = TRAN_M - 4 <= th.max_alt <= TRAN_M - 0.5 and th.modes == ["LOITER"]
    return kq(ok, f"dừng ở {th.max_alt:.1f} m (trần {TRAN_M:.0f}, lề 2), mode {th.mode_chuoi()}")


def bai_s3(sitl, home):
    sitl.set_mode("STABILIZE")
    sitl.arm()
    th = Theo(sitl, home)
    vuot = th.cho(lambda s: s.mode == "RTL", 60, rc=GA_STAB)
    sitl.rc_override(TRA_LAI)
    xong = th.cho_ha_canh()
    ok = vuot and xong and th.max_alt < 40 and th.dist <= 3
    luc = th.luc_rtl or (0.0, 0.0, 0.0, 0.0)
    # luc[0] là mẫu vị trí cuối TRƯỚC nhịp tim báo RTL (mẫu 4 Hz) nên có thể thấp hơn trần
    # tới ~1,7 m khi đang leo nhanh — chỉ in tốc độ leo, đó mới là thứ quyết định độ vọt.
    return kq(ok, f"RTL={'có' if vuot else 'KHÔNG'}, đang leo {luc[3]:.1f} m/s khi chạm trần, "
                  f"cao nhất {th.max_alt:.1f} m (vọt {th.max_alt - TRAN_M:+.1f} m so với trần), "
                  f"hạ cách home {th.dist:.1f} m")  # fmt: skip


def bai_s4(sitl, home):
    cat_canh(sitl, 8.0)
    sitl.set_mode("LOITER")
    th = Theo(sitl, home)
    rtl = th.cho(lambda s: s.mode == "RTL", 25, rc=TIEN_HET)
    th.cho(lambda s: False, 1, rc=GIUA)
    if not rtl:
        sitl.set_mode("RTL")
    sitl.rc_override(TRA_LAI)
    Theo(sitl, home).cho_ha_canh()
    ok = th.max_gs <= 3.5 and (th.max_dist < RAO_M if not rtl else th.max_dist <= RAO_M + 5)
    return kq(ok, f"nhanh nhất {th.max_gs:.1f} m/s (LOIT_SPEED 3), xa nhất {th.max_dist:.1f} m, "
                  f"{'chạm rào -> RTL' if rtl else 'tự dừng trước rào'}")  # fmt: skip


def bai_s5(sitl, home):
    cat_canh(sitl, 8.0)
    sitl.set_mode("ALT_HOLD")
    th = Theo(sitl, home)
    rtl = th.cho(lambda s: s.mode == "RTL", 60, rc=TIEN_VUA)
    sitl.rc_override(TRA_LAI)
    if not rtl:
        sitl.set_mode("RTL")
    xong = th.cho_ha_canh()
    ok = rtl and xong and th.max_dist < RAO_M + 50 and th.dist <= 3
    luc = th.luc_rtl or (0.0, 0.0, 0.0, 0.0)
    return kq(ok, f"RTL={'có' if rtl else 'KHÔNG'} lúc cách home {luc[1]:.1f} m đang bay "
                  f"{luc[2]:.1f} m/s, xa nhất {th.max_dist:.1f} m "
                  f"(vọt {th.max_dist - RAO_M:+.1f} m ra ngoài rào), "
                  f"hạ cách home {th.dist:.1f} m")  # fmt: skip


def bai_s6(sitl, home):
    bay_ra(sitl, home, 0, 20)
    th = Theo(sitl, home)
    th.cho(lambda s: False, 3, rc=GIUA)  # đang LOITER, cần ở giữa — rồi tay cầm mất sóng
    sitl.set_param("SIM_RC_FAIL", 1)  # 1 = không còn xung; từ đây KHÔNG gửi override nữa
    t0 = time.monotonic()
    rtl = th.cho(lambda s: s.mode == "RTL", 20)
    tre = (time.monotonic() - t0) * SPEEDUP
    xong = th.cho_ha_canh()
    sitl.set_param("SIM_RC_FAIL", 0)
    ok = rtl and xong and th.dist <= 3
    return kq(ok, f"RTL={'có' if rtl else 'KHÔNG'} sau ~{tre:.1f} s mô phỏng, "
                  f"hạ cách home {th.dist:.1f} m, mode {th.mode_chuoi()}")  # fmt: skip


def bai_s7(sitl, home):
    bay_ra(sitl, home, 20, 0)
    th = Theo(sitl, home)
    th.cho(lambda s: False, 3, rc=GIUA)
    ss = sitl.master.messages.get("SYS_STATUS")
    if ss is None:
        raise SitlError("Không có SYS_STATUS để đọc áp pin ảo")
    # Áp FC đọc = hệ số × áp pin ảo: SITL giả định bộ chia 10,1 mà BATT_VOLT_MULT của bo thật
    # là 11,0, nên 16,8 V ảo thành ~18,3 V. Lần chạy đầu tưởng đó là sụt áp, trừ 1,5 V, và FC
    # đọc 13,34 V thay vì 13,75 V — vẫn lọt khoảng thử, nhưng đúng là may.
    v_fc = ss.voltage_battery / 1000
    v_ao = round(PIN_THU_V * PIN_AO_V / v_fc, 2)
    sitl.set_param("SIM_BATT_VOLTAGE", v_ao)
    t0 = time.monotonic()
    rtl = th.cho(lambda s: s.mode == "RTL", 60, rc=GIUA)
    tre = (time.monotonic() - t0) * SPEEDUP
    sitl.rc_override(TRA_LAI)
    xong = th.cho_ha_canh()
    sitl.set_param("SIM_BATT_VOLTAGE", PIN_AO_V)
    bao = [t for t in th.texts if "atter" in t][:2]
    ok = rtl and xong and th.dist <= 3 and "LAND" not in th.modes
    return kq(ok, f"pin ảo {PIN_AO_V} V FC đọc {v_fc:.2f} V -> hạ pin ảo còn {v_ao} V; "
                  f"RTL={'có' if rtl else 'KHÔNG'} sau ~{tre:.0f} s mô phỏng, "
                  f"hạ cách home {th.dist:.1f} m, mode {th.mode_chuoi()}, "
                  f"FC báo {bao}")  # fmt: skip


BAI = {
    "S1": ("S1 mission đi–về 5 m, dừng 2 s (AUTO)", bai_s1),
    "S1B": ("S1B đối chứng: đi–về 5 m không dừng", lambda sitl, home: bai_s1(sitl, home, 0.0)),
    "S2": ("S2 LOITER ga hết cỡ", bai_s2),
    "S3": ("S3 STABILIZE vượt trần", bai_s3),
    "S4": ("S4 LOITER tiến hết cỡ", bai_s4),
    "S5": ("S5 ALT_HOLD bay ra rào", bai_s5),
    "S6": ("S6 mất sóng tay cầm", bai_s6),
    "S7": ("S7 pin yếu", bai_s7),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chi", default=",".join(BAI), help="chạy vài bài, vd S1,S6")
    ap.add_argument("--bo-nap", action="store_true", help="giữ EEPROM của lần chạy trước")
    args = ap.parse_args()
    chon = [b.strip().upper() for b in args.chi.split(",") if b.strip()]
    if unknown := [b for b in chon if b not in BAI]:
        ap.error(f"không có bài {unknown}; có {list(BAI)}")
    d = harness.run_dir(USE_DIR)
    if not args.bo_nap:
        print(f"Tham số không có trên SITL (đã biết): {nap_param(d)}", flush=True)
    bang: list[tuple[str, str]] = []
    tat_ca = True
    with SitlInstance(d, speedup=SPEEDUP, wipe_eeprom=False, extra_args=EXTRA) as sitl:
        sitl.wait_ready(timeout=150)
        # EEPROM có thể còn trạng thái của một lần chạy hỏng giữa chừng (nhất là với --bo-nap).
        sitl.set_param("SIM_RC_FAIL", 0)
        sitl.set_param("SIM_BATT_VOLTAGE", PIN_AO_V)
        p = sitl.get_position()
        home = (p["lat"], p["lon"])
        for ma in chon:
            ten, chay = BAI[ma]
            print(f"== {ten}", flush=True)
            try:
                pin_day(sitl)
                ok, dong = chay(sitl, home)
            except SitlError as exc:
                ok, dong = False, f"FAIL: {exc}"
            bang.append((ten, dong))
            print(f"   {dong}", flush=True)
            tat_ca &= ok
            hb = sitl.recv_match("HEARTBEAT", timeout=5)
            if hb is None or hb.base_mode & MAV.MAV_MODE_FLAG_SAFETY_ARMED:
                bang.append(("(dừng)", "drone ảo chưa hạ cánh / mất nhịp tim — bỏ các bài sau"))
                tat_ca = False
                break
    print_ket_qua(bang, title="Cấu hình ngoài trời trên SITL")
    print(f"KET QUA: {'PASS' if tat_ca else 'FAIL'}")
    return 0 if tat_ca else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
