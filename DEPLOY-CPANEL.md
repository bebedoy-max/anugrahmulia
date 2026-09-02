# Panduan Deploy ke cPanel (HawkHost) + PostgreSQL

Aplikasi ini adalah **React (TanStack Start) dengan SSR** — jadi ia butuh
**Node.js App** di cPanel, bukan hanya folder statis. Semua ketergantungan pada
Lovable/Supabase sudah dihapus. Yang dipakai sekarang:

| Kebutuhan | Sebelumnya | Sekarang |
| --- | --- | --- |
| Database | Supabase | PostgreSQL di server Anda |
| Login/akun | Supabase Auth | tabel `auth.users` + cookie sesi (scrypt, HttpOnly) |
| Foto/video | Supabase Storage | folder `storage/uploads` di server, disajikan via `/uploads/...` |
| Server | Lovable | Node.js App (Passenger/lsnode) via `app.cjs` |

**Akun admin bawaan:** `admin@admin.com` / `admin123` (dibuat pada langkah 2b —
segera ganti kata sandinya setelah login pertama).

---

## 1. Siapkan database PostgreSQL di cPanel

cPanel → **PostgreSQL Databases**:

1. Create Database: `teknolo8_anugrahmulia`
2. Create User: `teknolo8_useranugrahmulia`, password `Cilla112233!!`
3. Add User To Database → beri **ALL PRIVILEGES**

> Skema sudah diuji dengan user database ber-hak terbatas ala cPanel (tanpa
> `CREATEROLE`). Bila peran `anon/authenticated/service_role` tidak bisa dibuat,
> impor tetap berhasil — perintah GRANT/POLICY terkait otomatis dilewati
> (muncul `NOTICE: dilewati: ...`, itu normal). Keamanan tetap terjaga karena
> seluruh pengecekan hak akses dilakukan di server function, bukan di RLS.

Jika cPanel Anda tidak punya menu PostgreSQL, minta HawkHost mengaktifkannya
(atau gunakan PostgreSQL di VPS/host lain dan isi `PGHOST` sesuai host itu).

## 2. Impor skema

Semua tabel, index, trigger, fungsi, dan data contoh ada di **`db/schema.sql`**.

Lewat terminal SSH:

```bash
cd ~/anugrahmulia
psql "postgres://teknolo8_useranugrahmulia:Cilla112233!!@127.0.0.1:5432/teknolo8_anugrahmulia" -f db/schema.sql
```

Tanpa SSH: cPanel → **phpPgAdmin** → pilih database → tab SQL → tempel isi
`db/schema.sql` → Execute.

### 2b. Buat akun administrator

```bash
psql "postgres://teknolo8_useranugrahmulia:Cilla112233!!@127.0.0.1:5432/teknolo8_anugrahmulia" -f db/seed-admin.sql
```

Membuat akun **`admin@admin.com`** dengan kata sandi **`admin123`**, lengkap
dengan profil dan peran `admin`. Login di `/auth`, panel admin di `/admin`.
Ganti kata sandinya lewat menu **Profil** setelah login pertama.

## 3. Upload kode

Letakkan **di luar** `public_html`, misalnya `/home/teknolo8/anugrahmulia`
(cPanel akan membuat symlink sendiri). Upload sebagai ZIP lalu Extract, atau:

```bash
cd ~ && git clone <repo-anda> anugrahmulia
```

Jangan ikut mengunggah `node_modules`, `dist`, `.output`.

## 4. Isi `.env`

Salin `.env.example` menjadi `.env` (sudah terisi kredensial database Anda).
Yang wajib diperiksa:

- `DATABASE_PROVIDER="postgres"` → **wajib**. Tanpa baris ini aplikasi masih
  memakai database uji Lovable Cloud, bukan PostgreSQL HawkHost Anda.
- `DATABASE_URL` → `postgres://teknolo8_useranugrahmulia:Cilla112233!!@127.0.0.1:5432/teknolo8_anugrahmulia`
- `VITE_SITE_URL` → domain final, tanpa garis miring di akhir. Variabel `VITE_*`
  dibaca **saat build**, jadi setelah diubah harus build ulang.
- `AUTH_SECRET` → isi dengan `openssl rand -hex 32`. Nilai ini menandatangani
  cookie login; kalau diganti, semua pengguna ter-logout.

Rincian lengkap struktur database, daftar tabel/kolom, dan checklist anti-error
ada di **`db/README-DATABASE.md`**.

Alternatif: isi variabel yang sama di cPanel → Setup Node.js App →
**Environment variables**. Nilai dari panel selalu menang atas `.env`.

## 5. Buat Node.js App di cPanel

cPanel → **Setup Node.js App** → Create Application:

| Field | Nilai |
| --- | --- |
| Node.js version | 20 atau 22 |
| Application mode | Production |
| Application root | `anugrahmulia` |
| Application URL | domain/subdomain Anda |
| Application startup file | `app.cjs` |

Klik **Create**, lalu **Run NPM Install**.

## 6. Build

Di halaman aplikasi, salin baris "Enter to the virtual environment" lalu di SSH:

```bash
source /home/teknolo8/nodevenv/anugrahmulia/20/bin/activate && cd ~/anugrahmulia
npm install
npm run build:node          # menghasilkan .output/server/index.mjs + .output/public
```

Tidak punya SSH? Gunakan tombol **Run JS script** di panel dan jalankan
`build:node`.

## 7. Folder unggahan

```bash
mkdir -p ~/anugrahmulia/storage/uploads && chmod 755 ~/anugrahmulia/storage/uploads
```

Isi folder ini adalah data pengguna — **backup terpisah** dan jangan ikut
terhapus saat deploy ulang.

## 8. `.htaccess`

Salin `deploy/.htaccess` ke `public_html/.htaccess`. Bila cPanel sudah
menuliskan blok `PassengerAppRoot ... # DO NOT REMOVE` di sana, **biarkan blok
itu di paling atas** dan tempel aturan kami di bawahnya.

## 9. Restart & uji

Tekan **Restart** di Setup Node.js App, lalu periksa:

- `/` beranda tampil
- `/properti` daftar properti (bukti database terhubung)
- `/auth` login `admin@admin.com` / `admin123`
- `/admin` dashboard admin & upload foto tersimpan dan tampil kembali
- `/sitemap.xml` dan `/robots.txt` terbaca

---

## Deploy ulang setelah ada perubahan kode

```bash
source /home/teknolo8/nodevenv/anugrahmulia/20/bin/activate && cd ~/anugrahmulia
git pull            # atau upload berkas baru
npm install
npm run build:node
```

lalu **Restart** aplikasi di cPanel.

## Perintah yang tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm run build:node` | Build produksi untuk server Node |
| `npm start` | Menjalankan server (`node app.cjs`) di luar Passenger |
| `npm run db:install` | Impor `db/schema.sql` memakai `$DATABASE_URL` |
| `npm run db:seed-admin` | Impor akun admin bawaan (`db/seed-admin.sql`) |
| `npm run admin:create` | Membuat/mereset akun admin lain |

## Mengatasi masalah

| Gejala | Penyebab & solusi |
| --- | --- |
| `.output/server/index.mjs tidak ditemukan` | `npm run build:node` belum dijalankan di server. |
| `permission denied to create role` | Sudah ditangani: impor `db/schema.sql` versi terbaru, peran opsional dilewati otomatis. |
| `password authentication failed` | `PGUSER`/`PGPASSWORD` salah, atau user belum di-Add To Database. |
| `relation "properties" does not exist` | `db/schema.sql` belum diimpor (langkah 2). |
| `503` / halaman putih | Lihat `stderr.log` di Application root, lalu Restart. |
| Login berhasil tapi langsung ter-logout | `AUTH_SECRET` kosong/berubah. Cookie kini otomatis `Secure` hanya saat akses HTTPS, jadi uji via http pun tetap bisa login. |
| Foto ter-upload tapi tidak tampil | Folder `storage/uploads` belum ada atau tidak writable (langkah 7). |
| Node lama (`Node 18 terlalu lama`) | Pilih Node.js 20/22 di Setup Node.js App. |

## Catatan teknis singkat

- `app.cjs` adalah startup file CommonJS untuk Passenger; ia memuat `.env`,
  memeriksa versi Node, lalu `import()` server hasil build.
- `vite.config.node.ts` memakai preset `node-server` sehingga hasil build
  adalah server Node biasa (`.output/`), bukan bundel serverless.
- Koneksi database memakai connection pool `pg` (`PGPOOL_MAX`, default 8) —
  aman untuk batas proses shared hosting.
- Cookie sesi HttpOnly + SameSite=Lax, ditandatangani HMAC `AUTH_SECRET`;
  atribut `Secure` menyesuaikan `X-Forwarded-Proto` dari Apache/LiteSpeed.
- Akses data dibatasi di server function (peran admin diverifikasi lewat
  fungsi `has_role`), bukan mengandalkan RLS dari sisi browser.
