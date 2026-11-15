/**
 * Trang BAY — buồng lái. Mọi thứ cần khi drone đang trên không nằm trên MỘT màn
 * hình, không phải cuộn tìm (≥ 1280 px):
 *
 *   ┌ màn hình bay ┐┌──── khung chính: Bản đồ ⇄ 3D ────┐┌ chế độ bay ┐
 *   │ PFD + ô số   ││                                    ││ HOLD, mode │
 *   │              ││                                    ││ ARM, TKOFF │
 *   ├── vật cản ───┤├────── video ──────┬── nhật ký ─────┤├─ lái tay ──┤
 *   └──────────────┘└───────────────────┴────────────────┘└────────────┘
 *
 * Nhật ký KHÔNG nằm dưới màn hình bay nữa (15/11/2026): hai thứ cùng cần nhìn liên
 * tục mà chung một cột thì cái nào cũng bị bóp. Nhật ký sang cạnh video, đủ rộng
 * để đọc nguyên câu; dưới màn hình bay là radar vật cản — cũng là một đồng hồ đo.
 * Lưới chi tiết từng cỡ màn hình: `.cockpit` trong `styles/effects.css`.
 *
 * Soạn mission ở trang Nhiệm vụ — ở đây bấm bản đồ KHÔNG thêm điểm (một cú bấm
 * nhầm lúc đang bay không được đổi bản nháp). Bản nháp và mission đã nạp vẫn
 * được vẽ để phi công thấy đường bay.
 *
 * Khung 3D nạp khi bật (three.js nặng): mở trang Bay không phải chờ nó.
 */
import { ArrowUpRight, Map as MapIcon } from "lucide-react";
import { Suspense, lazy } from "react";
import { Link } from "react-router";

import { EventLog } from "@/components/EventLog";
import { Hud } from "@/components/Hud/Hud";
import { IconTwin } from "@/components/icons";
import { ManualControl } from "@/components/ManualControl/ManualControl";
import { MapView } from "@/components/MapView/MapView";
import { ModePanel } from "@/components/ModePanel";
import { ObstaclePanel } from "@/components/ObstaclePanel";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/ui/segmented";
import { VideoPanel } from "@/components/VideoPanel/VideoPanel";
import { useSettings } from "@/store/settings";
import type { CockpitView } from "@/store/settings";

const TwinScene = lazy(() => import("@/components/twin/TwinScene").then((m) => ({ default: m.TwinScene })));

function Loading3D() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground" aria-busy="true">
      Đang dựng khung 3D…
    </div>
  );
}

function MainView({ className }: { className?: string }) {
  const view = useSettings((s) => s.cockpitView);
  const quality = useSettings((s) => s.twinQuality);
  const ground = useSettings((s) => s.twinGround);
  const effects = useSettings((s) => s.twinEffects);
  const set = useSettings((s) => s.set);

  return (
    <Panel
      title={view === "map" ? "Bản đồ" : "Không gian 3D"}
      subtitle={view === "map" ? "Drone, vệt bay, home, rào ảo, mission" : "Góc máy bám đuôi · sang trang 3D để đổi góc"}
      icon={view === "map" ? MapIcon : IconTwin}
      accent="teal"
      variant="instrument"
      testId="map-panel"
      className={className}
      actions={
        <>
          <Segmented<CockpitView>
            label="Khung chính"
            value={view}
            onChange={(v) => set("cockpitView", v)}
            size="xs"
            options={[
              { value: "map", label: "Bản đồ", icon: MapIcon, testId: "view-map" },
              { value: "3d", label: "3D", icon: IconTwin, testId: "view-3d" },
            ]}
          />
          <Link
            to={view === "map" ? "/mission" : "/3d"}
            className="hidden h-7 items-center gap-1 rounded-md px-2 text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground sm:flex"
          >
            {view === "map" ? "Soạn mission" : "Mở trang 3D"} <ArrowUpRight className="size-3" />
          </Link>
        </>
      }
    >
      {view === "map" ? (
        <MapView mode="flight" className="absolute inset-0 min-h-0" />
      ) : (
        <Suspense fallback={<Loading3D />}>
          <TwinScene camera="chase" quality={quality} ground={ground} effects={effects} className="absolute inset-0" />
        </Suspense>
      )}
    </Panel>
  );
}

export default function FlightPage() {
  return (
    <div className="cockpit">
      {/* Cột trái: đồng hồ đo — màn hình bay + radar vật cản */}
      <div className="cockpit-col">
        {/* Màn hình bay co lại được (xem Hud.tsx), nhưng không dưới ~490 px: ô số không bị cắt. */}
        <Hud className="ck-hud xl:min-h-[490px]" />
        <ObstaclePanel className="shrink-0 ck-obs" />
      </div>

      {/* Giữa: khung chính + hàng dưới (video | nhật ký) */}
      <div className="cockpit-col cockpit-center">
        <MainView className="min-h-[420px] ck-map xl:min-h-[360px] xl:flex-1" />
        <div className="cockpit-col cockpit-row">
          <VideoPanel className="min-h-[280px] ck-video xl:min-h-0" />
          <EventLog showLink className="h-[340px] ck-log lg:h-auto lg:min-h-[320px] xl:h-auto xl:min-h-0" />
        </div>
      </div>

      {/* Cột phải: chế độ bay + lái tay */}
      <div className="cockpit-col">
        <ModePanel className="shrink-0 ck-mode" />
        <ManualControl className="shrink-0 ck-manual" />
      </div>
    </div>
  );
}
