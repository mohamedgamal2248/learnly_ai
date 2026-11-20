import { rpc } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { anchorCert, verifyCert, type Cert } from "@/lib/server/certs";
import { a2uReady } from "@/lib/server/a2u";

export const runtime = "nodejs";

/** Public certificate lookup with live verification against the Pi blockchain. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("bad_request");
  let c = await rpc<Cert | null>("ln_cert_get", { p_id: id });
  if (!c) return fail("not_found", 404);
  // Certificates issued before the app wallet was configured get anchored the first time they're viewed.
  if (!c.txid && a2uReady()) c = await anchorCert(c);
  return json({ cert: c, verify: await verifyCert(c) }, { cache: "public, s-maxage=300" });
}
