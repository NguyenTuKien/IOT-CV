/**
 * Trang LỊCH SỬ BAY — xem lại từng chuyến từ log (15/11/2026).
 *
 *   ┌─ danh sách ─┐┌──────── bản đồ vệt bay ────────┐┌── video camera ──┐
 *   │ theo ngày   ││ drone tại đầu phát, home        ││ khung tại đầu phát│
 *   │             │├──── phát · tốc độ · tua · dải mode · vạch sự kiện ───┤
 *   │             │├── AI: khung gốc ↔ ảnh rõ (cạnh nhau / thanh trượt), hộp người, số đo ──┤
 *   │             │├── biểu đồ: độ cao, tốc độ, pin, sóng, mất gói, camera, GPS, rung ──┤
 *   └─────────────┘└── tóm tắt chuyến ──┴── sự kiện (bấm để tua) ──┘
 *
 * Dữ liệu: backend ghép log FC tải về (`scripts/fc/tai_log.py`), tlog và video của backend
 * (`backend/flights/`). Chỉ ĐỌC — trang này không gửi gì xuống drone. Chuyến đang chọn nằm
 * trên URL (`?f=`) để chép link gửi được.
 */
import { BarChart3, History, ListTree, Map as MapIcon, Sparkles, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { pageMeta } from "@/app/routes";
import { Chip, EmptyState, ModeBadge, PageHeader } from "@/components/kit";
import { AiCompare } from "@/components/flights/AiCompare";
import { FlightEvents, FlightSummaryList } from "@/components/flights/FlightInfo";
import { FlightList } from "@/components/flights/FlightList";
import { PlaybackBar } from "@/components/flights/PlaybackBar";
import { ReplayChart } from "@/components/flights/ReplayChart";
import type { ReplaySeries } from "@/components/flights/ReplayChart";
import { ReplayMap } from "@/components/flights/ReplayMap";
import { VideoReplay } from "@/components/flights/VideoReplay";
import { Panel } from "@/components/Panel";
import { fetchFlight, fetchFlights, indexAt, lastValue } from "@/lib/flights";
import type { FlightDetail, FlightSummary, Speed } from "@/lib/flights";

/** Đầu phát cập nhật state tối đa chừng này lần mỗi giây (bản đồ + 9 biểu đồ + video). */
const TICK_MS = 66;

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; data: T };

interface ChartDef {
  key: string;
  title: string;
  unit: string;
  digits?: number;
  range?: [number, number];
  /** Biến CSS màu của biểu đồ (chấm tiêu đề + nét chuỗi 1). */
  color: string;
  series: (f: FlightDetail) => ReplaySeries[];
}

/*
 * Mỗi biểu đồ một màu (chấm cạnh tiêu đề cùng màu nét) để mắt tìm lại đúng ô khi tua — màu
 * chỉ PHÂN BIỆT, không mang nghĩa tốt/xấu. Ô có hai chuỗi: chuỗi 2 giữ màu `--series-2`.
 */
const CHARTS: readonly ChartDef[] = [
  { key: "alt", title: "Độ cao & khoảng cách home", unit: "m", color: "--hud-teal", series: (f) => [{ label: "Độ cao", values: f.series.alt, slot: 1, color: "--hud-teal" }, { label: "Cách home", values: f.series.dist_home, slot: 2 }] },
  { key: "speed", title: "Tốc độ ngang", unit: "m/s", color: "--hud-blue", series: (f) => [{ label: "Tốc độ", values: f.series.speed, slot: 1, color: "--hud-blue" }] },
  { key: "volt", title: "Điện áp pin", unit: "V", digits: 2, color: "--hud-green", series: (f) => [{ label: "Pin", values: f.series.volt, slot: 1, color: "--hud-green" }] },
  { key: "curr", title: "Dòng điện", unit: "A", color: "--hud-orange", series: (f) => [{ label: "Dòng", values: f.series.curr, slot: 1, color: "--hud-orange" }] },
  { key: "rssi", title: "Sóng Wi-Fi DroneBridge", unit: "dBm", digits: 0, color: "--hud-indigo", series: (f) => [{ label: "RSSI", values: f.series.rssi, slot: 1, color: "--hud-indigo" }] },
  { key: "loss", title: "Mất gói MAVLink (3 s)", unit: "%", digits: 0, range: [0, 100], color: "--hud-red", series: (f) => [{ label: "Mất gói", values: f.series.link_loss, slot: 1, color: "--hud-red" }] },
  { key: "cam", title: "Camera về laptop", unit: "khung/s", color: "--hud-violet", series: (f) => [{ label: "Khung/s", values: f.series.cam_fps, slot: 1, color: "--hud-violet" }] },
  { key: "gps", title: "GPS: số vệ tinh", unit: "vệ tinh", digits: 0, color: "--hud-cyan", series: (f) => [{ label: "Vệ tinh", values: f.series.sats, slot: 1, color: "--hud-cyan" }] },
  { key: "vibe", title: "Rung (lớn nhất 3 trục)", unit: "m/s²", color: "--hud-pink", series: (f) => [{ label: "Rung", values: f.series.vibe, slot: 1, color: "--hud-pink" }] },
];

function usePlayback(flight: FlightDetail) {
  const total = flight.window_end - flight.window_start;
  const armAt = Math.max(0, flight.summary.start - flight.window_start);
  // Mở chuyến: đứng đúng lúc ARM (log FC chỉ có số từ lúc ARM). Đổi chuyến là component mới (key = id), không reset tay.
  const [cursor, setCursor] = useState(armAt);
  const [wantPlay, setWantPlay] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const playing = wantPlay && cursor < total;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setCursor((c) => Math.min(c + dt, total));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, speed, total]);

  const seek = useCallback((t: number) => setCursor(Math.min(Math.max(0, t), total)), [total]);
  const setPlaying = useCallback(
    (on: boolean) => {
      if (on && cursor >= total) setCursor(armAt); // hết chuyến mà bấm Phát: phát lại từ đầu
      setWantPlay(on);
    },
    [cursor, total, armAt],
  );
  return { cursor, playing, speed, setPlaying, setSpeed, seek };
}

export default function FlightsPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("f");
  const [list, setList] = useState<Load<FlightSummary[]>>({ state: "loading" });
  const [loaded, setLoaded] = useState<{ id: string; load: Load<FlightDetail> } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetchFlights({ signal: ctl.signal })
      .then((r) => setList({ state: "ok", data: r.flights }))
      .catch((e: unknown) => {
        if (!ctl.signal.aborted) setList({ state: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => ctl.abort();
  }, []);

  // Chưa chọn chuyến nào: chọn chuyến mới nhất có cất cánh.
  useEffect(() => {
    if (selected || list.state !== "ok" || list.data.length === 0) return;
    const latest = [...list.data].reverse().find((f) => f.took_off) ?? list.data[list.data.length - 1];
    setParams({ f: latest.id }, { replace: true });
  }, [selected, list, setParams]);

  useEffect(() => {
    if (!selected) return;
    const ctl = new AbortController();
    fetchFlight(selected, { signal: ctl.signal })
      .then((d) => setLoaded({ id: selected, load: { state: "ok", data: d } }))
      .catch((e: unknown) => {
        if (!ctl.signal.aborted) setLoaded({ id: selected, load: { state: "error", message: e instanceof Error ? e.message : String(e) } });
      });
    return () => ctl.abort();
  }, [selected]);

  const detail: Load<FlightDetail> | null = !selected ? null : loaded?.id === selected ? loaded.load : { state: "loading" };
  const flight = detail?.state === "ok" ? detail.data : null;

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        {...pageMeta("/flights")}
        eyebrow="Giám sát · xem lại"
        title="Lịch sử bay"
        description="Phát lại từng chuyến từ log: đường bay trên bản đồ, độ cao, hình camera đã ghi, sóng và mất gói, pin, GPS, sự kiện. Dữ liệu ghép từ log FC tải về, tlog và video của laptop, giờ đã chỉnh theo GPS."
      />

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel
          title="Các chuyến"
          subtitle={list.state === "ok" ? `${list.data.length} chuyến · mới nhất ở trên` : undefined}
          icon={History}
          accent="indigo"
          // Bám theo khi cuộn phần chi tiết (≥ 1280 px): chọn chuyến khác không phải cuộn ngược lên,
          // và cột trái không còn là một panel trống dài bằng cả trang.
          className="xl:sticky xl:top-[6.75rem] xl:self-start"
          bodyClassName="max-h-[min(80dvh,900px)] overflow-y-auto p-2 xl:max-h-[calc(100dvh-11rem)]"
          testId="flights-list-panel"
        >
          {list.state === "loading" ? (
            <p className="p-2 text-sm text-muted-foreground">Đang đọc log… Lần đầu backend phải đọc hết log FC và tlog, mất chừng nửa phút.</p>
          ) : list.state === "error" ? (
            <p className="p-2 text-sm text-hud-red">Không tải được danh sách: {list.message}</p>
          ) : list.data.length === 0 ? (
            <EmptyState icon={History} title="Chưa có chuyến nào">
              Tải log FC bằng <code>scripts/fc/tai_log.py</code> vào <code>logs/fc-dataflash-…/</code>, hoặc bay khi backend đang chạy (tlog, video).
            </EmptyState>
          ) : (
            <FlightList flights={list.data} selected={selected} onSelect={(id) => setParams({ f: id })} />
          )}
        </Panel>

        <div className="min-w-0 space-y-3">
          {detail?.state === "loading" ? <p className="text-sm text-muted-foreground">Đang mở chuyến {selected}…</p> : null}
          {detail?.state === "error" ? <p className="text-sm text-hud-red">Không mở được chuyến {selected}: {detail.message}</p> : null}
          {flight ? <FlightReplay key={flight.summary.id} flight={flight} /> : null}
        </div>
      </div>
    </div>
  );
}

/** Phần phát lại của MỘT chuyến. Trang dựng lại nó (key = id) khi đổi chuyến. */
function FlightReplay({ flight }: { flight: FlightDetail }) {
  const { cursor, playing, speed, setPlaying, setSpeed, seek } = usePlayback(flight);
  const index = Math.max(0, indexAt(flight.series.t, cursor));
  const charts = useMemo(() => CHARTS.map((c) => ({ ...c, data: c.series(flight) })), [flight]);
  const here = {
    alt: lastValue(flight.series.alt, index),
    dist: lastValue(flight.series.dist_home, index),
    speed: lastValue(flight.series.speed, index),
    volt: lastValue(flight.series.volt, index),
    mode: flight.modes.find((m) => m.t0 <= cursor && cursor < m.t1)?.mode ?? "—",
    fps: lastValue(flight.series.cam_fps, index, 2),
  };

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Đường bay"
          subtitle="Tại đầu phát"
          icon={MapIcon}
          accent="teal"
          variant="instrument"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-1">
              <ModeBadge mode={here.mode} size="xs" title="Chế độ bay tại đầu phát" />
              <Chip tone="teal" size="xs" mono title="Độ cao so với home">
                {here.alt?.toFixed(1) ?? "—"} m
              </Chip>
              <Chip tone="blue" size="xs" mono title="Cách home">
                ↔ {here.dist?.toFixed(0) ?? "—"} m
              </Chip>
              <Chip tone="slate" size="xs" mono title="Tốc độ ngang">
                {here.speed?.toFixed(1) ?? "—"} m/s
              </Chip>
              <Chip tone="green" size="xs" mono title="Điện áp pin">
                {here.volt?.toFixed(2) ?? "—"} V
              </Chip>
            </div>
          }
          className="h-[min(56dvh,560px)] min-h-90"
          testId="flight-map-panel"
        >
          <ReplayMap flight={flight} index={index} />
        </Panel>
        <Panel title="Camera" subtitle="Khung đã ghi về laptop tại đầu phát" icon={Video} accent="violet" variant="instrument" className="h-[min(56dvh,560px)] min-h-75" testId="flight-video-panel">
          <VideoReplay flight={flight} cursor={cursor} fps={here.fps} />
        </Panel>
      </div>

      <Panel title="Phát lại" subtitle="Dải màu = chế độ bay · vạch = cảnh báo / lỗi" icon={History} accent="cyan" bodyClassName="p-3">
        <PlaybackBar flight={flight} cursor={cursor} playing={playing} speed={speed} onSeek={seek} onPlay={setPlaying} onSpeed={setSpeed} />
      </Panel>

      <Panel
        title="AI xử lý ảnh trên video chuyến bay"
        subtitle="Khung gốc ↔ khung sau enhancer, laptop xử lý theo đầu phát · hộp người của detector"
        icon={Sparkles}
        accent="violet"
        bodyClassName="p-0"
        testId="flight-ai-panel"
      >
        <AiCompare flight={flight} cursor={cursor} playing={playing} onPlay={setPlaying} />
      </Panel>

      <Panel title="Số liệu theo thời gian" subtitle="Vạch vàng = đầu phát · bấm vào biểu đồ để tua" icon={BarChart3} accent="blue" bodyClassName="grid gap-x-4 gap-y-2 p-3 md:grid-cols-2 2xl:grid-cols-3">
        {charts.map((c) => (
          <div key={c.key} className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              <span className="size-2 shrink-0 rounded-full" style={{ background: `var(${c.color})` }} aria-hidden />
              {c.title}
              <span className="font-normal text-muted-foreground">· {c.unit}</span>
            </div>
            <ReplayChart
              t={flight.series.t}
              windowStart={flight.window_start}
              series={c.data}
              unit={c.unit}
              digits={c.digits}
              range={c.range}
              cursor={cursor}
              onSeek={seek}
              label={c.title}
            />
          </div>
        ))}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Tóm tắt chuyến" subtitle="Tính trong khoảng ARM → DISARM" icon={ListTree} accent="green" bodyClassName="p-3">
          <FlightSummaryList flight={flight} />
        </Panel>
        <Panel
          title="Sự kiện"
          subtitle="Bấm một dòng để tua tới lúc đó · dòng mờ là chưa tới"
          icon={History}
          accent="orange"
          actions={
            <Chip tone="slate" size="xs">
              {flight.events.length} sự kiện
            </Chip>
          }
          bodyClassName="max-h-[420px] overflow-y-auto p-1"
        >
          <FlightEvents flight={flight} cursor={cursor} onSeek={seek} />
        </Panel>
      </div>
    </>
  );
}
