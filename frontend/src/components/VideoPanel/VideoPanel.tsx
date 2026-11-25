/**
 * Panel VIDEO (plan Phase 10 §10.5): `<img>` MJPEG + canvas vẽ box chồng lên.
 *
 * `src` là đường dẫn TƯƠNG ĐỐI (`/api/video/stream`) — proxy của Vite lo lúc
 * dev, FastAPI tự phục vụ ở bản build. KHÔNG gắn `key` hay tham số đổi theo thời
 * gian: đổi là mở lại kết nối MJPEG, mỗi lần mở lại là một khoảng trắng. `src`
 * chỉ đổi SAU MỘT LẦN HỎNG (thử lại mỗi 5 s) hoặc khi camera sống lại.
 *
 * Luật mất camera (SAFETY.md mục 9, comment của `video.js` cũ): *"telemetry vẫn
 * chạy, control vẫn chạy, UAV không đổi mode."* Panel hiện CAMERA OFFLINE và
 * KHÔNG làm gì khác — không toast đỏ, không khoá nút, không đụng vào store kết
 * nối. Mọi trạng thái của camera nằm gọn trong component này.
 *
 * Nguồn: camera thật hoặc MJPEG GIẢ (CAMERA_FAKE=1). Box đến từ message `detection`: model
 * detector của repo XLA khi đã nạp, box giả chạy vòng khi không có model và nguồn giả.
 *
 * Nút "Ảnh rõ" (hợp đồng model XLA §8): chỉ đổi `src` giữa `variant=raw` và
 * `variant=enhanced`; box vẫn vẽ bằng `DetectionOverlay` (enhancer giữ nguyên toạ độ).
 * Lựa chọn nhớ trong `localStorage` (`iot-cv.video-enhanced`); chưa chọn lần nào thì theo
 * `status.vision.enhancer_default_on` của backend (env `ENHANCER_DEFAULT_ON`, hợp đồng XLA §13).
 * Enhancer chưa nạp (backend trả 503) thì nút tắt + chip lý do.
 */
import { Camera, CameraOff, Expand, Sparkles } from "lucide-react";

import { IconVision } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Chip } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { ACCENT_SOFT } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";

import { DetectionOverlay } from "./DetectionOverlay";
import { RecordingBadge } from "./RecordingBadge";

const VIDEO_STREAM_PATH = "/api/video/stream";
/** Hỏng rồi thì chừng này ms sau thử mở lại. */
const CAMERA_RETRY_MS = 5000;

const ENHANCED_KEY = "iot-cv.video-enhanced";

function streamSrc(attempt: number, enhanced: boolean): string {
  const params = new URLSearchParams();
  if (enhanced) params.set("variant", "enhanced");
  if (attempt > 0) params.set("retry", String(attempt));
  const q = params.toString();
  return q ? `${VIDEO_STREAM_PATH}?${q}` : VIDEO_STREAM_PATH;
}

/** Lựa chọn "Ảnh rõ" đã lưu: true/false, hoặc null khi người xem chưa chọn (theo mặc định backend). */
function readEnhanced(): boolean | null {
  try {
    const v = localStorage.getItem(ENHANCED_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function VideoPanel({
  style,
  className,
  bodyClassName,
  title = "Video",
  tools = false,
}: {
  style?: CSSProperties;
  className?: string;
  bodyClassName?: string;
  title?: string;
  /** Hiện nút chụp ảnh + toàn màn hình (trang Camera & AI). */
  tools?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const available = useTelemetryStore((s) => s.status?.camera?.available);
  const fake = useTelemetryStore((s) => s.status?.camera?.fake);
  const frame = useTelemetryStore((s) => (s.detection ? `${s.detection.width}×${s.detection.height}` : null));
  const boxes = useTelemetryStore((s) => s.detection?.boxes?.length ?? null);
  const enhancerState = useTelemetryStore((s) => s.status?.vision?.enhancer?.state ?? null);
  const enhancerReason = useTelemetryStore((s) => s.status?.vision?.enhancer?.reason ?? null);
  const enhancerVersion = useTelemetryStore((s) => s.status?.vision?.enhancer?.version ?? null);
  // Chưa chọn lần nào (khoá trống) thì theo `status.vision.enhancer_default_on` (hợp đồng XLA §13);
  // đã chọn thì giữ lựa chọn, kể cả khi mặc định của backend đổi.
  const defaultOn = useTelemetryStore((s) => s.status?.vision?.enhancer_default_on ?? false);
  const [stored, setStored] = useState(readEnhanced);
  const wantEnhanced = stored ?? defaultOn;
  // Luồng enhanced vừa hỏng (503 hay đứt) thì quay về raw cho tới khi người xem bật lại.
  const [enhancedFailed, setEnhancedFailed] = useState(false);
  const enhancerReady = enhancerState === "loaded" && !enhancedFailed;
  const enhanced = wantEnhanced && enhancerReady;
  const toggleEnhanced = () => {
    const next = !wantEnhanced;
    setStored(next);
    setEnhancedFailed(false);
    try {
      localStorage.setItem(ENHANCED_KEY, next ? "1" : "0");
    } catch {
      /* chặn lưu trữ: chỉ không nhớ được, nút vẫn chạy */
    }
  };

  // Hỏng → chờ rồi thử lại. Chỉ component này biết; không báo ra ngoài.
  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setAttempt((a) => a + 1);
    }, CAMERA_RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  // Camera sống lại (backend báo) → mở lại luồng: luồng cũ có thể đã đứng hình.
  const [wasAvailable, setWasAvailable] = useState(available);
  if (available !== wasAvailable) {
    setWasAvailable(available);
    if (available === true && wasAvailable === false) {
      setAttempt((a) => a + 1);
      setFailed(false);
    }
  }

  const offline = failed || available === false;
  const frameRef = useRef<HTMLDivElement>(null);

  /** Chụp khung đang hiện + lớp box → PNG. Ảnh cùng nguồn gốc nên canvas không bị "nhiễm" CORS. */
  const snapshot = () => {
    const img = imgRef.current;
    if (!img || offline || !img.naturalWidth) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const overlay = frameRef.current?.querySelector<HTMLCanvasElement>("[data-testid=detection-overlay]");
    if (overlay && overlay.width > 0) ctx.drawImage(overlay, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iot-cv-camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  return (
    <Panel
      title={title}
      subtitle="MJPEG · khung AI vẽ chồng"
      icon={IconVision}
      accent="violet"
      variant="instrument"
      style={style}
      className={className}
      testId="video-panel"
      bodyClassName={cn("relative flex items-center justify-center overflow-hidden bg-[oklch(0.1_0.015_262)] p-2", bodyClassName)}
      actions={
        <>
          {fake ? (
            <Chip tone="warn" size="xs" mono title="Nguồn MJPEG giả (CAMERA_FAKE=1) — box không cần khớp nội dung video">
              NGUỒN GIẢ
            </Chip>
          ) : null}
          <RecordingBadge />
          <span className="font-mono text-[10.5px] whitespace-nowrap text-muted-foreground" data-testid="video-meta">
            {frame ?? "—"} · {boxes ?? "—"} box
          </span>
          {tools ? (
            <>
              <button type="button" onClick={snapshot} disabled={offline} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-40" title="Chụp ảnh (kèm khung nhận diện)" data-testid="video-snapshot">
                <Camera className="size-4" />
              </button>
              <button type="button" onClick={() => void frameRef.current?.requestFullscreen?.()} className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground" title="Toàn màn hình">
                <Expand className="size-4" />
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div ref={frameRef} className="relative flex h-full w-full items-center justify-center bg-[oklch(0.1_0.015_262)]">
      <img
        ref={imgRef}
        src={streamSrc(attempt, enhanced)}
        alt="Hình từ camera trên drone"
        data-testid="video-img"
        data-attempt={attempt}
        data-variant={enhanced ? "enhanced" : "raw"}
        className={offline ? "invisible block max-h-full max-w-full" : "block max-h-full max-w-full"}
        // KHÔNG dựa vào `onLoad`: với luồng multipart, trình duyệt không hứa
        // bắn `load` cho từng khung. Chỉ `onError` là tín hiệu tin được.
        onError={() => (enhanced ? setEnhancedFailed(true) : setFailed(true))}
      />
      {offline ? null : <DetectionOverlay imgRef={imgRef} />}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {wantEnhanced && !enhancerReady ? (
            <Chip tone="warn" size="xs" mono title={enhancerReason ?? "Enhancer chưa nạp"} testId="video-enhanced-unavailable">
              ẢNH RÕ: KHÔNG CÓ
            </Chip>
          ) : null}
          <button
            type="button"
            onClick={toggleEnhanced}
            disabled={!enhancerReady && !wantEnhanced}
            aria-pressed={enhanced}
            title={
              enhancerReady
                ? enhanced
                  ? "Tắt ảnh rõ (về khung gốc của camera)"
                  : `Bật ảnh rõ (enhancer ${enhancerVersion ? `v${enhancerVersion.replace(/^v/, "")} ` : ""}của XLA)`
                : `Ảnh rõ không dùng được: ${enhancerReason ?? "enhancer chưa nạp"}`
            }
            data-testid="video-enhanced-toggle"
            className={cn(
              "flex h-6 items-center gap-1 rounded-md border px-1.5 font-mono text-[11px] font-semibold transition-all disabled:opacity-40",
              enhanced ? ACCENT_SOFT.violet : "border-border bg-background/80 text-muted-foreground backdrop-blur-sm hover:text-foreground",
            )}
          >
            <Sparkles className="size-3" aria-hidden />
            Ảnh rõ
          </button>
      </div>
      </div>
      {offline ? (
        <div className="absolute inset-0 grid place-items-center" data-testid="camera-offline">
          <div className="flex flex-col items-center gap-2 text-center">
            <CameraOff className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-mono text-sm font-semibold tracking-widest text-foreground/80">CAMERA OFFLINE</p>
            <p className="text-xs text-muted-foreground">
              Thử lại mỗi {CAMERA_RETRY_MS / 1000} s. Telemetry và điều khiển KHÔNG bị ảnh hưởng.
            </p>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
