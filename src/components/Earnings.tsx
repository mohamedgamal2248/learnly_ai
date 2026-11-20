"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type E = {
  balance: number; earned: number; withdrawn: number; min: number; fee: number; address: string | null;
  history: { id: string; pi: number; sent: number | null; address: string | null; status: string; txid: string | null; note: string | null; at: string }[];
};
const ERR: Record<string, Key> = { below_min: "wdBelowMin", pending_exists: "wdPending", not_enough: "wdNotEnough", bad_address: "wdBadAddress" };
const ADDR = /^G[A-Z2-7]{55}$/;
const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-5)}`;
const pi = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
/** Accepts Arabic-Indic digits and a comma as the decimal point. */
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));

/** Creator earnings in Pi, with a withdrawal request (sent by the admin as an app-to-user payment). */
export function Earnings({ hideIfEmpty = false }: { hideIfEmpty?: boolean }) {
  const { t, lang, toast } = useApp();
  const [e, setE] = useState<E | null>(null);
  const [amt, setAmt] = useState("");
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/earnings", { credentials: "include", cache: "no-store" });
    if (r.ok) { const d: E = await r.json(); setE(d); setAmt(String(Math.floor(Number(d.balance) * 10000) / 10000)); setAddr((cur) => cur || d.address || ""); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!e) return hideIfEmpty ? null : <div className="skeleton" style={{ height: 120 }} />;
  if (hideIfEmpty && !(Number(e.earned) > 0) && !e.history.length) return null;

  const value = toNum(amt) || 0;
  const pending = e.history.some((h) => h.status === "pending" || h.status === "sending");
  const min = Number(e.min);
  const fee = Number(e.fee ?? 0.01);
  const address = addr.trim().toUpperCase();
  const addrOk = ADDR.test(address);
  const receive = Math.max(0, value - fee);

  async function withdraw() {
    setBusy(true);
    const r = await post("/api/earnings/withdraw", { pi: value, address });
    setBusy(false);
    if (r.ok) { toast(t("wdRequested")); load(); }
    else toast(t(ERR[r.data?.error] || "errGeneric", { n: pi(r.data?.min ?? min) }));
  }

  return (
    <div className="card earn">
      <div className="earn-top">
        <div><span className="hint">{t("wdAvailable")}</span><b className="num ltr">{pi(e.balance)}</b></div>
        <div><span className="hint">{t("earned")}</span><b className="num ltr">{pi(e.earned)}</b></div>
        <div><span className="hint">{t("wdWithdrawn")}</span><b className="num ltr">{pi(e.withdrawn)}</b></div>
      </div>
      <p className="hint">{t("wdHint", { n: pi(min) })}</p>
      <label className="field"><span>{t("wdAddress")}</span>
        <input className="input ltr" value={addr} onChange={(x) => setAddr(x.target.value.replace(/\s/g, ""))} placeholder="G…" maxLength={56} spellCheck={false} autoCapitalize="characters" aria-invalid={!!addr && !addrOk} />
        <span className="hint">{addr && !addrOk ? t("wdBadAddress") : t("wdAddressHint")}</span>
      </label>
      <div className="earn-form">
        <input className="input ltr" inputMode="decimal" value={amt} onChange={(x) => setAmt(x.target.value.replace(/[^\d٠-٩.,٫]/g, ""))} aria-label={t("wdAmount")} />
        <span className="num earn-pi">π</span>
        <button className="btn primary" disabled={busy || pending || !addrOk || value < min || value > Number(e.balance)} onClick={withdraw}>{t("wdBtn")}</button>
      </div>
      {value >= min && <p className="hint num">{t("wdReceive", { r: pi(receive), f: pi(fee) })}</p>}
      {e.history.length > 0 && (
        <div className="earn-hist">
          {e.history.map((h) => (
            <div key={h.id} className="earn-row">
              <span className="num ltr">{pi(h.pi)}{h.address ? ` → ${short(h.address)}` : ""}</span>
              <span className={`chip ${h.status === "sent" ? "free" : h.status === "failed" || h.status === "rejected" ? "bad" : "warn"}`}>{t(`wd_${h.status}` as Key)}</span>
              <span className="hint num">{new Date(h.at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
