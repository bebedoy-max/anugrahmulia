import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  adminDeleteCompanyVideo,
  adminListCompanyVideos,
  adminSaveCompanyVideo,
  adminSetCompanyVideoStatus,
  type CompanyVideo,
} from "@/lib/company-video.functions";

const MAX_BYTES = 200 * 1024 * 1024;
const MAX_DURATION = 300;
const ALLOWED = ["video/mp4", "video/quicktime", "video/webm"];

type Upload = { url: string; path: string; size: number; duration: number; thumbnail: string | null };

function readVideoMeta(file: File) {
  return new Promise<{ duration: number; thumbnail: Blob | null }>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onerror = () => reject(new Error("File video tidak dapat dibaca."));
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration || 0);
      video.currentTime = Math.min(1, Math.max(0, duration - 0.1));
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(video.src);
            resolve({ duration, thumbnail: blob });
          }, "image/jpeg", 0.8);
        } catch {
          resolve({ duration, thumbnail: null });
        }
      };
    };
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CompanyVideoManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListCompanyVideos);
  const saveFn = useServerFn(adminSaveCompanyVideo);
  const statusFn = useServerFn(adminSetCompanyVideoStatus);
  const deleteFn = useServerFn(adminDeleteCompanyVideo);

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CompanyVideo | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [upload, setUpload] = useState<Upload | null>(null);

  const { data: videos = [] } = useQuery({
    queryKey: ["admin-company-videos"],
    queryFn: () => listFn({ data: {} }),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-company-videos"] });
    void queryClient.invalidateQueries({ queryKey: ["company-video"] });
  }

  function reset() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setUpload(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Format harus MP4, MOV, atau WEBM.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Ukuran video melebihi 200MB.");
      return;
    }
    setUploading(true);
    setProgress(5);
    try {
      const meta = await readVideoMeta(file);
      if (meta.duration > MAX_DURATION) throw new Error("Durasi video maksimal 5 menit.");
      setProgress(20);

      const saved = await uploadFile(file, { kind: "video", folder: "video-profil" });
      setProgress(75);

      let thumbnail: string | null = null;
      if (meta.thumbnail) {
        try {
          const thumb = await uploadFile(meta.thumbnail, {
            kind: "image",
            folder: "video-profil/thumbnail",
            filename: "thumbnail.jpg",
          });
          thumbnail = thumb.url;
        } catch {
          thumbnail = null;
        }
      }
      setProgress(100);
      setUpload({ url: saved.url, path: saved.path, size: file.size, duration: meta.duration, thumbnail });
      
      toast.success("Video terunggah. Lengkapi judul lalu simpan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah video");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  async function save(status: "active" | "inactive") {
    if (!title.trim()) {
      toast.error("Judul wajib diisi.");
      return;
    }
    if (!editing && !upload) {
      toast.error("Unggah video terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          title: title.trim(),
          description: description.trim(),
          ...(upload
            ? {
                videoUrl: upload.url,
                storagePath: upload.path,
                fileSize: upload.size,
                duration: upload.duration,
                ...(upload.thumbnail ? { thumbnailUrl: upload.thumbnail } : {}),
              }
            : {}),
          status,
        },
      });
      toast.success(status === "active" ? "Video disimpan & diaktifkan." : "Video disimpan.");
      reset();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan video");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h3 className="font-display text-lg">{editing ? "Edit video company profile" : "Unggah video company profile"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          MP4/MOV/WEBM, maksimal 200MB dan 5 menit. Thumbnail dibuat otomatis dari frame video.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="video-title">Judul</Label>
            <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Profil Perusahaan 2026" />
          </div>
          <div className="space-y-2">
            <Label>Berkas video</Label>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? "Mengunggah…" : upload ? "Ganti video" : "Pilih video"}
              </Button>
              {progress > 0 ? (
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="video-desc">Deskripsi singkat</Label>
            <Textarea id="video-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {upload ? (
          <video
            src={upload.url}
            poster={upload.thumbnail ?? undefined}
            controls
            playsInline
            className="mt-4 aspect-video w-full max-w-xl rounded-lg border bg-black"
          />
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={saving || uploading} onClick={() => void save("active")}>
            Simpan & aktifkan
          </Button>
          <Button variant="outline" disabled={saving || uploading} onClick={() => void save("inactive")}>
            Simpan sebagai nonaktif
          </Button>
          {editing || upload ? (
            <Button variant="ghost" onClick={reset}>
              Batal
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Daftar video ({videos.length})</h3>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada video company profile.</p>
        ) : null}
        {videos.map((video) => (
          <div key={video.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-soft">
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt={video.title} className="h-16 w-28 rounded object-cover" loading="lazy" />
            ) : (
              <div className="h-16 w-28 rounded bg-muted" />
            )}
            <div className="min-w-48 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{video.title}</p>
                <Badge variant={video.status === "active" ? "default" : "secondary"}>
                  {video.status === "active" ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDuration(video.duration)} · {((video.file_size ?? 0) / (1024 * 1024)).toFixed(1)} MB ·{" "}
                {new Date(video.created_at).toLocaleDateString("id-ID")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await statusFn({ data: { id: video.id, status: video.status === "active" ? "inactive" : "active" } });
                  toast.success("Status diperbarui.");
                  refresh();
                }}
              >
                {video.status === "active" ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(video);
                  setTitle(video.title);
                  setDescription(video.description ?? "");
                  setUpload(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  await deleteFn({ data: { id: video.id } });
                  toast.success("Video dipindahkan ke arsip.");
                  refresh();
                }}
              >
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
