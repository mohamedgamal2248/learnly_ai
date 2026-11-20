import { rpc } from "@/lib/server/db";
import { fail } from "@/lib/server/http";
import { verify } from "@/lib/server/session";
import { MIME, normalizeSpec } from "@/lib/server/files/spec";
import { renderFile } from "@/lib/server/files";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Step 2: a plain GET with a signed token (no cookie needed), so Pi Browser's download manager can fetch it. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await ctx.params;
  const t = verify<{ u: string; f: string; exp: number }>(new URL(req.url).searchParams.get("t"));
  if (!t || t.f !== id) return fail("link_expired", 410);
  const spec = normalizeSpec(await rpc("ln_dl_get", { p_user: t.u, p_file: id }));
  if (!spec) return fail("link_expired", 410);
  const bytes = await renderFile(spec);
  const base = (spec.title || "learnly").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "learnly";
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": MIME[spec.format],
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="learnly.${spec.format}"; filename*=UTF-8''${encodeURIComponent(`${base}.${spec.format}`)}`,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
