/**
 * Trang DỮ LIỆU BAY — biểu đồ thời gian thực của mọi trường telemetry + bảng số
 * sống + xuất CSV.
 *
 * Nguồn: `store/history.ts` — gói trình duyệt nhận trực tiếp, cộng lịch sử
 * backend nạp sẵn lúc mở trang (`GET /api/telemetry/history`), tối đa 15 phút.
 * Mỗi biểu đồ MỘT trục, tối đa hai chuỗi cùng đơn vị (luật dataviz).
 */
import { BatteryFull, BatteryMedium, Compass, Download, Gauge, MoveVertical, Pause, Play, Radar, Radio, Rotate3d, Satellite, Table2, Trash2, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { pageMeta } from "@/app/routes";
import { Chip, ModeBadge, PageHeader } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { TimeChart } from "@/components/telemetry/TimeChart";
import type { ChartSeries } from "@/components/telemetry/TimeChart";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { downloadText, toCsv } from "@/lib/csv";
import { NO_VALUE } from "@/lib/format";
import type { Telemetry } from "@/lib/protocol";
import type { Accent } from "@/lib/tone";
import { ACCENT_DOT, ACCENT_TEXT } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { telemetryHistory, useHistoryTick } from "@/store/history";
import { useTelemetryStore } from "@/store/telemetry";

interface ChartDef {
  title: string;
  hint: string;
  unit: string;
  icon: LucideIcon;
  /** Màu PHÂN BIỆT của biểu đồ (ô icon + nét chuỗi 1), không mang nghĩa tốt/xấu. */
  accent: Accent;
  series: ChartSeries[];
  range?: [number, number];
  digits?: number;
}

const CHARTS: ChartDef[] = [
  { title: "Độ cao", hint: "So với điểm cất cánh", unit: "m", icon: MoveVertical, accent: "teal", series: [{ label: "Độ cao", pick: (d) => d.relative_alt, slot: 1, color: "--hud-teal" }] },
  {
    title: "Tốc độ",
    hint: "Mặt đất và tốc độ leo — cùng đơn vị m/s",
    unit: "m/s",
    icon: Gauge,
    accent: "blue",
    digits: 2,
    series: [
      { label: "Mặt đất", pick: (d) => d.ground_speed, slot: 1, color: "--hud-blue" },
      { label: "Leo (+) / hạ (−)", pick: (d) => d.climb_rate, slot: 2 },
    ],
  },
  {
    title: "Tư thế",
    hint: "Nghiêng (roll) và chúc/ngóc (pitch)",
    unit: "°",
    icon: Rotate3d,
    accent: "indigo",
    series: [
      { label: "Roll", pick: (d) => d.roll, slot: 1, color: "--hud-indigo" },
      { label: "Pitch", pick: (d) => d.pitch, slot: 2 },
    ],
  },
  { title: "Hướng mũi", hint: "0° = Bắc, theo chiều kim đồng hồ", unit: "°", icon: Compass, accent: "cyan", digits: 0, range: [0, 360], series: [{ label: "Hướng", pick: (d) => d.heading, slot: 1, color: "--hud-cyan" }] },
  { title: "Điện áp pin", hint: "Pin 4S: đầy ~16.8 V", unit: "V", icon: BatteryMedium, accent: "green", digits: 2, series: [{ label: "Điện áp", pick: (d) => d.battery_voltage, slot: 1, color: "--hud-green" }] },
  { title: "Dòng pin", hint: "Trống khi mạch đo dòng không báo", unit: "A", icon: Zap, accent: "orange", series: [{ label: "Dòng", pick: (d) => d.battery_current, slot: 1, color: "--hud-orange" }] },
  { title: "Pin còn lại", hint: "Phần trăm FC ước lượng", unit: "%", icon: BatteryFull, accent: "green", digits: 0, range: [0, 100], series: [{ label: "Còn lại", pick: (d) => d.battery_remaining, slot: 1, color: "--hud-green" }] },
  { title: "GPS", hint: "Số vệ tinh nhìn thấy", unit: "vệ tinh", icon: Satellite, accent: "violet", digits: 0, series: [{ label: "Vệ tinh", pick: (d) => d.satellites, slot: 1, color: "--hud-violet" }] },
  { title: "Tuổi link", hint: "Bao lâu chưa nghe drone — trên 1000 ms là đáng lo", unit: "ms", icon: Radio, accent: "pink", digits: 0, series: [{ label: "Tuổi link", pick: (d) => d.link_age_ms, slot: 1, color: "--hud-pink" }] },
  { title: "Khoảng cách vật cản", hint: "TFmini Plus, hướng mũi", unit: "m", icon: Radar, accent: "orange", series: [{ label: "Khoảng cách", pick: (d) => d.obstacle_distance, slot: 1, color: "--hud-orange" }] },
];

/** Bảng mô tả trường — thứ tự và đơn vị theo hợp đồng Phase 05, gom theo nhóm để dễ dò. */
const FIELD_GROUPS: { title: string; accent: Accent; fields: { key: keyof Telemetry; label: string; unit: string }[] }[] = [
  {
    title: "Trạng thái",
    accent: "cyan",
    fields: [
      { key: "mode", label: "Chế độ bay", unit: "" },
      { key: "armed", label: "ARMED", unit: "" },
      { key: "connected", label: "Link còn sống", unit: "" },
      { key: "link_age_ms", label: "Tuổi link", unit: "ms" },
      { key: "ekf_ok", label: "EKF khoẻ", unit: "" },
    ],
  },
  {
    title: "Vị trí",
    accent: "teal",
    fields: [
      { key: "lat", label: "Vĩ độ", unit: "°" },
      { key: "lon", label: "Kinh độ", unit: "°" },
      { key: "relative_alt", label: "Độ cao (so với home)", unit: "m" },
      { key: "absolute_alt", label: "Độ cao (so với mực nước biển)", unit: "m" },
      { key: "home_lat", label: "Home — vĩ độ", unit: "°" },
      { key: "home_lon", label: "Home — kinh độ", unit: "°" },
    ],
  },
  {
    title: "Chuyển động · tư thế",
    accent: "blue",
    fields: [
      { key: "heading", label: "Hướng mũi", unit: "°" },
      { key: "ground_speed", label: "Tốc độ mặt đất", unit: "m/s" },
      { key: "climb_rate", label: "Tốc độ leo", unit: "m/s" },
      { key: "roll", label: "Roll", unit: "°" },
      { key: "pitch", label: "Pitch", unit: "°" },
      { key: "yaw", label: "Yaw", unit: "°" },
    ],
  },
  {
    title: "GPS",
    accent: "violet",
    fields: [
      { key: "gps_fix_type", label: "Loại fix GPS", unit: "" },
      { key: "satellites", label: "Số vệ tinh", unit: "" },
    ],
  },
  {
    title: "Pin",
    accent: "green",
    fields: [
      { key: "battery_voltage", label: "Điện áp pin", unit: "V" },
      { key: "battery_current", label: "Dòng pin", unit: "A" },
      { key: "battery_remaining", label: "Pin còn lại", unit: "%" },
    ],
  },
  {
    title: "Vật cản",
    accent: "orange",
    fields: [
      { key: "obstacle_distance", label: "Khoảng cách vật cản", unit: "m" },
      { key: "rangefinder_healthy", label: "TFmini khoẻ", unit: "" },
      { key: "avoid_state", label: "Trạng thái AVOID", unit: "" },
    ],
  },
];

const FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

function show(v: unknown): string {
  if (v === null || v === undefined) return NO_VALUE;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1000 ? 3 : 1);
  if (typeof v === "boolean") return v ? "có" : "không";
  if (Array.isArray(v)) return v.map((x) => (x == null ? "—" : Number(x).toFixed(1))).join(" · ");
  return String(v);
}

function Value({ v, unit }: { v: unknown; unit: string }) {
  if (typeof v === "boolean") {
    return (
      <Chip tone={v ? "ok" : "neutral"} size="xs">
        {v ? "có" : "không"}
      </Chip>
    );
  }
  return (
    <>
      {show(v)}
      {unit && v != null ? <span className="ml-1 text-muted-foreground">{unit}</span> : null}
    </>
  );
}

function LiveTable() {
  const t = useTelemetryStore((s) => s.telemetry);
  return (
    <Panel title="Số sống" subtitle="Mọi trường của gói telemetry mới nhất" icon={Table2} accent="slate" bodyClassName="p-0">
      {/* Cao bằng màn hình và cuộn riêng: không còn bị cắt ngang một dòng ở đáy. */}
      <div className="max-h-[calc(100dvh-13rem)] min-h-[320px] overflow-y-auto">
        <table className="w-full text-[12.5px]">
          {FIELD_GROUPS.map((g) => (
            <tbody key={g.title} className="zebra">
              <tr>
                <th colSpan={2} className="sticky top-0 z-10 bg-card/95 px-3 pt-2.5 pb-1 text-left backdrop-blur">
                  <span className={cn("inline-flex items-center gap-1.5 eyebrow text-[10px]", ACCENT_TEXT[g.accent])}>
                    <span className={cn("size-1.5 rounded-full", ACCENT_DOT[g.accent])} aria-hidden />
                    {g.title}
                  </span>
                </th>
              </tr>
              {g.fields.map((f) => (
                <tr key={f.key} className="hover:bg-foreground/4">
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {f.label}
                    <span className="ml-1.5 font-mono text-[10px] opacity-60">{f.key}</span>
                  </td>
                  <td className="num px-3 py-1.5 text-right whitespace-nowrap">
                    {f.key === "mode" ? <ModeBadge mode={t?.mode} size="xs" /> : <Value v={t?.[f.key]} unit={f.unit} />}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Panel>
  );
}

function exportCsv(windowSec: number): void {
  const samples = telemetryHistory.samples(Date.now() - windowSec * 1000);
  const keys = FIELDS.map((f) => f.key);
  const rows = samples.map((s) => [new Date(s.t).toISOString(), ...keys.map((k) => s.d[k] as unknown)]);
  downloadText(`iot-cv-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, toCsv(["time", ...keys], rows), "text/csv");
}

const WINDOWS = [
  { value: "60", label: "1 phút" },
  { value: "300", label: "5 phút" },
  { value: "600", label: "10 phút" },
  { value: "900", label: "15 phút" },
] as const;

export default function TelemetryPage() {
  const [win, setWin] = useState<(typeof WINDOWS)[number]["value"]>("300");
  const [paused, setPaused] = useState(false);
  useHistoryTick(1000); // render lại mỗi giây khi có mẫu mới → số mẫu dưới đây luôn mới
  const count = telemetryHistory.size;
  const windowSec = Number(win);

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        {...pageMeta("/telemetry")}
        eyebrow="Giám sát · telemetry"
        title="Dữ liệu bay"
        description={`Biểu đồ thời gian thực, rê chuột để đọc từng thời điểm. Đang giữ ${count} mẫu trong trình duyệt (tối đa 15 phút).`}
        actions={
          <>
            <Segmented<(typeof WINDOWS)[number]["value"]> label="Cửa sổ thời gian" value={win} onChange={setWin} options={WINDOWS} />
            <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? "Chạy tiếp" : "Tạm dừng"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(windowSec)} disabled={count === 0}>
              <Download aria-hidden /> Xuất CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => telemetryHistory.clear()} disabled={count === 0} title="Chỉ xoá trong trình duyệt này">
              <Trash2 aria-hidden /> Xoá
            </Button>
          </>
        }
      />
      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-3 lg:grid-cols-2">
          {CHARTS.map((c) => (
            <Panel key={c.title} title={c.title} subtitle={c.hint} icon={c.icon} accent={c.accent} bodyClassName="px-2 pt-1 pb-2">
              <TimeChart series={c.series} unit={c.unit} windowSec={windowSec} paused={paused} range={c.range} digits={c.digits} label={`Biểu đồ ${c.title}`} />
            </Panel>
          ))}
        </div>
        <div className="2xl:sticky 2xl:top-28 2xl:self-start">
          <LiveTable />
        </div>
      </div>
    </div>
  );
}
