import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/DashboardShell";
import { PropertyCardItem } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { listMyFavorites, toggleFavorite } from "@/lib/account.functions";
import type { PropertyCard } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/favorit")({
  head: () => ({
    meta: [
      { title: "Properti Favorit Saya — Anugerah Mulia" },
      { name: "description", content: "Daftar properti yang Anda simpan di Anugerah Mulia." },
      { property: "og:title", content: "Properti Favorit Saya" },
      { property: "og:description", content: "Kelola listing yang Anda simpan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavoritPage,
});

function FavoritPage() {
  const fetchFavorites = useServerFn(listMyFavorites);
  const removeFavorite = useServerFn(toggleFavorite);
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => fetchFavorites(),
  });

  const items = (data as unknown as PropertyCard[]) ?? [];

  return (
    <DashboardShell title="Properti favorit" description="Listing yang Anda simpan.">
      {isLoading ? (
        <p className="text-muted-foreground">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Belum ada properti tersimpan.</p>
          <Button asChild className="mt-4"><Link to="/properti" search={{ page: 1 }}>Cari properti</Link></Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((property) => (
            <PropertyCardItem
              key={property.id}
              property={property}
              favorited
              onToggleFavorite={async (id) => {
                await removeFavorite({ data: { propertyId: id } });
                void queryClient.invalidateQueries({ queryKey: ["favorites"] });
              }}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}