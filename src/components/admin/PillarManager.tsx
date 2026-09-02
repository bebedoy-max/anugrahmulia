import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServicesManager } from "@/components/admin/ServicesManager";
import {
  adminDeleteCategory,
  adminListCategories,
  adminSaveCategory,
} from "@/lib/taxonomy.functions";
import type { Category } from "@/lib/types";

type Pillar = "konstruksi" | "pertanahan";

export function PillarManager({ pillar, label }: { pillar: Pillar; label: string }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListCategories);
  const saveFn = useServerFn(adminSaveCategory);
  const deleteFn = useServerFn(adminDeleteCategory);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories", pillar],
    queryFn: () => listFn({ data: { pillar } }) as Promise<Category[]>,
  });

  function reset() {
    setName("");
    setIcon("");
    setEditingId(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveFn({
        data: { id: editingId ?? undefined, pillar, name, icon: icon || null },
      });
      toast.success(editingId ? "Kategori diperbarui." : "Kategori ditambahkan.");
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin-categories", pillar] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kategori");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus kategori ini?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Kategori dihapus.");
      void queryClient.invalidateQueries({ queryKey: ["admin-categories", pillar] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus kategori");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Kategori {label}</h3>
          <p className="text-sm text-muted-foreground">
            Kategori khusus pilar {label}, terpisah dari kategori Mulia Properti.
          </p>
        </div>

        <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-cat-name`}>Nama kategori</Label>
            <Input
              id={`${pillar}-cat-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={pillar === "konstruksi" ? "Bangun rumah baru" : "Pengurusan sertifikat"}
              required
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${pillar}-cat-icon`}>Ikon (opsional)</Label>
            <Input
              id={`${pillar}-cat-icon`}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="hammer"
              maxLength={60}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : editingId ? "Perbarui" : "Tambah"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={reset}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>

        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Belum ada kategori {label}.
            </p>
          ) : null}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.slug}
                  {c.icon ? ` · ${c.icon}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(c.id);
                    setName(c.name);
                    setIcon(c.icon ?? "");
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Layanan {label}</h3>
        </div>
        <ServicesManager pillar={pillar} label={label} categories={categories} />
      </section>
    </div>
  );
}
