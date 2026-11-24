"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Portal } from "@/components/Portal";
import { useLearn } from "@/components/LearnProvider";
import { Tutor } from "@/components/Tutor";
import { ICheck, IClose, ILock, ISparkle, ISpeaker } from "@/components/Icons";
import { playAudio } from "@/lib/audio";
import { Confetti, GoalRing, ReportSheet, TapText, WordSheet } from "@/components/LessonBits";
import { readQueue, saveGuestLesson, starsFor, writeQueue } from "@/lib/guest";
import { post } from "@/lib/pi-client";

type Word = { en: string; tr: string; ex: string; exTr: string; au: string; exAu: string; tatoeba: number | null };
type Ex =
  | { t: "pick"; w: string; q: string; speak?: string; au?: string; options: string[]; answer: number; dir?: "rtl" }
  | { t: "fill"; w: string; q: string; hint: string; options: string[]; answer: number }
  | { t: "order"; w: string; hint: string; words: string[]; answer: string };
type Lesson = { id: string; level: string; title: string; titleTr: string; intro: string; native: string; words: Word[]; exercises: Ex[]; next: string | null; canAi: boolean };

function Speak({ text, id, big = false }: { text: string; id?: string; big?: boolean }) {
  const { tt } = useApp();
  return <button className={big ? "speak-big" : "icon-btn"} onClick={() => playAudio(id, text)} aria-label={`${tt("Listen")}: ${text}`}><ISpeaker width={big ? 34 : 18} height={big ? 34 : 18} /></button>;
}

function Question({ ex, onDone }: { ex: Ex; onDone: (ok: boolean) => void }) {
  const { tt } = useApp();
  const [sel, setSel] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const spoken = useRef(false);
  useEffect(() => { if (ex.t === "pick" && ex.speak && !spoken.current) { spoken.current = true; playAudio(ex.au, ex.speak); } }, [ex]);

  if (ex.t === "order") {
    const sentence = built.map((i) => ex.words[i]).join(" ");
    const check = () => setChecked(sentence === ex.answer);
    return (
      <div className="stack q-in">
        <b>{tt("Put the words in order")}</b>
        <div className="lc native" style={{ boxShadow: "none", background: "var(--primary-soft)" }}>{ex.hint}</div>
        <div className="lc" style={{ minHeight: 64, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }} dir="ltr">
          {built.map((i, k) => <button key={k} className="chip v" disabled={checked !== null} onClick={() => setBuilt(built.filter((_, j) => j !== k))} style={{ border: 0, fontSize: 15, padding: "6px 12px" }}>{ex.words[i]}</button>)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} dir="ltr">
          {ex.words.map((w, i) => <button key={i} className="chip" disabled={built.includes(i) || checked !== null} onClick={() => setBuilt([...built, i])} style={{ border: "1.5px solid var(--line)", background: "#fff", fontSize: 15, padding: "6px 12px", opacity: built.includes(i) ? 0.3 : 1 }}>{w}</button>)}
        </div>
        {checked === null ? <button className="btn primary lg" disabled={built.length !== ex.words.length} onClick={check}>{tt("Check")}</button> : (
          <>
            <div className={`note ${checked ? "ok" : "bad"}`}>{checked ? tt("Correct!") : <>{tt("Correct answer:")} <b dir="ltr">{ex.answer}</b></>}</div>
            <button className="btn primary lg" onClick={() => onDone(checked)}>{tt("Continue")}</button>
          </>
        )}
      </div>
    );
  }

  const pick = ex;
  const answered = sel !== null;
  return (
    <div className="stack q-in">
      {pick.t === "fill" ? (
        <>
          <b>{tt("Choose the missing word")}</b>
          <div className="lc" dir="ltr" style={{ fontSize: 20, fontWeight: 700 }}>{pick.q}</div>
          <div className="muted native">{pick.hint}</div>
        </>
      ) : pick.q === "listen" ? (
        <>
          <b>{tt("Listen and choose the meaning")}</b>
          <div style={{ display: "grid", placeItems: "center", padding: 10 }}><Speak text={pick.speak!} id={pick.au} big /></div>
        </>
      ) : (
        <>
          <b>{pick.dir === "rtl" || /[^\x00-\x7F]/.test(pick.q) ? tt("Choose the English word") : tt("What does this mean?")}</b>
          <div className="lc native" dir="auto" style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }}>{pick.q}{!/[^\x00-\x7F]/.test(pick.q) && <Speak text={pick.q} id={pick.au} />}</div>
        </>
      )}
      <div className="grid" style={{ gap: 8 }}>
        {pick.options.map((o, i) => (
          <button key={i} className={`opt${answered ? (i === pick.answer ? " ok" : i === sel ? " bad" : "") : ""}`} disabled={answered} onClick={() => setSel(i)} dir="auto">
            <span className="native" style={{ flex: 1 }}>{o}</span>{answered && i === pick.answer && <ICheck width={18} height={18} />}
          </button>
        ))}
      </div>
      {answered && <button className="btn primary lg" onClick={() => onDone(sel === pick.answer)}>{tt("Continue")}</button>}
    </div>
  );
}

function LessonInner() {
  const id = useSearchParams().get("id") || "a1-01";
  const router = useRouter();
  const { user, login, tt } = useApp();
  const { native, refresh, plan } = useLearn();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [stage, setStage] = useState<"intro" | "practice" | "done">("intro");
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ gain: number; xp: number; streak: number; freezes?: number; used_freeze?: boolean; goal_reached?: boolean; xp_today?: number; xp_goal?: number } | null>(null);
  const [help, setHelp] = useState(false);
  const [missed, setMissed] = useState<string[]>([]);
  const [wordSheet, setWordSheet] = useState<string | null>(null);
  const [report, setReport] = useState<{ word?: string } | null>(null);
  const started = useRef(Date.now());
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    setLesson(null); setLocked(null); setStage("intro"); setI(0); setScore(0); setResult(null); setMissed([]); setQueued(false);
    fetch(`/api/en/lesson?id=${encodeURIComponent(id)}&native=${native}`, { credentials: "include", cache: "no-store" }).then(async (r) => {
      const d = await r.json();
      if (r.status === 402) setLocked(d.title || "");
      else if (r.ok) setLesson(d);
    }).catch(() => {});
  }, [id, native, user?.id, plan]);

  const total = lesson?.exercises.length || 0;
  async function finish(finalScore: number, missedWords: string[]) {
    setStage("done");
    if (!lesson) return;
    const score10 = Math.round((finalScore / Math.max(total, 1)) * 10);
    if (!user) { saveGuestLesson(lesson.id, score10); return; }
    const body = { lessonId: lesson.id, score: score10, missed: missedWords, correct: finalScore, answers: total, seconds: Math.round((Date.now() - started.current) / 1000) };
    try {
      const r = await post("/api/en/complete", body);
      if (r.ok) { setResult(r.data); refresh(); return; }
      if (r.status < 500 && r.status !== 429) return;
    } catch {}
    // No connection: keep the result and send it later.
    writeQueue([...readQueue(), body]); setQueued(true);
  }

  if (locked) {
    return (
      <div className="stack" style={{ paddingTop: 30 }}>
        <div className="lc warm" style={{ display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
          <div className="ic-sq warm"><ILock width={26} height={26} /></div>
          <b className="big">{tt("{name} is locked", { name: locked })}</b>
          <p className="small" style={{ color: "#8A5A00" }}>{tt("Plus and Pro open every lesson and the AI tutor.")}</p>
          <Link className="btn primary" href="/plans">{tt("See plans")}</Link>
          <Link className="btn ghost" href="/learn">{tt("Back to lessons")}</Link>
        </div>
      </div>
    );
  }
  if (!lesson) return <div className="stack"><div className="skeleton" style={{ height: 80 }} /><div className="skeleton" style={{ height: 240 }} /></div>;

  const dirN = native === "ar" ? "rtl" : "ltr";
  return (
    <div className="stack">
      <div className="row">
        <Link href="/learn" className="icon-btn" aria-label={tt("Close")}><IClose width={18} height={18} /></Link>
        <div className="grow"><div className="prog"><i style={{ width: `${stage === "intro" ? 4 : stage === "done" ? 100 : (i / Math.max(total, 1)) * 100}%` }} /></div></div>
        <button className="pill" onClick={() => setHelp(true)} aria-label={tt("Ask AI")}><ISparkle width={16} height={16} /> {tt("Ask AI")}</button>
      </div>

      {stage === "intro" && (
        <>
          <section className="lc hl">
            <span className="eyebrow">{lesson.level} · {tt("Lesson")}</span>
            <h1 style={{ fontSize: 24 }}>{lesson.title}</h1>
            <div className="muted native" dir={dirN}>{lesson.titleTr}</div>
            <p dir={dirN} className="native" style={{ marginTop: 10, lineHeight: 1.8 }}>{lesson.intro}</p>
          </section>
          <div className="stack">
            {lesson.words.map((w) => (
              <div key={w.en} className="lc" style={{ padding: 14 }}>
                <div className="row"><b style={{ fontSize: 18 }} dir="ltr" className="grow">{w.en}</b><span className="native" dir="auto" style={{ fontWeight: 700, color: "var(--primary)" }}>{w.tr}</span><Speak text={w.en} id={w.au} /></div>
                <div dir="ltr" className="small row" style={{ marginTop: 6, gap: 6 }}><span className="grow"><TapText text={w.ex} onWord={setWordSheet} /></span><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => playAudio(w.exAu, w.ex)} aria-label={tt("Listen")}><ISpeaker width={14} height={14} /></button></div>
                <div className="muted small native" dir={dirN}>{w.exTr}</div>
                <button type="button" className="hint md-link" style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }} onClick={() => setReport({ word: w.en })}>⚑ {tt("Report a mistake")}</button>
                {w.tatoeba && <a className="hint md-link" style={{ marginInlineStart: 10 }} href={`https://tatoeba.org/sentences/show/${w.tatoeba}`} target="_blank" rel="noreferrer">Tatoeba #{w.tatoeba}</a>}
              </div>
            ))}
          </div>
          <p className="hint" style={{ textAlign: "center" }}>{tt("Words from the CEFR-J list. Some sentences from Tatoeba (CC BY 2.0 FR).")} <Link className="md-link" href="/credits">{tt("Credits")}</Link></p>
          <button className="btn primary lg" onClick={() => { started.current = Date.now(); setStage("practice"); }}>{tt("Start practice")}</button>
        </>
      )}

      {stage === "practice" && lesson.exercises[i] && (
        <Question key={i} ex={lesson.exercises[i]} onDone={(ok) => { const s = score + (ok ? 1 : 0); const m = ok ? missed : Array.from(new Set([...missed, lesson.exercises[i].w])); if (!ok) setMissed(m); if (ok) setScore(s); if (i + 1 >= total) finish(s, m); else setI(i + 1); }} />
      )}

      {stage === "done" && (
        <section className="lc" style={{ display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
          {result?.goal_reached && <Confetti />}
          <div className="ic-sq ok" style={{ width: 64, height: 64, borderRadius: 20 }}><ICheck width={34} height={34} /></div>
          <h1 style={{ fontSize: 24 }}>{tt("Lesson complete!")}</h1>
          <span className="stars big-stars" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= starsFor(true, Math.round((score / Math.max(total, 1)) * 10)) ? "on" : ""}>★</i>)}</span>
          <div className="big num">{tt("{a} / {b} correct", { a: score, b: total })}</div>
          {result ? (
            <>
              <div className="muted"><b className="num">+{result.gain} XP</b> · {tt(result.streak === 1 ? "{n} day in a row" : "{n} days in a row", { n: result.streak })}</div>
              {result.xp_goal ? <div className="row" style={{ gap: 12 }}><GoalRing value={result.xp_today ?? 0} goal={result.xp_goal} size={56} /><div style={{ textAlign: "start" }}><b>{result.goal_reached ? tt("Daily goal reached!") : tt("Daily goal")}</b><div className="muted small num">{tt("{a} / {b} XP today", { a: result.xp_today ?? 0, b: result.xp_goal })}</div></div></div> : null}
              {result.used_freeze && <div className="note ok">{tt("A streak freeze saved your streak yesterday.")}</div>}
              {missed.length > 0 && <Link className="btn" href="/review?mode=mistakes">{tt("Practise {n} missed words", { n: missed.length })}</Link>}
            </>
          ) : user ? <div className="muted small">{queued ? tt("No connection. Your result will be saved when you are online.") : tt("Saving…")}</div> : (
            <div className="note" style={{ textAlign: "start", display: "grid", gap: 8 }}>
              <b>{tt("Great start! Sign in to keep your progress.")}</b>
              <span>{tt("Sign in with Pi to save your progress and streak.")}</span>
              <button className="btn primary" onClick={login}>{tt("Sign in with Pi")}</button>
            </div>
          )}
          {lesson.next && <button className="btn primary lg" onClick={() => router.push(`/lesson?id=${lesson.next}`)}>{tt("Next lesson")}</button>}
          <Link className="btn lg" href={user ? "/" : "/learn"}>{user ? tt("Back to Today") : tt("See all lessons")}</Link>
          <button type="button" className="hint md-link" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => setReport({})}>⚑ {tt("Report a mistake")}</button>
        </section>
      )}

      {wordSheet && <WordSheet word={wordSheet} onClose={() => setWordSheet(null)} />}
      {report && <ReportSheet lessonId={lesson.id} word={report.word} onClose={() => setReport(null)} />}

      {help && (
        <Portal>
        <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) setHelp(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={tt("Ask AI")} style={{ maxHeight: "88dvh", overflow: "auto" }}>
            <div className="row"><h2 style={{ flex: 1, fontSize: 18 }}>{tt("Ask the AI about this lesson")}</h2><button className="icon-btn" aria-label={tt("Close")} onClick={() => setHelp(false)}><IClose width={18} height={18} /></button></div>
            <Tutor lessonId={lesson.id} lessonTitle={lesson.title} compact />
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

export default function LessonPage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}><LessonInner /></Suspense>;
}
