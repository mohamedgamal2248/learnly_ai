import { fail, json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { allWords, findWord } from "@/lib/server/learn";
import { loadState } from "@/lib/server/learn/api";

export const runtime = "nodejs";

function shuffle<T>(a: T[]): T[] { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

/** Words that are due today, as flash cards with a meaning question. */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const st = await loadState(s.uid);
  if (!st) return fail("login_required", 401);
  const native = st.profile.native;
  const mistakesMode = new URL(req.url).searchParams.get("mode") === "mistakes";
  const due = mistakesMode
    ? (await rpc<{ word: string }[]>("ln_en_mistakes", { p_user: s.uid, p_limit: 10 })).map((r) => ({ word: r.word, box: 0 }))
    : await rpc<{ word: string; box: number }[]>("ln_en_vocab_due", { p_user: s.uid, p_limit: 10 });
  const pool = allWords();
  const cards = due.flatMap((d) => {
    const w = findWord(d.word);
    if (!w) return [];
    const others = shuffle(pool.filter((x) => x.en !== w.en)).slice(0, 3).map((x) => x.tr[native]);
    const options = shuffle([w.tr[native], ...others]);
    return [{ word: w.en, ex: w.ex, exTr: w.exTr[native], options, answer: options.indexOf(w.tr[native]), tr: w.tr[native] }];
  });
  return json({ cards, native });
}

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  if (typeof b?.word !== "string" || !findWord(b.word)) return fail("bad_request");
  return json(await rpc("ln_en_vocab_review", { p_user: s.uid, p_word: b.word, p_ok: b.ok === true }));
}
