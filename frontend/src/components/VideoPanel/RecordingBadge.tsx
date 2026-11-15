/**
 * Đèn REC của panel video — bộ ghi video camera về laptop (`backend/vision/video_recorder.py`).
 *
 * Người dùng không có thẻ nhớ cho bo camera, nên laptop là nơi DUY NHẤT giữ hình; đèn này
 * là cách biết hình có đang được giữ lại hay không. Bấm vào để bật / tắt ghi.
 *
 * Hỏi REST mỗi `POLL_MS`, không qua WebSocket: đèn REC không cần nhanh hơn thế. Không hỏi
 * được backend thì hiện "REC ?" — không đoán là đang ghi.
 */
import { useEffect, useState } from "react";

import { fetchRecording, setRecording } from "@/lib/api";
import type { RecordingStatus } from "@/lib/protocol";
import { recordingBadge } from "@/lib/recording";
import type { RecordingBadgeState } from "@/lib/recording";
import { cn } from "@/lib/utils";

const POLL_MS = 2000;

const BADGE_CLASS: Record<RecordingBadgeState, string> = {
  writing: "border-hud-red/60 bg-hud-red/15 text-hud-red",
  waiting: "border-hud-amber/50 bg-hud-amber/10 text-hud-amber",
  off: "border-border bg-foreground/5 text-muted-foreground",
  unknown: "border-border bg-foreground/5 text-muted-foreground",
};

export function RecordingBadge() {
  const [st, setSt] = useState<RecordingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const ctrl = new AbortController();
    const poll = async () => {
      try {
        const next = await fetchRecording({ signal: ctrl.signal });
        setSt(next);
        setError(null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      }
      setNowSec(Date.now() / 1000);
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, []);

  const toggle = async () => {
    if (!st || busy) return;
    setBusy(true);
    try {
      setSt(await setRecording(!st.running));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNowSec(Date.now() / 1000);
      setBusy(false);
    }
  };

  const badge = recordingBadge(st, error, nowSec);
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={!st || busy}
      title={badge.title}
      aria-label={`Ghi hình về laptop: ${badge.label}`}
      data-testid="rec-badge"
      data-state={badge.state}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 font-mono text-[10.5px] font-semibold whitespace-nowrap transition-opacity disabled:cursor-default disabled:opacity-60",
        BADGE_CLASS[badge.state],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          badge.state === "writing" ? "bg-hud-red motion-safe:animate-pulse" : "bg-current opacity-60",
        )}
      />
      {badge.label}
    </button>
  );
}
