import { json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  return json(await rpc("ln_en_stats", { p_user: s.uid }));
}
