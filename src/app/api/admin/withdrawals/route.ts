import { rpc } from "@/lib/server/db";
import { fail, json, requireUser } from "@/lib/server/http";
import { a2uReady, sendDirect } from "@/lib/server/a2u";

export const runtime = "nodejs";
export const maxDuration = 60;

type W = { id: string; username: string; pi: number; sent: number | null; address: string | null; status: string; txid: string | null; note: string | null };
type SetResult = { ok: boolean; reason?: string };

const NETWORK_FEE = 0.01;

export async function GET(req: Request) {
  const a = await requireUser(req, ["admin"]);
  if (a instanceof Response) return a;
  return json({ list: await rpc<W[]>("ln_admin_payouts", {}), ready: a2uReady() });
}

/**
 * Approve (send Pi now to the address the creator entered, minus the 0.01 Pi network fee), or reject (balance goes back).
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
  const set = (status: string, extra: { txid?: string | null; note?: string | null } = {}) =>
    rpc<SetResult>("ln_payout_set", { p_id: b.id, p_status: status, p_payment: null, p_txid: extra.txid ?? null, p_note: extra.note ?? null });

  if (b.action === "reject") {
    const r = await set("rejected", { note: String(b.note || "").slice(0, 300) || null });
    return r.ok ? json({ ok: true }) : fail(r.reason || "bad_state");
  }
  if (b.action !== "approve") return fail("bad_request");
  if (!a2uReady()) return fail("wallet_not_configured", 503);

  const w = (await rpc<W[]>("ln_admin_payouts", {})).find((x) => x.id === b.id);
  if (!w) return fail("not_found", 404);
  if (!w.address) return fail("no_address", 400, { detail: "This request has no wallet address. Reject it so the creator can request again with an address." });

  // Already sent on chain but not marked: just mark it.
  if (w.status === "sending" && w.txid) { await set("sent"); return json({ ok: true, txid: w.txid }); }

  const lock = await set("sending");
  if (!lock.ok) return fail(lock.reason || "bad_state");
  const amount = Math.floor((Number(w.pi) - NETWORK_FEE) * 1e7) / 1e7;
  if (!(amount > 0)) { await set("failed", { note: "amount_too_small" }); return fail("send_failed", 400, { detail: "amount_too_small" }); }
  try {
    const txid = await sendDirect(w.address, amount, `Learnly payout`);
    await set("sending", { txid });
    await set("sent");
    return json({ ok: true, txid });
  } catch (e: any) {
    const detail = String(e?.message || e).slice(0, 300);
    console.error("payout error", detail);
    // A submit that timed out might still land; keep it for a manual check instead of refunding.
    if (/horizon_submit_5\d\d|timeout/i.test(detail)) {
      await set("sending", { note: `check on chain: ${detail}` });
      return fail("send_unknown", 502, { detail });
    }
    await set("failed", { note: detail });
    return fail("send_failed", 502, { detail });
  }
}
