# Informasi Database — Migrasi ke HawkHost (cPanel + PostgreSQL)

Dokumen ini merangkum **semua** objek database yang dibutuhkan aplikasi
Anugerah Mulia, agar impor di cPanel HawkHost berjalan tanpa error.

## 1. Ringkasan koneksi

| Item | Nilai |
| --- | --- |
| Engine | PostgreSQL 13+ (diuji di 17) |
| Nama database | `teknolo8_anugrahmulia` |
| User database | `teknolo8_useranugrahmulia` |
| Password | `Cilla112233!!` |
| Host / Port | `127.0.0.1` / `5432` |
| SSL | `disable` (database satu server dengan aplikasi) |
| Hak akses user | ALL PRIVILEGES pada database (tidak perlu SUPERUSER/CREATEROLE) |

`.env` di server:

```env
DATABASE_PROVIDER="postgres"
DATABASE_URL="postgres://teknolo8_useranugrahmulia:Cilla112233!!@127.0.0.1:5432/teknolo8_anugrahmulia"
PGSSL="disable"
AUTH_SECRET="<openssl rand -hex 32>"
UPLOAD_DIR="./storage/uploads"
VITE_SITE_URL="https://domain-anda.com"
NODE_ENV="production"
```

> **Penting:** `DATABASE_PROVIDER="postgres"` wajib ada. Tanpa baris itu aplikasi
> masih memakai database uji Lovable Cloud, bukan PostgreSQL HawkHost Anda.

## 2. Urutan impor (2 berkas, urut)

```bash
cd ~/anugrahmulia
psql "$DATABASE_URL" -f db/schema.sql      # struktur + data contoh
psql "$DATABASE_URL" -f db/seed-admin.sql  # akun admin@admin.com / admin123
```

Atau: `npm run db:install` lalu `npm run db:seed-admin`.
Tanpa SSH: cPanel → phpPgAdmin → pilih database → tab SQL → tempel isi berkas.

Skema sudah **idempotent-safe** untuk user cPanel: perintah `GRANT`/`POLICY`/
pembuatan peran `anon`/`authenticated`/`service_role` dibungkus helper
`private.opt()`, sehingga bila hak akses kurang muncul `NOTICE: dilewati: ...`
dan impor tetap sukses. Keamanan tidak terganggu karena semua pengecekan hak
akses dilakukan di server function aplikasi.

Hasil impor yang benar (verifikasi):

```sql
select count(*) from properties;  -- 24
select count(*) from categories;  -- 16
select count(*) from facilities;  -- 12
select count(*) from services;    --  5
select count(*) from user_roles;  --  1  (setelah seed-admin)
```

## 3. Skema & objek non-tabel

| Skema | Isi |
| --- | --- |
| `auth` | `auth.users` (akun login: email, `encrypted_password` scrypt, metadata) + fungsi `auth.uid()` |
| `private` | fungsi ber-`SECURITY DEFINER`: `has_role`, `increment_property_views`, `is_public_agent`, `opt` |
| `public` | 14 tabel aplikasi + wrapper fungsi publik |

**Tipe ENUM:**

| Tipe | Nilai |
| --- | --- |
| `app_role` | buyer, agent, admin |
| `listing_type` | jual, sewa |
| `property_status` | draft, aktif, terjual, tersewa, nonaktif |
| `approval_status` | pending, approved, rejected |
| `inquiry_status` | baru, dibalas, ditutup |
| `schedule_status` | menunggu, dikonfirmasi, selesai, dibatalkan |
| `report_status` | terbuka, ditinjau, selesai |

**Fungsi & trigger:** `set_updated_at()` (trigger BEFORE UPDATE pada `profiles`,
`properties`, `inquiries`, `schedules`, `services`, `company_profile_videos`),
`handle_new_user()`, `has_role(uuid, app_role)`, `increment_property_views(text)`,
`is_public_agent(uuid)`.

**Index penting:** `properties(city)`, `properties(price)`,
`properties(approval, status)`, `property_images(property_id)`,
`services(pillar, sort_order)`, `company_profile_videos(status, deleted_at)`,
`auth.users(lower(email))` unik.

**Relasi utama:** `properties.agent_id → profiles.id`,
`properties.category_id → categories.id`, `property_images.property_id`,
`property_facilities(property_id, facility_id)`, `favorites`, `inquiries`,
`schedules`, `reports` → `properties.id`; `user_roles.user_id → auth.users.id`.

## 4. Daftar lengkap tabel & kolom

### `banners`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `title` | text | tidak | — |
| `subtitle` | text | ya | — |
| `image_url` | text | ya | — |
| `link_url` | text | ya | — |
| `is_active` | boolean | tidak | `true` |
| `sort_order` | integer | tidak | `0` |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `categories`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `name` | text | tidak | — |
| `slug` | text | tidak | — |
| `icon` | text | ya | — |
| `pillar` | text | tidak | `'properti'::text` |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `company_profile_videos`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `title` | text | tidak | — |
| `description` | text | ya | — |
| `video_url` | text | tidak | — |
| `storage_path` | text | ya | — |
| `thumbnail_url` | text | ya | — |
| `duration` | integer | ya | — |
| `file_size` | bigint | ya | — |
| `status` | text | tidak | `'inactive'::text` |
| `uploaded_by` | uuid | ya | — |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |
| `deleted_at` | timestamp with time zone | ya | — |

### `facilities`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `name` | text | tidak | — |
| `slug` | text | tidak | — |
| `icon` | text | ya | — |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `favorites`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `user_id` | uuid | tidak | — |
| `property_id` | uuid | tidak | — |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `inquiries`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `user_id` | uuid | ya | — |
| `property_id` | uuid | tidak | — |
| `name` | text | tidak | — |
| `email` | text | ya | — |
| `phone` | text | tidak | — |
| `message` | text | tidak | — |
| `reply` | text | ya | — |
| `status` | USER-DEFINED | tidak | `'baru'::inquiry_status` |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |

### `profiles`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | — |
| `name` | text | tidak | `''::text` |
| `phone` | text | ya | — |
| `avatar_url` | text | ya | — |
| `bio` | text | ya | — |
| `company` | text | ya | — |
| `is_active` | boolean | tidak | `true` |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |

### `properties`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `agent_id` | uuid | ya | — |
| `agent_name` | text | tidak | `''::text` |
| `agent_phone` | text | ya | — |
| `title` | text | tidak | — |
| `slug` | text | tidak | — |
| `description` | text | tidak | `''::text` |
| `type` | USER-DEFINED | tidak | `'jual'::listing_type` |
| `category_id` | uuid | ya | — |
| `price` | bigint | tidak | `0` |
| `address` | text | tidak | `''::text` |
| `city` | text | tidak | `''::text` |
| `province` | text | tidak | `''::text` |
| `latitude` | double precision | ya | — |
| `longitude` | double precision | ya | — |
| `land_area` | integer | tidak | `0` |
| `building_area` | integer | tidak | `0` |
| `bedrooms` | integer | tidak | `0` |
| `bathrooms` | integer | tidak | `0` |
| `carports` | integer | tidak | `0` |
| `certificate` | text | ya | — |
| `status` | USER-DEFINED | tidak | `'draft'::property_status` |
| `approval` | USER-DEFINED | tidak | `'pending'::approval_status` |
| `reject_reason` | text | ya | — |
| `is_featured` | boolean | tidak | `false` |
| `views` | integer | tidak | `0` |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |

### `property_facilities`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `property_id` | uuid | tidak | — |
| `facility_id` | uuid | tidak | — |

### `property_images`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `property_id` | uuid | tidak | — |
| `url` | text | tidak | — |
| `is_primary` | boolean | tidak | `false` |
| `sort_order` | integer | tidak | `0` |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `reports`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `user_id` | uuid | ya | — |
| `property_id` | uuid | tidak | — |
| `reason` | text | tidak | — |
| `detail` | text | ya | — |
| `status` | USER-DEFINED | tidak | `'terbuka'::report_status` |
| `created_at` | timestamp with time zone | tidak | `now()` |

### `schedules`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `user_id` | uuid | tidak | — |
| `property_id` | uuid | tidak | — |
| `name` | text | tidak | — |
| `phone` | text | tidak | — |
| `scheduled_date` | timestamp with time zone | tidak | — |
| `note` | text | ya | — |
| `status` | USER-DEFINED | tidak | `'menunggu'::schedule_status` |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |

### `services`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `pillar` | text | tidak | — |
| `category_id` | uuid | ya | — |
| `title` | text | tidak | — |
| `slug` | text | tidak | — |
| `description` | text | tidak | `''::text` |
| `price_from` | bigint | tidak | `0` |
| `price_unit` | text | tidak | `'per proyek'::text` |
| `duration_estimate` | text | ya | — |
| `city` | text | tidak | `''::text` |
| `image_url` | text | ya | — |
| `contact_name` | text | tidak | `'Anugerah Mulia'::text` |
| `contact_phone` | text | ya | — |
| `work_scope` | text | ya | — |
| `min_area` | integer | tidak | `0` |
| `warranty` | text | ya | — |
| `requirements` | text | ya | — |
| `legal_basis` | text | ya | — |
| `assistance_mode` | text | ya | — |
| `is_active` | boolean | tidak | `true` |
| `sort_order` | integer | tidak | `0` |
| `created_at` | timestamp with time zone | tidak | `now()` |
| `updated_at` | timestamp with time zone | tidak | `now()` |

### `user_roles`

| Kolom | Tipe | Null | Default |
| --- | --- | --- | --- |
| `id` | uuid | tidak | `gen_random_uuid()` |
| `user_id` | uuid | tidak | — |
| `role` | USER-DEFINED | tidak | — |
| `created_at` | timestamp with time zone | tidak | `now()` |
## 5. Berkas unggahan (bukan di database)

Foto/video disimpan di folder server, bukan di PostgreSQL. Di tabel hanya URL
(`/uploads/...`). Siapkan foldernya dan backup terpisah:

```bash
mkdir -p ~/anugrahmulia/storage/uploads && chmod 755 ~/anugrahmulia/storage/uploads
```

## 6. Akun administrator

`db/seed-admin.sql` membuat `admin@admin.com` / `admin123` (hash scrypt),
lengkap dengan baris di `profiles` dan `user_roles` (role `admin`).
Login di `/auth`, panel di `/admin`. **Ganti kata sandi setelah login pertama.**
Akun admin lain: `npm run admin:create -- email "Sandi" "Nama"`.

## 7. Checklist anti-error saat migrasi

1. Extension `pgcrypto` tersedia (dibuat otomatis oleh `db/schema.sql`).
2. User database sudah **Add User To Database** dengan ALL PRIVILEGES.
3. `.env` memuat `DATABASE_PROVIDER="postgres"` dan `DATABASE_URL` yang benar.
4. `AUTH_SECRET` diisi nilai acak 64 karakter dan tidak diubah-ubah lagi.
5. `npm install` → `npm run build:node` → Restart Node.js App di cPanel.
6. Cek `/properti` tampil (database OK) dan `/auth` bisa login (auth OK).

| Pesan error | Penyebab & solusi |
| --- | --- |
| `Konfigurasi database belum ada` | `DATABASE_URL` tidak terbaca atau `DATABASE_PROVIDER` belum `postgres`. |
| `permission denied to create role` | Normal di cPanel — dilewati otomatis, impor tetap berhasil. |
| `relation "properties" does not exist` | `db/schema.sql` belum diimpor. |
| `password authentication failed` | User/password salah atau belum di-Add To Database. |
| `type "app_role" already exists` | Database sudah pernah diimpor — pakai database kosong baru. |
