import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { saveService } from "@/lib/server/people";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`svc:${a.u.id}`, 20, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const r = await saveService(a.u.id, b || {});
  return r.ok ? json({ ok: true, id: r.id }) : fail(r.error, 400, { why: r.why });
}

export async function DELETE(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean }>("ln_service_remove", { p_user: a.u.id, p_id: id });
  return r.ok ? json({ ok: true }) : fail("not_found", 404);
}
