import "server-only";
import raw from "./data/lessons.json";
import type { Lesson, Native, Tier, Unit, Word } from "./types";

type RawLesson = Omit<Lesson, "tier">;
const data = raw as unknown as { units: (Unit & { lessons: string[] })[]; lessons: RawLesson[] };

/** The first six lessons are free, the rest of A1 and A2 need Plus, B1 needs Pro. */
const FREE_LESSONS = 6;
const tierOf = (l: RawLesson): Tier => (l.n <= FREE_LESSONS ? "free" : l.level === "B1" ? "pro" : "plus");

export const UNITS: Unit[] = data.units.map(({ lessons: _l, ...u }) => u);
export const LESSONS: Lesson[] = data.lessons.map((l) => ({ ...l, tier: tierOf(l) }));
const byId = new Map(LESSONS.map((l) => [l.id, l]));
export const getLesson = (id: string) => byId.get(id) || null;
export const nextLesson = (id: string) => { const i = LESSONS.findIndex((l) => l.id === id); return i >= 0 ? LESSONS[i + 1]?.id || null : null; };
export const allWords = (): Word[] => LESSONS.flatMap((l) => l.words);
const wordIndex = new Map(allWords().map((w) => [w.en.toLowerCase(), w]));
export const findWord = (en: string): Word | null => wordIndex.get(en.toLowerCase()) || null;

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
