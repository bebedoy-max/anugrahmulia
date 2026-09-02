import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { listPillarServices } from "@/lib/pillars.functions";
import type { ServiceItem } from "@/lib/types";

export type PillarKey = "konstruksi" | "pertanahan";

export function pillarQuery(pillar: PillarKey, category?: string) {
  return queryOptions({
    queryKey: ["pillar-services", pillar, category ?? ""],
    queryFn: () => listPillarServices({ data: { pillar, category } }),
  });
}

export function PillarPage({
  pillar,
  title,
  tagline,
  category,
  to,
}: {
  pillar: PillarKey;
  title: string;
  tagline: string;
  category?: string | undefined;
  to: "/konstruksi" | "/pertanahan";
}) {
  const { data } = useSuspenseQuery(pillarQuery(pillar, category));
  const active = category ?? "";

  return (
    <PublicLayout>
      <section className="border-b bg-secondary">
        <div className="container-page py-12">
          <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{tagline}</p>
        </div>
      </section>

      <section className="container-page py-8">
        <div className="flex flex-wrap gap-2">
          <Link
            to={to}
            search={{ category: undefined }}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              active === "" ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent"
            }`}
          >
            Semua kategori
          </Link>
          {data.categories.map((c) => (
            <Link
              key={c.id}
              to={to}
              search={{ category: c.slug }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active === c.slug
                  ? "border-accent bg-accent text-accent-foreground"
                  : "hover:border-accent"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {data.items.length === 0 ? (
          <p className="mt-10 rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Belum ada layanan pada kategori ini.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <ServiceCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

export function ServiceCard({ item }: { item: ServiceItem }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-soft">
      <Link to="/layanan/$slug" params={{ slug: item.slug }} className="block">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-44 w-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-secondary text-sm text-muted-foreground">
            Belum ada foto
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {item.category ? <Badge variant="secondary">{item.category.name}</Badge> : null}
          {item.city ? <span className="text-xs text-muted-foreground">{item.city}</span> : null}
        </div>
        <h2 className="font-display text-lg leading-snug">{item.title}</h2>
        <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>

        <dl className="grid gap-1 text-xs text-muted-foreground">
          {item.duration_estimate ? (
            <div>
              <dt className="inline font-medium">Estimasi: </dt>
              <dd className="inline">{item.duration_estimate}</dd>
            </div>
          ) : null}
          {item.work_scope ? (
            <div>
              <dt className="inline font-medium">Lingkup: </dt>
              <dd className="inline line-clamp-2">{item.work_scope}</dd>
            </div>
          ) : null}
          {item.warranty ? (
            <div>
              <dt className="inline font-medium">Garansi: </dt>
              <dd className="inline">{item.warranty}</dd>
            </div>
          ) : null}
          {item.requirements ? (
            <div>
              <dt className="inline font-medium">Dokumen: </dt>
              <dd className="inline line-clamp-2">{item.requirements}</dd>
            </div>
          ) : null}
          {item.legal_basis ? (
            <div>
              <dt className="inline font-medium">Dasar hukum: </dt>
              <dd className="inline line-clamp-2">{item.legal_basis}</dd>
            </div>
          ) : null}
          {item.assistance_mode ? (
            <div>
              <dt className="inline font-medium">Pendampingan: </dt>
              <dd className="inline">{item.assistance_mode}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <p className="text-sm font-semibold">
            {item.price_from > 0 ? `Mulai ${formatRupiah(item.price_from)}` : "Hubungi kami"}
            <span className="block text-xs font-normal text-muted-foreground">{item.price_unit}</span>
          </p>
          <Button asChild size="sm">
            <Link to="/layanan/$slug" params={{ slug: item.slug }}>
              Detail
            </Link>
          </Button>

        </div>
      </div>
    </article>
  );
}
