import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { sign } from "@/lib/server/session";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * Step 1 of a task-file download: checks the signed-in user may see the file and returns a signed GET link (10 minutes),
 * because Pi Browser's download manager fetches links itself, without cookies.
 */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`tfile:${a.u.id}`, 60, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const admin = a.u.role === "admin";
  const f = await rpc<{ name: string } | null>("ln_task_file_get", { p_user: a.u.id, p_file: b.id, p_admin: admin });
  if (!f) return fail("not_found", 404);
  const token = sign({ u: a.u.id, f: b.id, a: admin, exp: Date.now() + 10 * 60_000 });
  return json({ url: `/api/tasks/file/${b.id}/${encodeURIComponent(f.name)}?t=${encodeURIComponent(token)}` });
}
