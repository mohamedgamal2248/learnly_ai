import { rpc } from "@/lib/server/db";
import { json, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

/** Streak, enrolled courses, certificates, mistakes to review and the saved study plan. */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  return json(await rpc("ln_learning", { p_user: s.uid }));
}
