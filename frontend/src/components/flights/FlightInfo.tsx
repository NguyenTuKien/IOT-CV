/**
 * Tóm tắt một chuyến (số liệu trong khoảng ARM → DISARM) và danh sách sự kiện bấm-để-tua.
 */
import {
  BatteryMedium,
  Camera,
  Clock,
  Database,
  FileVideo,
  Mountain,
  PlaneTakeoff,
  Radio,
  Route,
  Timer,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import type { ComponentType } from "react";

import { Chip, KeyValue, KeyValueList } from "@/components/kit";
import { LEVEL_STYLE, sourceAccent, sourceLabel } from "@/lib/eventStyle";
import type { EventLevel } from "@/lib/eventStyle";
import { clockTime, formatDuration } from "@/lib/flights";
import type { FlightDetail, FlightSummary } from "@/lib/flights";
import type { Accent } from "@/lib/tone";
import { ACCENT_SOFT } from "@/lib/tone";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, { label: string; accent: Accent; icon: ComponentType<{ className?: string }> }> = {
  dataflash: { label: "log FC", accent: "blue", icon: Database },
  tlog: { label: "tlog laptop", accent: "indigo", icon: Radio },
  video: { label: "video", accent: "violet", icon: FileVideo },
};

/** Mức của `backend/flights` ("warning") → mức chung của web ("warn"). */
const LEVEL: Record<string, EventLevel> = { error: "error", warning: "warn", info: "info" };

function num(v: number | null | undefined, unit: string, digits = 1): string {
  return v == null ? "—" : `${v.toFixed(digits)} ${unit}`;
}

export function SourceTags({ summary }: { summary: FlightSummary }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {summary.sources.map((s) => {
        const src = SOURCE[s];
        return (
          <Chip key={s} tone={src?.accent ?? "slate"} size="xs" icon={src?.icon}>
            {src?.label ?? s}
          </Chip>
        );
      })}
    </span>
  );
}

export function FlightSummaryList({ flight }: { flight: FlightDetail }) {
  const s = flight.summary;
  const linkTone = s.link_loss_pct == null ? undefined : s.link_loss_pct > 10 ? "danger" : s.link_loss_pct > 3 ? "warn" : "ok";
  const camTone = s.video_fps == null ? undefined : s.video_fps < 3 ? "danger" : s.video_fps < 6 ? "warn" : "ok";
  return (
    <KeyValueList>
      <KeyValue icon={Timer} accent="slate" label="ARM → DISARM" value={`${clockTime(s.start)} → ${clockTime(s.end)} (${formatDuration(s.duration_s)})`} />
      <KeyValue icon={PlaneTakeoff} accent="green" label="Cất cánh" value={s.took_off ? "có" : "không (chỉ ARM trên đất)"} tone={s.took_off ? undefined : "warn"} />
      <KeyValue
        icon={Mountain}
        accent="blue"
        label="Cao nhất / xa nhất"
        sub="so với home"
        value={`${num(s.max_alt_m, "m")} / ${num(s.max_dist_m, "m")}`}
      />
      <KeyValue icon={Route} accent="teal" label="Quãng đường" sub="ngang, lúc cao trên 0,5 m" value={num(s.path_m, "m", 0)} />
      <KeyValue
        icon={BatteryMedium}
        accent="green"
        label="Pin"
        value={`${num(s.battery_start_v, "V", 2)} → ${num(s.battery_min_v, "V", 2)} · ${s.used_mah == null ? "—" : `${s.used_mah} mAh`}`}
      />
      <KeyValue icon={Wifi} accent="orange" label="Mất gói link" value={num(s.link_loss_pct, "%")} tone={linkTone} hint="gói MAVLink của FC không tới laptop (tlog)" />
      <KeyValue
        icon={Camera}
        accent="violet"
        label="Camera về laptop"
        value={s.video_fps == null ? "—" : `${s.video_fps.toFixed(1)} khung/s · ${num(s.video_coverage_pct, "% số giây có hình", 0)}`}
        tone={camTone}
      />
      <KeyValue icon={TriangleAlert} accent="amber" label="Cảnh báo / lỗi" value={String(s.warnings)} tone={s.warnings ? "warn" : undefined} />
      <KeyValue
        icon={Clock}
        accent="slate"
        label="Đồng hồ laptop"
        value={flight.clock_offset_s == null ? "—" : `chậm ${flight.clock_offset_s.toFixed(1)} s, đã chỉnh`}
        hint={flight.clock_note ? `đo bằng: ${flight.clock_note}` : undefined}
      />
      <KeyValue icon={Database} accent="indigo" label="Nguồn" value={<SourceTags summary={s} />} mono={false} />
    </KeyValueList>
  );
}

export function FlightEvents({ flight, cursor, onSeek }: { flight: FlightDetail; cursor: number; onSeek(t: number): void }) {
  const current = flight.events.reduce((k, e, i) => (e.t <= cursor ? i : k), -1);
  return (
    <ol className="zebra text-sm" data-testid="flight-events">
      {flight.events.map((e, i) => {
        const level = LEVEL_STYLE[LEVEL[e.level] ?? "info"];
        const Icon = level.icon;
        const passed = e.t <= cursor;
        return (
          <li key={`${e.t}-${i}`}>
            <button
              type="button"
              onClick={() => onSeek(Math.max(0, e.t - 1))}
              aria-current={i === current ? "true" : undefined}
              className={cn(
                "relative grid w-full grid-cols-[3.6rem_auto_minmax(0,1fr)_auto] items-start gap-2.5 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/70",
                i === current && "bg-primary/10",
                !passed && "opacity-70",
              )}
            >
              {i === current ? <span className="absolute inset-y-1 left-0 w-0.75 rounded-r bg-primary" aria-hidden /> : null}
              {/* Một hàng như dòng log: giờ | mức | nội dung | nguồn. */}
              <span className="pt-[3px] font-mono text-[11px] text-muted-foreground tabular-nums">{clockTime(flight.window_start + e.t)}</span>
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", ACCENT_SOFT[level.accent])} title={level.label}>
                <Icon className="size-3" />
              </span>
              <span className={cn("min-w-0 pt-px text-[13px] leading-snug wrap-anywhere", e.level !== "info" && "font-medium")}>{e.text}</span>
              <Chip tone={sourceAccent(e.source)} size="xs" title={`Nguồn: ${e.source}`} className="mt-px">
                {sourceLabel(e.source)}
              </Chip>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
