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
import { becomeAgent, getMyAccount, listMyInquiries, listMySchedules, updateMyProfile } from "@/lib/account.functions";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profil & Aktivitas Saya — Anugerah Mulia" },
      { name: "description", content: "Kelola profil, pertanyaan, dan jadwal survei Anda." },
      { property: "og:title", content: "Profil & Aktivitas Saya" },
      { property: "og:description", content: "Pengaturan akun Anugerah Mulia." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const saveProfile = useServerFn(updateMyProfile);
  const upgrade = useServerFn(becomeAgent);
  const fetchInquiries = useServerFn(listMyInquiries);
  const fetchSchedules = useServerFn(listMySchedules);
  const queryClient = useQueryClient();

  const { data: account } = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });
  const { data: inquiries = [] } = useQuery({ queryKey: ["my-inquiries"], queryFn: () => fetchInquiries() });
  const { data: schedules = [] } = useQuery({ queryKey: ["my-schedules"], queryFn: () => fetchSchedules() });

  const roles = account?.roles ?? [];

  return (
    <DashboardShell title="Profil saya" description="Perbarui data diri dan pantau aktivitas Anda.">
      <div className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border bg-card p-6 shadow-soft"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            try {
              await saveProfile({
                data: {
                  name: String(form.get("name") ?? "").slice(0, 100),
                  phone: String(form.get("phone") ?? "").slice(0, 30),
                  company: String(form.get("company") ?? "").slice(0, 120),
                  bio: String(form.get("bio") ?? "").slice(0, 600),
                },
              });
              toast.success("Profil diperbarui.");
              void queryClient.invalidateQueries({ queryKey: ["account"] });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
            }
          }}
        >
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" defaultValue={account?.profile?.name ?? ""} maxLength={100} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telepon</Label>
            <Input id="phone" name="phone" defaultValue={account?.profile?.phone ?? ""} maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Perusahaan</Label>
            <Input id="company" name="company" defaultValue={account?.profile?.company ?? ""} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" rows={4} defaultValue={account?.profile?.bio ?? ""} maxLength={600} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Simpan profil</Button>
            {!roles.includes("agent") ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await upgrade();
                  toast.success("Akun Anda kini terdaftar sebagai agen.");
                  void queryClient.invalidateQueries({ queryKey: ["account"] });
                }}
              >
                Jadi agen
              </Button>
            ) : null}
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Pertanyaan saya</h2>
            {inquiries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada pertanyaan.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {inquiries.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3">
                    <p className="font-medium">{item.property?.title ?? "Properti"}</p>
                    <p className="text-muted-foreground">{item.message}</p>
                    {item.reply ? <p className="mt-1 text-accent">Balasan: {item.reply}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)} · {item.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Jadwal survei</h2>
            {schedules.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada jadwal survei.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {schedules.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3">
                    <p className="font-medium">{item.property?.title ?? "Properti"}</p>
                    <p className="text-muted-foreground">{formatDateTime(item.scheduled_date)} · {item.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}