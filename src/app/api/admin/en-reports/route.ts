import { fail, json, requireUser } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const st = new URL(req.url).searchParams.get("status");
  return json({ reports: await rpc("ln_en_admin_reports", { p_status: ["open", "fixed", "dismissed"].includes(st || "") ? st : null }) });
}

export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(b?.id) || !["open", "fixed", "dismissed"].includes(b?.status)) return fail("bad_request");
  return json(await rpc("ln_en_admin_report_set", { p_id: b.id, p_status: b.status }));
}
