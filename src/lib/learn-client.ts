export function canSpeak() { return typeof window !== "undefined" && "speechSynthesis" in window; }

/** Reads English aloud with the phone's own voice (free, no AI credits). */
export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch {}
}

export type CatLesson = { id: string; n: number; unit: string; level: string; title: string; titleTr: string; tier: "free" | "plus" | "pro"; words: number; locked: boolean };
export type CatUnit = { id: string; level: string; title: string; titleTr: string; icon: string };
export type Catalog = { native: string; units: CatUnit[]; lessons: CatLesson[]; progress: { id: string; best: number; done: boolean }[]; loggedIn: boolean };

export const tierLabel = (t: string) => (t === "free" ? "Free" : t === "plus" ? "Plus" : "Pro");

/** First lesson the learner can open and has not finished; falls back to the first locked one. */
export function nextStep(cat: Catalog): { lesson: CatLesson; locked: boolean } | null {
  const done = new Set(cat.progress.filter((p) => p.done).map((p) => p.id));
  const open = cat.lessons.find((l) => !l.locked && !done.has(l.id));
  if (open) return { lesson: open, locked: false };
  const locked = cat.lessons.find((l) => l.locked && !done.has(l.id));
  return locked ? { lesson: locked, locked: true } : null;
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);
