import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { submitTaskResult } from "@/lib/server/tasks";

export const runtime = "nodejs";

/** Manual delivery from the website (text, or a PDF/PowerPoint built from the form). */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`submit:${a.u.id}`, 30, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await submitTaskResult(a.u.id, b.id, b.text, b.file);
  return r.ok ? json({ ok: true, net: r.net }) : fail(r.error.split(":")[0], 400);
}
