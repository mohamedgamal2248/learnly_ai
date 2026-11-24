import { json } from "@/lib/server/http";
import { canOpen, LESSONS } from "@/lib/server/learn";
import { loadState, nativeFrom } from "@/lib/server/learn/api";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** Search lessons and words, in English or in the learner's language. Words of lessons the plan does not open show without their meaning. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").toLowerCase().trim().slice(0, 40);
  if (q.length < 2) return json({ results: [] });
  const s = getSession(req);
  const st = s ? await loadState(s.uid).catch(() => null) : null;
  const native = nativeFrom(req, st);
  const out: { kind: "lesson" | "word"; id: string; title: string; sub: string; locked: boolean; tier: string }[] = [];
  for (const l of LESSONS) {
    const locked = !canOpen(l.tier, st?.sub.plan);
    if (l.title.toLowerCase().includes(q) || l.titleTr[native].toLowerCase().includes(q)) out.push({ kind: "lesson", id: l.id, title: l.title, sub: l.titleTr[native], locked, tier: l.tier });
    for (const w of l.words) {
      if (out.length >= 30) break;
      if (w.en.toLowerCase().includes(q) || w.tr[native].toLowerCase().includes(q)) out.push({ kind: "word", id: l.id, title: w.en, sub: locked ? "" : w.tr[native], locked, tier: l.tier });
    }
  }
  return json({ results: out.slice(0, 30) });
}
