import { json, rateLimited, requireSession, fail } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

/** One free Plus trial per person (days and credits are set in the admin catalog). */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`trial:${s.uid}`, 5, 600_000)) return fail("slow_down", 429);
  return json(await rpc("ln_en_trial_start", { p_user: s.uid }));
}
