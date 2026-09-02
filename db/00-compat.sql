-- ============================================================
-- Prasyarat skema untuk PostgreSQL mandiri (HawkHost / cPanel).
-- Menyediakan objek yang dulu disediakan platform:
--   * peran anon / authenticated / service_role (agar GRANT di skema jalan)
--   * skema auth + tabel auth.users (akun & kata sandi aplikasi)
--   * fungsi auth.uid() (dipakai oleh policy RLS)
-- Aplikasi terhubung sebagai pemilik database, jadi RLS tidak menghalangi;
-- semua pembatasan akses dilakukan di server function.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
END $$;

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
