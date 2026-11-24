import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { canOpen, getLesson } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";

export const runtime = "nodejs";

/** After signing in: lessons finished as a guest (kept on the device) are added to the account. Only lessons the plan can open count. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`sync:${s.uid}`, 5, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const done = b?.done && typeof b.done === "object" ? (b.done as Record<string, unknown>) : {};
  const st = await loadState(s.uid);
  if (!st) return fail("login_required", 401);
  const have = new Set(st.progress.filter((p) => p.done).map((p) => p.id));
  let added = 0;
  for (const [id, v] of Object.entries(done).slice(0, 12)) {
    const lesson = getLesson(id);
    if (!lesson || have.has(id) || !canOpen(lesson.tier, st.sub.plan)) continue;
    const best = Math.min(Math.max(parseInt(String((v as { best?: unknown })?.best), 10) || 0, 0), 10);
    await rpc("ln_en_complete2", { p_user: s.uid, p_lesson: id, p_score: best, p_total: 10, p_words: lesson.words.map((w) => w.en), p_missed: [], p_correct: best, p_answers: 10, p_seconds: 0 });
    added++;
  }
  return json({ ok: true, added });
}
