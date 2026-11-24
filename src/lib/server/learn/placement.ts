import "server-only";
import type { Level } from "./types";
import { LESSONS } from "./index";

type Q = { id: string; level: Level; q: string; options: [string, ...string[]]; answer: string };
/** 15 questions, five per level. The first option listed here is always the correct one; options are shuffled before they are sent. */
const QUESTIONS: Q[] = [
  { id: "p1", level: "A1", q: "She ___ a teacher.", options: ["is", "are", "am", "be"], answer: "is" },
  { id: "p2", level: "A1", q: "I ___ coffee every morning.", options: ["drink", "drinks", "drinking", "drank"], answer: "drink" },
  { id: "p3", level: "A1", q: "Where ___ you from?", options: ["are", "is", "do", "does"], answer: "are" },
  { id: "p4", level: "A1", q: "What is the opposite of \"big\"?", options: ["small", "tall", "long", "new"], answer: "small" },
  { id: "p5", level: "A1", q: "There ___ two books on the table.", options: ["are", "is", "be", "am"], answer: "are" },
  { id: "p6", level: "A2", q: "Yesterday I ___ to the market.", options: ["went", "go", "goes", "going"], answer: "went" },
  { id: "p7", level: "A2", q: "My sister is ___ than me.", options: ["taller", "tall", "tallest", "more tall"], answer: "taller" },
  { id: "p8", level: "A2", q: "I am going ___ visit my uncle tomorrow.", options: ["to", "for", "at", "on"], answer: "to" },
  { id: "p9", level: "A2", q: "How ___ water do you drink every day?", options: ["much", "many", "lot", "few"], answer: "much" },
  { id: "p10", level: "A2", q: "You ___ wear a seat belt. It is the law.", options: ["must", "can", "may", "might"], answer: "must" },
  { id: "p11", level: "B1", q: "We ___ dinner when the phone rang.", options: ["were having", "have", "had been", "are having"], answer: "were having" },
  { id: "p12", level: "B1", q: "If it rains tomorrow, we ___ at home.", options: ["will stay", "stayed", "would stay", "stay"], answer: "will stay" },
  { id: "p13", level: "B1", q: "I have lived here ___ 2019.", options: ["since", "for", "from", "during"], answer: "since" },
  { id: "p14", level: "B1", q: "This bridge ___ in 1990.", options: ["was built", "built", "is built", "has built"], answer: "was built" },
  { id: "p15", level: "B1", q: "The man ___ lives next door is a doctor.", options: ["who", "which", "whose", "where"], answer: "who" },
];

function shuffle<T>(a: T[]): T[] { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

export const placementQuestions = () => QUESTIONS.map((x) => ({ id: x.id, level: x.level, q: x.q, options: shuffle([...x.options]) }));

export function gradePlacement(answers: Record<string, unknown>) {
  const right: Record<Level, number> = { A1: 0, A2: 0, B1: 0 };
  for (const x of QUESTIONS) if (answers[x.id] === x.answer) right[x.level]++;
  const level: Level = right.B1 >= 4 && right.A2 >= 3 ? "B1" : right.A2 >= 3 && right.A1 >= 4 ? "A2" : "A1";
  const start = LESSONS.find((l) => l.level === level)?.id || LESSONS[0].id;
  return { level, right, total: QUESTIONS.length, start };
}
