import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json({ courses: await rpc("ln_admin_courses", {}) });
}

export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id) || !["live", "rejected", "paused", "review"].includes(b.status)) return fail("bad_request");
  return json(await rpc("ln_admin_course_status", { p_course: b.id, p_status: b.status }));
}
