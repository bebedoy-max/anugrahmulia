import { Suspense, lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const LeafletPicker = lazy(() => import("./LeafletPicker"));

export function LocationPicker({
  value,
  onChange,
  height = 320,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
  height?: number | undefined;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border">
        <ClientOnly fallback={<Skeleton style={{ height }} className="w-full" />}>
          <Suspense fallback={<Skeleton style={{ height }} className="w-full" />}>
            <LeafletPicker
              value={value}
              height={height}
              onPick={(lat, lng) => onChange({ lat, lng })}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {value
            ? `Titik terpilih: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
            : "Klik pada peta untuk menandai lokasi properti."}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) =>
              onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            );
          }}
        >
          Gunakan lokasi saya
        </Button>
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Hapus titik
          </Button>
        ) : null}
      </div>
    </div>
  );
}
