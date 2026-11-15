/**
 * Chữ và trạng thái của đèn REC (`components/VideoPanel/RecordingBadge.tsx`), tách khỏi
 * component cho dễ kiểm: đầu vào là đúng `RecordingStatus` backend gửi, không tự suy đoán.
 */
import { formatDuration } from "./format";
import type { RecordingStatus } from "./protocol";

export type RecordingBadgeState = "writing" | "waiting" | "off" | "unknown";

export interface RecordingBadgeView {
  state: RecordingBadgeState;
  label: string;
  title: string;
}

function formatMegabytes(bytes: number | undefined): string {
  const mb = (bytes ?? 0) / 1e6;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/** `nowSec`: giờ hiện tại (Unix giây) để tính thời gian đã ghi. */
export function recordingBadge(st: RecordingStatus | null, error: string | null, nowSec: number): RecordingBadgeView {
  if (error || !st) {
    return { state: "unknown", label: "REC ?", title: error ?? "Đang hỏi backend…" };
  }
  const bad = st.bad_frames ?? 0;
  const dropped = st.dropped_frames ?? 0;
  const skipped = bad + dropped > 0 ? ` Bỏ ${bad} khung hỏng, ${dropped} khung do đĩa chậm.` : "";
  if (st.writing) {
    const elapsed = st.started_at ? formatDuration(nowSec - st.started_at) : "—";
    return {
      state: "writing",
      label: `REC ${elapsed} · ${formatMegabytes(st.bytes_written)}`,
      title: `Đang ghi vào ${st.session_dir ?? "?"} — ${st.frames_written ?? 0} khung.${skipped} Bấm để tắt ghi.`,
    };
  }
  if (st.running) {
    return {
      state: "waiting",
      label: "REC chờ hình",
      title: `${st.reason ?? "Đang chờ hình từ camera"}. Có hình là tự ghi. Bấm để tắt ghi.`,
    };
  }
  return {
    state: "off",
    label: "Không ghi",
    title: `${st.reason ?? "Chưa bật ghi hình"}. Bấm để bật ghi hình về laptop.`,
  };
}
