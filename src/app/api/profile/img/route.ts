import { rpc } from "@/lib/server/db";
import { fail } from "@/lib/server/http";

export const runtime = "nodejs";

/** A portfolio image (public, cached). Served as an image only, never as a page. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const f = await rpc<{ mime: string; data: string } | null>("ln_portfolio_image", { p_id: id });
  if (!f || !/^image\/(png|jpeg|webp)$/.test(f.mime)) return fail("not_found", 404);
  const bytes = Buffer.from(f.data, "base64");
  return new Response(bytes, {
    headers: { "Content-Type": f.mime, "Content-Length": String(bytes.length), "Cache-Control": "public, max-age=3600, s-maxage=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" },
  });
}
