import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 60) || null;
  const page = Math.max(0, parseInt(u.searchParams.get("page") || "0", 10) || 0);
  return json(await rpc("ln_admin_users2", { p_search: q, p_limit: 30, p_offset: page * 30 }));
}
