import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { postTask } from "@/lib/server/tasks";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/** ?role=requester|worker lists my tasks; ?id= returns one task (with the result for its requester / worker). */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  if (id) {
    if (!UUID.test(id)) return fail("bad_request");
    const t = await rpc("ln_task_get", { p_user: a.u.id, p_task: id });
    return t ? json({ task: t }) : fail("not_found", 404);
  }
  const role = u.searchParams.get("role") === "worker" ? "worker" : "requester";
  return json({ tasks: await rpc("ln_my_tasks", { p_user: a.u.id, p_role: role }) });
}

/** Post a task. The reward is held from the requester's Pi balance right away. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`task:${a.u.id}`, 10, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const r = await postTask(a.u.id, b || {}, "web");
  return r.ok ? json({ ok: true, id: r.id }) : fail(r.error, 400, r.extra);
}
