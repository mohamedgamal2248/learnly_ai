"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Earnings } from "@/components/Earnings";
import { TopUp } from "@/components/TopUp";

/** One place for the Pi balance: add Pi (to post tasks and hire people) and withdraw earnings to your own wallet. */
export default function WalletPage() {
  const { t, user, ready, login } = useApp();
  const [n, setN] = useState(0);
  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>;
  return (
    <div className="grid" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card"><h1 style={{ fontSize: 20 }}>{t("wlTitle")}</h1><p className="hint">{t("wlSub")}</p></div>
      <TopUp onDone={() => setN((x) => x + 1)} />
      <Earnings key={n} />
      <Ledger key={`l${n}`} />
    </div>
  );
}

type LRow = { id: number; delta: number; kind: string; at: string; title: string | null };
const KINDS = ["deposit", "task_hold", "task_refund", "task_reward", "withdraw", "withdraw_refund", "admin_grant", "course_sale", "message_fee"];

/** Every movement of the Pi balance: added, held for a task, refunded, earned, withdrawn. */
function Ledger() {
  const { t, lang, toast } = useApp();
  const [rows, setRows] = useState<LRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset: number) => {
    const r = await fetch(`/api/ledger?limit=20&offset=${offset}`, { credentials: "include", cache: "no-store" });
    if (!r.ok) { setRows((c) => c || []); return; }
    const d = await r.json();
    setRows((c) => (offset ? [...(c || []), ...d.rows] : d.rows)); setTotal(d.total);
  }, []);
  useEffect(() => { load(0); }, [load]);
  async function copyCsv() {
    const r = await fetch("/api/ledger?format=csv", { credentials: "include" });
    if (!r.ok) { toast(t("errGeneric")); return; }
    const text = await r.text();
    try { await navigator.clipboard.writeText(text); toast(t("lgCopied")); } catch { toast(t("errGeneric")); }
  }
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <b style={{ flex: 1 }}>{t("lgTitle")}</b>
        <button className="btn sm" onClick={copyCsv}>{t("lgCsv")}</button>
      </div>
      {!rows ? <div className="skeleton" style={{ height: 80 }} /> : !rows.length ? <span className="hint">{t("lgNone")}</span> : (
        <div className="grid" style={{ gap: 0 }}>
          {rows.map((x) => (
            <div key={x.id} className="earn-row" style={{ alignItems: "flex-start" }}>
              <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                <span className="small">{KINDS.includes(x.kind) ? t(`lg_${x.kind}` as never) : x.kind}</span>
                {x.title && <span className="hint" style={{ overflowWrap: "anywhere" }}>{x.title}</span>}
                <span className="hint num">{new Date(x.at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
              </span>
              <b className="num ltr" style={{ marginInlineStart: "auto", color: x.delta > 0 ? "var(--ok, #2E9E5B)" : "var(--text)" }}>{fmt(x.delta)}</b>
            </div>
          ))}
        </div>
      )}
      {rows && rows.length < total && <button className="btn sm" style={{ justifySelf: "center" }} disabled={busy} onClick={async () => { setBusy(true); await load(rows.length); setBusy(false); }}>{t("loadMore", { n: total - rows.length })}</button>}
    </div>
  );
}
