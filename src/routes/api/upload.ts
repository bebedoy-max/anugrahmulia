// Endpoint unggah berkas (butuh sesi login). Menyimpan ke disk server sendiri.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readSession } = await import("@/lib/auth/session.server");
        const session = readSession();
        if (!session) return new Response("Unauthorized", { status: 401 });

        const { saveRemoteUpload: saveUpload, IMAGE_TYPES, VIDEO_TYPES } = await import(
          "@/lib/storage-remote.server"
        );
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return new Response("Berkas tidak ditemukan", { status: 400 });

          const kind = String(form.get("kind") ?? "image");
          const folder = String(form.get("folder") ?? "");
          const saved = await saveUpload(file, {
            folder,
            allowed: kind === "video" ? VIDEO_TYPES : IMAGE_TYPES,
            maxBytes: kind === "video" ? 200 * 1024 * 1024 : 8 * 1024 * 1024,
          });

          return Response.json(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Gagal mengunggah berkas";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
