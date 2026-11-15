"""Ghép log thành danh sách chuyến bay cho trang Lịch sử bay.

Một chuyến = một lần ARM → DISARM. Cùng một lần ARM có thể nằm ở nhiều nguồn: log dataflash
(giờ GPS) và tlog (giờ laptop), lệch nhau dưới 1–2 s, nên các khoảng ARM chồng lên nhau (dung sai
`MERGE_TOL_S`) gộp thành một chuyến. Video gắn vào chuyến theo giờ.

Mỗi cột số liệu lấy từ nguồn tốt nhất có trong chuyến: dataflash trước (mẫu dày, đủ chuyến), tlog
sau (khi laptop ngủ hay FC đã ghi đè log thì chỉ còn một trong hai). Cột link chỉ tlog có, cột
camera chỉ bản ghi hình có. Ngoài vùng có dữ liệu thì là `None` — "không biết" khác "tốt".

Đọc file thật chậm (log `.bin` 14 MB ~ chục giây) nên kết quả từng file được lưu đệm JSON ở
`FLIGHT_CACHE_DIR`, khoá theo (đường dẫn, cỡ, mtime, `PARSER_VERSION`).
"""

from __future__ import annotations

import bisect
import hashlib
import json
import math
import statistics
import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.flights import sources, video
from backend.flights.binlog import GIO_VN, co_bang_fmt

PARSER_VERSION = 3
MERGE_TOL_S = 2.0
PAD_S = 10.0  # cửa sổ chuyến rộng thêm trước ARM / sau DISARM
MIN_ARM_S = 1.0
RECONNECT_S = 120.0  # hai tlog cách nhau ít hơn = backend vẫn chạy, chỉ mất link
CAM_GAP_S = 2.0
CLOCK_MATCH_S = 180.0  # lệch đồng hồ laptop tối đa còn chịu khớp lần ARM
CLOCK_NEAREST_S = 36 * 3600
MAX_POINTS = 3000
TOOK_OFF_M = 1.0
SERIES_COLS = (
    "lat",
    "lon",
    "alt",
    "speed",
    "heading",
    "roll",
    "pitch",
    "volt",
    "curr",
    "mah",
    "sats",
    "hdop",
    "rangefinder",
    "vibe",
    "rssi",
)
_HOLD = {"dataflash": 1.0, "tlog": 2.5}
LINK_GAP_S_MIN = sources.LINK_GAP_S


@dataclass
class Scan:
    tracks: list[dict[str, Any]] = field(default_factory=list)
    videos: list[dict[str, Any]] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def flight_id(start: float) -> str:
    return datetime.fromtimestamp(start, GIO_VN).strftime("%Y%m%d-%H%M%S")


def _sample(points: list[list[float]], grid: list[float], hold: float) -> list[float | None]:
    """Giá trị tại mỗi mốc lưới = mẫu gần nhất phía trước, nếu không cũ hơn `hold`."""
    out: list[float | None] = []
    j, n = 0, len(points)
    for g in grid:
        while j < n and points[j][0] <= g:
            j += 1
        out.append(points[j - 1][1] if j and g - points[j - 1][0] <= hold else None)
    return out


def _spans(intervals: list[list[float]], join_gap: float) -> list[list[float]]:
    out: list[list[float]] = []
    for a, b in sorted(intervals):
        if out and a - out[-1][1] <= join_gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def _inside(spans: list[list[float]], t: float) -> bool:
    return any(a <= t <= b for a, b in spans)


def _shift_track(tr: dict[str, Any], off: float) -> None:
    tr["raw_t0"], tr["raw_t1"] = tr["t0"], tr["t1"]
    if not off:
        return
    tr["t0"], tr["t1"] = tr["t0"] + off, tr["t1"] + off
    tr["arms"] = [[a + off, b + off] for a, b in tr["arms"]]
    tr["cols"] = {k: [[p[0] + off, p[1]] for p in v] for k, v in tr["cols"].items()}
    tr["modes"] = [[t + off, m] for t, m in tr["modes"]]
    tr["events"] = [[e[0] + off, *e[1:]] for e in tr["events"]]
    tr["link"] = [[s + round(off), rx, lo] for s, rx, lo in tr["link"]]


def align_clocks(tracks: list[dict[str, Any]], videos: list[dict[str, Any]]) -> None:
    """Đưa tlog và video (giờ laptop) về giờ GPS của FC, sửa tại chỗ.

    Đồng hồ laptop trôi: 01/11/2026 chậm 50,4 s (đo bằng SYSTEM_TIME), 02/11 chậm ~55 s (khớp
    lần ARM). Không chỉnh thì video lệch gần một phút so với đường bay. Thứ tự tin cậy: SYSTEM_TIME
    trong tlog → khớp các lần ARM cùng độ dài với log FC → độ lệch của tlog gần nhất → không chỉnh.
    """
    dfs = [t for t in tracks if t["kind"] == "dataflash"]
    tlogs = [t for t in tracks if t["kind"] == "tlog"]
    for tl in tlogs:
        if tl.get("clock_offset") is not None:
            tl["clock_how"] = "SYSTEM_TIME"
            continue
        diffs = [
            c - a
            for a, b in tl["arms"]
            if b - a > 2
            for df in dfs
            for c, d in df["arms"]
            if abs((b - a) - (d - c)) < 1.5 and abs(c - a) < CLOCK_MATCH_S
        ]
        if diffs:
            mid = statistics.median(diffs)
            near = [x for x in diffs if abs(x - mid) < 3]
            tl["clock_offset"], tl["clock_how"] = round(statistics.median(near), 2), "khớp lần ARM"
    known = [(t["t0"], t["clock_offset"]) for t in tlogs if t.get("clock_offset") is not None]

    def nearest(t0: float) -> float | None:
        best = min(known, key=lambda k: abs(k[0] - t0), default=None)
        return best[1] if best and abs(best[0] - t0) <= CLOCK_NEAREST_S else None

    for tl in tlogs:
        if tl.get("clock_offset") is None:
            off = nearest(tl["t0"])
            tl["clock_offset"] = off or 0.0
            tl["clock_how"] = "tlog gần nhất" if off is not None else "không chỉnh"
        _shift_track(tl, tl["clock_offset"])
    for v in videos:
        same = [t for t in tlogs if t["raw_t1"] >= v["t0"] and t["raw_t0"] <= v["t1"]]
        off = (
            max(same, key=lambda t: min(t["raw_t1"], v["t1"]) - max(t["raw_t0"], v["t0"]))[
                "clock_offset"
            ]
            if same
            else nearest(v["t0"])
        )
        v["clock_offset"] = off or 0.0
        if off:
            v["times"] = [t + off for t in v["times"]]
            v["t0"], v["t1"] = v["t0"] + off, v["t1"] + off


class FlightStore:
    def __init__(self, logs_dir: Path, tlog_dir: Path, rec_dir: Path, cache_dir: Path) -> None:
        self.logs_dir, self.tlog_dir, self.rec_dir, self.cache_dir = (
            logs_dir,
            tlog_dir,
            rec_dir,
            cache_dir,
        )
        self._lock = threading.Lock()
        self._memo: tuple[tuple, Scan] | None = None
        self._flights_memo: tuple[Scan, list[dict[str, Any]]] | None = None

    # ---------------------------------------------------------------- tìm + đọc file
    def _files(self) -> list[tuple[str, Path]]:
        found: list[tuple[str, Path]] = []
        bins = sorted(self.logs_dir.glob("fc-dataflash-*/*.bin"))
        names = {p for p in bins}
        for p in bins:
            if not p.stem.endswith("-ghep-fmt") and p.with_name(p.stem + "-ghep-fmt.bin") in names:
                continue  # đã có bản ghép bảng FMT, đọc bản đó
            found.append(("dataflash", p))
        found += [
            ("tlog", p) for p in sorted(self.tlog_dir.glob("*.tlog")) if p.stat().st_size > 1024
        ]
        found += [("video", p) for p in sorted(self.rec_dir.glob("*/frames.csv"))]
        return found

    def _fmt_donor(self, p: Path) -> Path | None:
        def intact(q: Path) -> bool:
            with q.open("rb") as f:
                return q != p and co_bang_fmt(f.read(3))

        same = [q for q in sorted(p.parent.glob("*.bin")) if intact(q)]
        if same:
            return same[-1]
        others = sorted(self.logs_dir.glob("fc-dataflash-*/*.bin"), key=lambda q: q.stat().st_mtime)
        return next((q for q in reversed(others) if intact(q)), None)

    def _read(self, kind: str, p: Path) -> dict[str, Any]:
        if kind == "tlog":
            return sources.read_tlog(p)
        if kind == "video":
            return video.read_recording_meta(p.parent)
        with p.open("rb") as f:
            donor = None if co_bang_fmt(f.read(3)) else self._fmt_donor(p)
        return sources.read_dataflash(p, donor)

    def _load(self, kind: str, p: Path) -> dict[str, Any]:
        st = p.stat()
        rel = p.relative_to(self.logs_dir).as_posix() if p.is_relative_to(self.logs_dir) else str(p)
        key = f"{PARSER_VERSION}|{rel}|{st.st_size}|{st.st_mtime_ns}"
        cache = self.cache_dir / (hashlib.sha1(rel.encode()).hexdigest()[:16] + ".json")
        if cache.is_file():
            try:
                data = json.loads(cache.read_text(encoding="utf-8"))
                if data.get("_key") == key:
                    return data
            except (OSError, ValueError):
                pass
        try:
            data = self._read(kind, p)
        except Exception as exc:  # noqa: BLE001 — một file hỏng không được làm hỏng cả trang
            data = {"ok": False, "reason": f"{type(exc).__name__}: {exc}"}
        data.update(_key=key, file=rel, kind=data.get("kind", kind))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        return data

    def scan(self) -> Scan:
        """Đọc (hoặc lấy đệm) mọi file. Gọi lại khi không có file nào đổi thì trả ngay."""
        with self._lock:
            files = self._files()
            sig = tuple((k, str(p), p.stat().st_size, p.stat().st_mtime_ns) for k, p in files)
            if self._memo and self._memo[0] == sig:
                return self._memo[1]
            out = Scan()
            for kind, p in files:
                data = self._load(kind, p)
                if not data.get("ok"):  # kể cả tlog của SITL (drone ảo)
                    out.skipped.append((data["file"], data.get("reason", "?")))
                elif kind == "video":
                    out.videos.append(data)
                else:
                    out.tracks.append(data)
            align_clocks(out.tracks, out.videos)
            self._memo = (sig, out)
            return out

    # ---------------------------------------------------------------- gộp chuyến
    def flights(self) -> list[dict[str, Any]]:
        """Mọi chuyến, cũ trước mới sau (mỗi chuyến đủ chuỗi số liệu). Đệm theo lần quét."""
        scan = self.scan()
        with self._lock:
            if self._flights_memo and self._flights_memo[0] is scan:
                return self._flights_memo[1]
        out = self._assemble(scan)
        with self._lock:
            self._flights_memo = (scan, out)
        return out

    def flight(self, fid: str) -> dict[str, Any] | None:
        return next((f for f in self.flights() if f["summary"]["id"] == fid), None)

    def _assemble(self, scan: Scan) -> list[dict[str, Any]]:
        spans = sorted(
            (a, b, i)
            for i, tr in enumerate(scan.tracks)
            for a, b in tr["arms"]
            if b - a >= MIN_ARM_S
        )
        groups: list[dict[str, Any]] = []
        for a, b, i in spans:
            g = groups[-1] if groups else None
            kind = scan.tracks[i]["kind"]
            two_df = kind == "dataflash" and any(
                k == "dataflash" for _, _, k in (g or {}).get("arms", [])
            )
            if g and a <= g["end"] + MERGE_TOL_S and i not in g["src"] and not two_df:
                g["src"].add(i)
                g["end"] = max(g["end"], b)
                g["arms"].append((a, b, scan.tracks[i]["kind"]))
            else:
                groups.append(
                    {"start": a, "end": b, "src": {i}, "arms": [(a, b, scan.tracks[i]["kind"])]}
                )
        out = []
        for g in groups:
            df = [(a, b) for a, b, k in g["arms"] if k == "dataflash"]
            start, end = (
                (min(a for a, _ in df), max(b for _, b in df)) if df else (g["start"], g["end"])
            )
            out.append(self._build(scan, start, end))
        return out

    def _build(self, scan: Scan, start: float, end: float) -> dict[str, Any]:
        ws, we = start - PAD_S, end + PAD_S
        tracks = [t for t in scan.tracks if t["t1"] >= ws and t["t0"] <= we]
        vids = [v for v in scan.videos if v["t1"] >= ws and v["t0"] <= we]
        step = max(0.25, (we - ws) / MAX_POINTS)
        grid = [ws + k * step for k in range(int((we - ws) / step) + 1)]
        cols: dict[str, list[float | None]] = {}
        col_src: dict[str, str] = {}
        for name in SERIES_COLS:
            for kind in ("dataflash", "tlog"):
                pts = sorted(
                    p
                    for t in tracks
                    if t["kind"] == kind
                    for p in t["cols"].get(name, [])
                    if ws <= p[0] <= we
                )
                if len(pts) >= 2:
                    hold = 3.0 if name == "rssi" else _HOLD[kind]
                    cols[name], col_src[name] = _sample(pts, grid, hold), kind
                    break
            else:
                cols[name] = [None] * len(grid)
        home = self._home(tracks, grid, cols, start)
        cols["dist_home"] = [
            round(_haversine_m(home[0], home[1], la, lo), 1)
            if home and la is not None and lo is not None
            else None
            for la, lo in zip(cols["lat"], cols["lon"], strict=True)
        ]
        tlogs = [t for t in tracks if t["kind"] == "tlog"]
        cols["link_loss"] = self._link_loss(tlogs, grid)
        cols["cam_fps"] = self._cam_fps(vids, grid)
        events = self._events(tracks, tlogs, vids, ws, we, start, end)
        modes = self._modes(tracks, ws, we)
        clips = []
        for v in vids:
            i0, i1 = bisect.bisect_left(v["times"], ws), bisect.bisect_right(v["times"], we)
            if i1 > i0:
                clips.append(
                    {
                        "rec": v["rec"],
                        "row0": i0,
                        "width": v["width"],
                        "height": v["height"],
                        "times": [round(t - ws, 3) for t in v["times"][i0:i1]],
                    }
                )
        summary = self._summary(start, end, ws, step, cols, tracks, vids, modes, events, tlogs)
        clock = [(t.get("clock_offset"), t.get("clock_how")) for t in tlogs] or [(None, None)]
        return {
            "clock_offset_s": clock[0][0],
            "clock_note": clock[0][1],
            "summary": summary,
            "window_start": round(ws, 2),
            "window_end": round(we, 2),
            "home": {"lat": home[0], "lon": home[1]} if home else None,
            "series": {"t": [round(g - ws, 2) for g in grid], **cols},
            "column_sources": col_src,
            "modes": modes,
            "events": events,
            "video": clips,
            "files": sorted({t["file"] for t in tracks} | {f"recordings/{v['rec']}" for v in vids}),
        }

    @staticmethod
    def _home(tracks, grid, cols, start) -> tuple[float, float] | None:
        for kind in ("dataflash", "tlog"):
            for t in tracks:
                if t["kind"] == kind and t.get("home"):
                    return tuple(t["home"])  # type: ignore[return-value]
        for g, la, lo in zip(grid, cols["lat"], cols["lon"], strict=True):
            if g >= start and la is not None and lo is not None:
                return (la, lo)
        return None

    @staticmethod
    def _link_loss(tlogs, grid) -> list[float | None]:
        if not tlogs:
            return [None] * len(grid)
        cover = _spans([[t["t0"], t["t1"]] for t in tlogs], RECONNECT_S)
        per_sec: dict[int, tuple[int, int]] = {}
        for t in tlogs:
            for sec, rx, lost in t["link"]:
                old = per_sec.get(sec, (0, 0))
                per_sec[sec] = (old[0] + rx, old[1] + lost)
        out: list[float | None] = []
        for g in grid:
            if not _inside(cover, g):
                out.append(None)
                continue
            rx = lost = 0
            for sec in range(int(g) - 2, int(g) + 1):
                r, lo = per_sec.get(sec, (0, 0))
                rx, lost = rx + r, lost + lo
            out.append(100.0 if rx + lost == 0 else round(100 * lost / (rx + lost), 1))
        return out

    @staticmethod
    def _cam_fps(vids, grid) -> list[float | None]:
        if not vids:
            return [None] * len(grid)
        times = sorted(t for v in vids for t in v["times"])
        cover = [[v["t0"], v["t1"]] for v in vids]
        out: list[float | None] = []
        for g in grid:
            if not _inside(cover, g):
                out.append(None)
                continue
            n = bisect.bisect_right(times, g) - bisect.bisect_right(times, g - 2.0)
            out.append(round(n / 2.0, 1))
        return out

    @staticmethod
    def _modes(tracks, ws, we) -> list[dict[str, Any]]:
        for kind in ("dataflash", "tlog"):
            changes = sorted(m for t in tracks if t["kind"] == kind for m in t["modes"])
            if not changes:
                continue
            before = [m for m in changes if m[0] <= ws]
            inside = [m for m in changes if ws < m[0] <= we]
            seq = ([[ws, before[-1][1]]] if before else []) + inside
            out = []
            for k, (t, name) in enumerate(seq):
                t_end = seq[k + 1][0] if k + 1 < len(seq) else we
                if out and out[-1]["mode"] == name:
                    out[-1]["t1"] = round(t_end - ws, 2)
                else:
                    out.append({"t0": round(t - ws, 2), "t1": round(t_end - ws, 2), "mode": name})
            return out
        return []

    @staticmethod
    def _events(tracks, tlogs, vids, ws, we, start, end) -> list[dict[str, Any]]:
        ev: list[tuple[float, str, str, str]] = []
        df_fc = [
            (e[0], e[3])
            for t in tracks
            if t["kind"] == "dataflash"
            for e in t["events"]
            if ws <= e[0] <= we
        ]
        for t in tracks:
            for at, level, src, text in t["events"]:
                if not ws <= at <= we:
                    continue
                if (
                    t["kind"] == "tlog"
                    and src == "fc"
                    and any(abs(at - dt) < 3 and dtext == text for dt, dtext in df_fc)
                ):
                    continue  # cùng một STATUSTEXT đã có trong log FC
                ev.append((at, level, src, text))
        files = sorted(tlogs, key=lambda t: t["t0"])
        for a, b in zip(files, files[1:], strict=False):
            gap = b["t0"] - a["t1"]
            if ws <= a["t1"] <= we and LINK_GAP_S_MIN <= gap <= RECONNECT_S:
                ev.append((a["t1"], "warning", "link", f"Mất link {gap:.1f} s (backend nối lại)"))
        times = sorted(t for v in vids for t in v["times"] if ws - CAM_GAP_S <= t <= we)
        for a, b in zip(times, times[1:], strict=False):
            if b - a > CAM_GAP_S and a >= ws:
                ev.append((a, "warning", "camera", f"Mất hình {b - a:.1f} s"))
        ev += [(start, "info", "arm", "ARM"), (end, "info", "arm", "DISARM")]
        ev.sort(key=lambda e: e[0])
        return [
            {"t": round(at - ws, 2), "level": lv, "source": src, "text": text}
            for at, lv, src, text in ev
        ]

    @staticmethod
    def _summary(start, end, ws, step, cols, tracks, vids, modes, events, tlogs) -> dict[str, Any]:
        i0, i1 = int((start - ws) / step), int((end - ws) / step) + 1

        def armed(name):
            return [v for v in cols[name][i0:i1] if v is not None]

        alt, dist, volt = armed("alt"), armed("dist_home"), armed("volt")
        mah = armed("mah")
        path_m = 0.0
        pts = list(zip(cols["lat"][i0:i1], cols["lon"][i0:i1], cols["alt"][i0:i1], strict=True))
        prev = None
        for la, lo, al in pts:
            if la is None or lo is None or al is None or al < 0.5:
                prev = None
                continue
            if prev:
                path_m += _haversine_m(prev[0], prev[1], la, lo)
            prev = (la, lo)
        rx = lost = 0
        for t in tlogs:
            for sec, r, lo in t["link"]:
                if start <= sec <= end:
                    rx, lost = rx + r, lost + lo
        frames = sum(1 for v in vids for t in v["times"] if start <= t <= end)
        secs = {int(t) for v in vids for t in v["times"] if start <= t <= end}
        dur = end - start
        kinds = sorted({t["kind"] for t in tracks} | ({"video"} if vids else set()))
        return {
            "id": flight_id(start),
            "start": round(start, 2),
            "end": round(end, 2),
            "duration_s": round(dur, 1),
            "took_off": bool(alt) and max(alt) > TOOK_OFF_M,
            "sources": kinds,
            "modes": list(dict.fromkeys(m["mode"] for m in modes)),
            "max_alt_m": round(max(alt), 1) if alt else None,
            "max_dist_m": round(max(dist), 1) if dist else None,
            "path_m": round(path_m, 1) if alt else None,
            "battery_start_v": round(volt[0], 2) if volt else None,
            "battery_min_v": round(min(volt), 2) if volt else None,
            "used_mah": max(0, round(mah[-1] - mah[0])) if len(mah) >= 2 else None,
            "link_loss_pct": round(100 * lost / (rx + lost), 1) if rx + lost else None,
            "video_fps": round(frames / dur, 1) if vids and dur > 0 else None,
            "video_coverage_pct": round(100 * len(secs) / max(1, math.ceil(dur)), 1)
            if vids
            else None,
            "warnings": sum(1 for e in events if e["level"] != "info"),
        }
