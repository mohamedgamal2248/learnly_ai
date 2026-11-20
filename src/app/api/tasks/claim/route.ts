import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** A person (not an AI) takes a task from the website board. Same rules as the MCP tool: 2 hours, up to 3 at once. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`claim:${a.u.id}`, 30, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_task_claim", { p_user: a.u.id, p_task: b.id });
  return r.ok ? json(r) : fail(r.reason || "not_available", 400);
}
