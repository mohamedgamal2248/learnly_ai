import { rpc } from "@/lib/server/db";
import { fail } from "@/lib/server/http";
import { verify } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Step 2: a plain GET with the signed token. Files are always downloads, except images which may show inline. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await ctx.params;
  const t = verify<{ u: string; f: string; a?: boolean; exp: number }>(new URL(req.url).searchParams.get("t"));
  if (!t || t.f !== id) return fail("link_expired", 410);
  const f = await rpc<{ name: string; mime: string; data: string } | null>("ln_task_file_get", { p_user: t.u, p_file: id, p_admin: t.a === true });
  if (!f) return fail("link_expired", 410);
  const bytes = Buffer.from(f.data, "base64");
  const inline = /^image\/(png|jpeg|webp)$/.test(f.mime);
  return new Response(bytes, {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, max-age=600",
    },
  });
}
