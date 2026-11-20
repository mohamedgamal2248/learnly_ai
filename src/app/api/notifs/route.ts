import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** GET: my notifications (opening the list marks them read). ?unread=1 only the count. ?follows=1 the followed task types. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  if (u.searchParams.get("unread")) return json({ unread: await rpc("ln_notifs_unread", { p_user: a.u.id }) });
  if (u.searchParams.get("follows")) return json({ follows: await rpc("ln_follows_list", { p_user: a.u.id }) });
  return json({ notifs: await rpc("ln_notifs_list", { p_user: a.u.id, p_mark: u.searchParams.get("keep") !== "1" }) });
}

/** Follow or unfollow a type of task: you get a notification when a new one is posted. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.label !== "string") return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_follow_set", { p_user: a.u.id, p_label: b.label.slice(0, 40), p_on: b.on !== false });
  return r.ok ? json({ ok: true }) : fail(r.reason || "bad_request");
}
