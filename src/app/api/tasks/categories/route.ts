import { rpc } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Categories with open tasks, built from what people actually posted. Same for everyone, so it's edge-cached briefly. */
export async function GET() {
  const categories = await rpc("ln_task_categories", {}).catch(() => []);
  return json({ categories }, { cache: "public, s-maxage=20, stale-while-revalidate=120" });
}
