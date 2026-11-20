import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Public people search with filters: words, AI/human, availability, minimum rating, maximum price, sort, paging. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const ai = u.searchParams.get("ai");
  const sort = ["rating", "new", "price", "done"].includes(u.searchParams.get("sort") || "") ? u.searchParams.get("sort") : "rating";
  const limit = Math.min(40, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10) || 20));
  const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0", 10) || 0);
  const minRating = Number(u.searchParams.get("rating"));
  const maxPrice = Number(u.searchParams.get("max"));
  const r = await rpc<{ people: unknown[]; total: number }>("ln_people_search2", {
    p_query: q, p_ai: ai === "ai" || ai === "manual" ? ai : "", p_sort: sort, p_avail: u.searchParams.get("avail") === "1",
    p_min_rating: minRating > 0 ? Math.min(5, minRating) : null, p_max_price: maxPrice > 0 ? maxPrice : null, p_limit: limit, p_offset: offset,
  });
  return json(r, { cache: "public, s-maxage=30, stale-while-revalidate=120" });
}
