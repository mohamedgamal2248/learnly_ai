import { rpc } from "@/lib/server/db";
import { fail, json, rateLimited, requireUser } from "@/lib/server/http";
import { StrKey } from "@stellar/stellar-base";

export const runtime = "nodejs";

/** A creator asks to withdraw Pi to a wallet address. The amount is held now; an admin approves and the Pi is sent (minus 0.01 Pi network fee). */
export async function POST(req: Request) {
  const a = await requireUser(req);
  if (a instanceof Response) return a;
  if (rateLimited(`withdraw:${a.u.id}`, 5, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const pi = Math.floor(Number(b?.pi) * 1e7) / 1e7;
  const address = typeof b?.address === "string" ? b.address.trim().toUpperCase() : "";
  if (!(pi > 0 && pi <= 100_000)) return fail("bad_request");
  if (!StrKey.isValidEd25519PublicKey(address)) return fail("bad_address");
  const r = await rpc<{ ok: boolean; reason?: string; id?: string; min?: number }>("ln_payout_request2", { p_user: a.u.id, p_pi: pi, p_address: address });
  return r.ok ? json({ ok: true, id: r.id, pi }) : fail(r.reason || "bad_request", 400, { min: r.min });
}
