import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** Marketplace numbers for the admin overview: volume, fees, held money, top-ups, users, disputes. */
export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json(await rpc("ln_admin_market", {}));
}
