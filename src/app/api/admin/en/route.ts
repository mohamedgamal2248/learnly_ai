import { fail, json, requireUser } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { forgetCatalog } from "@/lib/server/pricing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json(await rpc("ln_en_admin_overview"));
}

const num = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

/** kind "catalog": prices, credits, AI costs and the daily cap. kind "grant": give a plan and/or credits to a user. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (b?.kind === "grant") {
    const plan = b.plan === "plus" || b.plan === "pro" ? b.plan : null;
    const r = await rpc("ln_en_admin_grant", { p_username: String(b.username || "").replace(/^@/, "").slice(0, 60), p_plan: plan, p_days: plan ? Math.round(num(b.days, 1, 366) ?? 30) : 0, p_credits: Math.round(num(b.credits, -100000, 100000) ?? 0) });
    return json(r);
  }
  if (b?.kind === "catalog") {
    const c = b.catalog;
    const plans: Record<string, any> = {};
    for (const id of ["plus", "pro"]) {
      const p = c?.plans?.[id];
      const usd = num(p?.usd, 0.5, 1000), days = num(p?.days, 1, 366), credits = num(p?.credits, 0, 100000);
      if (usd === null || days === null || credits === null) return fail("bad_plan");
      plans[id] = { name: id === "plus" ? "Plus" : "Pro", usd, days: Math.round(days), credits: Math.round(credits) };
    }
    const packs = (Array.isArray(c?.packs) ? c.packs : []).slice(0, 6).map((p: any, i: number) => ({ id: `c${i + 1}`, usd: num(p?.usd, 0.5, 1000), credits: Math.round(num(p?.credits, 1, 100000) ?? 0) }));
    if (!packs.length || packs.some((p: any) => p.usd === null || !p.credits)) return fail("bad_pack");
    const costs: Record<string, number> = {};
    for (const k of ["explain", "chat", "correct", "write"]) { const v = num(c?.costs?.[k], 1, 20); if (v === null) return fail("bad_cost"); costs[k] = Math.round(v); }
    const cap = num(c?.ai_daily_cap, 1, 5000);
    if (cap === null) return fail("bad_cap");
    const td = num(c?.trial?.days, 0, 30), tc = num(c?.trial?.credits, 0, 500);
    if (td === null || tc === null) return fail("bad_trial");
    const r = await rpc("ln_en_catalog_set", { p_value: { plans, packs, costs, ai_daily_cap: Math.round(cap), trial: { days: Math.round(td), credits: Math.round(tc) } } });
    forgetCatalog();
    return json(r);
  }
  return fail("bad_request");
}
