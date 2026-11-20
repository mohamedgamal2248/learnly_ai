import { fail, rateLimited, requireSession } from "@/lib/server/http";
import { MIME, normalizeSpec } from "@/lib/server/files/spec";
import { renderFile } from "@/lib/server/files";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Builds a file from the spec the browser kept on the user's device. Nothing is stored on the server.
 * It's called with a normal form POST (a page navigation), which Pi Browser treats as a download,
 * unlike blob downloads that it ignores.
 */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`render:${s.uid}`, 20, 60_000)) return fail("slow_down", 429);
  const form = await req.formData().catch(() => null);
  const raw = form?.get("spec");
  if (typeof raw !== "string" || raw.length > 400_000) return fail("bad_request");
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch {}
  const spec = normalizeSpec(parsed);
  if (!spec) return fail("bad_request");
  const bytes = await renderFile(spec);
  const base = (spec.title || "learnly").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "learnly";
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": MIME[spec.format],
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="learnly.${spec.format}"; filename*=UTF-8''${encodeURIComponent(`${base}.${spec.format}`)}`,
      "Cache-Control": "no-store",
    },
  });
}
