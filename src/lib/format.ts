export function formatRupiah(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Hubungi agen";
  if (value >= 1_000_000_000) {
    const miliar = value / 1_000_000_000;
    return `Rp ${miliar.toFixed(miliar % 1 === 0 ? 0 : 2).replace(".", ",")} M`;
  }
  if (value >= 1_000_000) {
    const juta = value / 1_000_000;
    return `Rp ${juta.toFixed(juta % 1 === 0 ? 0 : 1).replace(".", ",")} Jt`;
  }
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function formatRupiahFull(value: number): string {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString("id-ID")}`;
}

export function formatPrice(value: number, type: string): string {
  return type === "sewa" ? `${formatRupiah(value)}/tahun` : formatRupiah(value);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  aktif: "Aktif",
  terjual: "Terjual",
  tersewa: "Tersewa",
  nonaktif: "Nonaktif",
};

export const APPROVAL_LABEL: Record<string, string> = {
  pending: "Menunggu review",
  approved: "Disetujui",
  rejected: "Ditolak",
};