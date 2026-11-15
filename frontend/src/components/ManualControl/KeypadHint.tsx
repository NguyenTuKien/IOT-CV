/**
 * Sơ đồ phím cho người mới (plan Phase 10 §10.1.6). Phím đang giữ tô sáng —
 * nhìn là biết trình duyệt đang tin mình giữ phím nào. Sau một lần Alt-Tab, nếu
 * ô `W` vẫn sáng thì đó chính là lỗi §10.1.3 hiện hình.
 */
import { KEY_LABEL } from "@/lib/velocityMapping";
import { cn } from "@/lib/utils";

interface KeyCapProps {
  code: string;
  hint: string;
  /** Chữ ngắn in trên phím khi `hint` dài quá bề rộng phím (36 px); `hint` vẫn là tooltip. */
  short?: string;
  held: ReadonlySet<string>;
  wide?: boolean;
}

function KeyCap({ code, hint, short, held, wide }: KeyCapProps) {
  const on = held.has(code);
  return (
    <div
      data-testid={`key-${code}`}
      data-held={on}
      title={hint}
      className={cn(
        "flex flex-col items-center justify-center rounded-md border text-center transition-colors",
        wide ? "h-8 w-full flex-row gap-2" : "h-9 w-9",
        on
          ? "border-hud-amber/70 bg-hud-amber/20 text-hud-amber shadow-[0_0_14px_-4px] shadow-hud-amber"
          : "border-border bg-foreground/4 text-foreground/80 shadow-[inset_0_-2px_0] shadow-foreground/10",
      )}
    >
      <span className="font-mono text-[13px] leading-none font-semibold">{KEY_LABEL[code]}</span>
      <span className={cn("leading-none text-muted-foreground", wide ? "text-[10.5px] font-semibold tracking-wide" : "mt-0.5 text-[8.5px] whitespace-nowrap")}>{short ?? hint}</span>
    </div>
  );
}

/**
 * Bố cục như bàn phím thật: cụm Q W E / A S D, cột R F, cụm mũi tên, phím cách dài bên dưới.
 * Rộng ~300 px — vừa cột phải của trang Bay mà không xuống dòng lộn xộn.
 */
export function KeypadHint({ held, dimmed = false }: { held: readonly string[]; dimmed?: boolean }) {
  const set = new Set(held);
  return (
    <div className={cn("flex flex-col gap-1.5 transition-opacity", dimmed && "opacity-60")} aria-label="Sơ đồ phím lái tay">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
        <div className="grid grid-cols-3 gap-1">
          <KeyCap code="KeyQ" hint="xoay trái" short="↺ xoay" held={set} />
          <KeyCap code="KeyW" hint="tiến" held={set} />
          <KeyCap code="KeyE" hint="xoay phải" short="xoay ↻" held={set} />
          <KeyCap code="KeyA" hint="trái" held={set} />
          <KeyCap code="KeyS" hint="lùi" held={set} />
          <KeyCap code="KeyD" hint="phải" held={set} />
        </div>
        <div className="grid grid-cols-1 gap-1">
          <KeyCap code="KeyR" hint="lên" held={set} />
          <KeyCap code="KeyF" hint="xuống" held={set} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span />
          <KeyCap code="ArrowUp" hint="tiến" held={set} />
          <span />
          <KeyCap code="ArrowLeft" hint="trái" held={set} />
          <KeyCap code="ArrowDown" hint="lùi" held={set} />
          <KeyCap code="ArrowRight" hint="phải" held={set} />
        </div>
      </div>
      <KeyCap code="Space" hint="DỪNG NGAY" held={set} wide />
    </div>
  );
}
