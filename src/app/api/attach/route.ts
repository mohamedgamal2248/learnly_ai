import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { extractText } from "@/lib/server/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * A learner attaches a document to a chat. We keep only its text (never the file), and the model
 * reads it on demand with read_attachment / search_attachment, so big files don't cost a fortune.
 */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`attach:${s.uid}`, 15, 3600_000)) return fail("slow_down", 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("bad_request");
  if (file.size > 4 * 1024 * 1024) return fail("file_too_big");
  const name = file.name.toLowerCase();
  const kind = name.split(".").pop() || "";
  if (!["pdf", "docx", "pptx", "xlsx", "txt", "md", "csv"].includes(kind)) return fail("file_type");

  let text: string;
  try { text = await extractText(file); } catch { return fail("extract_failed"); }
  const body = text.replace(/^### .*\n/, "").replace(/\[(Page|Slide) \d+\]/g, "").trim();
  // A PDF that is only pictures (a scan) has no text layer to read.
  if (body.replace(/\s+/g, "").length < 40) return fail(kind === "pdf" ? "scanned_pdf" : "empty_file");

  const r = await rpc<{ ok: boolean; id?: string; reason?: string }>("ln_att_put", {
    p_user: s.uid, p_name: file.name.slice(0, 120), p_kind: kind, p_text: text,
  });
  if (!r.ok) return fail(r.reason || "att_limit", 429);
  const pages = (text.match(/\[(Page|Slide|Sheet) /g) || []).length;
  return json({ id: r.id, name: file.name.slice(0, 120), kind, chars: text.length, pages });
}
