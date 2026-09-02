# Deploy ke Cloudflare Pages (GitHub → Pages)

Aplikasi ini adalah TanStack Start (SSR). Jadi di Cloudflare Pages ia dideploy
sebagai **Pages + Worker (Advanced Mode)**, bukan situs statis biasa.
Semua konfigurasi sudah disiapkan di repository ini.

---

## 1. Yang sudah disiapkan di repo

| Berkas | Fungsi |
| --- | --- |
| `wrangler.toml` | Nama project, `compatibility_date`, flag `nodejs_compat`, dan `pages_build_output_dir = "dist/pages"` |
| `scripts/build-cloudflare-pages.mjs` | Menyusun `dist/client` + `dist/server` menjadi `dist/pages/` dengan `_worker.js/` dan `_routes.json` |
| `package.json` | Skrip `build:pages`, `preview:pages`, `deploy:pages` |
| `.dev.vars.example` | Contoh variabel untuk uji lokal (`wrangler pages dev`) |

Struktur hasil build:

```text
dist/pages/
├── _headers            # cache aset (dibuat otomatis)
├── _routes.json        # aset statis dilayani langsung, tidak lewat worker
├── _worker.js/         # worker SSR (entry: index.js)
├── assets/  images/  favicon.*  robots.txt
```

---

## 2. Pengaturan project di Cloudflare Pages

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** → pilih repository GitHub Anda.

Build settings:

| Kolom | Nilai |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run build:pages` |
| Build output directory | `dist/pages` |
| Root directory | `/` (biarkan kosong) |

Catatan: `wrangler.toml` sudah berisi `pages_build_output_dir`, jadi jika
Cloudflare membaca berkas itu, kolom output directory akan terisi sendiri.

---

## 3. Environment variables (WAJIB)

Settings → **Environment variables** → tambahkan untuk **Production** dan
**Preview** (nilai sama):

| Nama | Isi | Jenis |
| --- | --- | --- |
| `APP_SUPABASE_URL` | `https://xxxx.supabase.co` | Plaintext |
| `APP_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key | Plaintext |
| `APP_SUPABASE_SERVICE_ROLE_KEY` | service role key | **Secret** (encrypt) |
| `AUTH_SECRET` | hasil `openssl rand -hex 32` | **Secret** |
| `VITE_SITE_URL` | `https://domain-anda.com` | Plaintext |
| `NODE_VERSION` | `22` | Plaintext |

Penting:
- URL dan publishable key dibaca **saat build** (ikut ke bundel browser), jadi
  keduanya harus ada sebelum build berjalan — bukan hanya saat runtime.
- Service role key **hanya** dipakai di sisi server (worker), tidak pernah
  ikut ke browser.
- Jangan set `DATABASE_URL` / `PGHOST` di Cloudflare. Driver PostgreSQL
  langsung (`pg`) tidak berjalan di Workers; aplikasi memakai Supabase.

---

## 4. Supabase: izinkan domain baru

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://domain-anda.com`
- **Redirect URLs**: tambahkan
  `https://domain-anda.com/**` dan `https://<project>.pages.dev/**`
  (serta URL preview `https://*.<project>.pages.dev/**` bila dipakai).

Tanpa ini, login/registrasi dan reset password akan gagal redirect.

---

## 5. Uji lokal sebelum push (opsional)

```bash
cp .dev.vars.example .dev.vars      # isi nilainya, berkas ini di-gitignore
npm run build:pages
npm run preview:pages               # wrangler pages dev dist/pages
```

Deploy manual tanpa GitHub:

```bash
npx wrangler login
npm run build:pages
npm run deploy:pages
```

---

## 6. Domain kustom

Pages → project Anda → **Custom domains** → **Set up a domain**. Jika domain
sudah di Cloudflare, DNS dibuat otomatis; jika belum, arahkan CNAME ke
`<project>.pages.dev`. Setelah domain aktif, perbarui `VITE_SITE_URL` lalu
jalankan **Retry deployment** agar nilai baru ikut ter-build.

---

## 7. Batasan runtime yang perlu diingat

- **Unggah berkas**: Workers tidak punya filesystem permanen, jadi
  `UPLOAD_DIR` (mode cPanel) tidak berlaku. Gunakan Supabase Storage atau
  Cloudflare R2 untuk foto/banner/video di produksi.
- **Modul Node** seperti `child_process`, `sharp`, atau `fs.watch` tidak
  tersedia di Workers.
- Deployment Pages tidak menyimpan state di memori antar request — semua
  data permanen ada di Supabase.

---

## 8. Checklist cepat

- [ ] Repo di-push ke GitHub (folder `dist/`, `.env`, `.dev.vars` tidak ikut — sudah di `.gitignore`)
- [ ] Pages project dibuat, build command `npm run build:pages`, output `dist/pages`
- [ ] 6 environment variable di atas terisi untuk Production dan Preview
- [ ] SQL `db/supabase-setup.sql` sudah dijalankan di Supabase
- [ ] Site URL + Redirect URLs di Supabase Auth sudah menunjuk domain Pages/domain kustom
- [ ] Setelah deploy pertama: daftar akun di `/auth`, lalu jadikan admin lewat
      `insert into public.user_roles (user_id, role) values ('<uuid-user>', 'admin') on conflict do nothing;`
