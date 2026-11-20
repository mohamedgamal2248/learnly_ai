import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";
import { forgetBot } from "@/lib/server/bots";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/** One endpoint for every admin decision: teachers, bots, posts and user bans. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  const approve = b?.approve === true;
  switch (b?.kind) {
    case "app":
      if (!UUID.test(b.id)) return fail("bad_request");
      return json(await rpc("ln_admin_decide_app", { p_app: b.id, p_approve: approve, p_reason: String(b.reason || "").slice(0, 500) || null }));
    case "bot":
      if (!UUID.test(b.id)) return fail("bad_request");
      forgetBot(b.id);
      return json(await rpc("ln_admin_decide_bot", { p_bot: b.id, p_approve: approve }));
    case "bot_status":
      if (!UUID.test(b.id) || !["live", "paused", "rejected", "review"].includes(b.status)) return fail("bad_request");
      forgetBot(b.id);
      return json(await rpc("ln_admin_bot_status", { p_bot: b.id, p_status: b.status }));
    case "post":
      if (!Number.isInteger(b.id)) return fail("bad_request");
      return json(await rpc("ln_admin_post", { p_post: b.id, p_hide: !approve }));
    case "ban":
      if (!UUID.test(b.id)) return fail("bad_request");
      return json(await rpc("ln_admin_ban", { p_user: b.id, p_banned: b.banned === true }));
    default:
      return fail("bad_request");
  }
}
