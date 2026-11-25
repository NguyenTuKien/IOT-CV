// @vitest-environment jsdom
/**
 * Ảnh rõ offline trên trang Lịch sử bay (hợp đồng XLA §13) + mặc định "Ảnh rõ" của luồng trực tiếp.
 *
 * `AiCompare` với backend giả: chọn nguồn (lưu `iot-cv.flight-ai-source`), nút dựng + tiến độ
 * (hỏi lại khi job còn chạy), khung chưa dựng (404 `not_cached`) → ảnh rõ trực tiếp + chip, model
 * offline không có → nút tắt kèm lý do. `VideoPanel`: chưa chọn thì theo `enhancer_default_on`.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiCompare } from "../../src/components/flights/AiCompare";
import { VideoPanel } from "../../src/components/VideoPanel/VideoPanel";
import {
  FLIGHT_AI_SOURCE_KEY,
  FrameError,
  fetchFrameBlob,
  frameUrl,
  offlineActive,
  readAiSource,
  startOffline,
  writeAiSource,
} from "../../src/lib/flights";
import type { FlightDetail, FlightFrameAI, OfflineEnhanceStatus } from "../../src/lib/flights";
import type { StatusPayload } from "../../src/lib/protocol";
import { useTelemetryStore } from "../../src/store/telemetry";

const REC = "20261102-100941";
const POLL_MS = 15;

function aiBody(n: number): FlightFrameAI {
  const loaded = { state: "loaded" as const, version: "1.0.0", providers: ["CUDAExecutionProvider"], cpu_only: false };
  return {
    rec: REC,
    n,
    width: 640,
    height: 480,
    detector: loaded,
    enhancer: loaded,
    verifier: loaded,
    boxes: [{ x1: 64, y1: 48, x2: 128, y2: 240, confidence: 0.81, label: "person" }],
    detector_ms: 41.2,
    verifier_ms: 5.1,
    enhancer_ms: 18.4,
    quality_raw: { brightness: 62, contrast: 20.5, sharpness: 110 },
    quality_enhanced: { brightness: 101, contrast: 31.2, sharpness: 165 },
    note: null,
  };
}

function flight(): FlightDetail {
  return { video: [{ rec: REC, row0: 0, width: 640, height: 480, times: [0, 0.2, 0.4] }] } as unknown as FlightDetail;
}

function jpeg(tag: string): Response {
  return new Response(new Blob([tag], { type: "image/jpeg" }), { status: 200, headers: { "Content-Type": "image/jpeg" } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function status(over: Partial<OfflineEnhanceStatus> = {}): OfflineEnhanceStatus {
  return { rec: REC, state: "none", done: 0, total: 3, bundle_version: "1.0.0", s_per_frame: null, reason: null, ...over };
}

interface Backend {
  /** Trạng thái lần GET kế tiếp (mảng: lần lượt, phần tử cuối lặp lại). */
  statuses: OfflineEnhanceStatus[];
  post?: Response | (() => Response);
  /** Khung `n` đã dựng offline chưa. */
  cached: (n: number) => boolean;
}

function stubBackend(b: Backend) {
  let gets = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const n = Number(url.searchParams.get("n"));
    if (url.pathname === "/api/flights/enhance-offline") {
      if (init?.method === "POST") {
        const r = typeof b.post === "function" ? b.post() : b.post;
        return r ?? json({ rec: REC, state: "running", done: 0, total: 3 }, 202);
      }
      const st = b.statuses[Math.min(gets, b.statuses.length - 1)];
      gets += 1;
      return json(st);
    }
    if (url.pathname === "/api/flights/ai") return json(aiBody(n));
    const variant = url.searchParams.get("variant");
    if (variant === "offline") {
      return b.cached(n) ? jpeg(`off-${n}`) : json({ error: "not_cached", reason: `khung ${n} chưa dựng` }, 404);
    }
    if (variant === "enhanced") return jpeg(`enh-${n}`);
    return jpeg(`raw-${n}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function calls(fetchMock: ReturnType<typeof vi.fn>, match: (url: string, init?: RequestInit) => boolean): number {
  return fetchMock.mock.calls.filter((c) => match(String(c[0]), c[1] as RequestInit | undefined)).length;
}

describe("lib/flights — API offline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("frameUrl variant=offline; nguồn đọc/ghi localStorage, giá trị lạ về 'enhanced'", () => {
    expect(frameUrl(REC, 4, "offline")).toBe(`/api/flights/frame?rec=${REC}&n=4&variant=offline`);
    expect(readAiSource()).toBe("enhanced");
    writeAiSource("offline");
    expect(window.localStorage.getItem(FLIGHT_AI_SOURCE_KEY)).toBe("offline");
    expect(readAiSource()).toBe("offline");
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "gì đó");
    expect(readAiSource()).toBe("enhanced");
    expect(["queued", "running", "paused"].every((s) => offlineActive(s as OfflineEnhanceStatus["state"]))).toBe(true);
    expect(["none", "done", "failed", null].some((s) => offlineActive(s as OfflineEnhanceStatus["state"] | null))).toBe(false);
  });

  it("startOffline: 202 kiểm theo hợp đồng; 409/503/507 thành lý do đọc được", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ rec: REC, state: "queued", done: 2, total: 9 }, 202))
      .mockResolvedValueOnce(json({ error: "busy", rec: "20261102-110000" }, 409))
      .mockResolvedValueOnce(json({ error: "enhancer_offline_unavailable", reason: "ENHANCER_OFFLINE_ONNX chưa đặt (tắt)" }, 503))
      .mockResolvedValueOnce(json({ error: "disk_full", free_mb: 1234.5 }, 507))
      .mockResolvedValueOnce(json({ error: "armed", reason: "drone đang ARM" }, 409));
    vi.stubGlobal("fetch", fetchMock);
    expect(await startOffline(REC)).toEqual({ ok: true, accepted: { rec: REC, state: "queued", done: 2, total: 9 } });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/flights/enhance-offline?rec=${REC}`);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    const busy = await startOffline(REC);
    expect(busy).toEqual({ ok: false, refusal: { status: 409, error: "busy", reason: expect.stringContaining("20261102-110000") } });
    const missing = await startOffline(REC);
    expect(missing.ok === false && missing.refusal.reason).toContain("ENHANCER_OFFLINE_ONNX chưa đặt");
    const disk = await startOffline(REC);
    expect(disk.ok === false && disk.refusal.reason).toContain("1235 MB");
    const armed = await startOffline(REC);
    expect(armed.ok === false && armed.refusal.reason).toBe("drone đang ARM");
  });

  it("fetchFrameBlob: 404 not_cached ném FrameError có mã", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "not_cached", reason: "chưa dựng" }, 404)));
    const err = await fetchFrameBlob(REC, 0, "offline").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FrameError);
    expect([(err as FrameError).status, (err as FrameError).code, (err as FrameError).message]).toEqual([404, "not_cached", "chưa dựng"]);
  });
});

describe("AiCompare — nguồn ảnh rõ offline", () => {
  beforeEach(() => {
    let urls = 0;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:test/${urls++}`), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function renderAi() {
    return render(<AiCompare flight={flight()} cursor={0.25} playing={false} onPlay={() => {}} offlinePollMs={POLL_MS} />);
  }

  it("mặc định 'Ảnh rõ' trực tiếp, không hỏi job offline; chọn offline thì lưu và hiện thanh dựng", async () => {
    const fetchMock = stubBackend({ statuses: [status()], cached: () => false });
    renderAi();
    await screen.findByTestId("flight-ai-enhanced");
    expect(screen.getByTestId("flight-ai").dataset.source).toBe("enhanced");
    expect(screen.queryByTestId("flight-ai-offline-bar")).toBeNull();
    expect(calls(fetchMock, (u) => u.includes("enhance-offline"))).toBe(0);
    fireEvent.click(screen.getByTestId("flight-ai-source-offline"));
    expect(window.localStorage.getItem(FLIGHT_AI_SOURCE_KEY)).toBe("offline");
    expect(screen.getByTestId("flight-ai").dataset.source).toBe("offline");
    await waitFor(() => expect(screen.getByTestId("flight-ai-offline-progress").textContent).toBe("0/3 khung"));
    expect(screen.getByTestId("flight-ai-offline-state").textContent).toBe("chưa dựng");
    expect((screen.getByTestId("flight-ai-offline-start") as HTMLButtonElement).disabled).toBe(false);
    // Nút xem gốc luôn có: bên gốc vẫn hiện khi đổi nguồn.
    expect(screen.getByTestId("flight-ai-raw")).toBeTruthy();
    fireEvent.click(screen.getByTestId("flight-ai-source-enhanced"));
    expect(window.localStorage.getItem(FLIGHT_AI_SOURCE_KEY)).toBe("enhanced");
    expect(screen.queryByTestId("flight-ai-offline-bar")).toBeNull();
  });

  it("ghi chú enhancer theo phiên bản của khung + enhancer_default_on, không ghi cứng", async () => {
    stubBackend({ statuses: [status()], cached: () => false });
    useTelemetryStore.setState({
      status: { vision: { detector: { state: "loaded" }, enhancer: { state: "loaded", version: "2.0.0" }, enhancer_default_on: true } } as unknown as StatusPayload,
    });
    try {
      renderAi();
      // Khung trả enhancer 1.0.0 (aiBody): ghi chú lấy phiên bản của chính khung, không của status.
      await waitFor(() => expect(screen.getByTestId("flight-ai-enhancer-note").textContent).toContain("Enhancer v1.0.0 dựng ảnh rõ bên phải"));
      const note = screen.getByTestId("flight-ai-enhancer-note").textContent ?? "";
      expect(note).toContain('luồng trực tiếp bật "Ảnh rõ" sẵn');
      expect(note).not.toContain("chưa đạt");
    } finally {
      useTelemetryStore.setState({ status: null });
    }
  });

  it("khung chưa dựng (404 not_cached): bên phải là ảnh rõ trực tiếp + chip 'chưa dựng'", async () => {
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "offline");
    stubBackend({ statuses: [status({ state: "none" })], cached: () => false });
    renderAi();
    const chip = await screen.findByTestId("flight-ai-offline-missing");
    expect(chip.textContent).toContain("chưa dựng");
    expect(chip.getAttribute("title")).toBe("khung 1 chưa dựng");
    const img = screen.getByTestId("flight-ai-enhanced");
    expect(img.dataset.source).toBe("enhanced");
    expect(img.getAttribute("alt")).toBe("Khung 1 sau enhancer");
    expect(screen.queryByTestId("flight-ai-offline-note")).toBeNull();
  });

  it("khung đã dựng: ảnh offline + nhãn 'ảnh do AI dựng lại' + phiên bản bundle", async () => {
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "offline");
    stubBackend({ statuses: [status({ state: "done", done: 3, s_per_frame: 0.21 })], cached: () => true });
    renderAi();
    await waitFor(() => expect(screen.getByTestId("flight-ai-enhanced").dataset.source).toBe("offline"));
    expect(screen.getByTestId("flight-ai-enhanced").getAttribute("alt")).toBe("Khung 1 ảnh offline AI dựng lại");
    expect(screen.getByTestId("flight-ai-offline-note").textContent).toBe("ảnh do AI dựng lại");
    await waitFor(() => expect(screen.getByText("ẢNH RÕ OFFLINE · AI dựng lại · v1.0.0")).toBeTruthy());
    expect(screen.getByTestId("flight-ai-offline-state").textContent).toBe("đã dựng xong");
    expect(screen.getByTestId("flight-ai-offline-start").textContent).toBe("Đã dựng ảnh rõ offline");
    expect((screen.getByTestId("flight-ai-offline-start") as HTMLButtonElement).disabled).toBe(true);
    // Hộp người (sau verifier) vẫn vẽ trên cả hai bên: ảnh 1280×960 cùng tỉ lệ 4:3.
    expect(screen.getAllByTestId("flight-ai-boxes")).toHaveLength(2);
  });

  it("bấm dựng: POST, tiến độ hỏi lại tới khi xong, rồi khung đang xem đổi sang ảnh offline", async () => {
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "offline");
    let built = false;
    const fetchMock = stubBackend({
      statuses: [
        status(),
        status({ state: "running", done: 1, s_per_frame: 0.3 }),
        status({ state: "paused", done: 2, reason: "khoá GPU của XLA đang bị giữ (pid=1 label=x)" }),
        status({ state: "running", done: 2 }),
        status({ state: "done", done: 3, s_per_frame: 0.25 }),
      ],
      cached: () => built,
    });
    renderAi();
    await screen.findByTestId("flight-ai-offline-missing");
    const start = screen.getByTestId("flight-ai-offline-start") as HTMLButtonElement;
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(calls(fetchMock, (u, i) => u.includes("enhance-offline") && i?.method === "POST")).toBe(1));
    await waitFor(() => expect(screen.getByTestId("flight-ai-offline-reason").textContent).toContain("khoá GPU của XLA"));
    expect(screen.getByTestId("flight-ai-offline-state").textContent).toBe("tạm dừng");
    built = true;
    await waitFor(() => expect(screen.getByTestId("flight-ai-offline-state").textContent).toBe("đã dựng xong"));
    expect(screen.getByTestId("flight-ai-offline-progress").textContent).toBe("3/3 khung");
    // Job xong: khung đang xem được xin lại, giờ là ảnh offline.
    await waitFor(() => expect(screen.getByTestId("flight-ai-enhanced").dataset.source).toBe("offline"));
    const gets = calls(fetchMock, (u, i) => u.includes("enhance-offline") && i?.method !== "POST");
    await new Promise((r) => setTimeout(r, POLL_MS * 5));
    // Xong rồi thì thôi hỏi.
    expect(calls(fetchMock, (u, i) => u.includes("enhance-offline") && i?.method !== "POST")).toBe(gets);
  });

  it("POST bị từ chối (409 busy): lý do hiện trên thanh, không đổi trạng thái", async () => {
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "offline");
    stubBackend({ statuses: [status()], post: () => json({ error: "busy", rec: "20261102-110000" }, 409), cached: () => false });
    renderAi();
    const start = await screen.findByTestId("flight-ai-offline-start");
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(start);
    await waitFor(() => expect(screen.getByTestId("flight-ai-offline-reason").textContent).toContain("20261102-110000"));
    expect(screen.getByTestId("flight-ai-offline-state").textContent).toBe("chưa dựng");
  });

  it("model offline không có: nút dựng tắt, ghi lý do của backend", async () => {
    window.localStorage.setItem(FLIGHT_AI_SOURCE_KEY, "offline");
    stubBackend({ statuses: [status({ bundle_version: null, reason: "ENHANCER_OFFLINE_ONNX chưa đặt (tắt)" })], cached: () => false });
    renderAi();
    await waitFor(() => expect(screen.getByTestId("flight-ai-offline-reason").textContent).toContain("ENHANCER_OFFLINE_ONNX chưa đặt"));
    const start = screen.getByTestId("flight-ai-offline-start") as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(start.title).toContain("Không dựng được");
    // Bên phải vẫn có ảnh rõ trực tiếp.
    expect((await screen.findByTestId("flight-ai-enhanced")).dataset.source).toBe("enhanced");
  });
});

describe("VideoPanel — mặc định 'Ảnh rõ' theo enhancer_default_on", () => {
  function setStatus(defaultOn: boolean) {
    const loaded = { state: "loaded" as const, version: "2.0.0", providers: ["CUDAExecutionProvider"], cpu_only: false };
    useTelemetryStore.setState({
      status: {
        camera: { available: true, fake: false },
        vision: { detector: loaded, enhancer: loaded, enhancer_default_on: defaultOn, ms: {} },
      } as unknown as StatusPayload,
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    // jsdom không có ResizeObserver (lớp vẽ hộp của VideoPanel đo cỡ ảnh bằng nó).
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    useTelemetryStore.setState({ status: null });
  });

  it("chưa chọn lần nào + enhancer_default_on: bật sẵn 'Ảnh rõ'", () => {
    setStatus(true);
    render(<VideoPanel />);
    expect(screen.getByTestId("video-enhanced-toggle").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("video-img").dataset.variant).toBe("enhanced");
    expect(window.localStorage.getItem("iot-cv.video-enhanced")).toBeNull(); // mặc định không ghi đè lựa chọn
  });

  it("chưa chọn + mặc định tắt: khung gốc", () => {
    setStatus(false);
    render(<VideoPanel />);
    expect(screen.getByTestId("video-enhanced-toggle").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("video-img").dataset.variant).toBe("raw");
  });

  it("đã chọn tắt thì giữ lựa chọn dù mặc định bật; bấm lại thì lưu", () => {
    window.localStorage.setItem("iot-cv.video-enhanced", "0");
    setStatus(true);
    render(<VideoPanel />);
    expect(screen.getByTestId("video-img").dataset.variant).toBe("raw");
    fireEvent.click(screen.getByTestId("video-enhanced-toggle"));
    expect(window.localStorage.getItem("iot-cv.video-enhanced")).toBe("1");
    expect(screen.getByTestId("video-img").dataset.variant).toBe("enhanced");
  });
});
