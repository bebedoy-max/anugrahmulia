// Helper unggah berkas dari browser ke endpoint /api/upload milik aplikasi.
export type UploadResult = { path: string; url: string; size: number };

export async function uploadFile(
  file: File | Blob,
  options: { kind?: "image" | "video"; folder?: string; filename?: string } = {},
): Promise<UploadResult> {
  const form = new FormData();
  const name = options.filename ?? (file instanceof File ? file.name : "berkas");
  form.append("file", file, name);
  form.append("kind", options.kind ?? "image");
  if (options.folder) form.append("folder", options.folder);

  const response = await fetch("/api/upload", { method: "POST", body: form, credentials: "same-origin" });
  if (!response.ok) {
    let message = "Gagal mengunggah berkas";
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* abaikan */
    }
    throw new Error(message);
  }
  return (await response.json()) as UploadResult;
}
