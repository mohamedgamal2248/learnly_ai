import { rpc } from "@/lib/server/db";
import { fail, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const { id } = await ctx.params;
  const d = await rpc<{ name: string; type: string; b64: string } | null>("ln_admin_doc", { p_app: id });
  if (!d) return fail("not_found", 404);
  const bytes = Buffer.from(d.b64, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": d.type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.name || "document")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
