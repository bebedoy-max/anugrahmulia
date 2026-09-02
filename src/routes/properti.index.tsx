import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { Filter, Search } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { PropertyCardItem } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFilterMeta, listProperties } from "@/lib/properties.functions";
import type { PropertyFilters } from "@/lib/types";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  pillar: fallback(z.string(), "").default(""),
  type: fallback(z.string(), "").default(""),
  facility: fallback(z.string(), "").default(""),
  minPrice: fallback(z.number(), 0).default(0),
  maxPrice: fallback(z.number(), 0).default(0),
  bedrooms: fallback(z.number(), 0).default(0),
  featured: fallback(z.boolean(), false).default(false),
  sort: fallback(z.string(), "terbaru").default("terbaru"),
  page: fallback(z.number(), 1).default(1),
});

const PER_PAGE = 12;

function listQuery(filters: PropertyFilters) {
  return queryOptions({
    queryKey: ["properties", filters],
    queryFn: () => listProperties({ data: filters }),
  });
}

const metaQuery = queryOptions({ queryKey: ["filter-meta"], queryFn: () => getFilterMeta() });

function toFilters(search: z.infer<typeof searchSchema>): PropertyFilters {
  return {
    q: search.q || undefined,
    city: search.city || undefined,
    category: search.category || undefined,
    type: search.type || undefined,
    facility: search.facility || undefined,
    minPrice: search.minPrice || undefined,
    maxPrice: search.maxPrice || undefined,
    bedrooms: search.bedrooms || undefined,
    featured: search.featured || undefined,
    sort: search.sort,
    page: Math.max(1, search.page),
    perPage: PER_PAGE,
  };
}

export const Route = createFileRoute("/properti/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(listQuery(toFilters(deps.search)));
    context.queryClient.ensureQueryData(metaQuery);
  },
  head: () => ({
    meta: [
      { title: "Cari Properti Dijual & Disewa — Anugerah Mulia" },
      {
        name: "description",
        content:
          "Telusuri ribuan rumah, apartemen, tanah, dan ruko di Indonesia. Saring berdasarkan harga, lokasi, kamar, dan fasilitas.",
      },
      { property: "og:title", content: "Cari Properti Dijual & Disewa — Anugerah Mulia" },
      { property: "og:description", content: "Filter listing properti Indonesia sesuai kebutuhan Anda." },
    ],
  }),
  errorComponent: ({ error }) => (
    <PublicLayout>
      <p role="alert" className="container-page py-24 text-center">Gagal memuat listing: {error.message}</p>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <p className="container-page py-24 text-center">Listing tidak ditemukan.</p>
    </PublicLayout>
  ),
  component: PropertiPage,
});

function PropertiPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(listQuery(toFilters(search)));
  const { data: meta } = useQuery(metaQuery);
  const [keyword, setKeyword] = useState(search.q);

  const totalPages = Math.max(1, Math.ceil(data.total / PER_PAGE));

  const categoryOptions = (meta?.categories ?? []).filter(
    (c) => (c.pillar ?? "properti") === (search.pillar || "properti"),
  );

  function update(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });
  }

  return (
    <PublicLayout>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl">Cari properti</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.total} listing ditemukan</p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit space-y-5 rounded-xl border bg-card p-5 shadow-soft">
            <p className="flex items-center gap-2 font-semibold">
              <Filter className="size-4 text-accent" aria-hidden /> Filter
            </p>
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: keyword.slice(0, 80) });
              }}
            >
              <Label htmlFor="q">Kata kunci</Label>
              <div className="flex gap-2">
                <Input
                  id="q"
                  value={keyword}
                  maxLength={80}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Lokasi / nama"
                />
                <Button type="submit" size="icon" aria-label="Terapkan pencarian">
                  <Search className="size-4" />
                </Button>
              </div>
            </form>

            <Separator />

            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={search.type || "semua"} onValueChange={(v) => update({ type: v === "semua" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua</SelectItem>
                  <SelectItem value="jual">Dijual</SelectItem>
                  <SelectItem value="sewa">Disewakan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={search.category || "semua"}
                onValueChange={(v) => update({ category: v === "semua" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua kategori</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kota</Label>
              <Select value={search.city || "semua"} onValueChange={(v) => update({ city: v === "semua" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua kota</SelectItem>
                  {(meta?.cities ?? []).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fasilitas</Label>
              <Select
                value={search.facility || "semua"}
                onValueChange={(v) => update({ facility: v === "semua" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua fasilitas</SelectItem>
                  {(meta?.facilities ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.slug}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Harga min</Label>
                <Input
                  id="minPrice"
                  type="number"
                  min={0}
                  defaultValue={search.minPrice || ""}
                  onBlur={(event) => update({ minPrice: Number(event.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Harga maks</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  min={0}
                  defaultValue={search.maxPrice || ""}
                  onBlur={(event) => update({ maxPrice: Number(event.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kamar tidur minimal</Label>
              <Select
                value={String(search.bedrooms)}
                onValueChange={(v) => update({ bedrooms: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n === 0 ? "Semua" : `${n}+`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setKeyword("");
                navigate({ to: ".", search: () => ({ page: 1 }) });
              }}
            >
              Reset filter
            </Button>
          </aside>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/peta">Lihat di peta</Link>
              </Button>
              <Select value={search.sort} onValueChange={(v) => update({ sort: v })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terbaru">Terbaru</SelectItem>
                  <SelectItem value="termurah">Harga termurah</SelectItem>
                  <SelectItem value="termahal">Harga termahal</SelectItem>
                  <SelectItem value="populer">Terpopuler</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.items.length === 0 ? (
              <p className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                Tidak ada properti yang cocok dengan filter Anda.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {data.items.map((property) => (
                  <PropertyCardItem key={property.id} property={property} />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  disabled={search.page <= 1}
                  onClick={() => update({ page: search.page - 1 })}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-muted-foreground">
                  Halaman {search.page} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={search.page >= totalPages}
                  onClick={() => update({ page: search.page + 1 })}
                >
                  Berikutnya
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}