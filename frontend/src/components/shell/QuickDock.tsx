/**
 * Ba lệnh thoát hiểm HOLD / RTL / LAND — có ở MỌI trang trừ trang Bay (trang Bay
 * đã có đủ nút trong panel Chế độ bay; hai bộ nút cùng chỗ là thừa).
 *
 * Người vận hành đang xem biểu đồ hay nhật ký vẫn phải dừng được drone bằng MỘT
 * cú bấm. Chỉ ba lệnh DỪNG, không hỏi xác nhận.
 *
 * Hai chỗ đặt, chỉ một chỗ được render (`useMediaQuery`):
 *  - màn ≥ md: nằm trong dải trạng thái của header (`EmergencyActions inline`) —
 *    luôn thấy, không bao giờ đè lên nội dung trang như thanh nổi cũ;
 *  - màn hẹp: thanh nổi giữa đáy màn hình (`QuickDock`).
 * `data-testid` (`dock-*`) khác trang Bay (`cmd-*`) để locator E2E không trùng.
 */
import { Loader2 } from "lucide-react";

import { IconHold, IconLand, IconReturnHome } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { sendHold, sendLand, sendRtl } from "@/hooks/flightCommands";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useShowsEmergency } from "@/hooks/useShowsEmergency";
import { cn } from "@/lib/utils";
import { useControlStore } from "@/store/control";
import { useTelemetryStore } from "@/store/telemetry";

const ACTIONS = [
  { key: "hold", label: "HOLD", hint: "Đứng yên tại chỗ (LOITER) · phím H", icon: IconHold, run: sendHold },
  { key: "rtl", label: "RTL", hint: "Bay về điểm cất cánh rồi hạ", icon: IconReturnHome, run: sendRtl },
  { key: "land", label: "LAND", hint: "Hạ cánh thẳng xuống tại chỗ", icon: IconLand, run: sendLand },
] as const;

export function EmergencyActions({ inline = false }: { inline?: boolean }) {
  const pending = useControlStore((s) => s.pending);
  const armed = useTelemetryStore((s) => s.telemetry?.armed === true);
  const waiting = new Set(Object.values(pending).map((p) => p.target));

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        inline
          ? "shrink-0 rounded-xl border border-border bg-foreground/[0.03] p-0.5"
          : "glass-fixed rounded-2xl p-1.5 shadow-[0_18px_40px_-18px] shadow-(color:--shadow-tint)",
        armed && "border-hud-red/45 ring-1 ring-hud-red/30",
      )}
      role="toolbar"
      aria-label="Lệnh thoát hiểm"
      data-testid="quick-dock"
    >
      <span
        className={cn("eyebrow px-1.5 text-[9.5px]", armed ? "text-hud-red" : "", inline ? "hidden xl:block" : "hidden min-[420px]:block")}
        title={armed ? "Drone đang ARMED" : undefined}
      >
        {armed ? "Đang bay" : "Thoát hiểm"}
      </span>
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Tooltip key={a.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => a.run()}
                data-testid={`dock-${a.key}`}
                className={cn(
                  "btn-raised flex items-center gap-1.5 rounded-lg border border-hud-cyan/35 bg-linear-to-b from-hud-cyan/18 to-hud-cyan/8 font-mono font-semibold text-hud-cyan transition-colors hover:from-hud-cyan/28 hover:to-hud-cyan/14 active:translate-y-px",
                  inline ? "h-7 px-2 text-[11px]" : "h-10 px-3.5 text-xs",
                )}
              >
                {waiting.has(a.key) ? <Loader2 className="size-3.5 animate-spin" aria-label="Đang chờ FC" /> : <Icon className="size-3.5" />}
                {a.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side={inline ? "bottom" : "top"}>{a.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Thanh nổi — CHỈ ở màn hẹp; màn rộng thì `AppHeader` đặt `EmergencyActions` trong header. */
export function QuickDock() {
  const shows = useShowsEmergency();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  if (!shows || desktop) return null;
  return (
    <div className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3">
      <EmergencyActions />
    </div>
  );
}
