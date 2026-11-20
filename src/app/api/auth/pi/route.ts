import { rpc, type DbUser } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { fail, json, rateLimited } from "@/lib/server/http";
import { piMe } from "@/lib/server/pi";
import { sessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

/** Pi sign-in: the browser sends the Pi access token, we confirm it with Pi, then set our own cookie. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "x";
  if (rateLimited(`auth:${ip}`, 20, 60_000)) return fail("slow_down", 429);
  const body = await req.json().catch(() => null);
  const token = body?.accessToken;
  if (typeof token !== "string" || token.length > 4000) return fail("bad_request");
  let me: { uid: string; username: string };
  try { me = await piMe(token); } catch { return fail("pi_auth_failed", 401); }
  const isAdmin = env.adminUsernames.includes(me.username.toLowerCase());
  const u = await rpc<DbUser>("ln_upsert_user", { p_uid: me.uid, p_username: me.username, p_admin: isAdmin });
  if (u.banned) return fail("banned", 403);
  return json({ user: u }, { headers: { "Set-Cookie": sessionCookie({ uid: u.id, pu: u.pi_uid, n: u.username, r: u.role }) } });
}
