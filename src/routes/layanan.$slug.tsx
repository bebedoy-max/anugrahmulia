import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { getServiceBySlug } from "@/lib/service-detail.functions";

function serviceQuery(slug: string) {
  return queryOptions({
    queryKey: ["service-detail", slug],
    queryFn: () => getServiceBySlug({ data: { slug } }),
  });
}

export const Route = createFileRoute("/layanan/$slug")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(serviceQuery(params.slug));
  },
  head: () => ({
    meta: [
      { title: "Detail Layanan — Anugerah Mulia" },
      {
        name: "description",
        content:
          "Rincian layanan Anugerah Mulia: lingkup pekerjaan, estimasi biaya, durasi, dokumen, dan informasi kontak.",
      },
      { property: "og:title", content: "Detail Layanan — Anugerah Mulia" },
      {
        property: "og:description",
        content: "Rincian lengkap layanan konstruksi dan pertanahan Anugerah Mulia.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <PublicLayout>
      <p role="alert" className="container-page py-24 text-center text-muted-foreground">
        Gagal memuat layanan: {error.message}
      </p>
    </PublicLayout>
  ),
  component: ServiceDetailPage,
});

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 border-b py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function ServiceDetailPage() {
  const { slug } = Route.useParams();
  const { data: item } = useSuspenseQuery(serviceQuery(slug));

  if (!item) {
    return (
      <PublicLayout>
        <p className="container-page py-24 text-center text-muted-foreground">Layanan tidak ditemukan.</p>
      </PublicLayout>
    );
  }

  const wa = item.contact_phone?.replace(/[^0-9]/g, "");
  const backTo = item.pillar === "pertanahan" ? "/pertanahan" : "/konstruksi";

  return (
    <PublicLayout>
      <article className="container-page py-10">
        <Link to={backTo} search={{ category: undefined }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Kembali ke {item.pillar === "pertanahan" ? "Mulia Pertanahan" : "Mulia Konstruksi"}
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="aspect-[4/3] w-full rounded-xl border object-cover shadow-soft"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border bg-secondary text-muted-foreground">
                Belum ada foto
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {item.category ? <Badge variant="secondary">{item.category.name}</Badge> : null}
              {item.city ? <span className="text-xs text-muted-foreground">{item.city}</span> : null}
            </div>
            <h1 className="mt-3 font-display text-3xl">{item.title}</h1>
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{item.description}</p>

            <p className="mt-5 text-2xl font-semibold">
              {item.price_from > 0 ? `Mulai ${formatRupiah(item.price_from)}` : "Hubungi kami"}
              <span className="block text-sm font-normal text-muted-foreground">{item.price_unit}</span>
            </p>

            {wa ? (
              <Button asChild className="mt-5">
                <a
                  href={`https://wa.me/${wa.startsWith("0") ? `62${wa.slice(1)}` : wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hubungi {item.contact_name}
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <section className="mt-10 rounded-xl border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl">Detail layanan</h2>
          <dl className="mt-4">
            <Row label="Estimasi durasi" value={item.duration_estimate} />
            <Row label="Lingkup pekerjaan" value={item.work_scope} />
            <Row label="Luas minimum" value={item.min_area > 0 ? `${item.min_area} m²` : null} />
            <Row label="Garansi" value={item.warranty} />
            <Row label="Dokumen dibutuhkan" value={item.requirements} />
            <Row label="Dasar hukum" value={item.legal_basis} />
            <Row label="Mode pendampingan" value={item.assistance_mode} />
            <Row label="Kontak" value={item.contact_phone} />
          </dl>
        </section>
      </article>
    </PublicLayout>
  );
}
