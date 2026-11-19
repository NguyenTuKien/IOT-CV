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
    expect(screen.getByTestId("flight-ai-enhanced-clip").style.clipPath).toBe("inset(0 0 0 60%)");
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

describe("AiCompare — phóng to cả hai bên cùng một chỗ", () => {
  beforeEach(() => {
    let urls = 0;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:test/${urls++}`), revokeObjectURL: vi.fn() }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://localhost");
        const n = Number(url.searchParams.get("n"));
        if (url.pathname === "/api/flights/ai") return new Response(JSON.stringify(aiBody(n)), { status: 200 });
        return jpeg(`${url.searchParams.get("variant") ?? "raw"}-${n}`);
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  /** jsdom không dàn trang: cho ô một cỡ thật để đổi pixel con trỏ ra toạ độ khung nhìn. */
  function sized(testId: string, width = 400, height = 300): HTMLElement {
    const el = screen.getByTestId(testId);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    return el;
  }

  /** Transform của mọi lớp ảnh đang hiện; hai bên phải trùng nhau từng ký tự. */
  function transforms(): string[] {
    return screen.getAllByTestId("flight-ai-layer").map((l) => l.style.transform);
  }

  function expectSynced(scale: string): string {
    const t = transforms();
    expect(t).toHaveLength(2);
    expect(t[1]).toBe(t[0]);
    expect(t[0]).toContain(`scale(${scale}`);
    return t[0];
  }

  async function renderAi() {
    render(<AiCompare flight={flight()} cursor={0.25} playing={false} onPlay={() => {}} />);
    await screen.findByTestId("flight-ai-enhanced");
  }

  it("nút phóng to / vừa khung đổi cả gốc lẫn ảnh rõ, có bản đồ nhỏ ở mỗi bên", async () => {
    await renderAi();
    expect((screen.getByTestId("flight-ai-zoom-out") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("flight-ai-zoom-map")).toBeNull();
    fireEvent.click(screen.getByTestId("flight-ai-zoom-in"));
    expect(screen.getByTestId("flight-ai-zoom").textContent).toBe("1.5×");
    expect(expectSynced("1.5")).toBe("translate(-25%, -25%) scale(1.5)"); // phóng quanh tâm
    expect(screen.getAllByTestId("flight-ai-zoom-map")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("flight-ai-zoom-fit"));
    expect(screen.getByTestId("flight-ai-zoom").textContent).toBe("1.0×");
    expectSynced("1");
    expect(screen.queryByTestId("flight-ai-zoom-map")).toBeNull();
  });

  it("hộp người đi theo zoom ở cả hai bên, viền không dày lên theo độ phóng", async () => {
    await renderAi();
    const boxStyles = () =>
      screen.getAllByTestId("flight-ai-boxes").map((layer) => {
        const b = layer.firstElementChild as HTMLElement;
        return { left: b.style.left, top: b.style.top, width: b.style.width, height: b.style.height, thin: b.classList.contains("border-2") };
      });
    // Hộp (64,48)–(128,240) trên khung 640×480 = 10 %, 10 %, rộng 10 %, cao 40 %.
    expect(boxStyles()[0]).toEqual({ left: "10%", top: "10%", width: "10%", height: "40%", thin: true });
    fireEvent.click(screen.getByTestId("flight-ai-zoom-in")); // 1,5× quanh tâm: dời −25 %
    const zoomed = boxStyles();
    expect(zoomed).toHaveLength(2);
    expect(zoomed[1]).toEqual(zoomed[0]);
    expect(zoomed[0]).toEqual({ left: "-10%", top: "-10%", width: "15%", height: "60%", thin: true });
    // Hộp nhô 10 % lên trên khung nhìn: nhãn bám mép trên phần còn thấy (10/60 chiều cao hộp).
    const label = screen.getAllByTestId("flight-ai-boxes")[0].querySelector("span") as HTMLElement;
    expect(parseFloat(label.style.top)).toBeCloseTo((10 / 60) * 100);
    // Hộp không nằm trong lớp phóng (lớp đó chịu transform, viền sẽ phóng theo).
    for (const layer of screen.getAllByTestId("flight-ai-layer")) expect(layer.querySelector('[data-testid="flight-ai-boxes"]')).toBeNull();
  });

  it("lăn chuột ở bên gốc phóng cả bên ảnh rõ; kéo bên ảnh rõ di chuyển cả bên gốc", async () => {
    await renderAi();
    const raw = sized("flight-ai-surface-raw");
    // Vừa khung mà lăn xuống: không nuốt cú lăn, trang cuộn như thường.
    expect(fireEvent.wheel(raw, { deltaY: 120, clientX: 100, clientY: 75 })).toBe(true);
    expectSynced("1");
    expect(fireEvent.wheel(raw, { deltaY: -300, clientX: 100, clientY: 75 })).toBe(false);
    const zoomed = expectSynced("1.56");
    const enhanced = sized("flight-ai-surface-enhanced");
    fireEvent.pointerDown(enhanced, { pointerId: 1, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(enhanced, { pointerId: 1, clientX: 240, clientY: 150 });
    fireEvent.pointerUp(enhanced, { pointerId: 1 });
    const panned = expectSynced("1.56");
    expect(panned).not.toBe(zoomed);
  });

  it("nhấp đúp phóng 3× quanh chỗ nhấp, nhấp đúp lần nữa về vừa khung", async () => {
    await renderAi();
    const enhanced = sized("flight-ai-surface-enhanced");
    fireEvent.doubleClick(enhanced, { clientX: 0, clientY: 0 });
    expect(screen.getByTestId("flight-ai-zoom").textContent).toBe("3.0×");
    expect(expectSynced("3")).toBe("translate(0%, 0%) scale(3)"); // góc trên trái đứng yên
    fireEvent.doubleClick(enhanced, { clientX: 0, clientY: 0 });
    expect(screen.getByTestId("flight-ai-zoom").textContent).toBe("1.0×");
  });

  it("thanh trượt: giữ độ phóng khi đổi cách xem, ranh giới đứng yên, tay nắm vẫn dời ranh giới", async () => {
    await renderAi();
    fireEvent.click(screen.getByTestId("flight-ai-zoom-in"));
    fireEvent.click(screen.getByTestId("flight-ai-mode-slider"));
    const zoomed = expectSynced("1.5");
    const clip = () => screen.getByTestId("flight-ai-enhanced-clip").style.clipPath;
    expect(clip()).toBe("inset(0 0 0 50%)");
    const slider = sized("flight-ai-slider");
    // Kéo tay nắm: dời ranh giới, ảnh không đi.
    const handle = screen.getByTestId("flight-ai-handle");
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 100, clientY: 150 });
    fireEvent.pointerMove(slider, { pointerId: 2, clientX: 300, clientY: 150 });
    fireEvent.pointerUp(slider, { pointerId: 2 });
    expect(clip()).toBe("inset(0 0 0 75%)");
    expect(handle.getAttribute("aria-valuenow")).toBe("75");
    expect(transforms()[0]).toBe(zoomed);
    // Kéo chỗ khác khi đang phóng: di chuyển ảnh, ranh giới giữ nguyên.
    fireEvent.pointerDown(slider, { pointerId: 3, button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(slider, { pointerId: 3, clientX: 160, clientY: 120 });
    fireEvent.pointerUp(slider, { pointerId: 3 });
    expect(expectSynced("1.5")).not.toBe(zoomed);
    expect(clip()).toBe("inset(0 0 0 75%)");
  });
});
