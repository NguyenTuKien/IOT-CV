/**
 * Số cảnh báo/lỗi CHƯA XEM — cho chuông ở thanh trên và badge Nhật ký. Chỉ đếm
 * `warn` và `error`: một chấm đỏ cho mỗi dòng `info` là dạy người dùng phớt lờ nó.
 * Đếm theo dòng đã gộp (`groupRepeats`), không theo sự kiện: FC nhắc một lỗi mỗi 2 s
 * thì chuông vẫn chỉ +1, khớp số dòng ×N ở trang Nhật ký.
 */
import { useMemo } from "react";

import { groupRepeats } from "@/lib/eventGroups";
import { useTelemetryStore } from "@/store/telemetry";
import type { LogEntry } from "@/store/telemetry";
import { useUiStore } from "@/store/ui";

export function useUnread(): { count: number; hasError: boolean } {
  const events = useTelemetryStore((s) => s.events);
  const seenUntil = useUiStore((s) => s.seenUntil);
  return useMemo(() => {
    const unseen: LogEntry[] = [];
    for (const e of events) {
      if (e.ts <= seenUntil) break; // events mới nhất ở đầu
      if (e.level !== "info") unseen.push(e);
    }
    return { count: groupRepeats(unseen).length, hasError: unseen.some((e) => e.level === "error") };
  }, [events, seenUntil]);
}
