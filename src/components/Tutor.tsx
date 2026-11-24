"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { useLearn } from "./LearnProvider";
import { IBolt, ISend, ISparkle } from "./Icons";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "explain" | "chat" | "correct";
const MODES: { id: Mode; label: string; ph: string; hint: string }[] = [
  { id: "explain", label: "Ask", ph: "Ask anything about English…", hint: "Explains in your language" },
  { id: "chat", label: "Practise", ph: "Say something in English…", hint: "A short conversation that corrects you" },
  { id: "correct", label: "Correct", ph: "Write a sentence or a short text…", hint: "Fixes your English and explains the mistakes" },
];

/** The AI tutor: an Ask / Practise / Correct chat. Needs a paid plan; every request uses a few credits. */
/** Shows a tutor answer as tidy lines: no markdown symbols, lists with bullets, each line takes its own direction. */
function Rich({ text, dir }: { text: string; dir: "rtl" | "ltr" }) {
  const lines = text.replace(/\*+/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`+/g, "").split("\n");
  return (
    <>
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        const bullet = /^([-•–]|\d+[.)])\s+/.test(t);
        const body = t.replace(/^([-•–])\s+/, "");
        return <div key={i} dir={dir} className={`rl${bullet ? " li" : ""}${/:$/.test(t) ? " hd" : ""}`}>{bullet && /^[-•–]/.test(t) ? "• " : ""}{body}</div>;
      })}
    </>
  );
}

export function Tutor({ lessonId, lessonTitle, compact = false }: { lessonId?: string; lessonTitle?: string; compact?: boolean }) {
  const { user, login, loggingIn, tt, uiLang, dir } = useApp();
  const { st, plan, setCredits } = useLearn();
  const [mode, setMode] = useState<Mode>("explain");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  if (!user) return <div className="lc" style={{ display: "grid", gap: 10 }}><b>{tt("Sign in to use the AI tutor")}</b><button className="btn primary" onClick={login} disabled={loggingIn}>{tt("Sign in with Pi")}</button></div>;
  if (!plan) {
    return (
      <div className="lc warm" style={{ display: "grid", gap: 10 }}>
        <div className="row"><div className="ic-sq warm"><ISparkle width={24} height={24} /></div><div className="grow"><b>{tt("The AI tutor is part of Plus and Pro")}</b><div className="small" style={{ color: "#8A5A00" }}>{tt("Ask questions in your language, practise conversations and get your writing corrected.")}</div></div></div>
        <Link className="btn primary" href="/plans">{tt("See plans")}</Link>
      </div>
    );
  }

  const m = MODES.find((x) => x.id === mode)!;
  const starters = lessonId
    ? mode === "explain" ? ["Explain this lesson in simple words", "Give me 3 more examples", "What mistakes do learners make here?"]
      : mode === "chat" ? ["Let's practise this lesson's words in a short conversation.", "Ask me questions using the lesson words."]
      : ["Check my sentence using a word from this lesson: "]
    : mode === "explain" ? ["When do I use \"a\" and \"an\"?", "What is the difference between \"do\" and \"does\"?", "How do I say hello politely?"]
      : mode === "chat" ? ["Hello! How are you?", "Let's order food in a restaurant.", "Let's talk about my day."]
      : ["I goed to school yesterday."];
  async function send() {
    const t = text.trim();
    if (t.length < 2 || busy) return;
    setErr(""); setBusy(true); setText("");
    const history = msgs.slice(-6);
    setMsgs((x) => [...x, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      const r = await fetch("/api/en/ai", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, text: t, lessonId, history, ui: uiLang }) });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        setMsgs((x) => x.slice(0, -2)); setText(t);
        setErr(tt(d.error === "no_credits" ? "You are out of AI credits. Add a pack to keep going." : d.error === "daily_cap" ? "You reached today's AI limit. It resets tomorrow." : d.error === "slow_down" ? "Slow down a little and try again." : d.error === "no_plan" ? "Your plan has ended. Renew it to use the AI tutor." : "Something went wrong. Try again."));
        setBusy(false); return;
      }
      const c = Number(r.headers.get("X-Credits"));
      if (Number.isFinite(c)) setCredits(c);
      const reader = r.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const show = acc.replace("[[error]]", "");
        setMsgs((x) => { const y = x.slice(); y[y.length - 1] = { role: "assistant", content: show }; return y; });
      }
      if (acc.includes("[[error]]")) {
        setMsgs((x) => x.slice(0, -2)); setText(t);
        setErr(tt("The tutor could not answer. Your credits were returned."));
        const s = await fetch("/api/en/state", { credentials: "include", cache: "no-store" }).then((q) => q.json()).catch(() => null);
        if (s?.credits != null) setCredits(s.credits);
      }
    } catch { setErr(tt("Connection problem. Try again.")); }
    setBusy(false);
  }

  return (
    <div className={`stack tutor${compact ? " compact" : ""}`} style={compact ? undefined : { minHeight: "60dvh", alignContent: "start" }}>
      {lessonId && <div className="note ok" style={{ display: "flex", gap: 8, alignItems: "center" }}><ISparkle width={16} height={16} /><span><b>{tt("Asking about this lesson")}:</b> {lessonTitle || lessonId}</span></div>}
      <div className="seg" role="tablist">
        {MODES.map((x) => <button key={x.id} role="tab" aria-selected={mode === x.id} className={mode === x.id ? "on" : ""} onClick={() => setMode(x.id)}>{tt(x.label)}</button>)}
      </div>
      <div className="muted small" style={{ marginTop: -4 }}>{tt(m.hint)}. <span className="num"><IBolt width={12} height={12} style={{ verticalAlign: -1, color: "var(--accent)" }} /> {tt("{n} credits left", { n: st?.credits ?? 0 })}</span></div>
      {msgs.length === 0 && (
        <div className="lc" style={{ background: "var(--primary-soft)", boxShadow: "none" }}>
          <b>{tt(mode === "explain" ? "What would you like to understand?" : mode === "chat" ? "Let's talk. Start with a greeting!" : "Paste your English and I will correct it.")}</b>
          <div className="chips" style={{ marginTop: 8, flexWrap: "wrap" }}>{starters.map((q) => <button key={q} className="chip v" onClick={() => setText(mode === "explain" ? tt(q) : q)} style={{ border: 0, cursor: "pointer", whiteSpace: "normal", textAlign: "start" }}>{mode === "explain" ? tt(q) : q}</button>)}</div>
        </div>
      )}
      <div className="chat">
        {msgs.map((x, i) => (
          <div key={i} className={`bubble ${x.role}`} dir={dir}>{x.content ? (x.role === "assistant" ? <Rich text={x.content} dir={dir} /> : x.content) : <span className="dots"><i /><i /><i /></span>}</div>
        ))}
        <div ref={end} />
      </div>
      {err && <div className="note bad">{err} {err === tt("You are out of AI credits. Add a pack to keep going.") && <Link href="/plans" className="md-link">{tt("Add credits")}</Link>}</div>}
      <div className="composer">
        <textarea className="textarea" rows={2} value={text} placeholder={tt(m.ph)} dir={dir} maxLength={1200} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
        <button className="btn primary" onClick={send} disabled={busy || text.trim().length < 2} aria-label={tt("Send")}><ISend width={18} height={18} className="flip" /></button>
      </div>
      <div className="hint" style={{ textAlign: "center" }}>{tt("AI can make mistakes. Check important answers.")}</div>
    </div>
  );
}
