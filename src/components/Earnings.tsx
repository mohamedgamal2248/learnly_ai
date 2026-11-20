"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type E = {
  earned: number; withdrawn: number; available: number; min: number; creditUsd: number; rate: number;
  history: { id: string; credits: number; pi: number; status: string; txid: string | null; note: string | null; at: string }[];
};
const ERR: Record<string, Key> = { below_min: "wdBelowMin", pending_exists: "wdPending", not_enough: "wdNotEnough", price_unavailable: "priceErr" };

/** Creator earnings with a Pi withdrawal request (sent by the admin as an app-to-user payment). */
export function Earnings({ onChange }: { onChange?: () => void }) {
  const { t, lang, toast, refresh } = useApp();
  const [e, setE] = useState<E | null>(null);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const load = useCallback(async () => {
    const r = await fetch("/api/earnings", { credentials: "include", cache: "no-store" });
    if (r.ok) { const d: E = await r.json(); setE(d); setAmt(String(d.available)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!e) return <div className="skeleton" style={{ height: 120 }} />;

  const credits = parseInt(amt.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)), 10) || 0;
  const piEst = e.rate > 0 ? (credits * e.creditUsd) / e.rate : 0;
  const pending = e.history.some((h) => h.status === "pending" || h.status === "sending");

  async function withdraw() {
    setBusy(true);
    const r = await post("/api/earnings/withdraw", { credits });
    setBusy(false);
    if (r.ok) { toast(t("wdRequested")); load(); refresh(); onChange?.(); }
    else toast(t(ERR[r.data?.error] || "errGeneric", { n: fmt(r.data?.min ?? e!.min) }));
  }

  return (
    <div className="card earn">
      <div className="earn-top">
        <div><span className="hint">{t("earned")}</span><b className="num">{fmt(e.earned)}</b></div>
        <div><span className="hint">{t("wdAvailable")}</span><b className="num">{fmt(e.available)}</b></div>
        <div><span className="hint">{t("wdWithdrawn")}</span><b className="num">{fmt(e.withdrawn)}</b></div>
      </div>
      <p className="hint">{t("wdHint", { n: fmt(e.min) })}</p>
      <div className="earn-form">
        <input className="input ltr" inputMode="numeric" value={amt} onChange={(x) => setAmt(x.target.value.replace(/[^\d٠-٩]/g, ""))} aria-label={t("wdAmount")} />
        <span className="num earn-pi">≈ {piEst.toFixed(4)} π</span>
        <button className="btn primary" disabled={busy || pending || credits < e.min || credits > e.available} onClick={withdraw}>{t("wdBtn")}</button>
      </div>
      {e.history.length > 0 && (
        <div className="earn-hist">
          {e.history.map((h) => (
            <div key={h.id} className="earn-row">
              <span className="num">{fmt(h.credits)} → {Number(h.pi).toFixed(4)} π</span>
              <span className={`chip ${h.status === "sent" ? "free" : h.status === "failed" || h.status === "rejected" ? "bad" : "warn"}`}>{t(`wd_${h.status}` as Key)}</span>
              <span className="hint num">{new Date(h.at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
