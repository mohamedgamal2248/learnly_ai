import { rpc, getLimits } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";
import { piUsdRate } from "@/lib/server/pricing";

export const runtime = "nodejs";

type F = {
  revenue_pi: number; revenue_usd: number; payments: number; credits_sold: number; credits_welcome: number;
  credits_spent: number; credits_teachers: number; credits_outstanding: number; ai_cost_usd: number;
  ai_cost_30d: number; ai_cost_7d: number; msgs_total: number;
  days: { day: string; cost_usd: number; credits: number; msgs: number }[];
  revenue_days: { day: string; pi: number; usd: number }[];
};

/**
 * Where the money goes. All amounts are in USD, plus Pi at today's OKX rate.
 * - revenue: what users paid in Pi
 * - ai cost: what Meta charges (this is what the API account must be topped up with)
 * - teachers: credits paid to teachers automatically (spendable in the app)
 * - outstanding: credits users still hold; serving them later costs about value / markup
 */
export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const [f, cfg] = await Promise.all([rpc<F>("ln_admin_finance"), getLimits()]);
  let rate: number | null = null;
  try { rate = await piUsdRate(); } catch {}
  const n = (v: unknown) => Number(v) || 0;
  const cu = cfg.credit_usd;
  const aiCost = n(f.ai_cost_usd);
  const outstandingCost = (n(f.credits_outstanding) * cu) / cfg.markup;
  const dailyAvg = n(f.ai_cost_7d) / 7;
  const summary = {
    revenue_usd: n(f.revenue_usd),
    revenue_pi: n(f.revenue_pi),
    ai_cost_usd: aiCost,
    gross_usd: n(f.revenue_usd) - aiCost,
    teachers_credits: n(f.credits_teachers),
    teachers_usd: n(f.credits_teachers) * cu,
    outstanding_credits: n(f.credits_outstanding),
    outstanding_cost_usd: outstandingCost,
    net_usd: n(f.revenue_usd) - aiCost - outstandingCost,
    topup_30d_usd: Math.max(dailyAvg * 30, n(f.ai_cost_30d)) * 1.2 + outstandingCost,
    avg_daily_cost_usd: dailyAvg,
  };
  return json({ raw: f, summary, rate, credit_usd: cu, markup: cfg.markup });
}
