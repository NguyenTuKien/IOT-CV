"""Bộ ghi video camera về laptop — thay thẻ nhớ (01/11/2026).

Hầu hết bài gọi thẳng `_step(frame, now)` với đồng hồ giả để biết chính xác khung nào vào
đoạn nào; hai bài chạy thread thật qua `MjpegLatestFrameReader.publish()` để chắc đường
camera → hàng đợi → file là đường thật và KHÔNG rơi khung.
"""

from __future__ import annotations

import csv
import sys
import threading
import time
from types import SimpleNamespace

import pytest

from backend.tests.avi_doc import doc_avi
from backend.vision.stream import MjpegFrame, MjpegLatestFrameReader
from backend.vision.video_recorder import CSV_HEADER, QUEUE_FRAMES, VideoRecorder

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")


def _jpeg(w: int = 320, h: int = 240, value: int = 128) -> bytes:
    ok, buf = cv2.imencode(".jpg", np.full((h, w, 3), value, dtype=np.uint8))
    assert ok
    return buf.tobytes()


def _frame(t: float, frame_id: int, *, w: int = 320, h: int = 240, jpeg: bytes | None = None):
    return MjpegFrame(
        jpeg=jpeg if jpeg is not None else _jpeg(w, h, value=(frame_id * 37) % 256),
        frame_id=frame_id,
        timestamp_ms=None,
        jpeg_quality=None,
        framesize=None,
        received_at=t,
    )


class _Reader:
    """Thay MjpegLatestFrameReader cho các bài gọi `_step` thẳng."""

    def subscribe(self, fn) -> None:
        pass

    def unsubscribe(self, fn) -> None:
        pass


def _rec(tmp_path, reader=None, **kw) -> VideoRecorder:
    kw.setdefault("segment_s", 300.0)
    kw.setdefault("gap_s", 2.0)
    kw.setdefault("min_free_gb", 0.0)
    return VideoRecorder(reader or _Reader(), out_dir=tmp_path / "rec", **kw)


def _chay(rec: VideoRecorder, t0: float, t1: float, moi_s: float, fid: int = 0) -> int:
    """Camera ra một khung mỗi `moi_s` từ t0 tới t1 (không gồm t1)."""
    t = t0
    while t < t1 - 1e-9:
        fid += 1
        rec._step(_frame(t, fid), t)
        t += moi_s
    return fid


def _csv(rec: VideoRecorder) -> list[dict[str, str]]:
    with open(rec.session_dir / "frames.csv", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    assert rows[0] == CSV_HEADER
    return [dict(zip(CSV_HEADER, r, strict=True)) for r in rows[1:]]


def test_moi_khung_camera_dung_mot_khung_video_nguyen_byte(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    frames = [_frame(i * 0.13, i + 1) for i in range(20)]
    for f in frames:
        rec._step(f, f.received_at)
    rec.stop()

    st = rec.status()
    assert (st["segments"], st["frames_written"], st["bad_frames"]) == (1, 20, 0)
    doc = doc_avi(st["segment_file"])
    assert doc.chunks == [f.jpeg for f in frames]
    assert doc.fps == pytest.approx(1 / 0.13, abs=1e-3)
    assert st["bytes_written"] == doc.file_bytes
    rows = _csv(rec)
    assert [r["video_frame"] for r in rows] == [str(i) for i in range(20)]
    assert [r["frame_id"] for r in rows] == [str(i + 1) for i in range(20)]


def test_mat_hinh_lau_hon_gap_thi_dong_doan_co_hinh_lai_mo_doan_moi(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    fid = _chay(rec, 0.0, 1.0, 0.125)  # khung cuối lúc 0,875
    # Thread ghi thức dậy không có khung (frame=None) mỗi 0,25 s.
    t = 1.0
    while t < 3.5:  # quá 0,875 + 2 s
        rec._step(None, t)
        t += 0.25
    assert not rec.status()["writing"], "mất hình > RECORD_GAP_S mà đoạn vẫn mở"
    assert rec.status()["reason"] is None  # chỉ đang chờ, không phải lỗi
    _chay(rec, 4.0, 5.0, 0.125, fid=fid)
    rec.stop()
    files = sorted(rec.session_dir.glob("video-*.avi"))
    assert [p.name for p in files] == ["video-001.avi", "video-002.avi"]
    assert [len(doc_avi(p).chunks) for p in files] == [8, 8]
    assert [r["segment"] for r in _csv(rec)] == ["1"] * 8 + ["2"] * 8


def test_mat_hinh_ngan_thi_chep_khung_cuoi_cho_kin_quang_video_dung_gio(tmp_path):
    """01/11/2026: camera rớt Wi-Fi vài giây một lần, mỗi lần một file mới — 223 file/buổi.
    Quãng mất ngắn hơn RECORD_GAP_S giờ nằm trong cùng file, lấp bằng khung cuối."""
    rec = _rec(tmp_path, gap_s=30.0)
    assert rec._begin_session()
    fid = _chay(rec, 0.0, 1.0, 0.125)  # 8 khung, 8 khung/s, khung cuối lúc 0,875
    cuoi = rec._last_jpeg
    _chay(rec, 4.0, 5.0, 0.125, fid=fid)  # mất hình 3,125 s rồi có lại
    rec.stop()
    files = sorted(rec.session_dir.glob("video-*.avi"))
    assert [p.name for p in files] == ["video-001.avi"]
    avi = doc_avi(files[0])
    # 3,125 s × 8 khung/s = 25 khoảng → 24 khung chép giữa khung 0,875 s và khung 4,0 s.
    assert len(avi.chunks) == 8 + 24 + 8
    assert avi.chunks[8:32] == [cuoi] * 24
    assert avi.fps == pytest.approx(8.0)
    assert len(avi.chunks) / avi.fps == pytest.approx(5.0)  # phát đúng 5 s như thật
    rows = _csv(rec)
    assert len(rows) == 16, "khung chép thêm không được có dòng trong frames.csv"
    assert [r["video_frame"] for r in rows[7:9]] == ["7", "32"]
    assert rec.status()["frames_written"] == 16


def test_nhip_camera_khong_deu_duoi_1s_thi_khong_chep_khung(tmp_path):
    rec = _rec(tmp_path, gap_s=30.0)
    assert rec._begin_session()
    for i, t in enumerate([0.0, 0.1, 0.9, 1.0, 1.95]):  # hở 0,8 s và 0,95 s: chưa là mất hình
        rec._step(_frame(t, i + 1), t)
    rec.stop()
    assert len(doc_avi(rec.segment_file).chunks) == 5


def test_khung_den_sau_quang_mat_hinh_tu_mo_doan_moi(tmp_path):
    """Không có lượt thức dậy nào giữa hai khung (máy bận) vẫn phải tách đoạn."""
    rec = _rec(tmp_path)
    assert rec._begin_session()
    rec._step(_frame(0.0, 1), 0.0)
    rec._step(_frame(5.0, 2), 5.0)
    rec.stop()
    assert rec.status()["segments"] == 2


def test_doi_co_khung_thi_mo_doan_moi(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    rec._step(_frame(0.0, 1, w=320, h=240), 0.0)
    rec._step(_frame(0.2, 2, w=640, h=480), 0.2)  # người dùng đổi framesize trên camera
    rec.stop()
    files = sorted(rec.session_dir.glob("video-*.avi"))
    assert [(doc_avi(p).width, doc_avi(p).height) for p in files] == [(320, 240), (640, 480)]


def test_qua_segment_s_thi_mo_doan_moi(tmp_path):
    rec = _rec(tmp_path, segment_s=1.0)
    assert rec._begin_session()
    _chay(rec, 0.0, 2.5, 0.25)
    rec.stop()
    assert rec.status()["segments"] == 3  # 0–1 s, 1–2 s, 2–2,5 s
    assert rec.status()["frames_written"] == 10


def test_jpeg_dut_bi_bo_qua_khong_tao_thu_muc(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    tot = _jpeg()
    rec._step(_frame(0.0, 1, jpeg=tot[: len(tot) // 2]), 0.0)  # Wi-Fi cắt ngang khung
    rec._step(_frame(0.1, 2, jpeg=b"\xff\xd8 khong phai jpeg \xff\xd9"), 0.1)
    st = rec.status()
    assert (st["bad_frames"], st["frames_written"], st["writing"]) == (2, 0, False)
    assert rec.session_dir is None  # chưa có khung tốt thì chưa tạo thư mục rác
    rec.stop()


def test_chua_co_hinh_thi_khong_tao_thu_muc(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    for i in range(5):
        rec._step(None, i * 0.25)
    rec.stop()
    assert not (tmp_path / "rec").exists()


def test_csv_ghi_kem_vi_tri_drone_va_gio_nhan_that(tmp_path):
    tele = SimpleNamespace(
        lat=21.0285, lon=105.8542, relative_alt=8.0, heading=90, mode="AUTO", armed=True
    )
    rec = _rec(tmp_path, telemetry=lambda: tele, wall=lambda: 1_000_000.0)
    assert rec._begin_session()
    # Khung nhận lúc t=10, nằm trong hàng đợi 0,5 s rồi mới tới lượt ghi.
    rec._step(_frame(10.0, 7), 10.5)
    rec.stop()
    row = _csv(rec)[0]
    assert row["unix_time"] == "999999.500"
    assert (row["frame_id"], row["video_frame"], row["segment"]) == ("7", "0", "1")
    assert (row["lat"], row["lon"], row["rel_alt_m"]) == ("21.0285", "105.8542", "8.0")
    assert (row["heading_deg"], row["mode"], row["armed"]) == ("90", "AUTO", "True")


def test_telemetry_hong_thi_cot_trong_van_ghi_hinh(tmp_path):
    def hong():
        raise RuntimeError("chưa có link")

    rec = _rec(tmp_path, telemetry=hong)
    assert rec._begin_session()
    rec._step(_frame(0.0, 1), 0.0)
    rec.stop()
    assert rec.status()["frames_written"] == 1
    assert _csv(rec)[0]["lat"] == ""


def test_khong_can_opencv(tmp_path, monkeypatch):
    frames = [_frame(i * 0.125, i + 1) for i in range(4)]  # tạo JPEG trước khi chặn cv2
    monkeypatch.setitem(sys.modules, "cv2", None)  # import cv2 -> ImportError
    monkeypatch.setitem(sys.modules, "numpy", None)
    rec = _rec(tmp_path)
    assert rec._begin_session()
    for f in frames:
        rec._step(f, f.received_at)
    rec.stop()
    assert rec.status()["frames_written"] == 4


def test_hang_doi_day_thi_bo_khung_va_dem(tmp_path):
    rec = _rec(tmp_path)
    assert rec._begin_session()
    f = _frame(0.0, 1)
    for _ in range(QUEUE_FRAMES + 5):
        rec._on_frame(f)  # không có thread ghi nào lấy ra
    assert rec.status()["dropped_frames"] == 5


def test_o_dia_day_thi_khong_ghi(tmp_path):
    rec = _rec(tmp_path, min_free_gb=1e12)
    st = rec.start()
    assert st["running"] is False
    assert "Ổ đĩa" in st["reason"]


def test_khong_co_camera_thi_bao_ly_do(tmp_path):
    rec = VideoRecorder(None, out_dir=tmp_path / "rec", min_free_gb=0.0)
    st = rec.start()
    assert st["running"] is False
    assert "vision" in st["reason"]


def test_thread_that_ghi_du_moi_khung_ke_ca_khung_den_don_dap(tmp_path):
    """40 khung dồn một lúc (kiểu TCP xả sau khi Wi-Fi khựng) rồi tắt ghi NGAY: lấy mẫu
    `latest()` theo nhịp sẽ rơi gần hết, còn bộ ghi phải giữ đủ — kể cả các khung vẫn nằm
    trong hàng đợi lúc bấm tắt."""
    reader = MjpegLatestFrameReader("http://khong-dung-toi/stream")  # không start(): tự publish
    rec = _rec(tmp_path, reader)
    jpegs = [_jpeg(value=i * 7 % 256) for i in range(40)]
    st = rec.start()
    assert st["running"] is True
    try:
        for i, jpeg in enumerate(jpegs):
            reader.publish(_frame(time.monotonic(), i + 1, jpeg=jpeg))
    finally:
        st = rec.stop()
    assert st["running"] is False
    assert st["reason"] == "Đã tắt ghi hình"
    assert (st["frames_written"], st["dropped_frames"], st["bad_frames"]) == (40, 0, 0)
    assert doc_avi(st["segment_file"]).chunks == jpegs
    cap = cv2.VideoCapture(st["segment_file"], cv2.CAP_FFMPEG)
    n = 0
    while cap.read()[0]:
        n += 1
    cap.release()
    assert n == 40
    reader.publish(_frame(time.monotonic(), 99))  # đã tắt ghi: không còn nhận khung
    assert rec.status()["frames_written"] == 40


def test_loi_trong_thread_khong_nem_ra_ngoai_ma_dung_kem_ly_do(tmp_path):
    chan = tmp_path / "la-file"
    chan.write_text("x", encoding="utf-8")
    reader = MjpegLatestFrameReader("http://khong-dung-toi/stream")
    rec = VideoRecorder(reader, out_dir=chan, min_free_gb=0.0)  # mkdir thư mục ghi sẽ hỏng
    assert rec.start()["running"] is True
    reader.publish(_frame(time.monotonic(), 1))  # publish KHÔNG được ném lỗi của bộ ghi
    het = time.monotonic() + 3
    while rec.running and time.monotonic() < het:
        time.sleep(0.05)
    st = rec.status()
    assert st["running"] is False
    assert st["reason"].startswith("Lỗi khi ghi video")
    rec.stop()
    assert reader.latest() is not None  # camera vẫn chạy bình thường


def test_reader_moi_nguoi_nhan_hong_khong_lam_mat_hinh():
    reader = MjpegLatestFrameReader("http://khong-dung-toi/stream")
    nhan = []

    def hong(_frame):
        raise RuntimeError("người nhận nổ")

    reader.subscribe(hong)
    reader.subscribe(nhan.append)
    reader.subscribe(nhan.append)  # đăng ký lại không nhân đôi
    f = _frame(0.0, 1)
    reader.publish(f)
    assert reader.latest() is f and nhan == [f]
    reader.unsubscribe(nhan.append)
    reader.publish(_frame(0.1, 2))
    assert nhan == [f]


def test_dung_khi_dang_cho_hinh(tmp_path):
    reader = MjpegLatestFrameReader("http://khong-dung-toi/stream")
    rec = _rec(tmp_path, reader)
    rec.start()
    assert rec.status()["reason"] == "Đang chờ hình từ camera"
    threading.Event().wait(0.3)
    st = rec.stop()
    assert st["running"] is False and st["segments"] == 0
