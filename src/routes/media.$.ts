// Menyajikan berkas dari folder media lama (pola URL /media/... warisan situs lama)
// langsung dari folder unggahan (UPLOAD_DIR), mis. storage/uploads/media/banner/xxx.jpg.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readUpload } = await import("@/lib/storage.server");
        const rel = String((params as Record<string, string>)["_splat"] ?? "");
        const file = await readUpload(rel);
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(file.body), {
          headers: {
            "content-type": file.type,
            "content-length": String(file.size),
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
