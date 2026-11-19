/**
 * Lịch sử bay — hỏi backend (`GET /api/flights`, `GET /api/flight?id=`) và các phép tính
 * thuần cho trang phát lại: tìm mẫu theo giờ, tìm khung video, tách vệt bay, gom theo ngày.
 *
 * Mọi mốc `t` trong một chuyến là GIÂY tính từ `window_start` (Unix) của chuyến đó. Backend
 * đã đưa tlog và video (đồng hồ laptop) về giờ GPS của FC, nên ở đây không chỉnh giờ nữa.
 */
import { restGet } from "./api";
import type { FlightSummary, FlightVideoClip } from "./protocol";

export type { FlightDetail, FlightFrameAI, FlightSummary, ImageQuality } from "./protocol";

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

/** Khung video cũ hơn chừng này so với đầu phát thì coi là MẤT HÌNH. */
export const FRAME_STALE_S = 1.5;

export async function fetchFlights(init?: RequestInit) {
  return restGet("GET /api/flights", "", init);
}

export async function fetchFlight(id: string, init?: RequestInit) {
  return restGet("GET /api/flight", `?id=${encodeURIComponent(id)}`, init);
}

/** `raw` = khung camera đã ghi; `enhanced` = khung đó sau enhancer của XLA (chạy trên laptop). */
export type FrameVariant = "raw" | "enhanced";

export function frameUrl(rec: string, n: number, variant: FrameVariant = "raw"): string {
  const url = `/api/flights/frame?rec=${encodeURIComponent(rec)}&n=${n}`;
  return variant === "enhanced" ? `${url}&variant=enhanced` : url;
}

/**
 * Hộp người (detector trên khung gốc) + số đo ảnh gốc / ảnh rõ của MỘT khung đã ghi. `detect`
 * false: backend bỏ detector, chỉ chạy enhancer (người xem tắt hộp người, ảnh rõ theo video nhanh hơn).
 */
export async function fetchFrameAi(rec: string, n: number, init?: RequestInit, detect = true) {
  const more = detect ? "" : "&detect=false";
  return restGet("GET /api/flights/ai", `?rec=${encodeURIComponent(rec)}&n=${n}${more}`, init);
}

/** Đếm "AI theo kịp video" trong một lượt phát. */
export interface KeepUp {
  /** Khung AI đã hiện kể từ lần bấm Phát gần nhất. */
  shown: number;
  /** Khung có trong file ghi nhưng AI bỏ qua vì còn bận khung trước. */
  skipped: number;
}

/** Nhảy quá chừng này khung một lần là người xem tua, không phải AI bỏ khung. */
export const SEEK_GAP = 30;

/**
 * Cộng một khung vừa hiện vào bộ đếm (chỉ tính khung nhảy cóc trong cùng một lần ghi). Cùng khung
 * hiện lại (bật/tắt hộp người) thì không đếm.
 */
export function countKeepUp(prev: KeepUp, last: { rec: string; n: number } | null, next: { rec: string; n: number }): KeepUp {
  if (last && last.rec === next.rec && last.n === next.n) return prev;
  const gap = last && last.rec === next.rec ? next.n - last.n - 1 : 0;
  const skipped = gap > 0 && gap <= SEEK_GAP ? gap : 0;
  return { shown: prev.shown + 1, skipped: prev.skipped + skipped };
}

/** Khung/s của video ĐÃ GHI quanh giây `t`: số khung trong `windowS` giây trước `t` (mọi đoạn ghi). */
export function videoFpsAt(clips: readonly FlightVideoClip[], t: number, windowS = 3): number {
  let count = 0;
  for (const clip of clips) count += Math.max(0, indexAt(clip.times, t) - indexAt(clip.times, t - windowS));
  return count / windowS;
}

/**
 * JPEG của một khung. Lỗi ném `Error` mang lý do backend gửi kèm (503 `enhancer_unavailable` có
 * `reason`, vd. "enhancer chưa nạp"); thân không phải JSON thì lý do là mã HTTP.
 */
export async function fetchFrameBlob(rec: string, n: number, variant: FrameVariant, init?: RequestInit): Promise<Blob> {
  const res = await fetch(frameUrl(rec, n, variant), init);
  if (res.ok) return res.blob();
  let reason = `HTTP ${res.status}`;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "reason" in body && typeof body.reason === "string") reason = body.reason;
  } catch {
    // Thân lỗi không phải JSON (proxy, 404 của router): giữ lý do là mã HTTP.
  }
  throw new Error(reason);
}

/** Ảnh rõ đổi bao nhiêu phần trăm so với gốc; `null` khi thiếu số hoặc gốc bằng 0. */
export function qualityDelta(raw: number | null | undefined, enhanced: number | null | undefined): number | null {
  if (raw == null || enhanced == null || raw === 0) return null;
  return ((enhanced - raw) / Math.abs(raw)) * 100;
}

export interface BoxPercent {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Hộp pixel của khung `w×h` → phần trăm để đặt bằng CSS, cắt về trong khung. */
export function boxPercent(b: { x1: number; y1: number; x2: number; y2: number }, w: number, h: number): BoxPercent {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const left = clamp((Math.min(b.x1, b.x2) / w) * 100);
  const top = clamp((Math.min(b.y1, b.y2) / h) * 100);
  const right = clamp((Math.max(b.x1, b.x2) / w) * 100);
  const bottom = clamp((Math.max(b.y1, b.y2) / h) * 100);
  return { left, top, width: right - left, height: bottom - top };
}

/** Chỉ số mẫu cuối cùng có `xs[i] <= x` (−1 nếu x đứng trước mọi mẫu). `xs` tăng dần. */
export function indexAt(xs: readonly number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export interface FrameRef {
  rec: string;
  /** Số dòng trong `frames.csv` của lần ghi — đúng tham số `n` của endpoint khung. */
  n: number;
  /** Đầu phát cách khung này bao nhiêu giây (≥ 0). */
  age: number;
}

/** Khung video đang "hiện" ở giây `t`: khung gần nhất phía trước, ở mọi đoạn ghi. */
export function frameAt(clips: readonly FlightVideoClip[], t: number): FrameRef | null {
  let best: FrameRef | null = null;
  for (const clip of clips) {
    const i = indexAt(clip.times, t);
    if (i < 0) continue;
    const age = t - clip.times[i];
    if (!best || age < best.age) best = { rec: clip.rec, n: clip.row0 + i, age };
  }
  return best;
}

/** Vệt bay thành các đoạn liền (mẫu thiếu toạ độ = ngắt nét), chỉ lấy tới chỉ số `upto`. */
export function trackSegments(
  lat: readonly (number | null)[],
  lon: readonly (number | null)[],
  upto = lat.length - 1,
): [number, number][][] {
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i <= Math.min(upto, lat.length - 1); i++) {
    const a = lat[i];
    const b = lon[i];
    if (a == null || b == null) {
      if (cur.length > 1) out.push(cur);
      cur = [];
      continue;
    }
    cur.push([a, b]);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Giá trị gần nhất phía trước có số (bỏ qua null), không cũ hơn `maxBack` mẫu. */
export function lastValue(values: readonly (number | null)[], i: number, maxBack = 8): number | null {
  for (let k = i; k >= 0 && i - k <= maxBack; k--) {
    const v = values[k];
    if (v != null) return v;
  }
  return null;
}

const DAY_FMT = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

export interface FlightDay {
  key: string;
  label: string;
  flights: FlightSummary[];
}

/** Gom chuyến theo ngày (giờ máy), ngày mới trước, trong ngày thì chuyến mới trước. */
export function groupByDay(flights: readonly FlightSummary[]): FlightDay[] {
  const days = new Map<string, FlightDay>();
  for (const f of [...flights].sort((a, b) => b.start - a.start)) {
    const key = f.id.slice(0, 8);
    let day = days.get(key);
    if (!day) {
      day = { key, label: DAY_FMT.format(new Date(f.start * 1000)), flights: [] };
      days.set(key, day);
    }
    day.flights.push(f);
  }
  return [...days.values()];
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(s: number): string {
  const total = Math.max(0, Math.round(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function clockTime(unix: number, withSeconds = true): string {
  return new Date(unix * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: withSeconds ? "2-digit" : undefined });
}

/** Màu từng flight mode — bảng chung của cả web nằm ở `modes.ts`. */
export { modeColor } from "./modes";
