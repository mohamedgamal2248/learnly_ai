import "server-only";
import { createHash } from "crypto";
import { rpc } from "./db";

export type Cert = {
  id: string; kind: "academy" | "course"; ref: string; title: string; title_en: string; username: string;
  score: number | null; hash: string; created_at: string;
};

/** A fingerprint of the certificate's public fields; the verify page recomputes it to show the data wasn't changed. */
export function certHash(c: Pick<Cert, "id" | "username" | "kind" | "ref" | "title" | "created_at">) {
  const canonical = ["learnly-cert", "v1", c.id, c.username, c.kind, c.ref, c.title, new Date(c.created_at).toISOString()].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

/** Issues (or returns) a certificate and stores its fingerprint. */
export async function issueCert(uid: string, kind: Cert["kind"], ref: string, title: string, titleEn: string, score: number | null) {
  const c = await rpc<Cert>("ln_cert_issue", { p_user: uid, p_kind: kind, p_ref: ref, p_title: title, p_title_en: titleEn, p_score: score });
  if (c.hash) return c;
  const hash = certHash(c);
  await rpc("ln_cert_set_chain", { p_id: c.id, p_hash: hash, p_txid: null, p_network: null });
  return { ...c, hash };
}

export function verifyCert(c: Cert) {
  return { hashOk: !!c.hash && certHash(c) === c.hash };
}
