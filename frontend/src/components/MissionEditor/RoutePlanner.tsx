/**
 * Công cụ lập lộ trình của trang Nhiệm vụ — ba khối, đều chỉ chạm BẢN NHÁP:
 *
 *  - `RouteStatsCard`  : quãng đường, chặng, xa home nhất, thời gian ước lượng
 *  - `TemplatesCard`   : mẫu lộ trình tự sinh quanh home (vòng, đa giác, quét
 *                        lưới, đi–về) — thay cả bản nháp, hoàn tác được
 *  - `LibraryCard`     : lưu / nạp lộ trình trên máy này; xuất / nhập file
 *                        `.waypoints` của Mission Planner
 *
 * Không khối nào nạp gì xuống FC. Mẫu sinh ra vượt giới hạn thì luật kiểm tra
 * (soi gương backend) báo đỏ ở bảng mission — không có chuyện cắt bớt im lặng.
 */
import { Download, FileUp, FolderOpen, MapPin, Mountain, Radius, Route, Save, Timer, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { IconGeofence, IconRoute, IconWaypoint } from "@/components/icons";
import { StatTile } from "@/components/kit";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { useLimits } from "@/hooks/useLimits";
import { downloadText } from "@/lib/csv";
import { NO_VALUE, formatClock, formatDistance, formatDuration } from "@/lib/format";
import { MAV_CMD } from "@/lib/missionRules";
import {
  OUTBACK_HOLD_S,
  estimateDuration,
  lawnmowerPattern,
  orbitPattern,
  outAndBackPattern,
  parseWaypointsFile,
  polygonPattern,
  routeStats,
  toWaypointsFile,
} from "@/lib/routeTools";
import type { GeneratedPoint } from "@/lib/routeTools";
import { cn } from "@/lib/utils";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";
import { useSavedMissions } from "@/store/savedMissions";
import { useTelemetryStore } from "@/store/telemetry";

/**
 * Tốc độ bay mission của dự án: `WP_SPD 3` trong `firmware/ardupilot/params/01-base.param`
 * (người dùng chọn 01/11/2026 khi chuyển ra bay ngoài trời; bản 4.7 đổi tên WPNAV_SPEED cm/s
 * → WP_SPD m/s). `WP_SPD_DN` dự án không đặt → mặc định ArduCopter 1,5 m/s. Chỉ dùng cho
 * ƯỚC LƯỢNG thời gian — người dùng sửa được ngay ở ô nhập. Đổi param thì đổi số ở đây.
 */
export const PROJECT_WP_SPD_MS = 3;
export const ARDUCOPTER_DEFAULT_WP_SPD_DN_MS = 1.5;

function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  testId,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  unit: string;
  step?: number;
  min?: number;
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      <span className="relative">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          className="h-8 pr-8 font-mono text-[13px] tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px]">{unit}</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Thống kê
// ---------------------------------------------------------------------------

export function RouteStatsCard({ className }: { className?: string }) {
  const { items } = useMissionDraft();
  const home = useHome();
  const limits = useLimits();
  const [speed, setSpeed] = useState(PROJECT_WP_SPD_MS);
  const stats = useMemo(() => routeStats(items, home), [items, home]);
  const duration = estimateDuration(stats, speed, ARDUCOPTER_DEFAULT_WP_SPD_DN_MS);
  const far = stats.maxDistanceFromHome;
  const farTone = far !== null && limits && far > limits.max_distance_home ? "danger" : undefined;

  return (
    <Panel title="Thống kê lộ trình" subtitle="Tính từ bản nháp, theo thứ tự bay" icon={IconWaypoint} accent="blue" className={className} testId="route-stats" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <StatTile
          label="Waypoint"
          icon={MapPin}
          accent="blue"
          value={String(stats.waypointCount)}
          sub={limits ? `tối đa ${limits.max_waypoints} item` : NO_VALUE}
          testId="stat-route-waypoints"
        />
        <StatTile
          label="Quãng đường"
          icon={Route}
          accent="teal"
          value={home ? formatDistance(stats.totalDistance) : NO_VALUE}
          sub="cả lên và xuống"
        />
        <StatTile
          label="Xa home nhất"
          icon={Radius}
          tone={farTone ?? "neutral"}
          accent={farTone ? undefined : "orange"}
          value={formatDistance(far)}
          sub={limits ? `rào phần mềm ${limits.max_distance_home} m` : NO_VALUE}
        />
        <StatTile
          label="Cao nhất"
          icon={Mountain}
          accent="green"
          value={stats.maxAlt === null ? NO_VALUE : `${stats.maxAlt.toFixed(1)} m`}
          sub={limits ? `trần ${limits.max_alt} m` : NO_VALUE}
        />
      </div>
      {/* Thời gian ước lượng cạnh ô tốc độ nó phụ thuộc: đổi tốc độ là thấy số đổi ngay bên cạnh. */}
      <div className="well relative mt-1.5 grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-3 overflow-hidden px-3 py-2.5 pl-3.5">
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-hud-violet" aria-hidden />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 eyebrow text-[10px]">
            <Timer className="size-3.5 shrink-0" aria-hidden /> Thời gian ước lượng
          </p>
          <p className="num mt-1 text-lg leading-tight font-semibold">{formatDuration(duration)}</p>
        </div>
        <div>
          <NumberField label="ở tốc độ" value={speed} onChange={setSpeed} unit="m/s" step={0.5} min={0.5} />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Mặc định = <span className="font-mono">WP_SPD {PROJECT_WP_SPD_MS}</span> m/s của dự án (01-base.param); hạ độ cao {ARDUCOPTER_DEFAULT_WP_SPD_DN_MS} m/s. FC tự
        tăng/giảm tốc ở mỗi điểm nên chỉ là ước lượng.
      </p>
      {stats.legs.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Từng chặng ({stats.legs.length})</summary>
          <ol className="zebra mt-2 overflow-hidden rounded-md border border-border/70 font-mono text-[11px]">
            {stats.legs.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 px-2 py-1">
                <span className="text-muted-foreground wrap-anywhere">
                  {l.from} → {l.to}
                </span>
                <span className="shrink-0">
                  {l.distance.toFixed(1)} m · {Math.round(l.bearing)}° {l.climb !== 0 ? `· ${l.climb > 0 ? "+" : ""}${l.climb.toFixed(1)} m` : ""}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mẫu lộ trình
// ---------------------------------------------------------------------------

type Template = "orbit" | "polygon" | "lawnmower" | "outback";

/**
 * Mẫu đi–về mặc định: đi thẳng 5 m rồi về, một lượt — người dùng chọn (01/11/2026), bay thử
 * mà không muốn drone đi xa khi còn lo GPS / la bàn sai; 15 m là "quá xa". Mỗi đầu dừng
 * `OUTBACK_HOLD_S` giây cho drone tới đủ quãng. Độ cao lấy theo "độ cao mặc định" của bản nháp.
 */
const OUTBACK_DEFAULT_DISTANCE_M = 5;
const OUTBACK_DEFAULT_LAPS = 1;
const OUTBACK_MAX_LAPS = 4;
/** Bản nháp gửi đi luôn có thêm cất cánh ở đầu và RTL/LAND ở cuối (`toMissionWaypoints`),
 * và giới hạn số item của backend đếm cả hai: 4 lượt đi–về = 8 điểm + 2 = 10 item. */
const MISSION_FIXED_ITEMS = 2;

function TemplatePreview({ points, home }: { points: GeneratedPoint[]; home: [number, number] }) {
  // Hình thu nhỏ: chiếu phẳng quanh home, co về khung 120×120.
  const k = 111_320;
  const xy = points.map((p) => [(p.lon - home[1]) * k * Math.cos((home[0] * Math.PI) / 180), (p.lat - home[0]) * k] as const);
  const span = Math.max(1, ...xy.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  const s = 50 / span;
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${(60 + x * s).toFixed(1)},${(60 - y * s).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 120 120" className="size-28 shrink-0 rounded-lg bg-foreground/4" aria-hidden>
      <path d={`M60,60${d.replace(/^M/, "L")}`} fill="none" stroke="var(--hud-amber)" strokeWidth={1.5} strokeDasharray="4 3" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={60 + x * s} cy={60 - y * s} r={2.4} fill="var(--hud-amber)" />
      ))}
      <rect x={56} y={56} width={8} height={8} rx={2} fill="var(--hud-cyan)" />
    </svg>
  );
}

export function TemplatesCard({ className }: { className?: string }) {
  const home = useHome();
  const limits = useLimits();
  const defaultAlt = useMissionStore((s) => s.defaultAlt);
  const alt = effectiveDefaultAlt(defaultAlt, limits);
  const maxR = limits?.max_distance_home ?? 50;
  const [kind, setKind] = useState<Template>("orbit");
  const [radius, setRadius] = useState(() => Math.round(maxR * 0.6));
  const [count, setCount] = useState(6);
  const [width, setWidth] = useState(() => Math.round(maxR * 0.8));
  const [spacing, setSpacing] = useState(10);
  const [angle, setAngle] = useState(0);
  const [distance, setDistance] = useState(OUTBACK_DEFAULT_DISTANCE_M);
  const [laps, setLaps] = useState(OUTBACK_DEFAULT_LAPS);
  const heading = useTelemetryStore((s) => s.telemetry?.heading ?? null);
  const noseHeading = heading === null ? null : Math.round(heading) % 360;

  const chooseKind = (next: Template) => {
    setKind(next);
    // Đi–về: mặc định bay theo hướng mũi drone đang chĩa — đặt drone quay mũi về phía
    // bãi trống là xong, không phải bấm bản đồ.
    if (next === "outback" && noseHeading !== null) setAngle(noseHeading);
  };

  const points = useMemo<GeneratedPoint[]>(() => {
    if (!home || !Number.isFinite(alt)) return [];
    switch (kind) {
      case "orbit":
        return orbitPattern(home, radius, count, alt, angle);
      case "polygon":
        return polygonPattern(home, radius, count, alt, angle);
      case "lawnmower":
        return lawnmowerPattern(home, width, width, spacing, alt, angle);
      case "outback":
        return outAndBackPattern(home, distance, angle, alt, Math.min(laps, OUTBACK_MAX_LAPS));
    }
  }, [home, alt, kind, radius, count, width, spacing, angle, distance, laps]);

  const apply = () => {
    useMissionStore.getState().replaceWaypoints(points);
    toast.success(`Đã thay bản nháp bằng mẫu ${points.length} điểm`, { description: "Ctrl+Z để hoàn tác. Chưa gửi gì xuống drone." });
  };
  const itemCount = points.length + MISSION_FIXED_ITEMS;
  const tooMany = limits && itemCount > limits.max_waypoints;
  const lapsCapped = kind === "outback" && laps > OUTBACK_MAX_LAPS;

  return (
    <Panel title="Mẫu lộ trình" subtitle="Sinh sẵn quanh điểm home — chỉnh tham số rồi áp dụng" icon={IconGeofence} accent="violet" className={className} testId="route-templates" bodyClassName="flex flex-col gap-3 p-3">
      <Segmented<Template>
        label="Kiểu mẫu"
        value={kind}
        onChange={chooseKind}
        size="xs"
        options={[
          { value: "orbit", label: "Vòng tròn" },
          { value: "polygon", label: "Đa giác" },
          { value: "lawnmower", label: "Quét lưới" },
          { value: "outback", label: "Đi – về" },
        ]}
      />
      {!home ? (
        <p className="text-xs text-hud-amber">Chưa có điểm home — mẫu sinh quanh home nên cần GPS fix trước.</p>
      ) : (
        <div className="flex gap-3">
          <TemplatePreview points={points} home={[home[0], home[1]]} />
          <div className="grid flex-1 grid-cols-2 content-start gap-2">
            {kind === "lawnmower" ? (
              <>
                <NumberField label="Cạnh vùng quét" value={width} onChange={setWidth} unit="m" min={2} />
                <NumberField label="Khoảng cách làn" value={spacing} onChange={setSpacing} unit="m" min={1} />
              </>
            ) : kind === "outback" ? (
              <>
                <NumberField label="Quãng đi" value={distance} onChange={setDistance} unit="m" min={1} testId="outback-distance" />
                <NumberField label="Số lượt" value={laps} onChange={setLaps} unit="lượt" min={1} testId="outback-laps" />
              </>
            ) : (
              <NumberField label="Bán kính" value={radius} onChange={setRadius} unit="m" min={1} />
            )}
            {kind === "orbit" || kind === "polygon" ? (
              <NumberField label={kind === "orbit" ? "Số điểm" : "Số cạnh"} value={count} onChange={setCount} unit="điểm" min={3} />
            ) : null}
            <NumberField label={kind === "outback" ? "Hướng bay (0° = Bắc)" : "Xoay"} value={angle} onChange={setAngle} unit="°" step={15} testId="template-angle" />
            {kind === "outback" ? (
              <Button
                size="sm"
                variant="outline"
                className="col-span-2"
                disabled={noseHeading === null}
                onClick={() => noseHeading !== null && setAngle(noseHeading)}
                title="Hướng bay = hướng mũi drone đang chĩa (la bàn của drone). Quay mũi drone về phía bãi trống rồi bấm."
                data-testid="outback-nose"
              >
                Theo mũi drone{noseHeading === null ? "" : ` (${noseHeading}°)`}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px]", tooMany ? "text-hud-amber" : "text-muted-foreground")}>
          {points.length} điểm ở {Number.isFinite(alt) ? `${alt} m` : "—"}
          {tooMany ? ` — cộng cất cánh và lệnh cuối là ${itemCount} item, vượt ${limits.max_waypoints} cho phép, bảng sẽ báo lỗi` : ""}
          {lapsCapped ? ` — tối đa ${OUTBACK_MAX_LAPS} lượt` : ""}
          {kind === "outback"
            ? ` · dừng ${OUTBACK_HOLD_S} s ở mỗi đầu để tới đủ quãng rồi mới quay, mỗi lượt về đúng chỗ cất cánh, cuối mission hạ cánh tại chỗ`
            : ""}
        </p>
        <Button size="sm" disabled={points.length === 0} onClick={apply} data-testid="apply-template">
          Áp dụng vào bản nháp
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Thư viện + file
// ---------------------------------------------------------------------------

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

export function LibraryCard({ className }: { className?: string }) {
  const { items } = useMissionDraft();
  const home = useHome();
  const waypoints = useMissionStore((s) => s.waypoints);
  const takeoffAlt = useMissionStore((s) => s.takeoffAlt);
  const finalCommand = useMissionStore((s) => s.finalCommand);
  const saved = useSavedMissions((s) => s.items);
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const label = name.trim() || `Lộ trình ${new Date().toLocaleString("vi-VN")}`;
    useSavedMissions.getState().save({
      name: label,
      takeoffAlt,
      finalCommand,
      waypoints: waypoints.map((w) => ({ lat: w.lat, lon: w.lon, alt: w.alt, ...(w.hold_s ? { hold_s: w.hold_s } : {}) })),
    });
    setName("");
    toast.success(`Đã lưu “${label}” trên máy này`);
  };

  const onImport = async (file: File) => {
    try {
      const parsed = parseWaypointsFile(await file.text());
      useMissionStore.getState().loadDraft({
        takeoffAlt: parsed.takeoffAlt ?? takeoffAlt,
        finalCommand: parsed.finalCommand ?? MAV_CMD.NAV_RETURN_TO_LAUNCH,
        waypoints: parsed.waypoints,
      });
      toast.success(`Đã nạp ${parsed.waypoints.length} waypoint từ ${file.name}`, {
        description: parsed.skipped.length
          ? `Bỏ qua ${parsed.skipped.length} lệnh web không soạn được (MAV_CMD ${[...new Set(parsed.skipped)].join(", ")}).`
          : "Vào bản nháp — chưa gửi gì xuống drone.",
      });
    } catch (err) {
      toast.error("Không đọc được file", { description: (err as Error).message });
    }
  };

  return (
    <Panel title="Thư viện & file" subtitle="Lưu trên máy này · trao đổi với Mission Planner" icon={IconRoute} accent="orange" className={className} testId="route-library" bodyClassName="flex flex-col gap-3 p-3">
      <Row>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên lộ trình (tuỳ chọn)"
          className="h-8 flex-1 text-[13px]"
          aria-label="Tên lộ trình"
        />
        <Button size="sm" disabled={waypoints.length === 0} onClick={save}>
          <Save aria-hidden /> Lưu
        </Button>
      </Row>
      <Row>
        <Button
          size="sm"
          variant="outline"
          disabled={waypoints.length === 0}
          onClick={() => downloadText(`iot-cv-mission-${Date.now()}.waypoints`, toWaypointsFile(items, home))}
          title="File .waypoints mở được bằng Mission Planner (Plan → Load WP File)"
        >
          <Download aria-hidden /> Xuất .waypoints
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp aria-hidden /> Nhập file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".waypoints,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
      </Row>
      {saved.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa lưu lộ trình nào.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {saved.map((m) => (
            <li key={m.id} className="well flex items-center gap-2 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] wrap-anywhere">{m.name}</p>
                <p className="font-mono text-[10.5px] text-muted-foreground">
                  {m.waypoints.length} điểm · {formatClock(m.savedAt / 1000)} {new Date(m.savedAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Nạp ${m.name} vào bản nháp`}
                onClick={() => {
                  useMissionStore.getState().loadDraft(m);
                  toast.success(`Đã nạp “${m.name}” vào bản nháp`, { description: "Ctrl+Z để hoàn tác." });
                }}
              >
                <FolderOpen />
              </Button>
              <Button size="icon-sm" variant="ghost" className="text-hud-red" aria-label={`Xoá ${m.name}`} onClick={() => useSavedMissions.getState().remove(m.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
