import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";
import { piPayment } from "@/lib/server/pi";
import { readQuote } from "@/lib/server/pricing";

export const runtime = "nodejs";

/** Step 1 of a Pi payment: check it matches a quote we signed for this user, record it, then approve with Pi. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string") return fail("bad_request");
  const p = await piPayment.get(paymentId);
  if (p.user_uid !== s.pu) return fail("wrong_user", 403);
  const q = readQuote(p.metadata?.q);
  if (!q || p.metadata?.pack !== q.pack) return fail("quote_expired", 400);
  if (Math.abs(Number(p.amount) - q.pi) > 1e-7) return fail("amount_mismatch", 400);
  await rpc("ln_payment_start", { p_payment: paymentId, p_user: s.uid, p_pi: q.pi, p_usd: q.usd, p_credits: q.credits });
  if (!p.status.developer_approved) await piPayment.approve(paymentId);
  return json({ ok: true });
}
