import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";
import { a2uReady, cancelA2U, completeA2U, createA2U, sendA2U } from "@/lib/server/a2u";

export const runtime = "nodejs";
export const maxDuration = 60;

type W = { id: string; username: string; pi_uid: string; pi: number; status: string; payment_id: string | null; txid: string | null; note: string | null };
type SetResult = { ok: boolean; reason?: string; payment_id?: string | null };

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json({ list: await rpc<W[]>("ln_admin_payouts", {}), ready: a2uReady() });
}

/**
 * Approve (send Pi now), retry a stuck one, or reject (credits go back).
 * The state machine lives in the database so a double click can't pay twice.
 */
export async function POST(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  const b = await req.json().catch(() => null);
  // Add Pi earnings to a user by username (for testing withdrawals or manual rewards).
  if (b?.action === "grant") {
    const pi = Math.floor(Number(b.pi) * 1e7) / 1e7;
    const username = typeof b.username === "string" ? b.username.trim().slice(0, 60) : "";
    if (!username || !(pi > 0 && pi <= 1000)) return fail("bad_request");
    const r = await rpc<{ ok: boolean; reason?: string; username?: string; balance?: number }>("ln_admin_grant_pi", { p_admin: a.u.id, p_username: username, p_pi: pi });
    return r.ok ? json(r) : fail(r.reason || "bad_request", 400);
  }
  if (typeof b?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return fail("bad_request");
  const set = (status: string, extra: { payment?: string | null; txid?: string | null; note?: string | null } = {}) =>
    rpc<SetResult>("ln_payout_set", { p_id: b.id, p_status: status, p_payment: extra.payment ?? null, p_txid: extra.txid ?? null, p_note: extra.note ?? null });

  if (b.action === "reject") {
    const r = await set("rejected", { note: String(b.note || "").slice(0, 300) || null });
    return r.ok ? json({ ok: true }) : fail(r.reason || "bad_state");
  }
  if (b.action !== "approve") return fail("bad_request");
  if (!a2uReady()) return fail("wallet_not_configured", 503);

  const w = (await rpc<W[]>("ln_admin_payouts", {})).find((x) => x.id === b.id);
  if (!w) return fail("not_found", 404);

  // A stuck one where the Pi already went out only needs the "complete" call again.
  if (w.status === "sending" && w.txid && w.payment_id) {
    try { await completeA2U(w.payment_id, w.txid); } catch (e: any) { return fail("complete_failed", 502, { detail: String(e.message).slice(0, 200) }); }
    await set("sent");
    return json({ ok: true, txid: w.txid });
  }

  const lock = await set("sending");
  if (!lock.ok) return fail(lock.reason || "bad_state");
  let paymentId: string | null = null;
  let txid: string | null = null;
  try {
    const p = await createA2U(w.pi_uid, Number(w.pi), "Learnly AI creator earnings", { withdrawal: w.id });
    paymentId = p.id;
    await set("sending", { payment: paymentId });
    txid = await sendA2U(p, Number(w.pi));
    await set("sending", { txid });
    await completeA2U(paymentId, txid);
    await set("sent");
    return json({ ok: true, txid });
  } catch (e: any) {
    const detail = String(e?.message || e).slice(0, 300);
    console.error("a2u error", detail);
    if (txid) {
      // The Pi was sent; keep it as "sending" so the admin can retry the completion. Never refund here.
      await set("sending", { note: `complete pending: ${detail}` });
      return fail("complete_failed", 502, { detail });
    }
    if (paymentId) await cancelA2U(paymentId);
    await set("failed", { note: detail });
    return fail("send_failed", 502, { detail });
  }
}
