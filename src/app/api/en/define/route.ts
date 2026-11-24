import { fail, json } from "@/lib/server/http";
import { canOpen, LESSONS } from "@/lib/server/learn";
import { loadState, nativeFrom } from "@/lib/server/learn/api";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

const index = new Map<string, { lessonId: string; tier: "free" | "plus" | "pro"; wi: number }>();
for (const l of LESSONS) l.words.forEach((w, wi) => {
  for (const k of [w.en, w.blank || ""]) { const key = k.toLowerCase().trim(); if (key && !index.has(key)) index.set(key, { lessonId: l.id, tier: l.tier, wi }); }
});
const forms = (w: string) => [w, w.replace(/(ies)$/, "y"), w.replace(/(es|s)$/, ""), w.replace(/(ed|d)$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e")];

/** Tap a word in a lesson: its meaning in the learner's language, from the course's own words (only lessons the plan opens). */
export async function GET(req: Request) {
  const word = (new URL(req.url).searchParams.get("w") || "").toLowerCase().trim().slice(0, 40);
  if (!/^[a-z' -]+$/.test(word)) return fail("bad_request");
  let hit: { lessonId: string; tier: "free" | "plus" | "pro"; wi: number } | undefined;
  for (const f of forms(word)) { hit = index.get(f); if (hit) break; }
  if (!hit) return json({ found: false, word });
  const s = getSession(req);
  const st = s ? await loadState(s.uid).catch(() => null) : null;
  if (!canOpen(hit.tier, st?.sub.plan)) return json({ found: true, locked: true, word });
  const native = nativeFrom(req, st);
  const lesson = LESSONS.find((l) => l.id === hit!.lessonId)!;
  const w = lesson.words[hit.wi];
  return json({ found: true, word: w.en, tr: w.tr[native], ex: w.ex, exTr: w.exTr[native], lesson: lesson.title });
}
