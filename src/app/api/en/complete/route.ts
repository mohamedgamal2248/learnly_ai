import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { canOpen, getLesson } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";

export const runtime = "nodejs";

const int = (v: unknown, min: number, max: number) => Math.min(Math.max(parseInt(String(v), 10) || 0, min), max);

/** A lesson was finished: XP, daily goal, streak (with freeze), the lesson's words for review, and the words answered wrong. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`done:${s.uid}`, 30, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const lesson = getLesson(String(b?.lessonId || ""));
  if (!lesson) return fail("not_found", 404);
  const st = await loadState(s.uid);
  if (!st || !canOpen(lesson.tier, st.sub.plan)) return fail("locked", 402);
  const own = new Set(lesson.words.map((w) => w.en));
  const missed = Array.isArray(b?.missed) ? Array.from(new Set((b.missed as unknown[]).filter((w): w is string => typeof w === "string" && own.has(w)))) : [];
  const r = await rpc("ln_en_complete2", {
    p_user: s.uid, p_lesson: lesson.id, p_score: int(b?.score, 0, 10), p_total: 10, p_words: lesson.words.map((w) => w.en),
    p_missed: missed, p_correct: int(b?.correct, 0, 40), p_answers: int(b?.answers, 0, 40), p_seconds: int(b?.seconds, 0, 1800),
  });
  return json(r);
}
