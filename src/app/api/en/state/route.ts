import { fail, json, requireSession } from "@/lib/server/http";
import { loadState } from "@/lib/server/learn/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  const st = await loadState(s.uid);
  return st ? json(st) : fail("login_required", 401);
}
