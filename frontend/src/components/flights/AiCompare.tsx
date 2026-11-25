/**
 * AI trên VIDEO LỊCH SỬ BAY: khung gốc đã ghi đặt cạnh khung sau enhancer của XLA, chạy theo đầu
 * phát. Phát tới đâu, laptop xử lý tới đó, cùng model với luồng trực tiếp (`backend/flights/ai.py`).
 *
 * Hai cách xem: CẠNH NHAU (mặc định) hoặc THANH TRƯỢT kéo ranh giới trên cùng một khung. Hộp người
 * là detector chạy trên khung GỐC (D5), vẽ lên cả hai bên vì enhancer giữ nguyên toạ độ. Phóng to /
 * kéo dùng MỘT khung nhìn cho mọi ô (`AiViewer.tsx`, `lib/zoom.ts`): hai bên luôn soi đúng một chỗ.
 *
 * Mỗi lượt lấy đủ ba thứ của MỘT khung (gốc, số đo + hộp, ảnh rõ) rồi mới đổi hai bên cùng lúc, nên
 * hai bên luôn là cùng một khung. Đang xử lý thì không xếp hàng: xong lượt này mới lấy khung mới
 * nhất ở đầu phát. "Theo kịp video" đếm khung thật: khung AI đã hiện / khung có trong file đã phát
 * qua. Tắt "Hộp người" thì backend bỏ detector (`detect=false`), ảnh rõ theo video nhanh gần gấp đôi.
 *
 * Đã thử cho backend xử lý trước vài khung kế tiếp (19/11/2026): khi AI chậm hơn video, khung xử lý
 * trước không phải khung đầu phát xin tiếp, chỉ giành GPU — đo trên đoạn 13 khung/s còn tệ hơn. Bỏ.
 *
 * Nguồn bên phải (hợp đồng XLA §13, lưu ở `iot-cv.flight-ai-source`): "Ảnh rõ" trực tiếp, hoặc
 * "Ảnh rõ offline" — ảnh ×2 job offline dựng trước cho cả lần ghi (nút dựng + tiến độ ở thanh
 * dưới, hỏi lại mỗi 2 s khi job còn chạy). Khung chưa dựng thì bên phải là ảnh rõ trực tiếp kèm chip
 * "chưa dựng". Bên gốc luôn hiện, mọi nguồn. Model offline không có thì nút dựng tắt, ghi lý do.
 */
import { Columns2, Gauge, Images, Maximize, Pause, PersonStanding, Play, Sparkles, SquareSplitHorizontal, VideoOff, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Placeholder, SideBySide, SliderCompare } from "@/components/flights/AiViewer";
import type { CompareFrame } from "@/components/flights/AiViewer";
import { Chip, EmptyState, KeyValue, KeyValueList, Meter } from "@/components/kit";
import { useZoomView } from "@/hooks/useZoomView";
import {
  FRAME_STALE_S,
  FrameError,
  OFFLINE_POLL_MS,
  countKeepUp,
  fetchFrameAi,
  fetchFrameBlob,
  frameAt,
  getOffline,
  offlineActive,
  qualityDelta,
  readAiSource,
  startOffline,
  videoFpsAt,
  writeAiSource,
} from "@/lib/flights";
import type { FlightAiSource, FlightDetail, FlightFrameAI, FrameRef, ImageQuality, KeepUp, OfflineEnhanceStatus, OfflineRefusal } from "@/lib/flights";
import type { VisionModelStatus } from "@/lib/protocol.generated";
import { ACCENT_SOFT } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useTelemetryStore } from "@/store/telemetry";
import { VIEW_FIT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, zoomAt } from "@/lib/zoom";

type ViewMode = "side" | "slider";

const MODE_KEY = "iot-cv.flight-ai-mode";
const BOXES_KEY = "iot-cv.flight-ai-boxes";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Trình duyệt chặn lưu (chế độ riêng tư): chỉ mất lựa chọn ở lần mở sau.
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function revoke(f: CompareFrame | null) {
  if (!f) return;
  URL.revokeObjectURL(f.raw);
  if (f.enhanced) URL.revokeObjectURL(f.enhanced);
}

interface RightSide {
  blob: Blob | null;
  error: string | null;
  source: "enhanced" | "offline";
  offlineMissing: string | null;
}

/** Bên phải: ảnh offline khi chọn nguồn đó và khung đã dựng; chưa dựng (404) → ảnh rõ trực tiếp. */
async function loadRight(rec: string, n: number, source: FlightAiSource, signal: AbortSignal): Promise<RightSide> {
  const live = async (offlineMissing: string | null): Promise<RightSide> => {
    try {
      return { blob: await fetchFrameBlob(rec, n, "enhanced", { signal }), error: null, source: "enhanced", offlineMissing };
    } catch (e) {
      if (signal.aborted) throw e;
      return { blob: null, error: errorText(e), source: "enhanced", offlineMissing };
    }
  };
  if (source !== "offline") return live(null);
  try {
    return { blob: await fetchFrameBlob(rec, n, "offline", { signal }), error: null, source: "offline", offlineMissing: null };
  } catch (e) {
    if (signal.aborted) throw e;
    const missing = e instanceof FrameError && e.status === 404 ? e.message || "chưa dựng" : `ảnh offline lỗi: ${errorText(e)}`;
    return live(missing);
  }
}

async function loadCompare(rec: string, n: number, detect: boolean, source: FlightAiSource, signal: AbortSignal, offlineVersion: string | null): Promise<CompareFrame> {
  // Ba request cùng lúc: số đo và ảnh rõ cùng cần enhancer của khung này, backend gộp hai lần xin
  // thành MỘT lần chạy (`FlightFrameAIService._enhance`), nên không phải chờ nối đuôi.
  let aiError: string | null = null;
  const [rawBlob, ai, right] = await Promise.all([
    fetchFrameBlob(rec, n, "raw", { signal }),
    fetchFrameAi(rec, n, { signal }, detect).catch((e: unknown) => {
      if (signal.aborted) throw e;
      aiError = errorText(e);
      return null;
    }),
    loadRight(rec, n, source, signal),
  ]);
  return {
    key: frameKey(rec, n, detect, source),
    rec,
    n,
    raw: URL.createObjectURL(rawBlob),
    enhanced: right.blob ? URL.createObjectURL(right.blob) : null,
    enhancedError: right.error,
    enhancedSource: right.source,
    offlineMissing: right.offlineMissing,
    offlineVersion: right.source === "offline" ? offlineVersion : null,
    ai,
    aiError,
  };
}

/** Bật/tắt hộp người là xin lại khung với/không detector, nên cờ nằm trong khoá; nguồn cũng vậy. */
function frameKey(rec: string, n: number, detect: boolean, source: FlightAiSource | string = "enhanced"): string {
  return `${rec}:${n}:${detect ? "d" : "e"}:${source}`;
}

/** Khung đang hiện của khối AI: luôn đổi trọn cặp (gốc + ảnh rõ + số đo) của cùng một khung. */
function useCompareFrame(ref: FrameRef | null, playing: boolean, detect: boolean, source: FlightAiSource, offlineGen: string, offlineVersion: string | null) {
  const rec = ref?.rec ?? null;
  const n = ref?.n ?? null;
  // `offlineGen` đổi khi job offline xong: khung đang hiện (có thể là ảnh rõ dự phòng) được xin lại.
  const sourceKey = source === "offline" ? `offline-${offlineGen}` : source;
  const key = rec != null && n != null ? frameKey(rec, n, detect, sourceKey) : null;
  const [shown, setShown] = useState<CompareFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keepUp, setKeepUp] = useState<KeepUp | null>(null);
  const busy = useRef(false);
  const failed = useRef<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const want = useRef<{ rec: string; n: number; detect: boolean; source: FlightAiSource; version: string | null; key: string } | null>(null);
  const shownKey = useRef<string | null>(null);
  const pump = useRef<() => void>(() => {});
  const playingNow = useRef(playing);
  const session = useRef(0);
  const counted = useRef<{ session: number; keepUp: KeepUp; last: { rec: string; n: number } | null }>({
    session: -1,
    keepUp: { shown: 0, skipped: 0 },
    last: null,
  });

  useEffect(() => {
    const c = new AbortController();
    ctrl.current = c;
    return () => c.abort();
  }, []);

  // Mỗi lần bấm Phát là một lượt đếm "theo kịp" mới.
  useEffect(() => {
    playingNow.current = playing;
    if (playing) session.current += 1;
  }, [playing]);

  // Khung cũ thôi hiện thì trả bộ nhớ của hai ảnh.
  useEffect(() => () => revoke(shown), [shown]);

  // Vòng lấy khung: xong một khung là xin ngay khung mới nhất ở đầu phát (đọc qua ref), không chờ
  // React vẽ lại một vòng rồi mới chạy effect. Chỉ đọc/ghi ref và gọi setter, nên dựng một lần.
  useEffect(() => {
    pump.current = () => {
      const target = want.current;
      const signal = ctrl.current?.signal;
      if (!target || !signal || signal.aborted || busy.current) return;
      if (target.key === shownKey.current || target.key === failed.current) return;
      busy.current = true;
      loadCompare(target.rec, target.n, target.detect, target.source, signal, target.version)
        .then((loaded) => {
          const next = { ...loaded, key: target.key };
          if (signal.aborted) {
            revoke(next);
            return;
          }
          if (playingNow.current) {
            const c = counted.current;
            const fresh = c.session !== session.current;
            const base = fresh ? { shown: 0, skipped: 0 } : c.keepUp;
            const now = countKeepUp(base, fresh ? null : c.last, next);
            counted.current = { session: session.current, keepUp: now, last: { rec: next.rec, n: next.n } };
            setKeepUp(now);
          }
          failed.current = null;
          shownKey.current = next.key;
          setShown(next);
          setError(null);
        })
        .catch((e: unknown) => {
          if (signal.aborted) return;
          failed.current = target.key;
          setError(errorText(e));
        })
        .finally(() => {
          busy.current = false;
          pump.current();
        });
    };
  }, []);

  useEffect(() => {
    want.current = rec != null && n != null && key != null ? { rec, n, detect, source, version: offlineVersion, key } : null;
    pump.current();
  }, [rec, n, detect, source, offlineVersion, key]);

  return { shown, error, keepUp };
}

/** Job ảnh rõ offline của lần ghi `rec` (null = không hỏi): trạng thái, hỏi lại khi còn chạy, nút dựng. */
function useOfflineJob(rec: string | null, pollMs: number) {
  const [status, setStatus] = useState<OfflineEnhanceStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ rec: string; refusal: OfflineRefusal } | null>(null);
  const [starting, setStarting] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!rec) return;
    const c = new AbortController();
    getOffline(rec, { signal: c.signal })
      .then((st) => {
        setStatus(st);
        setStatusError(null);
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setStatusError(errorText(e));
      });
    return () => c.abort();
  }, [rec, tick]);

  const mine = status && status.rec === rec ? status : null;
  const active = offlineActive(mine?.state);
  // Hỏi lại sau mỗi lần nhận trạng thái mới, chỉ khi job còn chạy / chờ / tạm dừng.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setTick((x) => x + 1), pollMs);
    return () => clearTimeout(t);
  }, [active, mine, pollMs]);

  const start = useCallback(async () => {
    if (!rec) return;
    setStarting(true);
    setRefusal(null);
    try {
      const r = await startOffline(rec);
      if (r.ok) {
        const a = r.accepted;
        setStatus((s) => ({
          rec: a.rec,
          state: a.state,
          done: a.done,
          total: a.total,
          bundle_version: s?.rec === a.rec ? (s.bundle_version ?? null) : null,
          s_per_frame: s?.rec === a.rec ? (s.s_per_frame ?? null) : null,
          reason: null,
        }));
      } else {
        setRefusal({ rec, refusal: r.refusal });
      }
    } catch (e) {
      setRefusal({ rec, refusal: { status: 0, error: "network", reason: errorText(e) } });
    } finally {
      setStarting(false);
      setTick((x) => x + 1);
    }
  }, [rec]);

  return { status: mine, statusError, refusal: refusal && refusal.rec === rec ? refusal.refusal : null, starting, start };
}

type OfflineJob = ReturnType<typeof useOfflineJob>;

const OFFLINE_STATE: Record<OfflineEnhanceStatus["state"], { text: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  none: { text: "chưa dựng", tone: "neutral" },
  queued: { text: "đang chờ", tone: "neutral" },
  running: { text: "đang dựng", tone: "ok" },
  paused: { text: "tạm dừng", tone: "warn" },
  done: { text: "đã dựng xong", tone: "ok" },
  failed: { text: "lỗi", tone: "danger" },
};

/** Thanh dựng ảnh rõ offline cho lần ghi đang xem: nút, tiến độ, lý do dừng / từ chối. */
function OfflineBar({ job }: { job: OfflineJob }) {
  const st = job.status;
  const unavailable = st && !st.bundle_version ? (st.reason ?? "model offline chưa nạp") : null;
  const active = offlineActive(st?.state);
  const done = st?.state === "done";
  const view = st ? OFFLINE_STATE[st.state] : null;
  const pct = st && st.total > 0 ? st.done / st.total : null;
  let reason: string | null = null;
  let reasonTone: "warn" | "danger" = "warn";
  if (job.refusal) {
    reason = job.refusal.reason;
    reasonTone = job.refusal.status === 409 ? "warn" : "danger";
  } else if (unavailable) {
    reason = `Không dựng được: ${unavailable}`;
  } else if (st?.reason && (st.state === "paused" || st.state === "failed")) {
    reason = st.reason;
    reasonTone = st.state === "failed" ? "danger" : "warn";
  } else if (job.statusError) {
    reason = `Không đọc được tiến độ: ${job.statusError}`;
  }
  const label = done ? "Đã dựng ảnh rõ offline" : st && st.done > 0 && !active ? "Dựng tiếp ảnh rõ offline" : "Dựng ảnh rõ offline cho chuyến này";
  const meterTone = view?.tone === "danger" ? "danger" : view?.tone === "warn" ? "warn" : "ok";
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/70 bg-foreground/[0.012] px-2 py-1.5"
      data-testid="flight-ai-offline-bar"
      data-state={st?.state ?? "unknown"}
    >
      <ToolButton
        onClick={() => void job.start()}
        disabled={!st || !!unavailable || active || done || job.starting}
        title={unavailable ? `Không dựng được: ${unavailable}` : "Tính trước ảnh ×2 cho mọi khung của lần ghi này (nền, chỉ khi drone không bay)"}
        icon={WandSparkles}
        testId="flight-ai-offline-start"
      >
        {label}
      </ToolButton>
      {st ? (
        <span className="flex min-w-48 flex-1 items-center gap-2">
          <Meter value={pct} tone={meterTone} className="flex-1" />
          <span className="num font-mono text-[11px] text-foreground" data-testid="flight-ai-offline-progress">
            {st.done}/{st.total} khung
          </span>
          {view ? (
            <Chip tone={view.tone} size="xs" dot={st.state === "running"} pulse={st.state === "running"} testId="flight-ai-offline-state">
              {view.text}
            </Chip>
          ) : null}
          {st.s_per_frame != null ? <span className="num font-mono text-[11px] text-muted-foreground">{st.s_per_frame.toFixed(2)} s/khung</span> : null}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">đang hỏi tiến độ…</span>
      )}
      {reason ? (
        <Chip tone={reasonTone} size="xs" className="h-auto max-w-full py-0.5 whitespace-normal" title={reason} testId="flight-ai-offline-reason">
          {reason}
        </Chip>
      ) : null}
    </div>
  );
}

/** Nút trên thanh công cụ. Có `active` thì là nút bật/tắt (aria-pressed); không có là nút lệnh. */
function ToolButton({
  active,
  disabled,
  onClick,
  title,
  icon: Icon,
  children,
  testId,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  icon: typeof Play;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={children ? undefined : title}
      title={title}
      data-testid={testId}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] font-semibold transition-colors disabled:opacity-40",
        active ? ACCENT_SOFT.violet : "border-border bg-background/80 text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

function fmt(v: number | null | undefined, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

function deltaText(raw: number | undefined, enhanced: number | undefined): string {
  const d = qualityDelta(raw, enhanced);
  if (d == null) return "";
  return ` (${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(0)}%)`;
}

const QUALITY_ROWS: { key: keyof ImageQuality; label: string; sub: string; hint: string; digits: number }[] = [
  { key: "brightness", label: "Độ sáng", sub: "mức xám TB, 0–255", hint: "Trung bình mức xám của khung", digits: 0 },
  { key: "contrast", label: "Tương phản", sub: "độ lệch chuẩn", hint: "Độ lệch chuẩn mức xám", digits: 1 },
  { key: "sharpness", label: "Độ nét", sub: "phương sai Laplace", hint: "Phương sai Laplace: cạnh rõ làm số tăng, nhưng nhiễu cũng làm số tăng", digits: 0 },
];

/** Dưới chừng này phần khung bị bỏ thì coi là theo kịp video. */
const KEEP_UP_OK = 0.1;

function modelSub(ai: FlightFrameAI | null): string {
  if (!ai) return "detector + enhancer";
  const part = (name: string, ms: number | null | undefined, reason: string | null | undefined) =>
    ms != null ? `${name} ${fmt(ms)} ms` : `${name}: ${reason ?? "không chạy"}`;
  return `${part("detector", ai.detector_ms, ai.detector.reason)} · ${part("enhancer", ai.enhancer_ms, ai.enhancer.reason)}`;
}

/**
 * Ghi chú dưới bảng số đo: enhancer nào đang dựng ảnh rõ (phiên bản của khung này, không có thì
 * của trạng thái backend) và luồng trực tiếp bật "Ảnh rõ" sẵn hay không (`enhancer_default_on`).
 * Không ghi cứng phiên bản: đổi bundle thì chữ tự đổi theo.
 */
function enhancerNote(ai: FlightFrameAI | null, live: VisionModelStatus | null, defaultOn: boolean | null): string {
  const st = ai?.enhancer ?? live;
  if (!st || (st.state !== "loaded" && st.state !== "ready")) {
    return `Enhancer chưa nạp${st?.reason ? `: ${st.reason}` : ""}, bên phải chưa có ảnh rõ.`;
  }
  const version = st.version ?? live?.version ?? null;
  const name = version ? `Enhancer v${version.replace(/^v/, "")}` : "Enhancer";
  if (defaultOn == null) return `${name} dựng ảnh rõ bên phải.`;
  return defaultOn
    ? `${name} dựng ảnh rõ bên phải; luồng trực tiếp bật "Ảnh rõ" sẵn, người xem tắt được.`
    : `${name} dựng ảnh rõ bên phải; luồng trực tiếp để khung gốc sẵn, người xem tự bật "Ảnh rõ".`;
}

function FrameStats({
  frame,
  keepUp,
  videoFps,
  boxesOn,
}: {
  frame: CompareFrame | null;
  keepUp: KeepUp | null;
  videoFps: number;
  boxesOn: boolean;
}) {
  const ai = frame?.ai ?? null;
  const liveEnhancer = useTelemetryStore((s) => s.status?.vision?.enhancer ?? null);
  const defaultOn = useTelemetryStore((s) => s.status?.vision?.enhancer_default_on ?? null);
  const top = ai && ai.boxes.length > 0 ? Math.max(...ai.boxes.map((b) => b.confidence)) : null;
  const qr = ai?.quality_raw ?? undefined;
  const qe = ai?.quality_enhanced ?? undefined;
  const modelMs = ai ? Math.max(ai.detector_ms ?? 0, ai.enhancer_ms ?? 0) : 0;
  const total = keepUp ? keepUp.shown + keepUp.skipped : 0;
  const keepsUp = keepUp && total > 0 ? keepUp.skipped / total <= KEEP_UP_OK : null;
  return (
    <aside className="flex flex-col gap-3" data-testid="flight-ai-stats">
      <KeyValueList title="Khung này" icon={Gauge}>
        <KeyValue label="Khung" value={frame ? `#${frame.n}` : "—"} sub={frame ? `lần ghi ${frame.rec}` : undefined} />
        <KeyValue
          label="Người phát hiện"
          icon={PersonStanding}
          accent="green"
          value={ai ? String(ai.boxes.length) : "—"}
          sub={top != null ? `tin cậy cao nhất ${Math.round(top * 100)}%` : (ai?.note ?? frame?.aiError ?? "detector trên khung gốc (D5)")}
          testId="flight-ai-people"
        />
        <KeyValue
          label="Model trên laptop"
          value={modelMs > 0 ? `${fmt(modelMs, 0)} ms` : "—"}
          sub={modelSub(ai)}
          hint="Detector và enhancer chạy song song trên GPU của laptop; khung xong sau bước lâu hơn"
          testId="flight-ai-model"
        />
        <KeyValue
          label="Theo kịp video"
          value={keepUp && total > 0 ? `${keepUp.shown}/${total}` : "—"}
          tone={keepsUp == null ? undefined : keepsUp ? "ok" : "warn"}
          sub={keepUp ? `khung · video gốc ${videoFps.toFixed(1)} khung/s` : "bấm Phát để đo"}
          hint="Số khung AI đã xử lý và hiện / số khung có trong file ghi đã phát qua, từ lúc bấm Phát"
          testId="flight-ai-keepup"
        />
      </KeyValueList>
      {keepsUp === false && boxesOn ? (
        <p className="text-[11px] leading-snug text-muted-foreground" data-testid="flight-ai-keepup-tip">
          AI chưa theo kịp video ở đoạn này. Tắt <b>Hộp người</b> thì chỉ chạy enhancer, ảnh rõ theo video nhanh gần gấp đôi.
        </p>
      ) : null}
      <KeyValueList title="Gốc → ảnh rõ" icon={Sparkles}>
        {QUALITY_ROWS.map((r) => (
          <KeyValue
            key={r.key}
            label={r.label}
            sub={r.sub}
            hint={r.hint}
            value={qr ? `${fmt(qr[r.key], r.digits)} → ${qe ? fmt(qe[r.key], r.digits) : "—"}${deltaText(qr[r.key], qe?.[r.key])}` : "—"}
            testId={`flight-ai-q-${r.key}`}
          />
        ))}
      </KeyValueList>
      <p className="text-[11px] leading-snug text-muted-foreground" data-testid="flight-ai-enhancer-note">
        {enhancerNote(ai, liveEnhancer, defaultOn)} Số đo trên không thay được mắt người xem: hãy so hai bên.
      </p>
    </aside>
  );
}

export function AiCompare({
  flight,
  cursor,
  playing,
  onPlay,
  offlinePollMs = OFFLINE_POLL_MS,
}: {
  flight: FlightDetail;
  cursor: number;
  playing: boolean;
  onPlay: (playing: boolean) => void;
  /** Nhịp hỏi lại tiến độ job offline (test truyền nhỏ). */
  offlinePollMs?: number;
}) {
  const ref = frameAt(flight.video, cursor);
  const [mode, setMode] = useState<ViewMode>(() => (readPref(MODE_KEY) === "slider" ? "slider" : "side"));
  const [boxes, setBoxes] = useState(() => readPref(BOXES_KEY) !== "0");
  const [source, setSource] = useState<FlightAiSource>(readAiSource);
  // Job offline theo lần ghi đang xem (chuyến có thể gồm nhiều lần ghi); chỉ hỏi khi chọn nguồn offline.
  const jobRec = ref?.rec ?? flight.video[0]?.rec ?? null;
  const job = useOfflineJob(source === "offline" ? jobRec : null, offlinePollMs);
  const offlineGen = job.status?.state === "done" ? "done" : "partial";
  const { shown, error, keepUp } = useCompareFrame(ref, playing, boxes, source, offlineGen, job.status?.bundle_version ?? null);
  // Một khung nhìn cho mọi ô: giữ nguyên khi đổi khung (đang phát) và khi đổi cách xem.
  const zoom = useZoomView();
  const zoomStep = (factor: number) => zoom.apply(zoomAt(zoom.latest.current, factor, 0.5, 0.5));
  const pickMode = (m: ViewMode) => {
    setMode(m);
    writePref(MODE_KEY, m);
  };
  const pickSource = (next: FlightAiSource) => {
    setSource(next);
    writeAiSource(next);
  };
  const toggleBoxes = () => {
    setBoxes((b) => {
      writePref(BOXES_KEY, b ? "0" : "1");
      return !b;
    });
  };

  if (flight.video.length === 0) {
    return (
      <EmptyState icon={VideoOff} title="Chuyến này không có video để AI xử lý">
        Backend chưa chạy, laptop ngủ, hoặc ghi hình tắt trong lúc bay.
      </EmptyState>
    );
  }

  const stale = !ref || ref.age > FRAME_STALE_S;
  const ai = shown?.ai ?? null;
  const aspect = ai ? `${ai.width} / ${ai.height}` : "4 / 3";
  let viewer: ReactNode;
  if (shown) {
    const props = { frame: shown, aspect, boxes, zoom };
    viewer = mode === "side" ? <SideBySide {...props} /> : <SliderCompare {...props} />;
  } else {
    viewer = (
      <div className="relative rounded-md bg-black" style={{ aspectRatio: "8 / 3" }}>
        <Placeholder>{error ? `Không lấy được khung: ${error}` : "Đang xử lý khung đầu tiên…"}</Placeholder>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="flight-ai" data-mode={mode} data-source={source}>
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton active={playing} onClick={() => onPlay(!playing)} title={playing ? "Dừng phát" : "Phát chuyến bay, AI xử lý theo"} icon={playing ? Pause : Play} testId="flight-ai-play">
          {playing ? "Dừng" : "Phát"}
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton active={mode === "side"} onClick={() => pickMode("side")} title="Gốc và ảnh rõ đặt cạnh nhau" icon={Columns2} testId="flight-ai-mode-side">
          Cạnh nhau
        </ToolButton>
        <ToolButton active={mode === "slider"} onClick={() => pickMode("slider")} title="Một khung, kéo ranh giới gốc / ảnh rõ" icon={SquareSplitHorizontal} testId="flight-ai-mode-slider">
          Thanh trượt
        </ToolButton>
        <ToolButton active={boxes} onClick={toggleBoxes} title="Vẽ hộp người của detector (chạy trên khung gốc)" icon={PersonStanding} testId="flight-ai-boxes-toggle">
          Hộp người
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton active={source === "enhanced"} onClick={() => pickSource("enhanced")} title="Bên phải: ảnh rõ trực tiếp (enhancer chạy theo đầu phát)" icon={Sparkles} testId="flight-ai-source-enhanced">
          Ảnh rõ
        </ToolButton>
        <ToolButton
          active={source === "offline"}
          onClick={() => pickSource("offline")}
          title="Bên phải: ảnh rõ offline ×2 do AI dựng lại, tính trước cho cả lần ghi"
          icon={Images}
          testId="flight-ai-source-offline"
        >
          Ảnh rõ offline (AI dựng lại)
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton onClick={() => zoomStep(1 / ZOOM_STEP)} disabled={zoom.view.s <= ZOOM_MIN} title="Thu nhỏ (cả hai bên)" icon={ZoomOut} testId="flight-ai-zoom-out" />
        <span className="num w-10 text-center font-mono text-[11px] font-semibold text-foreground" title="Độ phóng của cả hai bên" data-testid="flight-ai-zoom">
          {zoom.view.s.toFixed(1)}×
        </span>
        <ToolButton onClick={() => zoomStep(ZOOM_STEP)} disabled={zoom.view.s >= ZOOM_MAX} title="Phóng to (cả hai bên)" icon={ZoomIn} testId="flight-ai-zoom-in" />
        <ToolButton onClick={() => zoom.apply(VIEW_FIT)} disabled={zoom.view.s <= ZOOM_MIN} title="Về vừa khung" icon={Maximize} testId="flight-ai-zoom-fit">
          Vừa khung
        </ToolButton>
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {error && shown ? (
            <Chip tone="warn" size="xs" mono title={error}>
              khung mới lỗi, đang giữ khung #{shown.n}
            </Chip>
          ) : null}
          {shown && ref && shown.n !== ref.n ? (
            <Chip tone="slate" size="xs" mono title="Khung ở đầu phát còn đang được xử lý">
              đang xử lý…
            </Chip>
          ) : null}
        </span>
      </div>
      {source === "offline" ? <OfflineBar job={job} /> : null}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            {viewer}
            {stale && shown ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-md bg-black/55 text-center">
                <div className="font-mono text-sm font-semibold tracking-widest text-hud-red">
                  MẤT HÌNH
                  <div className="mt-1 text-[11px] font-normal tracking-normal text-white/70">
                    {ref ? `khung cuối cách ${ref.age.toFixed(1)} s` : "chưa có khung nào"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground" data-testid="flight-ai-zoom-hint">
            Lăn chuột trên ảnh để phóng to, kéo để di chuyển, nhấp đúp để phóng to hoặc về vừa khung. Hai bên luôn phóng cùng một chỗ
            {mode === "slider" ? "; kéo tay nắm tròn để dời ranh giới gốc / ảnh rõ." : "."}
          </p>
        </div>
        <FrameStats frame={shown} keepUp={keepUp} videoFps={videoFpsAt(flight.video, cursor)} boxesOn={boxes} />
      </div>
    </div>
  );
}
