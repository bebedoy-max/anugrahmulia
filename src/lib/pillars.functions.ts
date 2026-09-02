import { createServerFn } from "@tanstack/react-start";
import type { Category, ServiceItem } from "./types";

const SERVICE_SELECT =
  "id,pillar,title,slug,description,price_from,price_unit,duration_estimate,city,image_url,contact_name,contact_phone,work_scope,min_area,warranty,requirements,legal_basis,assistance_mode,sort_order,created_at,category:categories(id,name,slug)";

function normalizePillar(value: unknown): "konstruksi" | "pertanahan" {
  return value === "pertanahan" ? "pertanahan" : "konstruksi";
}

export const listPillarServices = createServerFn({ method: "GET" })
  .inputValidator((input: { pillar: string; category?: string | undefined }) => ({
    pillar: normalizePillar(input?.pillar),
    category: input?.category ? String(input.category).slice(0, 80) : undefined,
  }))
  .handler(async ({ data }): Promise<{ categories: Category[]; items: ServiceItem[] }> => {
    const { db } = await import("./db/pgrest.server");
    

    const [catRes, svcRes] = await Promise.all([
      db
        .from("categories")
        .select("id,name,slug,icon,pillar")
        .eq("pillar", data.pillar)
        .order("name"),
      db
        .from("services")
        .select(SERVICE_SELECT)
        .eq("pillar", data.pillar)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    let items = (svcRes.data ?? []) as unknown as ServiceItem[];
    if (data.category) items = items.filter((s) => s.category?.slug === data.category);

    return { categories: (catRes.data ?? []) as Category[], items };
  });

export const listPillarHighlights = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ konstruksi: ServiceItem[]; pertanahan: ServiceItem[] }> => {
    const { db } = await import("./db/pgrest.server");
    
    const { data: rows } = await db
      .from("services")
      .select(SERVICE_SELECT)
      .eq("is_active", true)
      .order("sort_order")
      .limit(100);
    const all = (rows ?? []) as unknown as ServiceItem[];
    return {
      konstruksi: all.filter((s) => s.pillar === "konstruksi").slice(0, 3),
      pertanahan: all.filter((s) => s.pillar === "pertanahan").slice(0, 3),
    };
  },
);
