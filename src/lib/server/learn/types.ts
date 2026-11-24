export const NATIVES = ["ar", "id", "vi", "ko"] as const;
export type Native = (typeof NATIVES)[number];
export const isNative = (v: unknown): v is Native => NATIVES.includes(v as Native);
export const NATIVE_NAMES: Record<Native, string> = { ar: "Arabic", id: "Indonesian", vi: "Vietnamese", ko: "Korean" };

export type L4 = Record<Native, string>;
export type Level = "A1" | "A2" | "B1";
export type Tier = "free" | "plus" | "pro";

export type Word = { en: string; tr: L4; ex: string; exTr: L4 };
export type Lesson = { id: string; n: number; level: Level; unit: string; title: string; titleTr: L4; tier: Tier; intro: L4; words: Word[] };
export type Unit = { id: string; level: Level; title: string; titleTr: L4; icon: string };

type Four = [string, string, string, string];
export const l4 = (a: Four): L4 => ({ ar: a[0], id: a[1], vi: a[2], ko: a[3] });
/** A vocabulary row: English, its four translations, an example sentence and its four translations. */
export const W = (en: string, tr: Four, ex: string, exTr: Four): Word => ({ en, tr: l4(tr), ex, exTr: l4(exTr) });
