import { createFileRoute } from "@tanstack/react-router";

const STATIC_PATHS = [
  "/",
  "/properti",
  "/peta",
  "/kpr",
  "/pertanahan",
  "/konstruksi",
  "/tentang",
  "/kontak",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Origin diambil dari permintaan, jadi sitemap otomatis benar di domain
        // apa pun (tanpa konfigurasi tambahan saat pindah hosting).
        const origin = new URL(request.url).origin;
        const urls = [...STATIC_PATHS];

        try {
          const { db } = await import("@/lib/db/pgrest.server");
          const { data } = await db
            .from("properties")
            .select("slug")
            .eq("approval", "approved")
            .in("status", ["aktif", "terjual", "tersewa"])
            .limit(5000);
          for (const row of data ?? []) {
            if (row?.slug) urls.push(`/properti/${row.slug}`);
          }
        } catch {
          // Database tidak tersedia: tetap sajikan halaman statis.
        }

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
</urlset>`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
