import { useLocation } from "react-router";

/**
 * Có hiện bộ nút thoát hiểm HOLD / RTL / LAND ở trang này không: mọi trang trừ trang Bay
 * (trang Bay đã có đủ nút trong panel Chế độ bay). Dùng chung cho header và thanh nổi đáy
 * (`components/shell/QuickDock.tsx`).
 */
export function useShowsEmergency(): boolean {
  return useLocation().pathname !== "/";
}
