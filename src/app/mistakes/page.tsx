"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { ISpeaker } from "@/components/Icons";
import { playAudio } from "@/lib/audio";

type M = { word: string; au: string; missed: number; tr: string; ex: string; exTr: string };

/** Words answered wrong in lessons. They come back after two days; practise them any time here. */
export default function Mistakes() {
  const { user, login, tt } = useApp();
  const { dir } = useLearn();
  const [w, setW] = useState<M[] | null>(null);
  useEffect(() => { if (user) fetch("/api/en/mistakes", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setW(d.words || [])).catch(() => setW([])); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <div className="lc stack"><b>{tt("Sign in to see your mistakes")}</b><button className="btn primary" onClick={login}>{tt("Sign in with Pi")}</button></div>;
  if (!w) return <div className="skeleton" style={{ height: 200 }} />;
  return (
    <div className="stack">
      <section><span className="eyebrow">{tt("My mistakes")}</span><h1 style={{ fontSize: 24 }}>{tt("Words to practise again")}</h1>
        <p className="muted small">{tt("Words you got wrong come back after two days. A right answer in practice removes them.")}</p></section>
      {w.length > 0 && <Link className="btn primary lg" href="/review?mode=mistakes">{tt("Practise now")}</Link>}
      {!w.length && <div className="lc"><b>{tt("No mistakes to practise")}</b><div className="muted small">{tt("Great! Words you miss in lessons will show up here.")}</div></div>}
      {w.map((x) => (
        <div key={x.word} className="lc" style={{ padding: 14 }}>
          <div className="row"><b className="grow" dir="ltr" style={{ fontSize: 18 }}>{x.word}</b><span className="native" dir={dir} style={{ fontWeight: 700, color: "var(--primary)" }}>{x.tr}</span><button className="icon-btn" onClick={() => playAudio(x.au, x.word)} aria-label={tt("Listen")}><ISpeaker width={18} height={18} /></button></div>
          <div dir="ltr" className="small" style={{ marginTop: 4 }}>{x.ex}</div>
          <span className="chip bad num" style={{ marginTop: 6 }}>{tt("Missed {n}×", { n: x.missed })}</span>
        </div>
      ))}
    </div>
  );
}
