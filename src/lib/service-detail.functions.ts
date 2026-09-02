import { createServerFn } from "@tanstack/react-start";
import type { ServiceItem } from "./types";

export const getServiceBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "").slice(0, 160) }))
  .handler(async ({ data }): Promise<ServiceItem | null> => {
    const { db } = await import("./db/pgrest.server");
    
    const { data: row } = await db
      .from("services")
      .select(
        "id,pillar,title,slug,description,price_from,price_unit,duration_estimate,city,image_url,contact_name,contact_phone,work_scope,min_area,warranty,requirements,legal_basis,assistance_mode,sort_order,created_at,category:categories(id,name,slug)",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    return (row as unknown as ServiceItem) ?? null;
  });
