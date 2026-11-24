import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

export type Session = { uid: string; pu: string; n: string; r: "user" | "teacher" | "admin"; exp: number };

const COOKIE = "ln_s";
const MAX_AGE = 60 * 60 * 24 * 30;

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

export function sign(payload: object): string {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", env.sessionSecret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", env.sessionSecret).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp?: number };
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function getSession(req: Request): Session | null {
  const s = verify<Session>(readCookie(req, COOKIE));
  // Other signed tokens (price quotes, download links) share the secret; only a real login payload is accepted here.
  if (!s || typeof s.uid !== "string" || typeof s.pu !== "string" || (s as unknown as { t?: unknown }).t !== undefined) return null;
  return s;
}

export function sessionCookie(s: Omit<Session, "exp">) {
  const token = sign({ ...s, exp: Date.now() + MAX_AGE * 1000 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${MAX_AGE}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
