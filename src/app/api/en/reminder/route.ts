import { fail, json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

/** Daily reminder time (hour in the learner's own time zone). Delivery channels (Telegram) are added later. */
export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  const hour = b?.hour === null ? -1 : parseInt(String(b?.hour), 10);
  const tz = Math.round(Number(b?.tz) || 0);
  if (!(hour >= -1 && hour <= 23)) return fail("bad_request");
  return json(await rpc("ln_en_reminder_set", { p_user: s.uid, p_hour: hour, p_tz: tz }));
}
