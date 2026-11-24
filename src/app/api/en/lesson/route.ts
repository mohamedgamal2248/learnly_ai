import { fail, json } from "@/lib/server/http";
import { loadState, nativeFrom } from "@/lib/server/learn/api";
import { allWords, canOpen, getLesson, nextLesson } from "@/lib/server/learn";
import { buildExercises } from "@/lib/server/learn/exercises";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** One lesson with its practice questions. Free lessons are open to everyone; the rest need the right plan. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const lesson = getLesson(id);
  if (!lesson) return fail("not_found", 404);
  const s = getSession(req);
  const st = s ? await loadState(s.uid).catch(() => null) : null;
  if (!canOpen(lesson.tier, st?.sub.plan)) return fail("locked", 402, { tier: lesson.tier, title: lesson.title });
  const native = nativeFrom(req, st);
  const pool = allWords().filter((w) => !lesson.words.includes(w));
  return json({
    id: lesson.id, level: lesson.level, tier: lesson.tier, title: lesson.title, titleTr: lesson.titleTr[native],
    intro: lesson.intro[native], native,
    words: lesson.words.map((w) => ({ en: w.en, tr: w.tr[native], ex: w.ex, exTr: w.exTr[native] })),
    exercises: buildExercises(lesson, native, pool),
    next: nextLesson(id),
    canAi: !!st?.sub.plan,
  });
}
