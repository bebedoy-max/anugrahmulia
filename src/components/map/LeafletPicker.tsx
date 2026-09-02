import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:oklch(0.5883 0.1247 44.6);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function LeafletPicker({
  value,
  onPick,
  height = 320,
}: {
  value: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  height?: number | undefined;
}) {
  const center: [number, number] = value ? [value.lat, value.lng] : [-6.2088, 106.8456];

  return (
    <MapContainer
      center={center}
      zoom={value ? 15 : 11}
      style={{ height, width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher onPick={onPick} />
      {value ? (
        <Marker
          position={[value.lat, value.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend(event) {
              const pos = (event.target as L.Marker).getLatLng();
              onPick(pos.lat, pos.lng);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
