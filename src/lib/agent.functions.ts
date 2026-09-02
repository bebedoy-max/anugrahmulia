import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export const getAgentStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context;
    const { data: props } = await db
      .from("properties")
      .select("id,views,status,approval")
      .eq("agent_id", userId);
    const ids = (props ?? []).map((p) => p.id);
    const [inq, sch] = await Promise.all([
      ids.length
        ? db.from("inquiries").select("id,status").in("property_id", ids)
        : Promise.resolve({ data: [] as { id: string; status: string }[] }),
      ids.length
        ? db.from("schedules").select("id,status").in("property_id", ids)
        : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    ]);
    return {
      total: (props ?? []).length,
      aktif: (props ?? []).filter((p) => p.status === "aktif" && p.approval === "approved").length,
      pending: (props ?? []).filter((p) => p.approval === "pending").length,
      views: (props ?? []).reduce((sum, p) => sum + (p.views ?? 0), 0),
      inquiries: (inq.data ?? []).length,
      inquiriesBaru: (inq.data ?? []).filter((i) => i.status === "baru").length,
      schedules: (sch.data ?? []).length,
      schedulesMenunggu: (sch.data ?? []).filter((s) => s.status === "menunggu").length,
    };
  });

export const listMyProperties = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db
      .from("properties")
      .select(
        "id,title,slug,type,price,city,status,approval,reject_reason,views,is_featured,created_at,images:property_images(url,is_primary,sort_order)",
      )
      .eq("agent_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyProperty = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.db
      .from("properties")
      .select("*,images:property_images(id,url,is_primary,sort_order),property_facilities(facility_id)")
      .eq("id", data.id)
      .eq("agent_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const savePropertyListing = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (input: {
      id?: string;
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
      images: string[];
      facilityIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { db, userId } = context;
    const { slugify } = await import("./format");

    const title = data.title.trim().slice(0, 160);
    if (!title) throw new Error("Judul wajib diisi");

    const [profile, roles] = await Promise.all([
      db.from("profiles").select("name,phone").eq("id", userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isAgent = (roles.data ?? []).some((r) => r.role === "agent" || r.role === "admin");
    if (!isAgent) throw new Error("Hanya agen yang dapat memasang listing");

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
      agent_id: userId,
      agent_name: profile.data?.name ?? "Agen",
      agent_phone: profile.data?.phone ?? null,
    };

    let propertyId = data.id;
    if (propertyId) {
      const { error } = await db
        .from("properties")
        .update(payload)
        .eq("id", propertyId)
        .eq("agent_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: created, error } = await db
        .from("properties")
        .insert({ ...payload, slug, approval: "pending" })
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

    await db.from("property_facilities").delete().eq("property_id", propertyId);
    if (data.facilityIds.length) {
      await db.from("property_facilities").insert(
        data.facilityIds.map((facility_id) => ({ property_id: propertyId!, facility_id })),
      );
    }

    return { id: propertyId };
  });

export const deletePropertyListing = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("properties")
      .delete()
      .eq("id", data.id)
      .eq("agent_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPropertyStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("properties")
      .update({ status: data.status as "draft" | "aktif" | "terjual" | "tersewa" | "nonaktif" })
      .eq("id", data.id)
      .eq("agent_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAgentInquiries = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data } = await context.db
      .from("inquiries")
      .select("id,name,phone,email,message,reply,status,created_at,property:properties!inner(title,slug,agent_id)")
      .eq("property.agent_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const replyInquiry = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; reply: string }) => ({
    id: String(input.id),
    reply: String(input.reply).trim().slice(0, 1000),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("inquiries")
      .update({ reply: data.reply, status: "dibalas" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("inquiries")
      .update({ status: data.status as "baru" | "dibalas" | "ditutup" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAgentSchedules = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data } = await context.db
      .from("schedules")
      .select("id,name,phone,note,scheduled_date,status,property:properties!inner(title,slug,agent_id)")
      .eq("property.agent_id", context.userId)
      .order("scheduled_date", { ascending: true });
    return data ?? [];
  });

export const updateScheduleStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("schedules")
      .update({ status: data.status as "menunggu" | "dikonfirmasi" | "selesai" | "dibatalkan" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });