import { json, requireUser } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const st = new URL(req.url).searchParams.get("status");
  return json({ apps: await rpc("ln_en_admin_apps", { p_status: ["pending", "approved", "rejected"].includes(st || "") ? st : null }) });
}
