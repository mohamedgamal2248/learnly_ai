import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** A creator asks to withdraw Pi from their earnings. The amount is held now; an admin approves and the Pi is sent. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`withdraw:${a.u.id}`, 5, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const pi = Math.floor(Number(b?.pi) * 1e7) / 1e7;
  if (!(pi > 0 && pi <= 100_000)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; min?: number }>("ln_payout_request", { p_user: a.u.id, p_pi: pi });
  return r.ok ? json({ ok: true, id: r.id, pi }) : fail(r.reason || "bad_request", 400, { min: r.min });
}
