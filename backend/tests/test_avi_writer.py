"""File AVI ghi từ JPEG camera, không nén lại (01/11/2026).

Kiểm bằng hai đường độc lập: đọc cấu trúc RIFF bằng tay (`avi_doc.py`) và mở bằng OpenCV
(ffmpeg) — đúng thứ trình phát và các phase AI sau này sẽ dùng.
"""

from __future__ import annotations

import pytest

from backend.tests.avi_doc import doc_avi
from backend.vision.avi_writer import FPS_MAX, MjpegAviWriter, jpeg_complete, jpeg_size

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")


def _jpeg(w: int, h: int, value: int) -> bytes:
    img = np.full((h, w, 3), value, dtype=np.uint8)
    cv2.putText(img, str(value), (10, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_doc_co_khung_tu_jpeg_khong_giai_ma():
    assert jpeg_size(_jpeg(320, 240, 10)) == (320, 240)
    assert jpeg_size(_jpeg(640, 480, 10)) == (640, 480)
    assert jpeg_size(b"\xff\xd8\xff\xd9") is None  # có đầu đuôi mà không có SOF
    assert jpeg_size(b"khong phai jpeg") is None
    assert jpeg_size(b"") is None


def test_khung_dut_giua_chung_bi_nhan_ra():
    jpeg = _jpeg(320, 240, 10)
    assert jpeg_complete(jpeg)
    assert jpeg_complete(jpeg + b"\x00\x00")  # đuôi đệm 0 của bộ đệm camera vẫn là khung đủ
    assert not jpeg_complete(jpeg[: len(jpeg) // 2])  # Wi-Fi cắt ngang
    assert not jpeg_complete(b"\xff\xd8")


def test_moi_khung_nam_nguyen_ven_trong_file_va_header_khop(tmp_path):
    # Camera gửi lệch nhịp: 0,1 s rồi 0,15 s xen kẽ -> trung bình 8 khung/giây.
    jpegs = [_jpeg(320, 240, (i * 37) % 256) for i in range(17)]
    if len(jpegs[3]) % 2 == 0:
        jpegs[3] += b"\x00"  # một khung lẻ byte: chunk phải được đệm cho chẵn
    assert len(jpegs[3]) % 2 == 1
    times, t = [], 0.0
    for i in range(17):
        times.append(t)
        t += 0.1 if i % 2 == 0 else 0.15
    path = tmp_path / "v.avi"
    w = MjpegAviWriter(path, 8.0, 320, 240)
    for jpeg, t in zip(jpegs, times, strict=True):
        w.write_jpeg(jpeg, t)
    w.close()

    doc = doc_avi(path)
    assert doc.riff_end == doc.file_bytes
    assert doc.chunks == jpegs, "khung trong file phải giống hệt byte camera gửi (không nén lại)"
    assert doc.total_frames == doc.length == 17
    assert (doc.width, doc.height, doc.handler) == (320, 240, b"MJPG")
    fps_do = 16 / (times[-1] - times[0])
    assert doc.fps == pytest.approx(fps_do, abs=1e-3)
    assert doc.us_per_frame == round(1e6 / fps_do)
    assert doc.index is not None and len(doc.index) == 17 and doc.index_ok
    assert w.bytes_written == path.stat().st_size

    cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)
    assert cap.isOpened()
    assert cap.get(cv2.CAP_PROP_FPS) == pytest.approx(fps_do, abs=0.01)
    n = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        assert img.shape == (240, 320, 3)
        n += 1
    cap.release()
    assert n == 17


def test_flush_giua_chung_thi_file_doc_duoc_du_laptop_tat_ngang(tmp_path):
    path = tmp_path / "v.avi"
    w = MjpegAviWriter(path, 8.0, 320, 240)
    jpegs = [_jpeg(320, 240, i * 20) for i in range(6)]
    for i, jpeg in enumerate(jpegs):
        w.write_jpeg(jpeg, i * 0.125)
    w.flush()
    # KHÔNG close(): như laptop sập ngay sau lần flush.
    doc = doc_avi(path)
    assert doc.riff_end == doc.file_bytes
    assert doc.index is None  # chưa có chỉ mục, nhưng đọc tuần tự vẫn đủ khung
    assert doc.chunks == jpegs and doc.total_frames == 6
    cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)
    n = 0
    while cap.read()[0]:
        n += 1
    cap.release()
    assert n == 6
    w.close()


def test_fps_chua_do_duoc_thi_dung_so_tam_va_bi_kep(tmp_path):
    w = MjpegAviWriter(tmp_path / "a.avi", 8.0, 320, 240)
    w.write_jpeg(_jpeg(320, 240, 1), 5.0)
    assert w.fps == 8.0  # một khung chưa đo được
    w.write_jpeg(_jpeg(320, 240, 2), 5.001)  # hai khung sát nhau
    assert w.fps == FPS_MAX
    w.close()
    w.close()  # gọi lại không hỏng


def test_dong_hong_van_nha_file(tmp_path, monkeypatch):
    path = tmp_path / "a.avi"
    w = MjpegAviWriter(path, 8.0, 320, 240)
    w.write_jpeg(_jpeg(320, 240, 1), 0.0)
    f = w._f

    def hong(*_a, **_k):
        raise OSError("đĩa đầy")

    monkeypatch.setattr(w, "_patch_header", hong)
    with pytest.raises(OSError):
        w.close()
    assert f.closed, "lỗi lúc đóng không được giữ file mở (Windows khoá file đang mở)"
