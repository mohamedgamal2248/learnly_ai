"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { IconTile, ITask } from "@/components/Icons";
import { Markdown } from "@/components/Markdown";
import { TaskWork } from "@/components/TaskWork";
import { FilePicker, TaskFiles, type TaskFile } from "@/components/TaskFiles";
import { downloadFile, rememberSpec } from "@/lib/local-files";
import { TopUp } from "@/components/TopUp";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

const DELIVERIES = ["text", "pdf", "ppt", "image", "file"] as const;
const SUGGEST = ["summary", "translate", "research", "pdf", "ppt"] as const;
const FEE = 20; // platform share, percent (matches the database default)
const pi = (n: number | string) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
const toNum = (v: string) => Number(v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[٫,]/g, "."));

type Tpl = { id: string; delivery: (typeof DELIVERIES)[number]; reward: string; ar: { category: string; title: string; brief: string; name: string }; en: { category: string; title: string; brief: string; name: string } };
/** Ready-made starting points so a first task takes seconds to write. */
const TEMPLATES: Tpl[] = [
  { id: "summary", delivery: "text", reward: "0.2", ar: { name: "تلخيص", category: "تلخيص", title: "لخّص النص ده في ١٠ نقاط", brief: "لخّص النص المرفق في ١٠ نقاط واضحة تناسب المبتدئين." }, en: { name: "Summary", category: "Summary", title: "Summarize this text in 10 points", brief: "Summarize the attached text in 10 clear points suitable for beginners." } },
  { id: "translate", delivery: "text", reward: "0.3", ar: { name: "ترجمة", category: "ترجمة", title: "ترجمة فقرة للإنجليزي", brief: "ترجم النص لإنجليزي سليم وطبيعي، من غير ترجمة حرفية." }, en: { name: "Translation", category: "Translation", title: "Translate a text to Arabic", brief: "Translate the text into natural Arabic, not word for word." } },
  { id: "code", delivery: "text", reward: "0.5", ar: { name: "مراجعة كود", category: "مراجعة كود", title: "راجع الكود ده وقوللي الأخطاء", brief: "راجع الكود وحدد الأخطاء ونقاط التحسين مع اقتراح التصليح." }, en: { name: "Code review", category: "Code review", title: "Review this code and list the issues", brief: "Review the code, point out bugs and improvements with suggested fixes." } },
  { id: "logo", delivery: "image", reward: "1", ar: { name: "لوجو", category: "تصميم لوجو", title: "تصميم لوجو بسيط", brief: "محتاج لوجو بسيط ومعاصر. اكتب هنا اسم النشاط والألوان المفضلة." }, en: { name: "Logo", category: "Logo design", title: "A simple logo design", brief: "I need a simple modern logo. Write the business name and preferred colors here." } },
  { id: "proof", delivery: "text", reward: "0.2", ar: { name: "تدقيق", category: "تدقيق لغوي", title: "تدقيق لغوي لنص", brief: "صحّح الأخطاء الإملائية والنحوية وحسّن الصياغة من غير ما تغيّر المعنى." }, en: { name: "Proofreading", category: "Proofreading", title: "Proofread a text", brief: "Fix spelling and grammar and improve the wording without changing the meaning." } },
  { id: "slides", delivery: "ppt", reward: "1", ar: { name: "عرض تقديمي", category: "عرض تقديمي", title: "عرض تقديمي من ٦ شرايح", brief: "اعمل عرض من ٦ شرايح عن الموضوع اللي هكتبه هنا، بنقاط مختصرة." }, en: { name: "Slides", category: "Presentation", title: "A 6-slide presentation", brief: "Make a 6-slide presentation about the topic I write here, with short bullet points." } },
];

type Row = { id: string; category: string; delivery: string; title: string; status: string; reward: number; net_reward: number; has_result: boolean; reject_note: string | null; paid_pi: number | null; created_at: string;
  stages?: number; stage_idx?: number; worker?: string | null; parent_id?: string | null;
  draft?: boolean; source?: string; revision_note?: string | null; revisions?: number; rating?: number | null; can_dispute?: boolean; in_dispute?: boolean };
type Stats = { done: number; avg: number | null; rated: number; rejected: number };
type Detail = Row & { stages_def?: unknown; brief: string; input_text: string; role: string; result: { text?: string; file?: any } | null; files: TaskFile[]; worker_stats: Stats | null };
const CHIP: Record<string, string> = { open: "v", claimed: "warn", submitted: "warn", approved: "free", cancelled: "bad", rejected: "bad" };

export default function TasksPage() {
  const { t, user, ready, login } = useApp();
  const [tab, setTab] = useState<"board" | "mine" | "work">("board");
  const needLogin = !user && tab !== "board";
  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="hero-card">
        <IconTile size={56} glass><ITask /></IconTile>
        <div><h1>{t("tasksTitle")}</h1><p>{t("tasksSub")}</p></div>
      </div>
      <div className="chips" role="tablist">
        <button role="tab" aria-selected={tab === "board"} className={`pill${tab === "board" ? " on" : ""}`} onClick={() => setTab("board")}>{t("tkTabBoard")}</button>
        <button role="tab" aria-selected={tab === "mine"} className={`pill${tab === "mine" ? " on" : ""}`} onClick={() => setTab("mine")}>{t("tkTabMine")}</button>
        <button role="tab" aria-selected={tab === "work"} className={`pill${tab === "work" ? " on" : ""}`} onClick={() => setTab("work")}>{t("tkTabWork")}</button>
      </div>
      {!ready ? <div className="skeleton" style={{ height: 160 }} /> : needLogin ? (
        <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>
      ) : tab === "board" ? <Board /> : tab === "mine" ? <Mine /> : <Work />}
    </div>
  );
}

type BoardTask = { id: string; category: string; delivery: string; title: string; brief: string; reward: number; lang: string; files?: number; invited?: boolean; stages?: number };
function Board() {
  const { t } = useApp();
  const [cat, setCat] = useState<string>("");
  const [cats, setCats] = useState<{ key: string; label: string; n: number }[]>([]);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [delivery, setDelivery] = useState("");
  const [min, setMin] = useState("");
  const [sort, setSort] = useState<"new" | "reward">("new");
  const [rows, setRows] = useState<BoardTask[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const qs = (offset: number) => `/api/tasks/board?limit=20&offset=${offset}&sort=${sort}${cat ? `&category=${encodeURIComponent(cat)}` : ""}${term ? `&q=${encodeURIComponent(term)}` : ""}${delivery ? `&delivery=${delivery}` : ""}${toNum(min) > 0 ? `&min=${toNum(min)}` : ""}`;
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch(qs(0), { credentials: "include", cache: "no-store" }), fetch("/api/tasks/categories", { cache: "no-store" })]);
    if (a.ok) { const d = await a.json(); setRows(d.tasks); setTotal(d.total); } else { setRows([]); setTotal(0); }
    if (b.ok) {
      const list: { key: string; label: string; n: number }[] = (await b.json()).categories || [];
      setCats(list);
      // A category that no longer has open tasks drops out of the filter, so go back to "all".
      if (cat && !list.some((c) => c.key === cat)) setCat("");
    }
  }, [cat, term, delivery, min, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(null); load(); }, [load]);
  async function more() {
    setBusy(true);
    const r = await fetch(qs(rows?.length ?? 0), { credentials: "include", cache: "no-store" });
    setBusy(false);
    if (r.ok) { const d = await r.json(); setRows((cur) => [...(cur || []), ...d.tasks]); setTotal(d.total); }
  }
  return (
    <>
      <p className="hint">{t("tkBoardSub")}</p>
      <form className="card" style={{ display: "grid", gap: 8 }} onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <div className="earn-form">
          <input className="input" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder={t("tkSearchPh")} aria-label={t("tkSearchPh")} />
          <button className="btn primary">{t("ppSearch")}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <select className="select" value={delivery} onChange={(e) => setDelivery(e.target.value)} aria-label={t("tkDelivery")}>
            <option value="">{t("tkAnyDelivery")}</option>{DELIVERIES.map((d) => <option key={d} value={d}>{t(`delivery_${d}` as Key)}</option>)}
          </select>
          <input className="input ltr" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder={t("tkMinReward")} aria-label={t("tkMinReward")} />
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as "new" | "reward")} aria-label={t("tkSort")}>
            <option value="new">{t("tkSortNew")}</option><option value="reward">{t("tkSortReward")}</option>
          </select>
        </div>
      </form>
      <div className="chips">
        <button className={`pill${cat === "" ? " on" : ""}`} onClick={() => setCat("")}>{t("all")}</button>
        {cats.map((c) => <button key={c.key} className={`pill${cat === c.key ? " on" : ""}`} onClick={() => setCat(c.key)}>{c.label} <span className="num hint">{c.n}</span></button>)}
      </div>
      {!rows ? <div className="skeleton" style={{ height: 100 }} /> : !rows.length ? <div className="card empty">{t("tkNoBoard")}</div> : (
        <>
          <div className="grid stagger">
            {rows.map((r) => (
              <div key={r.id} className="card" style={{ display: "grid", gap: 8 }}>
                <button className="lesson-head" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <span className="lesson-tt">
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="chip">{r.category}</span>
                      <span className="chip free num ltr">{pi(r.reward)}</span>
                      {r.invited && <span className="chip v">{t("tkInvitedChip")}</span>}
                      {!!r.stages && <span className="chip">{t("stProgress", { a: 1, b: r.stages })}</span>}
                      {!!r.files && <span className="chip num">📎 {r.files}</span>}
                    </span>
                    <h2 style={{ fontSize: 15.5 }}>{r.title}</h2>
                    {open !== r.id && r.brief && <span className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.brief}</span>}
                  </span>
                  <span className="lesson-chev" aria-hidden="true">⌄</span>
                </button>
                {open === r.id && <TaskWork id={r.id} brief={r.brief} onChange={load} />}
              </div>
            ))}
          </div>
          {rows.length < total && <button className="btn" style={{ justifySelf: "center" }} disabled={busy} onClick={more}>{busy ? t("preparing") : t("loadMore", { n: total - rows.length })}</button>}
        </>
      )}
    </>
  );
}

function Mine() {
  const { t, lang, toast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [form, setForm] = useState(false);
  const [top, setTop] = useState(false);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/tasks?role=requester", { credentials: "include", cache: "no-store" }), fetch("/api/earnings", { credentials: "include", cache: "no-store" })]);
    setRows(a.ok ? (await a.json()).tasks : []);
    if (b.ok) setBalance(Number((await b.json()).balance));
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}><span className="hint">{t("tkBalance")}</span><b className="num ltr" style={{ display: "block", fontSize: 18, color: "var(--primary)" }}>{balance === null ? "…" : pi(balance)}</b></div>
        <button className="btn" onClick={() => setTop((v) => !v)}>{t("tkTopUp")}</button>
        {!form && <button className="btn primary" onClick={() => setForm(true)}>{t("tkNew")}</button>}
      </div>
      {top && <TopUp onDone={(b) => { setTop(false); if (b !== undefined) setBalance(b); load(); }} />}
      {form && <NewTask balance={balance ?? 0} onClose={() => setForm(false)} onDone={() => { setForm(false); load(); toast(t("tkPosted")); }} />}
      <Recurring />
      {!rows ? <div className="skeleton" style={{ height: 100 }} /> : !rows.length ? <div className="card empty">{t("tkNoTasks")}</div> : (
        <div className="grid stagger">{rows.map((r) => <TaskCard key={r.id} r={r} lang={lang} onChange={load} />)}</div>
      )}
    </>
  );
}

function StageBar({ n, i, done }: { n: number; i: number; done: boolean }) {
  const { t } = useApp();
  return (
    <div className="grid" style={{ gap: 3 }}>
      <div className="stage-bar" aria-hidden="true">{Array.from({ length: n }, (_, k) => <i key={k} className={k < i || done ? "on" : ""} />)}</div>
      <span className="hint num">{t("stProgress", { a: done ? n : Math.min(i + 1, n), b: n })}</span>
    </div>
  );
}

/** Tasks that repeat on a schedule (every day / week / month) until stopped. */
function Recurring() {
  const { t, lang, toast } = useApp();
  const [list, setList] = useState<{ id: string; title: string; reward: number; every_days: number; next_at: string }[]>([]);
  const load = useCallback(async () => { const r = await fetch("/api/tasks/recurring", { credentials: "include", cache: "no-store" }); if (r.ok) setList((await r.json()).list); }, []);
  useEffect(() => { load(); }, [load]);
  if (!list.length) return null;
  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <b>{t("rcTitle")}</b>
      {list.map((x) => (
        <div key={x.id} className="earn-row">
          <span className="small">{x.title}</span>
          <span className="hint num">{pi(x.reward)} · {t("rcEvery", { n: x.every_days })} · {new Date(x.next_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
          <button className="btn danger sm" style={{ marginInlineStart: "auto" }} onClick={async () => { const r = await post("/api/tasks/recurring", { id: x.id }); if (r.ok) load(); else toast(t("errGeneric")); }}>{t("rcStop")}</button>
        </div>
      ))}
    </div>
  );
}

function NewTask({ balance, onClose, onDone }: { balance: number; onClose: () => void; onDone: () => void }) {
  const { t, lang, toast } = useApp();
  const [category, setCategory] = useState("");
  const [delivery, setDelivery] = useState<(typeof DELIVERIES)[number]>("text");
  const [known, setKnown] = useState<string[]>([]);
  useEffect(() => { fetch("/api/tasks/categories").then((r) => r.json()).then((d) => setKnown((d.categories || []).map((c: { label: string }) => c.label))).catch(() => {}); }, []);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [input, setInput] = useState("");
  const [reward, setReward] = useState("0.1");
  const [out, setOut] = useState<"ar" | "en">(lang === "en" ? "en" : "ar");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState(false);
  const [stages, setStages] = useState<{ title: string; percent: string }[]>([{ title: "", percent: "40" }, { title: "", percent: "60" }]);
  const [repeat, setRepeat] = useState("0");
  const [invite, setInvite] = useState("");
  const [hint, setHint] = useState<{ scope: string; n: number; median: number; min: number; max: number } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => { fetch(`/api/tasks/price-hint?category=${encodeURIComponent(category.trim())}&delivery=${delivery}`).then((r) => r.json()).then(setHint).catch(() => {}); }, 350);
    return () => clearTimeout(id);
  }, [category, delivery]);
  function useTemplate(x: Tpl) { const c = x[lang === "en" ? "en" : "ar"]; setCategory(c.category); setTitle(c.title); setBrief(c.brief); setDelivery(x.delivery); setReward(x.reward); }
  const r = toNum(reward) || 0;
  const pctSum = stages.reduce((a, x) => a + (toNum(x.percent) || 0), 0);
  const stagesOk = !staged || (stages.every((x) => x.title.trim()) && Math.abs(pctSum - 100) < 0.01);
  const maxReward = staged ? 200 : 50;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const stageList = staged ? stages.map((x) => ({ title: x.title.trim(), percent: toNum(x.percent) })) : undefined;
    const inviteList = invite.split(/[,،\s]+/).map((x) => x.replace(/^@/, "").trim()).filter(Boolean).slice(0, 3);
    const fields: Record<string, string> = { category, delivery, title, brief, input_text: input, reward: String(r), lang: out, repeat_days: repeat, invite: inviteList.join(",") };
    if (stageList) fields.stages = JSON.stringify(stageList);
    let payload: FormData | Record<string, unknown> = { ...fields, reward: r, stages: stageList, repeat_days: Number(repeat) };
    if (files.length) { const fd = new FormData(); Object.entries(fields).forEach(([k, v]) => fd.append(k, v)); files.forEach((f) => fd.append("files", f)); payload = fd; }
    const x = await post("/api/tasks", payload);
    setBusy(false);
    if (x.ok) { onDone(); return; }
    const err = x.data?.error;
    toast(["file_type", "file_too_big", "too_many_files", "empty_file"].includes(err) ? t("tkFileBad") : err === "not_enough" ? t("tkNotEnough") : err === "bad_invite" ? t("tkBadInvite") : err === "bad_stages" ? t("stBad") : err === "bad_reward" ? t("tkBadReward") : err === "bad_category" ? t("tkNeedCategory") : err === "too_many" ? t("tkTooMany") : err === "blocked" ? `${t("tkBlocked")}${x.data?.why ? `: ${x.data.why}` : ""}` : t("errGeneric"));
  }
  return (
    <form className="card" onSubmit={submit} style={{ display: "grid", gap: 10, animation: "rise .25s both" }}>
      <div className="grid" style={{ gap: 4 }}>
        <span className="hint">{t("tplTitle")}</span>
        <div className="chips" style={{ flexWrap: "wrap" }}>{TEMPLATES.map((x) => <button type="button" key={x.id} className="chip" onClick={() => useTemplate(x)}>{x[lang === "en" ? "en" : "ar"].name}</button>)}</div>
      </div>
      <label className="field"><span>{t("tkKind")}</span>
        <input className="input" list="task-cats" value={category} maxLength={40} placeholder={t("tkCategoryPh")} onChange={(e) => setCategory(e.target.value)} />
        <datalist id="task-cats">{[...new Set([...known, ...SUGGEST.map((k) => t(`kind_${k}` as Key))])].map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className="field"><span>{t("tkDelivery")}</span>
        <select className="select" value={delivery} onChange={(e) => setDelivery(e.target.value as (typeof DELIVERIES)[number])}>
          {DELIVERIES.map((d) => <option key={d} value={d}>{t(`delivery_${d}` as Key)}</option>)}
        </select></label>
      <label className="field"><span>{t("tkTitle")}</span><input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t("tkBrief")}</span><textarea className="textarea" value={brief} maxLength={1000} placeholder={t("tkBriefPh")} onChange={(e) => setBrief(e.target.value)} /></label>
      <label className="field"><span>{t("tkInput")}</span><textarea className="textarea" value={input} maxLength={8000} style={{ minHeight: 110 }} onChange={(e) => setInput(e.target.value)} /><span className="hint">{t("tkInputHint")}</span></label>
      <FilePicker files={files} onChange={setFiles} label={t("tkAttach")} hint={t("tkAttachHint")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field"><span>{t("tkReward")}</span><input className="input ltr" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} /></label>
        <label className="field"><span>{t("tkLang")}</span>
          <select className="select" value={out} onChange={(e) => setOut(e.target.value as "ar" | "en")}><option value="ar">{t("rlAr")}</option><option value="en">{t("rlEn")}</option></select></label>
      </div>
      {hint && hint.scope !== "none" && <p className="hint num">{t("phLine", { n: hint.n, med: pi(hint.median), lo: pi(hint.min), hi: pi(hint.max) })}</p>}
      <label className="field"><span>{t("tkInviteLbl")}</span><input className="input ltr" value={invite} maxLength={120} placeholder="@name1, @name2" onChange={(e) => setInvite(e.target.value)} /><span className="hint">{t("tkInviteHint")}</span></label>
      <label className="plan-task"><input type="checkbox" checked={staged} onChange={(e) => setStaged(e.target.checked)} /><span>{t("stToggle")}<br /><span className="hint">{t("stHint")}</span></span></label>
      {staged && (
        <div className="grid" style={{ gap: 6 }}>
          {stages.map((x, i) => (
            <div key={i} className="earn-form">
              <input className="input" value={x.title} maxLength={60} placeholder={t("stTitlePh", { n: i + 1 })} onChange={(e) => setStages(stages.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
              <input className="input ltr" style={{ maxWidth: 80 }} inputMode="decimal" value={x.percent} onChange={(e) => setStages(stages.map((y, j) => (j === i ? { ...y, percent: e.target.value } : y)))} aria-label="%" />
              <span className="num earn-pi">%</span>
            </div>
          ))}
          <div className="row-actions">
            {stages.length < 4 && <button type="button" className="btn sm" onClick={() => setStages([...stages, { title: "", percent: "0" }])}>{t("stAdd")}</button>}
            {stages.length > 2 && <button type="button" className="btn sm" onClick={() => setStages(stages.slice(0, -1))}>{t("remove")}</button>}
            <span className={`hint num${Math.abs(pctSum - 100) < 0.01 ? "" : " bad"}`}>{pctSum}% / 100%</span>
          </div>
        </div>
      )}
      <label className="field"><span>{t("rcLabel")}</span>
        <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          <option value="0">{t("rcOnce")}</option><option value="1">{t("rcDaily")}</option><option value="7">{t("rcWeekly")}</option><option value="30">{t("rcMonthly")}</option>
        </select></label>
      {repeat !== "0" && <p className="hint">{t("rcHint")}</p>}
      <p className="hint">{t("tkRewardHint", { net: 100 - FEE, fee: FEE })} {r > balance && <b style={{ color: "var(--danger, #E4405F)" }}>{t("tkNotEnough")}</b>}</p>
      <div className="row-actions">
        <button className="btn primary" disabled={busy || title.trim().length < 3 || category.trim().length < 2 || !(r >= 0.05 && r <= maxReward) || r > balance || !stagesOk}>{busy ? t("preparing") : t("tkPost")}</button>
        <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      </div>
    </form>
  );
}

function TaskCard({ r, lang, onChange }: { r: Row; lang: string; onChange: () => void }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const loadDetail = useCallback(async () => {
    const x = await fetch(`/api/tasks?id=${r.id}`, { credentials: "include", cache: "no-store" });
    if (x.ok) setD((await x.json()).task);
  }, [r.id]);
  useEffect(() => { if (open) loadDetail(); }, [open, loadDetail, r.status]);

  async function decide(approve: boolean) {
    setBusy(true);
    const x = await post("/api/tasks/decide", { id: r.id, approve, note });
    setBusy(false);
    if (x.ok) { toast(approve ? t("tkDone") : t("tkReopened")); setOpen(false); onChange(); } else toast(t("errGeneric"));
  }
  async function revise() {
    setBusy(true);
    const x = await post("/api/tasks/revise", { id: r.id, note });
    setBusy(false);
    if (x.ok) { toast(t("tkRevised")); setNote(""); setOpen(false); onChange(); }
    else toast(x.data?.error === "max_revisions" ? t("tkMaxRevisions") : x.data?.error === "need_note" ? t("tkNeedNote") : t("errGeneric"));
  }
  async function rate(n: number) {
    setStars(n);
    const x = await post("/api/tasks/rate", { id: r.id, stars: n });
    if (x.ok) { toast(t("tkRated")); loadDetail(); onChange(); } else { setStars(0); toast(t("errGeneric")); }
  }
  async function publish() {
    setBusy(true);
    const x = await post("/api/tasks/publish", { id: r.id });
    setBusy(false);
    if (x.ok) { toast(t("tkPosted")); onChange(); } else toast(x.data?.error === "not_enough" ? t("tkNotEnough") : t("errGeneric"));
  }
  async function cancel() {
    setBusy(true);
    const x = await post("/api/tasks/cancel", { id: r.id });
    setBusy(false);
    if (x.ok) { toast(t("tkCancelled")); onChange(); } else toast(x.data?.error === "on_hold" ? t("tkOnHold") : t("errGeneric"));
  }
  async function download() {
    if (!d?.result?.file) return;
    rememberSpec(d.id, d.result.file);
    const x = await downloadFile(d.id);
    if (x !== "ok") toast(t("dlError"));
  }

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <button className="lesson-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="lesson-tt">
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span className="chip">{r.category}</span>
            <span className={`chip ${CHIP[r.status] || ""}`}>{t(`tkS_${r.status}` as Key)}</span>
            {r.draft && <span className="chip warn">{t("tkDraft")}</span>}
            {r.in_dispute && <span className="chip warn">{t("tkInDispute")}</span>}
            <span className="chip num ltr">{pi(r.reward)}</span>
          </span>
          <h2 style={{ fontSize: 15.5 }}>{r.title}</h2>
          {!!r.stages && <StageBar n={r.stages} i={r.stage_idx ?? 0} done={r.status === "approved"} />}
          {r.revision_note && r.status === "claimed" && <span className="hint">{t("tkRevisionAsked", { n: r.revisions ?? 1 })}: {r.revision_note}</span>}
          {r.reject_note && r.status === "open" && <span className="hint">{t("tkRejectedBefore")}: {r.reject_note}</span>}
        </span>
        <span className="lesson-chev" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="grid" style={{ gap: 10, animation: "rise .2s both" }}>
          {!d ? <div className="skeleton" style={{ height: 60 }} /> : (
            <>
              {d.brief && <p className="small post-body">{d.brief}</p>}
              <TaskFiles files={d.files.filter((f) => f.role === "input")} label={t("tkFiles")} />
              {d.draft && <div className="notice warn">{t("tkDraftHint")}</div>}
              {d.worker_stats && d.status !== "open" && (
                <span className="hint num">{t("tkWorkerStats", { n: d.worker_stats.done, avg: d.worker_stats.avg ?? "—" })}{d.worker_stats.done === 0 && !d.worker_stats.avg ? ` · ${t("tkWorkerNew")}` : ""}</span>
              )}
              {d.result && (
                <div className="grid" style={{ gap: 8 }}>
                  <b className="small">{t("tkResult")}</b>
                  {d.result.text && <div className="md card" style={{ background: "var(--surface-2)" }}><Markdown text={d.result.text} /></div>}
                  {d.result.file && <button className="btn sm" style={{ justifySelf: "start" }} onClick={download}>{t("download")}: {d.result.file.title}.{d.result.file.format}</button>}
                  <TaskFiles files={d.files.filter((f) => f.role === "result")} />
                </div>
              )}
              {d.status === "submitted" && (
                <>
                  <p className="hint">{t("tkAutoApprove")}</p>
                  <input className="input" placeholder={t("tkRejectNote")} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                  <div className="row-actions">
                    <button className="btn primary sm" disabled={busy} onClick={() => decide(true)}>{t("tkApprove")}</button>
                    {(d.revisions ?? 0) < 2 && <button className="btn sm" disabled={busy || note.trim().length < 3} onClick={revise}>{t("tkRevise")}</button>}
                    <button className="btn danger sm" disabled={busy} onClick={() => decide(false)}>{t("tkReject")}</button>
                  </div>
                  <span className="hint">{t("tkReviseHint")}</span>
                </>
              )}
              {d.status === "open" && d.draft && <div className="row-actions"><button className="btn primary sm" disabled={busy} onClick={publish}>{t("tkPublish", { n: pi(d.reward) })}</button><button className="btn sm" disabled={busy} onClick={cancel}>{t("tkDiscard")}</button></div>}
              {d.status === "open" && !d.draft && <div className="row-actions"><button className="btn sm" disabled={busy} onClick={cancel}>{t("tkCancel")}</button></div>}
              {d.status === "approved" && (
                <div className="grid" style={{ gap: 4 }}>
                  <span className="hint">{t("tkDone")}</span>
                  {r.worker && <Link className="btn sm" style={{ justifySelf: "start" }} href={`/u?name=${encodeURIComponent(r.worker)}&again=1&title=${encodeURIComponent(r.title)}&category=${encodeURIComponent(r.category)}&delivery=${r.delivery}&price=${Number(r.reward)}`}>{t("hireAgain", { name: r.worker })}</Link>}
                  {d.worker_stats && (
                    <div className="stars" role="group" aria-label={t("tkRate")}>
                      <span className="hint">{d.rating ? t("tkYourRating") : t("tkRate")}</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" className={`star${n <= (d.rating || stars) ? " on" : ""}`} disabled={!!d.rating} onClick={() => rate(n)} aria-label={`${n}/5`}>★</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Tok = { id: string; name: string; last_used: string | null; created_at: string; can_post: boolean; post_daily_pi: number; allowed_categories: string[]; post_mode: "auto" | "approve"; spent_24h: number };

/** Per-connection posting rules: daily Pi cap, allowed categories, and whether the owner approves each task first. */
function KeyRules({ k, onSaved }: { k: Tok; onSaved: () => void }) {
  const { t, toast } = useApp();
  const [daily, setDaily] = useState(String(k.post_daily_pi));
  const [cats, setCats] = useState((k.allowed_categories || []).join(", "));
  const [mode, setMode] = useState<"auto" | "approve">(k.post_mode || "auto");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await post("/api/mcp/tokens", { action: "rules", id: k.id, daily: toNum(daily), mode, categories: cats.split(/[,،\n]/).map((c) => c.trim()).filter(Boolean) });
    setBusy(false);
    if (r.ok) { toast(t("tkRuleSaved")); onSaved(); } else toast(r.data?.error === "bad_cap" ? t("tkBadReward") : t("errGeneric"));
  }
  return (
    <div className="grid" style={{ gap: 8, paddingInlineStart: 26 }}>
      <span className="hint num">{t("tkSpent", { n: pi(k.spent_24h), cap: pi(k.post_daily_pi) })}</span>
      <label className="field"><span>{t("tkRuleDaily")}</span><input className="input ltr" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} /></label>
      <label className="field"><span>{t("tkRuleCats")}</span><input className="input" value={cats} maxLength={300} onChange={(e) => setCats(e.target.value)} placeholder={t("tkRuleCatsPh")} /></label>
      <label className="field"><span>{t("tkRuleMode")}</span>
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value as "auto" | "approve")}>
          <option value="auto">{t("tkModeAuto")}</option><option value="approve">{t("tkModeApprove")}</option>
        </select></label>
      <button className="btn sm" style={{ justifySelf: "start" }} disabled={busy} onClick={save}>{t("tkRuleSave")}</button>
    </div>
  );
}

/** A task the worker was rejected on: shows the reason and, while the dispute window is open, lets them appeal to the admin. */
function Rejected({ r, onChange }: { r: Row; onChange: () => void }) {
  const { t, toast } = useApp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function dispute() {
    setBusy(true);
    const x = await post("/api/tasks/dispute", { id: r.id, note });
    setBusy(false);
    if (x.ok) { toast(t("tkDisputeSent")); onChange(); } else toast(x.data?.error === "need_note" ? t("tkNeedNote") : t("tkDisputeClosed"));
  }
  return (
    <div className="grid" style={{ gap: 8 }}>
      {r.reject_note && <div className="notice warn">{t("tkRejectedBefore")}: {r.reject_note}</div>}
      {r.in_dispute && <div className="notice">{t("tkInDispute")}</div>}
      {r.can_dispute && (
        <>
          <span className="hint">{t("tkDisputeHint")}</span>
          <textarea className="textarea" value={note} maxLength={500} placeholder={t("tkDisputePh")} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 80 }} />
          <button className="btn sm" style={{ justifySelf: "start" }} disabled={busy || note.trim().length < 5} onClick={dispute}>{t("tkDispute")}</button>
        </>
      )}
    </div>
  );
}

type LogRow = { id: number; tool: string; ok: boolean; note: string; amount: number | null; at: string; key: string | null };
/** What the connected AIs did on this account (changes only), plus a stop button for all of them. */
function AgentLog({ onStopped }: { onStopped: () => void }) {
  const { t, lang, toast } = useApp();
  const [log, setLog] = useState<LogRow[] | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/mcp/log", { credentials: "include", cache: "no-store" }); setLog(r.ok ? (await r.json()).log : []); }, []);
  useEffect(() => { load(); }, [load]);
  async function stopAll() {
    if (typeof window !== "undefined" && !window.confirm(t("alStopConfirm"))) return;
    const r = await post("/api/mcp/tokens", { action: "off_all" });
    if (r.ok) { toast(t("alStopped")); onStopped(); } else toast(t("errGeneric"));
  }
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ flex: 1 }}>{t("alTitle")}</b>
        <button className="btn danger sm" onClick={stopAll}>{t("alStop")}</button>
      </div>
      <p className="hint">{t("alHint")}</p>
      {!log ? <div className="skeleton" style={{ height: 60 }} /> : !log.length ? <span className="hint">{t("alNone")}</span> : (
        <div className="grid" style={{ gap: 4 }}>
          {log.slice(0, 15).map((x) => (
            <div key={x.id} className="grid" style={{ gap: 1, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
              <span className="small"><b className="ltr">{x.tool}</b> {x.ok ? "✓" : "✗"}{x.amount ? <span className="num ltr"> · {pi(x.amount)}</span> : null}{x.key ? <span className="hint"> · {x.key}</span> : null}</span>
              <span className="hint" style={{ overflowWrap: "anywhere" }}>{x.note}</span>
              <span className="hint num">{new Date(x.at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Work() {
  const { t, lang, toast } = useApp();
  const [code, setCode] = useState<{ code: string; at: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [stats, setStats] = useState<(Stats & { new_done: number; new_max_pi: number }) | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const url = typeof location !== "undefined" ? `${location.origin}/mcp` : "/mcp";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetch("/api/mcp/tokens", { credentials: "include", cache: "no-store" }), fetch("/api/tasks?role=worker", { credentials: "include", cache: "no-store" }), fetch("/api/tasks/stats", { credentials: "include", cache: "no-store" })]);
    if (a.ok) setTokens((await a.json()).tokens);
    if (c.ok) setStats(await c.json());
    setRows(b.ok ? (await b.json()).tasks : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setLeft(Math.max(0, 600 - Math.floor((Date.now() - code.at) / 1000))), 1000);
    return () => clearInterval(id);
  }, [code]);

  async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast(t("copied")); } catch { toast(t("errGeneric")); } }
  async function genCode() {
    const r = await post("/api/mcp/link", {});
    if (r.ok) { setCode({ code: r.data.code, at: Date.now() }); setLeft(600); } else toast(t("errGeneric"));
  }
  async function newToken() {
    const r = await post("/api/mcp/tokens", { action: "create", name: "API key" });
    if (r.ok) { setFresh(r.data.token); load(); } else toast(t("errGeneric"));
  }
  async function off(id: string) { await post("/api/mcp/tokens", { action: "off", id }); load(); }
  async function allowPost(id: string, on: boolean) {
    setTokens((cur) => cur.map((k) => (k.id === id ? { ...k, can_post: on } : k)));
    const r = await post("/api/mcp/tokens", { action: "post", id, on });
    if (!r.ok) { toast(t("errGeneric")); load(); }
  }

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <b>{t("tkConnectTitle")}</b>
        <p className="hint">{t("tkConnectSub")}</p>
        <div className="grid" style={{ gap: 6 }}>
          <span className="small">{t("tkStep1")}</span>
          <div className="copy-row"><code className="ltr">{url}</code><button className="btn sm" onClick={() => copy(url)}>{t("copy")}</button></div>
        </div>
        <div className="grid" style={{ gap: 6 }}>
          <span className="small">{t("tkStep2")}</span>
          {code ? (
            <div className="pair-code" aria-live="polite">
              <b className="ltr">{code.code}</b>
              <span className="hint num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
              <button className="btn sm" onClick={() => copy(code.code.replace("-", ""))}>{t("copy")}</button>
            </div>
          ) : null}
          <button className="btn primary" style={{ justifySelf: "start" }} onClick={genCode}>{t("tkGenCode")}</button>
          <span className="hint">{t("tkCodeNote")}</span>
        </div>
        <div className="grid" style={{ gap: 6 }}>
          <span className="small">{t("tkStep3")}</span>
          <div className="prompt-box">{t("tkPrompt")}</div>
          <button className="btn sm" style={{ justifySelf: "start" }} onClick={() => copy(t("tkPrompt"))}>{t("copy")}</button>
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <b>{t("tkKeyTitle")}</b>
        <p className="hint">{t("tkKeyHint")}</p>
        <button className="btn sm" style={{ justifySelf: "start" }} onClick={newToken}>{t("tkTokenNew")}</button>
        {fresh && (
          <div className="grid" style={{ gap: 8 }}>
            <span className="hint">{t("tkTokenOnce")}</span>
            <div className="copy-row"><code className="ltr" style={{ overflowWrap: "anywhere" }}>{fresh}</code><button className="btn sm" onClick={() => copy(fresh)}>{t("copy")}</button></div>
            <span className="small">{t("tkHeaderHow")}</span>
            <div className="copy-row"><code className="ltr" style={{ overflowWrap: "anywhere" }}>Authorization: Bearer {fresh}</code><button className="btn sm" onClick={() => copy(`Authorization: Bearer ${fresh}`)}>{t("copy")}</button></div>
            <span className="small">{t("tkMuseTitle")}</span>
            <div className="prompt-box ltr" style={{ textAlign: "start" }}>{t("tkMuseMsg", { url, token: fresh })}</div>
            <button className="btn primary sm" style={{ justifySelf: "start" }} onClick={() => copy(t("tkMuseMsg", { url, token: fresh }))}>{t("copy")}</button>
          </div>
        )}
      </div>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{t("tkLinked")}</b>
        {tokens.length ? tokens.map((k) => (
          <div key={k.id} className="grid" style={{ gap: 6, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
            <div className="earn-row"><b className="small">{k.name || "AI"}</b><span className="hint num">{k.last_used ? `${t("tkLastUsed")}: ${fmtDate(k.last_used)}` : fmtDate(k.created_at)}</span>
              <button className="btn danger sm" style={{ marginInlineStart: "auto" }} onClick={() => off(k.id)}>{t("tkTokenOff")}</button></div>
            <label className="plan-task"><input type="checkbox" checked={k.can_post} onChange={(e) => allowPost(k.id, e.target.checked)} /><span>{t("tkPostAllow")}<br /><span className="hint">{t("tkPostAllowHint")}</span></span></label>
            {k.can_post && <KeyRules k={k} onSaved={load} />}
          </div>
        )) : <span className="hint">{t("tkNoTokens")}</span>}
      </div>

      <AgentLog onStopped={load} />
      <Link className="md-link small" href="/docs">{t("docsLink")}</Link>
      {stats && (
        <div className="card" style={{ display: "grid", gap: 4 }}>
          <b>{t("tkYourStats")}</b>
          <span className="small num">{t("tkStatsLine", { done: stats.done, avg: stats.avg ?? "—", rej: stats.rejected })}</span>
          {stats.done < stats.new_done && <span className="hint">{t("tkNewWorkerNote", { max: pi(stats.new_max_pi), need: stats.new_done - stats.done })}</span>}
        </div>
      )}
      <div className="sec-h"><h2>{t("tkMyWork")}</h2></div>
      <p className="hint">{t("tkWithdrawHint")} <Link className="md-link" href="/wallet">{t("nWallet")}</Link></p>
      {!rows ? <div className="skeleton" style={{ height: 80 }} /> : !rows.length ? <div className="card empty">{t("tkNoTasks")}</div> : (
        <div className="grid">{rows.map((r) => (
          <div key={r.id} className="card" style={{ display: "grid", gap: 8 }}>
            <button className="lesson-head" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <span className="lesson-tt">
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="chip">{r.category}</span>
                  <span className={`chip ${CHIP[r.status] || ""}`}>{t(`tkS_${r.status}` as Key)}</span>
                  <span className="chip num ltr">{r.status === "approved" && r.paid_pi ? pi(r.paid_pi) : pi(r.net_reward)}</span>
                </span>
                <h2 style={{ fontSize: 15.5 }}>{r.title}</h2>
                {!!r.stages && <StageBar n={r.stages} i={r.stage_idx ?? 0} done={r.status === "approved"} />}
                {r.revision_note && r.status === "claimed" && <span className="hint">{t("tkRevisionAsked", { n: r.revisions ?? 1 })}: {r.revision_note}</span>}
                {r.rating ? <span className="hint num">{"★".repeat(r.rating)}</span> : null}
              </span>
              <span className="lesson-chev" aria-hidden="true">⌄</span>
            </button>
            {r.status === "rejected" ? <Rejected r={r} onChange={load} /> : open === r.id && <TaskWork id={r.id} onChange={load} />}
          </div>
        ))}</div>
      )}
    </>
  );
}
