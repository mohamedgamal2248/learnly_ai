import "server-only";
import { randomUUID } from "crypto";

export type QuizQ = { q: string; options: string[]; answer: number };
export type LessonIn = { id: string; title: string; body: string; quiz: QuizQ[] };
export type CourseRaw = {
  id: string; creator_id: string; bot_id: string | null; title: string; title_en: string; status: string;
  price_pi: number; lessons: LessonIn[];
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Cleans a creator's lesson list: limits sizes, keeps valid quiz questions, keeps stable ids. */
export function cleanLessons(input: unknown): LessonIn[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 40).flatMap((l: any) => {
    const title = str(l?.title, 160);
    const body = str(l?.body, 20000);
    if (!title || !body) return [];
    const quiz = (Array.isArray(l?.quiz) ? l.quiz : []).slice(0, 10).flatMap((q: any) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 200)).filter(Boolean).slice(0, 5);
      const answer = Number(q?.answer);
      const text = str(q?.q, 400);
      return text && options.length >= 2 && Number.isInteger(answer) && answer >= 0 && answer < options.length ? [{ q: text, options, answer }] : [];
    });
    const id = typeof l?.id === "string" && /^[\w-]{6,40}$/.test(l.id) ? l.id : randomUUID().slice(0, 12);
    return [{ id, title, body, quiz }];
  });
}
