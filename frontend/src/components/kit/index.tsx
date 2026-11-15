/**
 * Khối dựng nhỏ dùng chung của HORIZON: đầu trang, chấm trạng thái, dòng
 * khoá–giá trị, sparkline, trạng thái trống. Không logic nghiệp vụ nào ở đây.
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

import { NO_VALUE } from "@/lib/format";
import { modeColor } from "@/lib/modes";
import { ACCENT_DOT, ACCENT_SOFT, ACCENT_SOLID, ACCENT_TILE, TONE_DOT, TONE_TEXT, toAccent } from "@/lib/tone";
import type { Accent, Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Đầu trang
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
  accent = "cyan",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Icon của trang (cùng icon trên thanh tab) — đặt trong ô màu cạnh tiêu đề. */
  icon?: ComponentType<{ className?: string }>;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 max-w-3xl items-start gap-3.5">
        {Icon ? (
          <span
            className={cn(
              "mt-0.5 hidden size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br ring-1 ring-inset sm:grid",
              ACCENT_TILE[accent],
            )}
            aria-hidden
          >
            <Icon className="size-[22px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-[0.01em] sm:text-[1.7rem]">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip — nhãn trạng thái / phân loại dùng chung
// ---------------------------------------------------------------------------

const CHIP_SIZE = {
  xs: "h-5 gap-1 rounded-[5px] px-1.5 text-[10.5px] [&_svg]:size-3",
  sm: "h-6 gap-1.5 rounded-md px-2 text-[11.5px] [&_svg]:size-3.5",
  md: "h-8 gap-1.5 rounded-lg px-2.5 text-[12px] [&_svg]:size-3.5",
} as const;

export type ChipSize = keyof typeof CHIP_SIZE;

/**
 * Một chip cho mọi chỗ: `tone` nhận cả màu TRẠNG THÁI (ok/warn/danger/neutral)
 * lẫn màu PHÂN LOẠI (blue, teal, violet…). `variant`: nền nhạt (mặc định), nền
 * đặc (thứ phải nổi bật nhất), hoặc chỉ viền.
 */
export function Chip({
  tone = "neutral",
  variant = "soft",
  size = "sm",
  icon: Icon,
  dot,
  pulse,
  mono,
  title,
  className,
  style,
  children,
  testId,
  ...data
}: {
  tone?: Tone | Accent;
  variant?: "soft" | "solid" | "outline";
  size?: ChipSize;
  icon?: ComponentType<{ className?: string }>;
  /** Chấm màu ở đầu chip. */
  dot?: boolean;
  /** Chấm nhấp nháy — chỉ cho trạng thái đang nguy hiểm / đang ghi. */
  pulse?: boolean;
  mono?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  testId?: string;
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}) {
  const accent = toAccent(tone);
  return (
    <span
      title={title}
      data-testid={testId}
      style={style}
      {...data}
      className={cn(
        "inline-flex shrink-0 items-center border font-semibold whitespace-nowrap",
        CHIP_SIZE[size],
        mono && "font-mono tracking-wide",
        variant === "solid" ? ACCENT_SOLID[accent] : variant === "outline" ? cn(ACCENT_SOFT[accent], "bg-transparent") : ACCENT_SOFT[accent],
        className,
      )}
    >
      {dot ? (
        <span className="relative inline-flex size-1.5 shrink-0" aria-hidden>
          {pulse ? <span className={cn("absolute inset-0 rounded-full opacity-70 motion-safe:animate-ping", variant === "solid" ? "bg-background" : ACCENT_DOT[accent])} /> : null}
          <span className={cn("relative size-1.5 rounded-full", variant === "solid" ? "bg-background" : ACCENT_DOT[accent])} />
        </span>
      ) : null}
      {Icon ? <Icon className="shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Chip flight mode — màu riêng từng mode (`lib/modes.ts`), cùng màu với trang Lịch sử bay. */
export function ModeBadge({
  mode,
  size = "sm",
  className,
  title = "Chế độ bay hiện tại",
  testId,
}: {
  mode: string | null | undefined;
  size?: ChipSize;
  className?: string;
  title?: string;
  testId?: string;
}) {
  return (
    <span
      title={title}
      data-testid={testId}
      data-mode={mode ?? "none"}
      className={cn("mode-chip inline-flex shrink-0 items-center border font-mono font-semibold tracking-wide whitespace-nowrap", CHIP_SIZE[size], className)}
      style={{ "--m": modeColor(mode) } as CSSProperties}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {mode ?? NO_VALUE}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chấm trạng thái
// ---------------------------------------------------------------------------

export function StatusDot({ tone, pulse, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {pulse ? <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", TONE_DOT[tone])} /> : null}
      <span className={cn("relative size-2 rounded-full", TONE_DOT[tone])} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Khoá — giá trị
// ---------------------------------------------------------------------------

export function KeyValue({
  label,
  value,
  hint,
  tone,
  mono = true,
  icon: Icon,
  accent,
  sub,
  meter,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  /** Giá trị mang trạng thái (ok/warn/danger): hiện thành chip có chấm màu, không chỉ đổi màu chữ. */
  tone?: Tone;
  mono?: boolean;
  /** Icon trong ô màu trước nhãn — mắt nhận ra dòng theo hình, không phải đọc chữ. */
  icon?: ComponentType<{ className?: string }>;
  accent?: Accent;
  /** Dòng giải thích ngắn dưới nhãn (hiện luôn; `hint` là tooltip). */
  sub?: ReactNode;
  /** 0–1: thanh đo mảnh dưới giá trị (vd. bộ đệm đầy bao nhiêu). */
  meter?: number | null;
  testId?: string;
}) {
  const a = accent ?? (tone ? toAccent(tone) : "slate");
  const shown = value ?? NO_VALUE;
  return (
    <div className="flex items-center justify-between gap-x-3 gap-y-1 px-2.5 py-[7px]" title={hint} data-testid={testId}>
      {/* Không cắt "…": nhãn hay giá trị dài (URL, endpoint) thì xuống dòng. */}
      <dt className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg bg-linear-to-br ring-1 ring-inset", ACCENT_TILE[a])} aria-hidden>
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block text-[12.5px] leading-snug text-foreground/80">{label}</span>
          {sub ? <span className="block text-[11px] leading-snug text-muted-foreground">{sub}</span> : null}
        </span>
      </dt>
      <dd className="flex min-w-0 flex-col items-end gap-1 text-right">
        {tone && tone !== "neutral" ? (
          <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold wrap-anywhere border", ACCENT_SOFT[a], mono && "num")}>
            <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
            {shown}
          </span>
        ) : (
          <span className={cn("max-w-full text-[13px] font-medium text-foreground wrap-anywhere", mono && "num")}>{shown}</span>
        )}
        {meter !== undefined ? (
          <span className="h-1 w-24 overflow-hidden rounded-full bg-foreground/8" aria-hidden>
            {meter !== null ? (
              <span className={cn("block h-full rounded-full", ACCENT_DOT[a])} style={{ width: `${Math.round(Math.max(0, Math.min(1, meter)) * 100)}%` }} />
            ) : null}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Danh sách nhãn – giá trị: khung bo tròn, dòng sọc xen kẽ (mắt bám dòng khi đọc ngang).
 * `title` tạo một nhóm có tiêu đề nhỏ — danh sách dài chia nhóm thì dễ tìm hơn một cột 12 dòng.
 */
export function KeyValueList({
  children,
  className,
  title,
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  const list = <dl className={cn("zebra overflow-hidden rounded-lg border border-border/70 bg-foreground/[0.012]", !title && className)}>{children}</dl>;
  if (!title) return list;
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <p className="flex items-center gap-1.5 eyebrow text-[10px]">
        {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
        {title}
      </p>
      {list}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — xu hướng ngắn, không trục, không nhãn
// ---------------------------------------------------------------------------

/**
 * Đường xu hướng nhỏ. `null` trong chuỗi = mất số đo → NGẮT nét, không nối
 * thẳng qua (nối qua là vẽ ra số liệu không có thật).
 */
export function Sparkline({
  values,
  className,
  color = "var(--hud-cyan)",
  min,
  max,
  height = 28,
  fill = true,
}: {
  values: readonly (number | null)[];
  className?: string;
  color?: string;
  min?: number;
  max?: number;
  height?: number;
  fill?: boolean;
}) {
  const width = 120;
  const paths = useMemo(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    const lo = min ?? Math.min(...nums);
    const hi = max ?? Math.max(...nums);
    const span = hi - lo || 1;
    const n = values.length;
    const x = (i: number) => (i / (n - 1)) * width;
    const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4);
    let line = "";
    let area = "";
    let runStart: number | null = null;
    values.forEach((v, i) => {
      if (v === null) {
        if (runStart !== null) area += `L${x(i - 1)},${height}L${x(runStart)},${height}Z`;
        runStart = null;
        return;
      }
      const cmd = runStart === null ? "M" : "L";
      if (runStart === null) runStart = i;
      line += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      area += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (runStart !== null) area += `L${x(n - 1)},${height}L${x(runStart)},${height}Z`;
    return { line, area };
  }, [values, min, max, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("block w-full", className)} style={{ height }} aria-hidden>
      {paths ? (
        <>
          {fill ? <path d={paths.area} fill={color} opacity={0.12} /> : null}
          <path d={paths.line} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </>
      ) : (
        <line x1="0" x2={width} y1={height - 2} y2={height - 2} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trạng thái trống
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-xl bg-foreground/5 text-muted-foreground ring-1 ring-border ring-inset">
        <Icon className="size-5" />
      </span>
      <p className="font-display text-sm font-semibold">{title}</p>
      {children ? <div className="max-w-sm text-xs text-muted-foreground">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thanh đo ngang
// ---------------------------------------------------------------------------

export function Meter({ value, tone = "neutral", className }: { value: number | null; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-foreground/8", className)}>
      {value !== null ? (
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", TONE_DOT[tone])}
          style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
        />
      ) : null}
    </div>
  );
}

/** Nhãn nhỏ cạnh số: "GIẢ LẬP", "CHƯA XÁC MINH"… — ô vuông, không bo tròn kiểu viên thuốc. */
export function Tag({ tone = "neutral", children, title, className }: { tone?: Tone | Accent; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase",
        ACCENT_SOFT[toAccent(tone)],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ô số lớn (Tổng quan, Hệ thống, Lịch sử bay)
// ---------------------------------------------------------------------------

/** Ô số: nhãn nhỏ + số to + dòng phụ, viền trái màu theo trạng thái. */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  accent,
  icon: Icon,
  className,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  /** Màu phân loại khi ô không mang trạng thái (mặc định: theo `tone`). */
  accent?: Accent;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  testId?: string;
}) {
  const a = accent ?? toAccent(tone);
  return (
    <div className={cn("well relative flex min-w-0 flex-col gap-1 overflow-hidden p-3 pl-3.5", className)} data-testid={testId} data-tone={tone}>
      <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", ACCENT_DOT[a])} aria-hidden />
      <p className="flex items-center gap-1.5 eyebrow text-[10px]">
        {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
        {label}
      </p>
      <p className={cn("num text-lg leading-tight font-semibold wrap-anywhere", tone === "neutral" ? "text-foreground" : TONE_TEXT[tone])}>{value}</p>
      {sub ? <p className="font-mono text-[11px] text-muted-foreground wrap-anywhere">{sub}</p> : null}
    </div>
  );
}
