/**
 * Biểu đồ của một chuyến đã bay (uPlot), cùng luật dataviz với `TimeChart`: một trục đứng,
 * tối đa hai chuỗi cùng đơn vị, `null` = ngắt nét.
 *
 * Vạch đầu phát là một `div` con của lớp phủ uPlot, chỉ đổi `left` — không vẽ lại canvas mỗi
 * nhịp phát. Bấm lên biểu đồ = tua tới giờ đó.
 */
import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { useResolvedTheme } from "@/hooks/useApplySettings";

export interface ReplaySeries {
  label: string;
  values: readonly (number | null)[];
  slot: 1 | 2;
  /** Biến CSS màu nét (vd. `--hud-teal`); bỏ trống = màu chuỗi 1/2 chung. */
  color?: string;
}

interface ReplayChartProps {
  /** Giây từ `windowStart`. */
  t: readonly number[];
  windowStart: number;
  series: readonly ReplaySeries[];
  unit: string;
  digits?: number;
  height?: number;
  range?: [number, number];
  cursor: number;
  onSeek(t: number): void;
  label: string;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function ReplayChart({ t, windowStart, series, unit, digits = 1, height = 120, range, cursor, onSeek, label }: ReplayChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const head = useRef<HTMLDivElement | null>(null);
  const seekRef = useRef(onSeek);
  useEffect(() => {
    seekRef.current = onSeek;
  }, [onSeek]);
  const theme = useResolvedTheme();
  const data = useMemo(
    () => [t.map((x) => windowStart + x), ...series.map((s) => s.values.map((v) => (v == null ? null : v)))] as uPlot.AlignedData,
    [t, windowStart, series],
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const axisStroke = cssVar("--muted-foreground");
    const grid = { stroke: "color-mix(in oklch, currentColor 9%, transparent)", width: 1 } as uPlot.Axis.Grid;
    const opts: uPlot.Options = {
      width: el.clientWidth || 400,
      height,
      // Lề phải đủ cho nửa nhãn giờ cuối trục, không thì nhãn bị cắt ở mép.
      padding: [6, 30, 0, 0],
      cursor: { drag: { x: false, y: false }, points: { size: 6 } },
      legend: { show: true, live: true },
      scales: { x: { time: true }, y: range ? { range } : { auto: true } },
      axes: [
        {
          stroke: axisStroke,
          grid,
          ticks: { show: false },
          font: "10px Geist Mono Variable, monospace",
          space: 70,
          values: (_u, vals) => vals.map((v) => (v == null ? "" : new Date(v * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))),
        },
        { stroke: axisStroke, grid, ticks: { show: false }, font: "10px Geist Mono Variable, monospace", size: 48 },
      ],
      series: [
        { label: "Giờ", value: (_u, v) => (v == null ? "—" : new Date(v * 1000).toLocaleTimeString("vi-VN")) },
        ...series.map((s) => ({
          label: s.label,
          stroke: cssVar(s.color ?? (s.slot === 1 ? "--series-1" : "--series-2")),
          width: 1.6,
          spanGaps: false,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? "—" : `${v.toFixed(digits)} ${unit}`),
        })),
      ],
    };
    const u = new uPlot(opts, data, el);
    plot.current = u;
    const line = document.createElement("div");
    line.className = "pointer-events-none absolute top-0 bottom-0 w-px bg-hud-amber";
    u.over.appendChild(line);
    head.current = line;
    const onClick = (e: MouseEvent) => {
      const x = u.posToVal(e.offsetX, "x");
      if (Number.isFinite(x)) seekRef.current(x - windowStart);
    };
    u.over.addEventListener("click", onClick);
    u.over.style.cursor = "pointer";
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      u.over.removeEventListener("click", onClick);
      u.destroy();
      plot.current = null;
      head.current = null;
    };
    // Dựng lại khi đổi chuyến (data), đổi theme hay cỡ; đầu phát cập nhật riêng ở dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height, unit, digits, theme, range?.[0], range?.[1]]);

  useEffect(() => {
    const u = plot.current;
    const line = head.current;
    if (!u || !line) return;
    const left = u.valToPos(windowStart + cursor, "x");
    line.style.left = `${left}px`;
    line.style.display = Number.isFinite(left) && left >= 0 && left <= u.over.clientWidth ? "block" : "none";
  }, [cursor, windowStart, data]);

  return <div ref={host} className="uplot-host w-full" role="img" aria-label={label} />;
}
