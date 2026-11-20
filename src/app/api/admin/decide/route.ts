import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** One endpoint for every admin decision: teacher applications, bots and reported posts. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  const approve = b?.approve === true;
  switch (b?.kind) {
    case "app": return json(await rpc("ln_admin_decide_app", { p_app: b.id, p_approve: approve, p_reason: String(b.reason || "").slice(0, 500) || null }));
    case "bot": return json(await rpc("ln_admin_decide_bot", { p_bot: b.id, p_approve: approve }));
    case "post": return json(await rpc("ln_admin_post", { p_post: b.id, p_hide: !approve }));
    default: return fail("bad_request");
  }
}
