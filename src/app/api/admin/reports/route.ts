import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json({ list: await rpc("ln_admin_reports", {}) });
}

/** Close a report ("done" after acting, or "dismissed"). Banning goes through the users tab. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id) || !["done", "dismissed"].includes(b.status)) return fail("bad_request");
  const r = await rpc<{ ok: boolean }>("ln_admin_report_set", { p_id: b.id, p_status: b.status });
  return r.ok ? json(r) : fail("not_found", 404);
}
