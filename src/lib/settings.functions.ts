import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

export type WhatsappSettings = {
  number: string;
  label: string;
  greeting: string;
  enabled: boolean;
};

export const WHATSAPP_DEFAULTS: WhatsappSettings = {
  number: "6281312778888",
  label: "Anugerah Mulia",
  greeting: "Halo, saya ingin bertanya tentang properti di Anugerah Mulia.",
  enabled: true,
};

function normalizeNumber(input: string) {
  let digits = (input ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits.slice(0, 20);
}

function merge(value: unknown): WhatsappSettings {
  const raw = (typeof value === "string" ? safeParse(value) : value) as Partial<WhatsappSettings> | null;
  if (!raw || typeof raw !== "object") return WHATSAPP_DEFAULTS;
  return {
    number: normalizeNumber(String(raw.number ?? WHATSAPP_DEFAULTS.number)) || WHATSAPP_DEFAULTS.number,
    label: String(raw.label ?? WHATSAPP_DEFAULTS.label).slice(0, 80),
    greeting: String(raw.greeting ?? WHATSAPP_DEFAULTS.greeting).slice(0, 500),
    enabled: raw.enabled !== false,
  };
}

function safeParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

/** Publik: pengaturan WhatsApp untuk tombol mengambang & halaman kontak. */
export const getWhatsappSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<WhatsappSettings> => {
    try {
      const { db } = await import("./db/pgrest.server");
      const { data } = await db
        .from("site_settings")
        .select("value")
        .eq("key", "whatsapp")
        .maybeSingle();
      return merge((data as { value?: unknown } | null)?.value ?? null);
    } catch {
      return WHATSAPP_DEFAULTS;
    }
  },
);

export const adminSaveWhatsappSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: Partial<WhatsappSettings>) => input ?? {})
  .handler(async ({ data, context }): Promise<WhatsappSettings> => {
    if (!context.isAdmin) throw new Error("Forbidden");
    const value = merge({ ...WHATSAPP_DEFAULTS, ...data });
    if (!value.number) throw new Error("Nomor WhatsApp wajib diisi");
    const { db: dbAdmin } = await import("@/lib/db/pgrest.server");
    const { error } = await dbAdmin
      .from("site_settings")
      .upsert({ key: "whatsapp", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      throw new Error(
        error.message.includes("site_settings")
          ? "Tabel pengaturan belum ada. Jalankan db/whatsapp-settings.sql di database Anda."
          : error.message,
      );
    }
    return value;
  });
