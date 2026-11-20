import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { submitTaskResult } from "@/lib/server/tasks";
import { filesFromForm, type StoredFile } from "@/lib/server/task-files";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Manual delivery from the website: text, a PDF/PowerPoint built from the form, and/or ready-made files. */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`submit:${a.u.id}`, 30, 3600_000)) return fail("slow_down", 429);
  let id: unknown, text: unknown, spec: unknown;
  let files: StoredFile[] = [];
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return fail("bad_request");
    const f = await filesFromForm(form);
    if (!f.ok) return fail(f.error);
    files = f.files;
    id = form.get("id"); text = form.get("text");
    try { spec = JSON.parse(String(form.get("file") || "null")); } catch { spec = null; }
  } else {
    const b = await req.json().catch(() => null);
    id = b?.id; text = b?.text; spec = b?.file;
  }
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const r = await submitTaskResult(a.u.id, id, text, spec, files);
  return r.ok ? json({ ok: true, net: r.net }) : fail(r.error.split(":")[0], 400);
}
