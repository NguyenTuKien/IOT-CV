/**
 * Cách VẼ một sự kiện — nguồn duy nhất cho mọi chỗ liệt kê sự kiện (panel nhật
 * ký ở trang Bay, trang Nhật ký, trung tâm thông báo, Tổng quan).
 *
 *  - MỨC (info / warn / error) mang nghĩa an toàn: cyan / vàng / đỏ — không đổi.
 *  - NGUỒN chỉ để PHÂN BIỆT bằng mắt (mavlink xanh dương, mission xanh ngọc…),
 *    không mang nghĩa tốt/xấu, nên không dùng xanh lá / vàng / đỏ.
 */
import { Info, OctagonX, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Accent } from "./tone";
import type { LogEntry } from "@/store/telemetry";

export type EventLevel = LogEntry["level"];

export const LEVEL_STYLE: Record<EventLevel, { icon: LucideIcon; accent: Accent; label: string }> = {
  info: { icon: Info, accent: "cyan", label: "Thông tin" },
  warn: { icon: TriangleAlert, accent: "amber", label: "Cảnh báo" },
  error: { icon: OctagonX, accent: "red", label: "Lỗi" },
};

/**
 * Nguồn sự kiện của backend + "web" (sự kiện của chính trang) + nguồn của trang Lịch sử
 * bay (`backend/flights`: fc, link, camera, arm). Cùng một thứ thì cùng một màu:
 * STATUSTEXT của FC xanh dương dù đến từ log FC hay qua MAVLink trực tiếp.
 */
const SOURCE_ACCENT: Record<string, Accent> = {
  mavlink: "blue",
  fc: "blue",
  mission: "teal",
  safety: "orange",
  link: "orange",
  vision: "violet",
  camera: "violet",
  backend: "indigo",
  arm: "pink",
  web: "pink",
};

const SOURCE_LABEL: Record<string, string> = {
  mavlink: "MAVLink",
  fc: "FC",
  link: "link",
  camera: "camera",
  arm: "ARM",
  mission: "mission",
  safety: "an toàn",
  vision: "camera",
  backend: "backend",
  web: "web",
};

export function sourceAccent(source: string): Accent {
  return SOURCE_ACCENT[source] ?? "slate";
}

/** Nhãn ngắn hiện trên chip nguồn; `source` gốc vẫn nằm trong tooltip. */
export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}
