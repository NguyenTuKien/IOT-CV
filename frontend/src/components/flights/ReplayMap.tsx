/**
 * Bản đồ phát lại một chuyến: cả vệt bay (mờ), đoạn đã bay tới đầu phát (đậm), home, drone
 * ở vị trí và hướng mũi tại đầu phát. Lớp nền theo Cài đặt → Bản đồ, như các trang khác.
 *
 * Drone là MỘT `<Marker>`, chỉ đổi `position` và xoay phần tử con (luật vàng ở
 * `MapView/DroneMarker.tsx`).
 */
import type L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

import { DRONE_ICON_ARROW, DRONE_ICON_DOT, DRONE_ROTOR_ATTR, HOME_ICON } from "@/components/MapView/icons";
import "@/components/MapView/map.css";
import { lastValue, trackSegments } from "@/lib/flights";
import type { FlightDetail } from "@/lib/flights";
import { mapBase } from "@/lib/mapLayers";
import { useSettings } from "@/store/settings";

const MAX_ZOOM = 21;

function FitTrack({ points, flightId }: { points: [number, number][]; flightId: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 18);
    else map.fitBounds(points, { padding: [28, 28], maxZoom: 19 });
    // Chỉ căn lại khi đổi chuyến, không theo từng nhịp phát.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, map]);
  return null;
}

interface ReplayMapProps {
  flight: FlightDetail;
  /** Chỉ số mẫu của đầu phát trong `series.t`. */
  index: number;
}

export function ReplayMap({ flight, index }: ReplayMapProps) {
  const baseId = useSettings((s) => s.mapBase);
  const base = mapBase(baseId);
  const { lat, lon, heading } = flight.series;
  const all = useMemo(() => trackSegments(lat, lon), [lat, lon]);
  const flown = useMemo(() => trackSegments(lat, lon, index), [lat, lon, index]);
  const fitPoints = useMemo(() => all.flat(), [all]);
  const pos = useMemo(() => {
    const la = lastValue(lat, index);
    const lo = lastValue(lon, index);
    return la == null || lo == null ? null : ([la, lo] as [number, number]);
  }, [lat, lon, index]);
  const hdg = lastValue(heading, index);
  const marker = useRef<L.Marker>(null);

  useEffect(() => {
    if (hdg == null) return;
    const el = marker.current?.getElement()?.querySelector<HTMLElement>(`[${DRONE_ROTOR_ATTR}]`);
    if (el) el.style.transform = `rotate(${hdg}deg)`;
  }, [hdg, pos]);

  const center: [number, number] = flight.home ? [flight.home.lat, flight.home.lon] : (fitPoints[0] ?? [21.0285, 105.8542]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--canvas-1)]" data-testid="flight-replay-map">
      <MapContainer center={center} zoom={17} maxZoom={MAX_ZOOM} className="absolute inset-0 z-0" attributionControl>
        <TileLayer
          key={base.id}
          url={base.base.url}
          subdomains={base.base.subdomains ?? "abc"}
          maxNativeZoom={base.base.maxNativeZoom}
          maxZoom={MAX_ZOOM}
          attribution={base.base.attribution}
        />
        {base.overlay ? (
          <TileLayer key={`${base.id}-overlay`} url={base.overlay.url} maxNativeZoom={base.overlay.maxNativeZoom} maxZoom={MAX_ZOOM} />
        ) : null}
        <FitTrack points={fitPoints} flightId={flight.summary.id} />
        {all.map((seg, k) => (
          <Polyline key={`all-${k}`} positions={seg} pathOptions={{ color: "#94a3b8", weight: 3, opacity: 0.55, interactive: false }} />
        ))}
        {flown.map((seg, k) => (
          <Polyline key={`flown-${k}`} positions={seg} pathOptions={{ className: "map-trail", weight: 3.5, interactive: false }} />
        ))}
        {flight.home ? (
          <Marker position={[flight.home.lat, flight.home.lon]} icon={HOME_ICON} keyboard={false} zIndexOffset={500}>
            <Tooltip className="map-tooltip" direction="top" offset={[0, -10]}>
              Home — chỗ cất cánh, nơi RTL quay về
            </Tooltip>
          </Marker>
        ) : null}
        {pos ? (
          <Marker ref={marker} position={pos} icon={hdg == null ? DRONE_ICON_DOT : DRONE_ICON_ARROW} interactive={false} keyboard={false} zIndexOffset={1000} />
        ) : null}
      </MapContainer>
    </div>
  );
}
