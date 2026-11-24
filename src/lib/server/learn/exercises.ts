import type { Lesson, Native, Word } from "./types";
import { audioId } from "./audio";

/** `w` is the lesson word the question is about, so wrong answers can be tracked per word. */
export type Exercise =
  | { t: "pick"; w: string; q: string; speak?: string; au?: string; options: string[]; answer: number; dir?: "rtl" }
  | { t: "fill"; w: string; q: string; hint: string; options: string[]; answer: number }
  | { t: "order"; w: string; hint: string; words: string[]; answer: string };

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function sample<T>(a: T[], n: number): T[] { return shuffle(a).slice(0, n); }

function choices(correct: string, pool: string[], n = 4): { options: string[]; answer: number } {
  const others = sample(Array.from(new Set(pool.filter((p) => p && p !== correct))), n - 1);
  const options = shuffle([correct, ...others]);
  return { options, answer: options.indexOf(correct) };
}

/** Builds ~10 practice questions from a lesson's own words, in the learner's language. `pool` supplies wrong answers from other lessons. */
export function buildExercises(lesson: Lesson, native: Native, pool: Word[]): Exercise[] {
  const words = lesson.words;
  const trPool = [...words.map((w) => w.tr[native]), ...pool.map((w) => w.tr[native])];
  const enPool = [...words.map((w) => w.en), ...pool.map((w) => w.en)];
  const blankOf = (w: Word) => w.blank || w.en;
  const blankPool = [...words.map(blankOf), ...pool.map(blankOf)];
  const out: Exercise[] = [];
  const order = shuffle(words);

  // English → meaning (read), then listen → meaning
  order.slice(0, 3).forEach((w) => out.push({ t: "pick", w: w.en, q: w.en, au: audioId(w.en), ...choices(w.tr[native], trPool) }));
  order.slice(3, 5).forEach((w) => out.push({ t: "pick", w: w.en, q: "listen", speak: w.en, au: audioId(w.en), ...choices(w.tr[native], trPool) }));
  // Meaning → English
  sample(words, 2).forEach((w) => out.push({ t: "pick", w: w.en, q: w.tr[native], dir: native === "ar" ? "rtl" : undefined, ...choices(w.en, enPool) }));
  // Fill the blank in the example sentence
  const fillable = words.filter((w) => w.ex.toLowerCase().includes(blankOf(w).toLowerCase()));
  sample(fillable, 2).forEach((w) => {
    const b = blankOf(w);
    const i = w.ex.toLowerCase().indexOf(b.toLowerCase());
    const q = w.ex.slice(0, i) + "___" + w.ex.slice(i + b.length);
    out.push({ t: "fill", w: w.en, q, hint: w.exTr[native], ...choices(w.ex.slice(i, i + b.length), blankPool) });
  });
  // Put the words of an example sentence in order
  const orderable = words.filter((w) => { const n = w.ex.replace(/[.?!]/g, "").split(/\s+/).length; return n >= 3 && n <= 9; });
  sample(orderable, 1).forEach((w) => {
    const tokens = w.ex.replace(/[.?!]$/, "").split(/\s+/);
    out.push({ t: "order", w: w.en, hint: w.exTr[native], words: shuffle(tokens), answer: tokens.join(" ") });
  });
  return shuffle(out).slice(0, 10);
}
