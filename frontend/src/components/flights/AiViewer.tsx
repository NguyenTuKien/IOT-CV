/**
 * Khung xem của khối AI trang Lịch sử bay: CẠNH NHAU hoặc THANH TRƯỢT, cả hai phóng to được.
 *
 * Zoom dùng chung MỘT `ZoomControl` cho mọi ô: mỗi ô là một `ZoomSurface` (bắt lăn chuột, kéo, nhấp
 * đúp) bọc một `ZoomLayer` (ảnh, chịu transform). Lăn hay kéo ở ô gốc thì ô ảnh rõ đổi theo đúng như
 * vậy và ngược lại, nên hai bên luôn cho thấy cùng một chỗ của cùng một khung.
 *
 * Hộp người vẽ NGOÀI lớp phóng, theo toạ độ khung nhìn (`projectRect`): viền 2 px và nhãn giữ đúng cỡ
 * ở mọi độ phóng. Đặt trong lớp rồi bù `2/s px` thì không được: Chrome làm tròn viền dưới 1 px lên
 * 1 px TRƯỚC khi phóng, viền dày dần tới ~8 px ở 8× (đo 19/11/2026).
 *
 * Thanh trượt: ranh giới cắt theo KHUNG NHÌN (lớp bọc không phóng), không theo ảnh, nên phóng to
 * vẫn giữ ranh giới đứng yên trên màn hình. Kéo tay nắm tròn luôn là dời ranh giới; kéo chỗ khác lúc
 * đang phóng là di chuyển ảnh, lúc vừa khung là dời ranh giới như trước.
 */
import { ChevronsLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import { Chip } from "@/components/kit";
import type { ZoomControl } from "@/hooks/useZoomView";
import { boxPercent } from "@/lib/flights";
import type { FlightFrameAI } from "@/lib/flights";
import { ACCENT_SOLID, ACCENT_VAR } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { VIEW_FIT, ZOOM_DOUBLE_CLICK, ZOOM_MIN, panBy, projectRect, viewTransform, visibleRect, wheelAtLimit, wheelFactor, zoomAt } from "@/lib/zoom";
import type { ZoomView } from "@/lib/zoom";

/**
 * Một khung đang hiện: gốc + ảnh rõ + số đo của CÙNG một khung (object URL của hai JPEG). Bên phải
 * là ảnh rõ trực tiếp (`enhancedSource: "enhanced"`, 640×480) hoặc ảnh offline AI dựng lại
 * (`"offline"`, 1280×960, hợp đồng XLA §13); hai cỡ cùng tỉ lệ 4:3 nên hộp người vẫn khớp.
 * `offlineMissing`: người xem chọn offline nhưng khung này chưa dựng — bên phải là ảnh rõ trực tiếp.
 */
export interface CompareFrame {
  key: string;
  rec: string;
  n: number;
  raw: string;
  enhanced: string | null;
  enhancedError: string | null;
  enhancedSource?: "enhanced" | "offline";
  offlineMissing?: string | null;
  offlineVersion?: string | null;
  ai: FlightFrameAI | null;
  aiError: string | null;
}

interface ViewerProps {
  frame: CompareFrame;
  aspect: string;
  boxes: boolean;
  zoom: ZoomControl;
}

/** Hộp cách mép trên khung nhìn ít hơn chừng này phần trăm thì nhãn nằm trong hộp. */
const LABEL_INSIDE_PCT = 5;
/** Phần tử mang `data-zoom-plain` (tay nắm thanh trượt): kéo luôn là dời ranh giới, không di ảnh. */
const PLAIN_SELECTOR = "[data-zoom-plain]";

function pointIn(node: Element, clientX: number, clientY: number) {
  const r = node.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { x: 0.5, y: 0.5, w: 0, h: 0 };
  return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height, w: r.width, h: r.height };
}

function onPlainTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(PLAIN_SELECTOR) != null;
}

function ZoomSurface({
  zoom,
  className,
  style,
  children,
  onPlainPointer,
  plainCursor,
  testId,
}: {
  zoom: ZoomControl;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Kéo lúc ảnh vừa khung, hoặc kéo tay nắm: nhận vị trí ngang 0–1 của con trỏ trong ô. */
  onPlainPointer?: (fx: number) => void;
  plainCursor?: string;
  testId?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; pan: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const { latest, apply } = zoom;

  // Lăn chuột phải là listener gốc `passive: false`: onWheel của React thụ động, không chặn được cuộn trang.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      const v = latest.current;
      if (wheelAtLimit(v, e.deltaY)) return;
      e.preventDefault();
      const p = pointIn(node, e.clientX, e.clientY);
      apply(zoomAt(v, wheelFactor(e.deltaY, e.deltaMode, p.h), p.x, p.y));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [latest, apply]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pan = latest.current.s > ZOOM_MIN && !onPlainTarget(e.target);
    if (!pan && !onPlainPointer) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan };
    setDragging(true);
    if (!pan) onPlainPointer?.(pointIn(e.currentTarget, e.clientX, e.clientY).x);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = pointIn(e.currentTarget, e.clientX, e.clientY);
    if (!d.pan) {
      onPlainPointer?.(p.x);
      return;
    }
    if (p.w === 0 || p.h === 0) return;
    apply(panBy(latest.current, (e.clientX - d.x) / p.w, (e.clientY - d.y) / p.h));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };
  const onDouble = (e: MouseEvent<HTMLDivElement>) => {
    if (onPlainTarget(e.target)) return;
    const v = latest.current;
    if (v.s > ZOOM_MIN) {
      apply(VIEW_FIT);
      return;
    }
    const p = pointIn(e.currentTarget, e.clientX, e.clientY);
    apply(zoomAt(v, ZOOM_DOUBLE_CLICK, p.x, p.y));
  };

  const zoomed = zoom.view.s > ZOOM_MIN;
  return (
    <div
      ref={el}
      className={cn(
        "relative overflow-hidden select-none",
        (zoomed || onPlainPointer) && "touch-none",
        zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : plainCursor,
        className,
      )}
      style={style}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onDouble}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Ảnh + hộp người của một bên, chịu transform zoom chung. */
function ZoomLayer({ view, children }: { view: ZoomView; children: ReactNode }) {
  return (
    <div className="absolute inset-0 origin-top-left" style={{ transform: viewTransform(view) }} data-testid="flight-ai-layer">
      {children}
    </div>
  );
}

/** Bản đồ nhỏ ở góc: khung trắng là phần ảnh đang thấy khi phóng to. */
function ZoomMap({ view, aspect }: { view: ZoomView; aspect: string }) {
  if (view.s <= ZOOM_MIN) return null;
  const r = visibleRect(view);
  return (
    <div
      className="pointer-events-none absolute right-2 bottom-2 z-10 w-16 rounded-sm border border-white/70 bg-black/45"
      style={{ aspectRatio: aspect }}
      data-testid="flight-ai-zoom-map"
      aria-hidden
    >
      <div
        className="absolute border border-white bg-white/20"
        style={{ left: `${r.left * 100}%`, top: `${r.top * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}
      />
    </div>
  );
}

/** Hộp người trên khung nhìn (ngoài lớp phóng): đi theo zoom nhưng viền và nhãn giữ cỡ màn hình. */
function BoxLayer({ ai, view }: { ai: FlightFrameAI | null; view: ZoomView }) {
  if (!ai || ai.boxes.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="flight-ai-boxes" data-boxes={ai.boxes.length}>
      {ai.boxes.map((b, i) => {
        const p = projectRect(boxPercent(b, ai.width, ai.height), view);
        const inside = p.top < LABEL_INSIDE_PCT;
        // Hộp nhô lên quá mép trên (đang phóng / kéo): nhãn bám mép trên phần hộp còn thấy.
        const labelTop = inside && p.height > 0 ? Math.min(100, Math.max(0, -p.top) / p.height * 100) : null;
        return (
          <div
            key={`${i}-${b.x1}-${b.y1}`}
            className="absolute rounded-xs border-2"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%`, borderColor: ACCENT_VAR.green }}
          >
            <span
              className={cn(
                "absolute -left-0.5 rounded-sm px-1 font-mono text-[10px] leading-4 whitespace-nowrap",
                // Hộp sát mép trên khung nhìn: nhãn vào trong hộp, không bị cắt.
                inside ? null : "-top-4",
                ACCENT_SOLID.green,
              )}
              style={labelTop == null ? undefined : { top: `${labelTop}%` }}
            >
              người {Math.round(b.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SideLabel({ children, accent, right }: { children: ReactNode; accent: "slate" | "violet"; right?: boolean }) {
  return (
    <Chip tone={accent} variant="solid" size="xs" mono className={cn("pointer-events-none absolute top-2 z-10", right ? "right-2" : "left-2")}>
      {children}
    </Chip>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/75">{children}</div>;
}

function enhancedLabel(frame: CompareFrame): string {
  if (frame.enhancedSource === "offline") {
    const v = frame.offlineVersion;
    return v ? `ẢNH RÕ OFFLINE · AI dựng lại · v${v}` : "ẢNH RÕ OFFLINE · AI dựng lại";
  }
  const v = frame.ai?.enhancer.version;
  return v ? `ẢNH RÕ · enhancer-v${v}` : "ẢNH RÕ (AI)";
}

/** Chip trên bên phải: "ảnh do AI dựng lại" (offline) hoặc "chưa dựng" (offline thiếu khung này). */
function SourceNote({ frame, right }: { frame: CompareFrame; right?: boolean }) {
  const pos = cn("pointer-events-none absolute top-9 z-10", right ? "right-2" : "left-2");
  if (frame.enhancedSource === "offline") {
    return (
      <Chip tone="indigo" variant="solid" size="xs" className={pos} title="Ảnh ×2 do mạng sinh dựng lại: chi tiết có thể là AI đoán, không phải camera thấy" testId="flight-ai-offline-note">
        ảnh do AI dựng lại
      </Chip>
    );
  }
  if (frame.offlineMissing) {
    return (
      <Chip tone="warn" variant="solid" size="xs" mono className={pos} title={frame.offlineMissing} testId="flight-ai-offline-missing">
        chưa dựng · đang xem ảnh rõ trực tiếp
      </Chip>
    );
  }
  return null;
}

function enhancedMissing(f: CompareFrame): string {
  return `Ảnh rõ không có: ${f.enhancedError ?? f.ai?.enhancer.reason ?? "enhancer chưa nạp"}`;
}

function RawImage({ frame }: { frame: CompareFrame }) {
  return <img src={frame.raw} alt={`Khung gốc ${frame.n}`} className="absolute inset-0 size-full object-fill" draggable={false} data-testid="flight-ai-raw" />;
}

function EnhancedImage({ src, n, offline }: { src: string; n: number; offline?: boolean }) {
  const alt = offline ? `Khung ${n} ảnh offline AI dựng lại` : `Khung ${n} sau enhancer`;
  return (
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 size-full object-fill"
      draggable={false}
      data-testid="flight-ai-enhanced"
      data-source={offline ? "offline" : "enhanced"}
    />
  );
}

export function SideBySide({ frame, aspect, boxes, zoom }: ViewerProps) {
  const { view } = zoom;
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="flight-ai-side">
      <ZoomSurface zoom={zoom} className="rounded-md bg-black" style={{ aspectRatio: aspect }} testId="flight-ai-surface-raw">
        <ZoomLayer view={view}>
          <RawImage frame={frame} />
        </ZoomLayer>
        {boxes ? <BoxLayer ai={frame.ai} view={view} /> : null}
        <SideLabel accent="slate">GỐC · camera</SideLabel>
        <ZoomMap view={view} aspect={aspect} />
      </ZoomSurface>
      <ZoomSurface zoom={zoom} className="rounded-md bg-black" style={{ aspectRatio: aspect }} testId="flight-ai-surface-enhanced">
        {frame.enhanced ? (
          <>
            <ZoomLayer view={view}>
              <EnhancedImage src={frame.enhanced} n={frame.n} offline={frame.enhancedSource === "offline"} />
            </ZoomLayer>
            {boxes ? <BoxLayer ai={frame.ai} view={view} /> : null}
          </>
        ) : (
          <Placeholder>{enhancedMissing(frame)}</Placeholder>
        )}
        <SideLabel accent="violet">{enhancedLabel(frame)}</SideLabel>
        <SourceNote frame={frame} />
        <ZoomMap view={view} aspect={aspect} />
      </ZoomSurface>
    </div>
  );
}

export function SliderCompare({ frame, aspect, boxes, zoom }: ViewerProps) {
  const [pos, setPos] = useState(50);
  const { view } = zoom;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const next = { ArrowLeft: pos - step, ArrowRight: pos + step, Home: 0, End: 100 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setPos(Math.max(0, Math.min(100, next)));
  };
  return (
    <ZoomSurface
      zoom={zoom}
      className="mx-auto w-full max-w-[min(69dvh,640px)] rounded-md bg-black"
      style={{ aspectRatio: aspect }}
      onPlainPointer={(fx) => setPos(Math.max(0, Math.min(100, fx * 100)))}
      plainCursor="cursor-ew-resize"
      testId="flight-ai-slider"
    >
      <ZoomLayer view={view}>
        <RawImage frame={frame} />
      </ZoomLayer>
      {boxes ? <BoxLayer ai={frame.ai} view={view} /> : null}
      {frame.enhanced ? (
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} data-testid="flight-ai-enhanced-clip">
          <ZoomLayer view={view}>
            <EnhancedImage src={frame.enhanced} n={frame.n} offline={frame.enhancedSource === "offline"} />
          </ZoomLayer>
          {boxes ? <BoxLayer ai={frame.ai} view={view} /> : null}
        </div>
      ) : (
        <div className="absolute inset-y-0 right-0 bg-black/70" style={{ left: `${pos}%` }}>
          <Placeholder>{enhancedMissing(frame)}</Placeholder>
        </div>
      )}
      <SideLabel accent="slate">GỐC</SideLabel>
      <SideLabel accent="violet" right>
        {enhancedLabel(frame)}
      </SideLabel>
      <SourceNote frame={frame} right />
      <ZoomMap view={view} aspect={aspect} />
      <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white/90" style={{ left: `${pos}%` }}>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Ranh giới gốc / ảnh rõ"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% gốc`}
          onKeyDown={onKey}
          data-zoom-plain=""
          className="pointer-events-auto absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-border bg-background text-foreground shadow-md"
          data-testid="flight-ai-handle"
        >
          <ChevronsLeftRight className="size-4" aria-hidden />
        </div>
      </div>
    </ZoomSurface>
  );
}
