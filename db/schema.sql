-- ============================================================
-- Prasyarat skema untuk PostgreSQL mandiri (HawkHost / cPanel).
-- Menyediakan objek yang dulu disediakan platform:
--   * peran anon / authenticated / service_role (agar GRANT di skema jalan)
--   * skema auth + tabel auth.users (akun & kata sandi aplikasi)
--   * fungsi auth.uid() (dipakai oleh policy RLS)
-- Aplikasi terhubung sebagai pemilik database, jadi RLS tidak menghalangi;
-- semua pembatasan akses dilakukan di server function.
-- ============================================================

-- gen_random_uuid() sudah bawaan PostgreSQL 13+. Untuk versi lebih lama,
-- pgcrypto dipasang bila tersedia (diabaikan bila tidak ada hak akses).
DO $do$
BEGIN
  IF current_setting('server_version_num')::int < 130000 THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgcrypto tidak dipasang: %', SQLERRM;
END $do$;

-- Di shared hosting (cPanel) user database biasanya TIDAK punya hak CREATEROLE.
-- Bila pembuatan peran gagal, impor tetap diteruskan: aplikasi terhubung sebagai
-- pemilik database dan seluruh pembatasan akses dijalankan di server function.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Tidak bisa membuat peran anon/authenticated/service_role (hak CREATEROLE tidak ada). GRANT & POLICY untuk peran tsb akan dilewati.';
END $$;

-- Helper: menjalankan perintah opsional (GRANT/REVOKE/CREATE POLICY) dan
-- mengabaikannya bila peran targetnya tidak ada di server ini.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.opt(cmd TEXT) RETURNS VOID
LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE cmd;
EXCEPTION
  WHEN undefined_object OR insufficient_privilege OR duplicate_object THEN
    RAISE NOTICE 'dilewati: % (%)', cmd, SQLERRM;
END $fn$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  encrypted_password TEXT NOT NULL,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON auth.users (lower(email));

-- ID pengguna aktif (opsional; server function sudah memfilter sendiri).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;
-- ============ ENUMS ============
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

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  company TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.profiles TO service_role$cmd$);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)$cmd$);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
SELECT private.opt($cmd$GRANT SELECT ON public.user_roles TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.user_roles TO service_role$cmd$);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;
SELECT private.opt($cmd$REVOKE ALL ON SCHEMA private FROM PUBLIC$cmd$);
SELECT private.opt($cmd$GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role$cmd$);

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO anon, authenticated, service_role$cmd$);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_role(_user_id, _role);
$$;
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon$cmd$);
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated$cmd$);
SELECT private.opt($cmd$CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'))$cmd$);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''), 'buyer')::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated$cmd$);
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated$cmd$);

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  pillar TEXT NOT NULL DEFAULT 'properti',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT ON public.categories TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.categories TO service_role$cmd$);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "categories_admin_manage" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'))$cmd$);

-- ============ FACILITIES ============
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT ON public.facilities TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.facilities TO service_role$cmd$);
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "facilities_public_read" ON public.facilities FOR SELECT USING (true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "facilities_admin_manage" ON public.facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'))$cmd$);

-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL DEFAULT '',
  agent_phone TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  type public.listing_type NOT NULL DEFAULT 'jual',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price BIGINT NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  land_area INTEGER NOT NULL DEFAULT 0,
  building_area INTEGER NOT NULL DEFAULT 0,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  carports INTEGER NOT NULL DEFAULT 0,
  certificate TEXT,
  status public.property_status NOT NULL DEFAULT 'draft',
  approval public.approval_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX properties_city_idx ON public.properties (city);
CREATE INDEX properties_price_idx ON public.properties (price);
CREATE INDEX properties_public_idx ON public.properties (approval, status);
SELECT private.opt($cmd$GRANT SELECT ON public.properties TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.properties TO service_role$cmd$);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "properties_public_read" ON public.properties FOR SELECT
  USING (approval = 'approved' AND status IN ('aktif','terjual','tersewa'))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "properties_owner_read" ON public.properties FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "properties_agent_insert" ON public.properties FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() AND (public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'admin')))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "properties_owner_update" ON public.properties FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "properties_owner_delete" ON public.properties FOR DELETE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))$cmd$);
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.increment_property_views(_slug TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.properties SET views = views + 1 WHERE slug = _slug AND approval = 'approved';
$$;
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION private.increment_property_views(TEXT) TO service_role$cmd$);
CREATE OR REPLACE FUNCTION public.increment_property_views(_slug TEXT)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.increment_property_views(_slug);
$$;
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.increment_property_views(TEXT) FROM PUBLIC, anon, authenticated$cmd$);
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION public.increment_property_views(TEXT) TO service_role$cmd$);

CREATE OR REPLACE FUNCTION private.is_public_agent(_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.agent_id = _profile_id
      AND p.approval = 'approved'
      AND p.status IN ('aktif','terjual','tersewa')
  );
$$;
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION private.is_public_agent(UUID) TO anon, authenticated, service_role$cmd$);
CREATE OR REPLACE FUNCTION public.is_public_agent(_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.is_public_agent(_profile_id);
$$;
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.is_public_agent(UUID) FROM PUBLIC, anon, authenticated$cmd$);
SELECT private.opt($cmd$GRANT EXECUTE ON FUNCTION public.is_public_agent(UUID) TO anon, authenticated$cmd$);
SELECT private.opt($cmd$CREATE POLICY profiles_agent_public_read ON public.profiles
FOR SELECT TO anon
USING (is_active = true AND public.is_public_agent(id))$cmd$);
SELECT private.opt($cmd$CREATE POLICY profiles_read_auth ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (is_active = true AND public.is_public_agent(id))
)$cmd$);
SELECT private.opt($cmd$GRANT SELECT (id, name, avatar_url, bio, company, is_active, created_at, updated_at)
  ON public.profiles TO anon$cmd$);

-- ============ PROPERTY IMAGES ============
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX property_images_property_idx ON public.property_images (property_id);
SELECT private.opt($cmd$GRANT SELECT ON public.property_images TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.property_images TO service_role$cmd$);
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "images_public_read" ON public.property_images FOR SELECT USING (true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "images_owner_manage" ON public.property_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))$cmd$);

-- ============ PROPERTY FACILITIES ============
CREATE TABLE public.property_facilities (
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, facility_id)
);
SELECT private.opt($cmd$GRANT SELECT ON public.property_facilities TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_facilities TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.property_facilities TO service_role$cmd$);
ALTER TABLE public.property_facilities ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "pf_public_read" ON public.property_facilities FOR SELECT USING (true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "pf_owner_manage" ON public.property_facilities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))$cmd$);

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);
SELECT private.opt($cmd$GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.favorites TO service_role$cmd$);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "favorites_own" ON public.favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())$cmd$);

-- ============ INQUIRIES ============
CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,
  status public.inquiry_status NOT NULL DEFAULT 'baru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.inquiries TO service_role$cmd$);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "inquiries_insert_auth" ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid())$cmd$);
SELECT private.opt($cmd$CREATE POLICY "inquiries_read" ON public.inquiries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "inquiries_update_agent" ON public.inquiries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))$cmd$);
CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SCHEDULES ============
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  note TEXT,
  status public.schedule_status NOT NULL DEFAULT 'menunggu',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE ON public.schedules TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.schedules TO service_role$cmd$);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "schedules_insert_own" ON public.schedules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())$cmd$);
SELECT private.opt($cmd$CREATE POLICY "schedules_read" ON public.schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "schedules_update" ON public.schedules FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.agent_id = auth.uid()))$cmd$);
CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  status public.report_status NOT NULL DEFAULT 'terbuka',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.reports TO service_role$cmd$);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())$cmd$);
SELECT private.opt($cmd$CREATE POLICY "reports_read" ON public.reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))$cmd$);
SELECT private.opt($cmd$CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'))$cmd$);

-- ============ BANNERS ============
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT ON public.banners TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.banners TO service_role$cmd$);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "banners_public_read" ON public.banners FOR SELECT USING (is_active = true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "banners_admin_manage" ON public.banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'))$cmd$);

-- ============ SERVICES ============
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar text NOT NULL CHECK (pillar IN ('konstruksi','pertanahan')),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  price_from bigint NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'per proyek',
  duration_estimate text,
  city text NOT NULL DEFAULT '',
  image_url text,
  contact_name text NOT NULL DEFAULT 'Anugerah Mulia',
  contact_phone text,
  work_scope text,
  min_area integer NOT NULL DEFAULT 0,
  warranty text,
  requirements text,
  legal_basis text,
  assistance_mode text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT private.opt($cmd$GRANT SELECT ON public.services TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.services TO service_role$cmd$);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY services_public_read ON public.services FOR SELECT USING (is_active = true)$cmd$);
SELECT private.opt($cmd$CREATE POLICY services_admin_manage ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role))$cmd$);
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX services_pillar_idx ON public.services (pillar, sort_order);

-- ============ COMPANY PROFILE VIDEOS ============
CREATE TABLE public.company_profile_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  storage_path TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
SELECT private.opt($cmd$GRANT SELECT ON public.company_profile_videos TO anon$cmd$);
SELECT private.opt($cmd$GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profile_videos TO authenticated$cmd$);
SELECT private.opt($cmd$GRANT ALL ON public.company_profile_videos TO service_role$cmd$);
ALTER TABLE public.company_profile_videos ENABLE ROW LEVEL SECURITY;
SELECT private.opt($cmd$CREATE POLICY "Public can view active videos" ON public.company_profile_videos
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL)$cmd$);
SELECT private.opt($cmd$CREATE POLICY "Admins manage company videos" ON public.company_profile_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'))$cmd$);
CREATE INDEX company_profile_videos_status_idx ON public.company_profile_videos (status, deleted_at);
CREATE OR REPLACE FUNCTION public.set_company_video_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
SELECT private.opt($cmd$REVOKE ALL ON FUNCTION public.set_company_video_updated_at() FROM PUBLIC, anon, authenticated$cmd$);
CREATE TRIGGER update_company_profile_videos_updated_at
  BEFORE UPDATE ON public.company_profile_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_company_video_updated_at();

-- ============ CATATAN PENYIMPANAN BERKAS ============
-- Foto & video TIDAK disimpan di database. Berkas ditulis ke folder
-- UPLOAD_DIR (default ./storage/uploads) dan disajikan lewat rute /uploads/*.
-- Hak akses unggah diperiksa di server (peran admin/agen) sebelum menulis berkas.

-- ============ SEED: CATEGORIES & FACILITIES ============
INSERT INTO public.categories (name, slug, icon, pillar) VALUES
  ('Tirtayasa Mulia','tirtayasa-mulia','Home','properti'),
  ('Antasari Mulia','antasari-mulia','Building2','properti'),
  ('Kedamaian Mulia','kedamaian-mulia','Trees','properti'),
  ('Teluk Mulia','teluk-mulia','Store','properti'),
  ('Selamat Mulia','selamat-mulia','Palmtree','properti'),
  ('Kencana Mulia','kencana-mulia','Home','properti'),
  ('Pembangunan Rumah','pembangunan-rumah','Home','konstruksi'),
  ('Pembangunan Ruko','pembangunan-ruko','Store','konstruksi'),
  ('Pembangunan Gedung','pembangunan-gedung','Building2','konstruksi'),
  ('Pembangunan Hotel','pembangunan-hotel','Hotel','konstruksi'),
  ('Renovasi & Perbaikan','renovasi-perbaikan','Hammer','konstruksi'),
  ('Konsultasi Pertanahan','konsultasi-pertanahan','Scale','pertanahan'),
  ('Sengketa Tanah & Permasalahan Hukum','sengketa-tanah-hukum','Scale','pertanahan'),
  ('Pemeriksaan & Penelusuran Dokumen','pemeriksaan-penelusuran-dokumen','Scale','pertanahan'),
  ('Pendampingan & Mediasi','pendampingan-mediasi','Scale','pertanahan'),
  ('Kordinasi Proses Eksekusi','kordinasi-proses-eksekusi','Scale','pertanahan');

INSERT INTO public.facilities (name, slug, icon) VALUES
  ('Kolam Renang','kolam-renang','Waves'),
  ('Carport','carport','Car'),
  ('Taman','taman','Trees'),
  ('AC','ac','Wind'),
  ('Keamanan 24 Jam','keamanan','ShieldCheck'),
  ('Perabotan','perabotan','Sofa'),
  ('Dapur Bersih','dapur','ChefHat'),
  ('Wifi','wifi','Wifi'),
  ('Lift','lift','ArrowUpDown'),
  ('Gym','gym','Dumbbell');

-- ============ SEED: PROPERTIES ============
INSERT INTO public.properties
 (title, slug, description, type, category_id, price, address, city, province, latitude, longitude,
  land_area, building_area, bedrooms, bathrooms, carports, certificate, status, approval, is_featured, views, agent_name, agent_phone)
SELECT v.title, v.slug, v.description, v.type::public.listing_type, c.id, v.price, v.address, v.city, v.province,
       v.lat, v.lng, v.land, v.build, v.bed, v.bath, v.carport, v.cert, 'aktif'::public.property_status,
       'approved'::public.approval_status, v.featured, v.views, v.agent, v.phone
FROM (VALUES
 ('Rumah Modern Minimalis di Pondok Indah','rumah-modern-minimalis-pondok-indah','Rumah dua lantai bergaya modern minimalis di kawasan elite Pondok Indah. Pencahayaan alami maksimal, taman belakang asri, dan akses cepat ke tol JORR.','jual','tirtayasa-mulia',7500000000,'Jl. Metro Pondok Indah No. 12','Jakarta Selatan','DKI Jakarta',-6.2779,106.7830,320,280,4,3,2,'SHM',true,412,'Dewi Anggraini','081234567801'),
 ('Apartemen Full Furnished Sudirman Park','apartemen-full-furnished-sudirman-park','Unit 2 kamar tidur siap huni dengan view kota. Fasilitas lengkap: kolam renang, gym, keamanan 24 jam, dan akses langsung ke MRT.','sewa','antasari-mulia',95000000,'Jl. KH Mas Mansyur Kav. 35','Jakarta Pusat','DKI Jakarta',-6.2010,106.8110,0,64,2,1,1,'Strata Title',true,338,'Rizky Pratama','081234567802'),
 ('Tanah Kavling Siap Bangun di Sentul','tanah-kavling-siap-bangun-sentul','Kavling datar siap bangun di kawasan perbukitan Sentul. Udara sejuk, lingkungan tenang, dekat exit tol Sentul Selatan.','jual','kedamaian-mulia',1850000000,'Jl. Sentul Nirwana Blok C','Bogor','Jawa Barat',-6.5600,106.8560,500,0,0,0,0,'SHM',false,151,'Andi Saputra','081234567803'),
 ('Ruko 3 Lantai Pusat Bisnis Bandung','ruko-3-lantai-pusat-bisnis-bandung','Ruko strategis di jalan utama dengan lalu lintas padat. Cocok untuk kantor, klinik, atau retail. Sudah termasuk lift barang.','jual','teluk-mulia',4200000000,'Jl. Soekarno Hatta No. 210','Bandung','Jawa Barat',-6.9430,107.6350,120,300,0,3,2,'SHGB',true,220,'Nurul Hidayah','081234567804'),
 ('Vila Tropis View Sawah Ubud','vila-tropis-view-sawah-ubud','Vila kayu dan batu alam dengan kolam renang pribadi menghadap terasering sawah. Ideal untuk investasi sewa harian.','jual','selamat-mulia',6300000000,'Jl. Raya Pengosekan, Ubud','Gianyar','Bali',-8.5190,115.2620,600,240,3,3,2,'SHM',true,504,'Made Wirawan','081234567805'),
 ('Rumah Cluster Baru di BSD City','rumah-cluster-baru-bsd-city','Rumah cluster baru dengan konsep smart home, dua lantai, dalam cluster dengan one gate system dan taman bermain anak.','jual','tirtayasa-mulia',2450000000,'Cluster Alesha, BSD City','Tangerang Selatan','Banten',-6.3010,106.6520,105,120,3,2,1,'SHM',false,197,'Siti Rahmawati','081234567806'),
 ('Apartemen Studio Dekat Kampus UGM','apartemen-studio-dekat-kampus-ugm','Studio nyaman dengan perabotan lengkap, cocok untuk mahasiswa atau pekerja muda. 5 menit ke kampus UGM.','sewa','antasari-mulia',38000000,'Jl. Kaliurang KM 5','Yogyakarta','DI Yogyakarta',-7.7650,110.3780,0,28,1,1,0,'Strata Title',false,289,'Bayu Nugroho','081234567807'),
 ('Rumah Klasik Halaman Luas di Semarang','rumah-klasik-halaman-luas-semarang','Rumah lawas terawat dengan langit-langit tinggi dan halaman luas berpohon rindang di kawasan Candi Baru.','jual','tirtayasa-mulia',3100000000,'Jl. Diponegoro No. 44','Semarang','Jawa Tengah',-7.0000,110.4100,450,300,5,3,3,'SHM',false,133,'Agus Setiawan','081234567808'),
 ('Ruko Sudut Jalan Utama Surabaya','ruko-sudut-jalan-utama-surabaya','Ruko hook dua muka di kawasan komersial padat. Parkir luas dan listrik 5500 VA. Siap pakai untuk usaha.','sewa','teluk-mulia',180000000,'Jl. Raya Darmo No. 88','Surabaya','Jawa Timur',-7.2900,112.7380,90,180,0,2,2,'SHGB',false,164,'Fitri Handayani','081234567809'),
 ('Rumah Tepi Danau di Sentul City','rumah-tepi-danau-sentul-city','Rumah dua lantai menghadap danau buatan, dengan balkon luas dan taman pribadi. Suasana tenang dan hijau.','jual','tirtayasa-mulia',5100000000,'Jl. Danau Sentul City','Bogor','Jawa Barat',-6.5720,106.8630,300,260,4,3,2,'SHM',true,276,'Andi Saputra','081234567803'),
 ('Apartemen 3BR Keluarga di Kelapa Gading','apartemen-3br-keluarga-kelapa-gading','Unit keluarga luas dengan tiga kamar tidur, dapur bersih, dan akses langsung ke mal. Aman dan nyaman.','jual','antasari-mulia',2900000000,'Jl. Boulevard Raya Kelapa Gading','Jakarta Utara','DKI Jakarta',-6.1580,106.9080,0,110,3,2,1,'Strata Title',false,182,'Rizky Pratama','081234567802'),
 ('Tanah Komersial Pinggir Jalan Medan','tanah-komersial-pinggir-jalan-medan','Tanah lebar muka 25 meter di jalan protokol. Sangat cocok untuk showroom, gudang, atau gedung usaha.','jual','kedamaian-mulia',5600000000,'Jl. Gatot Subroto No. 150','Medan','Sumatera Utara',3.5900,98.6600,900,0,0,0,0,'SHM',false,112,'Hendra Gunawan','081234567810'),
 ('Rumah Sewa Nyaman di Denpasar','rumah-sewa-nyaman-denpasar','Rumah satu lantai dengan tiga kamar, taman kecil, dan carport. Lingkungan tenang dekat Renon.','sewa','tirtayasa-mulia',85000000,'Jl. Tukad Badung, Renon','Denpasar','Bali',-8.6720,115.2260,180,120,3,2,1,'SHM',false,205,'Made Wirawan','081234567805'),
 ('Vila Pantai Private Pool di Lombok','vila-pantai-private-pool-lombok','Vila tepi pantai dengan kolam renang infinity dan akses privat ke pasir putih. Sudah beroperasi sebagai penginapan.','jual','selamat-mulia',8900000000,'Jl. Raya Kuta Mandalika','Lombok Tengah','Nusa Tenggara Barat',-8.8930,116.2810,800,320,4,4,3,'SHM',true,367,'Lalu Ahmad','081234567811'),
 ('Rumah Subsidi Siap Huni Bekasi','rumah-subsidi-siap-huni-bekasi','Rumah tipe 36 siap huni di perumahan baru dengan akses mudah ke stasiun dan tol. Cocok untuk keluarga muda.','jual','tirtayasa-mulia',420000000,'Perumahan Griya Asri, Tambun','Bekasi','Jawa Barat',-6.2450,107.0500,72,36,2,1,1,'SHM',false,341,'Siti Rahmawati','081234567806'),
 ('Ruko Baru Kawasan Pergudangan Makassar','ruko-baru-kawasan-pergudangan-makassar','Ruko dua lantai baru dibangun di kawasan logistik yang berkembang pesat. Struktur kuat dan jalan lebar.','jual','teluk-mulia',1750000000,'Jl. Perintis Kemerdekaan KM 15','Makassar','Sulawesi Selatan',-5.1050,119.5000,100,160,0,2,1,'SHGB',false,98,'Muh. Ikbal','081234567812'),
 ('Apartemen Mewah Rooftop Pool Jakarta','apartemen-mewah-rooftop-pool-jakarta','Unit premium di lantai tinggi dengan pemandangan skyline, akses rooftop pool dan sky lounge eksklusif.','sewa','antasari-mulia',210000000,'Jl. Casablanca Raya Kav. 88','Jakarta Selatan','DKI Jakarta',-6.2240,106.8400,0,95,2,2,1,'Strata Title',true,254,'Dewi Anggraini','081234567801'),
 ('Tanah Kebun Produktif di Malang','tanah-kebun-produktif-malang','Lahan kebun berkontur landai dengan sumber air melimpah, sudah ditanami pohon buah produktif.','jual','kedamaian-mulia',950000000,'Desa Tumpang, Kec. Tumpang','Malang','Jawa Timur',-8.0000,112.7500,1500,0,0,0,0,'SHM',false,76,'Eko Wahyudi','081234567813'),
 ('Rumah Dua Lantai di Palembang','rumah-dua-lantai-palembang','Rumah kokoh dua lantai dengan empat kamar tidur, ruang keluarga luas, dan carport untuk dua mobil.','jual','tirtayasa-mulia',1650000000,'Jl. Demang Lebar Daun No. 21','Palembang','Sumatera Selatan',-2.9600,104.7300,200,180,4,3,2,'SHM',false,143,'Hendra Gunawan','081234567810'),
 ('Rumah Asri Dekat Kota Baru Jambi','rumah-asri-dekat-kota-baru-jambi','Rumah satu lantai dengan halaman depan luas di kawasan berkembang Kota Baru. Bebas banjir dan akses jalan lebar.','jual','tirtayasa-mulia',780000000,'Jl. Kolonel Pol M Taher, Kota Baru','Jambi','Jambi',-1.6100,103.5800,150,90,3,2,1,'SHM',false,121,'Rina Marlina','081234567814'),
 ('Ruko Strategis Pasar Angso Duo Jambi','ruko-strategis-pasar-angso-duo-jambi','Ruko dua lantai di dekat pusat perdagangan tersibuk di Jambi. Potensi sewa tinggi dan traffic ramai.','sewa','teluk-mulia',95000000,'Jl. Sultan Thaha, Pasar Jambi','Jambi','Jambi',-1.5920,103.6100,80,140,0,2,1,'SHGB',false,88,'Rina Marlina','081234567814'),
 ('Apartemen Kompak Dekat Stasiun Depok','apartemen-kompak-dekat-stasiun-depok','Unit 1 kamar tidur efisien, hanya 3 menit jalan kaki ke stasiun KRL. Cocok untuk komuter Jakarta.','sewa','antasari-mulia',34000000,'Jl. Margonda Raya No. 100','Depok','Jawa Barat',-6.3900,106.8220,0,32,1,1,0,'Strata Title',false,231,'Bayu Nugroho','081234567807'),
 ('Vila Pegunungan Sejuk di Batu','vila-pegunungan-sejuk-batu','Vila kayu dengan pemandangan Gunung Panderman, perapian, dan area barbeque. Populer untuk sewa akhir pekan.','jual','selamat-mulia',2350000000,'Jl. Raya Oro-Oro Ombo, Batu','Malang','Jawa Timur',-7.8800,112.5200,400,180,4,3,2,'SHM',false,199,'Eko Wahyudi','081234567813'),
 ('Rumah Mewah Kolam Renang di Balikpapan','rumah-mewah-kolam-renang-balikpapan','Rumah dua lantai dengan kolam renang pribadi, ruang kerja, dan dapur bersih-kotor terpisah. Kawasan elite.','jual','tirtayasa-mulia',4700000000,'Jl. MT Haryono, Balikpapan Kota','Balikpapan','Kalimantan Timur',-1.2650,116.8300,380,320,5,4,3,'SHM',true,178,'Muh. Ikbal','081234567812')
) AS v(title, slug, description, type, cat_slug, price, address, city, province, lat, lng, land, build, bed, bath, carport, cert, featured, views, agent, phone)
JOIN public.categories c ON c.slug = v.cat_slug;

INSERT INTO public.property_images (property_id, url, is_primary, sort_order)
SELECT p.id,
       '/images/properti-' || (((rn - 1 + g) % 8) + 1) || '.jpg',
       g = 0,
       g
FROM (SELECT id, row_number() OVER (ORDER BY created_at, slug) AS rn FROM public.properties) p
CROSS JOIN generate_series(0, 2) AS g;

INSERT INTO public.property_facilities (property_id, facility_id)
SELECT p.id, f.id
FROM (SELECT id, row_number() OVER (ORDER BY slug) AS rn FROM public.properties) p
JOIN (SELECT id, row_number() OVER (ORDER BY slug) AS fn FROM public.facilities) f
  ON ((p.rn + f.fn) % 3 = 0);

INSERT INTO public.banners (title, subtitle, image_url, link_url, sort_order) VALUES
 ('Promo KPR Bunga 3,25%','Kerja sama dengan bank nasional untuk cicilan lebih ringan','/images/properti-1.jpg','/properti',1),
 ('Properti Unggulan Pilihan Editor','Kurasi hunian terbaik dari seluruh Indonesia','/images/properti-5.jpg','/properti?featured=1',2);

-- ============ SEED: SERVICES (PERTANAHAN) ============
INSERT INTO public.services (pillar, category_id, title, slug, description, price_from, price_unit, duration_estimate, city, contact_name, contact_phone, requirements, legal_basis, assistance_mode, is_active, sort_order)
SELECT 'pertanahan', c.id, v.title, v.slug, v.description, v.price_from, v.price_unit, v.duration_estimate, v.city, 'Anugerah Mulia', '081234567890', v.requirements, v.legal_basis, v.assistance_mode, true, v.sort_order
FROM (VALUES
 ('konsultasi-pertanahan','Konsultasi Legalitas Tanah & Sertifikat','konsultasi-legalitas-tanah-sertifikat','Sesi konsultasi menyeluruh mengenai status kepemilikan tanah, keabsahan sertifikat, peralihan hak, dan risiko hukum sebelum transaksi. Termasuk telaah dokumen awal dan rekomendasi langkah lanjutan tertulis.',500000::bigint,'per sesi','1-3 hari kerja','Jakarta','Fotokopi sertifikat/girik, KTP pemilik, PBB terakhir, denah/peta bidang bila ada','UUPA No. 5 Tahun 1960; PP No. 24 Tahun 1997 tentang Pendaftaran Tanah','Tatap muka di kantor atau daring (Zoom/WhatsApp)',1),
 ('pemeriksaan-penelusuran-dokumen','Pemeriksaan Keaslian & Penelusuran Riwayat Dokumen','pemeriksaan-penelusuran-riwayat-dokumen','Pengecekan keaslian sertifikat di kantor pertanahan (plotting & cek bersih), penelusuran riwayat peralihan hak, status blokir/sita, serta kesesuaian batas bidang tanah. Hasil disampaikan dalam laporan tertulis.',1500000::bigint,'per bidang','3-7 hari kerja','Bekasi','Sertifikat asli/fotokopi legalisir, KTP & KK pemilik, surat kuasa pengecekan, PBB dan bukti bayar','PP No. 24 Tahun 1997; Permen ATR/BPN No. 16 Tahun 2021','Pendampingan langsung ke Kantor Pertanahan setempat',2),
 ('sengketa-tanah-hukum','Penanganan Sengketa Tanah & Tumpang Tindih Sertifikat','penanganan-sengketa-tanah-tumpang-tindih','Penanganan perkara tanah: sertifikat ganda/tumpang tindih, sengketa batas, warisan, jual beli bermasalah, hingga gugatan perdata atau PTUN. Mencakup analisa kasus, penyusunan legal opinion, somasi, dan pendampingan persidangan.',10000000::bigint,'per perkara','3-12 bulan','Jakarta','Sertifikat/alas hak, kronologi sengketa, bukti pembayaran, identitas para pihak, surat kuasa khusus','KUHPerdata; UU No. 5 Tahun 1986 jo. UU No. 51 Tahun 2009 (PTUN); Permen ATR/BPN No. 21 Tahun 2020','Litigasi & non-litigasi dengan tim kuasa hukum',3),
 ('pendampingan-mediasi','Pendampingan & Mediasi Penyelesaian Tanah Keluarga','pendampingan-mediasi-penyelesaian-tanah-keluarga','Fasilitasi musyawarah dan mediasi antar pihak (ahli waris, pembeli-penjual, warga-pengembang) untuk mencapai kesepakatan damai. Termasuk penyusunan akta perdamaian/kesepakatan tertulis dan pendampingan ke desa/kelurahan maupun BPN.',4000000::bigint,'per kasus','2-8 minggu','Depok','Identitas seluruh pihak, silsilah/surat waris, dokumen kepemilikan, kesediaan mediasi tertulis','Permen ATR/BPN No. 21 Tahun 2020 tentang Penanganan dan Penyelesaian Kasus Pertanahan','Mediasi terjadwal, luring maupun daring',4),
 ('kordinasi-proses-eksekusi','Koordinasi Proses Eksekusi Putusan Pengadilan','koordinasi-proses-eksekusi-putusan','Pengurusan dan koordinasi permohonan eksekusi atas putusan berkekuatan hukum tetap: aanmaning, penetapan eksekusi, koordinasi juru sita, aparat keamanan, dan pemerintah setempat hingga penyerahan objek tanah.',15000000::bigint,'per eksekusi','2-6 bulan','Tangerang','Salinan putusan inkracht, akta perdamaian bila ada, surat kuasa khusus, data objek & penghuni','HIR Pasal 195-224; SEMA terkait pelaksanaan eksekusi','Koordinasi langsung dengan Pengadilan Negeri dan instansi terkait',5)
) AS v(cat_slug, title, slug, description, price_from, price_unit, duration_estimate, city, requirements, legal_basis, assistance_mode, sort_order)
JOIN public.categories c ON c.slug = v.cat_slug;
-- ============================================================
-- Catatan: akun admin dibuat lewat perintah
--   npm run admin:create -- email@domain.com "KataSandi" "Nama Admin"
-- ============================================================
