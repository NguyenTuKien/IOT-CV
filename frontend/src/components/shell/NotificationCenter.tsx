/**
 * Trung tâm thông báo: tấm trượt từ phải, liệt kê cảnh báo và lỗi (bỏ `info`).
 * Mở ra = đánh dấu đã xem tới sự kiện mới nhất → chấm trên chuông tắt.
 * Toàn bộ nhật ký (kể cả `info`, lọc, xuất file) ở trang Nhật ký.
 */
import { BellOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { Chip, EmptyState } from "@/components/kit";
import { DialogDescription, DialogTitle, Dialog, SheetContent } from "@/components/ui/dialog";
import { groupRepeats, hintFor } from "@/lib/eventGroups";
import { LEVEL_STYLE, sourceAccent, sourceLabel } from "@/lib/eventStyle";
import { ACCENT_SOFT } from "@/lib/tone";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";
import { useUiStore } from "@/store/ui";

export function NotificationCenter() {
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotifications);
  const markSeen = useUiStore((s) => s.markSeen);
  const seenUntil = useUiStore((s) => s.seenUntil);
  const events = useTelemetryStore((s) => s.events);
  const alerts = useMemo(() => groupRepeats(events.filter((e) => e.level !== "info")).slice(0, 60), [events]);
  // Mốc đã xem TRƯỚC khi mở lần này — để tô dòng mới. Chụp đúng lượt render
  // mở hộp (mẫu "điều chỉnh state khi prop đổi"), trước khi effect đánh dấu đã xem.
  const [opened, setOpened] = useState({ open, seen: seenUntil });
  if (opened.open !== open) setOpened({ open, seen: seenUntil });
  const seenBefore = opened.seen;

  useEffect(() => {
    if (open && events[0]) markSeen(events[0].ts);
  }, [open, events, markSeen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <SheetContent data-testid="notification-center">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="font-display text-base font-semibold">Thông báo</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Cảnh báo và lỗi gần nhất của backend và web.</DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <EmptyState icon={BellOff} title="Không có cảnh báo nào">
              Mọi sự kiện mức thông tin vẫn nằm trong trang Nhật ký.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-1">
              {alerts.map(({ entry: e, count, firstTs }) => {
                const { icon: Icon, accent } = LEVEL_STYLE[e.level];
                const fresh = e.ts > seenBefore;
                const hint = hintFor(e.message);
                return (
                  <li
                    key={e.key}
                    className={cn("relative flex gap-3 rounded-lg border px-3 py-2.5", fresh ? "border-foreground/10 bg-foreground/5" : "border-transparent")}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", ACCENT_SOFT[accent])}>
                      <Icon className="size-4" aria-label={e.level} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug font-medium">{e.message}</p>
                      {hint ? <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                        <Chip tone={sourceAccent(e.source)} size="xs" title={`nguồn: ${e.source} · code: ${e.code}`}>
                          {sourceLabel(e.source)}
                        </Chip>
                        {count > 1 ? `×${count} · ${formatClock(firstTs)}–${formatClock(e.ts)}` : formatClock(e.ts)}
                      </p>
                    </div>
                    {fresh ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-hud-cyan" aria-label="mới" /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-3">
          <Link
            to="/logs"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center justify-center rounded-lg bg-foreground/5 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            Mở trang Nhật ký
          </Link>
        </div>
      </SheetContent>
    </Dialog>
  );
}
