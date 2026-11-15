#!/usr/bin/env python3
"""Runner — nạp mission MỚI khi drone đang bay AUTO, qua backend thật (02/11/2026).

Hành vi cần chứng minh (`MissionManager.upload`, backend/mavlink/mission.py):

1. Drone đang bay AUTO mission A thì backend chuyển GUIDED (đứng giữ chỗ) TRƯỚC khi gửi
   MISSION_COUNT — FC không bao giờ in "Auto mission changed" (đang AUTO mà mission đổi thì
   ArduPilot bay ngay tới item cùng số thứ tự của mission mới).
2. Trong lúc nạp, drone đứng yên: lệch khỏi chỗ đứng không quá `DUNG_LECH_TOI_DA_M`.
3. Nạp xong FC báo item hiện tại = 1 (DO_SET_MISSION_CURRENT), dù mission A đã bay tới item 3.
4. Bấm BẮT ĐẦU AUTO (web gửi `cmd.mode AUTO`, ở đây runner gửi cùng lệnh DO_SET_MODE) thì
   drone bay mission B từ đầu: điểm đầu tiên nó tới là B1, không phải B2 (item 3).

Runner bay drone ảo bằng cổng tcp:5760; backend chạy trên Windows, nối cổng SERIAL2 (tcp:5763)
như `run_backend_avoid.py`. Mission nạp bằng `POST /api/mission`: đúng đường `hub.upload_mission`
mà web dùng. WSL ở chế độ mạng mirrored nên gọi thẳng được 127.0.0.1:8000 của Windows.

CHẠY (thứ tự hai bước tuỳ ý: backend tự thử nối lại 5763 tới khi SITL lên, runner chờ
backend nối FC tối đa 180 s):
  1. WSL:  ~/venv-ardupilot/bin/python3 -u scripts/sitl/run_nap_khi_bay.py
  2. Windows (cmd), bằng mã backend MỚI — tắt backend cũ đang giữ cổng 8000 trước:
       set "MAVLINK_ENDPOINT=tcp:127.0.0.1:5763" && uv run uvicorn backend.app:app --port 8000
Lần chạy 02/11/2026: PASS, số đo ở docs/so-tay/07-backend-mission-proximity-safety.md mục 14.

Máy bay ẢO hoàn toàn — xem SAFETY.md mục 1.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import harness  # noqa: E402
from harness import SitlError, SitlInstance, print_ket_qua  # noqa: E402

USE_DIR = "nap-khi-bay"
API = os.environ.get("IOTCV_API", "http://127.0.0.1:8000")
DO_CAO_M = 6.0  # trong khoảng MIN_ALT..MAX_ALT mặc định của backend (2..10 m)
# (bắc, đông) mét so với home, đều trong MAX_DISTANCE_HOME 50 m. A hướng bắc-đông, B hướng
# nam: drone bay về B1 hay B2 nhìn thấy ngay.
DIEM_A = [(0.0, 25.0), (25.0, 25.0), (25.0, 0.0)]
DIEM_B = [(-20.0, -20.0), (-35.0, 0.0), (-20.0, 20.0)]
SEQ_NAP_GIUA_CHUNG = 3  # mission A đang bay tới item 3 (A2) thì nạp B
DUNG_LECH_TOI_DA_M = 1.5  # lệch ngang tối đa khi đứng giữ chỗ (tính từ 3 s sau khi vào GUIDED)
DUNG_SAU_NAP_S = 5.0  # đứng thêm sau khi nạp xong, rồi mới bấm AUTO
TOI_DIEM_M = 3.0  # WPNAV_RADIUS mặc định 2 m + 1 m dư


def api(method: str, path: str, body: dict | None = None, timeout: float = 10.0) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        API + path, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def cho_backend(timeout: float = 180.0) -> None:
    het = time.monotonic() + timeout
    loi = "chưa thử"
    while time.monotonic() < het:
        try:
            if api("GET", "/api/system").get("link_alive"):
                return
            loi = "backend chạy nhưng chưa nối FC"
        except (urllib.error.URLError, OSError) as exc:
            loi = repr(exc)
        time.sleep(2.0)
    raise SitlError(f"Backend không nối được FC sau {timeout:.0f} s ({loi}) — đã bật chưa?")


def mission(home: dict, diem: list[tuple[float, float]]) -> dict:
    """TAKEOFF -> 3 waypoint -> RTL, đúng dạng payload `cmd.mission.upload` của web."""
    lat0, lon0 = home["lat"], home["lon"]
    wps = [{"seq": 1, "lat": lat0, "lon": lon0, "alt": DO_CAO_M, "command": 22}]
    for i, (bac, dong) in enumerate(diem, start=2):
        lat, lon = harness.offset_latlon(lat0, lon0, bac, dong)
        wps.append({"seq": i, "lat": lat, "lon": lon, "alt": DO_CAO_M, "command": 16})
    wps.append({"seq": len(wps) + 1, "lat": 0.0, "lon": 0.0, "alt": 0.0, "command": 20})
    return {"waypoints": wps, "auto_start": False}


def nap(home: dict, diem, *, lan_thu_home_s: float = 30.0) -> dict:
    """POST /api/mission. Backend chưa biết HOME thì đợi rồi thử lại (chỉ lỗi đó)."""
    het = time.monotonic() + lan_thu_home_s
    while True:
        kq = api("POST", "/api/mission", mission(home, diem), timeout=180.0)
        chua_home = kq.get("code") == "validation_failed" and any(
            "HOME" in e for e in kq.get("errors", [])
        )
        if not chua_home or time.monotonic() > het:
            return kq
        time.sleep(2.0)


def su_kien_moi_nhat(code: str) -> dict | None:
    events = api("GET", "/api/events?limit=200")["events"]
    return next((e for e in reversed(events) if e["code"] == code), None)


def giu_cho_cua(su_kien: dict | None):
    """Trường `held` của sự kiện mission.uploaded (None nếu không có)."""
    return ((su_kien or {}).get("detail") or {}).get("held")


def gui_doi_mode(sitl: SitlInstance, ten: str) -> None:
    """Gửi DO_SET_MODE rồi về NGAY — `sitl.set_mode` chờ HEARTBEAT và vứt các gói khác,
    tức vứt mất MISSION_CURRENT của mấy giây đầu, đúng chỗ runner cần đọc."""
    m = sitl.master
    m.mav.command_long_send(
        m.target_system, m.target_component, 176, 0, 1, harness.MODE_NAME_TO_ID[ten], 0, 0, 0, 0, 0
    )


def khoang_cach(a: dict, b: dict) -> float:
    return harness.haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])


def vi_tri(msg) -> dict:
    return {"lat": msg.lat / 1e7, "lon": msg.lon / 1e7, "alt": msg.relative_alt / 1000.0}


def main() -> int:
    ket_qua: list[tuple[str, str]] = []
    loi: list[str] = []

    with SitlInstance(harness.run_dir(USE_DIR), speedup=1) as sitl:
        sitl.wait_ready()
        home = sitl.get_position()
        print(f"PHASE ready {time.time():.3f}", flush=True)
        cho_backend()
        print("PHASE backend", flush=True)

        sitl.set_mode("GUIDED")
        sitl.arm()
        sitl.takeoff(DO_CAO_M)

        kq_a = nap(home, DIEM_A)
        if not (kq_a.get("ok") and kq_a.get("readback_ok")):
            raise SitlError(f"Nạp mission A hỏng: {kq_a}")
        giu_a = giu_cho_cua(su_kien_moi_nhat("mission.uploaded"))
        ket_qua.append(("Nạp A khi đang GUIDED", f"ok, giữ chỗ={giu_a}"))
        if giu_a is not False:
            loi.append(f"nạp A (không phải AUTO) mà backend báo giữ chỗ={giu_a}")

        sitl.set_mode("AUTO")
        het = time.monotonic() + 90
        seq = 0
        while seq < SEQ_NAP_GIUA_CHUNG and time.monotonic() < het:
            mc = sitl.recv_match("MISSION_CURRENT", timeout=5.0)
            seq = mc.seq if mc is not None else seq
        if seq < SEQ_NAP_GIUA_CHUNG:
            raise SitlError(f"Mission A không tới item {SEQ_NAP_GIUA_CHUNG} sau 90 s (seq={seq})")
        print(f"PHASE nap_b {time.time():.3f} seq_A={seq}", flush=True)

        # Nạp B ở luồng phụ; luồng chính đọc MAVLink suốt lúc nạp để đo drone đứng yên không.
        kq_b: dict = {}
        luong = threading.Thread(target=lambda: kq_b.update(nap(home, DIEM_B)), daemon=True)
        t0 = time.monotonic()
        so_dong_text = len(sitl.statustext_log)
        luong.start()
        t_guided = None
        mode_lac = None  # mode khác GUIDED thấy được khi đang đứng giữ chỗ
        moc = None  # chỗ đứng: vị trí 3 s sau khi vào GUIDED
        lech_max = lech_cao_max = 0.0
        seq_sau_nap = None
        het_dung = None
        while True:
            msg = sitl.master.recv_match(
                type=["HEARTBEAT", "GLOBAL_POSITION_INT", "MISSION_CURRENT", "STATUSTEXT"],
                blocking=True,
                timeout=1.0,
            )
            bay = time.monotonic()
            loai = msg.get_type() if msg is not None else None
            if loai == "STATUSTEXT":
                sitl.statustext_log.append(msg.text)
            elif loai == "HEARTBEAT" and msg.get_srcSystem() == sitl.master.target_system:
                ten = harness.MODE_ID_TO_NAME.get(msg.custom_mode)
                if ten == "GUIDED" and t_guided is None:
                    t_guided = bay
                elif ten != "GUIDED" and t_guided is not None and mode_lac is None:
                    mode_lac = ten
            elif loai == "GLOBAL_POSITION_INT" and t_guided is not None:
                p = vi_tri(msg)
                if moc is None and bay - t_guided >= 3.0:
                    moc = p
                elif moc is not None:
                    lech_max = max(lech_max, khoang_cach(moc, p))
                    lech_cao_max = max(lech_cao_max, abs(p["alt"] - moc["alt"]))
            elif loai == "MISSION_CURRENT" and not luong.is_alive():
                seq_sau_nap = msg.seq
            if not luong.is_alive() and het_dung is None:
                het_dung = bay + DUNG_SAU_NAP_S
            if het_dung is not None and bay >= het_dung:
                break
            if bay - t0 > 200:
                raise SitlError("Nạp B quá 200 s mà chưa xong")

        if not (kq_b.get("ok") and kq_b.get("readback_ok")):
            loi.append(f"nạp B hỏng: {kq_b}")
        giu = su_kien_moi_nhat("mission.hold_for_upload")
        xong_b = su_kien_moi_nhat("mission.uploaded")
        ket_qua.append(("Nạp B giữa chuyến AUTO", f"ok={kq_b.get('ok')} {kq_b.get('errors')}"))
        ket_qua.append(("Sự kiện giữ chỗ", giu["message"] if giu else "KHÔNG CÓ"))
        ket_qua.append(("Báo nạp xong", xong_b["message"] if xong_b else "KHÔNG CÓ"))
        if giu is None or giu_cho_cua(xong_b) is not True:
            loi.append("backend không báo giữ chỗ khi nạp lúc đang bay AUTO")
        if t_guided is None:
            loi.append("drone không chuyển GUIDED khi nạp lúc đang bay AUTO")
        else:
            ket_qua.append(("AUTO -> GUIDED sau khi gọi nạp", f"{t_guided - t0:.1f} s"))
        if mode_lac is not None:
            loi.append(f"đang đứng giữ chỗ thì mode đổi sang {mode_lac}")
        doi = [t for t in sitl.statustext_log[so_dong_text:] if "mission changed" in t]
        ket_qua.append(("STATUSTEXT 'Auto mission changed'", str(doi) if doi else "không có"))
        if doi:
            loi.append(f"FC đổi mission lúc đang AUTO: {doi}")
        if moc is None:
            loi.append("không đo được chỗ đứng giữ chỗ (GUIDED chưa đủ 3 s)")
        ket_qua.append(("Lệch ngang khi đứng giữ chỗ", f"{lech_max:.2f} m"))
        ket_qua.append(("Lệch độ cao khi đứng giữ chỗ", f"{lech_cao_max:.2f} m"))
        if lech_max > DUNG_LECH_TOI_DA_M or lech_cao_max > 1.0:
            loi.append(f"đứng không yên: ngang {lech_max:.2f} m, cao {lech_cao_max:.2f} m")
        ket_qua.append(("FC báo item hiện tại sau khi nạp", str(seq_sau_nap)))
        if seq_sau_nap != 1:
            loi.append(f"nạp xong FC báo item hiện tại {seq_sau_nap}, cần 1")

        # BẮT ĐẦU AUTO — cùng lệnh DO_SET_MODE mà backend gửi khi web bấm nút.
        gui_doi_mode(sitl, "AUTO")
        lat_b1, lon_b1 = harness.offset_latlon(home["lat"], home["lon"], *DIEM_B[0])
        b1 = {"lat": lat_b1, "lon": lon_b1}
        vao_auto = False
        seq_thay: list[int] = []
        toi: list[int] = []
        vi_tri_toi_b1 = None
        het = time.monotonic() + 90
        while time.monotonic() < het and 2 not in toi:
            msg = sitl.master.recv_match(
                type=["HEARTBEAT", "MISSION_CURRENT", "MISSION_ITEM_REACHED"],
                blocking=True,
                timeout=1.0,
            )
            loai = msg.get_type() if msg is not None else None
            if loai == "HEARTBEAT" and msg.get_srcSystem() == sitl.master.target_system:
                vao_auto = vao_auto or harness.MODE_ID_TO_NAME.get(msg.custom_mode) == "AUTO"
            elif loai == "MISSION_CURRENT" and vao_auto and seq_thay[-1:] != [msg.seq]:
                seq_thay.append(msg.seq)
            elif loai == "MISSION_ITEM_REACHED" and msg.seq not in toi:
                toi.append(msg.seq)
                if msg.seq == 2:
                    vi_tri_toi_b1 = sitl.get_position()
        ket_qua.append(("Item hiện tại sau BẮT ĐẦU AUTO", str(seq_thay)))
        ket_qua.append(("Item đã tới", str(toi)))
        if not vao_auto:
            loi.append("BẮT ĐẦU AUTO: FC không vào AUTO")
        if not seq_thay or seq_thay[0] not in (1, 2) or max(seq_thay) > 2:
            loi.append(f"vào AUTO không bắt đầu từ đầu mission B: item {seq_thay}")
        if vi_tri_toi_b1 is None:
            loi.append("không tới B1 (item 2) trong 90 s")
        else:
            cach = khoang_cach(vi_tri_toi_b1, b1)
            ket_qua.append(("Tới item 2, cách B1", f"{cach:.1f} m"))
            if cach > TOI_DIEM_M:
                loi.append(f"tới item 2 nhưng cách B1 {cach:.1f} m")

        sitl.set_mode("LAND")
        sitl.wait_disarmed(timeout=120.0)

    print_ket_qua(ket_qua, title="Nạp mission khi drone đang bay AUTO (02/11/2026)")
    if loi:
        for dong in loi:
            print(f"LỖI: {dong}", file=sys.stderr)
        print("KET QUA: FAIL")
        return 1
    print("KET QUA: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SitlError as exc:
        print(f"KET QUA: FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    except Exception as exc:  # noqa: BLE001
        import traceback

        traceback.print_exc()
        print(f"KET QUA: FAIL — lỗi ngoài dự kiến: {exc!r}", file=sys.stderr)
        raise SystemExit(1) from exc
