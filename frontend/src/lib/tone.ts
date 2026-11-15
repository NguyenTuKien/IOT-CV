/**
 * Bảng lớp màu theo NGỮ NGHĨA — dùng chung mọi component mới, để "vàng" ở trang
 * này và "vàng" ở trang kia là một thứ. `neutral` = chưa biết / không có gì để nói.
 */
import type { Tone } from "./format";

export type { Tone };

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-hud-green",
  warn: "text-hud-amber",
  danger: "text-hud-red",
};

export const TONE_CHIP: Record<Tone, string> = {
  neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
  ok: "border-hud-green/40 bg-hud-green/12 text-hud-green",
  warn: "border-hud-amber/45 bg-hud-amber/12 text-hud-amber",
  danger: "border-hud-red/50 bg-hud-red/14 text-hud-red",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  ok: "bg-hud-green",
  warn: "bg-hud-amber",
  danger: "bg-hud-red",
};

export const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  ok: "bg-hud-green",
  warn: "bg-hud-amber",
  danger: "bg-hud-red",
};

/** Màu CSS thật (cho SVG/canvas) — đọc token, nên đổi theo theme. */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--muted-foreground)",
  ok: "var(--hud-green)",
  warn: "var(--hud-amber)",
  danger: "var(--hud-red)",
};

// ---------------------------------------------------------------------------
// Màu PHÂN LOẠI (accent)
// ---------------------------------------------------------------------------

/**
 * Màu để PHÂN BIỆT (nhóm trang, nguồn sự kiện, loại panel), khác `Tone` là màu
 * để BÁO trạng thái. Đỏ/vàng/xanh lá vẫn giữ nghĩa an toàn: đừng dùng `red` để
 * tô một thứ không nguy hiểm.
 */
export type Accent = "cyan" | "blue" | "teal" | "green" | "amber" | "orange" | "red" | "pink" | "violet" | "indigo" | "slate";

/** `Tone` → `Accent`, để mọi chip nhận được cả hai. */
export const TONE_ACCENT: Record<Tone, Accent> = { neutral: "slate", ok: "green", warn: "amber", danger: "red" };

export function toAccent(t: Tone | Accent): Accent {
  return t in TONE_ACCENT ? TONE_ACCENT[t as Tone] : (t as Accent);
}

/** Nền nhạt + viền + chữ — chip, nhãn nhỏ. */
export const ACCENT_SOFT: Record<Accent, string> = {
  cyan: "border-hud-cyan/40 bg-hud-cyan/12 text-hud-cyan",
  blue: "border-hud-blue/40 bg-hud-blue/12 text-hud-blue",
  teal: "border-hud-teal/40 bg-hud-teal/12 text-hud-teal",
  green: "border-hud-green/40 bg-hud-green/12 text-hud-green",
  amber: "border-hud-amber/45 bg-hud-amber/12 text-hud-amber",
  orange: "border-hud-orange/45 bg-hud-orange/12 text-hud-orange",
  red: "border-hud-red/50 bg-hud-red/14 text-hud-red",
  pink: "border-hud-pink/40 bg-hud-pink/12 text-hud-pink",
  violet: "border-hud-violet/40 bg-hud-violet/12 text-hud-violet",
  indigo: "border-hud-indigo/40 bg-hud-indigo/12 text-hud-indigo",
  slate: "border-border bg-foreground/[0.05] text-muted-foreground",
};

/** Nền đặc — chip cần nổi bật (ARMED, số đếm). Chữ tối trên nền sáng ở cả hai theme. */
export const ACCENT_SOLID: Record<Accent, string> = {
  cyan: "border-transparent bg-hud-cyan text-background",
  blue: "border-transparent bg-hud-blue text-background",
  teal: "border-transparent bg-hud-teal text-background",
  green: "border-transparent bg-hud-green text-background",
  amber: "border-transparent bg-hud-amber text-background",
  orange: "border-transparent bg-hud-orange text-background",
  red: "border-transparent bg-hud-red text-background",
  pink: "border-transparent bg-hud-pink text-background",
  violet: "border-transparent bg-hud-violet text-background",
  indigo: "border-transparent bg-hud-indigo text-background",
  slate: "border-transparent bg-muted-foreground text-background",
};

export const ACCENT_TEXT: Record<Accent, string> = {
  cyan: "text-hud-cyan",
  blue: "text-hud-blue",
  teal: "text-hud-teal",
  green: "text-hud-green",
  amber: "text-hud-amber",
  orange: "text-hud-orange",
  red: "text-hud-red",
  pink: "text-hud-pink",
  violet: "text-hud-violet",
  indigo: "text-hud-indigo",
  slate: "text-muted-foreground",
};

export const ACCENT_DOT: Record<Accent, string> = {
  cyan: "bg-hud-cyan",
  blue: "bg-hud-blue",
  teal: "bg-hud-teal",
  green: "bg-hud-green",
  amber: "bg-hud-amber",
  orange: "bg-hud-orange",
  red: "bg-hud-red",
  pink: "bg-hud-pink",
  violet: "bg-hud-violet",
  indigo: "bg-hud-indigo",
  slate: "bg-muted-foreground/60",
};

/** Ô icon ở đầu panel: nền chuyển màu nhẹ + viền trong. */
export const ACCENT_TILE: Record<Accent, string> = {
  cyan: "from-hud-cyan/24 to-hud-cyan/6 text-hud-cyan ring-hud-cyan/30",
  blue: "from-hud-blue/24 to-hud-blue/6 text-hud-blue ring-hud-blue/30",
  teal: "from-hud-teal/24 to-hud-teal/6 text-hud-teal ring-hud-teal/30",
  green: "from-hud-green/24 to-hud-green/6 text-hud-green ring-hud-green/30",
  amber: "from-hud-amber/24 to-hud-amber/6 text-hud-amber ring-hud-amber/30",
  orange: "from-hud-orange/24 to-hud-orange/6 text-hud-orange ring-hud-orange/30",
  red: "from-hud-red/24 to-hud-red/6 text-hud-red ring-hud-red/30",
  pink: "from-hud-pink/24 to-hud-pink/6 text-hud-pink ring-hud-pink/30",
  violet: "from-hud-violet/24 to-hud-violet/6 text-hud-violet ring-hud-violet/30",
  indigo: "from-hud-indigo/24 to-hud-indigo/6 text-hud-indigo ring-hud-indigo/30",
  slate: "from-foreground/10 to-foreground/[0.03] text-muted-foreground ring-border",
};

/** Vạch sáng dưới đầu panel. */
export const ACCENT_LINE: Record<Accent, string> = {
  cyan: "from-hud-cyan/45",
  blue: "from-hud-blue/45",
  teal: "from-hud-teal/45",
  green: "from-hud-green/45",
  amber: "from-hud-amber/45",
  orange: "from-hud-orange/45",
  red: "from-hud-red/45",
  pink: "from-hud-pink/45",
  violet: "from-hud-violet/45",
  indigo: "from-hud-indigo/45",
  slate: "from-foreground/20",
};

/** Màu CSS thật của accent (SVG, style inline, biểu đồ). */
export const ACCENT_VAR: Record<Accent, string> = {
  cyan: "var(--hud-cyan)",
  blue: "var(--hud-blue)",
  teal: "var(--hud-teal)",
  green: "var(--hud-green)",
  amber: "var(--hud-amber)",
  orange: "var(--hud-orange)",
  red: "var(--hud-red)",
  pink: "var(--hud-pink)",
  violet: "var(--hud-violet)",
  indigo: "var(--hud-indigo)",
  slate: "var(--muted-foreground)",
};
