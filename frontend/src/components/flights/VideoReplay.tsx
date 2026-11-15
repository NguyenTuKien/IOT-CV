/**
 * Hình camera tại đầu phát: khung JPEG thật gần nhất phía trước (backend đọc thẳng từ file AVI
 * đã ghi). Khung cũ hơn `FRAME_STALE_S` thì phủ "MẤT HÌNH" lên khung cuối, như lúc bay.
 *
 * Đổi `src` của MỘT thẻ `<img>`: trình duyệt giữ ảnh cũ tới khi ảnh mới tải xong, nên không
 * chớp trắng. Lúc phát nhanh thì tối đa ~12 lần đổi mỗi giây cho khỏi dồn hàng request.
 */
import { VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FRAME_STALE_S, frameAt, frameUrl } from "@/lib/flights";
import type { FlightDetail } from "@/lib/flights";

const MIN_SWAP_MS = 80;

export function VideoReplay({ flight, cursor, fps }: { flight: FlightDetail; cursor: number; fps: number | null }) {
  const ref = frameAt(flight.video, cursor);
  const want = ref ? frameUrl(ref.rec, ref.n) : null;
  const [shown, setShown] = useState<string | null>(want);
  const last = useRef(0);

  useEffect(() => {
    if (want === shown) return;
    const wait = Math.max(0, MIN_SWAP_MS - (performance.now() - last.current));
    const id = window.setTimeout(() => {
      last.current = performance.now();
      setShown(want);
    }, wait);
    return () => window.clearTimeout(id);
  }, [want, shown]);

  if (flight.video.length === 0) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
        <div>
          <VideoOff className="mx-auto mb-2 size-6 opacity-60" />
          Chuyến này không có video ghi về laptop (backend chưa chạy, laptop ngủ, hoặc ghi hình tắt).
        </div>
      </div>
    );
  }

  const stale = !ref || ref.age > FRAME_STALE_S;
  return (
    <div className="relative h-full w-full bg-black" data-testid="flight-video">
      {shown ? <img src={shown} alt="Khung camera tại đầu phát" className="absolute inset-0 h-full w-full object-contain" draggable={false} /> : null}
      {stale ? (
        <div className="absolute inset-0 grid place-items-center bg-black/55 text-center">
          <div className="font-mono text-sm font-semibold tracking-widest text-hud-red">
            MẤT HÌNH
            <div className="mt-1 text-[11px] font-normal tracking-normal text-white/70">
              {ref ? `khung cuối cách ${ref.age.toFixed(1)} s` : "chưa có khung nào"}
            </div>
          </div>
        </div>
      ) : null}
      <div className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white/85">
        {fps == null ? "— khung/s" : `${fps.toFixed(1)} khung/s`}
      </div>
    </div>
  );
}
