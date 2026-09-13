import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminDeleteProperty,
  adminGetProperty,
  adminListProperties,
  adminListReports,
  adminListUsers,
  adminReviewProperty,
  adminSaveProperty,
  adminSetUserRole,
  getAdminStats,
} from "@/lib/admin.functions";
import { getFilterMeta } from "@/lib/properties.functions";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { PillarManager } from "@/components/admin/PillarManager";
import { CompanyVideoManager } from "@/components/admin/CompanyVideoManager";
import { BannerManager } from "@/components/admin/BannerManager";
import { WhatsappManager } from "@/components/admin/WhatsappManager";


import { LocationPicker } from "@/components/map/LocationPicker";
import { APPROVAL_LABEL, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Anugerah Mulia" },
      { name: "description", content: "Moderasi listing, kelola pengguna, dan pantau laporan platform." },
      { property: "og:title", content: "Dashboard Admin — Anugerah Mulia" },
      { property: "og:description", content: "Panel moderasi Anugerah Mulia." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Draft = {
  id?: string;
  title: string;
  description: string;
  type: string;
  categoryId: string;
  price: number;
  address: string;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  landArea: number;
  buildingArea: number;
  bedrooms: number;
  bathrooms: number;
  carports: number;
  certificate: string;
  status: string;
  approval: string;
  isFeatured: boolean;
  agentName: string;
  agentPhone: string;
  images: string[];
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  type: "jual",
  categoryId: "",
  price: 0,
  address: "",
  city: "",
  province: "",
  latitude: null,
  longitude: null,
  landArea: 0,
  buildingArea: 0,
  bedrooms: 0,
  bathrooms: 0,
  carports: 0,
  certificate: "",
  status: "aktif",
  approval: "approved",
  isFeatured: false,
  agentName: "Admin",
  agentPhone: "",
  images: [],
};

function AdminPage() {
  const queryClient = useQueryClient();
  const statsFn = useServerFn(getAdminStats);
  const propertiesFn = useServerFn(adminListProperties);
  const reviewFn = useServerFn(adminReviewProperty);
  const usersFn = useServerFn(adminListUsers);
  const roleFn = useServerFn(adminSetUserRole);
  const reportsFn = useServerFn(adminListReports);
  const saveFn = useServerFn(adminSaveProperty);
  const deleteFn = useServerFn(adminDeleteProperty);
  const getFn = useServerFn(adminGetProperty);

  const [tab, setTab] = useState("listing");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const { data: properties = [] } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => propertiesFn({ data: {} }),
  });
  const { data: users = [] } = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const { data: reports = [] } = useQuery({ queryKey: ["admin-reports"], queryFn: () => reportsFn() });
  const { data: meta } = useQuery({ queryKey: ["filter-meta"], queryFn: () => getFilterMeta() });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function review(id: string, approval: string) {
    await reviewFn({ data: { id, approval } });
    toast.success(approval === "approved" ? "Listing disetujui." : "Listing ditolak.");
    void queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  async function editProperty(id: string) {
    try {
      const row = (await getFn({ data: { id } })) as any;
      if (!row) return;
      setDraft({
        id: row.id,
        title: row.title ?? "",
        description: row.description ?? "",
        type: row.type ?? "jual",
        categoryId: row.category_id ?? "",
        price: row.price ?? 0,
        address: row.address ?? "",
        city: row.city ?? "",
        province: row.province ?? "",
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        landArea: row.land_area ?? 0,
        buildingArea: row.building_area ?? 0,
        bedrooms: row.bedrooms ?? 0,
        bathrooms: row.bathrooms ?? 0,
        carports: row.carports ?? 0,
        certificate: row.certificate ?? "",
        status: row.status ?? "aktif",
        approval: row.approval ?? "approved",
        isFeatured: Boolean(row.is_featured),
        agentName: row.agent_name ?? "Admin",
        agentPhone: row.agent_phone ?? "",
        images: (row.images ?? [])
          .slice()
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((image: any) => image.url),
      });
      setTab("form");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat listing");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: draft.id,
          title: draft.title,
          description: draft.description,
          type: draft.type,
          categoryId: draft.categoryId || null,
          price: Number(draft.price) || 0,
          address: draft.address,
          city: draft.city,
          province: draft.province,
          latitude: draft.latitude,
          longitude: draft.longitude,
          landArea: Number(draft.landArea) || 0,
          buildingArea: Number(draft.buildingArea) || 0,
          bedrooms: Number(draft.bedrooms) || 0,
          bathrooms: Number(draft.bathrooms) || 0,
          carports: Number(draft.carports) || 0,
          certificate: draft.certificate || null,
          status: draft.status,
          approval: draft.approval,
          isFeatured: draft.isFeatured,
          agentName: draft.agentName,
          agentPhone: draft.agentPhone || null,
          images: draft.images,
        },
      });
      toast.success(draft.id ? "Listing diperbarui." : "Listing ditambahkan.");
      setDraft(emptyDraft);
      setTab("listing");
      void queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan listing");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus listing ini beserta datanya?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Listing dihapus.");
      void queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus listing");
    }
  }

  return (
    <DashboardShell title="Dashboard admin" description="Moderasi listing dan kelola pengguna platform.">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total listing", value: stats?.totalListing ?? 0 },
          { label: "Menunggu review", value: stats?.pending ?? 0 },
          { label: "Pengguna", value: stats?.totalUser ?? 0 },
          { label: "Laporan terbuka", value: stats?.laporanTerbuka ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-2xl">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="listing">Moderasi listing</TabsTrigger>
          <TabsTrigger value="form">{draft.id ? "Edit properti" : "Tambah properti"}</TabsTrigger>
          <TabsTrigger value="konstruksi">Mulia Konstruksi</TabsTrigger>
          <TabsTrigger value="pertanahan">Mulia Pertanahan</TabsTrigger>
          <TabsTrigger value="users">Pengguna</TabsTrigger>
          <TabsTrigger value="reports">Laporan</TabsTrigger>
          <TabsTrigger value="banner">Banner Utama</TabsTrigger>
          <TabsTrigger value="video">Video Profil</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>



        <TabsContent value="listing" className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setDraft(emptyDraft);
                setTab("form");
              }}
            >
              Tambah properti
            </Button>
          </div>
          {properties.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(item.price, item.type)} · {item.city} · {item.agent_name}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{APPROVAL_LABEL[item.approval] ?? item.approval}</Badge>
                <Button size="sm" onClick={() => review(item.id, "approved")}>Setujui</Button>
                <Button size="sm" variant="outline" onClick={() => review(item.id, "rejected")}>Tolak</Button>
                <Button size="sm" variant="secondary" onClick={() => editProperty(item.id)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(item.id)}>Hapus</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="form">
          <form className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Judul iklan</Label>
              <Input id="title" value={draft.title} onChange={(e) => set("title", e.target.value)} required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipe</Label>
              <select
                id="type"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="jual">Jual</option>
                <option value="sewa">Sewa</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Kategori</Label>
              <select
                id="categoryId"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Tanpa kategori</option>
                {(meta?.categories ?? []).filter((c) => (c.pillar ?? "properti") === "properti").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Harga (Rp)</Label>
              <Input id="price" type="number" min={0} value={draft.price} onChange={(e) => set("price", Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="certificate">Sertifikat</Label>
              <Input id="certificate" value={draft.certificate} onChange={(e) => set("certificate", e.target.value)} placeholder="SHM / HGB" maxLength={40} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address">Alamat</Label>
              <Input id="address" value={draft.address} onChange={(e) => set("address", e.target.value)} required maxLength={250} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Kota</Label>
              <Input id="city" value={draft.city} onChange={(e) => set("city", e.target.value)} required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="province">Provinsi</Label>
              <Input id="province" value={draft.province} onChange={(e) => set("province", e.target.value)} required maxLength={80} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Lokasi pada peta</Label>
              <LocationPicker
                value={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null}
                onChange={(point) =>
                  setDraft((prev) => ({
                    ...prev,
                    latitude: point ? point.lat : null,
                    longitude: point ? point.lng : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landArea">Luas tanah (m²)</Label>
              <Input id="landArea" type="number" min={0} value={draft.landArea} onChange={(e) => set("landArea", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buildingArea">Luas bangunan (m²)</Label>
              <Input id="buildingArea" type="number" min={0} value={draft.buildingArea} onChange={(e) => set("buildingArea", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bedrooms">Kamar tidur</Label>
              <Input id="bedrooms" type="number" min={0} value={draft.bedrooms} onChange={(e) => set("bedrooms", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bathrooms">Kamar mandi</Label>
              <Input id="bathrooms" type="number" min={0} value={draft.bathrooms} onChange={(e) => set("bathrooms", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carports">Carport</Label>
              <Input id="carports" type="number" min={0} value={draft.carports} onChange={(e) => set("carports", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {["draft", "aktif", "terjual", "tersewa", "nonaktif"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval">Persetujuan</Label>
              <select
                id="approval"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.approval}
                onChange={(e) => set("approval", e.target.value)}
              >
                {["pending", "approved", "rejected"].map((s) => (
                  <option key={s} value={s}>{APPROVAL_LABEL[s] ?? s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentName">Nama agen</Label>
              <Input id="agentName" value={draft.agentName} onChange={(e) => set("agentName", e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentPhone">Telepon agen</Label>
              <Input id="agentPhone" value={draft.agentPhone} onChange={(e) => set("agentPhone", e.target.value)} maxLength={30} />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={draft.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              Tampilkan sebagai listing unggulan
            </label>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Foto properti</Label>
              <ImageUploader value={draft.images} onChange={(urls) => set("images", urls)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" rows={6} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(emptyDraft);
                  setTab("listing");
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.roles.join(", ") || "buyer"}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await roleFn({ data: { userId: user.id, role: "agent" } });
                    toast.success("Peran agen ditambahkan.");
                    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                  }}
                >
                  Jadikan agen
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          {reports.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Tidak ada laporan.</p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="rounded-xl border bg-card p-4">
                <p className="font-medium">{report.reason}</p>
                <p className="text-sm text-muted-foreground">{report.status}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="konstruksi">
          <PillarManager pillar="konstruksi" label="Mulia Konstruksi" />
        </TabsContent>

        <TabsContent value="pertanahan">
          <PillarManager pillar="pertanahan" label="Mulia Pertanahan" />
        </TabsContent>

        <TabsContent value="banner">
          <BannerManager />
        </TabsContent>

        <TabsContent value="video">
          <CompanyVideoManager />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappManager />
        </TabsContent>
      </Tabs>


    </DashboardShell>
  );
}
