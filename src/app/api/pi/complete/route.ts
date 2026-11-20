import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";
import { piPayment } from "@/lib/server/pi";

export const runtime = "nodejs";

/** Step 2: the user signed the transaction. Tell Pi it's complete, then add the credits (once). */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const { paymentId, txid } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string" || typeof txid !== "string") return fail("bad_request");
  const rec = await rpc<{ user_id: string } | null>("ln_payment_get", { p_payment: paymentId });
  if (!rec || rec.user_id !== s.uid) return fail("unknown_payment", 404);
  const p = await piPayment.get(paymentId);
  if (!p.transaction?.txid || p.transaction.txid !== txid) return fail("tx_mismatch", 400);
  if (!p.status.developer_completed) await piPayment.complete(paymentId, txid);
  const r = await rpc<{ ok: boolean; credits?: number; added?: number }>("ln_payment_complete", { p_payment: paymentId, p_txid: txid });
  return json(r);
}
