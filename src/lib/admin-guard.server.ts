// Verifikasi peran admin lalu berikan akses database penuh (server-only).
export async function assertAdmin(context: { db: any; userId: string }) {
  const { data: isAdmin } = await context.db.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  const { db } = await import("@/lib/db/pgrest.server");
  return db;
}
