import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { getLesson } from "@/lib/server/learn";

export const runtime = "nodejs";

/** "Report a mistake" in a lesson (translation, sentence...). Reviewed in the admin page. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`rep:${s.uid}`, 10, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const lesson = getLesson(String(b?.lessonId || ""));
  if (!lesson) return fail("bad_request");
  const word = typeof b?.word === "string" && lesson.words.some((w) => w.en === b.word) ? b.word : null;
  const note = String(b?.note || "").trim().slice(0, 500);
  return json(await rpc("ln_en_report_add", { p_user: s.uid, p_lesson: lesson.id, p_word: word, p_note: note }));
}
