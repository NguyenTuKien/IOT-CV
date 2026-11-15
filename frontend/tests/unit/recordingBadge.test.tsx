// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingBadge } from "../../src/components/VideoPanel/RecordingBadge";
import type { RecordingStatus } from "../../src/lib/protocol";
import { recordingBadge } from "../../src/lib/recording";

const WRITING: RecordingStatus = {
  auto: true,
  running: true,
  writing: true,
  session_dir: "D:\\Coding\\IOT-CV\\logs\\recordings\\20261101-150000",
  segment_file: "D:\\Coding\\IOT-CV\\logs\\recordings\\20261101-150000\\video-001.avi",
  segments: 1,
  frames_written: 1400,
  bad_frames: 0,
  dropped_frames: 0,
  bytes_written: 24_400_000,
  started_at: 1000,
  last_frame_at: 1185,
  reason: null,
};

describe("đèn REC — chữ và màu theo trạng thái backend", () => {
  it("đang ghi: thời gian từ lúc bật + dung lượng", () => {
    const b = recordingBadge(WRITING, null, 1185);
    expect(b.state).toBe("writing");
    expect(b.label).toBe("REC 03:05 · 24 MB");
    expect(b.title).toContain("1400 khung");
    expect(b.title).not.toContain("Bỏ");
  });

  it("có khung bị bỏ thì nói rõ trong chú thích", () => {
    const b = recordingBadge({ ...WRITING, bad_frames: 3, dropped_frames: 1 }, null, 1185);
    expect(b.title).toContain("Bỏ 3 khung hỏng, 1 khung do đĩa chậm");
  });

  it("bật mà chưa có hình: chờ, kèm lý do backend gửi", () => {
    const b = recordingBadge({ ...WRITING, writing: false, reason: "Đang chờ hình từ camera" }, null, 0);
    expect([b.state, b.label]).toEqual(["waiting", "REC chờ hình"]);
    expect(b.title).toContain("Đang chờ hình từ camera");
  });

  it("không ghi: hiện lý do", () => {
    const st = { auto: false, running: false, writing: false, reason: "Ổ đĩa chỉ còn 1.2 GB (< 2 GB) — dừng ghi hình" };
    const b = recordingBadge(st, null, 0);
    expect([b.state, b.label]).toEqual(["off", "Không ghi"]);
    expect(b.title).toContain("Ổ đĩa chỉ còn 1.2 GB");
  });

  it("không hỏi được backend: REC ? chứ không đoán là đang ghi", () => {
    const b = recordingBadge(WRITING, "GET /api/recording trả HTTP 502", 1185);
    expect([b.state, b.label]).toEqual(["unknown", "REC ?"]);
  });
});

describe("đèn REC — bấm để bật/tắt", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("đang ghi, bấm thì gửi POST tắt ghi và đèn chuyển sang Không ghi", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${path}`);
        const body =
          path === "/api/recording/stop"
            ? { auto: true, running: false, writing: false, reason: "Đã tắt ghi hình" }
            : WRITING;
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    render(<RecordingBadge />);
    const badge = await screen.findByTestId("rec-badge");
    await waitFor(() => expect(badge.dataset.state).toBe("writing"));

    fireEvent.click(badge);
    await waitFor(() => expect(badge.dataset.state).toBe("off"));
    expect(calls).toContain("POST /api/recording/stop");
    expect(badge.title).toContain("Đã tắt ghi hình");
  });

  it("backend trả dữ liệu sai hợp đồng thì REC ?", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ running: "có" }), { status: 200 })),
    );
    render(<RecordingBadge />);
    const badge = await screen.findByTestId("rec-badge");
    await waitFor(() => expect(badge.dataset.state).toBe("unknown"));
    expect(badge.title).toContain("sai hợp đồng");
  });
});
