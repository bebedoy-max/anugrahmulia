import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export type CategoryInput = {
  id?: string | undefined;
  pillar: "properti" | "konstruksi" | "pertanahan";
  name: string;
  icon: string | null;
};

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { pillar?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    let query = db.from("categories").select("id,name,slug,icon,pillar").order("name").limit(300);
    if (data.pillar) query = query.eq("pillar", data.pillar);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: CategoryInput) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { slugify } = await import("./format");
    const name = (data.name ?? "").trim().slice(0, 60);
    if (!name) throw new Error("Nama kategori wajib diisi");
    const payload = {
      name,
      slug: slugify(name),
      icon: data.icon?.slice(0, 60) || null,
      pillar: data.pillar,
    };
    if (data.id) {
      const { error } = await db.from("categories").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await db
      .from("categories")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { count } = await db
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Kategori masih dipakai layanan aktif");
    const { error } = await db.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
