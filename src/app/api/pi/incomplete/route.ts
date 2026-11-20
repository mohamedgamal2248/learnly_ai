import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";
import { piPayment } from "@/lib/server/pi";

export const runtime = "nodejs";

/** Pi reports a payment left unfinished (app closed mid-payment). Finish it if it is ours and was paid. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string") return fail("bad_request");
  const p = await piPayment.get(paymentId);
  if (p.user_uid !== s.pu) return fail("wrong_user", 403);
  const rec = await rpc<{ user_id: string } | null>("ln_payment_get", { p_payment: paymentId });
  const txid = p.transaction?.txid;
  if (!rec || !txid) return json({ ok: false, reason: "not_ours_or_unpaid" });
  if (!p.status.developer_completed) await piPayment.complete(paymentId, txid);
  return json(await rpc("ln_payment_complete", { p_payment: paymentId, p_txid: txid }));
}
