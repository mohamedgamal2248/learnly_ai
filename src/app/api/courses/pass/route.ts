import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { issueCert } from "@/lib/server/certs";
import type { CourseRaw } from "@/lib/server/courses";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Grades a lesson quiz on the server. When every lesson is passed, the course certificate is issued. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`pass:${s.uid}`, 60, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (typeof b?.courseId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.courseId) || typeof b?.lessonId !== "string") return fail("bad_request");
  const c = await rpc<CourseRaw | null>("ln_course_raw", { p_course: b.courseId });
  const lesson = c?.lessons.find((l) => l.id === b.lessonId);
  if (!c || !lesson) return fail("not_found", 404);
  const answers: unknown[] = Array.isArray(b.answers) ? b.answers : [];
  const wrong = lesson.quiz.flatMap((q, i) => (answers[i] === q.answer ? [] : [i]));
  if (wrong.length) return json({ ok: false, wrong });
  const r = await rpc<{ ok: boolean; reason?: string; completed?: boolean; progress?: Record<string, boolean> }>("ln_course_pass", {
    p_user: s.uid, p_course: c.id, p_lesson: lesson.id,
  });
  if (!r.ok) return fail(r.reason || "not_enrolled", 403);
  let certId: string | null = null;
  if (r.completed) {
    const cert = await issueCert(s.uid, "course", c.id, c.title, c.title_en || c.title, 100);
    certId = cert.id;
  }
  return json({ ok: true, progress: r.progress, completed: r.completed, certId });
}
