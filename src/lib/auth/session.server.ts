// Sesi admin: token HMAC yang disimpan di cookie HttpOnly.
import "../env.server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getCookie,
  setCookie,
  deleteCookie,
  getRequestHeader,
  getRequestProtocol,
} from "@tanstack/react-start/server";

export const SESSION_COOKIE = "am_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { sub: string; email: string; name: string; exp: number };

function secret(): string {
  // Preview Lovable Cloud tidak memerlukan DATABASE_URL/.env mandiri. Gunakan
  // secret backend yang stabil sebagai fallback; deployment cPanel tetap wajib
  // memakai AUTH_SECRET miliknya sendiri.
  const value =
    process.env["AUTH_SECRET"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"];
  if (!value || value.length < 16) {
    throw new Error("Konfigurasi sesi belum tersedia.");
  }
  return value;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf8")) as SessionPayload;
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Cookie ditandai `Secure` hanya bila permintaan benar-benar datang lewat HTTPS.
// Di cPanel/Passenger, TLS diterminasi Apache/LiteSpeed lalu diteruskan sebagai
// http ke Node, jadi protokol asli dibaca dari header X-Forwarded-Proto.
function isHttpsRequest(): boolean {
  try {
    const forwarded = getRequestHeader("x-forwarded-proto");
    if (forwarded) return forwarded.split(",")[0]!.trim().toLowerCase() === "https";
    return getRequestProtocol() === "https";
  } catch {
    return process.env["NODE_ENV"] === "production";
  }
}

export function setSessionCookie(token: string) {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttpsRequest(),
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export function readSession(): SessionPayload | null {
  return verifySessionToken(getCookie(SESSION_COOKIE));
}
