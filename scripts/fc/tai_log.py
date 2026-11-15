#!/usr/bin/env python3
"""Tải log dataflash `.bin` từ FC thật qua MAVLink (thay "DataFlash Logs → Download" của MP).

Liệt kê log trên FC (`LOG_REQUEST_LIST`), tải log mới nhất, các số `--id` chỉ định, hoặc
`--tat-ca` (`LOG_REQUEST_DATA`); đoạn nào rớt thì xin lại đúng đoạn đó. Lưu vào
`logs/fc-dataflash-<ngày>/<số>-<giờ UTC hoặc khong-gio>.bin`; không ghi đè file đã có — số log
đánh lại từ 1 sau mỗi lần xoá chip, nên tải lần hai trong ngày thì đưa `--thu-muc` khác.

    uv run --with pyserial python scripts/fc/tai_log.py COM6            # log mới nhất
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --liet-ke  # chỉ liệt kê
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --id 3 4
    uv run --with pyserial python scripts/fc/tai_log.py COM6 --tat-ca --thu-muc logs/x

Qua USB nhanh; qua Wi-Fi chậm và hay rớt, nên dùng USB. Không gửi lệnh ARM, motor hay xoá
log nào. Mỗi lần FC KHỞI ĐỘNG là một log; `LOG_DISARMED=0` chỉ ghi lúc đang ARM, các lần ARM
sau trong cùng lần cắm pin ghi nối vào log đó (log 02/11/2026 chứa 5 chuyến) — muốn mỗi chuyến
một file thì đặt `LOG_FILE_DSRMROT=1`.

Chip log (16 MB trên F405 V5) đầy thì ArduPilot ghi vòng, xoá dần log cũ nhất. Log bị xoá lẹm
phần đầu vẫn có trong danh sách, nhưng FC trả `LOG_DATA` rỗng (`count=0`) cho mọi byte đã mất
— 02/11/2026 log 14,6 MB hỏng 90 KB đầu, bản cũ của script xin lại 50 lần rồi bỏ cả log. Nay
đoạn FC không đọc được bị cắt bỏ (dò biên bằng tìm nhị phân), phần còn lại vẫn lưu và in ra
khoảng đã mất. Mất đầu log là mất bảng FMT: đọc bằng `phan_tich_log.py --fmt-tu <log cũ>`.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import UTC, date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sitl"))

from harness import SitlError  # noqa: E402
from kiem_fc import noi_fc  # noqa: E402

GOC_REPO = Path(__file__).resolve().parents[2]
CO_DOAN = 90  # byte dữ liệu trong một gói LOG_DATA
IM_LANG_XIN_LAI_S = 1.0  # im chừng này mà còn thiếu đoạn thì xin lại phần thiếu
GIOI_HAN_XIN_LAI = 50
CHO_DO_S = 1.0  # chờ trả lời một lần dò một đoạn
LAN_DO = 3  # dò một đoạn mà FC im chừng này lần liền thì coi là mất liên lạc
NHIP_GCS_S = 1.0  # gửi HEARTBEAT kiểu GCS: FC ngừng gửi LOG_DATA khi GCS im quá 3 s


def liet_ke(m, giay: float = 5.0) -> dict[int, tuple[int, int]]:
    """{số log: (kích thước byte, time_utc)}. FC không có GPS thì time_utc = 0."""
    m.mav.log_request_list_send(m.target_system, m.target_component, 0, 0xFFFF)
    ds: dict[int, tuple[int, int]] = {}
    tong = None
    het = time.monotonic() + giay
    while time.monotonic() < het and (tong is None or len(ds) < tong):
        msg = m.recv_match(type="LOG_ENTRY", blocking=True, timeout=1)
        if msg is None:
            continue
        tong = msg.num_logs
        if msg.num_logs and msg.size:
            ds[msg.id] = (msg.size, msg.time_utc)
    return ds


def ten_file(so: int, time_utc: int) -> str:
    if time_utc:
        gio = datetime.fromtimestamp(time_utc, tz=UTC).strftime("%Y%m%d-%H%M%S")
    else:
        gio = "khong-gio"
    return f"{so:03d}-{gio}.bin"


class TaiLog:
    """Tải một log. `doan[i]` = byte của đoạn thứ i (CO_DOAN byte, đoạn cuối có thể ngắn
    hơn); `hong` = các đoạn FC trả `count=0`, tức trang chip đã bị ghi đè hoặc xoá."""

    def __init__(self, m, so: int, kich_thuoc: int) -> None:
        self.m = m
        self.so = so
        self.kich_thuoc = kich_thuoc
        self.so_doan = (kich_thuoc + CO_DOAN - 1) // CO_DOAN
        self.doan: dict[int, bytes] = {}
        self.hong: set[int] = set()
        self._nhip_cuoi = 0.0

    def _nhip(self) -> None:
        if time.monotonic() - self._nhip_cuoi >= NHIP_GCS_S:
            self.m.mav.heartbeat_send(6, 8, 0, 0, 0)  # MAV_TYPE_GCS, MAV_AUTOPILOT_INVALID
            self._nhip_cuoi = time.monotonic()

    def _xin(self, ofs: int, dem: int) -> None:
        self._nhip()
        self.m.mav.log_request_data_send(
            self.m.target_system, self.m.target_component, self.so, ofs, dem
        )

    def _nhan(self, msg) -> bool:
        """Ghi một LOG_DATA; trả True nếu đó là gói báo đoạn hỏng."""
        i = msg.ofs // CO_DOAN
        if msg.count:
            self.doan[i] = bytes(msg.data[: msg.count])
            return False
        if msg.ofs < self.kich_thuoc:
            self.hong.add(i)
            return True
        return False

    def doc_duoc(self, i: int) -> bool:
        """Dò riêng đoạn i. FC im LAN_DO lần liền thì ném lỗi, không đoán."""
        for _ in range(LAN_DO):
            self._xin(i * CO_DOAN, CO_DOAN)
            het = time.monotonic() + CHO_DO_S
            while time.monotonic() < het:
                msg = self.m.recv_match(type="LOG_DATA", blocking=True, timeout=0.2)
                if msg is None or msg.id != self.so or msg.ofs != i * CO_DOAN:
                    continue
                return not self._nhan(msg)
        raise SitlError(f"log {self.so}: FC không trả lời khi dò đoạn {i}")

    def vuot_doan_hong(self, dau: int) -> int:
        """Đoạn `dau` hỏng: tìm đoạn đọc được đầu tiên phía sau (nhảy gấp đôi rồi tìm nhị
        phân), đánh dấu cả khoảng giữa là hỏng. Trả số đoạn đó, hoặc so_doan nếu hỏng tới cuối."""
        buoc = 1
        hong_cuoi = dau
        while True:
            thu = min(dau + buoc, self.so_doan - 1)
            if thu <= hong_cuoi:
                self.hong.update(range(dau, self.so_doan))
                return self.so_doan
            if self.doc_duoc(thu):
                break
            hong_cuoi = thu
            buoc *= 2
        tot = thu
        while tot - hong_cuoi > 1:
            giua = (hong_cuoi + tot) // 2
            if self.doc_duoc(giua):
                tot = giua
            else:
                hong_cuoi = giua
        self.hong.update(range(dau, tot))
        return tot

    def _thieu_dau_tien(self, tu: int = 0) -> int | None:
        for i in range(tu, self.so_doan):
            if i not in self.doan and i not in self.hong:
                return i
        return None

    def chay(self) -> int:
        """Tải hết; trả số lần phải xin lại."""
        lan_xin_lai = 0
        thieu = self._thieu_dau_tien()
        while thieu is not None:
            het_thieu = thieu
            while (
                het_thieu + 1 < self.so_doan
                and het_thieu + 1 not in self.doan
                and het_thieu + 1 not in self.hong
            ):
                het_thieu += 1
            self._xin(thieu * CO_DOAN, (het_thieu - thieu + 1) * CO_DOAN)
            cuoi = time.monotonic()
            gap_hong: int | None = None
            while time.monotonic() - cuoi < IM_LANG_XIN_LAI_S:
                self._nhip()
                msg = self.m.recv_match(type="LOG_DATA", blocking=True, timeout=0.2)
                if msg is None or msg.id != self.so:
                    continue
                cuoi = time.monotonic()
                if self._nhan(msg):
                    gap_hong = msg.ofs // CO_DOAN  # FC đã tự kết thúc lượt gửi này
                    break
            if gap_hong is not None:
                self.vuot_doan_hong(gap_hong)
            elif self._thieu_dau_tien(thieu) == thieu:
                lan_xin_lai += 1  # cả lượt không về được đoạn đầu tiên đã xin
                if lan_xin_lai > GIOI_HAN_XIN_LAI:
                    con = sum(
                        1 for i in range(self.so_doan) if i not in self.doan and i not in self.hong
                    )
                    raise SitlError(
                        f"log {self.so}: còn thiếu {con} đoạn sau {GIOI_HAN_XIN_LAI} lần xin lại"
                    )
            thieu = self._thieu_dau_tien()
        self.m.mav.log_request_end_send(self.m.target_system, self.m.target_component)
        return lan_xin_lai

    def khoang_hong(self) -> list[tuple[int, int]]:
        """Các khoảng byte [đầu, cuối) FC không đọc được."""
        ra: list[tuple[int, int]] = []
        for i in sorted(self.hong):
            dau, cuoi = i * CO_DOAN, min((i + 1) * CO_DOAN, self.kich_thuoc)
            if ra and ra[-1][1] == dau:
                ra[-1] = (ra[-1][0], cuoi)
            else:
                ra.append((dau, cuoi))
        return ra

    def du_lieu(self) -> bytes:
        """Ghép các đoạn đọc được theo thứ tự; khoảng hỏng bị cắt bỏ, không độn số 0."""
        return b"".join(self.doan[i] for i in sorted(self.doan))


def tai_mot(m, so: int, kich_thuoc: int) -> tuple[bytes, list[tuple[int, int]]]:
    """(dữ liệu, các khoảng byte đã mất). Log nguyên vẹn thì danh sách khoảng mất rỗng."""
    bat_dau = time.monotonic()
    tl = TaiLog(m, so, kich_thuoc)
    lan_xin_lai = tl.chay()
    mat = tl.khoang_hong()
    giay = time.monotonic() - bat_dau
    so_mat = sum(c - d for d, c in mat)
    print(
        f"[tai_log] log {so}: {kich_thuoc} byte, {giay:.1f} s, xin lại {lan_xin_lai} lần"
        + (f", MẤT {so_mat} byte ở {len(mat)} khoảng" if mat else ""),
        flush=True,
    )
    for d, c in mat:
        print(f"[tai_log]   không đọc được byte {d}–{c} ({(c - d) / 1024:.1f} KB)", flush=True)
    return tl.du_lieu(), mat


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ket_noi", help="COMx của FC (tự dò lại theo USB 1209:xxxx)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--id", type=int, nargs="*", help="số log cần tải; bỏ trống = log mới nhất")
    ap.add_argument("--tat-ca", action="store_true", help="tải mọi log đang có trên FC")
    ap.add_argument("--liet-ke", action="store_true", help="chỉ liệt kê log trên FC")
    ap.add_argument("--thu-muc", type=Path, help="mặc định logs/fc-dataflash-<hôm nay>/")
    args = ap.parse_args()

    thu_muc = args.thu_muc or GOC_REPO / "logs" / f"fc-dataflash-{date.today():%Y%m%d}"
    try:
        fc = noi_fc(args.ket_noi, args.baud)
    except SitlError as exc:
        print(f"[tai_log] {exc}", file=sys.stderr)
        return 2
    try:
        m = fc.master
        ds = liet_ke(m)
        if not ds:
            print("[tai_log] FC không có log nào", flush=True)
            return 1
        for so in sorted(ds):
            kt, tu = ds[so]
            print(f"  log {so:3d}: {kt / 1024:8.1f} KB  {ten_file(so, tu)}", flush=True)
        if args.liet_ke:
            return 0
        can_tai = sorted(ds) if args.tat_ca else (args.id or [max(ds)])
        thu_muc.mkdir(parents=True, exist_ok=True)
        for so in can_tai:
            if so not in ds:
                raise SitlError(f"FC không có log {so}")
            dich = thu_muc / ten_file(so, ds[so][1])
            if dich.exists():
                raise SitlError(f"{dich} đã có — không ghi đè; đổi tên hoặc dùng --thu-muc khác")
            du_lieu, mat = tai_mot(m, so, ds[so][0])
            if mat:
                dich = dich.with_name(dich.stem + "-thieu.bin")
                if mat[0][0] == 0:
                    print(
                        "[tai_log] mất đầu log = mất bảng FMT; đọc bằng "
                        "scripts/fc/phan_tich_log.py --fmt-tu <log cũ cùng firmware>",
                        flush=True,
                    )
            dich.write_bytes(du_lieu)
            print(f"[tai_log] đã lưu {dich} ({len(du_lieu)} byte)", flush=True)
        return 0
    except SitlError as exc:
        print(f"[tai_log] {exc}", file=sys.stderr)
        return 1
    finally:
        fc.stop()


if __name__ == "__main__":
    sys.exit(main())
