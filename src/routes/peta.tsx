import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { PropertyMap } from "@/components/map/PropertyMap";
import { PropertyCardItem } from "@/components/PropertyCard";
import { formatPrice } from "@/lib/format";
import { listProperties } from "@/lib/properties.functions";

const mapQuery = queryOptions({
  queryKey: ["map-properties"],
  queryFn: () => listProperties({ data: { perPage: 48, page: 1 } }),
});

export const Route = createFileRoute("/peta")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(mapQuery);
  },
  head: () => ({
    meta: [
      { title: "Pencarian Properti di Peta — Anugerah Mulia" },
      {
        name: "description",
        content: "Lihat sebaran listing rumah, apartemen, dan tanah di peta Indonesia secara interaktif.",
      },
      { property: "og:title", content: "Pencarian Properti di Peta — Anugerah Mulia" },
      { property: "og:description", content: "Peta interaktif listing properti di seluruh Indonesia." },
    ],
  }),
  errorComponent: ({ error }) => (
    <PublicLayout>
      <p role="alert" className="container-page py-24 text-center">Gagal memuat peta: {error.message}</p>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout><p className="container-page py-24 text-center">Data tidak ditemukan.</p></PublicLayout>
  ),
  component: PetaPage,
});

function PetaPage() {
  const { data } = useSuspenseQuery(mapQuery);
  const points = data.items
    .filter((item) => item.latitude != null && item.longitude != null)
    .map((item) => ({
      id: item.id,
      lat: item.latitude as number,
      lng: item.longitude as number,
      title: item.title,
      subtitle: `${formatPrice(item.price, item.type)} · ${item.city}`,
      href: `/properti/${item.slug}`,
    }));

  return (
    <PublicLayout>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl">Pencarian di peta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {points.length} listing dengan titik lokasi tersedia.
        </p>
        <div className="mt-6 overflow-hidden rounded-xl border shadow-soft">
          <PropertyMap points={points} height={520} />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.items.slice(0, 9).map((property) => (
            <PropertyCardItem key={property.id} property={property} />
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}