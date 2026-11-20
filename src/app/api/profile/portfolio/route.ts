import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { addPortfolio } from "@/lib/server/people";
import { isImageName, prepareFile } from "@/lib/server/task-files";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_IMG = 700 * 1024;

/** Add a portfolio item (multipart: title, description, made_with, tags, optional image <= 700 KB). */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`port:${a.u.id}`, 20, 3600_000)) return fail("slow_down", 429);
  const form = await req.formData().catch(() => null);
  if (!form) return fail("bad_request");
  let image: { mime: string; data: string } | undefined;
  const f = form.get("image");
  if (f instanceof File && f.size > 0) {
    if (!isImageName(f.name)) return fail("file_type");
    const r = prepareFile(f.name, new Uint8Array(await f.arrayBuffer()), MAX_IMG);
    if (!r.ok) return fail(r.error);
    image = { mime: r.file.mime, data: r.file.data };
  }
  const r = await addPortfolio(a.u.id, { title: form.get("title"), description: form.get("description"), made_with: form.get("made_with"), tags: form.get("tags") }, image);
  return r.ok ? json({ ok: true, id: r.id }) : fail(r.error, 400, { why: r.why });
}

export async function DELETE(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const r = await rpc<{ ok: boolean }>("ln_portfolio_remove", { p_user: a.u.id, p_id: id });
  return r.ok ? json({ ok: true }) : fail("not_found", 404);
}
