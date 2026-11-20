import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** Open tasks for everyone, with search, filters and paging. Signed-out visitors get a short edge-cached answer. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const g = (k: string, n: number) => (u.searchParams.get(k) || "").trim().slice(0, n);
  const delivery = ["text", "pdf", "ppt", "image", "file"].includes(g("delivery", 10)) ? g("delivery", 10) : "";
  const sort = g("sort", 10) === "reward" ? "reward" : "new";
  const limit = Math.min(40, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10) || 20));
  const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0", 10) || 0);
  const min = Math.max(0, Number(u.searchParams.get("min")) || 0);
  const s = getSession(req);
  const r = await rpc<{ tasks: unknown[]; total: number }>("ln_task_open_list3", {
    p_user: s?.uid ?? null, p_category: g("category", 40), p_q: g("q", 80), p_min: min, p_delivery: delivery, p_sort: sort, p_limit: limit, p_offset: offset,
  });
  return json(r, { cache: s ? "no-store" : "public, s-maxage=30, stale-while-revalidate=120" });
}
