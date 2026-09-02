import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:oklch(0.5883 0.1247 44.6);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
};

export default function LeafletMap({
  points,
  center,
  zoom = 12,
  height = 420,
}: {
  points: MapPoint[];
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  height?: number | undefined;
}) {
  const fallbackCenter: [number, number] = center ??
    (points[0] ? [points[0].lat, points[0].lng] : [-2.5, 118]);

  return (
    <MapContainer
      center={fallbackCenter}
      zoom={points.length > 1 && !center ? 5 : zoom}
      style={{ height, width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker key={point.id} position={[point.lat, point.lng]} icon={icon}>
          <Popup>
            <strong>{point.title}</strong>
            {point.subtitle ? <div>{point.subtitle}</div> : null}
            {point.href ? (
              <a href={point.href} style={{ color: "oklch(0.5883 0.1247 44.6)" }}>
                Lihat detail
              </a>
            ) : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}