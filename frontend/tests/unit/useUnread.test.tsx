// @vitest-environment jsdom
/**
 * Số chưa xem trên chuông (hooks/useUnread.ts): đếm theo dòng đã gộp, không theo sự kiện.
 * Trên SITL 02/11/2026, FC nhắc "Takeoff blocked" 13 lần trong 24 s và chuông nhảy lên 13.
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useUnread } from "../../src/hooks/useUnread";
import { useTelemetryStore } from "../../src/store/telemetry";
import type { LogEntry } from "../../src/store/telemetry";
import { useUiStore } from "../../src/store/ui";

let n = 0;
function ev(ts: number, message: string, level: LogEntry["level"] = "error"): LogEntry {
  n += 1;
  return { key: `u${n}`, level, source: "mavlink", code: "statustext", message, detail: null, ts };
}

afterEach(() => {
  cleanup();
  useTelemetryStore.setState({ events: [] });
});

describe("useUnread", () => {
  it("FC nhắc một lỗi 13 lần (2 s một lần) thì chuông chỉ +1", () => {
    const blocked = Array.from({ length: 13 }, (_, i) => ev(1024 - 2 * i, "Takeoff blocked: ESC RPM out of range"));
    useTelemetryStore.setState({ events: [...blocked, ev(999, "Arming motors", "info")] });
    useUiStore.setState({ seenUntil: 900 });
    const { result } = renderHook(() => useUnread());
    expect(result.current).toEqual({ count: 1, hasError: true });
  });

  it("đếm từng lỗi khác nhau, bỏ dòng info và dòng đã xem", () => {
    useTelemetryStore.setState({
      events: [
        ev(30, "PreArm: GPS 1: not healthy"),
        ev(20, "Mất liên lạc", "warn"),
        ev(15, "Mode change to LOITER", "info"),
        ev(5, "PreArm: Radio failsafe on"),
      ],
    });
    useUiStore.setState({ seenUntil: 10 });
    const { result } = renderHook(() => useUnread());
    expect(result.current).toEqual({ count: 2, hasError: true });
  });

  it("chỉ có cảnh báo thì không tô đỏ", () => {
    useTelemetryStore.setState({ events: [ev(30, "Mất liên lạc", "warn"), ev(20, "Mất liên lạc", "warn")] });
    useUiStore.setState({ seenUntil: 0 });
    const { result } = renderHook(() => useUnread());
    expect(result.current).toEqual({ count: 1, hasError: false });
  });
});
