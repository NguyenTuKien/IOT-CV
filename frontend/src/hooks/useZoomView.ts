/**
 * Một khung nhìn phóng to dùng chung cho nhiều ô ảnh (`lib/zoom.ts`). `latest` giữ trạng thái mới
 * nhất ngay khi đổi, trước khi React vẽ lại: nhiều nấc lăn chuột trong cùng một khung hình vẫn cộng
 * dồn đúng thay vì đè nhau.
 */
import { useCallback, useRef, useState } from "react";

import { VIEW_FIT } from "@/lib/zoom";
import type { ZoomView } from "@/lib/zoom";

export interface ZoomControl {
  view: ZoomView;
  latest: { readonly current: ZoomView };
  apply: (next: ZoomView) => void;
}

export function useZoomView(): ZoomControl {
  const [view, setView] = useState<ZoomView>(VIEW_FIT);
  const latest = useRef<ZoomView>(VIEW_FIT);
  const apply = useCallback((next: ZoomView) => {
    latest.current = next;
    setView(next);
  }, []);
  return { view, latest, apply };
}
