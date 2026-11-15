/**
 * Một dòng của bảng mission, vẽ như một mốc trên TRỤC THỜI GIAN: nút tròn đánh số thứ tự bay,
 * đường dọc nối các mốc, thẻ bên phải mang lệnh + số đo. Bốn loại dòng dùng chung khung này,
 * mỗi loại một màu + icon (nhìn là biết lệnh gì, không phải đọc chữ):
 *  - CẤT CÁNH (đầu, xanh lá) và VỀ NHÀ / HẠ CÁNH (cuối, cam / tím): cố định, không xoá, không đổi chỗ;
 *  - WAYPOINT (xanh dương): đổi thứ tự bằng ▲▼, xoá bằng ✕.
 *
 * `seq` do bảng truyền vào, tính từ vị trí — không lưu, nên không bao giờ nhảy cóc.
 */
import { ArrowDown, ArrowUp, House, Lock, MapPin, PlaneLanding, PlaneTakeoff, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ACCENT_SOFT, ACCENT_TILE } from "@/lib/tone";
import type { Accent } from "@/lib/tone";
import { cn } from "@/lib/utils";

export type RowKind = "takeoff" | "waypoint" | "rtl" | "land";

const KIND: Record<RowKind, { accent: Accent; icon: LucideIcon }> = {
  takeoff: { accent: "green", icon: PlaneTakeoff },
  waypoint: { accent: "blue", icon: MapPin },
  rtl: { accent: "orange", icon: House },
  land: { accent: "violet", icon: PlaneLanding },
};

interface RowShellProps {
  seq: number;
  kind: RowKind;
  title: ReactNode;
  detail?: ReactNode;
  /** Chip số đo nhỏ cạnh tên lệnh (chặng, khoảng cách tới home, thời gian dừng). */
  meta?: ReactNode;
  alt?: ReactNode;
  actions?: ReactNode;
  invalid?: boolean;
  fixed?: boolean;
  /** Mốc đầu / cuối: đường nối chỉ vẽ một nửa. */
  first?: boolean;
  last?: boolean;
  testId?: string;
}

export function RowShell({ seq, kind, title, detail, meta, alt, actions, invalid, fixed, first, last, testId }: RowShellProps) {
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <li
      data-testid={testId}
      data-seq={seq}
      data-kind={kind}
      data-invalid={invalid || undefined}
      className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2"
    >
      <div className="relative flex justify-center" aria-hidden>
        <span className={cn("absolute w-px bg-border", first ? "top-5 bottom-0" : last ? "top-0 h-5" : "inset-y-0")} />
        <span className="relative z-[1] mt-1.5 rounded-full bg-panel-strong">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full bg-linear-to-br font-mono text-[11px] font-bold ring-1 ring-inset",
              invalid ? "from-hud-red/30 to-hud-red/10 text-hud-red ring-hud-red/55" : ACCENT_TILE[k.accent],
            )}
          >
            {seq}
          </span>
        </span>
      </div>
      <div
        className={cn(
          "mb-1.5 min-w-0 rounded-lg border px-2.5 py-2 transition-colors",
          fixed ? "border-border bg-foreground/[0.025]" : "border-border/70 bg-panel-strong/50 hover:border-foreground/20",
          invalid && "border-hud-red/60 bg-hud-red/[0.07]",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide", ACCENT_SOFT[k.accent])}>
            <Icon className="size-3 shrink-0" aria-hidden />
            {title}
          </span>
          {fixed ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Cố định" /> : null}
          {meta}
          {actions ? <div className="ml-auto flex items-center gap-0.5">{actions}</div> : null}
        </div>
        {detail || alt ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            {detail ? <p className="min-w-0 font-mono text-[11px] leading-snug text-muted-foreground tabular-nums wrap-anywhere">{detail}</p> : <span />}
            {alt ? <div className="ml-auto">{alt}</div> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

interface WaypointActionsProps {
  isFirst: boolean;
  isLast: boolean;
  onMove(dir: "up" | "down"): void;
  onRemove(): void;
  seq: number;
}

export function WaypointActions({ isFirst, isLast, onMove, onRemove, seq }: WaypointActionsProps) {
  return (
    <>
      <Button size="icon-xs" variant="ghost" disabled={isFirst} aria-label={`Đưa WP${seq} lên`} onClick={() => onMove("up")}>
        <ArrowUp />
      </Button>
      <Button size="icon-xs" variant="ghost" disabled={isLast} aria-label={`Đưa WP${seq} xuống`} onClick={() => onMove("down")}>
        <ArrowDown />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-hud-red hover:text-hud-red"
        aria-label={`Xoá WP${seq}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </>
  );
}
