import { fail, json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { isNative } from "@/lib/server/learn/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const b = await req.json().catch(() => null);
  const native = b?.native == null ? null : isNative(b.native) ? b.native : undefined;
  const level = b?.level == null ? null : ["A1", "A2", "B1"].includes(b.level) ? b.level : undefined;
  if (native === undefined || level === undefined) return fail("bad_request");
  const goal = b?.goal == null ? null : Math.min(Math.max(parseInt(b.goal, 10) || 1, 1), 5);
  return json(await rpc("ln_en_profile_set", { p_user: s.uid, p_native: native, p_level: level, p_goal: goal, p_onboarded: b?.onboarded === true ? true : null }));
}
