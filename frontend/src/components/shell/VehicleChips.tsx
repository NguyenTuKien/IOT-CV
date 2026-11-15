/**
 * Trạng thái sống còn của drone, gọn trong vài "chip" — có mặt ở mọi trang (thanh
 * trên cùng). Đi trang nào cũng phải thấy: đang ở mode nào, có ARMED không, pin
 * còn bao nhiêu, GPS ra sao.
 *
 * Mỗi chip tự subscribe đúng lát cắt nó cần (8 Hz), và hiện `—` khi chưa biết.
 */
import { BatteryFull, BatteryLow, BatteryMedium } from "lucide-react";
import type { ReactNode } from "react";

import { IconSatellite } from "@/components/icons";
import { ModeBadge } from "@/components/kit";
import { NO_VALUE, batteryTone, formatNumber, hasValue } from "@/lib/format";
import { GPS_FIX_3D, GPS_FIX_LABEL } from "@/lib/protocol";
import { TONE_CHIP } from "@/lib/tone";
import type { Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

function Chip({ tone, title, children, className, testId }: { tone: Tone; title: string; children: ReactNode; className?: string; testId?: string }) {
  return (
    <span
      title={title}
      data-testid={testId}
      data-tone={tone}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11.5px] font-semibold tracking-wide whitespace-nowrap", TONE_CHIP[tone], className)}
    >
      {children}
    </span>
  );
}

export function ModeChip() {
  const mode = useTelemetryStore((s) => s.telemetry?.mode);
  // Màu riêng từng mode (`lib/modes.ts`) — cùng màu với nút mode và trang Lịch sử bay.
  return <ModeBadge mode={mode} size="md" title="Chế độ bay hiện tại (từ telemetry)" testId="chip-mode" />;
}

export function ArmedChip() {
  const armed = useTelemetryStore((s) => s.telemetry?.armed);
  const known = armed !== undefined;
  return (
    <Chip
      tone={known && armed ? "danger" : "neutral"}
      title={armed ? "Motor đã được phép quay — đang nguy hiểm" : "Motor bị khoá"}
      // ARMED là thứ phải nổi nhất dải trạng thái: nền đỏ đặc, nhấp nháy.
      className={cn(armed && "border-hud-red bg-hud-red text-background caution-pulse")}
      testId="chip-armed"
    >
      <span className={cn("size-1.5 rounded-full", armed ? "bg-background" : "bg-muted-foreground/60")} aria-hidden />
      {known ? (armed ? "ARMED" : "DISARMED") : NO_VALUE}
    </Chip>
  );
}

export function BatteryChip() {
  const pct = useTelemetryStore((s) => s.telemetry?.battery_remaining);
  const volt = useTelemetryStore((s) => s.telemetry?.battery_voltage);
  const tone = batteryTone(pct);
  const Icon = !hasValue(pct) ? BatteryMedium : pct < 25 ? BatteryLow : pct > 70 ? BatteryFull : BatteryMedium;
  return (
    <Chip tone={tone} title={`Pin: ${formatNumber(pct, 0, "%")} · ${formatNumber(volt, 1, "V")}`} testId="chip-battery">
      <Icon className="size-3.5" aria-hidden />
      {formatNumber(pct, 0, "%")}
      <span className="hidden font-normal opacity-75 2xl:inline">{formatNumber(volt, 1, "V")}</span>
    </Chip>
  );
}

export function GpsChip() {
  const fix = useTelemetryStore((s) => s.telemetry?.gps_fix_type);
  const sats = useTelemetryStore((s) => s.telemetry?.satellites);
  const tone: Tone = !hasValue(fix) ? "neutral" : fix < GPS_FIX_3D ? "warn" : "ok";
  const label = hasValue(fix) ? (GPS_FIX_LABEL[fix as keyof typeof GPS_FIX_LABEL] ?? `fix ${fix}`) : NO_VALUE;
  return (
    <Chip tone={tone} title={`GPS: ${label} · ${hasValue(sats) ? `${sats} vệ tinh` : "—"}`} testId="chip-gps">
      <IconSatellite className="size-3.5" />
      {label}
      <span className="font-normal opacity-75">{hasValue(sats) ? sats : NO_VALUE}</span>
    </Chip>
  );
}
