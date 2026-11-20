import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Teacher application with one private proof document (max 2 MB). Only the admin can open it, and it is wiped 30 days after the decision. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`apply:${s.uid}`, 3, 3600_000)) return fail("slow_down", 429);
  const form = await req.formData().catch(() => null);
  if (!form) return fail("bad_request");
  const name = String(form.get("name") || "").trim();
  const subjects = String(form.get("subjects") || "").trim();
  const bio = String(form.get("bio") || "").trim();
  const years = parseInt(String(form.get("years") || "0"), 10) || 0;
  if (name.length < 2 || subjects.length < 2 || bio.length < 20) return fail("missing_fields");
  const doc = form.get("doc");
  let b64: string | null = null, docName: string | null = null, docType: string | null = null;
  if (doc instanceof File && doc.size > 0) {
    if (doc.size > 2 * 1024 * 1024) return fail("file_too_big");
    if (!ALLOWED.includes(doc.type)) return fail("file_type");
    b64 = Buffer.from(await doc.arrayBuffer()).toString("base64");
    docName = doc.name.slice(0, 120);
    docType = doc.type;
  } else return fail("doc_required");
  try {
    const r = await rpc("ln_teacher_apply", {
      p_user: s.uid, p_name: name, p_subjects: subjects, p_bio: bio, p_years: years,
      p_doc_name: docName, p_doc_type: docType, p_doc_b64: b64,
    });
    return json(r);
  } catch (e: any) {
    return fail(String(e.message).includes("pending") ? "already_pending" : "server_error", 400);
  }
}
