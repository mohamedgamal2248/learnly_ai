import { fail, json, requireSession } from "@/lib/server/http";
import { makeQuotes, piUsdRate } from "@/lib/server/pricing";

export const runtime = "nodejs";

/** Live Pi prices for each credit pack, from the OKX PI/USDT ticker. Each quote is signed and valid 10 minutes. */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  try {
    const rate = await piUsdRate();
    return json({ rate, quotes: makeQuotes(rate) });
  } catch {
    return fail("price_unavailable", 503);
  }
}
