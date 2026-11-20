import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { createDeal, dealMessage } from "@/lib/server/people";

export const runtime = "nodejs";
const UUID = /^[0-9a-f-]{36}$/i;

/** GET: my deals; ?id= one deal with its messages; ?unread=1 the number of deals with something new. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  if (u.searchParams.get("unread")) return json({ unread: await rpc("ln_deals_unread", { p_user: a.u.id }) });
  const id = u.searchParams.get("id");
  if (id) {
    if (!UUID.test(id)) return fail("bad_request");
    const d = await rpc("ln_deal_get", { p_user: a.u.id, p_deal: id });
    return d ? json({ deal: d }) : fail("not_found", 404);
  }
  return json({ deals: await rpc("ln_deals_list", { p_user: a.u.id }) });
}

/** action: create | msg | accept | decline. Accepting turns the deal into a task for that person and holds the price from the requester's balance. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`deal:${a.u.id}`, 60, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad_request");
  if (b.action === "create") {
    const r = await createDeal(a.u.id, b);
    return r.ok ? json({ ok: true, id: r.id }) : fail(r.error, 400, { why: r.why });
  }
  if (typeof b.id !== "string" || !UUID.test(b.id)) return fail("bad_request");
  if (b.action === "msg") {
    const r = await dealMessage(a.u.id, b.id, b.body, b.price);
    return r.ok ? json({ ok: true }) : fail(r.error, 400, { why: r.why });
  }
  if (b.action === "accept") {
    const r = await rpc<{ ok: boolean; reason?: string; task_id?: string; balance?: number; mine?: boolean }>("ln_deal_accept", { p_user: a.u.id, p_deal: b.id, p_token: null });
    return r.ok ? json(r) : fail(r.reason || "closed", 400, { balance: r.balance, mine: r.mine });
  }
  if (b.action === "decline") {
    const r = await rpc<{ ok: boolean; reason?: string }>("ln_deal_decline", { p_user: a.u.id, p_deal: b.id });
    return r.ok ? json(r) : fail(r.reason || "closed");
  }
  return fail("bad_request");
}
