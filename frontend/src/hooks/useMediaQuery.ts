/**
 * `true` khi media query khớp, tự cập nhật khi đổi cỡ cửa sổ.
 *
 * Dùng khi phải chọn render CHỈ MỘT trong hai bản của cùng một thứ (vd nút thoát
 * hiểm trong header hay nổi dưới đáy). Ẩn bằng CSS thì cả hai bản vẫn nằm trong
 * DOM với cùng `data-testid`, và bàn phím/trình đọc màn hình vẫn tới được bản ẩn.
 */
import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Mốc `md` của Tailwind: từ đây trở lên nút thoát hiểm nằm trong header. */
export const DESKTOP_QUERY = "(min-width: 768px)";
