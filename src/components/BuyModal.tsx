"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { IClose, IRefresh } from "./Icons";
import { post, waitForPi } from "@/lib/pi-client";

type Quote = { pack: string; credits: number; usd: number; pi: number; rate: number; exp: number; token: string };

const BONUS: Record<string, number> = { s: 0, m: 10, l: 20 };

export function BuyModal() {
  const { t, lang, closeBuy, setCredits, toast } = useApp();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [rate, setRate] = useState(0);
  const [sel, setSel] = useState("m");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(""); setQuotes(null);
    try {
      const r = await fetch("/api/credits/quote", { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setQuotes(d.quotes); setRate(d.rate);
    } catch { setErr(t("priceErr")); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quotes expire after 10 minutes; refresh quietly so the shown price is always payable.
  useEffect(() => {
    if (!quotes) return;
    const id = setTimeout(load, Math.max(10_000, quotes[0].exp - Date.now() - 30_000));
    return () => clearTimeout(id);
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = quotes?.find((x) => x.pack === sel);
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  async function pay() {
    if (!q) return;
    const pi = await waitForPi();
    if (!pi) { toast(t("openInPi")); return; }
    setBusy(true);
    pi.createPayment(
      { amount: q.pi, memo: `Learnly AI · ${q.credits} credits`, metadata: { pack: q.pack, q: q.token } },
      {
        onReadyForServerApproval: async (paymentId) => {
          const r = await post("/api/pi/approve", { paymentId });
          if (!r.ok) { setBusy(false); setErr(r.data?.error === "quote_expired" ? t("priceErr") : t("payErr")); }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          const r = await post("/api/pi/complete", { paymentId, txid });
          setBusy(false);
          if (r.ok && r.data?.ok) {
            setCredits(r.data.credits);
            toast(t("paid", { n: fmt(r.data.added ?? q.credits) }));
            closeBuy();
          } else setErr(t("payErr"));
        },
        onCancel: () => { setBusy(false); toast(t("payCancelled")); },
        onError: () => { setBusy(false); setErr(t("payErr")); },
      },
    );
  }

  return (
    <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget && !busy) closeBuy(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="buy-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 id="buy-title" style={{ fontSize: 18 }}>{t("buyTitle")}</h2>
          <button className="icon-btn" aria-label={t("close")} onClick={closeBuy} disabled={busy}><IClose width={18} height={18} /></button>
        </div>
        <p className="muted small">{t("buySub")}</p>
        {rate > 0 && (
          <div className="chips" style={{ alignItems: "center" }}>
            <span className="chip v ltr num">{t("rate", { r: rate.toFixed(4) })}</span>
            <span className="chip">{t("validFor")}</span>
            <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="Refresh" onClick={load} disabled={busy}><IRefresh width={15} height={15} /></button>
          </div>
        )}
        <div className="packs">
          {quotes
            ? quotes.map((x) => (
              <button key={x.pack} className={`pack${sel === x.pack ? " on" : ""}`} onClick={() => setSel(x.pack)} disabled={busy}>
                <span>
                  <b className="num">{fmt(x.credits)}</b> {t("credits")}{" "}
                  {x.pack === "m" && <span className="chip free">{t("popular")}</span>}{" "}
                  {BONUS[x.pack] > 0 && <span className="chip v">{t("bonus", { n: BONUS[x.pack] })}</span>}
                </span>
                <span className="pi num ltr">{x.pi} π</span>
              </button>
            ))
            : !err && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
        </div>
        {err && <div className="notice bad">{err}</div>}
        <p className="hint">{t("noCash")}</p>
        <button className="btn primary block" onClick={pay} disabled={!q || busy}>
          {busy ? t("paying") : q ? t("payPi", { pi: q.pi }) : "…"}
        </button>
      </div>
    </div>
  );
}
