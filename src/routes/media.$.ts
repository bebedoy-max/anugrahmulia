// Melayani berkas dari bucket "media" lewat domain aplikasi (aman untuk HTTPS).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rel = String((params as Record<string, string>)["_splat"] ?? "");
        if (!rel || rel.includes("..")) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { BUCKET } = await import("@/lib/storage-remote.server");
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(rel);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
