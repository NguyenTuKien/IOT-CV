/**
 * Trang HỆ THỐNG — kiến trúc, trạng thái backend, giới hạn an toàn đang áp dụng.
 *
 * Số liệu backend lấy qua `GET /api/system` (hỏi lại mỗi 5 s, chỉ khi trang mở).
 * Giới hạn đọc từ `status.limits` — CHÍNH bộ số backend dùng để chặn lệnh; trang
 * này chỉ hiện, không sửa được (đổi = sửa `.env` của backend rồi khởi động lại).
 */
import {
  Activity,
  ArrowDownToLine,
  BellRing,
  Braces,
  Camera,
  Clock,
  Cpu,
  Gauge,
  Hash,
  History,
  Hourglass,
  MapPinned,
  MonitorSmartphone,
  Mountain,
  Network,
  Plug,
  Radar,
  Radius,
  RefreshCw,
  Ruler,
  ServerCog,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  TimerReset,
  Video,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { pageMeta } from "@/app/routes";
import { Chip, KeyValue, KeyValueList, PageHeader, StatTile } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { fetchSystem } from "@/lib/api";
import { NO_VALUE, formatClock, formatDuration } from "@/lib/format";
import type { LimitsPayload, SystemPayload } from "@/lib/protocol";
import { DOWNLINK_TYPES } from "@/lib/protocol";
import { ACCENT_DOT, ACCENT_TEXT } from "@/lib/tone";
import type { Accent } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session";
import { useTelemetryStore } from "@/store/telemetry";

const SYSTEM_POLL_MS = 5000;

function useSystem(): { data: SystemPayload | null; error: string | null } {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const load = () =>
      fetchSystem({ signal: abort.signal })
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => !abort.signal.aborted && setError(e.message));
    void load();
    const timer = setInterval(load, SYSTEM_POLL_MS);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, []);
  return { data, error };
}

type Link = "ok" | "down" | "unknown" | "planned" | "static";

const LINK_CLS: Record<Link, string> = {
  ok: "stroke-hud-green",
  down: "stroke-hud-red",
  unknown: "stroke-muted-foreground/50",
  planned: "stroke-muted-foreground/35",
  static: "stroke-hud-orange/60",
};

type BoxTone = "cyan" | "indigo" | "blue" | "teal" | "orange" | "dim";

/* Lớp màu viết đủ chữ (Tailwind chỉ sinh lớp nó đọc thấy nguyên văn). */
const BOX_CLS: Record<BoxTone, { box: string; title: string }> = {
  cyan: { box: "fill-hud-cyan/8 stroke-hud-cyan/45", title: "fill-hud-cyan" },
  indigo: { box: "fill-hud-indigo/8 stroke-hud-indigo/45", title: "fill-hud-indigo" },
  blue: { box: "fill-hud-blue/8 stroke-hud-blue/45", title: "fill-hud-blue" },
  teal: { box: "fill-hud-teal/8 stroke-hud-teal/45", title: "fill-hud-teal" },
  orange: { box: "fill-hud-orange/8 stroke-hud-orange/45", title: "fill-hud-orange" },
  dim: { box: "fill-foreground/[0.03] stroke-border", title: "fill-foreground" },
};

/**
 * Sơ đồ kiến trúc: đường nối xanh chạy = sống, đỏ = mất, xám đứt = chưa biết / chưa làm.
 * Drone thật đi qua bo DroneBridge ESP32 (Wi-Fi ↔ UART, UDP 14550); SITL nối thẳng TCP — nhãn
 * đường MAVLink đọc từ endpoint backend đang dùng. Rộng tối đa ~900 px: sơ đồ phóng hết màn hình
 * lớn thì chữ to hơn tiêu đề trang.
 */
function Architecture() {
  const socket = useTelemetryStore((s) => s.connection === "open");
  const mav = useTelemetryStore((s) => s.telemetry?.connected);
  const cam = useTelemetryStore((s) => s.status?.camera?.available);
  const endpoint = useTelemetryStore((s) => s.status?.endpoint ?? "");
  const ws: Link = socket ? "ok" : "down";
  const fc: Link = !socket ? "unknown" : mav ? "ok" : "down";
  const camera: Link = !socket ? "unknown" : cam ? "ok" : "down";
  const sitl = endpoint.startsWith("tcp:");

  const box = (x: number, y: number, title: string, sub: string, tone: BoxTone, dashed = false) => (
    <g opacity={tone === "dim" ? 0.6 : 1}>
      <rect x={x} y={y} width="180" height="64" rx="14" className={BOX_CLS[tone].box} strokeDasharray={dashed ? "4 4" : undefined} />
      <text x={x + 16} y={y + 28} className={cn(BOX_CLS[tone].title, "font-display text-[15px] font-semibold")}>
        {title}
      </text>
      <text x={x + 16} y={y + 47} className="fill-muted-foreground text-[11px]">
        {sub}
      </text>
    </g>
  );
  const line = (d: string, st: Link, label: string, lx: number, ly: number) => (
    <g>
      <path
        d={d}
        fill="none"
        strokeWidth="2.5"
        className={cn(LINK_CLS[st], st === "ok" && "link-flow")}
        strokeDasharray={st === "ok" ? "8 8" : st === "down" ? "3 6" : st === "static" ? undefined : "2 6"}
        strokeLinecap="round"
      />
      <text x={lx} y={ly} textAnchor="middle" className="fill-muted-foreground font-mono text-[10.5px]">
        {label}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 860 300" className="mx-auto w-full max-w-[900px]" role="img" aria-label="Kiến trúc hệ thống và trạng thái từng kết nối">
      {line("M200 72 H330", ws, "WebSocket /ws", 265, 60)}
      {line("M510 72 H640", fc, sitl ? "MAVLink · TCP (SITL)" : "MAVLink · UDP 14550", 575, 60)}
      {line("M420 104 V180", camera, "MJPEG", 455, 150)}
      {line("M350 104 C 350 165 265 212 200 212", "static", "ghi về laptop", 248, 168)}
      {line("M510 212 H640", "planned", "MQTT · Phase 23", 575, 200)}
      {box(20, 40, "Trình duyệt", "Web GCS v2 · React 19", "cyan")}
      {box(330, 40, "Backend", "FastAPI · pymavlink", "indigo")}
      {box(640, 40, "Flight controller", sitl ? "ArduCopter 4.7 · SITL" : "ArduCopter · qua DroneBridge", "blue")}
      {box(330, 180, "Camera", "ESP32-S3 / nguồn giả", "teal")}
      {box(20, 180, "Ghi & xem lại", "tlog · video · log FC", "orange")}
      {box(640, 180, "Broker IoT", "mosquitto — chưa làm", "dim", true)}
      <text x="20" y="285" className="fill-muted-foreground text-[11px]">
        Xanh chạy = đang sống · đỏ đứt = mất · xám = chưa biết hoặc chưa triển khai · cam = ghi file (xem ở trang Lịch sử bay)
      </text>
    </svg>
  );
}

interface LimitRow {
  key: keyof LimitsPayload;
  label: string;
  unit: string;
  note: string;
  icon: LucideIcon;
}

/** Bộ giới hạn chia ba nhóm theo việc nó canh — đọc theo nhóm nhanh hơn một bảng 11 dòng. */
const LIMIT_GROUPS: { title: string; accent: Accent; icon: LucideIcon; rows: LimitRow[] }[] = [
  {
    title: "Độ cao & phạm vi",
    accent: "blue",
    icon: Mountain,
    rows: [
      { key: "max_alt", label: "Trần độ cao", unit: "m", note: "Mission và TAKEOFF vượt bị backend từ chối", icon: Mountain },
      { key: "min_alt", label: "Sàn độ cao", unit: "m", note: "Không bay mission thấp hơn", icon: ArrowDownToLine },
      { key: "max_distance_home", label: "Bán kính quanh home", unit: "m", note: "Rào PHẦN MỀM — rào thật là FENCE_* trên FC", icon: Radius },
      { key: "max_waypoints", label: "Điểm mission tối đa", unit: "điểm", note: "Tính cả cất cánh và RTL/LAND", icon: MapPinned },
    ],
  },
  {
    title: "Lái tay & dead-man",
    accent: "amber",
    icon: Timer,
    rows: [
      { key: "max_velocity", label: "Vận tốc lái tay tối đa", unit: "m/s", note: "Backend kẹp lại lần nữa", icon: Gauge },
      { key: "manual_command_timeout_ms", label: "Hạn dead-man", unit: "ms", note: "Quá hạn không có lệnh → gửi vận tốc 0", icon: Timer },
      { key: "deadman_tick_ms", label: "Nhịp quét dead-man", unit: "ms", note: "Nhỏ hơn hẳn hạn dead-man", icon: TimerReset },
    ],
  },
  {
    title: "Tránh vật cản",
    accent: "orange",
    icon: Radar,
    rows: [
      { key: "avoid_margin_m", label: "Lề tránh vật cản", unit: "m", note: "Dưới mức này FC phanh", icon: ShieldAlert },
      { key: "avoid_dist_max_m", label: "Tầm bắt đầu giảm tốc", unit: "m", note: "Vùng vàng của radar", icon: Radar },
      { key: "rangefinder_max_m", label: "Tầm đo TFmini", unit: "m", note: "Xa hơn là 'trống trải'", icon: Ruler },
      { key: "proximity_stale_s", label: "Số đo cũ sau", unit: "s", note: "Quá thì AVOID = không đọc được", icon: Hourglass },
    ],
  },
];

function LimitTile({ row, value, accent, className }: { row: LimitRow; value: number; accent: Accent; className?: string }) {
  const Icon = row.icon;
  return (
    <div className={cn("well relative flex min-w-0 flex-col gap-1 overflow-hidden px-3 py-2.5", className)} title={row.note} data-testid={`limit-${row.key}`}>
      <span className={cn("absolute inset-y-2.5 left-0 w-[3px] rounded-r-full", ACCENT_DOT[accent])} aria-hidden />
      <p className="flex items-center gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
        <Icon className={cn("size-3.5 shrink-0", ACCENT_TEXT[accent])} aria-hidden />
        <span className="min-w-0">{row.label}</span>
      </p>
      <p className="num text-[1.15rem] leading-none font-semibold text-foreground">
        {value}
        {row.unit ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">{row.unit}</span> : null}
      </p>
      <p className="text-[10.5px] leading-snug text-muted-foreground">{row.note}</p>
    </div>
  );
}

function Limits({ limits }: { limits: LimitsPayload }) {
  return (
    <div className="grid gap-x-4 gap-y-3 lg:grid-cols-3">
      {LIMIT_GROUPS.map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.title} className="flex min-w-0 flex-col gap-1.5">
            <p className={cn("flex items-center gap-1.5 font-display text-[11px] font-semibold tracking-[0.1em] uppercase", ACCENT_TEXT[g.accent])}>
              <Icon className="size-3.5" aria-hidden /> {g.title}
            </p>
            <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-1.5">
              {g.rows.map((r, i) => (
                <LimitTile
                  key={r.key}
                  row={r}
                  value={limits[r.key]}
                  accent={g.accent}
                  className={g.rows.length % 2 === 1 && i === g.rows.length - 1 ? "col-span-2" : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Mỗi loại gói WebSocket một màu + một câu nói nó là gì (tên gói lấy từ hợp đồng, không gõ tay). */
const DOWNLINK_META: Record<(typeof DOWNLINK_TYPES)[number], { accent: Accent; desc: string }> = {
  telemetry: { accent: "cyan", desc: "số đo bay" },
  status: { accent: "indigo", desc: "trạng thái backend" },
  event: { accent: "amber", desc: "nhật ký sự kiện" },
  detection: { accent: "violet", desc: "box nhận diện" },
  ack: { accent: "green", desc: "xác nhận lệnh" },
  error: { accent: "red", desc: "lỗi lệnh" },
  pong: { accent: "slate", desc: "đo độ trễ" },
};

function DataFlow() {
  const rates = useSessionStore((s) => s.rates);
  const totals = useSessionStore((s) => s.totals);
  const bps = useSessionStore((s) => s.bytesPerSecond);
  const reconnects = useSessionStore((s) => s.reconnects);
  const max = useMemo(() => Math.max(1, ...DOWNLINK_TYPES.map((t) => rates[t] ?? 0)), [rates]);

  return (
    <div className="flex flex-col gap-3">
      <ul className="zebra overflow-hidden rounded-lg border border-border/70" data-testid="data-flow">
        {DOWNLINK_TYPES.map((t) => {
          const meta = DOWNLINK_META[t];
          const rate = rates[t] ?? 0;
          return (
            <li key={t} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 px-2.5 py-2" data-type={t}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", ACCENT_DOT[meta.accent], rate === 0 && "opacity-35")} aria-hidden />
                <span className="min-w-0 leading-tight">
                  <span className="block font-mono text-[12px] font-semibold text-foreground/90">{t}</span>
                  <span className="block text-[10.5px] text-muted-foreground">{meta.desc}</span>
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-foreground/8" aria-hidden>
                <span className={cn("block h-full rounded-full transition-[width] duration-500", ACCENT_DOT[meta.accent])} style={{ width: `${(rate / max) * 100}%` }} />
              </span>
              <span className="text-right leading-tight">
                <span className={cn("num block text-[13px] font-semibold", rate > 0 ? "text-foreground" : "text-muted-foreground")}>{rate} /s</span>
                <span className="num block text-[10.5px] text-muted-foreground">tổng {totals[t] ?? 0}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-1.5">
        <StatTile label="Băng thông" icon={Wifi} accent="blue" value={`${(bps / 1024).toFixed(1)} KB/s`} sub="WebSocket, đo tại trình duyệt" />
        <StatTile
          label="Số lần nối lại"
          icon={RefreshCw}
          tone={reconnects > 0 ? "warn" : "ok"}
          value={String(reconnects)}
          sub={reconnects > 0 ? "socket đã rớt và tự nối" : "chưa rớt lần nào"}
        />
      </div>
    </div>
  );
}

/** Sáu con số nhìn một cái là biết backend có khoẻ không — cạnh sơ đồ kiến trúc. */
function Glance({ data }: { data: SystemPayload | null }) {
  const events = useTelemetryStore((s) => s.events);
  const warn = events.filter((e) => e.level === "warn").length;
  const errors = events.filter((e) => e.level === "error").length;
  // Bộ đệm lịch sử = số giây × nhịp telemetry (backend/history.py), nên tính được độ đầy.
  const capacity = data ? Math.max(1, Math.round(data.history_capacity_s * Math.max(data.telemetry_hz, 1))) : null;
  const fill = data && capacity ? Math.min(1, data.history_samples / capacity) : null;
  return (
    <div className="grid h-full auto-rows-fr grid-cols-2 gap-2" data-testid="system-glance">
      <StatTile
        label="Link MAVLink"
        icon={Plug}
        tone={data ? (data.link_alive ? "ok" : "danger") : "neutral"}
        value={data ? (data.link_alive ? "sống" : "mất") : NO_VALUE}
        sub={data?.endpoint ?? NO_VALUE}
      />
      <StatTile label="Nhịp telemetry" icon={Activity} accent="cyan" value={data ? `${data.telemetry_hz} Hz` : NO_VALUE} sub="backend đẩy về mọi tab" />
      <StatTile
        label="Đã chạy"
        icon={Clock}
        accent="indigo"
        value={data ? formatDuration(data.uptime_s) : NO_VALUE}
        sub={data ? `từ ${formatClock(data.started_at)}` : NO_VALUE}
      />
      <StatTile
        label="Tab đang mở"
        icon={MonitorSmartphone}
        accent="teal"
        value={data ? String(data.ws_clients) : NO_VALUE}
        sub="mỗi tab một WebSocket"
      />
      <StatTile
        label="Lịch sử telemetry"
        icon={History}
        accent="cyan"
        value={data ? `${data.history_samples} mẫu` : NO_VALUE}
        sub={data && fill !== null ? `đầy ${Math.round(fill * 100)} % · giữ ${data.history_capacity_s / 60} phút` : NO_VALUE}
      />
      <StatTile
        label="Sự kiện đang giữ"
        icon={BellRing}
        tone={errors > 0 ? "danger" : warn > 0 ? "warn" : "neutral"}
        accent={errors > 0 || warn > 0 ? undefined : "amber"}
        value={data ? String(data.events_buffered) : NO_VALUE}
        sub={`trong tab này: ${warn} cảnh báo · ${errors} lỗi`}
      />
    </div>
  );
}

function BackendDetail({ data }: { data: SystemPayload | null }) {
  return (
    <div className="flex flex-col gap-3">
      <KeyValueList title="Tiến trình" icon={Cpu}>
        <KeyValue icon={Braces} accent="indigo" label="Phiên bản · hợp đồng" value={data ? `${data.backend_version} · v${data.contract_version}` : NO_VALUE} />
        <KeyValue icon={Cpu} accent="indigo" label="Python · nền tảng" value={data ? `${data.python} · ${data.platform}` : NO_VALUE} />
        <KeyValue icon={Hash} accent="slate" label="PID" value={data ? String(data.pid) : NO_VALUE} />
      </KeyValueList>
      <KeyValueList title="Kết nối & camera" icon={Plug}>
        <KeyValue icon={Plug} accent="blue" label="Endpoint MAVLink" value={data?.endpoint ?? NO_VALUE} />
        <KeyValue
          icon={Camera}
          accent="teal"
          label="Vision"
          value={data ? (data.vision_enabled ? (data.camera_fake ? "bật · nguồn giả" : "bật · camera thật") : "tắt") : NO_VALUE}
          tone={data ? (data.vision_enabled ? (data.camera_fake ? "warn" : "ok") : "neutral") : undefined}
        />
        <KeyValue icon={Video} accent="teal" label="Nguồn camera" value={data?.camera_source ?? NO_VALUE} />
      </KeyValueList>
    </div>
  );
}

export default function SystemPage() {
  const { data, error } = useSystem();
  const limits = useTelemetryStore((s) => s.status?.limits ?? null);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        {...pageMeta("/system")}
        eyebrow="Hệ thống"
        title="Hệ thống"
        description="Các khối của hệ thống và kết nối giữa chúng, cấu hình backend, và bộ giới hạn an toàn đang có hiệu lực."
        actions={
          error ? (
            <Chip tone="danger" dot title={error}>
              Không đọc được /api/system
            </Chip>
          ) : data ? (
            <Chip tone="ok" dot mono>
              Backend v{data.backend_version}
            </Chip>
          ) : null
        }
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Kiến trúc" subtitle="Trạng thái sống của từng kết nối" icon={Network} accent="indigo" bodyClassName="grid place-items-center p-4">
          <Architecture />
        </Panel>
        <Panel title="Backend lúc này" subtitle={`Hỏi lại mỗi ${SYSTEM_POLL_MS / 1000} s`} icon={ServerCog} accent="indigo" bodyClassName="p-3">
          <Glance data={data} />
        </Panel>
      </div>
      <Panel
        title="Giới hạn an toàn"
        subtitle="Từ status.limits — backend chặn lệnh theo đúng bộ số này"
        icon={SlidersHorizontal}
        accent="red"
        bodyClassName="p-3"
        testId="system-limits"
      >
        {limits ? <Limits limits={limits} /> : <p className="text-sm text-muted-foreground">Chưa nhận status từ backend.</p>}
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Backend" subtitle="Tiến trình, kết nối, camera" icon={ServerCog} accent="indigo" bodyClassName="p-3">
          <BackendDetail data={data} />
        </Panel>
        <Panel title="Luồng dữ liệu" subtitle="Gói/giây nhận được, đo tại trình duyệt" icon={Gauge} accent="blue" bodyClassName="p-3">
          <DataFlow />
        </Panel>
      </div>
    </div>
  );
}
