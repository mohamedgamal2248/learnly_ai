"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { post } from "@/lib/pi-client";
import { TRACK_KEYS } from "@/lib/bots";
import { piFmt } from "@/lib/courses";
import type { Key } from "@/lib/i18n";

type Q = { q: string; options: string[]; answer: number };
type L = { id?: string; title: string; body: string; quiz: Q[] };
type C = {
  id?: string; title: string; title_en: string; description: string; description_en: string; track: string;
  price_pi: number | string; bot_id: string | null; lessons: L[]; status?: string; students?: number;
};
const EMPTY: C = { title: "", title_en: "", description: "", description_en: "", track: "school", price_pi: 0, bot_id: null, lessons: [{ title: "", body: "", quiz: [] }] };
const STATUS_CHIP: Record<string, string> = { live: "free", review: "warn", rejected: "bad", paused: "bad" };

/** Creator side: list of own courses and a simple editor (lessons + multiple-choice quizzes). */
export function CourseManager({ bots, draft, onDraftUsed }: { bots: { id: string; name: string }[]; draft?: C | null; onDraftUsed?: () => void }) {
  const { t } = useApp();
  const [list, setList] = useState<C[] | null>(null);
  const [edit, setEdit] = useState<C | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/teach/courses", { credentials: "include", cache: "no-store" });
    setList(r.ok ? (await r.json()).courses : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (draft) { setEdit(draft); onDraftUsed?.(); } }, [draft, onDraftUsed]);

  return (
    <>
      <div className="sec-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ flex: 1 }}>{t("myCourses")}</h2>
        {!edit && <button className="btn sm primary" onClick={() => setEdit(structuredClone(EMPTY))}>{t("newCourse")}</button>}
      </div>
      {edit ? (
        <CourseEditor c={edit} bots={bots} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      ) : !list ? (
        <div className="skeleton" style={{ height: 80 }} />
      ) : !list.length ? (
        <div className="card empty">{t("noMyCourses")}</div>
      ) : (
        <div className="grid stagger">
          {list.map((c) => (
            <div key={c.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <b>{c.title || c.title_en}</b>
                <span className={`chip ${STATUS_CHIP[c.status || ""] || ""}`}>{t(`status_${c.status}` as Key)}</span>
                <span className="chip num">{Number(c.price_pi) > 0 ? piFmt(Number(c.price_pi)) : t("free")}</span>
                <span className="chip num">{t("lessonsN", { n: c.lessons.length })}</span>
                <span className="chip num">{t("studentsN", { n: c.students || 0 })}</span>
              </div>
              <div className="row-actions">
                <Link className="btn sm" href={`/course?id=${c.id}`}>{t("cOpen")}</Link>
                <button className="btn sm" onClick={() => setEdit(structuredClone(c))}>{t("cEdit")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CourseEditor({ c: init, bots, onClose, onSaved }: { c: C; bots: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const { t, toast } = useApp();
  const [c, setC] = useState<C>(init);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof C>(k: K, v: C[K]) => setC((cur) => ({ ...cur, [k]: v }));
  const setLesson = (i: number, patch: Partial<L>) => setC((cur) => ({ ...cur, lessons: cur.lessons.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const setQ = (i: number, qi: number, patch: Partial<Q>) =>
    setLesson(i, { quiz: c.lessons[i].quiz.map((q, k) => (k === qi ? { ...q, ...patch } : q)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!(c.title || c.title_en) || !c.lessons.some((l) => l.title.trim() && l.body.trim())) { toast(t("cNeed")); return; }
    setBusy(true);
    // Drop empty options and keep the correct answer pointing at the same text.
    const lessons = c.lessons.map((l) => ({
      ...l,
      quiz: l.quiz.flatMap((q) => {
        const keep = q.options.map((o, k) => ({ o: o.trim(), k })).filter((x) => x.o);
        const answer = keep.findIndex((x) => x.k === q.answer);
        return q.q.trim() && keep.length >= 2 && answer >= 0 ? [{ q: q.q, options: keep.map((x) => x.o), answer }] : [];
      }),
    }));
    const r = await post("/api/teach/courses", { ...c, lessons, price_pi: Number(String(c.price_pi).replace(",", ".")) || 0 });
    setBusy(false);
    if (r.ok) { toast(t("cSaved")); onSaved(); } else toast(t("errGeneric"));
  }

  return (
    <form className="card" onSubmit={save} style={{ display: "grid", gap: 12, animation: "rise .25s both" }}>
      <label className="field"><span>{t("cTitle")} (AR)</span><input className="input" value={c.title} maxLength={120} onChange={(e) => set("title", e.target.value)} /></label>
      <label className="field"><span>{t("cTitle")} (EN)</span><input className="input ltr" value={c.title_en} maxLength={120} onChange={(e) => set("title_en", e.target.value)} /></label>
      <label className="field"><span>{t("cDesc")} (AR)</span><textarea className="textarea" value={c.description} maxLength={600} onChange={(e) => set("description", e.target.value)} /></label>
      <label className="field"><span>{t("cDesc")} (EN)</span><textarea className="textarea ltr" value={c.description_en} maxLength={600} onChange={(e) => set("description_en", e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label className="field"><span>{t("bTrack")}</span>
          <select className="select" value={c.track} onChange={(e) => set("track", e.target.value)}>
            {Object.entries(TRACK_KEYS).map(([k, key]) => <option key={k} value={k}>{t(key)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t("cPrice")}</span>
          <input className="input ltr" inputMode="decimal" value={c.price_pi}
            onChange={(e) => set("price_pi", e.target.value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[^\d.,]/g, ""))} />
          <span className="hint">{t("cPriceHint")}</span>
        </label>
        <label className="field"><span>{t("cBot")}</span>
          <select className="select" value={c.bot_id || ""} onChange={(e) => set("bot_id", e.target.value || null)}>
            <option value="">{t("cNoBot")}</option>
            {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      </div>

      <b>{t("cLessons")}</b>
      {c.lessons.map((l, i) => (
        <div key={i} className="lesson-edit">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="lesson-n num">{t("lessonN", { n: i + 1 })}</span>
            <span style={{ flex: 1 }} />
            {c.lessons.length > 1 && <button type="button" className="link" onClick={() => set("lessons", c.lessons.filter((_, k) => k !== i))}>{t("cRemove")}</button>}
          </div>
          <input className="input" placeholder={t("cLessonTitle")} value={l.title} maxLength={160} onChange={(e) => setLesson(i, { title: e.target.value })} />
          <textarea className="textarea" placeholder={t("cLessonBody")} value={l.body} maxLength={20000} style={{ minHeight: 140 }} onChange={(e) => setLesson(i, { body: e.target.value })} />
          {l.quiz.map((q, qi) => (
            <div key={qi} className="q-edit">
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" placeholder={`${t("cQ")} ${qi + 1}`} value={q.q} maxLength={400} onChange={(e) => setQ(i, qi, { q: e.target.value })} />
                <button type="button" className="link" onClick={() => setLesson(i, { quiz: l.quiz.filter((_, k) => k !== qi) })}>{t("cRemove")}</button>
              </div>
              {q.options.map((o, oi) => (
                <label key={oi} className="opt-edit">
                  <input type="radio" name={`ans-${i}-${qi}`} checked={q.answer === oi} onChange={() => setQ(i, qi, { answer: oi })} aria-label={t("cCorrect")} />
                  <input className="input" placeholder={`${t("cOpt")} ${oi + 1}`} value={o} maxLength={200}
                    onChange={(e) => setQ(i, qi, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
          ))}
          {l.quiz.length < 10 && <button type="button" className="btn sm" onClick={() => setLesson(i, { quiz: [...l.quiz, { q: "", options: ["", "", ""], answer: 0 }] })}>{t("cAddQ")}</button>}
        </div>
      ))}
      {c.lessons.length < 40 && <button type="button" className="btn" onClick={() => set("lessons", [...c.lessons, { title: "", body: "", quiz: [] }])}>{t("cAddLesson")}</button>}

      <div className="row-actions">
        <button className="btn primary" disabled={busy}>{busy ? t("preparing") : t("cSave")}</button>
        <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      </div>
    </form>
  );
}
