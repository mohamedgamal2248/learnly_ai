import { rpc } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { verifyCert, type Cert } from "@/lib/server/certs";

export const runtime = "nodejs";

/** Public certificate lookup with a fingerprint check. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  const c = await rpc<Cert | null>("ln_cert_get", { p_id: id });
  if (!c) return fail("not_found", 404);
  return json({ cert: c, verify: verifyCert(c) }, { cache: "public, s-maxage=300" });
}
