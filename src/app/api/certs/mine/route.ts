import { rpc } from "@/lib/server/db";
import { json, requireSession } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  return json({ certs: await rpc("ln_my_certs", { p_user: s.uid }) });
}
