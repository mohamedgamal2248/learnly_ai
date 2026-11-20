import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** Which first steps this person has done (headline, showcase, AI connected, funded, first task). */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  return json(await rpc("ln_onboarding", { p_user: a.u.id }));
}
