"""Đọc log dataflash `.bin` của ArduPilot, kể cả log bị chip ghi vòng xoá mất đầu.

Nơi duy nhất giữ code này (15/11/2026 chuyển từ `scripts/fc/log_bin.py`, file đó giờ chỉ
chuyển tiếp): trang Lịch sử bay của backend (`backend/flights/`) và script phân tích
`scripts/fc/phan_tich_log.py` cùng dùng.

Bảng FMT (định nghĩa mọi loại message) chỉ được ghi một lần ở đầu log. Chip 16 MB của F405 V5
đầy thì ArduPilot ghi vòng, xoá từng khối 64 KB, nên log cũ nhất có thể mất đúng khối đầu — mất
FMT là pymavlink không đọc được dòng nào (02/11/2026: log 14,6 MB mất 62,6 KB đầu). Cách cứu:
chép bản ghi FMT/UNIT/MULT/FMTU của một log nguyên vẹn **cùng bản firmware** lên đầu, ghi ra
`<tên>-ghep-fmt.bin` cạnh log gốc (log gốc giữ nguyên).

Firmware giống nhau thì message có số ID cố định khớp tuyệt đối. Vài message dùng ID cấp lúc chạy
(SURF, LDET, DCM, AUXF — số 251–254); log 02/11/2026 vẫn khớp: duyệt 14,6 MB theo độ dài của bảng
mượn chỉ lệch 25 byte. `mo_log` in số byte lệch đó ra; lệch nhiều là bảng mượn không hợp.
"""

from __future__ import annotations

import contextlib
import io
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

from pymavlink import DFReader

DAU = b"\xa3\x95"
FMT_ID = 0x80
FMT_LEN = 89
GIO_VN = timezone(timedelta(hours=7))
GPS_EPOCH = datetime(1980, 1, 6, tzinfo=UTC)
GIAY_NHUAN_GPS = 18  # GPS đi trước UTC 18 s (từ 2017)
LOAI_DINH_DANG = {"UNIT", "MULT", "FMTU"}


def co_bang_fmt(du_lieu: bytes) -> bool:
    return du_lieu[:3] == DAU + bytes([FMT_ID])


def _duyet(du_lieu: bytes, do_dai: dict[int, int]):
    """Lần lượt (vị trí, loại, bản ghi) theo bảng độ dài; byte không khớp thì nhảy 1 byte."""
    vt, n = 0, len(du_lieu)
    while vt < n - 3:
        if du_lieu[vt] != 0xA3 or du_lieu[vt + 1] != 0x95 or du_lieu[vt + 2] not in do_dai:
            vt += 1
            continue
        dai = do_dai[du_lieu[vt + 2]]
        yield vt, du_lieu[vt + 2], du_lieu[vt : vt + dai]
        vt += dai


def ban_ghi_dinh_dang(log_mau: bytes) -> tuple[bytes, dict[int, int]]:
    """(mọi bản ghi FMT/UNIT/MULT/FMTU của log mẫu nối lại, bảng độ dài theo ID)."""
    do_dai = {FMT_ID: FMT_LEN}
    ten: dict[int, str] = {}
    ra: list[bytes] = []
    for _, loai, bg in _duyet(log_mau, do_dai):
        if loai == FMT_ID:
            do_dai[bg[3]] = bg[4]
            ten[bg[3]] = bg[5:9].rstrip(b"\x00").decode("ascii", "replace")
            ra.append(bg)
        elif ten.get(loai) in LOAI_DINH_DANG:
            ra.append(bg)
    return b"".join(ra), do_dai


def _ban_ghi_dau_tien(du_lieu: bytes, do_dai: dict[int, int]) -> int:
    """Vị trí bản ghi trọn vẹn đầu tiên: phải có thêm một bản ghi nối liền ngay sau nó."""
    for vt in range(min(len(du_lieu), 4096)):
        loai = du_lieu[vt + 2] if vt + 2 < len(du_lieu) else None
        if du_lieu[vt : vt + 2] != DAU or loai not in do_dai:
            continue
        sau = vt + do_dai[loai]
        if du_lieu[sau : sau + 2] == DAU and sau + 2 < len(du_lieu) and du_lieu[sau + 2] in do_dai:
            return vt
    raise ValueError("4 KB đầu không có bản ghi nào khớp bảng FMT mượn — sai firmware?")


def so_byte_lech(du_lieu: bytes, do_dai: dict[int, int]) -> int:
    """Số byte phải nhảy qua khi duyệt cả file theo bảng độ dài (0 = khớp hoàn toàn)."""
    da_doc = sum(len(bg) for _, _, bg in _duyet(du_lieu, do_dai))
    return len(du_lieu) - da_doc


def ghep_fmt(duong_dan: Path, fmt_tu: Path) -> tuple[Path, int]:
    """Ghi `<tên>-ghep-fmt.bin` cạnh log mất đầu: bảng FMT của `fmt_tu` + phần còn lại của log.
    File này mở được bằng Mission Planner / UAV Log Viewer. Trả (đường dẫn, số byte lệch)."""
    du_lieu = duong_dan.read_bytes()
    dau, do_dai = ban_ghi_dinh_dang(fmt_tu.read_bytes())
    than = du_lieu[_ban_ghi_dau_tien(du_lieu, do_dai) :]
    dich = duong_dan.with_name(duong_dan.stem + "-ghep-fmt.bin")
    dich.write_bytes(dau + than)
    return dich, so_byte_lech(than, do_dai)


class LogBin:
    """Một log đã mở. `doc(cac_loai)` trả message theo thứ tự thời gian; `gio(TimeUS)` → giờ VN."""

    def __init__(self, duong_dan: Path, fmt_tu: Path | None = None) -> None:
        self.lech = 0
        self.duong_dan = duong_dan
        with duong_dan.open("rb") as f:
            dau = f.read(3)
        if not co_bang_fmt(dau):
            if fmt_tu is None:
                raise ValueError(
                    f"{duong_dan.name} mất đầu log (không có bảng FMT) — thêm --fmt-tu "
                    "<log .bin nguyên vẹn cùng bản firmware>"
                )
            self.duong_dan, self.lech = ghep_fmt(duong_dan, fmt_tu)
        with contextlib.redirect_stdout(io.StringIO()):  # DFReader in "bad header" từng byte rác
            self.reader = DFReader.DFReader_binary(str(self.duong_dan), zero_time_base=True)
        self._lech_utc: timedelta | None = None

    def doc(self, cac_loai: list[str]):
        self.reader.rewind()
        # Chỉ chặn stdout quanh recv_match: bọc cả vòng lặp thì lúc generator dừng ở `yield`,
        # stdout của CẢ tiến trình vẫn bị chặn — print của người gọi (và của thread khác trong
        # backend) mất trắng, generator bỏ dở thì không bao giờ trả stdout lại (15/11/2026).
        rac = io.StringIO()
        while True:
            with contextlib.redirect_stdout(rac):
                m = self.reader.recv_match(type=cac_loai)
            rac.seek(0)
            rac.truncate()
            if m is None:
                return
            if m.get_type() == "GPS" and self._lech_utc is None:
                self._chot_gio(m)
            yield m

    def _chot_gio(self, gps) -> None:
        if gps.Status >= 3 and gps.GWk > 0:
            utc = GPS_EPOCH + timedelta(
                weeks=gps.GWk, milliseconds=gps.GMS, seconds=-GIAY_NHUAN_GPS
            )
            self._lech_utc = utc - timedelta(microseconds=gps.TimeUS)

    def gio(self, time_us: int) -> str:
        if self._lech_utc is None:
            return f"{time_us / 1e6:.1f}s"
        thuc = (self._lech_utc + timedelta(microseconds=time_us)).astimezone(GIO_VN)
        return thuc.strftime("%H:%M:%S")
