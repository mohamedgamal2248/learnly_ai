export const NATIVES = ["ar", "id", "vi", "ko"] as const;
export type Native = (typeof NATIVES)[number];
export const isNative = (v: unknown): v is Native => NATIVES.includes(v as Native);
export const NATIVE_NAMES: Record<Native, string> = { ar: "Arabic", id: "Indonesian", vi: "Vietnamese", ko: "Korean" };

export type L4 = Record<Native, string>;
export type Level = "A1" | "A2" | "B1";
export type Tier = "free" | "plus" | "pro";

/** One vocabulary item with an example sentence. `src` says where each sentence came from ("tatoeba:ID" or "learnly"). */
export type Word = { en: string; tr: L4; ex: string; exTr: L4; blank?: string; src?: Record<string, string> };
export type Lesson = { id: string; n: number; level: Level; unit: string; title: string; titleTr: L4; tier: Tier; intro: L4; words: Word[] };
export type Unit = { id: string; level: Level; title: string; titleTr: L4; icon: string };
