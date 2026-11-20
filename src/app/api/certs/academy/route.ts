import { fail, json, rateLimited, requireSession } from "@/lib/server/http";
import { ACADEMY_KEYS } from "@/lib/academy";
import { issueCert } from "@/lib/server/certs";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The server checks every quiz answer before issuing the Pi Academy certificate. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  if (rateLimited(`cert:${s.uid}`, 10, 3600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  const answers = b?.answers && typeof b.answers === "object" ? b.answers : {};
  const allRight = Object.entries(ACADEMY_KEYS).every(([id, keys]) =>
    Array.isArray(answers[id]) && keys.every((k, i) => answers[id][i] === k));
  if (!allRight) return fail("not_passed");
  const cert = await issueCert(s.uid, "academy", "pi-academy", "أكاديمية Pi: أساسيات الأمان والبناء", "Pi Academy: Safety and Building Basics", 100);
  return json({ id: cert.id, txid: cert.txid });
}
