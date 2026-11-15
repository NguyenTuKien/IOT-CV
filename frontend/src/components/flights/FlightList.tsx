/**
 * Danh sách chuyến, gom theo ngày, chuyến mới trước. Bấm một chuyến để phát lại.
 *
 * Chuỗi mode hiện bằng chip màu (cùng màu dải mode ở thanh phát và chip mode ở header)
 * và XUỐNG DÒNG khi dài — không cắt thành "…": mode cuối thường là thứ cần biết nhất
 * (chuyến kết thúc bằng RTL hay LAND).
 */
import { ArrowRight, MoveHorizontal, MoveVertical, Plane, PlaneLanding, TriangleAlert } from "lucide-react";
import { Fragment } from "react";

import { Chip, ModeBadge } from "@/components/kit";
import { clockTime, formatDuration, groupByDay } from "@/lib/flights";
import type { FlightSummary } from "@/lib/flights";
import { cn } from "@/lib/utils";

function ModeChain({ modes, tookOff }: { modes: readonly string[]; tookOff: boolean }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label={`Chế độ bay: ${modes.join(tookOff ? " → " : ", ")}`}>
      {modes.map((m, i) => (
        <Fragment key={`${m}-${i}`}>
          {i > 0 && tookOff ? <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden /> : null}
          <ModeBadge mode={m} size="xs" title={`Chế độ ${m}`} />
        </Fragment>
      ))}
    </div>
  );
}

export function FlightList({ flights, selected, onSelect }: { flights: readonly FlightSummary[]; selected: string | null; onSelect(id: string): void }) {
  const days = groupByDay(flights);
  return (
    <div className="space-y-3" data-testid="flight-list">
      {days.map((day) => (
        <section key={day.key}>
          <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md bg-card/95 px-2 py-1.5 text-xs font-semibold text-foreground/80 backdrop-blur">
            <span className="capitalize">{day.label}</span>
            <Chip tone="indigo" size="xs">
              {day.flights.length} chuyến
            </Chip>
          </h3>
          <ul className="mt-1 space-y-1.5">
            {day.flights.map((f) => {
              const active = f.id === selected;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(f.id)}
                    data-testid={`flight-item-${f.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "relative w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors",
                      active ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)_inset]" : "border-border/60 bg-foreground/[0.015] hover:border-border hover:bg-muted/60",
                    )}
                  >
                    {active ? <span className="absolute inset-y-1.5 left-0 w-0.75 rounded-r bg-primary" aria-hidden /> : null}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md",
                          f.took_off ? "bg-hud-green/15 text-hud-green" : "bg-muted text-muted-foreground",
                        )}
                        title={f.took_off ? "Có cất cánh" : "ARM nhưng không cất cánh"}
                      >
                        {f.took_off ? <Plane className="size-3.5" /> : <PlaneLanding className="size-3.5" />}
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{clockTime(f.start, false)}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums" title="Thời gian ARM → DISARM">
                        {formatDuration(f.duration_s)}
                      </span>
                      {f.warnings ? (
                        <Chip tone="warn" size="xs" icon={TriangleAlert} className="ml-auto" title="Số cảnh báo / lỗi trong chuyến">
                          {f.warnings}
                        </Chip>
                      ) : null}
                    </div>
                    {f.took_off ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Chip tone="teal" size="xs" icon={MoveVertical} mono title="Cao nhất so với home">
                          {f.max_alt_m?.toFixed(0) ?? "—"} m
                        </Chip>
                        <Chip tone="blue" size="xs" icon={MoveHorizontal} mono title="Xa home nhất">
                          {f.max_dist_m?.toFixed(0) ?? "—"} m
                        </Chip>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-muted-foreground">Không cất cánh</div>
                    )}
                    <ModeChain modes={f.modes} tookOff={f.took_off} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
