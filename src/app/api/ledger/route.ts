import { rpc } from "@/lib/server/db";
import { json, requireUser } from "@/lib/server/http";

export const runtime = "nodejs";

type L = { id: number; delta: number; kind: string; at: string; title: string | null };

/** The Pi balance history (deposits, holds, refunds, earnings, withdrawals). ?format=csv returns a spreadsheet. */
export async function GET(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  const u = new URL(req.url);
  const csv = u.searchParams.get("format") === "csv";
  const limit = csv ? 200 : Math.min(100, Math.max(1, parseInt(u.searchParams.get("limit") || "30", 10) || 30));
  const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0", 10) || 0);
  const r = await rpc<{ total: number; rows: L[] }>("ln_ledger_list", { p_user: a.u.id, p_limit: limit, p_offset: csv ? 0 : offset });
  if (!csv) return json(r);
  const q = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
  const body = ["date,type,pi,task", ...r.rows.map((x) => `${new Date(x.at).toISOString()},${x.kind},${Number(x.delta)},${q(x.title)}`)].join("\n");
  return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="hireloop-ledger.csv"', "Cache-Control": "no-store" } });
}
