import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

/** A creator's Pi earnings: balance, totals and past withdrawals. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const e = await rpc<Record<string, unknown> | null>("ln_pi_earnings", { p_user: a.u.id });
  return e ? json(e) : fail("not_found", 404);
}
