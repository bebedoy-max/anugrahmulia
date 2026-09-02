// Kolam koneksi PostgreSQL (server-only).
// Konfigurasi via DATABASE_URL, atau PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT.
import "../env.server";
import { Pool } from "pg";

let _pool: Pool | undefined;

export function hasDirectPostgresConfig(): boolean {
  const provider = process.env["DATABASE_PROVIDER"]?.trim().toLowerCase();
  if (provider === "postgres") return Boolean(process.env["DATABASE_URL"] || process.env["PGHOST"]);
  if (provider === "cloud") return false;
  // Jika Cloud tersedia, jadikan itu default untuk preview. Hosting mandiri
  // memilih PostgreSQL secara eksplisit melalui DATABASE_PROVIDER=postgres.
  const hasSupabase = Boolean(process.env["SUPABASE_URL"] || process.env["APP_SUPABASE_URL"]);
  return !hasSupabase && Boolean(process.env["DATABASE_URL"] || process.env["PGHOST"]);
}

export function getPool(): Pool {
  if (_pool) return _pool;

  // Batas koneksi & waktu tunggu: shared hosting membatasi jumlah proses,
  // jadi koneksi idle ditutup agar tidak menahan slot database.
  const shared = {
    max: Number(process.env["PGPOOL_MAX"] ?? 8),
    idleTimeoutMillis: Number(process.env["PGPOOL_IDLE_MS"] ?? 10_000),
    connectionTimeoutMillis: Number(process.env["PGPOOL_CONNECT_MS"] ?? 10_000),
  };

  const url = process.env["DATABASE_URL"];
  const sslDisabled = (process.env["PGSSL"] ?? "").toLowerCase() === "disable";

  if (url) {
    _pool = new Pool({
      connectionString: url,
      ...shared,
      ssl: sslDisabled || url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    });
  } else {
    const host = process.env["PGHOST"];
    if (!host) {
      throw new Error(
        "Konfigurasi database belum ada. Set DATABASE_URL (mis. postgres://user:pass@localhost:5432/nama_db).",
      );
    }
    _pool = new Pool({
      host,
      port: Number(process.env["PGPORT"] ?? 5432),
      user: process.env["PGUSER"],
      password: process.env["PGPASSWORD"],
      database: process.env["PGDATABASE"],
      ...shared,
      ssl: sslDisabled || host === "localhost" || host === "127.0.0.1"
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  _pool.on("error", (err) => console.error("[pg] idle client error", err));
  return _pool;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as never[]);
  return result.rows as T[];
}

export async function sqlOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}
