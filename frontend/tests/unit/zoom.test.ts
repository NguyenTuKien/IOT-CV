/**
 * Khung nhìn phóng to dùng chung cho hai bên so sánh (`lib/zoom.ts`). Điều phải giữ: điểm dưới con
 * trỏ đứng yên khi phóng, ảnh luôn phủ kín khung (không lộ nền đen), và lăn tới giới hạn thì trả cú
 * lăn cho trang cuộn.
 */
import { describe, expect, it } from "vitest";

import { VIEW_FIT, ZOOM_MAX, ZOOM_STEP, clampView, panBy, projectRect, viewTransform, visibleRect, wheelAtLimit, wheelFactor, zoomAt } from "../../src/lib/zoom";
import type { ZoomView } from "../../src/lib/zoom";

/** Điểm ảnh (0–1) đang nằm dưới điểm (px, py) của khung nhìn. */
function imagePointAt(v: ZoomView, px: number, py: number) {
  return { u: (px - v.x) / v.s, w: (py - v.y) / v.s };
}

describe("lib/zoom", () => {
  it("zoomAt giữ điểm ảnh dưới con trỏ đứng yên khi phóng to rồi thu nhỏ", () => {
    const a = zoomAt(VIEW_FIT, 2, 0.25, 0.75);
    expect(a).toEqual({ s: 2, x: -0.25, y: -0.75 });
    const before = imagePointAt(a, 0.6, 0.4);
    const b = zoomAt(a, 1.5, 0.6, 0.4);
    const after = imagePointAt(b, 0.6, 0.4);
    expect(after.u).toBeCloseTo(before.u);
    expect(after.w).toBeCloseTo(before.w);
  });

  it("ảnh luôn phủ kín khung: thu nhỏ sát mép thì dời về trong [1 − s, 0]", () => {
    const out = zoomAt({ s: 4, x: -3, y: 0 }, 0.5, 0.5, 0.5);
    expect(out.s).toBe(2);
    expect(out.x).toBe(-1);
    expect(out.y).toBe(0);
  });

  it("thu nhỏ về 1× là đúng vừa khung, kể cả sau nhiều nấc lẻ", () => {
    let v = VIEW_FIT;
    for (let i = 0; i < 3; i += 1) v = zoomAt(v, ZOOM_STEP, 0.3, 0.7);
    for (let i = 0; i < 3; i += 1) v = zoomAt(v, 1 / ZOOM_STEP, 0.8, 0.1);
    expect(v).toEqual(VIEW_FIT);
    expect(zoomAt(VIEW_FIT, 0.5, 0.5, 0.5)).toEqual(VIEW_FIT);
  });

  it("không phóng quá ZOOM_MAX", () => {
    expect(zoomAt(VIEW_FIT, 100, 0.5, 0.5).s).toBe(ZOOM_MAX);
    expect(clampView({ s: 99, x: 5, y: -99 })).toEqual({ s: ZOOM_MAX, x: 0, y: 1 - ZOOM_MAX });
  });

  it("panBy: vừa khung thì không dời được; đang phóng thì dời, chặn ở mép", () => {
    expect(panBy(VIEW_FIT, 0.3, -0.2)).toEqual(VIEW_FIT);
    const moved = panBy({ s: 2, x: -0.5, y: -0.5 }, 0.2, -0.1);
    expect(moved.s).toBe(2);
    expect(moved.x).toBeCloseTo(-0.3);
    expect(moved.y).toBeCloseTo(-0.6);
    expect(panBy({ s: 2, x: -0.5, y: -0.5 }, 5, -5)).toEqual({ s: 2, x: 0, y: -1 });
  });

  it("viewTransform và visibleRect cùng một khung nhìn", () => {
    const v = { s: 4, x: -1, y: -2 };
    expect(viewTransform(v)).toBe("translate(-100%, -200%) scale(4)");
    expect(visibleRect(v)).toEqual({ left: 0.25, top: 0.5, width: 0.25, height: 0.25 });
    expect(visibleRect(VIEW_FIT)).toMatchObject({ width: 1, height: 1 });
  });

  it("projectRect: hộp theo % ảnh ra % khung nhìn, cùng phép dời + phóng với lớp ảnh", () => {
    const box = { left: 10, top: 10, width: 10, height: 40 };
    expect(projectRect(box, VIEW_FIT)).toEqual(box);
    expect(projectRect(box, { s: 1.5, x: -0.25, y: -0.25 })).toEqual({ left: -10, top: -10, width: 15, height: 60 });
  });

  it("wheelFactor: lăn lên là phóng to, dòng cuộn đổi ra pixel, một cú lăn không quá 2 lần", () => {
    expect(wheelFactor(-100, 0, 300)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0, 300)).toBeLessThan(1);
    expect(wheelFactor(-3, 1, 300)).toBeCloseTo(wheelFactor(-48, 0, 300));
    expect(wheelFactor(-1, 2, 300)).toBeCloseTo(wheelFactor(-300, 0, 300));
    expect(wheelFactor(-1e6, 0, 300)).toBe(2);
    expect(wheelFactor(1e6, 0, 300)).toBe(0.5);
  });

  it("wheelAtLimit: chạm giới hạn thì để trang cuộn", () => {
    expect(wheelAtLimit(VIEW_FIT, 100)).toBe(true);
    expect(wheelAtLimit(VIEW_FIT, -100)).toBe(false);
    expect(wheelAtLimit({ s: ZOOM_MAX, x: 0, y: 0 }, -100)).toBe(true);
    expect(wheelAtLimit({ s: ZOOM_MAX, x: 0, y: 0 }, 100)).toBe(false);
    expect(wheelAtLimit({ s: 2, x: 0, y: 0 }, 0)).toBe(true);
  });
});
