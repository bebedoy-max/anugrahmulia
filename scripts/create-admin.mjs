// Membuat / mereset akun admin langsung ke PostgreSQL.
// Pakai:  npm run admin:create -- admin@domain.com "KataSandiKuat" "Nama Admin"
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const scrypt = promisify(scryptCb);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(join(process.cwd(), ".env"));

const [email, password, name = "Administrator"] = process.argv.slice(2);
if (!email || !password) {
  console.error('Pakai: npm run admin:create -- admin@domain.com "KataSandiKuat" "Nama Admin"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("hex")}$${(await scrypt(password, salt, 64)).toString("hex")}`;

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
      },
);

const lower = email.trim().toLowerCase();
const meta = JSON.stringify({ name, role: "admin" });

const { rows } = await pool.query(
  `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
   VALUES ($1, $2, $3::jsonb)
   ON CONFLICT (email) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, updated_at = now()
   RETURNING id`,
  [lower, hash, meta],
);
const id = rows[0].id;

await pool.query(
  `INSERT INTO public.profiles (id, name) VALUES ($1, $2)
   ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true`,
  [id, name],
);
await pool.query(
  `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')
   ON CONFLICT (user_id, role) DO NOTHING`,
  [id],
);

console.log(`Akun admin siap: ${lower} (id ${id})`);
await pool.end();
