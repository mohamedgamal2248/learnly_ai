"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import { botText, TRACK_KEYS } from "@/lib/bots";
import type { Key } from "@/lib/i18n";

type App = { id: string; status: "pending" | "approved" | "rejected"; reason: string | null } | null;
type MyBot = {
  id: string; name: string; name_en: string; subject: string; subject_en: string; track: string;
  description: string; description_en: string; fee: number; status: string; knowledge_chars: number;
};
type Material = { id?: string; name: string; chars: number; body?: string };
type Draft = {
  id?: string; name: string; name_en: string; subject: string; subject_en: string; track: string;
  description: string; description_en: string; instructions: string; notes: string; fee: number; files: Material[];
  reply_lang: "auto" | "ar" | "en";
  web: boolean;
};

const EMPTY: Draft = {
  name: "", name_en: "", subject: "", subject_en: "", track: "school", description: "", description_en: "",
  instructions: "", notes: "", fee: 0, files: [], reply_lang: "auto", web: false,
};
const STATUS_CHIP: Record<string, string> = { live: "free", review: "warn", rejected: "bad", paused: "bad", draft: "" };
const ERRS: Record<string, Key> = { no_credits: "errNoCredits", daily_limit: "errDaily", paused: "errPaused", slow_down: "errSlow", daily_cap: "errDayCap", too_short: "errShort", ai_error: "errAi" };

export default function TeachPage() {
  const { t, user, ready, login, loggingIn, lang } = useApp();
  const [data, setData] = useState<{ app: App; bots: MyBot[]; role: string; earned: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [architect, setArchitect] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/teach/me", { credentials: "include" });
    if (!r.ok) return setData(null);
    const d = await r.json();
    setData({ app: d.app, bots: d.bots || [], role: d.user.role, earned: d.user.earned });
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function edit(id: string) {
    const r = await fetch(`/api/teach/bots?id=${id}`, { credentials: "include" });
    if (!r.ok) return;
    const b = (await r.json()).bot;
    setDraft({
      id: b.id, name: b.name, name_en: b.name_en, subject: b.subject, subject_en: b.subject_en, track: b.track,
      description: b.description, description_en: b.description_en, instructions: b.instructions, notes: b.notes || "",
      fee: b.fee, files: b.files || [], reply_lang: b.reply_lang || "auto", web: !!b.web,
    });
  }

  if (!ready) return <div className="skeleton" style={{ height: 160 }} />;
  if (draft) return <BotEditor draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />;
  if (architect) return <Architect onClose={() => setArchitect(false)} onDraft={(d) => { setArchitect(false); setDraft(d); }} />;

  const isTeacher = data && (data.role === "teacher" || data.role === "admin");

  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      {!user ? (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <h1 style={{ fontSize: 20 }}>{t("teachTitle")}</h1>
          <p className="muted">{t("teacherCtaSub")}</p>
          <button className="btn primary" onClick={login} disabled={loggingIn}>{loggingIn ? t("loggingIn") : t("login")}</button>
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : !isTeacher ? (
        <Apply app={data.app} onDone={load} />
      ) : (
        <>
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 20 }}>{t("teachTitle")}</h1>
              <p className="muted small">{t("earned")}: <b className="num">{data.earned.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</b> {t("credits")}</p>
              <p className="hint">{t("earnedNote")}</p>
            </div>
            <div className="row-actions">
              <button className="btn primary" onClick={() => setArchitect(true)}>✦ {t("buildAi")}</button>
              <button className="btn" onClick={() => setDraft({ ...EMPTY, files: [] })}>{t("buildManual")}</button>
            </div>
          </div>
          <div className="sec-h"><h2>{t("myBots")}</h2></div>
          {data.bots.length === 0 ? (
            <div className="card empty">{t("noMyBots")}</div>
          ) : (
            <div className="grid stagger">
              {data.bots.map((b) => {
                const bt = botText({ ...b, official: false, teacher_name: null, has_knowledge: b.knowledge_chars > 0 }, lang);
                return (
                  <div key={b.id} className="card" style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b>{bt.name}</b>
                      <span className={`chip ${STATUS_CHIP[b.status] || ""}`}>{t(`status_${b.status}` as Key)}</span>
                      <span className="chip">{bt.subject}</span>
                      <span className="chip num">{t("knowledge", { n: b.knowledge_chars })}</span>
                    </div>
                    <div className="row-actions">
                      <Link className="btn sm" href={`/chat?b=${b.id}`}>{t("try")}</Link>
                      <button className="btn sm" onClick={() => edit(b.id)}>{t("editBot")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <Guide />
    </div>
  );
}

function Guide() {
  const { t } = useApp();
  const steps: Key[] = ["gStep1", "gStep2", "gStep3", "gStep4", "gStep5"];
  return (
    <section className="card" style={{ display: "grid", gap: 10 }}>
      <div><h2 style={{ fontSize: 17 }}>{t("guideTitle")}</h2><p className="hint">{t("guideSub")}</p></div>
      <ol style={{ margin: 0, paddingInlineStart: 22, display: "grid", gap: 8 }}>
        {steps.map((k) => <li key={k} className="small">{t(k)}</li>)}
      </ol>
    </section>
  );
}

function Architect({ onClose, onDraft }: { onClose: () => void; onDraft: (d: Draft) => void }) {
  const { t, setCredits, toast, openBuy } = useApp();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; code?: string } | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await post("/api/teach/architect", { prompt });
    setBusy(false);
    if (typeof r.data?.credits === "number") setCredits(r.data.credits);
    if (!r.ok) {
      const code = r.data?.error;
      return setErr({ msg: t(ERRS[code] || "errGeneric", { have: r.data?.credits ?? 0, need: r.data?.need ?? "?" }), code });
    }
    const d = r.data.draft;
    const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
    toast(t("archDone"));
    onDraft({
      name: s(d.name_ar, 80), name_en: s(d.name_en, 80), subject: s(d.subject_ar, 80), subject_en: s(d.subject_en, 80),
      track: Object.keys(TRACK_KEYS).includes(d.track) ? d.track : "school",
      description: s(d.description_ar, 400), description_en: s(d.description_en, 400),
      instructions: s(d.instructions, 4000), notes: "", fee: Math.max(0, Math.min(20, parseInt(d.fee, 10) || 0)), files: [],
      reply_lang: d.track === "lang" ? "ar" : "auto", web: false,
    });
  }

  return (
    <form className="card" onSubmit={go} style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 12 }}>
      <div><h1 style={{ fontSize: 20 }}>✦ {t("archTitle")}</h1><p className="muted small" style={{ marginTop: 4 }}>{t("archSub")}</p></div>
      <div className="grid" style={{ gap: 6 }}>
        <span className="hint">{t("archExTitle")}</span>
        <div className="suggest" style={{ marginTop: 0 }}>
          {(["archEx1", "archEx2", "archEx3", "archEx4"] as Key[]).map((k) => (
            <button type="button" key={k} onClick={() => setPrompt(t(k))}>{t(k).split(":")[0]}</button>
          ))}
        </div>
      </div>
      <textarea className="textarea" id="arch-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("archPh")} maxLength={3000} style={{ minHeight: 120 }} />
      <p className="hint">{t("archCost")}</p>
      {err && (
        <div className="notice bad">{err.msg}
          {["no_credits", "daily_limit", "paused"].includes(err.code || "") && <button type="button" className="btn primary sm" style={{ marginInlineStart: 8 }} onClick={openBuy}>{t("buyTitle")}</button>}
        </div>
      )}
      {busy && <span className="thinking"><span className="dots"><i /><i /><i /></span>{t("archBusy")}</span>}
      <div className="row-actions">
        <button className="btn primary" disabled={busy || prompt.trim().length < 10}>{busy ? t("archBusy") : t("archGo")}</button>
        <button type="button" className="btn" onClick={onClose} disabled={busy}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function Apply({ app, onDone }: { app: App; onDone: () => void }) {
  const { t, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [again, setAgain] = useState(false);

  if (app?.status === "pending") return <div className="card"><div className="notice info">{t("appPending")}</div></div>;
  if (app?.status === "rejected" && !again) {
    return (
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div className="notice bad">{t("appRejected")}{app.reason ? ` ${t("reason")}: ${app.reason}` : ""}</div>
        <button className="btn primary" onClick={() => setAgain(true)}>{t("applyAgain")}</button>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await post("/api/teach/apply", new FormData(e.currentTarget));
    setBusy(false);
    if (r.ok) { toast(t("appSent")); onDone(); } else setErr(r.data?.error || "error");
  }

  return (
    <form className="card" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <div><h1 style={{ fontSize: 20 }}>{t("applyTitle")}</h1><p className="muted small" style={{ marginTop: 4 }}>{t("applySub")}</p></div>
      <label className="field"><span>{t("fName")}</span><input className="input" name="name" id="name" required minLength={2} maxLength={80} /></label>
      <label className="field"><span>{t("fSubjects")}</span><input className="input" name="subjects" id="subjects" required minLength={2} maxLength={300} /></label>
      <label className="field"><span>{t("fBio")}</span><textarea className="textarea" name="bio" id="bio" required minLength={20} maxLength={1500} /></label>
      <label className="field"><span>{t("fYears")}</span><input className="input" name="years" id="years" type="number" min={0} max={60} defaultValue={1} /></label>
      <label className="field"><span>{t("fDoc")}</span><input className="input" name="doc" id="doc" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></label>
      {err && <div className="notice bad">{err}</div>}
      <button className="btn primary" disabled={busy}>{busy ? t("sending") : t("submit")}</button>
    </form>
  );
}

function Pair({ label, a, b, onA, onB, max, area }: {
  label: string; a: string; b: string; onA: (v: string) => void; onB: (v: string) => void; max: number; area?: boolean;
}) {
  const { t } = useApp();
  const common = (value: string, onChange: (v: string) => void, dir: "rtl" | "ltr", ph: string) => ({
    value, dir, maxLength: max, placeholder: ph, "aria-label": `${label} — ${ph}`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  });
  return (
    <div className="field">
      <span>{label}</span>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {area ? (
          <>
            <textarea className="textarea" style={{ minHeight: 70 }} {...common(a, onA, "rtl", t("inAr"))} />
            <textarea className="textarea" style={{ minHeight: 70 }} {...common(b, onB, "ltr", t("inEn"))} />
          </>
        ) : (
          <>
            <input className="input" {...common(a, onA, "rtl", t("inAr"))} />
            <input className="input" {...common(b, onB, "ltr", t("inEn"))} />
          </>
        )}
      </div>
    </div>
  );
}

function BotEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const { t, toast, lang } = useApp();
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const total = d.files.reduce((n, f) => n + f.chars, 0) + d.notes.length;
  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of list) {
      setReading(true); setErr("");
      const fd = new FormData();
      fd.append("file", file);
      const r = await post<{ text: string; error?: string }>("/api/teach/extract", fd);
      setReading(false);
      if (r.ok) {
        const body = r.data.text.replace(/^### .*\n/, "");
        setD((cur) => ({ ...cur, files: [...cur.files, { name: file.name, chars: body.length, body }] }));
        toast(t("extracted"));
      } else setErr(r.data?.error || "error");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await post("/api/teach/bots", {
      ...d, files: d.files.map((f) => (f.id ? { id: f.id } : { name: f.name, body: f.body })),
    });
    setBusy(false);
    if (r.ok) { toast(t("saved")); onSaved(); } else setErr(r.data?.error || "error");
  }

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 16 }}>
      <div><h1 style={{ fontSize: 20 }}>{d.id ? t("editBot") : t("newBot")}</h1><p className="hint">{t("autoTr")}</p></div>
      <Pair label={t("bName")} a={d.name} b={d.name_en} onA={(v) => set("name", v)} onB={(v) => set("name_en", v)} max={80} />
      <Pair label={t("bSubject")} a={d.subject} b={d.subject_en} onA={(v) => set("subject", v)} onB={(v) => set("subject_en", v)} max={80} />
      <Pair label={t("bDesc")} a={d.description} b={d.description_en} onA={(v) => set("description", v)} onB={(v) => set("description_en", v)} max={400} area />
      <label className="field"><span>{t("bTrack")}</span>
        <select className="select" id="b-track" value={d.track} onChange={(e) => set("track", e.target.value)}>
          {Object.entries(TRACK_KEYS).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
        </select>
      </label>
      <label className="field"><span>{t("bReplyLang")}</span>
        <select className="select" id="b-reply-lang" value={d.reply_lang} onChange={(e) => set("reply_lang", e.target.value as Draft["reply_lang"])}>
          <option value="auto">{t("rlAuto")}</option><option value="ar">{t("rlAr")}</option><option value="en">{t("rlEn")}</option>
        </select>
        <span className="hint">{t("rlHint")}</span>
      </label>
      <label className="field" style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" id="b-web" checked={d.web} onChange={(e) => set("web", e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
        <span style={{ display: "grid", gap: 2 }}><b>{t("bWeb")}</b><span className="hint">{t("bWebHint")}</span></span>
      </label>
      <label className="field"><span>{t("bInstr")}</span><textarea className="textarea" id="b-instr" value={d.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={4000} style={{ minHeight: 130 }} /></label>

      <div className="field">
        <span>{t("materials")}</span>
        <p className="hint">{t("filesHint")}</p>
        <div className="grid" style={{ gap: 6 }}>
          {d.files.map((f, i) => (
            <div key={f.id || `new-${i}`} className="file-card" style={{ marginTop: 0 }}>
              <span className="file-ico" style={{ background: "var(--primary)" }}>{(f.name.split(".").pop() || "TXT").slice(0, 4).toUpperCase()}</span>
              <span className="ft"><b>{f.name}</b><span className="hint num">{fmt(f.chars)}{!f.id ? ` · ${t("newFile")}` : ""}</span></span>
              <button type="button" className="btn danger sm" onClick={() => setD((cur) => ({ ...cur, files: cur.files.filter((_, j) => j !== i) }))}>{t("removeFile")}</button>
            </div>
          ))}
        </div>
        <label className="btn" style={{ justifySelf: "start" }}>
          {reading ? t("extracting") : t("bUpload")}
          <input type="file" hidden multiple accept=".pdf,.docx,.pptx,.txt,.md,.csv" onChange={upload} disabled={reading} />
        </label>
      </div>
      <label className="field"><span>{t("notesLbl")}</span><textarea className="textarea" id="b-notes" value={d.notes} onChange={(e) => set("notes", e.target.value)} maxLength={100_000} /></label>
      <span className={total > 300_000 ? "chip bad num" : "hint num"}>{t("chars", { n: fmt(total) })}</span>
      <label className="field"><span>{t("bFee")}</span><input className="input" id="b-fee" type="number" min={0} max={20} value={d.fee} onChange={(e) => set("fee", Number(e.target.value))} /></label>
      {err && <div className="notice bad">{err}</div>}
      <div className="row-actions">
        <button className="btn primary" disabled={busy || reading}>{busy ? t("sending") : t("saveBot")}</button>
        <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      </div>
    </form>
  );
}
