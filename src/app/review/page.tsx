"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { ICheck, IClose, ISpeaker } from "@/components/Icons";
import { canSpeak, speak } from "@/lib/learn-client";
import { post } from "@/lib/pi-client";

type Card = { word: string; ex: string; exTr: string; options: string[]; answer: number; tr: string };

/** Flash cards for the words that are due today (spaced repetition: right answers come back later, wrong ones tomorrow). */
export default function Review() {
  const { user, login, tt } = useApp();
  const { native, refresh } = useLearn();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [right, setRight] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch("/api/en/review", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setCards(d.cards || [])).catch(() => setCards([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <div className="lc stack"><b>{tt("Sign in to review your words")}</b><button className="btn primary" onClick={login}>{tt("Sign in with Pi")}</button></div>;
  if (!cards) return <div className="skeleton" style={{ height: 260 }} />;
  const dirN = native === "ar" ? "rtl" : "ltr";
  if (!cards.length || i >= cards.length) {
    return (
      <div className="stack" style={{ paddingTop: 24 }}>
        <section className="lc" style={{ display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
          <div className="ic-sq ok" style={{ width: 64, height: 64, borderRadius: 20 }}><ICheck width={34} height={34} /></div>
          <h1 style={{ fontSize: 22 }}>{cards.length ? tt("{a} of {b} right", { a: right, b: cards.length }) : tt("Nothing to review right now")}</h1>
          <p className="muted small">{cards.length ? tt("Words you missed come back tomorrow.") : tt("Finish a lesson and its words will show up here.")}</p>
          <Link className="btn primary lg" href="/" onClick={() => refresh()}>{tt("Back to Today")}</Link>
        </section>
      </div>
    );
  }
  const c = cards[i];
  const answered = sel !== null;
  function choose(k: number) {
    if (answered) return;
    setSel(k);
    const ok = k === c.answer;
    if (ok) setRight((r) => r + 1);
    post("/api/en/review", { word: c.word, ok });
  }
  return (
    <div className="stack">
      <div className="row">
        <Link href="/" className="icon-btn" aria-label={tt("Close")}><IClose width={18} height={18} /></Link>
        <div className="grow"><div className="prog"><i style={{ width: `${(i / cards.length) * 100}%` }} /></div></div>
        <span className="chip num">{i + 1}/{cards.length}</span>
      </div>
      <section className="lc" style={{ textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
        <span className="eyebrow">{tt("What does it mean?")}</span>
        <div className="big" dir="ltr" style={{ fontSize: 30 }}>{c.word}</div>
        {canSpeak() && <button className="icon-btn" onClick={() => speak(c.word)} aria-label={tt("Listen")}><ISpeaker width={18} height={18} /></button>}
        <div className="muted small" dir="ltr">{c.ex}</div>
      </section>
      <div className="grid" style={{ gap: 8 }}>
        {c.options.map((o, k) => (
          <button key={k} className={`opt${answered ? (k === c.answer ? " ok" : k === sel ? " bad" : "") : ""}`} disabled={answered} onClick={() => choose(k)} dir="auto"><span className="native" style={{ flex: 1 }}>{o}</span></button>
        ))}
      </div>
      {answered && (
        <>
          <div className="muted small native" dir={dirN}>{c.exTr}</div>
          <button className="btn primary lg" onClick={() => { setSel(null); setI(i + 1); }}>{i + 1 >= cards.length ? tt("Finish") : tt("Next")}</button>
        </>
      )}
    </div>
  );
}
