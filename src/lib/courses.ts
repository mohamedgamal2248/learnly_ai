/** Client-side course types and helpers. */
export type CourseCard = {
  id: string; title: string; title_en: string; description: string; description_en: string; track: string;
  price_pi: number; lessons: number; students: number; creator: string; bot_id: string | null;
};
export type PublicLesson = { id: string; title: string; body: string | null; quiz: { q: string; options: string[] }[] | null; locked: boolean };
export type CourseDetail = Omit<CourseCard, "lessons"> & {
  status: string; enrolled: boolean; owner: boolean; progress: Record<string, boolean>; completed: boolean; lessons: PublicLesson[];
};

export function courseText(c: { title: string; title_en: string; description: string; description_en: string }, lang: "ar" | "en") {
  const en = lang === "en";
  return {
    title: (en ? c.title_en : c.title) || c.title || c.title_en,
    description: (en ? c.description_en : c.description) || c.description || c.description_en,
  };
}

export const piFmt = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
