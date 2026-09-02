CREATE TYPE public.app_role AS ENUM ('buyer', 'agent', 'admin');
CREATE TYPE public.listing_type AS ENUM ('jual', 'sewa');
CREATE TYPE public.property_status AS ENUM ('draft', 'aktif', 'terjual', 'tersewa', 'nonaktif');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.inquiry_status AS ENUM ('baru', 'dibalas', 'ditutup');
CREATE TYPE public.schedule_status AS ENUM ('menunggu', 'dikonfirmasi', 'selesai', 'dibatalkan');
CREATE TYPE public.report_status AS ENUM ('terbuka', 'ditinjau', 'selesai');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '', phone TEXT, avatar_url TEXT, bio TEXT, company TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
  role public.app_role NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
CREATE POLICY roles_read_own ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_admin_manage ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  icon TEXT, pillar TEXT NOT NULL DEFAULT 'properti', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_public_read ON public.categories FOR SELECT USING (true);
CREATE POLICY categories_admin_manage ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  icon TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facilities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY facilities_public_read ON public.facilities FOR SELECT USING (true);
CREATE POLICY facilities_admin_manage ON public.facilities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL DEFAULT '', agent_phone TEXT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', type public.listing_type NOT NULL DEFAULT 'jual',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, price BIGINT NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', province TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, land_area INTEGER NOT NULL DEFAULT 0,
  building_area INTEGER NOT NULL DEFAULT 0, bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0, carports INTEGER NOT NULL DEFAULT 0, certificate TEXT,
  status public.property_status NOT NULL DEFAULT 'draft', approval public.approval_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT, is_featured BOOLEAN NOT NULL DEFAULT false, views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.properties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY properties_public_read ON public.properties FOR SELECT USING (approval = 'approved' AND status IN ('aktif','terjual','tersewa'));
CREATE POLICY properties_owner_read ON public.properties FOR SELECT TO authenticated USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY properties_agent_insert ON public.properties FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid() AND (public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY properties_owner_update ON public.properties FOR UPDATE TO authenticated USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY properties_owner_delete ON public.properties FOR DELETE TO authenticated USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX properties_city_idx ON public.properties(city);
CREATE INDEX properties_price_idx ON public.properties(price);
CREATE INDEX properties_public_idx ON public.properties(approval,status);
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_property_views(_slug TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.properties SET views = views + 1 WHERE slug = _slug AND approval = 'approved';
$$;
REVOKE ALL ON FUNCTION public.increment_property_views(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_property_views(TEXT) TO anon, authenticated, service_role;

CREATE TABLE public.property_images (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 url TEXT NOT NULL, is_primary BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images TO authenticated;
GRANT ALL ON public.property_images TO service_role;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY images_public_read ON public.property_images FOR SELECT USING (true);
CREATE POLICY images_owner_manage ON public.property_images FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND (p.agent_id=auth.uid() OR public.has_role(auth.uid(),'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND (p.agent_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE INDEX property_images_property_idx ON public.property_images(property_id);

CREATE TABLE public.property_facilities (
 property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
 PRIMARY KEY(property_id,facility_id)
);
GRANT SELECT ON public.property_facilities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_facilities TO authenticated;
GRANT ALL ON public.property_facilities TO service_role;
ALTER TABLE public.property_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY pf_public_read ON public.property_facilities FOR SELECT USING (true);
CREATE POLICY pf_owner_manage ON public.property_facilities FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND (p.agent_id=auth.uid() OR public.has_role(auth.uid(),'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND (p.agent_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.favorites (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
 property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id,property_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_own ON public.favorites FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE TABLE public.inquiries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 name TEXT NOT NULL, email TEXT, phone TEXT NOT NULL, message TEXT NOT NULL, reply TEXT,
 status public.inquiry_status NOT NULL DEFAULT 'baru', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY inquiries_insert_auth ON public.inquiries FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY inquiries_read ON public.inquiries FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid()));
CREATE POLICY inquiries_update_agent ON public.inquiries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid())) WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid()));
CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.schedules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 name TEXT NOT NULL, phone TEXT NOT NULL, scheduled_date TIMESTAMPTZ NOT NULL, note TEXT,
 status public.schedule_status NOT NULL DEFAULT 'menunggu', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedules_insert_own ON public.schedules FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY schedules_read ON public.schedules FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid()));
CREATE POLICY schedules_update ON public.schedules FOR UPDATE TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid())) WITH CHECK (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=property_id AND p.agent_id=auth.uid()));
CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, detail TEXT, status public.report_status NOT NULL DEFAULT 'terbuka', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_insert_own ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY reports_read ON public.reports FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY reports_admin_update ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.banners (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, subtitle TEXT, image_url TEXT, link_url TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY banners_public_read ON public.banners FOR SELECT USING (is_active=true);
CREATE POLICY banners_admin_manage ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.services (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pillar TEXT NOT NULL CHECK (pillar IN ('konstruksi','pertanahan')),
 category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL DEFAULT '', price_from BIGINT NOT NULL DEFAULT 0, price_unit TEXT NOT NULL DEFAULT 'per proyek',
 duration_estimate TEXT, city TEXT NOT NULL DEFAULT '', image_url TEXT, contact_name TEXT NOT NULL DEFAULT 'Anugerah Mulia',
 contact_phone TEXT, work_scope TEXT, min_area INTEGER NOT NULL DEFAULT 0, warranty TEXT, requirements TEXT,
 legal_basis TEXT, assistance_mode TEXT, is_active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY services_public_read ON public.services FOR SELECT USING (is_active=true);
CREATE POLICY services_admin_manage ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX services_pillar_idx ON public.services(pillar,sort_order);

CREATE TABLE public.company_profile_videos (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, video_url TEXT NOT NULL,
 storage_path TEXT, thumbnail_url TEXT, duration INTEGER, file_size BIGINT,
 status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')), uploaded_by UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.company_profile_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profile_videos TO authenticated;
GRANT ALL ON public.company_profile_videos TO service_role;
ALTER TABLE public.company_profile_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY videos_public_read ON public.company_profile_videos FOR SELECT USING (status='active' AND deleted_at IS NULL);
CREATE POLICY videos_admin_manage ON public.company_profile_videos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER videos_updated_at BEFORE UPDATE ON public.company_profile_videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.categories(name,slug,icon,pillar) VALUES
('Tirtayasa Mulia','tirtayasa-mulia','Home','properti'),('Antasari Mulia','antasari-mulia','Building2','properti'),
('Kedamaian Mulia','kedamaian-mulia','Trees','properti'),('Teluk Mulia','teluk-mulia','Store','properti'),
('Selamat Mulia','selamat-mulia','Palmtree','properti'),('Kencana Mulia','kencana-mulia','Home','properti'),
('Pembangunan Rumah','pembangunan-rumah','Home','konstruksi'),('Pembangunan Ruko','pembangunan-ruko','Store','konstruksi'),
('Renovasi & Perbaikan','renovasi-perbaikan','Hammer','konstruksi'),('Konsultasi Pertanahan','konsultasi-pertanahan','Scale','pertanahan');

INSERT INTO public.facilities(name,slug,icon) VALUES
('Kolam Renang','kolam-renang','Waves'),('Carport','carport','Car'),('Taman','taman','Trees'),('AC','ac','Wind'),
('Keamanan 24 Jam','keamanan','ShieldCheck'),('Perabotan','perabotan','Sofa'),('Dapur Bersih','dapur','ChefHat'),('Wifi','wifi','Wifi');

INSERT INTO public.properties(title,slug,description,type,category_id,price,address,city,province,latitude,longitude,land_area,building_area,bedrooms,bathrooms,carports,certificate,status,approval,is_featured,views,agent_name,agent_phone)
SELECT v.title,v.slug,v.description,v.type::public.listing_type,c.id,v.price,v.address,v.city,v.province,v.lat,v.lng,v.land,v.build,v.bed,v.bath,v.carport,v.cert,'aktif'::public.property_status,'approved'::public.approval_status,v.featured,v.views,v.agent,v.phone
FROM (VALUES
('Rumah Modern Minimalis di Pondok Indah','rumah-modern-minimalis-pondok-indah','Rumah dua lantai bergaya modern minimalis di kawasan elite Pondok Indah.','jual','tirtayasa-mulia',7500000000::bigint,'Jl. Metro Pondok Indah No. 12','Jakarta Selatan','DKI Jakarta',-6.2779,106.7830,320,280,4,3,2,'SHM',true,412,'Dewi Anggraini','081234567801'),
('Apartemen Full Furnished Sudirman Park','apartemen-full-furnished-sudirman-park','Unit dua kamar siap huni dengan fasilitas lengkap.','sewa','antasari-mulia',95000000::bigint,'Jl. KH Mas Mansyur Kav. 35','Jakarta Pusat','DKI Jakarta',-6.2010,106.8110,0,64,2,1,1,'Strata Title',true,338,'Rizky Pratama','081234567802'),
('Tanah Kavling Siap Bangun di Sentul','tanah-kavling-siap-bangun-sentul','Kavling datar siap bangun di kawasan perbukitan Sentul.','jual','kedamaian-mulia',1850000000::bigint,'Jl. Sentul Nirwana Blok C','Bogor','Jawa Barat',-6.5600,106.8560,500,0,0,0,0,'SHM',false,151,'Andi Saputra','081234567803'),
('Ruko 3 Lantai Pusat Bisnis Bandung','ruko-3-lantai-pusat-bisnis-bandung','Ruko strategis di jalan utama untuk kantor atau retail.','jual','teluk-mulia',4200000000::bigint,'Jl. Soekarno Hatta No. 210','Bandung','Jawa Barat',-6.9430,107.6350,120,300,0,3,2,'SHGB',true,220,'Nurul Hidayah','081234567804'),
('Vila Tropis View Sawah Ubud','vila-tropis-view-sawah-ubud','Vila dengan kolam renang pribadi menghadap persawahan.','jual','selamat-mulia',6300000000::bigint,'Jl. Raya Pengosekan, Ubud','Gianyar','Bali',-8.5190,115.2620,600,240,3,3,2,'SHM',true,504,'Made Wirawan','081234567805'),
('Rumah Cluster Baru di BSD City','rumah-cluster-baru-bsd-city','Rumah cluster baru dengan konsep smart home.','jual','tirtayasa-mulia',2450000000::bigint,'Cluster Alesha, BSD City','Tangerang Selatan','Banten',-6.3010,106.6520,105,120,3,2,1,'SHM',false,197,'Siti Rahmawati','081234567806')
) AS v(title,slug,description,type,category_slug,price,address,city,province,lat,lng,land,build,bed,bath,carport,cert,featured,views,agent,phone)
JOIN public.categories c ON c.slug=v.category_slug;

INSERT INTO public.property_images(property_id,url,is_primary,sort_order)
SELECT p.id, '/images/properti-' || row_number() OVER (ORDER BY p.created_at) || '.jpg', true, 0 FROM public.properties p;
INSERT INTO public.property_facilities(property_id,facility_id)
SELECT p.id,f.id FROM public.properties p CROSS JOIN public.facilities f WHERE f.slug IN ('carport','keamanan') ON CONFLICT DO NOTHING;
INSERT INTO public.banners(title,subtitle,image_url,link_url,sort_order) VALUES
('Temukan Properti Impian Anda','Pilihan properti terbaik dari Anugerah Mulia','/images/properti-1.jpg','/properti',1);
INSERT INTO public.services(pillar,category_id,title,slug,description,price_from,price_unit,duration_estimate,city,contact_name,contact_phone,requirements,assistance_mode,is_active,sort_order)
SELECT 'pertanahan',c.id,'Konsultasi Status & Legalitas Tanah','konsultasi-status-legalitas-tanah','Konsultasi awal untuk memahami status, riwayat, dan dokumen pertanahan.',500000,'per sesi','1-2 hari','Bandar Lampung','Anugerah Mulia','081234567800','Salinan identitas dan dokumen tanah','Tatap muka / daring',true,1 FROM public.categories c WHERE c.slug='konsultasi-pertanahan';