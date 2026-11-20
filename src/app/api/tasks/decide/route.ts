import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** Requester approves (pays the worker) or rejects (task reopens for someone else). */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`decide:${a.u.id}`, 40, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string; paid?: number }>("ln_task_decide", {
    p_user: a.u.id, p_task: b.id, p_approve: b.approve === true, p_note: typeof b.note === "string" ? b.note.slice(0, 300) : "",
  });
  return r.ok ? json(r) : fail(r.reason || "bad_state");
}
