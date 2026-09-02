import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/kontak")({
  head: () => ({
    meta: [
      { title: "Kontak Anugerah Mulia — Bantuan & Kemitraan" },
      {
        name: "description",
        content: "Hubungi tim Anugerah Mulia untuk bantuan pencarian properti, kemitraan agen, atau laporan listing.",
      },
      { property: "og:title", content: "Kontak Anugerah Mulia" },
      { property: "og:description", content: "Kami siap membantu Anda setiap hari kerja." },
    ],
  }),
  component: KontakPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().email("Email tidak valid").max(255),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter").max(1000),
});

function KontakPage() {
  return (
    <PublicLayout>
      <div className="container-page grid max-w-5xl gap-10 py-16 md:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl">Hubungi kami</h1>
          <p className="mt-4 text-muted-foreground">
            Punya pertanyaan tentang listing, akun agen, atau kerja sama? Tim kami membalas dalam
            1x24 jam pada hari kerja.
          </p>
          <dl className="mt-8 space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium">halo@anugerahmulia.id</dd></div>
            <div><dt className="text-muted-foreground">Telepon</dt><dd className="font-medium">+6281312778888</dd></div>
            <div><dt className="text-muted-foreground">Jam operasional</dt><dd className="font-medium">Senin–Sabtu, 08.00–18.00 WIB</dd></div>
          </dl>
        </div>
        <form
          className="space-y-4 rounded-xl border bg-card p-6 shadow-soft"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const parsed = schema.safeParse({
              name: form.get("name"),
              email: form.get("email"),
              message: form.get("message"),
            });
            if (!parsed.success) {
              toast.error(parsed.error.issues[0]?.message ?? "Data belum lengkap");
              return;
            }
            toast.success("Terima kasih! Pesan Anda sudah kami terima.");
            event.currentTarget.reset();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="k-name">Nama</Label>
            <Input id="k-name" name="name" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-email">Email</Label>
            <Input id="k-email" name="email" type="email" required maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-message">Pesan</Label>
            <Textarea id="k-message" name="message" rows={5} required maxLength={1000} />
          </div>
          <Button type="submit" className="w-full">Kirim pesan</Button>
        </form>
      </div>
    </PublicLayout>
  );
}