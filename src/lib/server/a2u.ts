import "server-only";
import { Asset, Keypair, Memo, Operation, TransactionBuilder, Account } from "@stellar/stellar-base";
import { env } from "./env";

/**
 * App-to-user (A2U) payments: the app sends Pi from its own wallet to a user.
 * Flow (Pi Platform docs): create payment → build + sign + submit the blockchain tx with the payment id as memo → complete.
 */
const API = "https://api.minepi.com/v2";

const NET = {
  testnet: { horizon: "https://api.testnet.minepi.com", passphrase: "Pi Testnet" },
  mainnet: { horizon: "https://api.mainnet.minepi.com", passphrase: "Pi Network" },
};

async function pi(path: string, method: "GET" | "POST", body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method, cache: "no-store",
    headers: { Authorization: `Key ${env.piApiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pi_${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export const a2uReady = () => !!env.piWalletSeed;

/** Step 1: ask Pi for a payment to this user. Returns the payment id and the addresses. */
export async function createA2U(uid: string, amount: number, memo: string, metadata: Record<string, unknown>) {
  const p = await pi("/payments", "POST", { payment: { amount, memo, metadata, uid } });
  return { id: p.identifier as string, to: p.to_address as string, from: p.from_address as string, network: p.network as string };
}

/** Step 2: send the Pi on the blockchain, with the payment id as the memo. Returns the transaction hash. */
export async function sendA2U(payment: { id: string; to: string }, amount: number) {
  const net = NET[env.piNetwork as "testnet" | "mainnet"];
  const kp = Keypair.fromSecret(env.piWalletSeed);
  const accRes = await fetch(`${net.horizon}/accounts/${kp.publicKey()}`, { cache: "no-store" });
  if (!accRes.ok) throw new Error(`horizon_account_${accRes.status}`);
  const acc = await accRes.json();
  const feeRes = await fetch(`${net.horizon}/fee_stats`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
  const fee = String(Math.max(100000, Number(feeRes?.last_ledger_base_fee) || 100000));
  const tx = new TransactionBuilder(new Account(kp.publicKey(), acc.sequence), { fee, networkPassphrase: net.passphrase })
    .addOperation(Operation.payment({ destination: payment.to, asset: Asset.native(), amount: amount.toFixed(7) }))
    .addMemo(Memo.text(payment.id))
    .setTimeout(180)
    .build();
  tx.sign(kp);
  const sub = await fetch(`${net.horizon}/transactions`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: tx.toXDR() }).toString(),
  });
  const out = await sub.json().catch(() => ({}));
  if (!sub.ok || !out.hash) throw new Error(`horizon_submit_${sub.status}: ${JSON.stringify(out?.extras?.result_codes || out).slice(0, 300)}`);
  return out.hash as string;
}

/** Step 3: tell Pi the transaction went through. */
export const completeA2U = (id: string, txid: string) => pi(`/payments/${encodeURIComponent(id)}/complete`, "POST", { txid });
export const cancelA2U = (id: string) => pi(`/payments/${encodeURIComponent(id)}/cancel`, "POST").catch(() => null);

/** Records data-only proof on chain (used for certificates): a no-op tx from the app wallet carrying a 32-byte hash memo. */
export async function anchorHash(hashHex: string) {
  const net = NET[env.piNetwork as "testnet" | "mainnet"];
  const kp = Keypair.fromSecret(env.piWalletSeed);
  const acc = await fetch(`${net.horizon}/accounts/${kp.publicKey()}`, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`horizon_account_${r.status}`);
    return r.json();
  });
  const tx = new TransactionBuilder(new Account(kp.publicKey(), acc.sequence), { fee: "100000", networkPassphrase: net.passphrase })
    .addOperation(Operation.bumpSequence({ bumpTo: "0" }))
    .addMemo(Memo.hash(hashHex))
    .setTimeout(180)
    .build();
  tx.sign(kp);
  const sub = await fetch(`${net.horizon}/transactions`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: tx.toXDR() }).toString(),
  });
  const out = await sub.json().catch(() => ({}));
  if (!sub.ok || !out.hash) throw new Error(`horizon_submit_${sub.status}`);
  return { txid: out.hash as string, network: env.piNetwork };
}

export const explorerTx = (txid: string, network = env.piNetwork) =>
  `${NET[network as "testnet" | "mainnet"].horizon}/transactions/${txid}`;
