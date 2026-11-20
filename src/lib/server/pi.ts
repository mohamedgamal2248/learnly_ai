import "server-only";
import { env } from "./env";

const API = "https://api.minepi.com/v2";

export type PiPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  status: {
    developer_approved: boolean; transaction_verified: boolean; developer_completed: boolean;
    cancelled: boolean; user_cancelled: boolean;
  };
  transaction: null | { txid: string; verified: boolean };
};

/** Checks a Pi access token with Pi's servers and returns the real user. Never trust the browser's copy. */
export async function piMe(accessToken: string): Promise<{ uid: string; username: string }> {
  const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`pi_me_${res.status}`);
  return res.json();
}

async function server(path: string, method: "GET" | "POST", body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Key ${env.piApiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`pi_${method}_${path}_${res.status}: ${await res.text()}`);
  return res.json();
}

export const piPayment = {
  get: (id: string) => server(`/payments/${encodeURIComponent(id)}`, "GET") as Promise<PiPayment>,
  approve: (id: string) => server(`/payments/${encodeURIComponent(id)}/approve`, "POST"),
  complete: (id: string, txid: string) => server(`/payments/${encodeURIComponent(id)}/complete`, "POST", { txid }),
};
