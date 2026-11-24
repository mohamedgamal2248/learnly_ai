"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { IBolt, ICheck, ISparkle } from "@/components/Icons";
import { LOCALE } from "@/lib/ui-i18n";
import { ensurePiAuth, post, waitForPi } from "@/lib/pi-client";

type Q = { kind: "plan" | "pack"; id: string; credits: number; usd: number; pi: number; rate: number; exp: number; token: string; name?: string; days?: number };
type Quotes = { rate: number; plans: Q[]; packs: Q[]; costs: Record<string, number>; plan: string | null };

const FEATURES: Record<string, string[]> = {
  free: ["The first 6 lessons of the course", "Flash-card review with spaced repetition", "Daily streak and progress", "Pronunciation with your phone's voice"],
  plus: ["All 40 A1 and A2 lessons", "AI tutor in every lesson: ask, practise, get corrected", "Monthly AI credits"],
  pro: ["Everything in Plus", "The 12 B1 lessons and new content first", "More monthly AI credits"],
};

export default function Plans() {
  const { user, login, loggingIn, toast, tt, uiLang } = useApp();
  const { st, refresh, setCredits } = useLearn();
  const [q, setQ] = useState<Quotes | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setErr("");
    try {
      const r = await fetch("/api/credits/quote", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error();
      setQ(await r.json());
    } catch { setErr(tt("Prices are not available right now. Try again in a moment.")); }
  }
  useEffect(() => { load(); waitForPi().then((pi) => { if (pi && user) ensurePiAuth(pi); }); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Quotes last 10 minutes; refresh quietly so the shown price is always payable.
  useEffect(() => {
    if (!q?.plans[0]) return;
    const id = setTimeout(load, Math.max(10_000, q.plans[0].exp - Date.now() - 30_000));
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buy(x: Q) {
    if (!user) { await login(); return; }
    const pi = await waitForPi();
    if (!pi) { toast(tt("Open Learnly AI in Pi Browser to pay.")); return; }
    setBusy(x.kind + x.id); setErr("");
    if (!(await ensurePiAuth(pi))) { setBusy(null); setErr(tt("Could not connect to your Pi wallet.")); return; }
    const label = x.kind === "plan" ? `${x.name} plan` : `${x.credits} AI credits`;
    pi.createPayment(
      { amount: x.pi, memo: `Learnly AI · ${label}`, metadata: { kind: x.kind, id: x.id, q: x.token } },
      {
        onReadyForServerApproval: async (paymentId) => {
          const r = await post("/api/pi/approve", { paymentId });
          if (!r.ok) { setBusy(null); setErr(r.data?.error === "quote_expired" ? tt("The price changed. Please try again.") : r.data?.error === "plan_required" ? tt("Get a plan first, then add credits.") : r.data?.error === "higher_plan_active" ? "You already have a higher plan active." : tt("Payment could not start.")); load(); }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          const r = await post("/api/pi/complete", { paymentId, txid });
          setBusy(null);
          if (r.ok && r.data?.ok) {
            if (r.data.credits != null) setCredits(r.data.credits);
            await refresh();
            toast(x.kind === "plan" ? `${x.name} is active. ${r.data.added} AI credits added.` : `${r.data.added} AI credits added.`);
          } else setErr(tt("The payment went through but could not be applied. Contact support with your username."));
        },
        onCancel: () => { setBusy(null); toast(tt("Payment cancelled.")); },
        onError: () => { setBusy(null); setErr(tt("The payment failed. Nothing was charged.")); },
      },
    );
  }

  const active = st?.sub.plan || q?.plan || null;
  const until = st?.sub.until ? new Date(st.sub.until).toLocaleDateString(LOCALE[uiLang], { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("Plans")}</span><h1 style={{ fontSize: 24 }}>{tt("Unlock every lesson and the AI tutor")}</h1>
        <p className="muted small" style={{ marginTop: 4 }}>{tt("Plans last 30 days and do not renew by themselves.")}</p></section>
      {err && <div className="note bad">{err}</div>}
      {active && <div className="note ok">{tt("Your {plan} plan is active until {date}. Buying a plan again adds 30 more days.", { plan: active === "pro" ? "Pro" : "Plus", date: until })}</div>}

      <section className="lc">
        <div className="row"><b className="big grow">{tt("Free")}</b><span className="chip num">0 π</span></div>
        <ul className="plan-list">{FEATURES.free.map((f) => <li key={f}><ICheck width={16} height={16} />{tt(f)}</li>)}</ul>
      </section>

      {(q?.plans || [null, null]).map((p, i) => {
        const id = p?.id || (i ? "pro" : "plus");
        return (
          <section key={id} className={`lc${id === "pro" ? " hl" : ""}`} style={{ display: "grid", gap: 8 }}>
            <div className="row"><b className="big grow">{id === "pro" ? "Pro" : "Plus"}</b>{id === "pro" && <span className="chip v">{tt("Most complete")}</span>}</div>
            {p ? <div><span className="big num" style={{ fontSize: 30 }}>{p.pi} π</span> <span className="muted small num">{tt("for {n} days", { n: p.days ?? 30 })}</span></div> : <div className="skeleton" style={{ height: 40 }} />}
            <ul className="plan-list">{FEATURES[id].map((f) => <li key={f}><ICheck width={16} height={16} />{tt(f)}</li>)}
              {p && <li><IBolt width={16} height={16} style={{ color: "var(--accent)" }} />{tt("{n} AI credits every purchase", { n: p.credits })}</li>}</ul>
            <button className={`btn lg ${id === "pro" ? "primary" : ""}`} disabled={!p || busy !== null || (id === "plus" && active === "pro")} onClick={() => p && buy(p)}>
              {!user ? (loggingIn ? tt("Signing in…") : tt("Sign in with Pi")) : busy === `plan${id}` ? tt("Waiting for Pi…") : active === id ? tt("Extend {plan}", { plan: id === "pro" ? "Pro" : "Plus" }) : tt("Get {plan}", { plan: id === "pro" ? "Pro" : "Plus" })}
            </button>
          </section>
        );
      })}

      <div className="sec-h" style={{ margin: "10px 2px 0" }}><h2><ISparkle width={18} height={18} style={{ verticalAlign: -3, color: "var(--primary)" }} /> {tt("AI credit packs")}</h2></div>
      <p className="muted small" style={{ marginTop: -6 }}>{tt("Extra credits for the AI tutor.")} {q ? tt("An answer costs {a}–{b} credits.", { a: q.costs.chat ?? 1, b: q.costs.write ?? 3 }) : null} {!active && tt("Available once you have a plan.")}</p>
      <div className="grid" style={{ gap: 10 }}>
        {(q?.packs || []).map((p) => (
          <div key={p.id} className="lc row">
            <div className="ic-sq warm" style={{ width: 46, height: 46, borderRadius: 14 }}><IBolt width={22} height={22} /></div>
            <div className="grow"><b className="num">{tt("{n} credits", { n: p.credits })}</b></div>
            <button className="btn primary" disabled={!active || busy !== null} onClick={() => buy(p)}>{busy === `pack${p.id}` ? "…" : `${p.pi} π`}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
