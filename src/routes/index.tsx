import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Building2, Home, Hotel, Plus, Scale } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { PropertyCardItem } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { getHomeData } from "@/lib/properties.functions";
import { listPillarHighlights } from "@/lib/pillars.functions";
import { getActiveCompanyVideo } from "@/lib/company-video.functions";
import { ServiceCard } from "@/components/PillarPage";

const homeQuery = queryOptions({ queryKey: ["home"], queryFn: () => getHomeData() });
const pillarHighlightsQuery = queryOptions({
  queryKey: ["pillar-highlights"],
  queryFn: () => listPillarHighlights(),
});

const companyVideoQuery = queryOptions({
  queryKey: ["company-video"],
  queryFn: () => getActiveCompanyVideo(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anugerah Mulia — Marketplace Properti Rumah, Apartemen & Tanah" },
      {
        name: "description",
        content:
          "Cari rumah, apartemen, tanah, dan ruko dijual atau disewa di seluruh Indonesia. Bandingkan harga, lihat peta, dan ajukan survei langsung ke agen.",
      },
      { property: "og:title", content: "Anugerah Mulia — Marketplace Properti Rumah, Apartemen & Tanah" },
      {
        property: "og:description",
        content: "Cari rumah, apartemen, tanah, dan ruko dijual atau disewa di seluruh Indonesia. Bandingkan harga, lihat peta, dan ajukan survei langsung ke agen.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(homeQuery);
    context.queryClient.ensureQueryData(pillarHighlightsQuery);
    context.queryClient.ensureQueryData(companyVideoQuery);
  },
  errorComponent: ({ error }) => (
    <PublicLayout>
      <p role="alert" className="container-page py-24 text-center text-muted-foreground">
        Gagal memuat data: {error.message}
      </p>
    </PublicLayout>
  ),
  notFoundComponent: () => <p className="container-page py-24">Halaman tidak ditemukan.</p>,
  component: Index,
});

const CATEGORIES = [
  { slug: "tirtayasa-mulia", pillar: "properti", label: "Mulia Properti", icon: Home },
  { slug: "", pillar: "konstruksi", label: "Mulia Konstruksi", icon: Building2, to: "/konstruksi" as const },
  { slug: "", pillar: "pertanahan", label: "Mulia Pertanahan", icon: Scale, to: "/pertanahan" as const },
  { slug: "", pillar: "penginapan", label: "Mulia Penginapan", icon: Hotel, disabled: true },
  { slug: "", pillar: "lainnya", label: "Bisnis Lainnya", icon: Plus, disabled: true },
];



function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const { data: pillars } = useSuspenseQuery(pillarHighlightsQuery);
  const { data: companyVideo } = useSuspenseQuery(companyVideoQuery);

  const banner = data.banners[0];

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <img
          src={banner?.image_url ?? "/images/hero-properti.jpg"}
          alt={banner?.title ?? "Hunian tropis modern dengan taman dan kolam renang"}
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-hero" aria-hidden />
        <div className="container-page py-24 md:py-32">
          <div className="max-w-2xl text-primary-foreground">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {data.totalListings}+ listing terverifikasi
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight md:text-6xl">
              {banner?.title ?? "Temukan rumah impian di seluruh Indonesia"}
            </h1>
            <p className="mt-4 text-base text-primary-foreground/80 md:text-lg">
              {banner?.subtitle ??
                "Rumah, apartemen, tanah, dan ruko dijual maupun disewakan — lengkap dengan peta, simulasi KPR, dan jadwal survei langsung dengan agen."}
            </p>
            {banner?.link_url ? (
              <Button asChild className="mt-6">
                <a href={banner.link_url}>Lihat selengkapnya</a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>





      <section className="container-page py-14">
        <h2 className="font-display text-2xl md:text-3xl">Jelajahi berdasarkan kategori</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {CATEGORIES.map((cat) => {
            const cardClass =
              "flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-soft transition-colors";
            return cat.disabled ? (
              <div
                key={cat.label}
                className={`${cardClass} cursor-not-allowed opacity-60`}
                aria-label={`${cat.label} (segera hadir)`}
                title="Segera hadir"
              >
                <cat.icon className="size-7 text-accent" aria-hidden />
                <span className="text-sm font-medium">{cat.label}</span>
              </div>
            ) : "to" in cat && cat.to ? (
              <Link key={cat.label} to={cat.to} search={{ category: undefined }} className={`${cardClass} hover:border-accent`}>
                <cat.icon className="size-7 text-accent" aria-hidden />
                <span className="text-sm font-medium">{cat.label}</span>
              </Link>
            ) : (
              <Link
                key={cat.slug}
                to="/properti"
                search={{ category: cat.slug, pillar: cat.pillar, page: 1 }}
                className={`${cardClass} hover:border-accent`}
              >
                <cat.icon className="size-7 text-accent" aria-hidden />
                <span className="text-sm font-medium">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {data.featured.length > 0 ? (
        <section className="container-page py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl">Properti unggulan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pilihan agen terbaik minggu ini.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/properti" search={{ featured: true, page: 1 }}>Lihat semua</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.featured.map((property) => (
              <PropertyCardItem key={property.id} property={property} />
            ))}
          </div>
        </section>
      ) : null}

      {pillars.konstruksi.length > 0 ? (
        <section className="container-page py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl">Mulia Konstruksi</h2>
              <p className="mt-1 text-sm text-muted-foreground">Jasa bangun, renovasi, dan interior.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/konstruksi" search={{ category: undefined }}>Lihat semua</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.konstruksi.map((item) => (
              <ServiceCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {pillars.pertanahan.length > 0 ? (
        <section className="container-page py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl">Mulia Pertanahan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Legalitas, sertifikat, dan balik nama tanah.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/pertanahan" search={{ category: undefined }}>Lihat semua</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.pertanahan.map((item) => (
              <ServiceCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}


      <section className="container-page pb-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl md:text-3xl">Listing terbaru</h2>
          <Button asChild variant="outline">
            <Link to="/properti" search={{ page: 1 }}>Semua properti</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.newest.map((property) => (
            <PropertyCardItem key={property.id} property={property} />
          ))}
        </div>
      </section>

      {companyVideo ? (
        <section className="container-page py-14">
          <h2 className="font-display text-3xl font-bold md:text-4xl">{companyVideo.title}</h2>
          {companyVideo.description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{companyVideo.description}</p>
          ) : null}
          <video
            src={companyVideo.video_url}
            poster={companyVideo.thumbnail_url ?? undefined}
            controls
            muted
            loop
            playsInline
            preload="none"
            className="mt-6 aspect-video w-full rounded-xl border bg-black shadow-soft"
          />
        </section>
      ) : null}
    </PublicLayout>

  );
}
