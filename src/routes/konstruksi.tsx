import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { PillarPage, pillarQuery } from "@/components/PillarPage";

export const Route = createFileRoute("/konstruksi")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search["category"] === "string" ? (search["category"] as string) : undefined,
  }),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(pillarQuery("konstruksi", deps.category));
  },
  head: () => ({
    meta: [
      { title: "Mulia Konstruksi — Jasa Bangun & Renovasi" },
      {
        name: "description",
        content:
          "Layanan Mulia Konstruksi: bangun rumah baru, renovasi, interior, dan pekerjaan sipil dengan estimasi biaya dan garansi jelas.",
      },
      { property: "og:title", content: "Mulia Konstruksi — Jasa Bangun & Renovasi" },
      {
        property: "og:description",
        content: "Jasa bangun dan renovasi Anugerah Mulia dengan lingkup kerja, estimasi durasi, dan garansi.",
      },
      { property: "og:type", content: "website" },
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
  notFoundComponent: () => <p className="container-page py-24">Halaman tidak ditemukan.</p>,
  component: KonstruksiPage,
});

function KonstruksiPage() {
  const { category } = Route.useSearch();
  return (
    <PillarPage
      pillar="konstruksi"
      to="/konstruksi"
      title="Mulia Konstruksi"
      tagline="Bangun, renovasi, dan interior dengan tim berpengalaman — pilih kategori layanan di bawah."
      category={category}
    />
  );
}
