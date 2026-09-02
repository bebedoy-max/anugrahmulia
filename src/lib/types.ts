export type PropertyImage = { url: string; is_primary: boolean; sort_order: number };

export type PropertyCard = {
  id: string;
  title: string;
  slug: string;
  type: string;
  price: number;
  city: string;
  province: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  carports: number;
  land_area: number;
  building_area: number;
  status: string;
  is_featured: boolean;
  latitude: number | null;
  longitude: number | null;
  views: number;
  created_at: string;
  agent_name: string;
  category: { name: string; slug: string } | null;
  images: PropertyImage[];
};

export type PropertyDetail = PropertyCard & {
  description: string;
  certificate: string | null;
  agent_phone: string | null;
  agent_id: string | null;
  approval: string;
  facilities: { id: string; name: string; icon: string | null }[];
};

export type PropertyFilters = {
  q?: string | undefined;
  city?: string | undefined;
  category?: string | undefined;
  type?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  bedrooms?: number | undefined;
  minLand?: number | undefined;
  minBuilding?: number | undefined;
  facility?: string | undefined;
  featured?: boolean | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

export type Category = { id: string; name: string; slug: string; icon: string | null; pillar?: string };
export type Facility = { id: string; name: string; slug: string; icon: string | null };
export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
};

export type AppRole = "buyer" | "agent" | "admin";

export type ServiceItem = {
  id: string;
  pillar: string;
  title: string;
  slug: string;
  description: string;
  price_from: number;
  price_unit: string;
  duration_estimate: string | null;
  city: string;
  image_url: string | null;
  contact_name: string;
  contact_phone: string | null;
  work_scope: string | null;
  min_area: number;
  warranty: string | null;
  requirements: string | null;
  legal_basis: string | null;
  assistance_mode: string | null;
  sort_order: number;
  created_at: string;
  category: { id: string; name: string; slug: string } | null;
};
