import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { piPayment } from "@/lib/server/pi";

export const runtime = "nodejs";

/** Step 2: the user signed the transaction. Tell Pi it's complete, then add the credits (once). */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`pay:${s.uid}`, 15, 60_000)) return fail("slow_down", 429);
  const { paymentId, txid } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string" || typeof txid !== "string" || paymentId.length > 100 || txid.length > 200) return fail("bad_request");
  const rec = await rpc<{ user_id: string; pi_amount: number } | null>("ln_payment_get", { p_payment: paymentId });
  if (!rec || rec.user_id !== s.uid) return fail("unknown_payment", 404);
  const p = await piPayment.get(paymentId);
  if (p.user_uid !== s.pu) return fail("wrong_user", 403);
  if (!p.transaction?.txid || p.transaction.txid !== txid) return fail("tx_mismatch", 400);
  // The amount Pi actually moved must be the amount we recorded and approved.
  if (p.status.cancelled || p.status.user_cancelled || Math.abs(Number(p.amount) - Number(rec.pi_amount)) > 1e-7) return fail("amount_mismatch", 400);
  if (!p.status.developer_completed) await piPayment.complete(paymentId, txid);
  const r = await rpc<{ ok: boolean; credits?: number; added?: number; plan?: string; until?: string }>("ln_payment_complete2", { p_payment: paymentId, p_txid: txid });
  return json(r);
}
