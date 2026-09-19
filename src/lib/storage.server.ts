// Penyimpanan berkas di disk server sendiri (pengganti object storage eksternal).
// Lokasi default: <root aplikasi>/storage/uploads  (atur lewat UPLOAD_DIR).
import "./env.server";
import { mkdir, writeFile, unlink, stat, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve, extname, basename } from "node:path";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// --- Supabase Storage (penyimpanan utama berkas media) -------------------
// Berkas media disimpan di bucket Supabase agar tetap ada walau server
// di-deploy ulang (disk server bersifat sementara). Disk lokal dipakai
// sebagai cadangan bila Supabase belum dikonfigurasi.
const MEDIA_BUCKET = process.env["MEDIA_BUCKET"] || "media";

function storageConfig(): { url: string; key: string } | null {
  const url = (process.env["APP_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "").replace(/\/+$/, "");
  const key =
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["APP_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

function storageHeaders(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}`, apikey: key };
}

export function uploadRoot(): string {
  return resolve(process.env["UPLOAD_DIR"] || join(process.cwd(), "storage", "uploads"));
}

/** Cegah path traversal: hanya izinkan folder & nama berkas sederhana. */
export function safeRelativePath(input: string): string | null {
  const clean = input.replace(/^\/+/, "");
  if (!/^[A-Za-z0-9._\-/]+$/.test(clean)) return null;
  if (clean.includes("..")) return null;
  const full = resolve(uploadRoot(), clean);
  if (full !== uploadRoot() && !full.startsWith(uploadRoot() + "/")) return null;
  return clean;
}

export async function saveUpload(
  file: File,
  options: { folder?: string; allowed: string[]; maxBytes: number },
): Promise<{ path: string; url: string; size: number }> {
  if (!options.allowed.includes(file.type)) {
    throw new Error(`Tipe berkas ${file.type || "tidak dikenal"} tidak diizinkan.`);
  }
  if (file.size > options.maxBytes) {
    throw new Error(`Ukuran berkas melebihi ${Math.round(options.maxBytes / (1024 * 1024))}MB.`);
  }

  const folder = (options.folder ?? "").replace(/[^a-z0-9\-/]/gi, "");
  const ext = (extname(basename(file.name || "")) || guessExt(file.type)).toLowerCase().slice(0, 10);
  const rel = `${folder ? `${folder}/` : ""}${randomUUID()}${ext}`;

  const config = storageConfig();
  if (config) {
    const response = await fetch(
      `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${rel}`,
      {
        method: "POST",
        headers: {
          ...storageHeaders(config.key),
          "content-type": file.type || contentType(rel),
          "cache-control": "max-age=31536000",
          "x-upsert": "true",
        },
        body: new Uint8Array(await file.arrayBuffer()),
      },
    );
    if (!response.ok) {
      throw new Error(`Gagal menyimpan berkas ke penyimpanan (${response.status}).`);
    }
    return { path: rel, url: `/media/${rel}`, size: file.size };
  }

  const dest = join(uploadRoot(), rel);
  await mkdir(join(dest, ".."), { recursive: true });
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));

  return { path: rel, url: `/uploads/${rel}`, size: file.size };
}

function guessExt(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
  };
  return map[mime] ?? ".bin";
}

export async function removeUpload(pathOrUrl: string): Promise<void> {
  const rel = safeRelativePath(pathOrUrl.replace(/^\/(uploads|media)\//, ""));
  if (!rel) return;

  const config = storageConfig();
  if (config) {
    try {
      await fetch(`${config.url}/storage/v1/object/${MEDIA_BUCKET}/${rel}`, {
        method: "DELETE",
        headers: storageHeaders(config.key),
      });
    } catch {
      /* abaikan kegagalan hapus di penyimpanan */
    }
  }

  try {
    await unlink(join(uploadRoot(), rel));
  } catch {
    /* berkas sudah tidak ada */
  }
}

export async function readUpload(rel: string): Promise<{ body: Buffer; size: number; type: string } | null> {
  const safe = safeRelativePath(rel);
  if (!safe) return null;

  // 1) Disk lokal (hosting mandiri / berkas warisan).
  const full = join(uploadRoot(), safe);
  try {
    const info = await stat(full);
    if (info.isFile()) {
      return { body: await readFile(full), size: info.size, type: contentType(safe) };
    }
  } catch {
    /* lanjut ke penyimpanan Supabase */
  }

  // 2) Penyimpanan Supabase (bucket media).
  const config = storageConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/storage/v1/object/${MEDIA_BUCKET}/${safe}`, {
      headers: storageHeaders(config.key),
    });
    if (!response.ok) return null;
    const body = Buffer.from(await response.arrayBuffer());
    return {
      body,
      size: body.byteLength,
      type: response.headers.get("content-type") || contentType(safe),
    };
  } catch {
    return null;
  }
}

export function contentType(path: string): string {
  const ext = extname(path).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return map[ext] ?? "application/octet-stream";
}
