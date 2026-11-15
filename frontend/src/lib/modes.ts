/**
 * Màu riêng của từng flight mode — một mode một màu ở MỌI chỗ: chip mode trên
 * header, nút chọn mode ở trang Bay, thanh mode và chú giải ở trang Lịch sử bay.
 *
 * Mode thoát hiểm (RTL, LAND) mang màu cam/vàng, BRAKE đỏ; các mode còn lại là
 * màu phân loại, không mang nghĩa tốt/xấu. Đọc được trên cả nền sáng lẫn tối.
 */
const MODE_COLORS: Record<string, string> = {
  LOITER: "oklch(0.68 0.14 245)",
  AUTO: "oklch(0.70 0.16 150)",
  GUIDED: "oklch(0.66 0.17 300)",
  RTL: "oklch(0.76 0.15 75)",
  SMART_RTL: "oklch(0.76 0.15 75)",
  LAND: "oklch(0.68 0.17 40)",
  ALT_HOLD: "oklch(0.72 0.11 195)",
  POSHOLD: "oklch(0.72 0.11 195)",
  STABILIZE: "oklch(0.62 0.02 260)",
  BRAKE: "oklch(0.62 0.20 25)",
};

const UNKNOWN_MODE_COLOR = "oklch(0.60 0.03 260)";

export function modeColor(mode: string | null | undefined): string {
  return (mode && MODE_COLORS[mode]) || UNKNOWN_MODE_COLOR;
}
