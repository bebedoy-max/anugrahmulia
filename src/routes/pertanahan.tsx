import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { PillarPage, pillarQuery } from "@/components/PillarPage";

export const Route = createFileRoute("/pertanahan")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search["category"] === "string" ? (search["category"] as string) : undefined,
  }),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(pillarQuery("pertanahan", deps.category));
  },
  head: () => ({
    meta: [
      { title: "Mulia Pertanahan — Jasa Legalitas & Sertifikat Tanah" },
      {
        name: "description",
        content:
          "Layanan Mulia Pertanahan: pengurusan sertifikat, balik nama, pemecahan bidang, dan pendampingan legalitas tanah.",
      },
      { property: "og:title", content: "Mulia Pertanahan — Jasa Legalitas & Sertifikat Tanah" },
      {
        property: "og:description",
        content: "Pengurusan sertifikat dan legalitas tanah dengan syarat dokumen serta dasar hukum yang jelas.",
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
  component: PertanahanPage,
});

function PertanahanPage() {
  const { category } = Route.useSearch();
  return (
    <PillarPage
      pillar="pertanahan"
      to="/pertanahan"
      title="Mulia Pertanahan"
      tagline="Urus sertifikat, balik nama, dan legalitas tanah dengan pendampingan profesional."
      category={category}
    />
  );
}
