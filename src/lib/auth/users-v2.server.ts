// Operasi pengguna memakai PostgreSQL sendiri di cPanel dan Lovable Cloud
// selama preview. Keduanya menghasilkan bentuk pengguna yang sama.
import { createClient } from "@supabase/supabase-js";
import { sql, sqlOne } from "../db/pool.server";
import { hashPassword, verifyPassword } from "./password.server";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

type UserRow = {
  id: string;
  email: string;
  encrypted_password: string;
  raw_user_meta_data: Record<string, unknown> | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function useCloudAuth(): boolean {
  return process.env["DATABASE_PROVIDER"]?.trim().toLowerCase() !== "postgres";
}

function cloudPublicClient() {
  const url = process.env["SUPABASE_URL"] || process.env["APP_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["APP_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Konfigurasi Lovable Cloud belum tersedia.");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function cloudAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function findUserByEmail(email: string) {
  return sqlOne<UserRow>(
    `SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE lower(email) = $1`,
    [normalizeEmail(email)],
  );
}

export async function getUserRoles(userId: string): Promise<string[]> {
  if (useCloudAuth()) {
    const cloud = await cloudAdminClient();
    const { data, error } = await cloud.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => String(row.role));
  }
  const rows = await sql<{ role: string }>(`SELECT role::text AS role FROM public.user_roles WHERE user_id = $1`, [
    userId,
  ]);
  return rows.map((r) => r.role);
}

export async function getProfileName(userId: string): Promise<string> {
  if (useCloudAuth()) {
    const cloud = await cloudAdminClient();
    const { data, error } = await cloud.from("profiles").select("name").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.name ?? "";
  }
  const row = await sqlOne<{ name: string }>(`SELECT name FROM public.profiles WHERE id = $1`, [userId]);
  return row?.name ?? "";
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  role?: "buyer" | "agent" | "admin";
}): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Format email tidak valid.");
  if (input.password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");

  if (useCloudAuth()) {
    const cloud = await cloudAdminClient();
    const name = input.name?.trim() || email.split("@")[0] || "Pengguna";
    const { data, error } = await cloud.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name, phone: input.phone?.trim() || null, role: input.role ?? "buyer" },
    });
    if (error || !data.user) {
      if (error?.message.toLowerCase().includes("already")) throw new Error("Email sudah terdaftar. Silakan masuk.");
      throw new Error(error?.message ?? "Gagal membuat akun.");
    }
    const { error: profileError } = await cloud.from("profiles").upsert({
      id: data.user.id,
      name,
      phone: input.phone?.trim() || null,
      is_active: true,
    });
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await cloud.from("user_roles").upsert({
      user_id: data.user.id,
      role: input.role ?? "buyer",
    }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    return { id: data.user.id, email, name, roles: [input.role ?? "buyer"] };
  }

  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email sudah terdaftar. Silakan masuk.");

  const meta = {
    name: input.name?.trim() || email.split("@")[0],
    phone: input.phone?.trim() || null,
    role: input.role ?? "buyer",
  };

  const created = await sqlOne<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
     VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [email, await hashPassword(input.password), JSON.stringify(meta)],
  );
  if (!created) throw new Error("Gagal membuat akun.");

  return { id: created.id, email, name: String(meta.name), roles: await getUserRoles(created.id) };
}

export async function authenticate(email: string, password: string): Promise<AppUser> {
  if (useCloudAuth()) {
    const normalized = normalizeEmail(email);
    const cloud = cloudPublicClient();
    const { data, error } = await cloud.auth.signInWithPassword({ email: normalized, password });
    if (error || !data.user) throw new Error("Email atau kata sandi salah.");
    const admin = await cloudAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("name,is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.is_active === false) throw new Error("Akun Anda dinonaktifkan. Hubungi administrator.");
    return {
      id: data.user.id,
      email: data.user.email ?? normalized,
      name: profile?.name || String(data.user.user_metadata?.["name"] ?? ""),
      roles: await getUserRoles(data.user.id),
    };
  }
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Email atau kata sandi salah.");
  const ok = await verifyPassword(password, user.encrypted_password);
  if (!ok) throw new Error("Email atau kata sandi salah.");

  const active = await sqlOne<{ is_active: boolean }>(`SELECT is_active FROM public.profiles WHERE id = $1`, [
    user.id,
  ]);
  if (active && active.is_active === false) throw new Error("Akun Anda dinonaktifkan. Hubungi administrator.");

  return {
    id: user.id,
    email: user.email,
    name: (await getProfileName(user.id)) || String(user.raw_user_meta_data?.["name"] ?? ""),
    roles: await getUserRoles(user.id),
  };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  if (useCloudAuth()) {
    const admin = await cloudAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error("Akun tidak ditemukan.");
    const publicClient = cloudPublicClient();
    const { error: verifyError } = await publicClient.auth.signInWithPassword({
      email: data.user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error("Kata sandi lama salah.");
    if (newPassword.length < 8) throw new Error("Kata sandi baru minimal 8 karakter.");
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  }
  const row = await sqlOne<UserRow>(
    `SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE id = $1`,
    [userId],
  );
  if (!row) throw new Error("Akun tidak ditemukan.");
  if (!(await verifyPassword(currentPassword, row.encrypted_password))) {
    throw new Error("Kata sandi lama salah.");
  }
  if (newPassword.length < 8) throw new Error("Kata sandi baru minimal 8 karakter.");
  await sql(`UPDATE auth.users SET encrypted_password = $2 WHERE id = $1`, [
    userId,
    await hashPassword(newPassword),
  ]);
  return { ok: true };
}
