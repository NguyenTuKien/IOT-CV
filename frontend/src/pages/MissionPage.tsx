/**
 * Trang NHIỆM VỤ — soạn lộ trình bay. Ở ≥ 1280 px cả trang vừa một màn hình, như buồng lái:
 *
 *   ┌ thống kê ─┐┌──── bản đồ soạn (⇄ xem trước 3D) ────┐┌── bảng mission ──┐
 *   ├ mẫu ──────┤│ bấm thêm · vẽ · kéo điểm · "+" chèn    ││ trục thời gian   │
 *   ├ thư viện ─┤├──────────── hồ sơ độ cao ─────────────┤│ kiểm tra · NẠP   │
 *
 * Lưới chi tiết từng cỡ màn hình: `.planner` trong `styles/effects.css`.
 *
 * Mọi thao tác ở đây chỉ chạm BẢN NHÁP trong trình duyệt. Thứ duy nhất đi
 * xuống drone là nút NẠP MISSION — backend kiểm lại toàn bộ, nạp, rồi đọc ngược
 * để so khớp (Phase 07 §7.4). Bắt đầu bay mission (AUTO) là nút ở trang Bay,
 * có hộp xác nhận.
 */
import { Map as MapIcon, Mountain } from "lucide-react";
import { Suspense, lazy, useState } from "react";

import { IconTwin } from "@/components/icons";
import { pageMeta } from "@/app/routes";
import { Chip, PageHeader } from "@/components/kit";
import { MapView } from "@/components/MapView/MapView";
import { AltitudeProfile } from "@/components/MissionEditor/AltitudeProfile";
import { MissionEditor } from "@/components/MissionEditor/MissionEditor";
import { LibraryCard, RouteStatsCard, TemplatesCard } from "@/components/MissionEditor/RoutePlanner";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/ui/segmented";
import { formatClock } from "@/lib/format";
import { sameMission, useMissionStore } from "@/store/mission";
import { useMissionDraft } from "@/hooks/useMissionDraft";
import { useSettings } from "@/store/settings";

const TwinScene = lazy(() => import("@/components/twin/TwinScene").then((m) => ({ default: m.TwinScene })));

type PlanView = "map" | "3d";

/** Bản nháp so với mission FC đang giữ — một chip ở đầu trang, nhìn là biết có cần nạp lại không. */
function DraftVsFc() {
  const { items } = useMissionDraft();
  const readback = useMissionStore((s) => s.readback);
  if (!readback) {
    return (
      <Chip tone="neutral" dot title="Chưa nạp mission nào trong phiên này">
        FC: chưa có mission đã đọc lại
      </Chip>
    );
  }
  const same = sameMission(items, readback.waypoints);
  return (
    <Chip tone={same ? "ok" : "warn"} dot title={`Nạp lúc ${formatClock(readback.uploadedAt)} · ${readback.waypoints.length} item`}>
      {same ? `FC đang giữ đúng bản nháp · ${formatClock(readback.uploadedAt)}` : "Bản nháp khác mission trên FC"}
    </Chip>
  );
}

export default function MissionPage() {
  const [view, setView] = useState<PlanView>("map");
  const quality = useSettings((s) => s.twinQuality);
  const ground = useSettings((s) => s.twinGround);

  return (
    // Trừ header (--shell-header-h, index.css) và khoảng đệm dưới 1.5rem của <main> (pb-6, AppShell).
    <div className="flex flex-col gap-3 p-3 lg:p-4 xl:h-[calc(100dvh-var(--shell-header-h)-1.5rem)] xl:min-h-[700px]">
      <PageHeader
        {...pageMeta("/mission")}
        className="shrink-0"
        eyebrow="Vận hành · lập kế hoạch bay"
        title="Nhiệm vụ"
        description="Soạn lộ trình trên bản đồ, kiểm theo giới hạn của backend, xem trước 3D rồi nạp xuống flight controller. Chưa bấm NẠP MISSION thì không gì rời trình duyệt."
        actions={<DraftVsFc />}
      />

      <div className="planner xl:min-h-0 xl:flex-1">
        {/* Trái: công cụ — thống kê, mẫu lộ trình, thư viện */}
        <div className="planner-col">
          <RouteStatsCard className="shrink-0 pl-stats" />
          <TemplatesCard className="shrink-0 pl-tmpl" />
          <LibraryCard className="shrink-0 pl-lib" />
        </div>

        {/* Giữa: bản đồ soạn + hồ sơ độ cao */}
        <div className="planner-col planner-center">
          <Panel
            title={view === "map" ? "Bản đồ soạn lộ trình" : "Xem trước 3D"}
            subtitle={view === "map" ? "Bấm để thêm · kéo để dời · “+” để chèn giữa chặng" : "Cột dóng = độ cao từng điểm · trụ vàng = rào phần mềm"}
            icon={view === "map" ? MapIcon : IconTwin}
            accent="teal"
            variant="instrument"
            testId="plan-map-panel"
            className="pl-map xl:min-h-[340px] xl:flex-1"
            actions={
              <Segmented<PlanView>
                label="Khung soạn"
                value={view}
                onChange={setView}
                size="xs"
                options={[
                  { value: "map", label: "Bản đồ", icon: MapIcon, testId: "plan-view-map" },
                  { value: "3d", label: "Xem 3D", icon: IconTwin, testId: "plan-view-3d" },
                ]}
              />
            }
          >
            {view === "map" ? (
              <MapView mode="plan" className="absolute inset-0 min-h-0" />
            ) : (
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Đang dựng khung 3D…</div>}>
                <TwinScene camera="orbit" quality={quality} ground={ground} effects showBeam={false} className="absolute inset-0" />
              </Suspense>
            )}
          </Panel>
          <Panel
            title="Hồ sơ độ cao"
            subtitle="Độ cao theo quãng đường bay · dải xanh = vùng cho phép"
            icon={Mountain}
            accent="green"
            className="shrink-0 pl-profile"
            bodyClassName="px-3 pt-2 pb-3"
          >
            <AltitudeProfile />
          </Panel>
        </div>

        {/* Phải: bảng mission theo thứ tự bay + NẠP */}
        <div className="planner-col">
          <MissionEditor className="pl-editor xl:flex-1" />
        </div>
      </div>
    </div>
  );
}
