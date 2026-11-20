import { rpc } from "@/lib/server/db";
import { fail, requireSession } from "@/lib/server/http";
import { MIME, type FileSpec } from "@/lib/server/files/spec";
import { renderFile } from "@/lib/server/files";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Files are rebuilt on demand from the saved spec, so nothing is kept in storage.
 * A plain GET with Content-Disposition works in Pi Browser, which ignores blob downloads.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("not_found", 404);
  const row = await rpc<{ spec: FileSpec; title: string; format: FileSpec["format"] } | null>("ln_file_get", { p_file: id, p_user: s.uid });
  if (!row) return fail("not_found", 404);

  const bytes = await renderFile(row.spec);
  const base = (row.title || "learnly").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "learnly";
  const name = `${base}.${row.format}`;
  const inline = new URL(req.url).searchParams.get("view") === "1" && row.format === "pdf";
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": MIME[row.format],
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="learnly.${row.format}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
