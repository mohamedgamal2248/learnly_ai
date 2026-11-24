import { json } from "@/lib/server/http";
import { loadState, nativeFrom } from "@/lib/server/learn/api";
import { catalogFor } from "@/lib/server/learn";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";

/** The lesson path: titles in the learner's language and which lessons are locked for their plan. Open to guests. */
export async function GET(req: Request) {
  const s = getSession(req);
  const st = s ? await loadState(s.uid).catch(() => null) : null;
  const native = nativeFrom(req, st);
  return json({ native, ...catalogFor(native, st?.sub.plan), progress: st?.progress || [], loggedIn: !!st }, { cache: "private, max-age=0" });
}
