// @vitest-environment jsdom
/**
 * Ô trạng thái model ở trang Camera & AI (`components/vision/ModelStatus.tsx`, hợp đồng XLA §13):
 * bốn trạng thái tô đúng màu của `lib/tone.ts`, lý do bị từ chối hiện ra, CPU-only có chip cảnh báo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ModelStatus } from "../../src/components/vision/ModelStatus";
import type { VisionStatus } from "../../src/lib/protocol";
import { ACCENT_SOFT } from "../../src/lib/tone";

const CUDA = ["CUDAExecutionProvider", "CPUExecutionProvider"];

function vision(over: Partial<VisionStatus> = {}): VisionStatus {
  return {
    detector: { state: "loaded", version: "1.0.1", providers: CUDA, cpu_only: false },
    verifier: { state: "ready", version: "1.0.0", providers: [], cpu_only: false },
    enhancer: { state: "rejected", reason: "sha256 lệch: file 1a2b…, env 3c4d…", providers: [], cpu_only: false },
    enhancer_offline: { state: "disabled", reason: "ENHANCER_OFFLINE_ONNX chưa đặt (tắt)", providers: [], cpu_only: false },
    enhancer_default_on: false,
    ms: { detector: { p50: 21.04, p95: 30.5 }, verifier: { p50: 5.6, p95: 8.9 } },
    ...over,
  };
}

/** Chip / chữ trạng thái của một dòng. */
function valueChip(key: string): HTMLElement {
  return screen.getByTestId(`model-status-${key}-state`);
}

afterEach(cleanup);

describe("ModelStatus — bốn model, bốn trạng thái", () => {
  it("loaded xanh, ready vàng, rejected đỏ kèm lý do, disabled xám", () => {
    render(<ModelStatus vision={vision()} />);
    for (const key of ["detector", "verifier", "enhancer", "enhancer_offline"]) expect(screen.getByTestId(`model-status-${key}`)).toBeTruthy();

    const det = screen.getByTestId("model-status-detector");
    expect(det.textContent).toContain("đang chạy");
    expect(det.textContent).toContain("v1.0.1 · CUDA · p50 21.0 · p95 30.5 ms");
    expect(valueChip("detector").className).toContain(ACCENT_SOFT.green);

    const ver = screen.getByTestId("model-status-verifier");
    expect(ver.textContent).toContain("chưa chạy thật");
    expect(valueChip("verifier").className).toContain(ACCENT_SOFT.amber);

    expect(screen.getByTestId("model-status-enhancer").textContent).toContain("bị từ chối");
    expect(valueChip("enhancer").className).toContain(ACCENT_SOFT.red);
    expect(screen.getByTestId("model-status-enhancer-reason").textContent).toBe("sha256 lệch: file 1a2b…, env 3c4d…");
    expect(screen.getByTestId("model-status-enhancer").getAttribute("title")).toContain("sha256 lệch");

    // disabled: chữ thường màu xám, không chip màu; lý do tắt vẫn ghi.
    const off = screen.getByTestId("model-status-enhancer_offline");
    expect(off.textContent).toContain("tắt");
    const offValue = valueChip("enhancer_offline");
    expect(offValue.className).toContain("text-muted-foreground");
    for (const tone of [ACCENT_SOFT.green, ACCENT_SOFT.amber, ACCENT_SOFT.red]) expect(offValue.className).not.toContain(tone);
    expect(screen.getByTestId("model-status-enhancer_offline-reason").textContent).toContain("ENHANCER_OFFLINE_ONNX");
  });

  it("CPU-only: chip cảnh báo trên đúng model đó", () => {
    render(
      <ModelStatus
        vision={vision({ detector: { state: "loaded", version: "1.0.1", providers: ["CPUExecutionProvider"], cpu_only: true } })}
      />,
    );
    const chip = screen.getByTestId("model-status-detector-cpu");
    expect(chip.textContent).toContain("chỉ CPU");
    expect(chip.className).toContain(ACCENT_SOFT.amber);
    expect(screen.getByTestId("model-status-detector").textContent).toContain("CPU");
    expect(screen.queryByTestId("model-status-verifier-cpu")).toBeNull();
  });

  it("enhancer-offline đã chạy job: hiện s/khung thay vì ms", () => {
    render(
      <ModelStatus
        vision={vision({
          enhancer_offline: { state: "ready", version: "1.0.0", providers: [], cpu_only: false },
          ms: { enhancer_offline: { s_per_frame: 0.237 } },
        })}
      />,
    );
    const row = screen.getByTestId("model-status-enhancer_offline");
    expect(row.textContent).toContain("v1.0.0 · 0.24 s/khung");
    expect(row.textContent).toContain("chưa chạy thật");
  });

  it("backend không có khối vision: nói rõ, không vẽ bốn dòng rỗng", () => {
    render(<ModelStatus vision={null} />);
    expect(screen.getByTestId("model-status-off").textContent).toContain("Khối AI chưa chạy");
    expect(screen.queryByTestId("model-status-detector")).toBeNull();
  });

  it("verifier / offline thiếu trong status (backend cũ): dòng hiện —", () => {
    const old = vision();
    delete old.verifier;
    delete old.enhancer_offline;
    render(<ModelStatus vision={old} />);
    expect(screen.getByTestId("model-status-verifier").textContent).toContain("—");
  });
});
