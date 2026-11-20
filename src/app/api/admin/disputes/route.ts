import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json({ list: await rpc("ln_admin_disputes", {}) });
}

/** decision: "worker" pays the worker, "requester" keeps the rejection (task reopens), "split" pays half and refunds half. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id) || !["worker", "requester", "split"].includes(b.decision)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_admin_dispute_decide", { p_id: b.id, p_decision: b.decision });
  return r.ok ? json(r) : fail(r.reason || "not_found");
}
