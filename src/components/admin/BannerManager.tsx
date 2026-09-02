import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDeleteBanner, adminListBanners, adminSaveBanner } from "@/lib/admin.functions";


export const BANNER_SPEC = {
  width: 1920,
  height: 1080,
  minWidth: 1600,
  maxSizeMb: 5,
};

type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
};

type Draft = {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
  sort_order: number;
};

const emptyDraft: Draft = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  is_active: true,
  sort_order: 0,
};

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

export function BannerManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListBanners);
  const saveFn = useServerFn(adminSaveBanner);
  const deleteFn = useServerFn(adminDeleteBanner);

  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [uploading, setUploading] = useState(false);
  const [dimension, setDimension] = useState<string | null>(null);

  const { data: banners = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => listFn() as Promise<BannerRow[]>,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    void queryClient.invalidateQueries({ queryKey: ["home"] });
  };

  const save = useMutation({
    mutationFn: (value: Draft) =>
      saveFn({
        data: {
          ...(value.id ? { id: value.id } : {}),
          title: value.title,
          subtitle: value.subtitle,
          image_url: value.image_url,
          link_url: value.link_url,
          is_active: value.is_active,
          sort_order: value.sort_order,
        },
      }),
    onSuccess: () => {
      toast.success("Banner tersimpan.");
      setDraft(emptyDraft);
      setDimension(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Format harus JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > BANNER_SPEC.maxSizeMb * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${BANNER_SPEC.maxSizeMb}MB.`);
      return;
    }
    setUploading(true);
    try {
      const size = await readImageSize(file);
      setDimension(`${size.width} × ${size.height} px`);
      if (size.width < BANNER_SPEC.minWidth) {
        toast.warning(
          `Lebar gambar hanya ${size.width}px. Disarankan minimal ${BANNER_SPEC.minWidth}px agar tidak pecah di layar besar.`,
        );
      }
      const ratio = size.width / size.height;
      if (ratio < 1.5 || ratio > 2.1) {
        toast.warning("Rasio gambar sebaiknya 16:9 agar tampilan banner tidak terpotong.");
      }
      const saved = await uploadFile(file, { kind: "image", folder: "banner" });
      setDraft((prev) => ({ ...prev, image_url: saved.url }));
      toast.success("Gambar banner diunggah.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-5 shadow-soft">
        <h3 className="font-display text-lg">{draft.id ? "Edit banner" : "Tambah banner"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Banner aktif dengan urutan terkecil akan tampil sebagai banner utama di beranda.
        </p>

        <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
          <p className="font-medium">Panduan ukuran gambar banner</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• Resolusi ideal: <strong>1920 × 1080 px</strong> (rasio 16:9), minimal 1600 × 900 px.</li>
            <li>• Format: JPG / PNG / WEBP — maksimal {BANNER_SPEC.maxSizeMb}MB (WEBP paling ringan).</li>
            <li>• Resolusi layar: 72–150 dpi sudah cukup; gambar otomatis responsif (object-cover).</li>
            <li>• Area aman teks berada di sisi kiri; hindari objek penting di tepi kanan/bawah karena bisa terpotong di HP.</li>
          </ul>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="banner-title">Judul</Label>
            <Input
              id="banner-title"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Temukan rumah impian di seluruh Indonesia"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-link">Tautan tombol (opsional)</Label>
            <Input
              id="banner-link"
              value={draft.link_url}
              onChange={(event) => setDraft({ ...draft, link_url: event.target.value })}
              placeholder="/properti"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="banner-subtitle">Subjudul</Label>
            <Textarea
              id="banner-subtitle"
              value={draft.subtitle}
              rows={2}
              onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
              placeholder="Rumah, apartemen, tanah, dan ruko dijual maupun disewakan."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banner-order">Urutan</Label>
            <Input
              id="banner-order"
              type="number"
              value={draft.sort_order}
              onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) || 0 })}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="banner-active"
              type="checkbox"
              className="size-4"
              checked={draft.is_active}
              onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
            />
            <Label htmlFor="banner-active">Aktif (tampil di beranda)</Label>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Mengunggah…" : "Unggah gambar banner"}
            </Button>
            {dimension ? <span className="text-sm text-muted-foreground">Ukuran gambar: {dimension}</span> : null}
          </div>
          {draft.image_url ? (
            <img
              src={draft.image_url}
              alt="Pratinjau banner"
              className="aspect-video w-full max-w-xl rounded-lg border object-cover"
            />
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            disabled={save.isPending || !draft.title.trim()}
            onClick={() => save.mutate(draft)}
          >
            {save.isPending ? "Menyimpan…" : "Simpan banner"}
          </Button>
          {draft.id ? (
            <Button type="button" variant="ghost" onClick={() => { setDraft(emptyDraft); setDimension(null); }}>
              Batal
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Daftar banner</h3>
        {banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada banner.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {banners.map((banner) => (
              <article key={banner.id} className="overflow-hidden rounded-xl border bg-card shadow-soft">
                {banner.image_url ? (
                  <img src={banner.image_url} alt={banner.title} className="aspect-video w-full object-cover" />
                ) : null}
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{banner.title}</p>
                    <span className="text-xs text-muted-foreground">
                      #{banner.sort_order} · {banner.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  {banner.subtitle ? (
                    <p className="text-sm text-muted-foreground">{banner.subtitle}</p>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraft({
                          id: banner.id,
                          title: banner.title,
                          subtitle: banner.subtitle ?? "",
                          image_url: banner.image_url ?? "",
                          link_url: banner.link_url ?? "",
                          is_active: banner.is_active,
                          sort_order: banner.sort_order ?? 0,
                        });
                        setDimension(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await saveFn({
                          data: {
                            id: banner.id,
                            title: banner.title,
                            subtitle: banner.subtitle ?? "",
                            image_url: banner.image_url ?? "",
                            link_url: banner.link_url ?? "",
                            is_active: !banner.is_active,
                            sort_order: banner.sort_order ?? 0,
                          },
                        });
                        invalidate();
                      }}
                    >
                      {banner.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        await deleteFn({ data: { id: banner.id } });
                        toast.success("Banner dihapus.");
                        invalidate();
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
