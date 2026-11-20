"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { ensurePiAuth, post, waitForPi } from "@/lib/pi-client";

const pi = (n: number | string) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;

/** Add Pi to the site balance with a normal Pi payment. The balance is used to post tasks and hire people. */
export function TopUp({ onDone }: { onDone: (balance?: number) => void }) {
  const { t, toast } = useApp();
  const [amt, setAmt] = useState("1");
  const [busy, setBusy] = useState(false);
  const v = Number(amt.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));
  const ok = v >= 0.1 && v <= 100000;
  async function go() {
    const p = await waitForPi();
    if (!p) { toast(t("openInPi")); return; }
    setBusy(true);
    if (!(await ensurePiAuth(p))) { setBusy(false); toast(t("payErr")); return; }
    p.createPayment(
      { amount: Math.round(v * 1e7) / 1e7, memo: "HireLoop balance", metadata: { deposit: true } },
      {
        onReadyForServerApproval: async (paymentId) => {
          const r = await post("/api/pi/approve", { paymentId });
          if (!r.ok) { setBusy(false); toast(t("payErr")); }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          const r = await post("/api/pi/complete", { paymentId, txid });
          setBusy(false);
          if (r.ok && r.data?.ok) { toast(t("tkToppedUp", { n: pi(Number(r.data.added ?? v)) })); onDone(Number(r.data.balance)); } else toast(t("payErr"));
        },
        onCancel: () => { setBusy(false); toast(t("payCancelled")); },
        onError: () => { setBusy(false); toast(t("payErr")); },
      },
    );
  }
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <b>{t("tkTopUp")}</b>
      <p className="hint">{t("tkTopUpHint")}</p>
      <div className="chips">{[1, 5, 10, 50, 100].map((n) => <button key={n} className={`chip${v === n ? " v" : ""}`} onClick={() => setAmt(String(n))} disabled={busy}>{n} π</button>)}</div>
      <div className="earn-form">
        <input className="input ltr" inputMode="decimal" value={amt} onChange={(x) => setAmt(x.target.value.replace(/[^\d٠-٩.,٫]/g, ""))} aria-label={t("tkReward")} />
        <span className="num earn-pi">π</span>
        <button className="btn primary" disabled={busy || !ok} onClick={go}>{busy ? t("paying") : t("tkTopUpBtn", { n: ok ? v : 0 })}</button>
      </div>
      {!ok && amt && <p className="hint">{t("tkTopUpRange")}</p>}
    </div>
  );
}

