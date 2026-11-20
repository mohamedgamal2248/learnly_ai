import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const s = new URL(req.url).searchParams.get("status") || "";
  return json({ list: await rpc("ln_admin_tasks", { p_status: ["open", "claimed", "submitted", "approved", "cancelled"].includes(s) ? s : "", p_limit: 60 }) });
}

/** Cancels a stuck task and refunds the held reward to the requester. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_admin_task_cancel", { p_task: b.id });
  return r.ok ? json(r) : fail(r.reason || "bad_state");
}
