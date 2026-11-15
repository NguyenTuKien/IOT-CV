/**
 * Hiển thị kết quả kiểm tra sẵn sàng bay: dải kết luận + danh sách ô kiểm.
 * Dùng ở trang Tổng quan (gọn) và trang Kiểm tra trước bay (đủ).
 *
 * Mỗi ô: icon trạng thái trong ô màu + chip "đạt / không đạt / lưu ý / chưa biết". Ô
 * BẮT BUỘC không đạt có vạch đỏ bên trái — mắt tìm ra ngay ô đang chặn bay.
 */
import { CircleCheck, CircleDashed, CircleHelp, CircleX, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Chip } from "@/components/kit";
import type { AutoCheck, CheckState, Verdict } from "@/lib/preflight";
import type { Accent } from "@/lib/tone";
import { ACCENT_DOT, ACCENT_SOFT } from "@/lib/tone";
import { cn } from "@/lib/utils";

export const VERDICT_TEXT: Record<Verdict, { title: string; detail: string; cls: string; icon: LucideIcon }> = {
  go: {
    title: "SẴN SÀNG",
    detail: "Mọi ô tự động đều đạt. Vẫn phải tự xác nhận danh sách thủ công.",
    cls: "border-hud-green/45 bg-hud-green/10 text-hud-green",
    icon: ShieldCheck,
  },
  caution: {
    title: "SẴN SÀNG · CÓ LƯU Ý",
    detail: "Các ô bắt buộc đạt, còn vài lưu ý màu vàng.",
    cls: "border-hud-amber/50 bg-hud-amber/10 text-hud-amber",
    icon: TriangleAlert,
  },
  nogo: {
    title: "CHƯA ĐƯỢC BAY",
    detail: "Có ô bắt buộc chưa đạt — sửa nguyên nhân trước.",
    cls: "border-hud-red/55 bg-hud-red/12 text-hud-red",
    icon: ShieldAlert,
  },
  unknown: {
    title: "CHƯA ĐỦ DỮ LIỆU",
    detail: "Chưa có telemetry để kết luận. Chưa biết ≠ ổn.",
    cls: "border-border bg-foreground/5 text-muted-foreground",
    icon: CircleHelp,
  },
};

const STATE: Record<CheckState, { icon: LucideIcon; accent: Accent; label: string }> = {
  pass: { icon: CircleCheck, accent: "green", label: "đạt" },
  fail: { icon: CircleX, accent: "red", label: "không đạt" },
  warn: { icon: TriangleAlert, accent: "amber", label: "lưu ý" },
  unknown: { icon: CircleDashed, accent: "slate", label: "chưa biết" },
};

export function VerdictBanner({ verdict, checks, compact }: { verdict: Verdict; checks?: readonly AutoCheck[]; compact?: boolean }) {
  const v = VERDICT_TEXT[verdict];
  const Icon = v.icon;
  const passed = checks?.filter((c) => c.state === "pass").length;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4", compact ? "py-2.5" : "py-3.5", v.cls)} data-testid="preflight-verdict" data-verdict={verdict}>
      <Icon className={cn("shrink-0", compact ? "size-6" : "size-8")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("font-display font-semibold tracking-[0.08em]", compact ? "text-base" : "text-xl")}>{v.title}</p>
        <p className="text-xs opacity-85">{v.detail}</p>
      </div>
      {checks ? (
        <span className="num shrink-0 text-right leading-none" title="Số ô tự động đạt">
          <span className={cn("font-semibold", compact ? "text-lg" : "text-2xl")}>{passed}</span>
          <span className="text-xs opacity-70">/{checks.length}</span>
        </span>
      ) : null}
    </div>
  );
}

export function CheckRows({ checks, compact }: { checks: readonly AutoCheck[]; compact?: boolean }) {
  return (
    <ul className={cn("zebra overflow-hidden rounded-lg", !compact && "border border-border/60")}>
      {checks.map((c) => {
        const s = STATE[c.state];
        const Icon = s.icon;
        const blockingFail = c.blocking && c.state === "fail";
        return (
          <li
            key={c.id}
            className={cn("relative flex items-start gap-3 px-2.5", compact ? "py-1.5" : "py-2.5")}
            data-testid={`check-${c.id}`}
            data-state={c.state}
          >
            {c.state === "fail" || c.state === "warn" ? (
              <span className={cn("absolute inset-y-1 left-0 w-[3px] rounded-r-full", ACCENT_DOT[s.accent], !blockingFail && "opacity-60")} aria-hidden />
            ) : null}
            <span className={cn("grid shrink-0 place-items-center rounded-md border", compact ? "size-5" : "mt-0.5 size-6", ACCENT_SOFT[s.accent])}>
              <Icon className={compact ? "size-3" : "size-3.5"} aria-label={s.label} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] leading-snug wrap-anywhere", c.state !== "pass" && "font-medium")}>{c.label}</p>
              {compact ? null : <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">{c.detail}</p>}
            </div>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              {c.blocking ? null : (
                <Chip tone="slate" size="xs" variant="outline" title="Không chặn bay, chỉ lưu ý">
                  lưu ý
                </Chip>
              )}
              {compact ? null : (
                <Chip tone={s.accent} size="xs">
                  {s.label}
                </Chip>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
