import { fail, json, rateLimited } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";
import { gradePlacement, placementQuestions } from "@/lib/server/learn/placement";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  return json({ questions: placementQuestions() });
}

/** Grades the test. Signed-in learners get their level saved; guests just see the result. */
export async function POST(req: Request) {
  const s = getSession(req);
  if (rateLimited(`place:${s?.uid || req.headers.get("x-forwarded-for") || "x"}`, 20, 600_000)) return fail("slow_down", 429);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.answers !== "object" || !b.answers) return fail("bad_request");
  const r = gradePlacement(b.answers as Record<string, unknown>);
  if (s) await rpc("ln_en_profile_set", { p_user: s.uid, p_native: null, p_level: r.level, p_goal: null, p_onboarded: null }).catch(() => {});
  return json(r);
}
