import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { canOpen, getLesson } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";

export const runtime = "nodejs";

/** A lesson was finished: XP, daily streak and the lesson's words go to the learner's review list. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`done:${s.uid}`, 30, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const lesson = getLesson(String(b?.lessonId || ""));
  if (!lesson) return fail("not_found", 404);
  const st = await loadState(s.uid);
  if (!st || !canOpen(lesson.tier, st.sub.plan)) return fail("locked", 402);
  const total = 10;
  const score = Math.min(Math.max(parseInt(b?.score, 10) || 0, 0), total);
  const r = await rpc("ln_en_complete", { p_user: s.uid, p_lesson: lesson.id, p_score: score, p_total: total, p_words: lesson.words.map((w) => w.en) });
  return json(r);
}
