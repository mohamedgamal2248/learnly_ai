import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** What the connected AIs did with this account (changes only): tool, result, amount, which connection. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  return json({ log: await rpc("ln_mcp_log_list", { p_user: a.u.id, p_limit: 40 }) });
}
