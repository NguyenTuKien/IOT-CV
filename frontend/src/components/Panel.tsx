/**
 * Vỏ chung của mọi ô trong GCS (hệ HORIZON): kính mờ, đầu panel có icon + tên +
 * dòng phụ, và chỗ cho nút/badge ở góc phải.
 *
 * `variant="instrument"` thêm bốn góc ngoặc kiểu HUD — chỉ dùng cho THIẾT BỊ
 * (màn hình bay, radar, video, 3D), để mắt phân biệt được "đồng hồ đo" với
 * "biểu mẫu". Dùng cho mọi panel thì ngoặc mất nghĩa.
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";

import { ACCENT_LINE, ACCENT_TILE } from "@/lib/tone";
import type { Accent } from "@/lib/tone";
import { cn } from "@/lib/utils";

export type PanelIcon = ComponentType<{ className?: string }>;

interface PanelProps {
  title: string;
  icon: PanelIcon;
  /** Dòng nhỏ dưới tên panel — giải thích panel này dùng để làm gì. */
  subtitle?: ReactNode;
  /** Badge / nút nhỏ ở góc phải đầu panel. */
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "instrument";
  /**
   * Màu PHÂN LOẠI của panel (ô icon + vạch dưới đầu panel): mỗi loại thông tin
   * một màu, để mắt tìm panel nhanh hơn đọc tên. Không mang nghĩa an toàn.
   */
  accent?: Accent;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  testId?: string;
}

export function Panel({
  title,
  icon: Icon,
  subtitle,
  actions,
  children,
  variant = "default",
  accent = "cyan",
  className,
  bodyClassName,
  style,
  testId,
}: PanelProps) {
  return (
    <section
      className={cn("panel flex min-h-0 flex-col overflow-hidden", variant === "instrument" && "panel-instrument", className)}
      style={style}
      data-testid={testId}
      data-accent={accent}
    >
      {/* Đầu panel tự xuống dòng khi hẹp: nút/badge xuống hàng dưới thay vì cắt tên panel thành "…". */}
      <header className="relative flex min-h-11 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2">
        <div className="flex min-w-[9rem] flex-1 items-center gap-2.5">
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg bg-linear-to-br ring-1 ring-inset", ACCENT_TILE[accent])}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <h2 className="font-display text-[0.9rem] font-semibold tracking-[0.02em] text-foreground/95">{title}</h2>
            {subtitle ? <p className="line-clamp-2 text-[11px] text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5">{actions}</div> : null}
        {/* Đường kẻ dưới đầu panel: sáng ở trái (màu của panel), mờ dần sang phải. */}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-3 bottom-0 h-px bg-linear-to-r via-border to-transparent", ACCENT_LINE[accent])}
        />
      </header>
      <div className={cn("relative min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
