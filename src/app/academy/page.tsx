"use client";

import Link from "next/link";
import { IAlert, IAward, IBook, ICheck, ICode, ICompass, IWallet, IconTile } from "@/components/Icons";
import { LinkCard } from "@/components/Web";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";

import { LESSONS, type Q } from "@/lib/academy";

const ICONS: Record<string, React.ReactNode> = { wallet: <IWallet />, scams: <IAlert />, browser: <ICompass />, build: <ICode /> };
const TONES = ["blue", "pink", "teal", "amber"] as const;

function loadAnswers(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem("ln-academy-ans") || "{}"); } catch { return {}; }
}

function loadDone(): string[] {
  try { return JSON.parse(localStorage.getItem("ln-academy") || "[]"); } catch { return []; }
}

export default function AcademyPage() {
  const { t, lang, user, login, toast } = useApp();
  const [certBusy, setCertBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  useEffect(() => { setAnswers(loadAnswers()); }, []);
  const saveAnswers = (id: string, a: number[]) => setAnswers((cur) => {
    const next = { ...cur, [id]: a };
    try { localStorage.setItem("ln-academy-ans", JSON.stringify(next)); } catch {}
    return next;
  });
  async function getCert() {
    if (!user) { await login(); return; }
    setCertBusy(true);
    const r = await fetch("/api/certs/academy", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    const d = await r.json().catch(() => ({}));
    setCertBusy(false);
    if (r.ok && d.id) location.href = `/cert?id=${d.id}`;
    else toast(t(d.error === "not_passed" ? "certNotPassed" : "errGeneric"));
  }
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setDone(loadDone()); }, []);

  const lessons = LESSONS[lang];
  const markDone = (id: string) => {
    const next = done.includes(id) ? done : [...done, id];
    setDone(next);
    try { localStorage.setItem("ln-academy", JSON.stringify(next)); } catch {}
  };
  const pct = Math.round((done.length / lessons.length) * 100);

  return (
    <div className="grid" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="hero-card">
        <div className="ring" style={{ ["--p" as string]: pct }} aria-label={`${pct}%`}><span className="num">{pct}%</span></div>
        <div style={{ display: "grid", gap: 4 }}>
          <h1>{t("acTitle")} <span className="chip free">{t("free")}</span></h1>
          <p>{t("acSub")}</p>
          <span className="hero-sub num">{done.length === lessons.length ? t("allDone") : t("acDone", { n: done.length, t: lessons.length })}</span>
        </div>
      </div>
      {done.length === lessons.length && (
        <div className="card cert-cta">
          <IconTile size={48} tone="amber"><IAward /></IconTile>
          <div style={{ flex: 1 }}><b>{t("certCta")}</b><p className="hint">{t("certCtaSub")}</p></div>
          <button className="btn primary" disabled={certBusy} onClick={getCert}>{certBusy ? t("preparing") : t("certGet")}</button>
        </div>
      )}
      <div className="grid stagger">
        {lessons.map((l, i) => {
          const isDone = done.includes(l.id);
          const isOpen = open === l.id;
          return (
            <section key={l.id} className={`card lesson lesson-${i % 4}${isDone ? " done" : ""}${isOpen ? " open" : ""}`}>
              <button className="lesson-head" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen}>
                {isDone ? <IconTile tone="green"><ICheck /></IconTile> : <IconTile tone={TONES[i % 4]}>{ICONS[l.id] || <IBook />}</IconTile>}
                <span className="lesson-tt">
                  <span className="lesson-n num">{t("lessonN", { n: i + 1 })}</span>
                  <h2>{l.title}</h2>
                  <span className="hint">{t("lessonMeta", { p: l.points.length, q: l.quiz.length })}</span>
                </span>
                {isDone ? <span className="chip free">{t("completed")}</span> : <span className="lesson-chev" aria-hidden="true">⌄</span>}
              </button>
              {isOpen && (
                <div className="grid" style={{ gap: 12, animation: "rise .25s both" }}>
                  <ul>{l.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  <Quiz quiz={l.quiz} onPass={(a) => { saveAnswers(l.id, a); markDone(l.id); }} />
                  <div className="row-actions">
                    {!isDone && <button className="btn ok sm" onClick={() => markDone(l.id)}>{t("markDone")}</button>}
                    <Link className="btn sm" href={`/chat?q=${encodeURIComponent(`${l.title}: `)}`}>{t("askLesson")}</Link>
                  </div>
                  <LinkCard url={l.link} title={t("readMore")} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Quiz({ quiz, onPass }: { quiz: Q[]; onPass: (answers: number[]) => void }) {
  const { t } = useApp();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const allRight = quiz.every((q, i) => picked[i] === q.answer);
  useEffect(() => { if (allRight) onPass(quiz.map((_, i) => picked[i])); }, [allRight]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid" style={{ gap: 10, background: "var(--surface-2)", borderRadius: 12, padding: 12 }}>
      <b className="small">{t("quiz")}</b>
      {quiz.map((q, i) => (
        <div key={i} style={{ display: "grid", gap: 6 }}>
          <span className="small">{q.q}</span>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {q.options.map((o, j) => {
              const chosen = picked[i] === j;
              const cls = chosen ? (j === q.answer ? "chip free" : "chip bad") : "pill";
              return <button key={j} className={cls} style={{ padding: "6px 12px", border: chosen ? 0 : undefined, cursor: "pointer" }} onClick={() => setPicked({ ...picked, [i]: j })}>{o}</button>;
            })}
          </div>
          {picked[i] !== undefined && <span className="hint">{picked[i] === q.answer ? t("correct") : t("wrongAns")}</span>}
        </div>
      ))}
    </div>
  );
}
