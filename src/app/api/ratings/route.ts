import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** { [botOrCourseId]: { avg, n } } for every rated item. */
export async function GET() {
  const r = await rpc("ln_ratings", {}).catch(() => ({}));
  return json(r, { cache: "public, s-maxage=300, stale-while-revalidate=1800" });
}
