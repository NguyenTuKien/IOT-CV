/**
 * Khung nhìn phóng to DÙNG CHUNG cho hai bên so sánh (gốc / ảnh rõ): một trạng thái, cùng một
 * transform áp lên lớp ảnh của mỗi bên, nên phóng chỗ nào bên này là đúng chỗ đó bên kia.
 *
 * Toạ độ chuẩn hoá theo khung nhìn (0–1), không theo pixel: hai ô cạnh nhau và ô thanh trượt khác
 * cỡ vẫn dùng chung được. Lớp ảnh dời (x, y) rồi phóng s quanh góc trên trái, nên điểm u của ảnh
 * hiện ở x + u·s. Ảnh luôn phủ kín khung (không lộ nền đen): x, y ∈ [1 − s, 0].
 */
export interface ZoomView {
  s: number;
  x: number;
  y: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
/** Một nấc nút phóng to / thu nhỏ. */
export const ZOOM_STEP = 1.5;
/** Nhấp đúp lúc ảnh còn vừa khung thì phóng tới mức này, quanh chỗ nhấp. */
export const ZOOM_DOUBLE_CLICK = 3;
export const VIEW_FIT: ZoomView = { s: ZOOM_MIN, x: 0, y: 0 };

/** Lăn chuột: mỗi pixel cuộn đổi độ phóng chừng này (theo hàm mũ, mượt cả với bàn di cảm ứng). */
const WHEEL_RATE = 0.0015;
/** Một dòng cuộn (deltaMode 1) coi như chừng này pixel. */
const WHEEL_LINE_PX = 16;
/** Độ phóng sát 1 hơn chừng này thì coi là vừa khung (sai số dấu phẩy động sau nhiều nấc). */
const FIT_SNAP = 1e-3;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function clampView(v: ZoomView): ZoomView {
  const s = clamp(v.s, ZOOM_MIN, ZOOM_MAX);
  if (s - ZOOM_MIN < FIT_SNAP) return VIEW_FIT;
  return { s, x: clamp(v.x, 1 - s, 0), y: clamp(v.y, 1 - s, 0) };
}

/** Phóng `factor` lần quanh điểm (px, py) của khung nhìn: điểm ảnh dưới con trỏ đứng yên. */
export function zoomAt(v: ZoomView, factor: number, px: number, py: number): ZoomView {
  const s = clamp(v.s * factor, ZOOM_MIN, ZOOM_MAX);
  const ux = (px - v.x) / v.s;
  const uy = (py - v.y) / v.s;
  return clampView({ s, x: px - ux * s, y: py - uy * s });
}

/** Kéo ảnh đi (dx, dy) phần của khung nhìn. */
export function panBy(v: ZoomView, dx: number, dy: number): ZoomView {
  return clampView({ s: v.s, x: v.x + dx, y: v.y + dy });
}

/** CSS transform của lớp ảnh (phần trăm của translate tính theo cỡ chính lớp đó = khung nhìn). */
export function viewTransform(v: ZoomView): string {
  return `translate(${v.x * 100}%, ${v.y * 100}%) scale(${v.s})`;
}

/** Hình chữ nhật theo phần trăm ẢNH ra phần trăm KHUNG NHÌN, để vẽ NGOÀI lớp phóng (viền, chữ giữ cỡ). */
export function projectRect(r: { left: number; top: number; width: number; height: number }, v: ZoomView) {
  return { left: v.x * 100 + r.left * v.s, top: v.y * 100 + r.top * v.s, width: r.width * v.s, height: r.height * v.s };
}

/** Phần ảnh đang thấy (0–1 theo ảnh), cho bản đồ nhỏ ở góc. */
export function visibleRect(v: ZoomView): { left: number; top: number; width: number; height: number } {
  return { left: -v.x / v.s, top: -v.y / v.s, width: 1 / v.s, height: 1 / v.s };
}

/** Hệ số phóng của một cú lăn: lăn lên (deltaY < 0) là phóng to. `pageHeight` cho deltaMode 2. */
export function wheelFactor(deltaY: number, deltaMode: number, pageHeight: number): number {
  const px = deltaMode === 1 ? deltaY * WHEEL_LINE_PX : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return clamp(Math.exp(-px * WHEEL_RATE), 0.5, 2);
}

/** Lăn tiếp mà đã chạm giới hạn thì để trang cuộn như thường, không nuốt cú lăn của người xem. */
export function wheelAtLimit(v: ZoomView, deltaY: number): boolean {
  if (deltaY === 0) return true;
  return deltaY < 0 ? v.s >= ZOOM_MAX : v.s <= ZOOM_MIN;
}
