import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminSaveWhatsappSettings,
  getWhatsappSettings,
  WHATSAPP_DEFAULTS,
  type WhatsappSettings,
} from "@/lib/settings.functions";

export function WhatsappManager() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getWhatsappSettings);
  const save = useServerFn(adminSaveWhatsappSettings);
  const [form, setForm] = useState<WhatsappSettings>(WHATSAPP_DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({ queryKey: ["whatsapp-settings"], queryFn: () => fetchSettings() });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  return (
    <form
      className="max-w-xl space-y-4 rounded-xl border bg-card p-6 shadow-soft"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await save({ data: form });
          await queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
          toast.success("Pengaturan WhatsApp tersimpan.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Gagal menyimpan pengaturan");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <h2 className="font-display text-xl">Nomor WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Nomor ini dipakai tombol WhatsApp mengambang dan tautan di halaman kontak.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-number">Nomor WhatsApp</Label>
        <Input
          id="wa-number"
          value={form.number}
          onChange={(event) => setForm({ ...form, number: event.target.value })}
          placeholder="6281312778888"
          maxLength={20}
          required
        />
        <p className="text-xs text-muted-foreground">Gunakan format internasional, contoh 6281312778888.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-label">Nama yang ditampilkan</Label>
        <Input
          id="wa-label"
          value={form.label}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wa-greeting">Pesan pembuka</Label>
        <Textarea
          id="wa-greeting"
          rows={3}
          value={form.greeting}
          onChange={(event) => setForm({ ...form, greeting: event.target.value })}
          maxLength={500}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
        />
        Tampilkan tombol WhatsApp di website
      </label>
      <Button type="submit" disabled={saving}>
        {saving ? "Menyimpan…" : "Simpan pengaturan"}
      </Button>
    </form>
  );
}
