import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

/** Free courses: enroll directly. Paid ones go through the Pi payment flow. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean; reason?: string }>("ln_enroll_free", { p_user: s.uid, p_course: b.id });
  return r.ok ? json(r) : fail(r.reason || "bad_request");
}
