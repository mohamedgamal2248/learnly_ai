import "server-only";
import type { Lesson, Native, Tier, Unit, Word } from "./types";
import { UNITS as U1, LESSONS as L1 } from "./content/a1";
import { UNITS as U2, LESSONS as L2 } from "./content/a2";
import { UNITS as U3, LESSONS as L3 } from "./content/b1";

export const UNITS: Unit[] = [...U1, ...U2, ...U3];
export const LESSONS: Lesson[] = [...L1, ...L2, ...L3];
const byId = new Map(LESSONS.map((l) => [l.id, l]));
export const getLesson = (id: string) => byId.get(id) || null;
export const nextLesson = (id: string) => { const i = LESSONS.findIndex((l) => l.id === id); return i >= 0 ? LESSONS[i + 1]?.id || null : null; };
export const allWords = (): Word[] => LESSONS.flatMap((l) => l.words);
export function findWord(en: string): Word | null {
  const q = en.toLowerCase();
  for (const l of LESSONS) { const w = l.words.find((x) => x.en.toLowerCase() === q); if (w) return w; }
  return null;
}

/** Which plans can open a lesson. Free lessons are open to everyone (even without an account). */
const RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };
export const canOpen = (tier: Tier, plan: "plus" | "pro" | null | undefined) => RANK[tier] <= RANK[plan || "free"];

/** Lesson list for the path screen: titles in the learner's language, no lesson content. */
export function catalogFor(native: Native, plan: "plus" | "pro" | null | undefined) {
  return {
    units: UNITS.map((u) => ({ id: u.id, level: u.level, title: u.title, titleTr: u.titleTr[native], icon: u.icon })),
    lessons: LESSONS.map((l) => ({ id: l.id, n: l.n, unit: l.unit, level: l.level, title: l.title, titleTr: l.titleTr[native], tier: l.tier, words: l.words.length, locked: !canOpen(l.tier, plan) })),
  };
}
