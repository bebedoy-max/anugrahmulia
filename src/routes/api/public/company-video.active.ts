import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/company-video/active")({
  server: {
    handlers: {
      GET: async () => {
        const { db } = await import("@/lib/db/pgrest.server");
        const { data, error } = await db
          .from("company_profile_videos")
          .select("id,title,description,video_url,thumbnail_url,duration")
          .eq("status", "active")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          return Response.json({ success: false, error: error.message }, { status: 500 });
        }
        return Response.json(
          { success: true, data: data ?? null },
          { headers: { "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
