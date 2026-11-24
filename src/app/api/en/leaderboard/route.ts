import { fail, json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  return json(await rpc("ln_en_leaderboard", { p_user: s.uid, p_limit: 20 }));
}

/** Hide (or show again) my name in the weekly ranking. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  if (typeof b?.hide !== "boolean") return fail("bad_request");
  return json(await rpc("ln_en_rank_hide", { p_user: s.uid, p_hide: b.hide }));
}
