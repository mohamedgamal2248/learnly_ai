import "server-only";
import { createHash } from "crypto";
import { rpc } from "./db";
import { a2uReady, anchorHash } from "./a2u";

export type Cert = {
  id: string; kind: "academy" | "course"; ref: string; title: string; title_en: string; username: string;
  score: number | null; hash: string; txid: string | null; network: string | null; created_at: string;
};

/** The fingerprint written on chain. Anyone can recompute it from the public certificate fields. */
export function certHash(c: Pick<Cert, "id" | "username" | "kind" | "ref" | "title" | "created_at">) {
  const canonical = ["learnly-cert", "v1", c.id, c.username, c.kind, c.ref, c.title, new Date(c.created_at).toISOString()].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

/** Issues (or returns) a certificate and anchors its fingerprint on the Pi blockchain when the app wallet is set up. */
export async function issueCert(uid: string, kind: Cert["kind"], ref: string, title: string, titleEn: string, score: number | null) {
  const c = await rpc<Cert>("ln_cert_issue", { p_user: uid, p_kind: kind, p_ref: ref, p_title: title, p_title_en: titleEn, p_score: score });
  return anchorCert(c);
}

export async function anchorCert(c: Cert) {
  if (c.hash && c.txid) return c;
  const hash = c.hash || certHash(c);
  let txid: string | null = null;
  let network: string | null = null;
  if (a2uReady()) {
    try { const r = await anchorHash(hash); txid = r.txid; network = r.network; }
    catch (e: any) { console.error("cert anchor failed", e?.message); }
  }
  await rpc("ln_cert_set_chain", { p_id: c.id, p_hash: hash, p_txid: txid, p_network: network });
  return { ...c, hash, txid, network };
}

const HORIZON: Record<string, string> = { testnet: "https://api.testnet.minepi.com", mainnet: "https://api.mainnet.minepi.com" };

/** Checks the stored fingerprint and, if anchored, that the blockchain transaction carries the same fingerprint. */
export async function verifyCert(c: Cert) {
  const hashOk = !!c.hash && certHash(c) === c.hash;
  let chainOk: boolean | null = null;
  let chainUrl: string | null = null;
  if (c.txid && c.network && HORIZON[c.network]) {
    chainUrl = `${HORIZON[c.network]}/transactions/${c.txid}`;
    try {
      const tx = await fetch(chainUrl, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      chainOk = !!tx && tx.memo_type === "hash" && Buffer.from(tx.memo, "base64").toString("hex") === c.hash;
    } catch { chainOk = null; }
  }
  return { hashOk, chainOk, chainUrl };
}
