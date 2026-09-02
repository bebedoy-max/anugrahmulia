import { Suspense, lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";

const LeafletMap = lazy(() => import("./LeafletMap"));

export type PropertyMapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  href?: string;
};

export function PropertyMap({
  points,
  center,
  zoom,
  height = 420,
}: {
  points: PropertyMapPoint[];
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  height?: number | undefined;
}) {
  return (
    <ClientOnly fallback={<Skeleton style={{ height }} className="w-full rounded-xl" />}>
      <Suspense fallback={<Skeleton style={{ height }} className="w-full rounded-xl" />}>
        <LeafletMap points={points} center={center} zoom={zoom} height={height} />
      </Suspense>
    </ClientOnly>
  );
}