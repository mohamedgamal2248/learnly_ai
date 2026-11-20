import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "./env";

/** Public origin of this request (works on every domain the project has, behind Vercel's proxy). */
export function originOf(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Signing for OAuth client ids and authorization codes. The key is DERIVED from the session secret on purpose:
 * dynamic client registration is public, so signing with the session key itself would let anyone mint session cookies.
 */
const oauthKey = () => createHmac("sha256", env.sessionSecret).update("learnly-oauth-v1").digest();

export function oauthSign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", oauthKey()).update(body).digest("base64url")}`;
}

export function oauthVerify<T extends { t: string; exp?: number }>(token: unknown, type: string): T | null {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", oauthKey()).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    if (data.t !== type || (data.exp && data.exp < Date.now())) return null;
    return data;
  } catch { return null; }
}

export type OauthClient = { t: "client"; ru: string[]; n: string };
export type AuthCode = { t: "code"; uid: string; ch: string; ru: string; cid: string; exp: number };

/** Redirect URIs must be https, or plain http only for localhost (desktop apps and CLIs). */
export function validRedirect(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 500) return false;
  try {
    const x = new URL(u);
    if (x.hash) return false;
    return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname));
  } catch { return false; }
}

export const newToken = () => `lnt_${randomBytes(32).toString("base64url")}`;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** 8 characters, easy to read and type (no 0/O/1/I). */
export function newLinkCode() {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const normalizeLinkCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

const hits = new Map<string, number[]>();
/** Small per-instance limiter by caller IP, for the public OAuth endpoints. */
export function rateLimitedIp(req: Request, key: string, max: number, windowMs: number) {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const k = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}
