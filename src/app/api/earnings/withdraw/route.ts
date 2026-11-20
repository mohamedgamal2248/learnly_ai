import { rpc, getLimits } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { piUsdRate } from "@/lib/server/pricing";

export const runtime = "nodejs";

/** A creator asks to turn earned credits into Pi. Credits are held now; an admin approves and the Pi is sent. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  if (rateLimited(`withdraw:${a.u.id}`, 5, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const credits = Math.floor(Number(b?.credits));
  if (!(credits > 0 && credits <= 10_000_000)) return fail("bad_request");
  let rate: number;
  try { rate = await piUsdRate(); } catch { return fail("price_unavailable", 503); }
  const cfg = await getLimits();
  const pi = Math.floor(((credits * cfg.credit_usd) / rate) * 1e7) / 1e7;
  if (!(pi > 0)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; min?: number }>("ln_withdraw_request", {
    p_user: a.u.id, p_credits: credits, p_pi: pi, p_rate: rate,
  });
  return r.ok ? json({ ok: true, id: r.id, pi }) : fail(r.reason || "bad_request", 400, { min: r.min });
}
