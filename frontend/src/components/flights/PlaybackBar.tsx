/**
 * Thanh phát lại: phát/dừng, tốc độ, thanh tua, và dải mode bay + vạch sự kiện ngay dưới thanh
 * tua (cùng trục thời gian) để nhìn là biết lúc nào AUTO, lúc nào mất link.
 */
import { Pause, Play, SkipBack } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { SPEEDS, clockTime, formatDuration, modeColor } from "@/lib/flights";
import type { FlightDetail, Speed } from "@/lib/flights";

const LEVEL_COLOR = { error: "var(--hud-red)", warning: "var(--hud-amber)", info: "transparent" } as const;

interface PlaybackBarProps {
  flight: FlightDetail;
  cursor: number;
  playing: boolean;
  speed: Speed;
  onSeek(t: number): void;
  onPlay(playing: boolean): void;
  onSpeed(s: Speed): void;
}

export function PlaybackBar({ flight, cursor, playing, speed, onSeek, onPlay, onSpeed }: PlaybackBarProps) {
  const total = flight.window_end - flight.window_start;
  const pct = (x: number) => `${Math.min(100, Math.max(0, (100 * x) / total))}%`;
  const armAt = flight.summary.start - flight.window_start;
  return (
    <div className="space-y-1.5" data-testid="flight-playback">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onSeek(armAt)} title="Về lúc ARM" aria-label="Về lúc ARM">
          <SkipBack className="size-4" />
        </Button>
        <Button size="sm" onClick={() => onPlay(!playing)} data-testid="flight-play" aria-label={playing ? "Dừng" : "Phát"}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Dừng" : "Phát"}
        </Button>
        <Segmented<`${Speed}`>
          label="Tốc độ phát"
          size="xs"
          value={`${speed}`}
          onChange={(v) => onSpeed(Number(v) as Speed)}
          options={SPEEDS.map((s) => ({ value: `${s}` as `${Speed}`, label: `${s}×` }))}
        />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {clockTime(flight.window_start + cursor)} · {formatDuration(cursor)} / {formatDuration(total)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={total}
        step={0.1}
        value={cursor}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-[var(--hud-amber)]"
        aria-label="Tua chuyến bay"
        data-testid="flight-scrubber"
      />
      <div className="relative h-3 overflow-hidden rounded-sm bg-muted" aria-label="Dải mode bay">
        {flight.modes.map((m) => (
          <button
            key={`${m.t0}-${m.mode}`}
            type="button"
            title={`${m.mode} · ${clockTime(flight.window_start + m.t0)}–${clockTime(flight.window_start + m.t1)}`}
            onClick={() => onSeek(m.t0)}
            className="absolute top-0 h-full"
            style={{ left: pct(m.t0), width: pct(m.t1 - m.t0), background: modeColor(m.mode) }}
          />
        ))}
        <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-foreground" style={{ left: pct(cursor) }} />
      </div>
      <div className="relative h-2" aria-label="Vạch sự kiện">
        {flight.events
          .filter((e) => e.level !== "info")
          .map((e, k) => (
            <button
              key={`${e.t}-${k}`}
              type="button"
              title={`${clockTime(flight.window_start + e.t)} ${e.text}`}
              onClick={() => onSeek(Math.max(0, e.t - 1))}
              className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-sm"
              style={{ left: pct(e.t), background: LEVEL_COLOR[e.level] }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {[...new Set(flight.modes.map((m) => m.mode))].map((m) => (
          <span key={m} className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: modeColor(m) }} />
            {m}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-[3px] rounded-sm" style={{ background: LEVEL_COLOR.warning }} />
          cảnh báo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-[3px] rounded-sm" style={{ background: LEVEL_COLOR.error }} />
          lỗi
        </span>
      </div>
    </div>
  );
}
