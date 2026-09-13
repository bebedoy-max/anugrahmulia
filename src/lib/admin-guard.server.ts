// Verifikasi peran admin lalu berikan akses database penuh (server-only).
export async function assertAdmin(context: { db: any; userId: string; isAdmin?: boolean }) {
  const isAdmin = context.isAdmin;
  if (!isAdmin) throw new Error("Forbidden");
  const { db } = await import("@/lib/db/pgrest.server");
  return db;
}
