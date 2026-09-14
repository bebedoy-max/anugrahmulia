import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Bath,
  BedDouble,
  Car,
  Eye,
  Flag,
  Heart,
  LandPlot,
  MapPin,
  Ruler,
  ScrollText,
} from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { PropertyCardItem } from "@/components/PropertyCard";
import { PropertyMap } from "@/components/map/PropertyMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatPrice, formatRupiahFull } from "@/lib/format";
import {
  getPropertyBySlug,
  getSimilarProperties,
  registerPropertyView,
} from "@/lib/properties.functions";
import { createInquiry, createReport, createSchedule, toggleFavorite } from "@/lib/account.functions";

function detailQuery(slug: string) {
  return queryOptions({
    queryKey: ["property", slug],
    queryFn: async () => {
      const property = await getPropertyBySlug({ data: { slug } });
      if (!property) throw notFound();
      return property;
    },
  });
}

export const Route = createFileRoute("/properti/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(detailQuery(params.slug)),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Properti tidak tersedia — Anugerah Mulia" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const desc = `${loaderData.title} di ${loaderData.city}, ${loaderData.province}. ${formatPrice(loaderData.price, loaderData.type)}.`;
    return {
      meta: [
        { title: `${loaderData.title} — Anugerah Mulia` },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: desc.slice(0, 158) },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <PublicLayout>
      <p role="alert" className="container-page py-24 text-center">Gagal memuat properti: {error.message}</p>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-2xl">Properti tidak ditemukan</h1>
        <Button asChild className="mt-4"><Link to="/properti" search={{ page: 1 }}>Lihat listing lain</Link></Button>
      </div>
    </PublicLayout>
  ),
  component: DetailPage,
});

const inquirySchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().email("Email tidak valid").max(255),
  phone: z.string().trim().min(8, "Nomor telepon tidak valid").max(30),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter").max(1000),
});

function DetailPage() {
  const { slug } = Route.useParams();
  const { data: property } = useSuspenseQuery(detailQuery(slug));
  const { user } = useAuth();
  const navigate = useNavigate();

  const registerView = useServerFn(registerPropertyView);
  const submitInquiry = useServerFn(createInquiry);
  const submitSchedule = useServerFn(createSchedule);
  const submitReport = useServerFn(createReport);
  const favorite = useServerFn(toggleFavorite);

  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void registerView({ data: { slug } });
  }, [slug, registerView]);

  const { data: similar = [] } = useQuery({
    queryKey: ["similar", property.city, slug],
    queryFn: () => getSimilarProperties({ data: { city: property.city, excludeSlug: slug } }),
  });

  const images = [...(property.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const gallery = images.length > 0 ? images : [{ url: "/images/properti-1.jpg", is_primary: true, sort_order: 0 }];

  async function handleInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = inquirySchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      message: form.get("message"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Data belum lengkap");
      return;
    }
    if (!user) {
      toast.error("Masuk terlebih dahulu untuk mengirim pertanyaan.");
      navigate({ to: "/auth", search: { redirect: `/properti/${slug}` } });
      return;
    }
    setSending(true);
    try {
      await submitInquiry({ data: { propertyId: property.id, ...parsed.data } });
      toast.success("Pertanyaan terkirim. Agen akan menghubungi Anda.");
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim pertanyaan");
    } finally {
      setSending(false);
    }
  }

  async function handleSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") ?? "");
    const sname = String(form.get("sname") ?? "").trim();
    const sphone = String(form.get("sphone") ?? "").trim();
    if (!date || sname.length < 2 || sphone.length < 8) {
      toast.error("Lengkapi nama, telepon, dan jadwal survei.");
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/properti/${slug}` } });
      return;
    }
    setSending(true);
    try {
      await submitSchedule({
        data: {
          propertyId: property.id,
          name: sname.slice(0, 100),
          phone: sphone.slice(0, 30),
          scheduledDate: new Date(date).toISOString(),
          note: String(form.get("note") ?? "").slice(0, 500),
        },
      });
      toast.success("Permintaan survei terkirim.");
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim jadwal");
    } finally {
      setSending(false);
    }
  }

  async function handleFavorite() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/properti/${slug}` } });
      return;
    }
    const result = await favorite({ data: { propertyId: property.id } });
    toast.success(result.favorited ? "Ditambahkan ke favorit" : "Dihapus dari favorit");
  }

  async function handleReport() {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/properti/${slug}` } });
      return;
    }
    await submitReport({ data: { propertyId: property.id, reason: "Listing mencurigakan" } });
    toast.success("Laporan dikirim ke admin.");
  }

  return (
    <PublicLayout>
      <div className="container-page py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-accent">Beranda</Link> ·{" "}
          <Link to="/properti" search={{ page: 1 }} className="hover:text-accent">Properti</Link> ·{" "}
          <span className="text-foreground">{property.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div>
              <div className="rounded-xl border bg-muted">
                <img
                  src={gallery[active]?.url ?? gallery[0]!.url}
                  alt={`Foto ${property.title}`}
                  className="block h-auto w-full rounded-xl"
                />
              </div>
              {gallery.length > 1 ? (
                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {gallery.map((image, index) => (
                    <button
                      key={image.url + index}
                      type="button"
                      onClick={() => setActive(index)}
                      aria-label={`Lihat foto ${index + 1}`}
                      className={`overflow-hidden rounded-lg border-2 ${index === active ? "border-accent" : "border-transparent"}`}
                    >
                      <img src={image.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-contain bg-muted" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{property.type === "sewa" ? "Disewakan" : "Dijual"}</Badge>
                {property.category ? <Badge variant="outline">{property.category.name}</Badge> : null}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="size-3.5" aria-hidden /> {property.views} dilihat
                </span>
                <span className="text-xs text-muted-foreground">· Diiklankan {formatDate(property.created_at)}</span>
              </div>
              <h1 className="mt-3 font-display text-3xl leading-tight">{property.title}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-4" aria-hidden /> {property.address}, {property.city}, {property.province}
              </p>
              <p className="mt-4 font-display text-3xl text-accent">
                {formatPrice(property.price, property.type)}
              </p>
              <p className="text-sm text-muted-foreground">{formatRupiahFull(property.price)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
              {[
                { icon: BedDouble, label: "Kamar tidur", value: property.bedrooms },
                { icon: Bath, label: "Kamar mandi", value: property.bathrooms },
                { icon: Car, label: "Carport", value: property.carports },
                { icon: LandPlot, label: "Luas tanah", value: `${property.land_area} m²` },
                { icon: Ruler, label: "Luas bangunan", value: `${property.building_area} m²` },
                { icon: ScrollText, label: "Sertifikat", value: property.certificate ?? "-" },
              ].map((item) => (
                <div key={item.label}>
                  <item.icon className="size-5 text-accent" aria-hidden />
                  <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <section>
              <h2 className="font-display text-2xl">Deskripsi</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                {property.description}
              </p>
            </section>

            {property.facilities.length > 0 ? (
              <section>
                <h2 className="font-display text-2xl">Fasilitas</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {property.facilities.map((facility) => (
                    <li key={facility.id}>
                      <Badge variant="secondary">{facility.name}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {property.latitude && property.longitude ? (
              <section>
                <h2 className="font-display text-2xl">Lokasi</h2>
                <div className="mt-3 overflow-hidden rounded-xl border">
                  <PropertyMap
                    height={360}
                    zoom={14}
                    center={[property.latitude, property.longitude]}
                    points={[
                      {
                        id: property.id,
                        lat: property.latitude,
                        lng: property.longitude,
                        title: property.title,
                        subtitle: property.city,
                      },
                    ]}
                  />
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-xl border bg-card p-5 shadow-soft">
              <p className="text-sm text-muted-foreground">Dipasarkan oleh</p>
              <p className="font-semibold">{property.agent_name}</p>
              {property.agent_phone ? (
                <p className="text-sm text-muted-foreground">{property.agent_phone}</p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleFavorite}>
                  <Heart className="size-4" aria-hidden /> Simpan
                </Button>
                <Button variant="ghost" size="icon" aria-label="Laporkan listing" onClick={handleReport}>
                  <Flag className="size-4" />
                </Button>
              </div>
              <Separator className="my-5" />
              <Tabs defaultValue="tanya">
                <TabsList className="w-full">
                  <TabsTrigger value="tanya" className="flex-1">Tanya</TabsTrigger>
                  <TabsTrigger value="survei" className="flex-1">Survei</TabsTrigger>
                </TabsList>
                <TabsContent value="tanya">
                  <form className="space-y-3" onSubmit={handleInquiry}>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nama</Label>
                      <Input id="name" name="name" required maxLength={100} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required maxLength={255} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Telepon</Label>
                      <Input id="phone" name="phone" required maxLength={30} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="message">Pesan</Label>
                      <Textarea
                        id="message"
                        name="message"
                        rows={4}
                        maxLength={1000}
                        defaultValue={`Halo, saya tertarik dengan ${property.title}.`}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={sending}>
                      Kirim pertanyaan
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="survei">
                  <form className="space-y-3" onSubmit={handleSchedule}>
                    <div className="space-y-1.5">
                      <Label htmlFor="sname">Nama</Label>
                      <Input id="sname" name="sname" required maxLength={100} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sphone">Telepon</Label>
                      <Input id="sphone" name="sphone" required maxLength={30} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="date">Tanggal & jam</Label>
                      <Input id="date" name="date" type="datetime-local" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="note">Catatan</Label>
                      <Textarea id="note" name="note" rows={3} maxLength={500} />
                    </div>
                    <Button type="submit" className="w-full" disabled={sending}>
                      Ajukan survei
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>

            <div className="rounded-xl border bg-secondary p-5">
              <p className="font-semibold">Simulasi cicilan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hitung estimasi KPR untuk properti ini.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/kpr" search={{ harga: property.price }}>Buka kalkulator KPR</Link>
              </Button>
            </div>
          </aside>
        </div>

        {similar.length > 0 ? (
          <section className="mt-16">
            <h2 className="font-display text-2xl">Properti serupa di {property.city}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {similar.map((item) => (
                <PropertyCardItem key={item.id} property={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PublicLayout>
  );
}