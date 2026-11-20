"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import { TRACK_KEYS } from "@/lib/bots";
import type { Key } from "@/lib/i18n";

type App = { id: string; status: "pending" | "approved" | "rejected"; reason: string | null } | null;
type MyBot = {
  id: string; name: string; subject: string; track: string; description: string; instructions: string;
  fee: number; status: string; knowledge_chars: number;
};
type Draft = { id?: string; name: string; subject: string; track: string; description: string; instructions: string; knowledge: string; fee: number };

const EMPTY: Draft = { name: "", subject: "", track: "school", description: "", instructions: "", knowledge: "", fee: 0 };
const STATUS_CHIP: Record<string, string> = { live: "free", review: "warn", rejected: "bad", paused: "bad", draft: "" };

export default function TeachPage() {
  const { t, user, ready, login, loggingIn, lang } = useApp();
  const [data, setData] = useState<{ app: App; bots: MyBot[]; role: string; earned: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/teach/me", { credentials: "include" });
    if (!r.ok) return setData(null);
    const d = await r.json();
    setData({ app: d.app, bots: d.bots || [], role: d.user.role, earned: d.user.earned });
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (!ready) return <div className="skeleton" style={{ height: 160 }} />;
  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 20 }}>{t("teachTitle")}</h1>
        <p className="muted">{t("teacherCtaSub")}</p>
        <button className="btn primary" onClick={login} disabled={loggingIn}>{loggingIn ? t("loggingIn") : t("login")}</button>
      </div>
    );
  }
  if (!data) return <div className="skeleton" style={{ height: 160 }} />;

  const isTeacher = data.role === "teacher" || data.role === "admin";
  if (!isTeacher) return <Apply app={data.app} onDone={load} />;

  if (draft) return <BotEditor draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />;

  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20 }}>{t("teachTitle")}</h1>
          <p className="muted small">{t("earned")}: <b className="num">{data.earned.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</b> {t("credits")}</p>
          <p className="hint">{t("earnedNote")}</p>
        </div>
        <button className="btn primary" onClick={() => setDraft({ ...EMPTY })}>{t("newBot")}</button>
      </div>
      <div className="sec-h"><h2>{t("myBots")}</h2></div>
      {data.bots.length === 0 ? (
        <div className="card empty">{t("noMyBots")}</div>
      ) : (
        <div className="grid stagger">
          {data.bots.map((b) => (
            <div key={b.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b>{b.name}</b>
                <span className={`chip ${STATUS_CHIP[b.status] || ""}`}>{t(`status_${b.status}` as Key)}</span>
                <span className="chip">{b.subject}</span>
                <span className="chip num">{t("knowledge", { n: b.knowledge_chars })}</span>
              </div>
              <div className="row-actions">
                <Link className="btn sm" href={`/chat?b=${b.id}`}>{t("try")}</Link>
                <button className="btn sm" onClick={async () => {
                  // Knowledge isn't in the list payload; the editor starts empty and the teacher re-uploads to replace it.
                  setDraft({ id: b.id, name: b.name, subject: b.subject, track: b.track, description: b.description, instructions: b.instructions, knowledge: "", fee: b.fee });
                }}>{t("editBot")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Apply({ app, onDone }: { app: App; onDone: () => void }) {
  const { t, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [again, setAgain] = useState(false);

  if (app?.status === "pending") return <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}><div className="notice info">{t("appPending")}</div></div>;
  if (app?.status === "rejected" && !again) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 10 }}>
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
    if (r.ok) { toast(t("appSent")); onDone(); }
    else setErr(r.data?.error || "error");
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 620, margin: "0 auto", display: "grid", gap: 14 }}>
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

function BotEditor({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const { t, toast, lang } = useApp();
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: k === "fee" ? Number(e.target.value) : e.target.value });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await post<{ text: string; error?: string }>("/api/teach/extract", fd);
    setReading(false);
    if (r.ok) { setD((cur) => ({ ...cur, knowledge: `${cur.knowledge}${cur.knowledge ? "\n\n" : ""}${r.data.text}`.slice(0, 300_000) })); toast(t("extracted")); }
    else setErr(r.data?.error || "error");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await post("/api/teach/bots", d);
    setBusy(false);
    if (r.ok) { toast(t("saved")); onSaved(); } else setErr(r.data?.error || "error");
  }

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>
      <h1 style={{ fontSize: 20 }}>{d.id ? t("editBot") : t("newBot")}</h1>
      <label className="field"><span>{t("bName")}</span><input className="input" id="b-name" value={d.name} onChange={set("name")} required minLength={2} maxLength={80} /></label>
      <label className="field"><span>{t("bSubject")}</span><input className="input" id="b-subject" value={d.subject} onChange={set("subject")} required maxLength={80} /></label>
      <label className="field"><span>{t("bTrack")}</span>
        <select className="select" id="b-track" value={d.track} onChange={set("track")}>
          {Object.entries(TRACK_KEYS).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
        </select>
      </label>
      <label className="field"><span>{t("bDesc")}</span><input className="input" id="b-desc" value={d.description} onChange={set("description")} maxLength={400} /></label>
      <label className="field"><span>{t("bInstr")}</span><textarea className="textarea" id="b-instr" value={d.instructions} onChange={set("instructions")} maxLength={4000} /></label>
      <div className="field">
        <span>{t("bKnow")}</span>
        <label className="btn" style={{ justifySelf: "start" }}>
          {reading ? t("extracting") : t("bUpload")}
          <input type="file" hidden accept=".pdf,.docx,.pptx,.txt,.md,.csv" onChange={upload} disabled={reading} />
        </label>
        <textarea className="textarea" id="b-know" value={d.knowledge} onChange={set("knowledge")} style={{ minHeight: 180 }} maxLength={300_000} />
        {d.id && !d.knowledge && <span className="hint">{t("keepKnow")}</span>}
        <span className="hint num">{t("chars", { n: d.knowledge.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US") })}</span>
      </div>
      <label className="field"><span>{t("bFee")}</span><input className="input" id="b-fee" type="number" min={0} max={20} value={d.fee} onChange={set("fee")} /></label>
      {err && <div className="notice bad">{err}</div>}
      <div className="row-actions">
        <button className="btn primary" disabled={busy}>{busy ? t("sending") : t("saveBot")}</button>
        <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      </div>
    </form>
  );
}
