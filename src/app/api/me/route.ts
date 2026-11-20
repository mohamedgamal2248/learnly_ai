import { rpc, type DbUser } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = getSession(req);
  if (!s) return json({ user: null });
  const u = await rpc<DbUser | null>("ln_get_user", { p_user: s.uid });
  return json({ user: u && !u.banned ? u : null });
}
