import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";
import { saveProfile } from "@/lib/server/people";

export const runtime = "nodejs";

/** ?name=<username> returns a public profile with its portfolio and reviews. */
export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get("name") || "").trim().slice(0, 60);
  if (!name) return fail("bad_request");
  const s = getSession(req);
  const p = await rpc("ln_profile_get", { p_viewer: s?.uid ?? null, p_username: name });
  return p ? json({ profile: p }) : fail("not_found", 404);
}

export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`profile:${a.u.id}`, 20, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const r = await saveProfile(a.u.id, b || {});
  return r.ok ? json({ ok: true }) : fail(r.error, 400, { why: r.why });
}
