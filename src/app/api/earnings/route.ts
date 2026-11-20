import { rpc, getLimits } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";
import { piUsdRate } from "@/lib/server/pricing";

export const runtime = "nodejs";

/** A creator's earnings, what can be withdrawn now, and past withdrawals. */
export async function GET(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  const [e, cfg, rate] = await Promise.all([
    rpc<Record<string, unknown>>("ln_my_earnings", { p_user: a.u.id }),
    getLimits(),
    piUsdRate().catch(() => 0),
  ]);
  if (!e) return fail("not_found", 404);
  return json({ ...e, creditUsd: cfg.credit_usd, rate });
}
