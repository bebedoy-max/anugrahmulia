import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const [props, users, inquiries, schedules, reports] = await Promise.all([
      dbAdmin.from("properties").select("id,approval,status,views,price"),
      dbAdmin.from("profiles").select("id,is_active"),
      dbAdmin.from("inquiries").select("id,status"),
      dbAdmin.from("schedules").select("id,status"),
      dbAdmin.from("reports").select("id,status"),
    ]);
    const rows = props.data ?? [];
    return {
      totalListing: rows.length,
      pending: rows.filter((p) => p.approval === "pending").length,
      aktif: rows.filter((p) => p.approval === "approved" && p.status === "aktif").length,
      totalViews: rows.reduce((s, p) => s + (p.views ?? 0), 0),
      totalUser: (users.data ?? []).length,
      userNonaktif: (users.data ?? []).filter((u) => !u.is_active).length,
      totalInquiry: (inquiries.data ?? []).length,
      inquiryBaru: (inquiries.data ?? []).filter((i) => i.status === "baru").length,
      totalJadwal: (schedules.data ?? []).length,
      laporanTerbuka: (reports.data ?? []).filter((r) => r.status === "terbuka").length,
    };
  });

export const adminListProperties = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { approval?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    let query = dbAdmin
      .from("properties")
      .select("id,title,slug,city,price,type,status,approval,reject_reason,agent_name,is_featured,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.approval && data.approval !== "semua") {
      query = query.eq("approval", data.approval as "pending" | "approved" | "rejected");
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminReviewProperty = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; approval: string; reason?: string; featured?: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin
      .from("properties")
      .update({
        approval: data.approval as "pending" | "approved" | "rejected",
        reject_reason:
          data.approval === "rejected" ? (data.reason ?? "Tidak memenuhi ketentuan") : null,
        ...(data.approval === "approved" ? { status: "aktif" as const } : {}),
        ...(typeof data.featured === "boolean" ? { is_featured: data.featured } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const [profiles, roles] = await Promise.all([
      dbAdmin.from("profiles").select("id,name,phone,company,is_active,created_at").order("created_at", { ascending: false }),
      dbAdmin.from("user_roles").select("user_id,role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    return (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { userId: string; role: string }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    await dbAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await dbAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role as "buyer" | "agent" | "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { userId: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { kind: "categories" | "facilities"; name: string; icon?: string }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { slugify } = await import("./format");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const name = data.name.trim().slice(0, 60);
    if (!name) throw new Error("Nama wajib diisi");
    const { error } = await dbAdmin
      .from(data.kind)
      .insert({ name, slug: slugify(name), icon: data.icon ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { kind: "categories" | "facilities"; id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin.from(data.kind).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { data } = await dbAdmin
      .from("reports")
      .select("id,reason,detail,status,created_at,property:properties(title,slug)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin
      .from("reports")
      .update({ status: data.status as "terbuka" | "ditinjau" | "selesai" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListBanners = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { data } = await dbAdmin.from("banners").select("*").order("sort_order");
    return data ?? [];
  });

export const adminSaveBanner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      subtitle?: string;
      image_url?: string;
      link_url?: string;
      is_active: boolean;
      sort_order?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const payload = {
      title: data.title.trim().slice(0, 120),
      subtitle: data.subtitle?.slice(0, 200) || null,
      image_url: data.image_url?.slice(0, 500) || null,
      link_url: data.link_url?.slice(0, 500) || null,
      is_active: data.is_active,
      sort_order: Number.isFinite(data.sort_order) ? Number(data.sort_order) : 0,
    };
    const { error } = data.id
      ? await dbAdmin.from("banners").update(payload).eq("id", data.id)
      : await dbAdmin.from("banners").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBanner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin.from("banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const adminGetProperty = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { data: row, error } = await db
      .from("properties")
      .select("*,images:property_images(url,is_primary,sort_order),property_facilities(facility_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminSaveProperty = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: {
      id?: string | undefined;
      title: string;
      description: string;
      type: string;
      categoryId: string | null;
      price: number;
      address: string;
      city: string;
      province: string;
      latitude: number | null;
      longitude: number | null;
      landArea: number;
      buildingArea: number;
      bedrooms: number;
      bathrooms: number;
      carports: number;
      certificate: string | null;
      status: string;
      approval: string;
      isFeatured: boolean;
      agentName: string;
      agentPhone: string | null;
      images: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    const { slugify } = await import("./format");
    const title = data.title.trim().slice(0, 160);
    if (!title) throw new Error("Judul wajib diisi");

    const payload = {
      title,
      description: data.description.slice(0, 4000),
      type: data.type as "jual" | "sewa",
      category_id: data.categoryId,
      price: Math.max(0, Math.round(data.price)),
      address: data.address.slice(0, 250),
      city: data.city.slice(0, 80),
      province: data.province.slice(0, 80),
      latitude: data.latitude,
      longitude: data.longitude,
      land_area: Math.max(0, Math.round(data.landArea)),
      building_area: Math.max(0, Math.round(data.buildingArea)),
      bedrooms: Math.max(0, Math.round(data.bedrooms)),
      bathrooms: Math.max(0, Math.round(data.bathrooms)),
      carports: Math.max(0, Math.round(data.carports)),
      certificate: data.certificate,
      status: data.status as "draft" | "aktif" | "terjual" | "tersewa" | "nonaktif",
      approval: data.approval as "pending" | "approved" | "rejected",
      is_featured: data.isFeatured,
      agent_name: data.agentName.slice(0, 120) || "Admin",
      agent_phone: data.agentPhone,
    };

    let propertyId = data.id;
    if (propertyId) {
      const { error } = await db.from("properties").update(payload).eq("id", propertyId);
      if (error) throw new Error(error.message);
    } else {
      const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: created, error } = await db
        .from("properties")
        .insert({ ...payload, slug, agent_id: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      propertyId = created.id;
    }

    await db.from("property_images").delete().eq("property_id", propertyId);
    const images = data.images.filter(Boolean).slice(0, 12);
    if (images.length) {
      await db.from("property_images").insert(
        images.map((url, index) => ({
          property_id: propertyId!,
          url,
          is_primary: index === 0,
          sort_order: index,
        })),
      );
    }
    return { id: propertyId };
  });

export const adminDeleteProperty = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const db = await assertAdmin(context);
    await db.from("property_images").delete().eq("property_id", data.id);
    await db.from("property_facilities").delete().eq("property_id", data.id);
    await db.from("favorites").delete().eq("property_id", data.id);
    await db.from("inquiries").delete().eq("property_id", data.id);
    await db.from("schedules").delete().eq("property_id", data.id);
    await db.from("reports").delete().eq("property_id", data.id);
    const { error } = await db.from("properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
