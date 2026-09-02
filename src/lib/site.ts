// URL publik situs (tanpa trailing slash). Diisi lewat VITE_SITE_URL saat build,
// mis. VITE_SITE_URL="https://anugerahmulia.co.id". Bila kosong, tag absolut
// (og:image, canonical) tidak dirender agar tidak menunjuk domain yang salah.
const raw = (import.meta.env['VITE_SITE_URL'] as string | undefined) ?? "";

export const SITE_URL = raw.replace(/\/+$/, "");

export const absoluteUrl = (path: string) =>
  SITE_URL ? `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}` : "";
