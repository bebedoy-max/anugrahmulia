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
  deletePropertyListing,
  getAgentStats,
  listAgentInquiries,
  listAgentSchedules,
  listMyProperties,
  replyInquiry,
  savePropertyListing,
} from "@/lib/agent.functions";
import { getFilterMeta } from "@/lib/properties.functions";
import { APPROVAL_LABEL, formatDateTime, formatPrice, STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({
    meta: [
      { title: "Dashboard Agen — Anugerah Mulia" },
      { name: "description", content: "Kelola listing, pertanyaan, dan jadwal survei sebagai agen properti." },
      { property: "og:title", content: "Dashboard Agen — Anugerah Mulia" },
      { property: "og:description", content: "Pusat kendali listing properti Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AgentPage,
});

function AgentPage() {
  const queryClient = useQueryClient();
  const stats = useServerFn(getAgentStats);
  const myProperties = useServerFn(listMyProperties);
  const saveListing = useServerFn(savePropertyListing);
  const removeListing = useServerFn(deletePropertyListing);
  const inquiriesFn = useServerFn(listAgentInquiries);
  const schedulesFn = useServerFn(listAgentSchedules);
  const reply = useServerFn(replyInquiry);

  const { data: summary } = useQuery({ queryKey: ["agent-stats"], queryFn: () => stats() });
  const { data: listings = [] } = useQuery({ queryKey: ["agent-listings"], queryFn: () => myProperties() });
  const { data: inquiries = [] } = useQuery({ queryKey: ["agent-inquiries"], queryFn: () => inquiriesFn() });
  const { data: schedules = [] } = useQuery({ queryKey: ["agent-schedules"], queryFn: () => schedulesFn() });
  const { data: meta } = useQuery({ queryKey: ["filter-meta"], queryFn: () => getFilterMeta() });

  return (
    <DashboardShell title="Dashboard agen" description="Kelola iklan properti dan permintaan calon pembeli.">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total listing", value: summary?.total ?? 0 },
          { label: "Aktif", value: summary?.aktif ?? 0 },
          { label: "Total dilihat", value: summary?.views ?? 0 },
          { label: "Pertanyaan", value: summary?.inquiries ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-display text-2xl">{item.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="listing" className="mt-8">
        <TabsList>
          <TabsTrigger value="listing">Listing</TabsTrigger>
          <TabsTrigger value="baru">Pasang iklan</TabsTrigger>
          <TabsTrigger value="inquiry">Pertanyaan</TabsTrigger>
          <TabsTrigger value="survei">Survei</TabsTrigger>
        </TabsList>

        <TabsContent value="listing" className="space-y-3">
          {listings.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Belum ada listing.</p>
          ) : (
            listings.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item.price, item.type)} · {item.city} · {item.views} dilihat
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{STATUS_LABEL[item.status] ?? item.status}</Badge>
                  <Badge variant="outline">{APPROVAL_LABEL[item.approval] ?? item.approval}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await removeListing({ data: { id: item.id } });
                      toast.success("Listing dihapus.");
                      void queryClient.invalidateQueries({ queryKey: ["agent-listings"] });
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="baru">
          <form
            className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const num = (key: string) => Number(form.get(key) ?? 0) || 0;
              try {
                await saveListing({
                  data: {
                    title: String(form.get("title") ?? ""),
                    description: String(form.get("description") ?? ""),
                    type: String(form.get("type") ?? "jual"),
                    categoryId: (String(form.get("categoryId") ?? "") || null),
                    price: num("price"),
                    address: String(form.get("address") ?? ""),
                    city: String(form.get("city") ?? ""),
                    province: String(form.get("province") ?? ""),
                    latitude: num("latitude") || null,
                    longitude: num("longitude") || null,
                    landArea: num("landArea"),
                    buildingArea: num("buildingArea"),
                    bedrooms: num("bedrooms"),
                    bathrooms: num("bathrooms"),
                    carports: num("carports"),
                    certificate: String(form.get("certificate") ?? "") || null,
                    status: "aktif",
                    images: String(form.get("images") ?? "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 10),
                    facilityIds: [],
                  },
                });
                toast.success("Listing dikirim dan menunggu review admin.");
                event.currentTarget.reset();
                void queryClient.invalidateQueries({ queryKey: ["agent-listings"] });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menyimpan listing");
              }
            }}
          >
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Judul iklan</Label>
              <Input id="title" name="title" required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipe (jual/sewa)</Label>
              <Input id="type" name="type" defaultValue="jual" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Kategori</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Tanpa kategori</option>
                {(meta?.categories ?? []).filter((c) => (c.pillar ?? "properti") === "properti").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Harga (Rp)</Label>
              <Input id="price" name="price" type="number" min={0} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="certificate">Sertifikat</Label>
              <Input id="certificate" name="certificate" placeholder="SHM / HGB" maxLength={40} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address">Alamat</Label>
              <Input id="address" name="address" required maxLength={250} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Kota</Label>
              <Input id="city" name="city" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="province">Provinsi</Label>
              <Input id="province" name="province" required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" name="latitude" type="number" step="any" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" name="longitude" type="number" step="any" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landArea">Luas tanah (m²)</Label>
              <Input id="landArea" name="landArea" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buildingArea">Luas bangunan (m²)</Label>
              <Input id="buildingArea" name="buildingArea" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bedrooms">Kamar tidur</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bathrooms">Kamar mandi</Label>
              <Input id="bathrooms" name="bathrooms" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carports">Carport</Label>
              <Input id="carports" name="carports" type="number" min={0} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="images">URL foto (satu per baris)</Label>
              <Textarea id="images" name="images" rows={3} placeholder="/images/properti-1.jpg" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" name="description" rows={5} required maxLength={4000} />
            </div>
            <Button type="submit" className="md:col-span-2">Simpan listing</Button>
          </form>
        </TabsContent>

        <TabsContent value="inquiry" className="space-y-3">
          {inquiries.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Belum ada pertanyaan.</p>
          ) : (
            inquiries.map((item) => (
              <form
                key={item.id}
                className="space-y-2 rounded-xl border bg-card p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const value = String(new FormData(event.currentTarget).get("reply") ?? "");
                  await reply({ data: { id: item.id, reply: value } });
                  toast.success("Balasan terkirim.");
                  void queryClient.invalidateQueries({ queryKey: ["agent-inquiries"] });
                }}
              >
                <p className="font-medium">{item.name} · {item.phone}</p>
                <p className="text-sm text-muted-foreground">{item.message}</p>
                <Textarea name="reply" rows={2} defaultValue={item.reply ?? ""} maxLength={1000} />
                <Button size="sm" type="submit">Balas</Button>
              </form>
            ))
          )}
        </TabsContent>

        <TabsContent value="survei" className="space-y-3">
          {schedules.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Belum ada permintaan survei.</p>
          ) : (
            schedules.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-4">
                <p className="font-medium">{item.name} · {item.phone}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(item.scheduled_date)} · {item.status}
                </p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}