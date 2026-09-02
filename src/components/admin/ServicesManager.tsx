import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { adminDeleteService, adminListServices, adminSaveService } from "@/lib/services.functions";
import type { Category } from "@/lib/types";

type Pillar = "konstruksi" | "pertanahan";

type Draft = {
  id?: string;
  categoryId: string;
  title: string;
  description: string;
  priceFrom: number;
  priceUnit: string;
  durationEstimate: string;
  city: string;
  imageUrl: string;
  contactName: string;
  contactPhone: string;
  workScope: string;
  minArea: number;
  warranty: string;
  requirements: string;
  legalBasis: string;
  assistanceMode: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyDraft: Draft = {
  categoryId: "",
  title: "",
  description: "",
  priceFrom: 0,
  priceUnit: "per proyek",
  durationEstimate: "",
  city: "",
  imageUrl: "",
  contactName: "Anugerah Mulia",
  contactPhone: "",
  workScope: "",
  minArea: 0,
  warranty: "",
  requirements: "",
  legalBasis: "",
  assistanceMode: "",
  isActive: true,
  sortOrder: 0,
};

export function ServicesManager({
  pillar,
  label,
  categories,
}: {
  pillar: Pillar;
  label: string;
  categories: Category[];
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListServices);
  const saveFn = useServerFn(adminSaveService);
  const deleteFn = useServerFn(adminDeleteService);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-services", pillar],
    queryFn: () => listFn({ data: { pillar } }) as Promise<any[]>,
  });

  const pillarCategories = useMemo(
    () => categories.filter((c) => (c.pillar ?? "properti") === pillar),
    [categories, pillar],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function edit(row: any) {
    setDraft({
      id: row.id,
      categoryId: row.category_id ?? "",
      title: row.title ?? "",
      description: row.description ?? "",
      priceFrom: row.price_from ?? 0,
      priceUnit: row.price_unit ?? "per proyek",
      durationEstimate: row.duration_estimate ?? "",
      city: row.city ?? "",
      imageUrl: row.image_url ?? "",
      contactName: row.contact_name ?? "Anugerah Mulia",
      contactPhone: row.contact_phone ?? "",
      workScope: row.work_scope ?? "",
      minArea: row.min_area ?? 0,
      warranty: row.warranty ?? "",
      requirements: row.requirements ?? "",
      legalBasis: row.legal_basis ?? "",
      assistanceMode: row.assistance_mode ?? "",
      isActive: Boolean(row.is_active),
      sortOrder: row.sort_order ?? 0,
    });
    setShowForm(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: draft.id,
          pillar,
          categoryId: draft.categoryId || null,
          title: draft.title,
          description: draft.description,
          priceFrom: Number(draft.priceFrom) || 0,
          priceUnit: draft.priceUnit,
          durationEstimate: draft.durationEstimate || null,
          city: draft.city,
          imageUrl: draft.imageUrl || null,
          contactName: draft.contactName,
          contactPhone: draft.contactPhone || null,
          workScope: draft.workScope || null,
          minArea: Number(draft.minArea) || 0,
          warranty: draft.warranty || null,
          requirements: draft.requirements || null,
          legalBasis: draft.legalBasis || null,
          assistanceMode: draft.assistanceMode || null,
          isActive: draft.isActive,
          sortOrder: Number(draft.sortOrder) || 0,
        },
      });
      toast.success(draft.id ? "Layanan diperbarui." : "Layanan ditambahkan.");
      setDraft(emptyDraft);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-services", pillar] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan layanan");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus layanan ini?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Layanan dihapus.");
      void queryClient.invalidateQueries({ queryKey: ["admin-services", pillar] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus layanan");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Kelola layanan {label} — terpisah dari listing properti.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setDraft(emptyDraft);
            setShowForm((v) => !v || Boolean(draft.id));
          }}
        >
          {showForm && !draft.id ? "Tutup form" : "Tambah layanan"}
        </Button>
      </div>

      {showForm ? (
        <form className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${pillar}-title`}>Judul layanan</Label>
            <Input
              id={`${pillar}-title`}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              required
              maxLength={160}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-category`}>Kategori</Label>
            <select
              id={`${pillar}-category`}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {pillarCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-city`}>Kota / wilayah layanan</Label>
            <Input id={`${pillar}-city`} value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-price`}>
              {pillar === "konstruksi" ? "Mulai harga (Rp)" : "Mulai biaya jasa (Rp)"}
            </Label>
            <Input
              id={`${pillar}-price`}
              type="number"
              min={0}
              value={draft.priceFrom}
              onChange={(e) => set("priceFrom", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-unit`}>Satuan harga</Label>
            <select
              id={`${pillar}-unit`}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={draft.priceUnit}
              onChange={(e) => set("priceUnit", e.target.value)}
            >
              {(pillar === "konstruksi"
                ? ["per m²", "per unit", "per proyek"]
                : ["per perkara", "per dokumen", "per sesi", "per proyek"]
              ).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-duration`}>Estimasi durasi</Label>
            <Input
              id={`${pillar}-duration`}
              value={draft.durationEstimate}
              onChange={(e) => set("durationEstimate", e.target.value)}
              placeholder={pillar === "konstruksi" ? "3–6 bulan" : "2–4 minggu"}
              maxLength={120}
            />
          </div>

          {pillar === "konstruksi" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="minArea">Luas minimal proyek (m²)</Label>
                <Input
                  id="minArea"
                  type="number"
                  min={0}
                  value={draft.minArea}
                  onChange={(e) => set("minArea", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warranty">Masa garansi</Label>
                <Input
                  id="warranty"
                  value={draft.warranty}
                  onChange={(e) => set("warranty", e.target.value)}
                  placeholder="12 bulan struktur"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="workScope">Lingkup pekerjaan</Label>
                <Textarea
                  id="workScope"
                  rows={4}
                  value={draft.workScope}
                  onChange={(e) => set("workScope", e.target.value)}
                  placeholder="Desain, struktur, arsitektur, MEP, finishing…"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="assistanceMode">Metode pendampingan</Label>
                <select
                  id="assistanceMode"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.assistanceMode}
                  onChange={(e) => set("assistanceMode", e.target.value)}
                >
                  <option value="">Pilih metode</option>
                  {["Konsultasi online", "Tatap muka", "Pendampingan lapangan", "Mediasi"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legalBasis">Dasar hukum / rujukan</Label>
                <Input
                  id="legalBasis"
                  value={draft.legalBasis}
                  onChange={(e) => set("legalBasis", e.target.value)}
                  placeholder="UU No. 5/1960, PP No. 24/1997"
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="requirements">Dokumen yang dibutuhkan</Label>
                <Textarea
                  id="requirements"
                  rows={4}
                  value={draft.requirements}
                  onChange={(e) => set("requirements", e.target.value)}
                  placeholder="KTP, sertifikat/girik, PBB, surat kuasa…"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-contact`}>Narahubung</Label>
            <Input
              id={`${pillar}-contact`}
              value={draft.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-phone`}>Telepon narahubung</Label>
            <Input
              id={`${pillar}-phone`}
              value={draft.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-sort`}>Urutan tampil</Label>
            <Input
              id={`${pillar}-sort`}
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Aktif / tampil di situs
          </label>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Foto layanan</Label>
            <ImageUploader
              value={draft.imageUrl ? [draft.imageUrl] : []}
              onChange={(urls) => set("imageUrl", urls[0] ?? "")}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${pillar}-desc`}>Deskripsi</Label>
            <Textarea
              id={`${pillar}-desc`}
              rows={5}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(emptyDraft);
                setShowForm(false);
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Belum ada layanan {label}.</p>
        ) : null}
        {rows.map((row: any) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">
                {row.category?.name ?? "Tanpa kategori"} · Mulai Rp {Number(row.price_from ?? 0).toLocaleString("id-ID")}{" "}
                {row.price_unit}
                {row.city ? ` · ${row.city}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{row.is_active ? "Aktif" : "Nonaktif"}</Badge>
              <Button size="sm" variant="secondary" onClick={() => edit(row)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(row.id)}>
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
