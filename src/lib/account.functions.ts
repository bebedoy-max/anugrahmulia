import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import type { AppRole, PropertyCard } from "./types";

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context;
    const [profile, roles] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile: profile.data,
      roles: ((roles.data ?? []).map((r) => r.role) as AppRole[]) ?? [],
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { name: string; phone?: string; bio?: string; company?: string }) => ({
    name: String(input.name).trim().slice(0, 100),
    phone: input.phone ? String(input.phone).trim().slice(0, 30) : null,
    bio: input.bio ? String(input.bio).trim().slice(0, 500) : null,
    company: input.company ? String(input.company).trim().slice(0, 120) : null,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const becomeAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "agent" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyFavorites = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<PropertyCard[]> => {
    const { data } = await context.db
      .from("favorites")
      .select(
        "property:properties(id,title,slug,type,price,city,province,address,bedrooms,bathrooms,carports,land_area,building_area,status,is_featured,latitude,longitude,views,created_at,agent_name,category:categories(name,slug),images:property_images(url,is_primary,sort_order))",
      )
      .order("created_at", { ascending: false });
    return ((data ?? []).map((r) => r.property).filter(Boolean) as unknown) as PropertyCard[];
  });

export const listMyFavoriteIds = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data } = await context.db.from("favorites").select("property_id");
    return (data ?? []).map((r) => r.property_id);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { propertyId: string }) => ({ propertyId: String(input.propertyId) }))
  .handler(async ({ data, context }) => {
    const { db, userId } = context;
    const { data: existing } = await db
      .from("favorites")
      .select("id")
      .eq("property_id", data.propertyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await db.from("favorites").delete().eq("id", existing.id);
      return { favorited: false };
    }
    const { error } = await db
      .from("favorites")
      .insert({ property_id: data.propertyId, user_id: userId });
    if (error) throw new Error(error.message);
    return { favorited: true };
  });

export const createInquiry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: { propertyId: string; name: string; phone: string; email?: string; message: string }) => ({
      propertyId: String(input.propertyId),
      name: String(input.name).trim().slice(0, 100),
      phone: String(input.phone).trim().slice(0, 30),
      email: input.email ? String(input.email).trim().slice(0, 255) : null,
      message: String(input.message).trim().slice(0, 1000),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.name || !data.phone || !data.message) throw new Error("Data tidak lengkap");
    const { error } = await context.db.from("inquiries").insert({
      property_id: data.propertyId,
      user_id: context.userId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyInquiries = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data } = await context.db
      .from("inquiries")
      .select("id,message,reply,status,created_at,property:properties(title,slug,city,agent_name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: { propertyId: string; name: string; phone: string; scheduledDate: string; note?: string }) => ({
      propertyId: String(input.propertyId),
      name: String(input.name).trim().slice(0, 100),
      phone: String(input.phone).trim().slice(0, 30),
      scheduledDate: String(input.scheduledDate),
      note: input.note ? String(input.note).trim().slice(0, 500) : null,
    }),
  )
  .handler(async ({ data, context }) => {
    const when = new Date(data.scheduledDate);
    if (Number.isNaN(when.getTime())) throw new Error("Tanggal tidak valid");
    const { error } = await context.db.from("schedules").insert({
      property_id: data.propertyId,
      user_id: context.userId,
      name: data.name,
      phone: data.phone,
      scheduled_date: when.toISOString(),
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMySchedules = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data } = await context.db
      .from("schedules")
      .select("id,scheduled_date,status,note,created_at,property:properties(title,slug,city,agent_name)")
      .eq("user_id", context.userId)
      .order("scheduled_date", { ascending: false });
    return data ?? [];
  });

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { propertyId: string; reason: string; detail?: string }) => ({
    propertyId: String(input.propertyId),
    reason: String(input.reason).trim().slice(0, 120),
    detail: input.detail ? String(input.detail).trim().slice(0, 800) : null,
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("reports").insert({
      property_id: data.propertyId,
      user_id: context.userId,
      reason: data.reason,
      detail: data.detail,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });