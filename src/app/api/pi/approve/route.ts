import { rpc } from "@/lib/server/db";
import { fail, json, requireSession } from "@/lib/server/http";
import { piPayment } from "@/lib/server/pi";
import { piUsdRate, readQuote } from "@/lib/server/pricing";
import type { CourseRaw } from "@/lib/server/courses";

export const runtime = "nodejs";

/**
 * Step 1 of a Pi payment. Two kinds:
 *  - credit pack: must match a quote we signed for this user;
 *  - course: amount must equal the live course price.
 * We record it, then approve with Pi.
 */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string") return fail("bad_request");
  const p = await piPayment.get(paymentId);
  if (p.user_uid !== s.pu) return fail("wrong_user", 403);

  const courseId = p.metadata?.course;
  if (p.metadata?.deposit === true) {
    // Top-up of the Pi balance (for posting tasks): any amount in range, credited only after the payment completes.
    const amt = Number(p.amount);
    if (!(amt >= 0.1 && amt <= 100000)) return fail("bad_amount", 400);
    await rpc("ln_payment_start3", { p_payment: paymentId, p_user: s.uid, p_pi: amt });
  } else if (typeof courseId === "string") {
    if (!/^[0-9a-f-]{36}$/i.test(courseId)) return fail("bad_request");
    const c = await rpc<CourseRaw | null>("ln_course_raw", { p_course: courseId });
    if (!c || c.status !== "live" || !(Number(c.price_pi) > 0)) return fail("course_unavailable", 400);
    if (Math.abs(Number(p.amount) - Number(c.price_pi)) > 1e-7) return fail("amount_mismatch", 400);
    const rate = await piUsdRate().catch(() => 0);
    await rpc("ln_payment_start2", {
      p_payment: paymentId, p_user: s.uid, p_pi: Number(c.price_pi), p_usd: Number(c.price_pi) * rate, p_credits: 0, p_course: courseId,
    });
  } else {
    const q = readQuote(p.metadata?.q);
    if (!q || p.metadata?.pack !== q.pack) return fail("quote_expired", 400);
    if (Math.abs(Number(p.amount) - q.pi) > 1e-7) return fail("amount_mismatch", 400);
    await rpc("ln_payment_start", { p_payment: paymentId, p_user: s.uid, p_pi: q.pi, p_usd: q.usd, p_credits: q.credits });
  }
  if (!p.status.developer_approved) await piPayment.approve(paymentId);
  return json({ ok: true });
}
