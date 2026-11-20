import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { normalizeSpec } from "@/lib/server/files/spec";
import { sign } from "@/lib/server/session";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Step 1 of a download. Pi Browser hands file links to Android's download manager, which fetches the URL
 * again on its own: no cookies, no POST body. So we park the spec briefly and return a signed GET link
 * that works without a session for 10 minutes.
 */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`prep:${s.uid}`, 20, 60_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== "string" || !UUID.test(b.id)) return fail("bad_request");
  if (JSON.stringify(b.spec ?? null).length > 400_000) return fail("too_big");
  const spec = normalizeSpec(b.spec);
  if (!spec) return fail("bad_request");
  await rpc("ln_dl_put", { p_user: s.uid, p_file: b.id, p_spec: spec });
  const token = sign({ u: s.uid, f: b.id, exp: Date.now() + 10 * 60_000 });
  // The file name sits in the path too: some download managers name the file from the URL.
  const base = (spec.title || "learnly").replace(/[\\/:*?"<>|#%?]+/g, " ").trim().slice(0, 80) || "learnly";
  const name = encodeURIComponent(`${base}.${spec.format}`);
  return json({ url: `/api/files/dl/${b.id}/${name}?t=${encodeURIComponent(token)}` });
}
