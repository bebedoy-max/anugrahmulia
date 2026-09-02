import { createServerFn } from "@tanstack/react-start";
import type { Banner, Category, Facility, PropertyCard, PropertyDetail, PropertyFilters } from "./types";

export const listProperties = createServerFn({ method: "GET" })
  .inputValidator((input: PropertyFilters) => input ?? {})
  .handler(async ({ data }): Promise<{ items: PropertyCard[]; total: number }> => {
    const { db } = await import("./db/pgrest.server");
    const { PROPERTY_CARD_SELECT } = await import("./db/selects");
    

    const page = Math.max(1, data.page ?? 1);
    const perPage = Math.min(48, Math.max(1, data.perPage ?? 12));

    let query = db
      .from("properties")
      .select(PROPERTY_CARD_SELECT, { count: "exact" })
      .eq("approval", "approved")
      .in("status", ["aktif", "terjual", "tersewa"]);

    if (data.q) {
      const term = data.q.replace(/[%,()]/g, "").slice(0, 80);
      if (term) query = query.or(`title.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
    }
    if (data.city) query = query.ilike("city", `%${data.city.slice(0, 60)}%`);
    if (data.type === "jual" || data.type === "sewa") query = query.eq("type", data.type);
    if (data.minPrice) query = query.gte("price", data.minPrice);
    if (data.maxPrice) query = query.lte("price", data.maxPrice);
    if (data.bedrooms) query = query.gte("bedrooms", data.bedrooms);
    if (data.minLand) query = query.gte("land_area", data.minLand);
    if (data.minBuilding) query = query.gte("building_area", data.minBuilding);
    if (data.featured) query = query.eq("is_featured", true);

    if (data.category) {
      const { data: cat } = await db
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (!cat) return { items: [], total: 0 };
      query = query.eq("category_id", cat.id);
    }

    if (data.facility) {
      const { data: fac } = await db
        .from("facilities")
        .select("id")
        .eq("slug", data.facility)
        .maybeSingle();
      if (!fac) return { items: [], total: 0 };
      const { data: links } = await db
        .from("property_facilities")
        .select("property_id")
        .eq("facility_id", fac.id);
      const ids = (links ?? []).map((l) => l.property_id);
      if (ids.length === 0) return { items: [], total: 0 };
      query = query.in("id", ids);
    }

    if (data.sort === "termurah") query = query.order("price", { ascending: true });
    else if (data.sort === "termahal") query = query.order("price", { ascending: false });
    else if (data.sort === "populer") query = query.order("views", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const from = (page - 1) * perPage;
    const { data: rows, count, error } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(error.message);

    return { items: (rows ?? []) as unknown as PropertyCard[], total: count ?? 0 };
  });

export const getPropertyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }): Promise<PropertyDetail | null> => {
    const { db } = await import("./db/pgrest.server");
    const { PROPERTY_CARD_SELECT } = await import("./db/selects");
    
    const { data: row, error } = await db
      .from("properties")
      .select(
        `${PROPERTY_CARD_SELECT},description,certificate,agent_phone,agent_id,approval,property_facilities(facilities(id,name,icon))`,
      )
      .eq("slug", data.slug)
      .eq("approval", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const raw = row as unknown as Record<string, unknown>;
    const links = (raw["property_facilities"] ?? []) as { facilities: Facility | null }[];
    delete raw["property_facilities"];
    return {
      ...(raw as unknown as PropertyDetail),
      facilities: links.map((l) => l.facilities).filter(Boolean) as PropertyDetail["facilities"],
    };
  });

export const getSimilarProperties = createServerFn({ method: "GET" })
  .inputValidator((input: { city: string; excludeSlug: string }) => input)
  .handler(async ({ data }): Promise<PropertyCard[]> => {
    const { db } = await import("./db/pgrest.server");
    const { PROPERTY_CARD_SELECT } = await import("./db/selects");
    
    const { data: rows } = await db
      .from("properties")
      .select(PROPERTY_CARD_SELECT)
      .eq("approval", "approved")
      .eq("status", "aktif")
      .eq("city", data.city)
      .neq("slug", data.excludeSlug)
      .limit(3);
    return (rows ?? []) as unknown as PropertyCard[];
  });

export const registerPropertyView = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    await dbAdmin.rpc("increment_property_views", { _slug: data.slug });
    return { ok: true };
  });

export const getFilterMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: Category[]; facilities: Facility[]; cities: string[] }> => {
    const { db } = await import("./db/pgrest.server");
    
    const [categories, facilities, cities] = await Promise.all([
      db.from("categories").select("id,name,slug,icon,pillar").order("name"),
      db.from("facilities").select("id,name,slug,icon").order("name"),
      db
        .from("properties")
        .select("city")
        .eq("approval", "approved")
        .in("status", ["aktif", "terjual", "tersewa"]),
    ]);
    const uniqueCities = Array.from(new Set((cities.data ?? []).map((c) => c.city))).sort();
    return {
      categories: (categories.data ?? []) as Category[],
      facilities: (facilities.data ?? []) as Facility[],
      cities: uniqueCities,
    };
  },
);

export const getHomeData = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    featured: PropertyCard[];
    newest: PropertyCard[];
    banners: Banner[];
    cities: { city: string; count: number }[];
    totalListings: number;
  }> => {
    const { db } = await import("./db/pgrest.server");
    const { PROPERTY_CARD_SELECT } = await import("./db/selects");
    
    const [featured, newest, banners, all] = await Promise.all([
      db
        .from("properties")
        .select(PROPERTY_CARD_SELECT)
        .eq("approval", "approved")
        .eq("status", "aktif")
        .eq("is_featured", true)
        .order("views", { ascending: false })
        .limit(6),
      db
        .from("properties")
        .select(PROPERTY_CARD_SELECT)
        .eq("approval", "approved")
        .eq("status", "aktif")
        .order("created_at", { ascending: false })
        .limit(6),
      db
        .from("banners")
        .select("id,title,subtitle,image_url,link_url")
        .eq("is_active", true)
        .order("sort_order"),
      db
        .from("properties")
        .select("city")
        .eq("approval", "approved")
        .in("status", ["aktif", "terjual", "tersewa"]),
    ]);

    const counter = new Map<string, number>();
    for (const row of all.data ?? []) counter.set(row.city, (counter.get(row.city) ?? 0) + 1);
    const cities = Array.from(counter.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      featured: (featured.data ?? []) as unknown as PropertyCard[],
      newest: (newest.data ?? []) as unknown as PropertyCard[],
      banners: (banners.data ?? []) as Banner[],
      cities,
      totalListings: (all.data ?? []).length,
    };
  },
);