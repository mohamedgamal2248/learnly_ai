import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`block:${a.u.id}`, 30, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.username !== "string") return fail("bad_request");
  const r = await rpc<{ ok: boolean }>("ln_block_set", { p_user: a.u.id, p_username: b.username.slice(0, 60), p_on: b.on !== false });
  return r.ok ? json({ ok: true }) : fail("not_found", 404);
}
