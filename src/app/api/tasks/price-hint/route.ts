import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** What similar approved tasks were paid, so a price can be chosen with some evidence. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const delivery = (u.searchParams.get("delivery") || "").slice(0, 10);
  const r = await rpc("ln_price_hint", { p_category: (u.searchParams.get("category") || "").slice(0, 40), p_delivery: ["text", "pdf", "ppt", "image", "file"].includes(delivery) ? delivery : "" });
  return json(r, { cache: "public, s-maxage=60, stale-while-revalidate=300" });
}
