/**
 * Header hai tầng, dính trên cùng MỌI trang — thay cho thanh bên trái để trả
 * toàn bộ chiều ngang màn hình cho nội dung (bản đồ, 3D, biểu đồ).
 *
 *   Tầng 1 (52 px): logo · tab các trang theo 3 nhóm · phím tắt · thông báo · theme · giờ
 *   Tầng 2 (44 px): chuỗi kết nối · mode · ARMED · pin · GPS · giờ bay ·
 *                   HOLD/RTL/LAND (mọi trang trừ trang Bay) · WEB CONTROL
 *
 * Tầng 2 là dải trạng thái sống còn: đi trang nào cũng thấy drone đang ra sao, và
 * dừng được drone bằng một cú bấm mà không có thanh nổi nào đè lên nội dung.
 *
 * Tab là của ROUTER phía trình duyệt: đổi trang KHÔNG tải lại trang, nên
 * WebSocket (và quyền lái đang giữ) sống qua mọi lần chuyển trang.
 *
 * Bề rộng:
 *  - ≥ 1536 px: mọi tab có chữ;
 *  - 1024–1536 px: tab chỉ còn icon (tab đang mở giữ chữ), rê chuột để xem tên;
 *  - < 1024 px: tab gom vào nút "Các trang" (tấm trượt liệt kê đủ tên + mô tả).
 */
import { Bell, ChevronRight, Keyboard, Menu, Moon, Sun, Timer } from "lucide-react";
import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";

import { NAV_GROUPS, NAV_GROUP_ACCENT, NAV_GROUP_LABEL, PAGES, pageForPath } from "@/app/routes";
import type { PageDef } from "@/app/routes";
import { Clock, ConnectionChain, WebControlBadge } from "@/components/ConnectionBar";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useResolvedTheme } from "@/hooks/useApplySettings";
import { useShowsEmergency } from "@/hooks/useShowsEmergency";
import { useFlightTime } from "@/hooks/useFlightTime";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useUnread } from "@/hooks/useUnread";
import { formatDuration } from "@/lib/format";
import { ACCENT_DOT, ACCENT_TEXT, ACCENT_TILE } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { useUiStore } from "@/store/ui";

import { BrandMark } from "./BrandMark";
import { EmergencyActions } from "./QuickDock";
import { ArmedChip, BatteryChip, GpsChip, ModeChip } from "./VehicleChips";

/** Trang `path` có đang mở không — cùng luật với `NavLink` (`/` phải khớp đúng, trang khác khớp tiền tố). */
function usePageActive(path: string): boolean {
  const { pathname } = useLocation();
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function NavTab({ page }: { page: PageDef }) {
  const Icon = page.icon;
  const accent = NAV_GROUP_ACCENT[page.group];
  // Tự tính "đang mở" và truyền className dạng CHUỖI: `TooltipTrigger asChild` (Radix
  // Slot) ghép className của con thành chuỗi, nên className dạng hàm của NavLink bị
  // in nguyên mã nguồn ra DOM và mọi tab nhận cả class "đang mở" (lỗi tới 15/11/2026).
  const isActive = usePageActive(page.path);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={page.path}
          end={page.path === "/"}
          data-testid={page.testId}
          data-active={isActive}
          className={cn(
            "group relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
            isActive
              ? "bg-foreground/[0.07] text-foreground shadow-[inset_0_0_0_1px] shadow-foreground/10"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <Icon className={cn("size-[17px] shrink-0 transition-opacity", ACCENT_TEXT[accent], isActive ? "opacity-100" : "opacity-65 group-hover:opacity-100")} />
          <span className={cn(isActive ? "inline" : "hidden 2xl:inline")}>{page.label}</span>
          {page.path === "/logs" ? <UnreadDot /> : null}
          {/* Vạch sáng dưới tab đang mở (màu của nhóm), dính vào mép dưới của tầng 1. */}
          <span
            aria-hidden
            className={cn("absolute inset-x-2 -bottom-2 h-0.5 rounded-full transition-opacity", ACCENT_DOT[accent], isActive ? "opacity-100" : "opacity-0")}
          />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        <p className="font-semibold">
          {page.label} <span className="ml-1 font-mono font-normal opacity-60">Alt+{page.hotkey}</span>
        </p>
        <p className="opacity-80">{page.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function NavTabs() {
  // Cao bằng cả tầng 1 (self-stretch) và khoá cuộn dọc: vạch sáng dưới tab nằm trong khung, không
  // đẩy thành thanh cuộn dọc (`overflow-x-auto` một mình làm trục dọc cũng thành `auto`).
  return (
    <nav aria-label="Các trang" className="hidden min-w-0 items-center gap-0.5 self-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none] lg:flex">
      {NAV_GROUPS.map((group, gi) => (
        <Fragment key={group}>
          {gi > 0 ? <span className="mx-1.5 h-5 w-px shrink-0 bg-border" aria-hidden /> : null}
          <div className="flex items-center gap-0.5" role="group" aria-label={NAV_GROUP_LABEL[group]}>
            {PAGES.filter((p) => p.group === group).map((page) => (
              <NavTab key={page.path} page={page} />
            ))}
          </div>
        </Fragment>
      ))}
    </nav>
  );
}

/** Màn hẹp: tên trang đang mở + nút mở danh sách mọi trang. */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = pageForPath(pathname);
  const CurrentIcon = current?.icon;

  return (
    <div className="flex min-w-0 items-center gap-1.5 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-foreground/[0.04] px-2.5 text-[13px] font-medium transition-colors hover:bg-foreground/8"
        aria-label="Mở danh sách trang"
        data-testid="open-nav"
      >
        <Menu className="size-4 shrink-0 text-muted-foreground" />
        {CurrentIcon ? <CurrentIcon className={cn("size-4 shrink-0", ACCENT_TEXT[NAV_GROUP_ACCENT[current.group]])} /> : null}
        <span className="truncate">{current?.label ?? "Các trang"}</span>
        <UnreadDot />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:w-[24rem]">
          <div className="border-b border-border px-5 py-4">
            <DialogTitle className="font-display text-base font-semibold">Các trang</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Alt + phím để chuyển nhanh ở bất cứ đâu.</DialogDescription>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Các trang">
            {NAV_GROUPS.map((group) => (
              <div key={group}>
                <p className="eyebrow mb-1.5 px-2 text-[10px]">{NAV_GROUP_LABEL[group]}</p>
                <ul className="space-y-0.5">
                  {PAGES.filter((p) => p.group === group).map((page) => {
                    const Icon = page.icon;
                    const active = current?.path === page.path;
                    return (
                      <li key={page.path}>
                        <NavLink
                          to={page.path}
                          end={page.path === "/"}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                            active ? "bg-foreground/[0.07] ring-1 ring-foreground/10" : "hover:bg-foreground/5",
                          )}
                        >
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-linear-to-br ring-1 ring-inset", ACCENT_TILE[NAV_GROUP_ACCENT[group]])}>
                            <Icon className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {page.label}
                              <span className="font-mono text-[10.5px] font-normal text-muted-foreground">Alt+{page.hotkey}</span>
                            </span>
                            <span className="line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{page.description}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Dialog>
    </div>
  );
}

function UnreadDot() {
  const { count, hasError } = useUnread();
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "grid h-4 min-w-4 shrink-0 place-items-center rounded-[5px] px-1 font-mono text-[10px] leading-none font-bold text-background",
        hasError ? "bg-hud-red" : "bg-hud-amber",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ToolButton({ label, onClick, children, testId }: { label: string; onClick(): void; children: ReactNode; testId?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          data-testid={testId}
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function Tools() {
  const setNotifications = useUiStore((s) => s.setNotifications);
  const setShortcuts = useUiStore((s) => s.setShortcuts);
  const setSetting = useSettings((s) => s.set);
  const theme = useResolvedTheme();
  const { count, hasError } = useUnread();

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <span className="hidden sm:block">
        <ToolButton label="Phím tắt (?)" onClick={() => setShortcuts(true)} testId="open-shortcuts">
          <Keyboard className="size-4" />
        </ToolButton>
      </span>
      <ToolButton label={count > 0 ? `${count} cảnh báo chưa xem` : "Thông báo"} onClick={() => setNotifications(true)} testId="open-notifications">
        <Bell className={cn("size-4", count > 0 && (hasError ? "text-hud-red" : "text-hud-amber"))} />
        {count > 0 ? (
          <span className={cn("absolute top-1.5 right-1.5 size-2 rounded-full ring-2 ring-background", hasError ? "bg-hud-red" : "bg-hud-amber")} />
        ) : null}
      </ToolButton>
      <ToolButton
        label={theme === "night" ? "Chuyển sang theme Ngày (đọc ngoài nắng)" : "Chuyển sang theme Đêm"}
        onClick={() => setSetting("theme", theme === "night" ? "day" : "night")}
        testId="toggle-theme"
      >
        {theme === "night" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </ToolButton>
      <span className="mx-1.5 hidden h-5 w-px bg-border sm:block" />
      <span className="hidden rounded-lg border border-border bg-foreground/[0.03] px-2 py-1 sm:inline">
        <Clock />
      </span>
    </div>
  );
}

function FlightTimeChip() {
  const { seconds, seenMidFlight } = useFlightTime();
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11.5px] font-semibold whitespace-nowrap",
        seconds === null ? "border-border text-muted-foreground" : "border-hud-cyan/35 bg-hud-cyan/8 text-hud-cyan",
      )}
      title={
        seconds === null
          ? "Thời gian bay — bắt đầu đếm khi drone ARMED"
          : seenMidFlight
            ? "Thời gian bay tính từ lúc trang này thấy ARMED (trang mở giữa chuyến bay)"
            : "Thời gian bay từ lúc ARMED"
      }
      data-testid="chip-flight-time"
    >
      <Timer className="size-3.5" aria-hidden />
      {formatDuration(seconds)}
      {seconds !== null && seenMidFlight ? "+" : ""}
    </span>
  );
}

export function AppHeader() {
  const showsEmergency = useShowsEmergency();
  const desktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <header className="glass-fixed border-x-0 border-t-0">
      <div className="mx-auto flex h-[52px] max-w-[2400px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="IOT-CV — về trang Bay">
          <BrandMark className="size-8" />
          <span className="hidden leading-none xl:block">
            <span className="block font-display text-[15px] font-semibold tracking-[0.08em]">IOT-CV</span>
            <span className="block text-[10.5px] text-muted-foreground">Trạm mặt đất</span>
          </span>
        </NavLink>
        <span className="hidden h-6 w-px shrink-0 bg-border lg:block" aria-hidden />
        <NavTabs />
        <MobileNav />
        <div className="ml-auto" />
        <Tools />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex h-11 max-w-[2400px] items-center gap-2.5 overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:none] sm:gap-3 sm:px-4">
          <ConnectionChain />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
          <div className="flex shrink-0 items-center gap-1.5">
            <ModeChip />
            <ArmedChip />
            <BatteryChip />
            <GpsChip />
            <FlightTimeChip />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showsEmergency && desktop ? <EmergencyActions inline /> : null}
            <WebControlBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
