import { rpc, setLimitsCache, type Limits } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

const NUM: Record<string, [number, number]> = {
  markup: [1.5, 20], welcome_credits: [0, 1000], free_daily_msgs: [0, 500],
  daily_budget_usd: [0, 1000], max_reserve: [20, 2000], file_fee: [0, 200],
  max_per_minute: [1, 60], daily_credit_cap: [50, 1_000_000],
};

export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return fail("bad_request");
  const patch: Record<string, number | boolean> = {};
  for (const [k, [lo, hi]] of Object.entries(NUM)) {
    if (b[k] !== undefined) {
      const v = Number(b[k]);
      if (!isFinite(v) || v < lo || v > hi) return fail("out_of_range", 400, { field: k, lo, hi });
      patch[k] = v;
    }
  }
  if (typeof b.kill_free === "boolean") patch.kill_free = b.kill_free;
  const value = await rpc<Limits>("ln_set_config", { p_value: patch });
  setLimitsCache(value);
  return json({ config: value });
}
