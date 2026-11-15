/**
 * Phép tính thuần của trang Lịch sử bay (lib/flights.ts): tìm mẫu theo giờ, tìm khung video
 * (kể cả lúc MẤT HÌNH), tách vệt bay ở chỗ thiếu toạ độ, gom chuyến theo ngày.
 */
import { describe, expect, it } from "vitest";

import { FRAME_STALE_S, formatDuration, frameAt, frameUrl, groupByDay, indexAt, lastValue, trackSegments } from "@/lib/flights";
import type { FlightSummary } from "@/lib/flights";

describe("indexAt", () => {
  const xs = [0, 0.5, 1, 2, 4];
  it("trả mẫu cuối cùng không vượt quá x", () => {
    expect(indexAt(xs, 0)).toBe(0);
    expect(indexAt(xs, 0.99)).toBe(1);
    expect(indexAt(xs, 1)).toBe(2);
    expect(indexAt(xs, 3.9)).toBe(3);
    expect(indexAt(xs, 99)).toBe(4);
  });
  it("x trước mọi mẫu hoặc mảng rỗng → −1", () => {
    expect(indexAt(xs, -0.1)).toBe(-1);
    expect(indexAt([], 5)).toBe(-1);
  });
});

describe("frameAt", () => {
  const clips = [
    { rec: "20261102-100941", row0: 100, width: 640, height: 480, times: [10, 10.2, 10.4, 20] },
    { rec: "20261102-110000", row0: 0, width: 640, height: 480, times: [30, 30.1] },
  ];
  it("lấy khung gần nhất phía trước và đổi sang số dòng frames.csv", () => {
    expect(frameAt(clips, 10.3)).toEqual({ rec: "20261102-100941", n: 101, age: expect.closeTo(0.1, 5) });
  });
  it("quãng mất hình: khung cuối già hơn ngưỡng → trang phủ MẤT HÌNH", () => {
    const ref = frameAt(clips, 15);
    expect(ref?.n).toBe(102);
    expect(ref!.age).toBeGreaterThan(FRAME_STALE_S);
  });
  it("chọn đoạn ghi có khung mới hơn khi có hai đoạn", () => {
    expect(frameAt(clips, 30.05)).toMatchObject({ rec: "20261102-110000", n: 0 });
  });
  it("trước khung đầu tiên → null", () => {
    expect(frameAt(clips, 5)).toBeNull();
    expect(frameAt([], 5)).toBeNull();
  });
  it("URL khung mã hoá tham số", () => {
    expect(frameUrl("20261102-100941", 7)).toBe("/api/flights/frame?rec=20261102-100941&n=7");
  });
});

describe("trackSegments", () => {
  const lat = [1, 2, null, 4, 5, 6];
  const lon = [1, 2, null, 4, 5, 6];
  it("ngắt nét ở mẫu thiếu toạ độ, bỏ đoạn chỉ một điểm", () => {
    expect(trackSegments(lat, lon)).toEqual([
      [
        [1, 1],
        [2, 2],
      ],
      [
        [4, 4],
        [5, 5],
        [6, 6],
      ],
    ]);
  });
  it("chỉ lấy tới đầu phát", () => {
    expect(trackSegments(lat, lon, 3)).toEqual([
      [
        [1, 1],
        [2, 2],
      ],
    ]);
  });
});

describe("lastValue", () => {
  it("lùi qua null nhưng không quá xa", () => {
    expect(lastValue([3, null, null], 2)).toBe(3);
    expect(lastValue([3, null, null, null], 3, 2)).toBeNull();
  });
});

function summary(id: string, start: number): FlightSummary {
  return {
    id,
    start,
    end: start + 60,
    duration_s: 60,
    took_off: true,
    sources: ["dataflash"],
    modes: ["LOITER"],
    warnings: 0,
  };
}

describe("groupByDay", () => {
  it("ngày mới trước, trong ngày chuyến mới trước", () => {
    const a = summary("20261101-201225", Date.UTC(2026, 10, 1, 13, 12, 25) / 1000);
    const b = summary("20261102-101046", Date.UTC(2026, 10, 2, 3, 10, 46) / 1000);
    const c = summary("20261102-104039", Date.UTC(2026, 10, 2, 3, 40, 39) / 1000);
    const days = groupByDay([a, b, c]);
    expect(days.map((d) => d.key)).toEqual(["20261102", "20261101"]);
    expect(days[0].flights.map((f) => f.id)).toEqual(["20261102-104039", "20261102-101046"]);
  });
});

describe("formatDuration", () => {
  it("phút:giây, có giờ khi quá 1 giờ", () => {
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(-3)).toBe("0:00");
  });
});
