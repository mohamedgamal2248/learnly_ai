import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const [app, bots] = await Promise.all([
    rpc("ln_my_app", { p_user: a.u.id }),
    a.u.role === "user" ? Promise.resolve([]) : rpc("ln_my_bots", { p_user: a.u.id }),
  ]);
  return json({ user: a.u, app, bots });
}
