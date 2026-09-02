import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export type CompanyVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  status: string;
  storage_path: string | null;
  created_at: string;
  deleted_at: string | null;
};

async function assertAdmin(context: { db: any; userId: string }) {
  const { data: isAdmin } = await context.db.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
  return dbAdmin;
}

/** Public: video company profile yang sedang aktif untuk beranda. */
export const getActiveCompanyVideo = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompanyVideo | null> => {
    const { db } = await import("./db/pgrest.server");
    const { data } = await db
      .from("company_profile_videos")
      .select("id,title,description,video_url,thumbnail_url,duration,file_size,status,storage_path,created_at,deleted_at")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as CompanyVideo | null) ?? null;
  },
);

export const adminListCompanyVideos = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input?: { includeDeleted?: boolean }) => input ?? {})
  .handler(async ({ data, context }): Promise<CompanyVideo[]> => {
    const dbAdmin = await assertAdmin(context as any);
    let query = dbAdmin
      .from("company_profile_videos")
      .select("id,title,description,video_url,thumbnail_url,duration,file_size,status,storage_path,created_at,deleted_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data.includeDeleted) query = query.is("deleted_at", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CompanyVideo[];
  });

export const adminSaveCompanyVideo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      description?: string;
      videoUrl?: string;
      storagePath?: string;
      thumbnailUrl?: string;
      duration?: number;
      fileSize?: number;
      status?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const dbAdmin = await assertAdmin(context as any);
    const title = data.title?.trim().slice(0, 140);
    if (!title) throw new Error("Judul wajib diisi");
    const status = data.status === "active" ? "active" : "inactive";

    const payload: Record<string, unknown> = {
      title,
      description: data.description?.trim().slice(0, 1000) || null,
      thumbnail_url: data.thumbnailUrl || null,
      duration: data.duration ? Math.round(data.duration) : null,
      status,
    };
    if (data.videoUrl) payload["video_url"] = data.videoUrl;
    if (data.storagePath) payload["storage_path"] = data.storagePath;
    if (data.fileSize) payload["file_size"] = data.fileSize;

    let id = data.id;
    if (id) {
      const { error } = await dbAdmin
        .from("company_profile_videos")
        .update(payload as any)
        .eq("id", id);
      if (error) throw new Error(error.message);

    } else {
      if (!data.videoUrl) throw new Error("Video wajib diunggah");
      const { data: row, error } = await dbAdmin
        .from("company_profile_videos")
        .insert({ ...(payload as any), video_url: data.videoUrl, uploaded_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row!.id;
    }

    if (status === "active" && id) {
      await dbAdmin
        .from("company_profile_videos")
        .update({ status: "inactive" })
        .neq("id", id)
        .eq("status", "active");
    }
    return { ok: true, id };
  });

export const adminSetCompanyVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const dbAdmin = await assertAdmin(context as any);
    const status = data.status === "active" ? "active" : "inactive";
    const { error } = await dbAdmin
      .from("company_profile_videos")
      .update({ status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (status === "active") {
      await dbAdmin
        .from("company_profile_videos")
        .update({ status: "inactive" })
        .neq("id", data.id)
        .eq("status", "active");
    }
    return { ok: true };
  });

export const adminDeleteCompanyVideo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; hard?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const dbAdmin = await assertAdmin(context as any);
    if (data.hard) {
      const { data: row } = await dbAdmin
        .from("company_profile_videos")
        .select("storage_path")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.storage_path) {
        const { removeUpload } = await import("./storage.server");
        await removeUpload(row.storage_path);
      }
      const { error } = await dbAdmin.from("company_profile_videos").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await dbAdmin
      .from("company_profile_videos")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRestoreCompanyVideo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const dbAdmin = await assertAdmin(context as any);
    const { error } = await dbAdmin
      .from("company_profile_videos")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
