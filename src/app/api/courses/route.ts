import { rpc } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** Live course catalogue, or one course (lessons unlocked for enrolled learners, never the quiz answers). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ courses: await rpc("ln_courses_list", {}) }, { cache: "public, s-maxage=60, stale-while-revalidate=300" });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const s = getSession(req);
  const c = await rpc("ln_course_get", { p_user: s?.uid ?? null, p_course: id });
  return c ? json({ course: c }) : fail("not_found", 404);
}
