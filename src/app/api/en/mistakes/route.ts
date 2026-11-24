import { json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { findWord } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";
import { audioId } from "@/lib/server/learn/audio";

export const runtime = "nodejs";

/** Words the learner got wrong, with their meaning in the learner's language. */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const st = await loadState(s.uid);
  const native = st?.profile.native || "ar";
  const rows = await rpc<{ word: string; missed: number; last: string; due: string }[]>("ln_en_mistakes", { p_user: s.uid, p_limit: 60 });
  return json({ words: rows.flatMap((r) => { const w = findWord(r.word); return w ? [{ ...r, au: audioId(w.en), tr: w.tr[native], ex: w.ex, exTr: w.exTr[native] }] : []; }) });
}
