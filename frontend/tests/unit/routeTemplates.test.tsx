// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TemplatesCard } from "../../src/components/MissionEditor/RoutePlanner";
import { haversineM } from "../../src/lib/geo";
import { OUTBACK_HOLD_S, bearingDeg } from "../../src/lib/routeTools";
import type { LimitsPayload, StatusPayload, Telemetry } from "../../src/lib/protocol";
import { useMissionStore } from "../../src/store/mission";
import { useTelemetryStore } from "../../src/store/telemetry";

const HOME = { home_lat: 10.762622, home_lon: 106.660172 };
const telemetryInitial = useTelemetryStore.getState();
const missionInitial = useMissionStore.getState();

function setDrone(heading: number | null) {
  useTelemetryStore.setState({
    status: {
      backend_version: "t",
      endpoint: "t",
      connected: true,
      safety: {},
      limits: { min_alt: 2, max_alt: 18, max_distance_home: 45, max_waypoints: 10 } as LimitsPayload,
    } as StatusPayload,
    telemetry: { connected: true, ...HOME, heading } as Telemetry,
  });
}

describe("mẫu Đi – về theo mũi drone", () => {
  beforeEach(() => {
    useTelemetryStore.setState(telemetryInitial, true);
    useMissionStore.setState(missionInitial, true);
  });
  afterEach(cleanup);

  it("chọn Đi – về thì hướng bay = mũi drone; mặc định đi 5 m rồi về một lượt, dừng ở mỗi đầu", () => {
    setDrone(123.4);
    useMissionStore.setState({ defaultAlt: 8 });
    render(<TemplatesCard />);
    fireEvent.click(screen.getByRole("radio", { name: "Đi – về" }));
    expect((screen.getByTestId("template-angle") as HTMLInputElement).value).toBe("123");
    expect((screen.getByTestId("outback-distance") as HTMLInputElement).value).toBe("5");
    expect((screen.getByTestId("outback-laps") as HTMLInputElement).value).toBe("1");

    fireEvent.click(screen.getByTestId("apply-template"));
    const wps = useMissionStore.getState().waypoints;
    expect(wps).toHaveLength(2);
    const d = wps.map((w) => haversineM(HOME.home_lat, HOME.home_lon, w.lat, w.lon));
    expect(d[0]).toBeCloseTo(5, 1);
    expect(d[1]).toBeCloseTo(0, 3);
    expect(bearingDeg(HOME.home_lat, HOME.home_lon, wps[0].lat, wps[0].lon)).toBeCloseTo(123, 0);
    expect(wps.every((w) => w.alt === 8)).toBe(true);
    expect(wps.map((w) => w.hold_s)).toEqual([OUTBACK_HOLD_S, OUTBACK_HOLD_S]);
  });

  it("nhiều lượt: xa–gốc mỗi lượt, cuối ở home", () => {
    setDrone(0);
    render(<TemplatesCard />);
    fireEvent.click(screen.getByRole("radio", { name: "Đi – về" }));
    fireEvent.change(screen.getByTestId("outback-laps"), { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("apply-template"));
    const d = useMissionStore.getState().waypoints.map((w) => haversineM(HOME.home_lat, HOME.home_lon, w.lat, w.lon));
    expect(d).toHaveLength(4);
    expect(d[2]).toBeCloseTo(5, 1);
    expect(d[3]).toBeCloseTo(0, 3);
  });

  it("drone xoay mũi rồi bấm Theo mũi drone thì đổi hướng", () => {
    setDrone(10);
    render(<TemplatesCard />);
    fireEvent.click(screen.getByRole("radio", { name: "Đi – về" }));
    act(() => setDrone(271.6)); // telemetry mới tới -> render lại trước khi người dùng bấm
    expect(screen.getByTestId("outback-nose").textContent).toContain("272°");
    fireEvent.click(screen.getByTestId("outback-nose"));
    expect((screen.getByTestId("template-angle") as HTMLInputElement).value).toBe("272");
  });

  it("cảnh báo quá số item đếm cả cất cánh + lệnh cuối, đúng như backend đếm", () => {
    setDrone(0);
    const status = useTelemetryStore.getState().status!;
    useTelemetryStore.setState({ status: { ...status, limits: { ...status.limits, max_waypoints: 9 } } });
    render(<TemplatesCard />);
    fireEvent.click(screen.getByRole("radio", { name: "Đi – về" }));
    const laps = screen.getByTestId("outback-laps");
    fireEvent.change(laps, { target: { value: "3" } }); // 6 điểm + 2 = 8 item ≤ 9
    expect(screen.queryByText(/cho phép, bảng sẽ báo lỗi/)).toBeNull();
    fireEvent.change(laps, { target: { value: "4" } }); // 8 điểm + 2 = 10 item > 9
    expect(screen.getByText(/là 10 item, vượt 9 cho phép/)).toBeTruthy();
  });

  it("chưa có hướng (chưa có telemetry la bàn) thì nút tắt, hướng giữ nguyên", () => {
    setDrone(null);
    render(<TemplatesCard />);
    fireEvent.click(screen.getByRole("radio", { name: "Đi – về" }));
    expect(screen.getByTestId("outback-nose")).toHaveProperty("disabled", true);
    expect((screen.getByTestId("template-angle") as HTMLInputElement).value).toBe("0");
  });
});
