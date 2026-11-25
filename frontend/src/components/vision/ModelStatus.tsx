/**
 * Ô trạng thái model AI (trang Camera & AI): detector, verifier, enhancer, enhancer-offline — mỗi
 * model một dòng `KeyValue`: trạng thái, phiên bản, provider, số đo ms (hợp đồng XLA §13).
 *
 * Màu theo trạng thái (`lib/tone.ts`, không tô tại chỗ): `loaded` xanh (đang chạy thật), `ready`
 * vàng (kiểm đủ, mở được session CPU, CHƯA chạy thật — model offline), `rejected` đỏ kèm lý do,
 * `disabled` xám. Chỉ còn CPU (CUDA không tạo được) thì chip cảnh báo: model chạy chậm.
 *
 * Số đo: p50/p95 ms của bước đó trong `status.vision.ms`; enhancer-offline không có ngân sách ms
 * (§11), dòng đó hiện giây/khung job offline đo được (`ms.enhancer_offline.s_per_frame`).
 */
import { Cpu, Images, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

import { Chip, KeyValue, KeyValueList } from "@/components/kit";
import { NO_VALUE } from "@/lib/format";
import type { VisionModelStatus, VisionStatus } from "@/lib/protocol";
import type { Accent, Tone } from "@/lib/tone";

type ModelKey = "detector" | "verifier" | "enhancer" | "enhancer_offline";

const ROWS: { key: ModelKey; label: string; role: string; icon: ComponentType<{ className?: string }>; accent: Accent }[] = [
  { key: "detector", label: "Detector", role: "hộp người trên khung gốc", icon: ScanSearch, accent: "violet" },
  { key: "verifier", label: "Verifier", role: "lọc hộp nhầm sau detector", icon: ShieldCheck, accent: "teal" },
  { key: "enhancer", label: "Ảnh rõ", role: "enhancer trực tiếp", icon: Sparkles, accent: "cyan" },
  { key: "enhancer_offline", label: "Ảnh rõ offline", role: "×2, dựng lại cả chuyến (Lịch sử bay)", icon: Images, accent: "indigo" },
];

const STATE_VIEW: Record<VisionModelStatus["state"], { text: string; tone: Tone }> = {
  loaded: { text: "đang chạy", tone: "ok" },
  ready: { text: "chưa chạy thật", tone: "warn" },
  rejected: { text: "bị từ chối", tone: "danger" },
  disabled: { text: "tắt", tone: "neutral" },
};

function msText(ms: VisionStatus["ms"] | undefined, key: ModelKey): string | null {
  if (key === "enhancer_offline") {
    const s = ms?.enhancer_offline?.s_per_frame;
    return s == null ? null : `${s.toFixed(2)} s/khung`;
  }
  const m = ms?.[key];
  if (!m || m.p50 == null || m.p95 == null) return null;
  return `p50 ${m.p50.toFixed(1)} · p95 ${m.p95.toFixed(1)} ms`;
}

function providerText(st: VisionModelStatus): string | null {
  const p = st.providers ?? [];
  if (!p.length) return null;
  return p[0].replace("ExecutionProvider", "");
}

function ModelRow({ row, st, ms }: { row: (typeof ROWS)[number]; st: VisionModelStatus | undefined; ms: VisionStatus["ms"] | undefined }) {
  const view = st ? STATE_VIEW[st.state] : null;
  const timing = msText(ms, row.key);
  const provider = st ? providerText(st) : null;
  const facts = [st?.version ? `v${st.version}` : null, provider, timing].filter(Boolean).join(" · ");
  const sub = (
    <>
      <span className="block">{row.role}</span>
      {st?.state === "ready" ? <span className="block">sẵn sàng: đã kiểm sha + graph, session đóng</span> : null}
      {facts ? <span className="num block">{facts}</span> : null}
      {st?.state === "rejected" || (st?.state === "disabled" && st.reason) ? (
        <span className="block wrap-anywhere" data-testid={`model-status-${row.key}-reason`}>
          {st.reason ?? "không rõ lý do"}
        </span>
      ) : null}
      {st?.cpu_only ? (
        <Chip tone="warn" size="xs" mono className="mt-0.5" title="CUDA không tạo được: model chạy trên CPU, chậm hơn nhiều" testId={`model-status-${row.key}-cpu`}>
          <Cpu aria-hidden />
          chỉ CPU
        </Chip>
      ) : null}
    </>
  );
  // Chip trạng thái tô theo `tone` của trạng thái; ô icon giữ màu phân loại của từng model
  // (KeyValue tô chip theo `accent` khi có, nên trạng thái không đi qua `tone` của nó).
  const value =
    view && view.tone !== "neutral" ? (
      <Chip tone={view.tone} size="xs" dot testId={`model-status-${row.key}-state`}>
        {view.text}
      </Chip>
    ) : (
      <span className="text-muted-foreground" data-testid={`model-status-${row.key}-state`}>
        {view ? view.text : NO_VALUE}
      </span>
    );
  return <KeyValue label={row.label} icon={row.icon} accent={row.accent} sub={sub} value={value} mono={false} hint={st?.reason ?? undefined} testId={`model-status-${row.key}`} />;
}

/** Bốn dòng trạng thái model; `vision` null (backend tắt khối vision) thì nói rõ. */
export function ModelStatus({ vision }: { vision: VisionStatus | null | undefined }) {
  if (!vision) {
    return (
      <p className="text-[12px] text-muted-foreground" data-testid="model-status-off">
        Khối AI chưa chạy trong backend (VISION_ENABLED tắt hoặc chưa nối backend).
      </p>
    );
  }
  return (
    <KeyValueList>
      {ROWS.map((row) => (
        <ModelRow key={row.key} row={row} st={vision[row.key]} ms={vision.ms} />
      ))}
    </KeyValueList>
  );
}
