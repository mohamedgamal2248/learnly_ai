import "server-only";
import { getSession, type Session } from "./session";
import { rpc, type DbUser } from "./db";

export function json(data: unknown, init: ResponseInit & { cache?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cache || "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function fail(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ error: code, ...extra }, { status });
}

export function requireSession(req: Request): Session | Response {
  const s = getSession(req);
  return s ? s : fail("login_required", 401);
}

/** Re-reads the user from the database so roles and bans are never taken from an old cookie. */
export async function requireUser(req: Request, roles?: DbUser["role"][]): Promise<{ s: Session; u: DbUser } | Response> {
  const s = getSession(req);
  if (!s) return fail("login_required", 401);
  const u = await rpc<DbUser | null>("ln_get_user", { p_user: s.uid });
  if (!u) return fail("login_required", 401);
  if (u.banned) return fail("banned", 403);
  if (roles && !roles.includes(u.role)) return fail("forbidden", 403);
  return { s, u };
}

/** Tiny per-instance rate limiter. Good enough to stop bursts without a database write. */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}
