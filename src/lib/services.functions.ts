import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export type ServiceInput = {
  id?: string | undefined;
  pillar: "konstruksi" | "pertanahan";
  categoryId: string | null;
  title: string;
  description: string;
  priceFrom: number;
  priceUnit: string;
  durationEstimate: string | null;
  city: string;
  imageUrl: string | null;
  contactName: string;
  contactPhone: string | null;
  workScope: string | null;
  minArea: number;
  warranty: string | null;
  requirements: string | null;
  legalBasis: string | null;
  assistanceMode: string | null;
  isActive: boolean;
  sortOrder: number;
};

export const adminListServices = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { pillar?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    let query = db
      .from("services")
      .select("*, category:categories(id,name)")
      .order("pillar")
      .order("sort_order")
      .limit(300);
    if (data.pillar === "konstruksi" || data.pillar === "pertanahan") {
      query = query.eq("pillar", data.pillar);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSaveService = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: ServiceInput) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { slugify } = await import("./format");
    const title = data.title.trim().slice(0, 160);
    if (!title) throw new Error("Judul wajib diisi");

    const payload = {
      pillar: data.pillar,
      category_id: data.categoryId,
      title,
      description: (data.description ?? "").slice(0, 4000),
      price_from: Math.max(0, Math.round(data.priceFrom || 0)),
      price_unit: (data.priceUnit || "per proyek").slice(0, 60),
      duration_estimate: data.durationEstimate?.slice(0, 120) || null,
      city: (data.city ?? "").slice(0, 80),
      image_url: data.imageUrl?.slice(0, 500) || null,
      contact_name: (data.contactName || "Anugerah Mulia").slice(0, 120),
      contact_phone: data.contactPhone?.slice(0, 30) || null,
      work_scope: data.pillar === "konstruksi" ? data.workScope?.slice(0, 2000) || null : null,
      min_area: data.pillar === "konstruksi" ? Math.max(0, Math.round(data.minArea || 0)) : 0,
      warranty: data.pillar === "konstruksi" ? data.warranty?.slice(0, 200) || null : null,
      requirements: data.pillar === "pertanahan" ? data.requirements?.slice(0, 2000) || null : null,
      legal_basis: data.pillar === "pertanahan" ? data.legalBasis?.slice(0, 500) || null : null,
      assistance_mode: data.pillar === "pertanahan" ? data.assistanceMode?.slice(0, 120) || null : null,
      is_active: data.isActive,
      sort_order: Math.max(0, Math.round(data.sortOrder || 0)),
    };

    if (data.id) {
      const { error } = await db.from("services").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: created, error } = await db
      .from("services")
      .insert({ ...payload, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { error } = await db.from("services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
