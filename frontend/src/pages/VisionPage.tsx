/**
 * Trang CAMERA & AI — luồng hình, khung nhận diện, thống kê bộ nhận diện, và
 * đường đi của dữ liệu hình ảnh (môn Xử lý ảnh / IoT).
 *
 * Mọi con số ở đây đo TẠI TRÌNH DUYỆT từ các gói `detection` nhận được; bộ
 * nhận diện hiện là NGUỒN GIẢ của Phase 07 cho tới AI Phase 2 — trang ghi rõ
 * điều đó thay vì trình bày box giả như kết quả thật.
 *
 * Mất camera KHÔNG ảnh hưởng bay (SAFETY.md mục 9): trang này chỉ nhìn.
 *
 * Chất lượng JPEG: backend tự hạ khi khung/s tụt vì xa (15/11/2026,
 * `backend/vision/auto_quality.py`) và báo bằng sự kiện `camera.quality` — trang đọc mức
 * hiện tại từ sự kiện đó, không tự đoán.
 */
import { Activity, BarChart3, BrainCircuit, Camera, Crosshair, ImageIcon, Scan, SquareDashed, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { pageMeta } from "@/app/routes";
import { Chip, EmptyState, KeyValue, KeyValueList, PageHeader } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { VideoPanel } from "@/components/VideoPanel/VideoPanel";
import { ModelStatus } from "@/components/vision/ModelStatus";
import { NO_VALUE, formatClock } from "@/lib/format";
import type { DetectionPayload } from "@/lib/protocol";
import { useSessionStore } from "@/store/session";
import { useTelemetryStore } from "@/store/telemetry";

/** Giữ chừng này gói `detection` gần nhất để thống kê. */
const DETECTION_WINDOW = 120;

interface DetStats {
  frames: number;
  boxes: number;
  byLabel: [string, number][];
  meanConf: number | null;
  bins: number[];
  lastSize: string | null;
}

function useDetectionStats(): DetStats {
  const [stats, setStats] = useState<DetStats>({ frames: 0, boxes: 0, byLabel: [], meanConf: null, bins: Array(10).fill(0), lastSize: null });
  useEffect(() => {
    const buf: DetectionPayload[] = [];
    let last: DetectionPayload | null = null;
    const unsub = useTelemetryStore.subscribe((s) => {
      if (s.detection && s.detection !== last) {
        last = s.detection;
        buf.push(s.detection);
        if (buf.length > DETECTION_WINDOW) buf.shift();
      }
    });
    // Tính lại mỗi giây, không theo từng gói.
    const timer = setInterval(() => {
      const labels = new Map<string, number>();
      const bins = Array(10).fill(0) as number[];
      let n = 0;
      let sum = 0;
      for (const d of buf) {
        for (const b of d.boxes ?? []) {
          labels.set(b.label, (labels.get(b.label) ?? 0) + 1);
          bins[Math.min(9, Math.floor(b.confidence * 10))] += 1;
          sum += b.confidence;
          n += 1;
        }
      }
      setStats({
        frames: buf.length,
        boxes: n,
        byLabel: [...labels.entries()].sort((a, b) => b[1] - a[1]),
        meanConf: n ? sum / n : null,
        bins,
        lastSize: last ? `${last.width}×${last.height}` : null,
      });
    }, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
  return stats;
}

/** Biểu đồ cột độ tin cậy 0–100 % (một chuỗi, một trục). */
function ConfidenceBars({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins);
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Phân bố độ tin cậy của các box">
        {bins.map((v, i) => (
          <div key={i} className="group relative flex-1" title={`${i * 10}–${i * 10 + 10}%: ${v} box`}>
            <div className="rounded-t-[4px] bg-series-1 transition-[height] duration-500" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/** Lần đổi chất lượng JPEG gần nhất (sự kiện `camera.quality` của backend), mới nhất trước. */
function useQualityChanges(): { ts: number; from: number; to: number; fps: number | null }[] {
  const events = useTelemetryStore((s) => s.events);
  return useMemo(
    () =>
      events
        .filter((e) => e.code === "camera.quality" && typeof e.detail?.to === "number")
        .slice(0, 5)
        .map((e) => ({
          ts: e.ts,
          from: Number(e.detail?.from),
          to: Number(e.detail?.to),
          fps: typeof e.detail?.fps === "number" ? e.detail.fps : null,
        })),
    [events],
  );
}

const PIPE_NODES = [
  { x: 10, y: 24, t: "ESP32-S3 OV3660", s: "MJPEG VGA · Wi-Fi", c: "teal" },
  { x: 235, y: 24, t: "Backend", s: "fan-out, không mã hoá lại", c: "indigo" },
  { x: 460, y: 24, t: "Trình duyệt", s: "<img> + canvas phủ", c: "cyan" },
  { x: 235, y: 176, t: "Bộ nhận diện", s: "3–5 khung/giây", c: "violet" },
  { x: 10, y: 176, t: "Bộ ghi video", s: "laptop · logs/recordings", c: "orange" },
] as const;

/* Lớp màu viết đủ chữ (Tailwind chỉ sinh lớp nó đọc thấy nguyên văn). */
const PIPE_CLS: Record<(typeof PIPE_NODES)[number]["c"], { box: string; title: string }> = {
  teal: { box: "fill-hud-teal/10 stroke-hud-teal/50", title: "fill-hud-teal" },
  indigo: { box: "fill-hud-indigo/10 stroke-hud-indigo/50", title: "fill-hud-indigo" },
  cyan: { box: "fill-hud-cyan/10 stroke-hud-cyan/50", title: "fill-hud-cyan" },
  violet: { box: "fill-hud-violet/10 stroke-hud-violet/50", title: "fill-hud-violet" },
  orange: { box: "fill-hud-orange/10 stroke-hud-orange/50", title: "fill-hud-orange" },
};

/**
 * Sơ đồ đường đi của hình ảnh: video và box đi hai đường; backend chia hình cho mọi tab, ghi
 * về laptop, và tự hạ chất lượng camera khi khung/s tụt. Rộng tối đa ~760 px — sơ đồ phóng
 * hết bề ngang màn hình lớn thì chữ to hơn tiêu đề trang.
 */
function Pipeline() {
  return (
    <svg viewBox="0 0 640 250" className="w-full max-w-[760px]" role="img" aria-label="Đường đi của dữ liệu hình ảnh">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="currentColor" />
        </marker>
      </defs>
      <g className="text-muted-foreground" stroke="currentColor" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <path d="M182 44 H233" />
        <path d="M233 66 H184" strokeDasharray="3 3" className="text-hud-amber" />
        <path d="M407 53 H458" className="link-flow" strokeDasharray="6 5" />
        <path d="M320 84 V174" />
        <path d="M407 206 C 480 206 545 180 545 86" strokeDasharray="3 4" />
        <path d="M270 84 C 270 140 230 206 184 206" />
      </g>
      <text x="207" y="38" className="fill-muted-foreground text-[10px]" textAnchor="middle">MJPEG</text>
      <text x="207" y="100" className="fill-hud-amber text-[9.5px]" textAnchor="middle">/set?quality</text>
      <text x="432" y="46" className="fill-muted-foreground text-[10px]" textAnchor="middle">video</text>
      <text x="468" y="230" className="fill-muted-foreground text-[10px]">box qua WebSocket</text>
      <text x="196" y="150" className="fill-muted-foreground text-[10px]" textAnchor="end">ghi khung gốc</text>
      {PIPE_NODES.map((n) => (
        <g key={n.t}>
          <rect x={n.x} y={n.y} width="170" height="60" rx="12" className={PIPE_CLS[n.c].box} />
          <text x={n.x + 14} y={n.y + 26} className={`${PIPE_CLS[n.c].title} font-display text-[14px] font-semibold`}>
            {n.t}
          </text>
          <text x={n.x + 14} y={n.y + 45} className="fill-muted-foreground text-[11px]">
            {n.s}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function VisionPage() {
  const stats = useDetectionStats();
  const rate = useSessionStore((s) => s.rates.detection ?? 0);
  const camera = useTelemetryStore((s) => s.status?.camera);
  const vision = useTelemetryStore((s) => s.status?.vision);
  const maxLabel = useMemo(() => Math.max(1, ...stats.byLabel.map(([, n]) => n)), [stats.byLabel]);
  const quality = useQualityChanges();

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <PageHeader
        {...pageMeta("/vision")}
        eyebrow="Vận hành · thị giác máy"
        title="Camera & AI"
        description="Luồng hình từ camera trên drone và khung nhận diện vẽ chồng lên. Hai luồng chạy riêng, nên mất camera hay bộ nhận diện chết đều không ảnh hưởng telemetry và điều khiển."
        actions={
          camera?.fake ? (
            <Chip tone="warn" dot title="Phase 07: video mẫu lặp lại + box chạy vòng">
              Nguồn giả
            </Chip>
          ) : camera ? (
            <Chip tone="ok" dot>
              Camera thật
            </Chip>
          ) : null
        }
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <VideoPanel title="Camera trên drone" tools className="min-h-[420px] xl:h-[min(70dvh,720px)]" />
        <div className="flex flex-col gap-3">
          <Panel title="Model AI" subtitle="trạng thái, phiên bản, provider, ms" icon={BrainCircuit} accent="indigo" bodyClassName="p-3">
            <ModelStatus vision={vision} />
          </Panel>
          <Panel title="Bộ nhận diện" subtitle={`${DETECTION_WINDOW} gói gần nhất`} icon={BarChart3} accent="violet" bodyClassName="flex flex-col gap-4 p-3">
            <KeyValueList>
              <KeyValue icon={Activity} accent="violet" label="Nhịp gói detection" value={`${rate} /s`} />
              <KeyValue icon={Scan} accent="slate" label="Cỡ khung gốc" value={stats.lastSize ?? NO_VALUE} />
              <KeyValue icon={SquareDashed} accent="teal" label="Box trong cửa sổ" value={String(stats.boxes)} />
              <KeyValue
                icon={Crosshair}
                accent="violet"
                label="Độ tin cậy trung bình"
                value={stats.meanConf === null ? NO_VALUE : `${(stats.meanConf * 100).toFixed(1)}%`}
                meter={stats.meanConf}
              />
              <KeyValue
                icon={Camera}
                accent="teal"
                label="Camera"
                value={camera ? (camera.available ? "có hình" : "mất hình") : NO_VALUE}
                tone={camera ? (camera.available ? "ok" : "warn") : undefined}
              />
              <KeyValue
                icon={ImageIcon}
                accent="amber"
                label="Chất lượng JPEG"
                value={camera?.fake ? "nguồn giả — không tự đổi" : quality.length ? `mức ${quality[0].to}` : "chưa đổi trong phiên này"}
                hint="Backend tự hạ khi khung/s tụt vì xa (thang 0–63, số lớn = khung nhỏ, kém nét), tự nâng lại khi sóng khoẻ. Tắt: CAMERA_AUTO_QUALITY=0."
                tone={quality.length && quality[0].to > quality[0].from ? "warn" : undefined}
              />
            </KeyValueList>
            {quality.length ? (
              <div>
                <p className="eyebrow mb-1.5 text-[10px]">Lần đổi chất lượng gần đây</p>
                <ul className="zebra overflow-hidden rounded-md font-mono text-[11.5px]">
                  {quality.map((q) => (
                    <li key={q.ts} className="flex flex-wrap items-center justify-between gap-x-3 px-2 py-1">
                      <span className="text-muted-foreground">{formatClock(q.ts)}</span>
                      <span className={q.to > q.from ? "text-hud-amber" : "text-hud-green"}>
                        {q.from} → {q.to} {q.to > q.from ? "hạ" : "nâng"}
                      </span>
                      <span className="text-muted-foreground">{q.fps == null ? NO_VALUE : `${q.fps.toFixed(1)} khung/s`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="eyebrow mb-2 text-[10px]">Phân bố độ tin cậy</p>
              <ConfidenceBars bins={stats.bins} />
            </div>
            <div>
              <p className="eyebrow mb-2 text-[10px]">Theo nhãn</p>
              {stats.byLabel.length === 0 ? (
                <EmptyState icon={BarChart3} title="Chưa có box nào" className="py-4">
                  Bộ nhận diện thật đến ở AI Phase 2.
                </EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {stats.byLabel.map(([label, n]) => (
                    <li key={label} className="grid grid-cols-[6rem_minmax(0,1fr)_3rem] items-center gap-2 text-[12.5px]">
                      <span className="wrap-anywhere">{label}</span>
                      <span className="h-2 rounded-[3px] bg-series-1" style={{ width: `${(n / maxLabel) * 100}%` }} />
                      <span className="num text-right text-muted-foreground">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="Đường đi của hình ảnh" subtitle="Vì sao video không bị kéo chậm theo tốc độ AI" icon={Workflow} accent="teal" bodyClassName="p-4">
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Pipeline />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Một kết nối tới camera.</span> Camera ESP32-S3 chỉ phục vụ tốt một client, và backend đã
              chiếm chỗ đó để chạy AI — nên backend làm trạm chia (fan-out) cho mọi tab, chép byte, không giải mã lại.
            </p>
            <p>
              <span className="font-medium text-foreground">Box đi đường riêng.</span> Camera thật qua Wi-Fi được 2–9 khung/giây (tuỳ khoảng cách), bộ
              nhận diện 3–5 khung/giây. Vẽ box lên chính ảnh sẽ kéo video xuống tốc độ AI; gửi box qua WebSocket rồi vẽ lên canvas phủ trên thì
              không. Cái giá: box trễ vài chục ms.
            </p>
            <p>
              <span className="font-medium text-foreground">Laptop giữ hình.</span> Bo camera không có thẻ nhớ, nên backend ghi khung gốc về{" "}
              <code className="font-mono text-xs">logs/recordings</code> (đèn REC trên panel video); trang Lịch sử bay phát lại từ đó.
            </p>
            <p>
              <span className="font-medium text-hud-amber">Tự hạ chất lượng khi xa.</span> Wi-Fi hết băng thông thì khung/s tụt (đo 02/11: 7,7 trong
              15 m, 1,8 quá 25 m). Dưới 4 khung/s backend gọi <code className="font-mono text-xs">/set?quality</code> cho khung nhỏ hơn (12 → 40),
              sóng khoẻ lại thì nâng về.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
