-- ============================================================
-- Akun administrator bawaan.
-- Email    : admin@admin.com
-- Password : admin123
--
-- Jalankan SETELAH db/schema.sql:
--   psql "$DATABASE_URL" -f db/seed-admin.sql
--
-- PENTING: segera ganti kata sandi ini setelah login pertama, atau
-- buat akun baru dengan:  npm run admin:create -- email "Sandi" "Nama"
-- ============================================================

WITH upsert_user AS (
  INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
  VALUES (
    'admin@admin.com',
    'scrypt$eb33e48b889b7c6f1ccd6edfd083b727$7806e830d6058c3c1f563a9e163b3190ff5c2d4bd2b1582e3a19f00c10f143f209e105bc559dcc0049d1dbcbd03fbfde36d089e74563df30964f8a33164ff912',
    '{"name":"Administrator","role":"admin"}'::jsonb
  )
  ON CONFLICT (email) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now()
  RETURNING id
), upsert_profile AS (
  INSERT INTO public.profiles (id, name)
  SELECT id, 'Administrator' FROM upsert_user
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, is_active = true
  RETURNING id
)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM upsert_profile
ON CONFLICT (user_id, role) DO NOTHING;
