import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  return json({ list: await rpc("ln_recurring_list", { p_user: a.u.id }) });
}

/** Stops a repeating task (tasks already posted are not touched). */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean }>("ln_recurring_stop", { p_user: a.u.id, p_id: b.id });
  return r.ok ? json({ ok: true }) : fail("not_found", 404);
}
