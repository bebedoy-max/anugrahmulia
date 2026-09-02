// Pemuat .env ringan tanpa dependensi (server-only).
// Di produksi cPanel, app.cjs sudah memuat .env; modul ini memastikan
// dev server / preview juga membaca .env ke process.env.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  try {
    const file = join(process.cwd(), ".env");
    if (!existsSync(file)) return;
    for (const rawLine of readFileSync(file, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Abaikan kegagalan membaca .env — variabel lingkungan sistem tetap dipakai.
  }
}

loadEnv();
