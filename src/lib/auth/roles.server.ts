// Pemeriksaan peran pengguna langsung dari tabel public.user_roles.
// Tidak memakai RPC `has_role` agar tetap bekerja walau fungsi/skema pembantu
// di database belum lengkap (mis. skema `private` belum dibuat).
export async function getRoles(userId: string): Promise<string[]> {
  const { db } = await import("../db/pgrest.server");
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error("[roles]", error.message);
    return [];
  }
  return (data ?? []).map((row: { role: string }) => String(row.role));
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  return (await getRoles(userId)).includes("admin");
}
