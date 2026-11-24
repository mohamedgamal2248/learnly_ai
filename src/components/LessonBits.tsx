"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { useLearn } from "./LearnProvider";
import { Portal } from "./Portal";
import { IClose, ISpeaker } from "./Icons";
import { playAudio } from "@/lib/audio";
import { post } from "@/lib/pi-client";

/** English text where every word can be tapped for its meaning and pronunciation. */
export function TapText({ text, onWord }: { text: string; onWord: (w: string) => void }) {
  const parts = text.split(/([A-Za-z][A-Za-z']*)/);
  return <>{parts.map((p, i) => (/^[A-Za-z]/.test(p) ? <button key={i} type="button" className="tapw" onClick={() => onWord(p)}>{p}</button> : <span key={i}>{p}</span>))}</>;
}

type Def = { found: boolean; locked?: boolean; au?: string; exAu?: string; word: string; tr?: string; ex?: string; exTr?: string; lesson?: string };

/** The quick dictionary: meaning (in the learner's language), example and sound for a tapped word. */
export function WordSheet({ word, onClose }: { word: string; onClose: () => void }) {
  const { tt } = useApp();
  const { native, dir } = useLearn();
  const [d, setD] = useState<Def | null>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/en/define?w=${encodeURIComponent(word)}&native=${native}`, { credentials: "include" }).then((r) => r.json()).then(setD).catch(() => setD({ found: false, word }));
  }, [word, native]);
  return (
    <Portal>
      <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div className="row"><b className="grow" dir="ltr" style={{ fontSize: 24 }}>{word}</b>
            <button className="icon-btn" onClick={() => playAudio(d?.au, word)} aria-label={tt("Listen")}><ISpeaker width={18} height={18} /></button>
            <button className="icon-btn" onClick={onClose} aria-label={tt("Close")}><IClose width={18} height={18} /></button></div>
          {!d ? <div className="skeleton" style={{ height: 60 }} /> : d.found && !d.locked ? (
            <div className="stack">
              <div className="big native" dir={dir} style={{ color: "var(--primary)", textAlign: "start" }}>{d.tr}</div>
              <div dir="ltr" className="small">{d.ex}</div>
              <div className="muted small native" dir={dir}>{d.exTr}</div>
              <div className="hint">{tt("From the lesson")}: {d.lesson}</div>
            </div>
          ) : d.found ? <div className="note">{tt("This word is in a lesson of a paid plan.")}</div> : <div className="muted">{tt("This word is not in the course yet. Ask the AI tutor for its meaning.")}</div>}
        </div>
      </div>
    </Portal>
  );
}

/** "Report a mistake" for a lesson or one of its words. */
export function ReportSheet({ lessonId, word, onClose }: { lessonId: string; word?: string; onClose: () => void }) {
  const { tt, user, toast } = useApp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const r = await post("/api/en/report", { lessonId, word, note });
    setBusy(false);
    if (r.ok && r.data?.ok) { toast(tt("Thank you! We will check it.")); onClose(); }
    else toast(tt(r.data?.reason === "limit" ? "You sent many reports today. Try tomorrow." : "Could not send. Try again."));
  }
  return (
    <Portal>
      <div className="modal-wrap" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div className="row"><h2 className="grow" style={{ fontSize: 18 }}>{tt("Report a mistake")}{word ? `: ${word}` : ""}</h2><button className="icon-btn" onClick={onClose} aria-label={tt("Close")}><IClose width={18} height={18} /></button></div>
          {!user ? <div className="note">{tt("Sign in with Pi to report a mistake.")}</div> : (
            <>
              <textarea className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tt("What is wrong? (translation, sentence, sound…)")} />
              <button className="btn primary lg" disabled={busy || note.trim().length < 3} onClick={send}>{busy ? tt("Sending…") : tt("Send report")}</button>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

/** A short burst of confetti, pure CSS, for reaching the daily goal. */
export function Confetti() {
  const colors = ["#F5A623", "#1877F2", "#1E8E5A", "#E4405F", "#7DB8FF"];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.08}s`, ["--x" as string]: `${((i * 53) % 80) - 40}px` }} />)}
    </div>
  );
}

/** The ring that fills as the day's XP goal is reached. */
export function GoalRing({ value, goal, size = 64 }: { value: number; goal: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, p = Math.min(value / Math.max(goal, 1), 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}/${goal} XP`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3EAF4" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p >= 1 ? "#1E8E5A" : "#F59E0B"} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.26} fontWeight="800" fill="currentColor">{Math.min(value, 999)}</text>
    </svg>
  );
}
