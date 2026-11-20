import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Public people search: words match headline, skills, portfolio and the categories someone was paid for. Best rated first. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const ai = u.searchParams.get("ai");
  const limit = Math.min(40, Math.max(1, parseInt(u.searchParams.get("limit") || "20", 10) || 20));
  const people = await rpc("ln_people_search", { p_query: q, p_ai: ai === "ai" || ai === "manual" ? ai : "", p_limit: limit });
  return json({ people }, { cache: "public, s-maxage=30, stale-while-revalidate=120" });
}
