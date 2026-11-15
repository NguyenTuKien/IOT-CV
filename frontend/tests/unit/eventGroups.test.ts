/**
 * Gộp dòng nhật ký lặp + gợi ý cho thông báo chặn ARM (lib/eventGroups.ts).
 *
 * Dữ liệu là chuỗi thật FC gửi tối 01/11/2026 (tlog logs/tlog/20261101-191230.tlog):
 * PreArm nhắc lại 30 s một lần, xen kẽ nhau.
 */
import { describe, expect, it } from "vitest";

import { groupRepeats, hintFor, noteRepeat, REPEAT_WINDOW_S, repeatSignature, type RepeatRun } from "@/lib/eventGroups";
import type { LogEntry } from "@/store/telemetry";

let n = 0;
function ev(ts: number, message: string, level: LogEntry["level"] = "error"): LogEntry {
  n += 1;
  return { key: `k${n}`, level, source: "mavlink", code: "statustext", message, detail: null, ts };
}

const GPS = "PreArm: GPS 1: not healthy";
const RC = "PreArm: Radio failsafe on";

describe("groupRepeats", () => {
  it("gộp hai thông báo PreArm xen kẽ mỗi 30 s thành hai dòng ×N, giữ dòng khác ở giữa", () => {
    const moiNhatTruoc = [
      ev(130, GPS),
      ev(129, RC),
      ev(100, GPS),
      ev(99, RC),
      ev(80, "Mode change to LOITER", "info"),
      ev(70, GPS),
      ev(69, RC),
    ];
    const g = groupRepeats(moiNhatTruoc);
    expect(g.map((x) => [x.entry.message, x.count, x.firstTs])).toEqual([
      [GPS, 3, 70],
      [RC, 3, 69],
      ["Mode change to LOITER", 1, 80],
    ]);
    expect(g[0].entry.ts).toBe(130); // dòng hiện là lần mới nhất
  });

  it("lặp lại sau quãng nghỉ dài hơn cửa sổ thì thành dòng mới", () => {
    const g = groupRepeats([ev(1000, GPS), ev(1000 - REPEAT_WINDOW_S - 1, GPS), ev(10, GPS)]);
    expect(g.map((x) => x.count)).toEqual([1, 1, 1]);
  });

  it("khác mức hoặc khác nội dung thì không gộp", () => {
    const g = groupRepeats([ev(3, GPS, "warn"), ev(2, GPS, "error"), ev(1, "PreArm: GPS 2: not healthy")]);
    expect(g).toHaveLength(3);
  });

  it("danh sách rỗng", () => {
    expect(groupRepeats([])).toEqual([]);
  });
});

describe("noteRepeat (toast lỗi)", () => {
  const BLOCKED = "Takeoff blocked: ESC RPM out of range";

  it("FC nhắc mỗi 2 s: một chuỗi, ×N tăng dần, giữ giờ lần đầu", () => {
    const runs = new Map<string, RepeatRun>();
    const sig = repeatSignature(ev(0, BLOCKED));
    expect([100, 102, 104, 106].map((ts) => noteRepeat(runs, sig, ts).count)).toEqual([1, 2, 3, 4]);
    expect(runs.get(sig)).toEqual({ count: 4, firstTs: 100, lastTs: 106 });
  });

  it("cách đúng bằng cửa sổ vẫn nối; quá cửa sổ thì mở chuỗi mới", () => {
    const runs = new Map<string, RepeatRun>();
    noteRepeat(runs, BLOCKED, 0);
    expect(noteRepeat(runs, BLOCKED, REPEAT_WINDOW_S).count).toBe(2);
    const t = 2 * REPEAT_WINDOW_S + 1;
    expect(noteRepeat(runs, BLOCKED, t)).toEqual({ count: 1, firstTs: t, lastTs: t });
  });

  it("đếm khớp groupRepeats: mỗi chữ ký, ×N của dòng mới nhất = chuỗi đang mở", () => {
    const cuNhatTruoc = [
      ev(69, RC),
      ev(70, GPS),
      ev(80, "Mode change to LOITER", "info"),
      ev(99, RC),
      ev(100, GPS),
      ev(129, RC),
      ev(130, GPS),
      ev(300, GPS), // cách 130 quá cửa sổ → chuỗi mới
    ];
    const runs = new Map<string, RepeatRun>();
    for (const e of cuNhatTruoc) noteRepeat(runs, repeatSignature(e), e.ts);
    const dongMoiNhat = new Map<string, number>();
    for (const g of groupRepeats([...cuNhatTruoc].reverse())) {
      const sig = repeatSignature(g.entry);
      if (!dongMoiNhat.has(sig)) dongMoiNhat.set(sig, g.count);
    }
    expect(new Map([...runs].map(([sig, r]) => [sig, r.count]))).toEqual(dongMoiNhat);
    expect(runs.get(repeatSignature(ev(0, GPS)))?.count).toBe(1);
    expect(runs.get(repeatSignature(ev(0, RC)))?.count).toBe(3);
  });

  it("sổ không phình mãi khi nội dung có số đo (mỗi dòng một chữ ký)", () => {
    const runs = new Map<string, RepeatRun>();
    for (let i = 0; i < 1000; i++) noteRepeat(runs, `PreArm: Proximity 0 deg, ${i}cm`, i * REPEAT_WINDOW_S);
    expect(runs.size).toBeLessThanOrEqual(256);
  });
});

describe("hintFor", () => {
  it.each([
    ["PreArm: Radio failsafe on", "Tay phát"],
    ["PreArm: Throttle below failsafe", "Tay phát"],
    ["PreArm: RC not found", "Tay phát"],
    ["Arm: Throttle too high", "cần ga"],
    ["Arm: RTL mode not armable", "SwD"],
    ["PreArm: Proximity 0 deg, 0.16m (want > 0.6m)", "TFmini"],
    ["PreArm: GPS 1: not healthy", "GPS"],
    ["PreArm: Fence enabled, need position estimate", "EKF"],
    ["Takeoff blocked: ESC RPM out of range", "motor"],
    ["PreArm: Compass calibrated requires reboot", "khởi động lại"],
    ["PreArm: Check mag field: 830, max 875, min 185", "La bàn"],
  ])("%s", (message, chua) => {
    expect(hintFor(message)).toContain(chua);
  });

  it("thông báo bình thường không có gợi ý", () => {
    expect(hintFor("Mission: 1 Takeoff")).toBeNull();
    expect(hintFor("EKF3 IMU0 is using GPS")).toBeNull();
  });
});
