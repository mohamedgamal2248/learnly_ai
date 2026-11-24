import { json, requireSession } from "@/lib/server/http";
import { rpc } from "@/lib/server/db";

export const runtime = "nodejs";

/** Status of the signed-in person's teacher application (to show "under review" etc.). */
export async function GET(req: Request) {
  const s = requireSession(req);
  if (s instanceof Response) return s;
  return json({ app: await rpc("ln_en_teacher_status", { p_user: s.uid }) });
}
