import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { extractText } from "@/lib/server/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Reads text out of a teacher's PDF, Word, PowerPoint or text file. Nothing is stored; the text goes back to the editor. */
export async function POST(req: Request) {
  const a = await requireUser(req, ["teacher", "admin"]);
  if (a instanceof Response) return a;
  if (rateLimited(`extract:${a.u.id}`, 20, 3600_000)) return fail("slow_down", 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("bad_request");
  if (file.size > 4 * 1024 * 1024) return fail("file_too_big");
  try {
    return json({ text: await extractText(file) });
  } catch (e: any) {
    return fail(e.message === "unsupported_type" ? "file_type" : "extract_failed");
  }
}
