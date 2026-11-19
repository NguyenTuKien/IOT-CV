// @vitest-environment jsdom
/**
 * Khối AI của trang Lịch sử bay: hàm thuần trong `lib/flights.ts` và `AiCompare` (fetch giả).
 * Điều quan trọng nhất cần giữ: hai bên luôn là CÙNG một khung, và ảnh rõ hỏng thì nói lý do.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiCompare } from "../../src/components/flights/AiCompare";
import { SEEK_GAP, boxPercent, countKeepUp, fetchFrameBlob, frameUrl, qualityDelta, videoFpsAt } from "../../src/lib/flights";
import type { FlightDetail, FlightFrameAI } from "../../src/lib/flights";

const REC = "20261102-100941";

function aiBody(n: number): FlightFrameAI {
  const loaded = { state: "loaded" as const, version: "1.0.0", providers: ["CUDAExecutionProvider"], cpu_only: false };
  return {
    rec: REC,
    n,
    width: 640,
    height: 480,
    detector: loaded,
    enhancer: loaded,
    boxes: [{ x1: 64, y1: 48, x2: 128, y2: 240, confidence: 0.81, label: "person" }],
    detector_ms: 41.2,
    enhancer_ms: 18.4,
    quality_raw: { brightness: 62, contrast: 20.5, sharpness: 110 },
    quality_enhanced: { brightness: 101, contrast: 31.2, sharpness: 165 },
    note: null,
  };
}

function flight(): FlightDetail {
  // AiCompare chỉ đọc `video`; phần còn lại của chuyến không liên quan.
  return { video: [{ rec: REC, row0: 0, width: 640, height: 480, times: [0, 0.2, 0.4] }] } as unknown as FlightDetail;
}

function jpeg(tag: string): Response {
  return new Response(new Blob([tag], { type: "image/jpeg" }), { status: 200, headers: { "Content-Type": "image/jpeg" } });
}

describe("lib/flights — đường AI", () => {
  it("frameUrl thêm variant=enhanced chỉ khi xin ảnh rõ", () => {
    expect(frameUrl(REC, 7)).toBe(`/api/flights/frame?rec=${REC}&n=7`);
    expect(frameUrl(REC, 7, "enhanced")).toBe(`/api/flights/frame?rec=${REC}&n=7&variant=enhanced`);
  });

  it("qualityDelta: phần trăm so với gốc, null khi thiếu số hoặc gốc 0", () => {
    expect(qualityDelta(100, 150)).toBeCloseTo(50);
    expect(qualityDelta(80, 60)).toBeCloseTo(-25);
    expect(qualityDelta(0, 5)).toBeNull();
    expect(qualityDelta(null, 5)).toBeNull();
    expect(qualityDelta(5, undefined)).toBeNull();
  });

  it("boxPercent đổi pixel ra phần trăm và cắt về trong khung", () => {
    expect(boxPercent({ x1: 64, y1: 48, x2: 128, y2: 240 }, 640, 480)).toEqual({ left: 10, top: 10, width: 10, height: 40 });
    const out = boxPercent({ x1: 600, y1: -20, x2: 700, y2: 100 }, 640, 480);
    expect(out.left + out.width).toBe(100);
    expect(out.top).toBe(0);
  });

  it("countKeepUp: khung nhảy cóc trong cùng lần ghi là bỏ qua; tua xa hay đổi lần ghi thì không", () => {
    const zero = { shown: 0, skipped: 0 };
    const a = countKeepUp(zero, null, { rec: REC, n: 10 });
    const b = countKeepUp(a, { rec: REC, n: 10 }, { rec: REC, n: 13 });
    expect(b).toEqual({ shown: 2, skipped: 2 });
    // Nhảy đúng SEEK_GAP khung vẫn tính là bỏ qua; nhảy hơn thế là người xem tua.
    expect(countKeepUp(b, { rec: REC, n: 13 }, { rec: REC, n: 14 + SEEK_GAP })).toEqual({ shown: 3, skipped: 2 + SEEK_GAP });
    expect(countKeepUp(b, { rec: REC, n: 13 }, { rec: REC, n: 15 + SEEK_GAP })).toEqual({ shown: 3, skipped: 2 });
    expect(countKeepUp(b, { rec: REC, n: 13 }, { rec: "20261102-110000", n: 0 })).toEqual({ shown: 3, skipped: 2 });
    expect(countKeepUp(b, { rec: REC, n: 13 }, { rec: REC, n: 13 })).toBe(b); // cùng khung hiện lại
  });

  it("videoFpsAt đếm khung có thật trong file quanh đầu phát", () => {
    const clips = [{ rec: REC, row0: 0, width: 640, height: 480, times: [0, 0.5, 1, 1.2, 1.4, 1.6, 9] }];
    expect(videoFpsAt(clips, 1.6, 1)).toBe(4); // 1,0 → 1,6: 4 khung sau mốc 0,6 s
    expect(videoFpsAt(clips, 5, 3)).toBe(0); // mất hình: không có khung nào
  });

  it("fetchFrameBlob: 503 mang lý do của backend, thân lạ thì là mã HTTP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "enhancer_unavailable", reason: "enhancer chưa nạp" }), { status: 503 }))
      .mockResolvedValueOnce(new Response("not json", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchFrameBlob(REC, 1, "enhanced")).rejects.toThrow("enhancer chưa nạp");
    await expect(fetchFrameBlob(REC, 1, "raw")).rejects.toThrow("HTTP 404");
    expect(fetchMock.mock.calls[0][0]).toContain("variant=enhanced");
    vi.unstubAllGlobals();
  });
});

describe("AiCompare — gốc và ảnh rõ cùng một khung", () => {
  let urls = 0;
  beforeEach(() => {
    urls = 0;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:test/${urls++}`), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function stubBackend({ enhanced = true }: { enhanced?: boolean } = {}) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const n = Number(url.searchParams.get("n"));
      if (url.pathname === "/api/flights/ai") return new Response(JSON.stringify(aiBody(n)), { status: 200 });
      if (url.searchParams.get("variant") === "enhanced") {
        return enhanced ? jpeg(`enh-${n}`) : new Response(JSON.stringify({ error: "enhancer_unavailable", reason: "enhancer chưa nạp" }), { status: 503 });
      }
      return jpeg(`raw-${n}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("cạnh nhau: hiện gốc + ảnh rõ của khung ở đầu phát, hộp người, số đo", async () => {
    const fetchMock = stubBackend();
    render(<AiCompare flight={flight()} cursor={0.25} playing={false} onPlay={() => {}} />);
    const enhanced = await screen.findByTestId("flight-ai-enhanced");
    expect(screen.getByTestId("flight-ai").dataset.mode).toBe("side");
    expect(screen.getByTestId("flight-ai-raw").getAttribute("alt")).toBe("Khung gốc 1");
    expect(enhanced.getAttribute("alt")).toBe("Khung 1 sau enhancer");
    expect(screen.getAllByTestId("flight-ai-boxes")).toHaveLength(2);
    expect(screen.getByTestId("flight-ai-q-brightness").textContent).toContain("62 → 101 (+63%)");
    expect(screen.getByTestId("flight-ai-people").textContent).toContain("81%");
    // Hai model chạy song song: khung xong sau bước lâu hơn (detector 41,2 ms).
    expect(screen.getByTestId("flight-ai-model").textContent).toContain("41 ms");
    expect(screen.getByTestId("flight-ai-keepup").textContent).toContain("bấm Phát để đo");
    // Ba request của một khung đi cùng lượt (backend gộp hai lần xin enhancer), không nối đuôi.
    const firstRound = fetchMock.mock.calls.slice(0, 3).map((c) => String(c[0]));
    expect(firstRound).toEqual([frameUrl(REC, 1), `/api/flights/ai?rec=${REC}&n=1`, frameUrl(REC, 1, "enhanced")]);
  });

  it("enhancer không có: bên ảnh rõ nói lý do, bên gốc vẫn hiện", async () => {
    stubBackend({ enhanced: false });
    render(<AiCompare flight={flight()} cursor={0} playing={false} onPlay={() => {}} />);
    expect(await screen.findByText(/Ảnh rõ không có: enhancer chưa nạp/)).toBeTruthy();
    expect(screen.getByTestId("flight-ai-raw")).toBeTruthy();
    expect(screen.queryByTestId("flight-ai-enhanced")).toBeNull();
  });

  it("thanh trượt: một khung, kéo bằng phím, lựa chọn được nhớ", async () => {
    stubBackend();
    render(<AiCompare flight={flight()} cursor={0.45} playing={false} onPlay={() => {}} />);
    await screen.findByTestId("flight-ai-enhanced");
    fireEvent.click(screen.getByTestId("flight-ai-mode-slider"));
    expect(screen.getByTestId("flight-ai").dataset.mode).toBe("slider");
    const handle = screen.getByTestId("flight-ai-handle");
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(handle.getAttribute("aria-valuenow")).toBe("60");
    expect((screen.getByTestId("flight-ai-enhanced") as HTMLImageElement).style.clipPath).toBe("inset(0 0 0 60%)");
    expect(window.localStorage.getItem("iot-cv.flight-ai-mode")).toBe("slider");
  });

  it("đầu phát sang khung mới thì đổi cả hai bên sang khung đó, đếm khung bỏ qua", async () => {
    const fetchMock = stubBackend();
    const { rerender } = render(<AiCompare flight={flight()} cursor={0} playing onPlay={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("flight-ai-raw").getAttribute("alt")).toBe("Khung gốc 0"));
    rerender(<AiCompare flight={flight()} cursor={0.41} playing onPlay={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("flight-ai-raw").getAttribute("alt")).toBe("Khung gốc 2"));
    expect(screen.getByTestId("flight-ai-enhanced").getAttribute("alt")).toBe("Khung 2 sau enhancer");
    // Khung 1 bị nhảy qua: 2 khung hiện / 3 khung đã phát qua.
    await waitFor(() => expect(screen.getByTestId("flight-ai-keepup").textContent).toContain("2/3"));
    // Bỏ 1/3 khung (> 10%) khi đang bật hộp người: gợi ý tắt hộp người.
    expect(screen.getByTestId("flight-ai-keepup-tip")).toBeTruthy();
    // Tắt hộp người: xin lại đúng khung đó, không detector; khung hiện lại không bị đếm thêm.
    fireEvent.click(screen.getByTestId("flight-ai-boxes-toggle"));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("n=2&detect=false"))).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("flight-ai-boxes")).toBeNull());
    expect(screen.getByTestId("flight-ai-keepup").textContent).toContain("2/3");
    expect(screen.queryByTestId("flight-ai-keepup-tip")).toBeNull(); // đã tắt hộp người
  });
});
