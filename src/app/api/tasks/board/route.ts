import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** Open tasks for everyone. Signed-out visitors get a short edge-cached list; signed-in users get theirs (without their own tasks). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = ["summary", "translate", "research", "pdf", "ppt"].includes(u.searchParams.get("kind") || "") ? u.searchParams.get("kind") : null;
  const limit = Math.min(25, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10) || 20));
  const s = getSession(req);
  const tasks = await rpc("ln_task_open_list", { p_user: s?.uid ?? null, p_kind: kind, p_limit: limit });
  return json({ tasks }, { cache: s ? "no-store" : "public, s-maxage=30, stale-while-revalidate=120" });
}
