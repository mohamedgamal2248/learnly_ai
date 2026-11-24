import { fail, json, rateLimited } from "@/lib/server/http";
import { getCatalog, makeQuotes, piUsdRate } from "@/lib/server/pricing";
import { getSession } from "@/lib/server/session";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

/** Live Pi prices for each plan and credit pack from the OKX PI/USDT ticker, in whole Pi (rounded up). Each quote is signed and valid 10 minutes. Anyone can look; only signed-in people can pay. */
export async function GET(req: Request) {
  if (rateLimited(`quote:${req.headers.get("x-forwarded-for") || "x"}`, 60, 60_000)) return fail("slow_down", 429);
  try {
    const [rate, cat] = await Promise.all([piUsdRate(), getCatalog()]);
    const s = getSession(req);
    const plan = s ? await rpc<string | null>("ln_en_sub_plan", { p_user: s.uid }).catch(() => null) : null;
    return json({ rate, ...makeQuotes(rate, cat), costs: cat.costs, plan });
  } catch {
    return fail("price_unavailable", 503);
  }
}
