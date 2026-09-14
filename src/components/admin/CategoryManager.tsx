import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminDeleteCategory,
  adminListCategories,
  adminSaveCategory,
} from "@/lib/taxonomy.functions";
import type { Category } from "@/lib/types";

/** CRUD kategori untuk pilar Mulia Properti. */
export function CategoryManager() {
  const pillar = "properti" as const;
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

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-categories", pillar] });
    void queryClient.invalidateQueries({ queryKey: ["filter-meta"] });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveFn({ data: { id: editingId ?? undefined, pillar, name, icon: icon || null } });
      toast.success(editingId ? "Kategori diperbarui." : "Kategori ditambahkan.");
      reset();
      refresh();
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
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus kategori");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Kategori Mulia Properti</h3>
        <p className="text-sm text-muted-foreground">
          Kategori ini yang muncul pada pilihan kategori saat menambah properti.
        </p>
      </div>

      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="properti-cat-name">Nama kategori</Label>
          <Input
            id="properti-cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Perumahan Tirtayasa Mulia"
            required
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="properti-cat-icon">Ikon (opsional)</Label>
          <Input
            id="properti-cat-icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="home"
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
            Belum ada kategori properti.
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
    </div>
  );
}
