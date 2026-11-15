"""Test upload / readback / start mission — Phase 07 §7.2–7.5, §7.10.1.

Chạy với `FakeMissionFC` (backend/tests/fakes.py), không cần SITL. Phần đối
chiếu với Mission Planner (oracle độc lập) là nghiệm thu tay §7.11 bài 2.
"""

from __future__ import annotations

import asyncio
import threading
from dataclasses import replace

import pytest

from backend import config
from backend.mavlink import mission as mission_mod
from backend.mavlink.control import ControlError
from backend.mavlink.mission import (
    MAV_FRAME_GLOBAL,
    MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
    MissionManager,
    Waypoint,
    build_mission_items,
)
from backend.schemas import CmdMissionUpload, MissionWaypoint
from backend.tests.fakes import FakeMissionFC, stack_gia
from backend.ws import WebSocketHub

HOME = (10.762622, 106.660172)
D = 0.0001  # ~11 m


def _mission() -> list[Waypoint]:
    """takeoff + 4 waypoint + RTL — cùng hình dạng plans/samples/mission-4wp.json."""
    return [
        Waypoint(1, HOME[0], HOME[1], 5.0, command=22),
        Waypoint(2, HOME[0] + D, HOME[1], 5.0),
        Waypoint(3, HOME[0] + D, HOME[1] + D, 6.0),
        Waypoint(4, HOME[0], HOME[1] + D, 7.0),
        Waypoint(5, HOME[0] - D, HOME[1], 5.0),
        Waypoint(6, 0.0, 0.0, 0.0, command=20),
    ]


def _dung(**kich_ban):
    conn, fake, state, safety, control = stack_gia()
    state.home_lat, state.home_lon = HOME
    mgr = MissionManager(conn, state=state, control=control)
    fc = FakeMissionFC(conn, fake, mgr, **kich_ban)
    return mgr, fc, fake, state


@pytest.fixture(autouse=True)
def _nhanh(monkeypatch):
    # Hết giờ nhanh để test timeout không chờ 2 s x 3 lần.
    monkeypatch.setattr(config, "MISSION_ITEM_TIMEOUT_S", 0.05)


# ---------------------------------------------------------------------------
# §7.2 — dựng item
# ---------------------------------------------------------------------------
def test_seq_0_la_home_va_item_nguoi_dung_lui_mot_dong():
    items = build_mission_items(_mission(), HOME)

    assert len(items) == 7
    assert items[0].seq == 0 and items[0].frame == MAV_FRAME_GLOBAL
    assert (items[0].x, items[0].y) == (round(HOME[0] * 1e7), round(HOME[1] * 1e7))
    assert [i.seq for i in items] == list(range(7))
    assert items[1].command == 22 and items[1].z == 5.0
    assert items[-1].command == 20


def test_item_bay_dung_frame_so_voi_home_va_toa_do_nhan_1e7():
    items = build_mission_items(_mission(), HOME)

    for item in items[1:]:
        assert item.frame == MAV_FRAME_GLOBAL_RELATIVE_ALT_INT  # 6, không phải 0 (AMSL)
    assert items[2].x == round((HOME[0] + D) * 1e7)
    assert isinstance(items[2].x, int)
    assert items[3].z == 6.0


# ---------------------------------------------------------------------------
# §7.3 — state machine upload
# ---------------------------------------------------------------------------
def test_upload_tra_loi_dung_seq_fc_hoi_va_readback_khop():
    mgr, fc, fake, _ = _dung()
    tien_do: list[tuple[int, int]] = []

    kq = mgr.upload(_mission(), HOME, progress=lambda s, t: tien_do.append((s, t)))

    assert kq.count == 6 and kq.readback_ok
    assert fc.seq_da_tra_loi() == list(range(7))
    assert mgr.source == "readback"
    assert mgr.current == _mission()
    assert tien_do[-1] == (7, 7) and tien_do[0] == (1, 7)
    # Đọc lại xong phải báo FC là đã xong, không thì FC giữ phiên.
    assert fake.count("mission_ack_send") == 1


def test_fc_hoi_lai_seq_cu():
    """Lỗi kinh điển (§7.3 điểm 1, rủi ro điểm 15): FC hỏi lại seq đã gửi.
    Trả theo bộ đếm riêng thì từ đó trở đi lệch cả mission."""
    thu_tu = [0, 1, 2, 2, 3, 1, 4, 5, 6]
    mgr, fc, _, _ = _dung(order=thu_tu)

    mgr.upload(_mission(), HOME)

    assert fc.seq_da_tra_loi() == thu_tu
    assert fc.stored[2]["command"] == 16 and fc.stored[2]["x"] == round((HOME[0] + D) * 1e7)
    assert mgr.source == "readback"


def test_nhan_ca_mission_request_ban_cu():
    mgr, fc, _, _ = _dung(request_type="MISSION_REQUEST")

    kq = mgr.upload(_mission(), HOME)

    assert kq.readback_ok
    assert fc.seq_da_tra_loi() == list(range(7))


def test_ack_loi_nem_command_denied_co_tieng_viet_va_khong_doi_current():
    mgr, _, _, _ = _dung(ack=2)
    cu = [Waypoint(9, HOME[0], HOME[1], 5.0, command=22)]
    mgr.current, mgr.source = cu, "readback"

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "command_denied"
    assert "UNSUPPORTED_FRAME" in loi.value.message
    assert "sai `frame`" in loi.value.message
    # Mission cũ CHỈ bị thay sau ACK thành công (§7.3 điểm 4).
    assert mgr.current == cu and mgr.source == "readback"


def test_readback_lech_bao_loi_va_khong_goi_la_readback():
    def doi_alt(item):
        return {**item, "z": item["z"] + 3.0} if item["seq"] == 3 else item

    mgr, _, _, _ = _dung(mangle=doi_alt)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "command_denied"
    assert any("item 3" in m for m in loi.value.detail["mismatches"])
    # FC đã ACK nên nó ĐANG giữ mission mới — nhưng chưa xác nhận, không được
    # gọi là readback (UI Phase 09 chỉ vẽ khi source == "readback").
    assert mgr.source == "local"


def test_readback_lech_command_thi_bao_loi():
    mgr, _, _, _ = _dung(mangle=lambda it: {**it, "command": 16} if it["seq"] == 6 else it)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)
    assert any("command" in m for m in loi.value.detail["mismatches"])


def _mission_dung_2s() -> list[Waypoint]:
    """`_mission()` với waypoint đầu (dây seq 2) dừng 2 s — như điểm xa của mẫu đi–về."""
    wps = _mission()
    wps[1] = replace(wps[1], hold_s=2)
    return wps


def test_hold_di_vao_param1_cua_dung_waypoint_do_va_doc_lai_khop():
    mgr, fc, _, _ = _dung()

    kq = mgr.upload(_mission_dung_2s(), HOME)

    assert kq.readback_ok
    assert fc.stored[2]["param1"] == 2.0
    assert [fc.stored[s]["param1"] for s in (1, 3, 6)] == [0.0, 0.0, 0.0]
    assert mgr.current[1].hold_s == 2


def test_fc_giu_so_giay_dung_khac_thi_doc_lai_lech():
    mgr, _, _, _ = _dung(mangle=lambda it: {**it, "param1": 0.0} if it["seq"] == 2 else it)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission_dung_2s(), HOME)
    assert "item 2: dừng 0 s != 2 s" in loi.value.detail["mismatches"]
    assert mgr.source == "local"


def test_fc_im_lang_thi_thu_lai_roi_timeout():
    mgr, _, fake, _ = _dung(silent=True)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "timeout"
    assert fake.count("mission_count_send") == config.MISSION_RETRIES
    assert mgr.source == "none"


def test_fc_huy_phien_giua_chung_thi_nap_lai_tu_dau():
    """Wi-Fi rớt lâu, FC 8 s không nhận item thì tự huỷ phiên (MISSION_ACK 15
    OPERATION_CANCELLED). Đó không phải FC từ chối mission — nạp lại."""
    mgr, fc, fake, _ = _dung(chen_ack={3: 15})

    kq = mgr.upload(_mission(), HOME)

    assert kq.readback_ok
    assert fake.count("mission_count_send") == 2
    assert fc.seq_da_tra_loi() == [0, 1, 2, 3, *range(7)]
    assert mgr.source == "readback"


def test_giua_phien_im_lang_thi_gui_lai_item_cuoi_khong_lam_lai_tu_dau():
    """Drone thật 01/11/2026: mỗi phiên kịp 1–2 item thì một gói rơi; gửi lại MISSION_COUNT
    làm FC về seq 0 nên không bao giờ xong. Đúng: gửi lại item vừa gửi, giữ phiên. FC thấy
    item lặp thì trả ACK 13 (INVALID_SEQUENCE) rồi hỏi tiếp — kể cả ngay trước ACK cuối,
    như tlog 19:07:33 (ACK 13, ACK 0, "Flight plan received")."""
    mgr, fc, fake, _ = _dung(mat_hoi={3, 6})

    kq = mgr.upload(_mission(), HOME)

    assert kq.readback_ok
    assert fake.count("mission_count_send") == 1
    assert fc.seq_da_tra_loi() == [0, 1, 2, 2, 3, 4, 5, 5, 6]


def test_giua_phien_im_qua_moc_huy_cua_fc_thi_moi_nap_lai(monkeypatch):
    monkeypatch.setattr(mission_mod, "FC_UPLOAD_TIMEOUT_S", 0.3)
    mgr, fc, fake, _ = _dung(cam_sau=3)

    kq = mgr.upload(_mission(), HOME)

    assert kq.readback_ok
    assert fake.count("mission_count_send") == 2
    gui = fc.seq_da_tra_loi()
    assert gui[:5] == [0, 1, 2, 3, 3]  # im lặng thì gửi lại item 3 trước đã
    assert gui[-7:] == list(range(7))


def test_item_toi_tre_bi_fc_bao_lac_thu_tu_thi_cho_tiep():
    """Item tới trễ/lặp lại → FC trả MISSION_ACK 13 nhưng vẫn giữ phiên và hỏi seq kế."""
    mgr, fc, fake, _ = _dung(chen_ack={3: 13})

    kq = mgr.upload(_mission(), HOME)

    assert kq.readback_ok
    assert fake.count("mission_count_send") == 1
    assert fc.seq_da_tra_loi() == list(range(7))


def test_bang_ma_mission_ack_khop_pymavlink():
    """Bảng khai tay từng sai (13/15 bị đổi chỗ thành 10/13) mà không test nào đỏ."""
    common = pytest.importorskip("pymavlink.dialects.v20.common")
    for ma, (ten, _) in mission_mod.MISSION_ACK_NAMES.items():
        assert getattr(common, ten) == ma, ten
    assert mission_mod.MAV_MISSION_INVALID_SEQUENCE == common.MAV_MISSION_INVALID_SEQUENCE
    assert mission_mod.MAV_MISSION_OPERATION_CANCELLED == common.MAV_MISSION_OPERATION_CANCELLED


def test_fc_huy_phien_mai_thi_het_luot_roi_bao_timeout_kem_goi_y_wifi():
    mgr, _, fake, _ = _dung(ack=15)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "timeout"
    assert "Wi-Fi" in loi.value.message
    assert fake.count("mission_count_send") == config.MISSION_RETRIES
    assert mgr.source == "none"


def test_mission_sai_bi_chan_truoc_khi_gui_mission_count():
    """§7.11 bài 4 ở mức unit: alt 50 m -> không một gói MISSION_* nào đi ra."""
    mgr, _, fake, _ = _dung()
    sai = [*_mission()]
    sai[2] = Waypoint(3, HOME[0] + D, HOME[1] + D, 50.0)

    with pytest.raises(ValueError, match="vượt giới hạn"):
        mgr.upload(sai, HOME)
    assert [n for n in fake.names() if n.startswith("mission_")] == []


def test_upload_thu_hai_khi_dang_upload_bi_tu_choi():
    mgr, _, fake, _ = _dung()
    assert mgr._busy.acquire(blocking=False)  # một phiên khác đang giữ
    try:
        with pytest.raises(ControlError) as loi:
            mgr.upload(_mission(), HOME)
    finally:
        mgr._busy.release()
    assert loi.value.code == "command_denied"
    assert fake.count("mission_count_send") == 0


def test_hai_phien_that_chay_song_song_chi_mot_phien_duoc_gui():
    """Không chỉ khoá — hai thread thật cùng gọi upload."""
    mgr, _, fake, _ = _dung()
    bat_dau = threading.Barrier(2)
    ket_qua: list[str] = []

    def chay():
        bat_dau.wait()
        try:
            mgr.upload(_mission(), HOME)
            ket_qua.append("ok")
        except ControlError as exc:
            ket_qua.append(exc.code)

    ts = [threading.Thread(target=chay) for _ in range(2)]
    for t in ts:
        t.start()
    for t in ts:
        t.join(5)
    # Có thể cả hai đều "ok" nếu phiên đầu xong trước khi phiên sau vào — nhưng
    # hai phiên không bao giờ CHỒNG nhau: mỗi MISSION_COUNT theo sau đủ 7 item.
    assert sorted(ket_qua) in (["command_denied", "ok"], ["ok", "ok"])
    ten = [n for n in fake.names() if n in ("mission_count_send", "mission_item_int_send")]
    for i, n in enumerate(ten):
        if n == "mission_count_send":
            assert ten[i + 1 : i + 8] == ["mission_item_int_send"] * 7


def test_goi_cua_gcs_khac_bi_bo_qua():
    """Mission Planner nối cùng lúc cũng nói chuyện MISSION_* với FC."""
    from backend.tests.fakes import FakeMessage

    mgr = MissionManager()
    mgr._open_session()
    mgr.on_message(FakeMessage("MISSION_REQUEST_INT", seq=0, target_system=255, mission_type=0))
    mgr.on_message(FakeMessage("MISSION_REQUEST_INT", seq=0, target_system=254, mission_type=2))
    assert mgr._inbox.empty()
    mgr.on_message(FakeMessage("MISSION_REQUEST_INT", seq=0, target_system=254, mission_type=0))
    assert mgr._inbox.qsize() == 1


def test_ngoai_phien_goi_mission_bi_bo():
    from backend.tests.fakes import FakeMessage

    mgr = MissionManager()
    mgr.on_message(FakeMessage("MISSION_ACK", type=0))  # không ném, không đọng lại
    mgr._open_session()
    assert mgr._inbox.empty()


def test_clear_xoa_trang_thai_sau_ack():
    mgr, _, _, _ = _dung()
    mgr.upload(_mission(), HOME)

    mgr.clear()
    assert mgr.current == [] and mgr.source == "none"


# ---------------------------------------------------------------------------
# §7.5 — start
# ---------------------------------------------------------------------------
def test_start_khong_tu_arm():
    mgr, _, fake, state = _dung()
    mgr.upload(_mission(), HOME)
    state.armed = False
    truoc = fake.count("command_long_send")  # upload đã gửi DO_SET_MISSION_CURRENT

    with pytest.raises(ControlError) as loi:
        mgr.start()

    assert loi.value.code == "validation_failed"
    assert fake.count("command_long_send") == truoc  # không arm, không đổi mode


def test_start_doi_hoi_mission_da_readback():
    mgr, _, _, _ = _dung()
    mgr.current, mgr.source = _mission(), "local"

    with pytest.raises(ControlError) as loi:
        mgr.start()
    assert loi.value.code == "validation_failed"


def test_start_auto_roi_mission_start():
    mgr, _, fake, state = _dung()
    mgr.upload(_mission(), HOME)
    mgr.control.set_mode = lambda mode, timeout=None: setattr(state, "mode", mode)

    mgr.start()

    lenh = [p["args"][2] for n, p in fake.sent if n == "command_long_send"]
    assert lenh == [224, 300]  # nạp xong đặt item bắt đầu, start chỉ thêm MISSION_START
    assert state.mode == "AUTO"


def test_start_bi_fc_tu_choi_thi_bao_ro():
    mgr, _, _, state = _dung(mission_start_result=2)
    mgr.upload(_mission(), HOME)
    mgr.control.set_mode = lambda mode, timeout=None: None

    with pytest.raises(ControlError) as loi:
        mgr.start()
    assert loi.value.code == "command_denied" and "DENIED" in loi.value.message


# ---------------------------------------------------------------------------
# Nạp mission khi drone đang bay (02/11/2026): giữ chỗ GUIDED, bắt đầu lại từ item 1
# ---------------------------------------------------------------------------
def _vi_tri(fake, ten: str, lenh: int | None = None) -> int:
    """Vị trí gói đầu tiên tên `ten` (và MAV_CMD `lenh`) trong `fake.sent`."""
    for i, (n, p) in enumerate(fake.sent):
        if n == ten and (lenh is None or p["args"][2] == lenh):
            return i
    raise AssertionError(f"không thấy {ten} {lenh or ''}")


def test_dang_bay_auto_thi_guided_giu_cho_truoc_goi_mission_dau_tien():
    mgr, fc, fake, state = _dung()
    state.mode = "AUTO"
    goi_hold: list[int] = []

    mgr.upload(_mission(), HOME, on_hold=lambda: goi_hold.append(1))

    assert fc.lenh_da_gui() == [176, 224]
    doi_mode = fake.sent[_vi_tri(fake, "command_long_send", 176)][1]["args"]
    assert doi_mode[5] == 4  # GUIDED của Copter
    assert _vi_tri(fake, "command_long_send", 176) < _vi_tri(fake, "mission_count_send")
    assert goi_hold == [1]
    assert mgr.source == "readback"


@pytest.mark.parametrize(
    ("mode", "armed"),
    [("GUIDED", True), ("LOITER", True), ("AUTO", False)],
)
def test_khong_bay_auto_thi_khong_doi_mode(mode, armed):
    mgr, fc, _, state = _dung()
    state.mode, state.armed = mode, armed
    goi_hold: list[int] = []

    mgr.upload(_mission(), HOME, on_hold=lambda: goi_hold.append(1))

    assert fc.lenh_da_gui() == [224]
    assert goi_hold == []


def test_khong_chuyen_duoc_guided_thi_khong_gui_goi_mission_nao():
    mgr, _, fake, state = _dung(set_mode_result=4)  # MAV_RESULT_FAILED
    state.mode = "AUTO"
    cu = _mission()[:2]
    mgr.current, mgr.source = cu, "readback"
    goi_hold: list[int] = []

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME, on_hold=lambda: goi_hold.append(1))

    assert "GUIDED" in loi.value.message and "chưa gửi gói mission nào" in loi.value.message
    assert [n for n in fake.names() if n.startswith("mission_")] == []
    assert goi_hold == []
    assert mgr.current == cu and mgr.source == "readback"


def test_nap_xong_dat_item_bat_dau_ve_1_sau_khi_doc_lai():
    mgr, fc, fake, _ = _dung()

    mgr.upload(_mission(), HOME)

    assert fc.set_current_goi == [(1.0, 0.0)]  # seq 1, param2 0: chỉ đặt chỗ, không resume
    doc_lai_xong = max(i for i, (n, _) in enumerate(fake.sent) if n == "mission_ack_send")
    assert _vi_tri(fake, "command_long_send", 224) > doc_lai_xong


def test_fc_tu_choi_dat_item_bat_dau_thi_chua_duoc_start():
    mgr, _, _, _ = _dung(set_current_result=2)  # MAV_RESULT_DENIED

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "command_denied" and "DENIED" in loi.value.message
    assert mgr.current == _mission() and mgr.source == "local"  # FC giữ mission mới
    with pytest.raises(ControlError) as loi_start:
        mgr.start()
    assert loi_start.value.code == "validation_failed"


def test_mat_ack_dat_item_bat_dau_thi_gui_lai_toi_khi_fc_tra_loi():
    mgr, fc, fake, _ = _dung(set_current_result=None)
    goc = fc._react

    def react(ten, a):
        goc(ten, a)
        if ten == "command_long_send" and a[2] == 224:
            fc.set_current_result = 0  # gói đầu mất ack, lần gửi sau FC trả lời

    fc._react = react

    mgr.upload(_mission(), HOME)

    xac_nhan = [p["args"][3] for n, p in fake.sent if n == "command_long_send"]
    assert xac_nhan == [0, 1]
    assert mgr.source == "readback"


def test_fc_khong_bao_gio_tra_loi_dat_item_bat_dau_thi_het_luot_roi_bao_timeout():
    mgr, fc, _, _ = _dung(set_current_result=None)

    with pytest.raises(ControlError) as loi:
        mgr.upload(_mission(), HOME)

    assert loi.value.code == "timeout" and "nạp lại" in loi.value.message
    assert len(fc.set_current_goi) == config.MISSION_RETRIES
    assert mgr.source == "local"


# ---------------------------------------------------------------------------
# Đường WebSocket / REST dùng chung — hub.upload_mission
# ---------------------------------------------------------------------------
def _hub(**kich_ban):
    conn, fake, state, safety, control = stack_gia()
    state.home_lat, state.home_lon = HOME
    mgr = MissionManager(conn, state=state, control=control)
    FakeMissionFC(conn, fake, mgr, **kich_ban)
    hub = WebSocketHub(state=state, safety=safety, control=control, mission=mgr)
    return hub, fake, state


def _payload(wps: list[Waypoint], auto_start: bool = False) -> CmdMissionUpload:
    return CmdMissionUpload(
        waypoints=[
            MissionWaypoint(
                seq=w.seq, lat=w.lat, lon=w.lon, alt=w.alt, command=w.command, hold_s=w.hold_s
            )
            for w in wps
        ],
        auto_start=auto_start,
    )


def test_hub_upload_thanh_cong_va_status_thanh_readback():
    hub, _, _ = _hub()

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id=None))

    assert kq.ok and kq.count == 6 and kq.readback_ok
    st = hub.build_status().mission
    assert st.source == "readback" and st.count == 6 and st.uploaded_at is not None
    codes = [e.code for e in hub.bus.recent()]
    assert "mission.progress" in codes and "mission.uploaded" in codes


def test_hub_hold_tu_payload_web_toi_fc():
    """`hold_s` của payload WebSocket/REST không rơi mất ở `_to_waypoints`."""
    hub, fake, _ = _hub()

    kq = asyncio.run(hub.upload_mission(_payload(_mission_dung_2s()), socket_id=None))

    assert kq.ok and kq.readback_ok
    param1 = [p["args"][7] for n, p in fake.sent if n == "mission_item_int_send"]
    assert param1 == [0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0]
    assert hub.mission.current[1].hold_s == 2


def test_hub_hold_le_bi_chan_truoc_khi_gui():
    hub, fake, _ = _hub()
    wps = _mission()
    wps[1] = replace(wps[1], hold_s=2.5)

    kq = asyncio.run(hub.upload_mission(_payload(wps), socket_id=None))

    assert not kq.ok and kq.code == "validation_failed"
    assert any("WP2" in e and "giây nguyên" in e for e in kq.errors)
    assert [n for n in fake.names() if n.startswith("mission_")] == []


def test_hub_thieu_takeoff_bi_chan_khong_gui_goi_nao():
    hub, fake, _ = _hub()

    kq = asyncio.run(hub.upload_mission(_payload(_mission()[1:]), socket_id=None))

    assert not kq.ok and kq.code == "validation_failed"
    assert any("NAV_TAKEOFF" in e for e in kq.errors)
    assert [n for n in fake.names() if n.startswith("mission_")] == []


def test_hub_chua_co_home_thi_tu_choi():
    hub, _, state = _hub()
    state.home_lat = state.home_lon = None

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id=None))
    assert not kq.ok and kq.code == "validation_failed" and "HOME" in kq.errors[0]


def test_hub_tab_khac_dang_lai_thi_khong_upload_duoc():
    hub, fake, _ = _hub()
    hub.web_control_owner = "s-9"

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id="s-1"))
    assert kq.code == "command_denied"
    assert fake.count("mission_count_send") == 0


def test_hub_dang_bay_auto_bao_giu_cho_roi_nhac_bam_bat_dau():
    hub, _, state = _hub()
    state.mode = "AUTO"

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id=None))

    assert kq.ok and kq.readback_ok
    ev = {e.code: e for e in hub.bus.recent()}
    assert ev["mission.hold_for_upload"].level == "warn"
    assert "GUIDED" in ev["mission.hold_for_upload"].message
    xong = ev["mission.uploaded"]
    assert "bấm AUTO ở trang Bay" in xong.message and xong.detail["held"] is True
    codes = [e.code for e in hub.bus.recent()]
    assert codes.index("mission.hold_for_upload") < codes.index("mission.progress")


def test_hub_khong_bay_auto_thi_khong_bao_giu_cho():
    hub, _, _ = _hub()  # GUIDED, armed

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id=None))

    assert kq.ok
    ev = {e.code: e for e in hub.bus.recent()}
    assert "mission.hold_for_upload" not in ev
    assert ev["mission.uploaded"].detail["held"] is False
    assert "bấm AUTO" not in ev["mission.uploaded"].message


def test_hub_giu_cho_roi_nap_hong_thi_bao_drone_van_guided():
    hub, _, state = _hub(ack=2)
    state.mode = "AUTO"

    kq = asyncio.run(hub.upload_mission(_payload(_mission()), socket_id=None))

    assert not kq.ok and kq.code == "command_denied"
    assert kq.errors[0].endswith("Drone vẫn GUIDED đứng giữ chỗ.")
    loi = [e for e in hub.bus.recent() if e.code == "mission.upload_failed"]
    assert loi and loi[-1].message.endswith("Drone vẫn GUIDED đứng giữ chỗ.")
