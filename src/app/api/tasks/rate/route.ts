import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_task_rate", { p_user: a.u.id, p_task: b.id, p_stars: Math.round(Number(b.stars)), p_note: typeof b.note === "string" ? b.note.slice(0, 200) : "" });
  return r.ok ? json(r) : fail(r.reason || "bad_state");
}
