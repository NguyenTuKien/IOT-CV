/**
 * Nhật ký sự kiện: `event` của backend + sự kiện của chính web (mất/nối lại
 * socket, message hỏng). Mới nhất ở trên, tối đa 200 dòng, lọc nhanh theo mức.
 *
 * Giờ lấy theo lúc sự kiện XẢY RA (`data.ts`), không phải lúc gửi — backend
 * phát lại sự kiện cũ cho tab mới mở. `code` chỉ nằm trong tooltip: nó dành
 * cho người sửa lỗi, không cho người dùng.
 *
 * Màu: MỨC (cyan/vàng/đỏ) ở vạch trái + icon; NGUỒN (mavlink, mission…) ở chip
 * — bảng màu chung ở `lib/eventStyle.ts`.
 */
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router";

import { IconLog } from "@/components/icons";
import { Chip } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { groupRepeats, hintFor } from "@/lib/eventGroups";
import type { EventGroup } from "@/lib/eventGroups";
import { LEVEL_STYLE, sourceAccent, sourceLabel } from "@/lib/eventStyle";
import type { EventLevel } from "@/lib/eventStyle";
import { formatClock } from "@/lib/format";
import { EVENT_LEVELS } from "@/lib/protocol";
import { ACCENT_DOT, ACCENT_SOFT, ACCENT_TEXT } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

function LevelFilter({ active, counts, onToggle }: { active: Set<EventLevel>; counts: Record<EventLevel, number>; onToggle(level: EventLevel): void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Lọc theo mức">
      {EVENT_LEVELS.map((level) => {
        const { icon: Icon, accent, label } = LEVEL_STYLE[level];
        const on = active.has(level);
        return (
          <button
            key={level}
            type="button"
            onClick={() => onToggle(level)}
            aria-pressed={on}
            title={`${on ? "Ẩn" : "Hiện"} mức "${label}"`}
            className={cn(
              "flex h-6 items-center gap-1 rounded-md border px-1.5 font-mono text-[11px] font-semibold transition-all",
              on ? ACCENT_SOFT[accent] : "border-border text-muted-foreground opacity-50 hover:opacity-80",
            )}
          >
            <Icon className="size-3" aria-hidden />
            <span className="tabular-nums">{counts[level]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Row({ group: { entry: e, count, firstTs } }: { group: EventGroup }) {
  const { icon: Icon, accent } = LEVEL_STYLE[e.level];
  const hint = hintFor(e.message);
  return (
    <li className="relative flex items-start gap-2 py-1 pr-2.5 pl-3.5 transition-colors hover:bg-foreground/5" data-code={e.code} data-level={e.level}>
      <span className={cn("absolute inset-y-1 left-1 w-[3px] rounded-full", ACCENT_DOT[accent], e.level === "info" && "opacity-45")} aria-hidden />
      {/* Một hàng như dòng log: giờ | mức | nội dung | nguồn — mắt dò theo cột giờ, không theo chip. */}
      <span className="w-[3.4rem] shrink-0 pt-[3px] font-mono text-[11px] leading-none text-muted-foreground tabular-nums">{formatClock(e.ts)}</span>
      <Icon className={cn("mt-[1px] size-3.5 shrink-0", ACCENT_TEXT[accent])} aria-label={e.level} />
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[12.5px] leading-snug", e.level === "info" ? "text-foreground/90" : "font-medium text-foreground")}>
              {e.message}
              {count > 1 ? (
                <span className="ml-1.5 inline-flex rounded bg-foreground/8 px-1 align-[1px] font-mono text-[10.5px] text-muted-foreground">
                  ×{count} từ {formatClock(firstTs)}
                </span>
              ) : null}
            </p>
            {hint ? <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{hint}</p> : null}
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{e.code}</TooltipContent>
      </Tooltip>
      <Chip tone={sourceAccent(e.source)} size="xs" title={`nguồn: ${e.source}`} className="mt-px shrink-0">
        {sourceLabel(e.source)}
      </Chip>
    </li>
  );
}

export function EventLog({ style, className, showLink = false }: { style?: CSSProperties; className?: string; showLink?: boolean }) {
  const events = useTelemetryStore((s) => s.events);
  const [active, setActive] = useState<Set<EventLevel>>(() => new Set(EVENT_LEVELS));

  const shown = useMemo(() => events.filter((e) => active.has(e.level)), [events, active]);
  const groups = useMemo(() => groupRepeats(shown), [shown]);
  const counts = useMemo(() => {
    const c: Record<EventLevel, number> = { info: 0, warn: 0, error: 0 };
    for (const e of events) c[e.level] += 1;
    return c;
  }, [events]);

  const toggle = (level: EventLevel) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  return (
    <Panel
      title="Nhật ký sự kiện"
      subtitle={`${shown.length}/${events.length} sự kiện · mới nhất ở trên`}
      icon={IconLog}
      accent="indigo"
      style={style}
      className={className}
      testId="event-log"
      actions={
        <>
          <LevelFilter active={active} counts={counts} onToggle={toggle} />
          {showLink ? (
            <Link
              to="/logs"
              className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              title="Mở trang Nhật ký: lọc theo nguồn, tìm kiếm, xuất file"
            >
              Tất cả <ArrowUpRight className="size-3" />
            </Link>
          ) : null}
        </>
      }
    >
      <ScrollArea className="h-full">
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {events.length === 0 ? "Chưa có sự kiện nào." : "Không có sự kiện nào ở mức đang chọn."}
          </p>
        ) : (
          <ul className="zebra flex flex-col py-1">
            {groups.map((g) => (
              <Row key={g.entry.key} group={g} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </Panel>
  );
}
