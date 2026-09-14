// Penyimpanan berkas di Supabase Storage (bucket publik "media").
// Dipakai karena disk server bersifat sementara di lingkungan serverless.
import "./env.server";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const BUCKET = "media";

function extFor(name: string, mime: string) {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(name || "")?.[1];
  if (fromName) return `.${fromName.toLowerCase()}`;
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

export async function saveRemoteUpload(
  file: File,
  options: { folder?: string; allowed: string[]; maxBytes: number },
): Promise<{ path: string; url: string; size: number }> {
  if (!options.allowed.includes(file.type)) {
    throw new Error(`Tipe berkas ${file.type || "tidak dikenal"} tidak diizinkan.`);
  }
  if (file.size > options.maxBytes) {
    throw new Error(`Ukuran berkas melebihi ${Math.round(options.maxBytes / (1024 * 1024))}MB.`);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const folder = (options.folder ?? "").replace(/[^a-z0-9\-/]/gi, "");
  const id = crypto.randomUUID();
  const rel = `${folder ? `${folder}/` : ""}${id}${extFor(file.name, file.type)}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(rel, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

  // Dilayani lewat domain aplikasi agar tetap aman di HTTPS.
  return { path: rel, url: `/media/${rel}`, size: file.size };
}
