"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { Portal } from "./Portal";
import { NATIVES, useLearn, type Native } from "./LearnProvider";
import { ICheck, IClose } from "./Icons";
import { post } from "@/lib/pi-client";

const LEVELS = [
  { id: "A1", t: "I'm new to English", s: "Start from the very first words" },
  { id: "A2", t: "I know the basics", s: "I can say simple sentences" },
  { id: "B1", t: "I can hold a conversation", s: "I want to speak more naturally" },
];

/** First-time setup: the language of explanations, the starting level and a daily goal. */
export function Onboarding() {
  const { user, tt, setUiLang } = useApp();
  const { st, native, setNative, refresh } = useLearn();
  const [lang, setLang] = useState<Native>(native);
  const [level, setLevel] = useState("A1");
  const [goal, setGoal] = useState(1);
  const [busy, setBusy] = useState(false);
  if (!user || !st || st.profile.onboarded) return null;

  async function save() {
    setBusy(true);
    setNative(lang);
    await post("/api/en/profile", { native: lang, level, goal, onboarded: true });
    await refresh();
    setBusy(false);
  }
  return (
    <Portal><div className="modal-wrap">
      <div className="modal" role="dialog" aria-modal="true" aria-label={tt("Set up your learning")} style={{ maxHeight: "92dvh", overflow: "auto" }}>
        <div className="row"><h2 style={{ fontSize: 20, flex: 1 }}>{tt("Welcome, {name}", { name: user.username })}</h2><button className="icon-btn" aria-label={tt("Skip for now")} onClick={save} disabled={busy}><IClose width={18} height={18} /></button></div>
        <p className="muted small">{tt("Three quick choices. You can change them later in Me.")}</p>
        <b className="small">{tt("1. Explain things in")}</b>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {NATIVES.map((n) => (
            <button key={n.code} className={`opt${lang === n.code ? " sel" : ""}`} onClick={() => { setLang(n.code); setUiLang(n.code); }}><span dir={n.dir} style={{ flex: 1 }}>{n.label}</span>{lang === n.code && <ICheck width={16} height={16} />}</button>
          ))}
        </div>
        <b className="small">{tt("2. Your English today")}</b>
        <div className="grid" style={{ gap: 8 }}>
          {LEVELS.map((l) => (
            <button key={l.id} className={`opt${level === l.id ? " sel" : ""}`} onClick={() => setLevel(l.id)} style={{ display: "grid", gap: 0 }}>
              <span>{tt(l.t)}</span><span className="hint" style={{ fontWeight: 500 }}>{tt(l.s)}</span>
            </button>
          ))}
        </div>
        <a className="small md-link" href="/placement" style={{ justifySelf: "start" }}>{tt("Not sure? Take the 3-minute level test")}</a>
        <b className="small">{tt("3. Daily goal (XP a day)")}</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[1, 2, 3].map((g) => <button key={g} className={`opt${goal === g ? " sel" : ""}`} onClick={() => setGoal(g)} style={{ justifyContent: "center", display: "grid", gap: 0, textAlign: "center" }}><b className="num">{g * 20} XP</b><span className="hint" style={{ fontWeight: 500 }}>{tt(g === 1 ? "Casual" : g === 2 ? "Regular" : "Serious")}</span></button>)}
        </div>
        <div className="sticky-foot"><button className="btn primary lg" onClick={save} disabled={busy}>{busy ? tt("Saving…") : tt("Start learning")}</button><button className="btn ghost" onClick={save} disabled={busy} style={{ width: "100%" }}>{tt("Skip for now")}</button></div>
      </div>
    </div></Portal>
  );
}
