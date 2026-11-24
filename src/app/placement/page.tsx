"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { IClose } from "@/components/Icons";
import { post } from "@/lib/pi-client";

type Q = { id: string; level: string; q: string; options: string[] };
type Result = { level: "A1" | "A2" | "B1"; right: Record<string, number>; total: number; start: string };

const MEANING: Record<string, string> = { A1: "Beginner: you are starting with the first words and simple sentences.", A2: "Elementary: you know the basics and can talk about everyday things.", B1: "Intermediate: you can deal with most situations and give opinions." };

/** A short placement test: 15 multiple-choice questions, five per level. */
export default function Placement() {
  const { user } = useApp();
  const { refresh } = useLearn();
  const [qs, setQs] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => { fetch("/api/en/placement", { cache: "no-store" }).then((r) => r.json()).then((d) => setQs(d.questions)).catch(() => setErr(true)); }, []);

  async function next() {
    if (!qs || sel === null) return;
    const a = { ...answers, [qs[i].id]: sel };
    setAnswers(a); setSel(null);
    if (i + 1 < qs.length) { setI(i + 1); return; }
    const r = await post("/api/en/placement", { answers: a });
    if (r.ok) { setRes(r.data); if (user) refresh(); } else setErr(true);
  }

  if (err) return <div className="note bad">Something went wrong. <Link className="md-link" href="/placement">Try again</Link></div>;
  if (!qs) return <div className="skeleton" style={{ height: 240 }} />;

  if (res) {
    return (
      <div className="stack">
        <section className="lc hl" style={{ textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
          <span className="eyebrow">Your level</span>
          <div className="big" style={{ fontSize: 48 }}>{res.level}</div>
          <p className="muted">{MEANING[res.level]}</p>
          <p className="small muted num">A1: {res.right.A1}/5 · A2: {res.right.A2}/5 · B1: {res.right.B1}/5</p>
          {user ? <div className="note ok">Saved to your profile.</div> : <div className="note">Sign in with Pi to save your level.</div>}
        </section>
        <Link className="btn primary lg" href={`/lesson?id=${res.start}`}>Start at the first {res.level} lesson</Link>
        <Link className="btn lg" href="/learn">See all lessons</Link>
        <p className="hint" style={{ textAlign: "center" }}>This is a quick estimate. You can change your level any time in Me.</p>
      </div>
    );
  }

  const q = qs[i];
  return (
    <div className="stack">
      <div className="row">
        <Link href="/" className="icon-btn" aria-label="Close"><IClose width={18} height={18} /></Link>
        <div className="grow"><div className="prog"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div></div>
        <span className="chip num">{i + 1}/{qs.length}</span>
      </div>
      <b>Choose the correct answer</b>
      <div className="lc" dir="ltr" style={{ fontSize: 22, fontWeight: 700 }}>{q.q}</div>
      <div className="grid" style={{ gap: 8 }}>
        {q.options.map((o) => <button key={o} dir="ltr" className={`opt${sel === o ? " sel" : ""}`} onClick={() => setSel(o)}>{o}</button>)}
      </div>
      <button className="btn primary lg" disabled={sel === null} onClick={next}>{i + 1 === qs.length ? "See my level" : "Next"}</button>
      <button className="btn ghost" onClick={() => { setSel("(skipped)"); }} style={{ justifySelf: "center" }}>I don&apos;t know</button>
    </div>
  );
}
