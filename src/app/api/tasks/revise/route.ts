import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`revise:${a.u.id}`, 30, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_task_revise", { p_user: a.u.id, p_task: b.id, p_note: typeof b.note === "string" ? b.note.slice(0, 500) : "" });
  return r.ok ? json(r) : fail(r.reason || "bad_state");
}
