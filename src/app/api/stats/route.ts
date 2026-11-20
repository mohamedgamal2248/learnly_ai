import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Public platform counters, cached at the edge for 10 minutes. */
export async function GET() {
  try {
    const s = await rpc("ln_public_stats", {});
    return json(s, { cache: "public, s-maxage=600, stale-while-revalidate=3600" });
  } catch {
    return json({ learners: 0, bots: 0, creators: 0, messages: 0 });
  }
}
