import { json } from "@/lib/server/http";
import { clearCookie } from "@/lib/server/session";

export async function POST() {
  return json({ ok: true }, { headers: { "Set-Cookie": clearCookie } });
}
