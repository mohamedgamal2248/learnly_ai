/** Progress of someone who has not signed in yet. It stays on the device and is added to the account after signing in. */
const KEY = "ll-guest";
const QUEUE = "ll-queue";

export type GuestDone = Record<string, { best: number }>;

export function readGuest(): GuestDone {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" && v.done ? v.done : {}; } catch { return {}; }
}
export function saveGuestLesson(id: string, best: number) {
  try { const d = readGuest(); d[id] = { best: Math.max(d[id]?.best ?? 0, best) }; localStorage.setItem(KEY, JSON.stringify({ done: d })); } catch {}
}
export function clearGuest() { try { localStorage.removeItem(KEY); } catch {} }

/** Stars for a finished lesson: 3 for 9+/10, 2 for 7+/10, otherwise 1. Zero when not finished. */
export const starsFor = (done: boolean, best: number) => (!done ? 0 : best >= 9 ? 3 : best >= 7 ? 2 : 1);

export type Pending = { lessonId: string; score: number; missed: string[]; correct: number; answers: number; seconds: number };
export function readQueue(): Pending[] { try { const v = JSON.parse(localStorage.getItem(QUEUE) || "[]"); return Array.isArray(v) ? v.slice(0, 20) : []; } catch { return []; } }
export function writeQueue(q: Pending[]) { try { if (q.length) localStorage.setItem(QUEUE, JSON.stringify(q.slice(0, 20))); else localStorage.removeItem(QUEUE); } catch {} }
