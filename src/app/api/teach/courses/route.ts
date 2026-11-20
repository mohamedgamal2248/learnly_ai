import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { cleanLessons } from "@/lib/server/courses";

export const runtime = "nodejs";

const TRACKS = ["school", "uni", "job", "code", "lang", "academy"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  return json({ courses: await rpc("ln_my_courses", { p_user: a.u.id }) });
}

/** Create or update a course. Every change goes back to admin review. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  if (rateLimited(`savecourse:${a.u.id}`, 20, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad_request");
  const lessons = cleanLessons(b.lessons);
  const course = {
    id: typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : "",
    title: str(b.title, 120), title_en: str(b.title_en, 120),
    description: str(b.description, 600), description_en: str(b.description_en, 600),
    track: TRACKS.includes(b.track) ? b.track : "school",
    price_pi: Math.max(0, Math.min(1000, Math.round((Number(b.price_pi) || 0) * 10000) / 10000)),
    bot_id: typeof b.bot_id === "string" && /^[0-9a-f-]{36}$/i.test(b.bot_id) ? b.bot_id : "",
    lessons,
  };
  if (!(course.title || course.title_en)) return fail("missing_fields");
  if (!lessons.length) return fail("no_lessons");
  if (!course.title) course.title = course.title_en;
  try {
    return json(await rpc("ln_course_save", { p_user: a.u.id, p_course: course }));
  } catch (e: any) {
    return fail(String(e.message).includes("too many") ? "too_many_courses" : "server_error");
  }
}
