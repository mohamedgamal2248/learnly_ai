"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useLearn } from "@/components/LearnProvider";
import { Tutor } from "@/components/Tutor";
import { ICheck, IClose, ILock, ISparkle, ISpeaker } from "@/components/Icons";
import { canSpeak, speak } from "@/lib/learn-client";
import { post } from "@/lib/pi-client";

type Word = { en: string; tr: string; ex: string; exTr: string };
type Ex =
  | { t: "pick"; q: string; speak?: string; options: string[]; answer: number; dir?: "rtl" }
  | { t: "fill"; q: string; hint: string; options: string[]; answer: number }
  | { t: "order"; hint: string; words: string[]; answer: string };
type Lesson = { id: string; level: string; title: string; titleTr: string; intro: string; native: string; words: Word[]; exercises: Ex[]; next: string | null; canAi: boolean };

function Speak({ text, big = false }: { text: string; big?: boolean }) {
  if (!canSpeak()) return null;
  return <button className={big ? "speak-big" : "icon-btn"} onClick={() => speak(text)} aria-label={`Listen: ${text}`}><ISpeaker width={big ? 34 : 18} height={big ? 34 : 18} /></button>;
}

function Question({ ex, onDone }: { ex: Ex; onDone: (ok: boolean) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const spoken = useRef(false);
  useEffect(() => { if (ex.t === "pick" && ex.speak && !spoken.current) { spoken.current = true; speak(ex.speak); } }, [ex]);

  if (ex.t === "order") {
    const sentence = built.map((i) => ex.words[i]).join(" ");
    const check = () => setChecked(sentence === ex.answer);
    return (
      <div className="stack">
        <b>Put the words in order</b>
        <div className="lc native" style={{ boxShadow: "none", background: "var(--primary-soft)" }}>{ex.hint}</div>
        <div className="lc" style={{ minHeight: 64, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }} dir="ltr">
          {built.map((i, k) => <button key={k} className="chip v" disabled={checked !== null} onClick={() => setBuilt(built.filter((_, j) => j !== k))} style={{ border: 0, fontSize: 15, padding: "6px 12px" }}>{ex.words[i]}</button>)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} dir="ltr">
          {ex.words.map((w, i) => <button key={i} className="chip" disabled={built.includes(i) || checked !== null} onClick={() => setBuilt([...built, i])} style={{ border: "1.5px solid var(--line)", background: "#fff", fontSize: 15, padding: "6px 12px", opacity: built.includes(i) ? 0.3 : 1 }}>{w}</button>)}
        </div>
        {checked === null ? <button className="btn primary lg" disabled={built.length !== ex.words.length} onClick={check}>Check</button> : (
          <>
            <div className={`note ${checked ? "ok" : "bad"}`}>{checked ? "Correct!" : <>Correct answer: <b dir="ltr">{ex.answer}</b></>}</div>
            <button className="btn primary lg" onClick={() => onDone(checked)}>Continue</button>
          </>
        )}
      </div>
    );
  }

  const pick = ex;
  const answered = sel !== null;
  return (
    <div className="stack">
      {pick.t === "fill" ? (
        <>
          <b>Choose the missing word</b>
          <div className="lc" dir="ltr" style={{ fontSize: 20, fontWeight: 700 }}>{pick.q}</div>
          <div className="muted native">{pick.hint}</div>
        </>
      ) : pick.q === "listen" ? (
        <>
          <b>Listen and choose the meaning</b>
          <div style={{ display: "grid", placeItems: "center", padding: 10 }}><Speak text={pick.speak!} big /></div>
        </>
      ) : (
        <>
          <b>{pick.dir === "rtl" || /[^\x00-\x7F]/.test(pick.q) ? "Choose the English word" : "What does this mean?"}</b>
          <div className="lc native" dir="auto" style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }}>{pick.q}{!/[^\x00-\x7F]/.test(pick.q) && <Speak text={pick.q} />}</div>
        </>
      )}
      <div className="grid" style={{ gap: 8 }}>
        {pick.options.map((o, i) => (
          <button key={i} className={`opt${answered ? (i === pick.answer ? " ok" : i === sel ? " bad" : "") : ""}`} disabled={answered} onClick={() => setSel(i)} dir="auto">
            <span className="native" style={{ flex: 1 }}>{o}</span>{answered && i === pick.answer && <ICheck width={18} height={18} />}
          </button>
        ))}
      </div>
      {answered && <button className="btn primary lg" onClick={() => onDone(sel === pick.answer)}>Continue</button>}
    </div>
  );
}

function LessonInner() {
  const id = useSearchParams().get("id") || "a1-1";
  const router = useRouter();
  const { user, login } = useApp();
  const { native, refresh, plan } = useLearn();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [stage, setStage] = useState<"intro" | "practice" | "done">("intro");
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ gain: number; xp: number; streak: number } | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setLesson(null); setLocked(null); setStage("intro"); setI(0); setScore(0); setResult(null);
    fetch(`/api/en/lesson?id=${encodeURIComponent(id)}&native=${native}`, { credentials: "include", cache: "no-store" }).then(async (r) => {
      const d = await r.json();
      if (r.status === 402) setLocked(d.title || "This lesson");
      else if (r.ok) setLesson(d);
    }).catch(() => {});
  }, [id, native, user?.id, plan]);

  const total = lesson?.exercises.length || 0;
  async function finish(finalScore: number) {
    setStage("done");
    if (!user || !lesson) return;
    const r = await post("/api/en/complete", { lessonId: lesson.id, score: Math.round((finalScore / Math.max(total, 1)) * 10) });
    if (r.ok) { setResult(r.data); refresh(); }
  }

  if (locked) {
    return (
      <div className="stack" style={{ paddingTop: 30 }}>
        <div className="lc warm" style={{ display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
          <div className="ic-sq warm"><ILock width={26} height={26} /></div>
          <b className="big">{locked} is locked</b>
          <p className="small" style={{ color: "#8A5A00" }}>Plus and Pro open every lesson and the AI tutor.</p>
          <Link className="btn primary" href="/plans">See plans</Link>
          <Link className="btn ghost" href="/learn">Back to lessons</Link>
        </div>
      </div>
    );
  }
  if (!lesson) return <div className="stack"><div className="skeleton" style={{ height: 80 }} /><div className="skeleton" style={{ height: 240 }} /></div>;

  const dirN = native === "ar" ? "rtl" : "ltr";
  return (
    <div className="stack">
      <div className="row">
        <Link href="/learn" className="icon-btn" aria-label="Close lesson"><IClose width={18} height={18} /></Link>
        <div className="grow"><div className="prog"><i style={{ width: `${stage === "intro" ? 4 : stage === "done" ? 100 : (i / Math.max(total, 1)) * 100}%` }} /></div></div>
        <button className="pill" onClick={() => setHelp(true)} aria-label="Ask the AI"><ISparkle width={16} height={16} /> Ask AI</button>
      </div>

      {stage === "intro" && (
        <>
          <section className="lc hl">
            <span className="eyebrow">{lesson.level} · Lesson</span>
            <h1 style={{ fontSize: 24 }}>{lesson.title}</h1>
            <div className="muted native" dir={dirN}>{lesson.titleTr}</div>
            <p dir={dirN} className="native" style={{ marginTop: 10, lineHeight: 1.8 }}>{lesson.intro}</p>
          </section>
          <div className="stack">
            {lesson.words.map((w) => (
              <div key={w.en} className="lc" style={{ padding: 14 }}>
                <div className="row"><b style={{ fontSize: 18 }} dir="ltr" className="grow">{w.en}</b><span className="native" dir="auto" style={{ fontWeight: 700, color: "var(--primary)" }}>{w.tr}</span><Speak text={w.en} /></div>
                <div dir="ltr" className="small row" style={{ marginTop: 6, gap: 6 }}><span className="grow">{w.ex}</span><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => speak(w.ex)} aria-label="Listen to the sentence"><ISpeaker width={14} height={14} /></button></div>
                <div className="muted small native" dir={dirN}>{w.exTr}</div>
              </div>
            ))}
          </div>
          <button className="btn primary lg" onClick={() => setStage("practice")}>Start practice</button>
        </>
      )}

      {stage === "practice" && lesson.exercises[i] && (
        <Question key={i} ex={lesson.exercises[i]} onDone={(ok) => { const s = score + (ok ? 1 : 0); if (ok) setScore(s); if (i + 1 >= total) finish(s); else setI(i + 1); }} />
      )}

      {stage === "done" && (
        <section className="lc" style={{ display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
          <div className="ic-sq ok" style={{ width: 64, height: 64, borderRadius: 20 }}><ICheck width={34} height={34} /></div>
          <h1 style={{ fontSize: 24 }}>Lesson complete!</h1>
          <div className="big num">{score} / {total} correct</div>
          {result ? <div className="muted"><b className="num">+{result.gain} XP</b> · {result.streak} day streak</div> : user ? <div className="muted small">Saving…</div> : (
            <div className="note" style={{ textAlign: "start" }}>Sign in with Pi to save your progress and streak. <button className="md-link" style={{ border: 0, background: "none", font: "inherit", cursor: "pointer" }} onClick={login}>Sign in</button></div>
          )}
          {lesson.next && <button className="btn primary lg" onClick={() => router.push(`/lesson?id=${lesson.next}`)}>Next lesson</button>}
          <Link className="btn lg" href="/">Back to Today</Link>
        </section>
      )}

      {help && (
        <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) setHelp(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="AI help" style={{ maxHeight: "88dvh", overflow: "auto" }}>
            <div className="row"><h2 style={{ flex: 1, fontSize: 18 }}>Ask the AI about this lesson</h2><button className="icon-btn" aria-label="Close" onClick={() => setHelp(false)}><IClose width={18} height={18} /></button></div>
            <Tutor lessonId={lesson.id} compact />
          </div>
        </div>
      )}
    </div>
  );
}

export default function LessonPage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}><LessonInner /></Suspense>;
}
