"use client";

/** Minimal types for the Pi Browser SDK loaded from https://sdk.minepi.com/pi-sdk.js */
type PaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
};
type PiSDK = {
  init: (o: { version: string; sandbox?: boolean }) => void;
  authenticate: (scopes: string[], onIncomplete: (p: { identifier: string; transaction?: { txid: string } }) => void) =>
    Promise<{ accessToken: string; user: { uid: string; username: string } }>;
  createPayment: (data: { amount: number; memo: string; metadata: Record<string, unknown> }, cb: PaymentCallbacks) => void;
};

declare global { interface Window { Pi?: PiSDK; } }

let inited = false;

export function getPi(): PiSDK | null {
  if (typeof window === "undefined" || !window.Pi) return null;
  if (!inited) {
    // Testnet app running inside Pi Browser (not the desktop sandbox).
    window.Pi.init({ version: "2.0", sandbox: false });
    inited = true;
  }
  return window.Pi;
}

export async function waitForPi(ms = 3000): Promise<PiSDK | null> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const pi = getPi();
    if (pi) return pi;
    await new Promise((r) => setTimeout(r, 150));
  }
  return getPi();
}

export async function post<T = any>(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST", credentials: "include",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function onIncompletePayment(p: { identifier: string }) {
  await post("/api/pi/incomplete", { paymentId: p.identifier }).catch(() => {});
}
