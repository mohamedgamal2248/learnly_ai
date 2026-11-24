"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";

type Overview = { learners: number; onboarded: number; plus: number; pro: number; revenue_usd: number; revenue_pi: number; lessons_done: number; ai_credits_30d: number; ai_calls_30d: number; teacher_pending: number; catalog: Catalog };
type Catalog = { plans: Record<string, { usd: number; days: number; credits: number }>; packs: { id: string; usd: number; credits: number }[]; costs: Record<string, number>; ai_daily_cap: number; trial?: { days: number; credits: number } };
type AppRow = { id: string; username: string; display_name: string; subjects: string; bio: string; years: number; doc_name: string; status: string; reason: string | null; created_at: string };
type UserRow = { id: string; username: string; role: string; banned: boolean; credits: number; plan: string | null; plan_until: string | null; xp: number | null; streak: number };

const TABS = ["Overview", "Plans & AI", "Teachers", "Reports", "Users"] as const;

async function get<T>(url: string): Promise<T | null> { try { const r = await fetch(url, { credentials: "include", cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } }

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="lc"><div className="muted small">{label}</div><div className="big num">{value}</div>{sub && <div className="muted small">{sub}</div>}</div>;
}

function OverviewTab({ o }: { o: Overview | null }) {
  if (!o) return <div className="skeleton" style={{ height: 200 }} />;
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <Stat label="Learners" value={o.learners} sub={`${o.onboarded} finished setup`} />
      <Stat label="Active plans" value={o.plus + o.pro} sub={`${o.plus} Plus · ${o.pro} Pro`} />
      <Stat label="Revenue" value={`$${Number(o.revenue_usd).toFixed(0)}`} sub={`${Number(o.revenue_pi).toFixed(0)} π collected`} />
      <Stat label="Lessons finished" value={o.lessons_done} />
      <Stat label="AI calls (30 days)" value={o.ai_calls_30d} sub={`${o.ai_credits_30d} credits used`} />
      <Stat label="Teacher applications" value={o.teacher_pending} sub="waiting for review" />
    </div>
  );
}

function PlansTab({ o, reload }: { o: Overview | null; reload: () => void }) {
  const { toast } = useApp();
  const [c, setC] = useState<Catalog | null>(null);
  const [g, setG] = useState({ username: "", plan: "plus", days: 30, credits: 0 });
  useEffect(() => { if (o) setC(JSON.parse(JSON.stringify(o.catalog))); }, [o]);
  if (!c) return <div className="skeleton" style={{ height: 200 }} />;
  const num = (v: string) => (v === "" ? 0 : Number(v));
  async function save() {
    const r = await post("/api/admin/en", { kind: "catalog", catalog: c });
    toast(r.ok ? "Saved" : "Not saved: check the numbers"); if (r.ok) reload();
  }
  async function grant() {
    const r = await post("/api/admin/en", { kind: "grant", username: g.username, plan: g.plan === "none" ? null : g.plan, days: g.days, credits: g.credits });
    toast(r.ok && r.data?.ok ? "Granted" : r.data?.reason === "no_user" ? "No such user" : "Failed");
  }
  return (
    <div className="stack">
      <section className="lc stack">
        <b>Plans (USD, days, AI credits per purchase)</b>
        <p className="hint">Pi prices follow the live OKX rate and are rounded up to whole Pi. Credit numbers here are placeholders: set them after you see real AI cost.</p>
        {(["plus", "pro"] as const).map((id) => (
          <div key={id} className="grid" style={{ gridTemplateColumns: "60px 1fr 1fr 1fr", alignItems: "end", gap: 8 }}>
            <b>{id === "pro" ? "Pro" : "Plus"}</b>
            {(["usd", "days", "credits"] as const).map((k) => <label key={k} className="field"><span>{k === "usd" ? "USD" : k}</span><input className="input" type="number" min={0} step={k === "usd" ? 0.5 : 1} value={c.plans[id][k]} onChange={(e) => setC({ ...c, plans: { ...c.plans, [id]: { ...c.plans[id], [k]: num(e.target.value) } } })} /></label>)}
          </div>
        ))}
        <b>Credit packs</b>
        {c.packs.map((p, i) => (
          <div key={p.id} className="grid" style={{ gridTemplateColumns: "60px 1fr 1fr", alignItems: "end", gap: 8 }}>
            <b>#{i + 1}</b>
            <label className="field"><span>USD</span><input className="input" type="number" min={0} step={0.5} value={p.usd} onChange={(e) => setC({ ...c, packs: c.packs.map((x, j) => (j === i ? { ...x, usd: num(e.target.value) } : x)) })} /></label>
            <label className="field"><span>credits</span><input className="input" type="number" min={1} value={p.credits} onChange={(e) => setC({ ...c, packs: c.packs.map((x, j) => (j === i ? { ...x, credits: num(e.target.value) } : x)) })} /></label>
          </div>
        ))}
        <b>AI cost per request (credits)</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {(["explain", "chat", "correct", "write"] as const).map((k) => <label key={k} className="field"><span>{k}</span><input className="input" type="number" min={1} max={20} value={c.costs[k]} onChange={(e) => setC({ ...c, costs: { ...c.costs, [k]: num(e.target.value) } })} /></label>)}
        </div>
        <label className="field"><span>Daily AI limit per learner (credits)</span><input className="input" type="number" min={1} value={c.ai_daily_cap} onChange={(e) => setC({ ...c, ai_daily_cap: num(e.target.value) })} /></label>
        <b>Free Plus trial (once per person)</b>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className="field"><span>Days (0 turns it off)</span><input className="input" type="number" min={0} max={30} value={c.trial?.days ?? 3} onChange={(e) => setC({ ...c, trial: { days: num(e.target.value), credits: c.trial?.credits ?? 20 } })} /></label>
          <label className="field"><span>AI credits</span><input className="input" type="number" min={0} max={500} value={c.trial?.credits ?? 20} onChange={(e) => setC({ ...c, trial: { days: c.trial?.days ?? 3, credits: num(e.target.value) } })} /></label>
        </div>
        <button className="btn primary" onClick={save}>Save prices and limits</button>
      </section>

      <section className="lc stack">
        <b>Give a plan or credits (for testing or support)</b>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className="field"><span>Pi username</span><input className="input" value={g.username} onChange={(e) => setG({ ...g, username: e.target.value })} /></label>
          <label className="field"><span>Plan</span><select className="select" value={g.plan} onChange={(e) => setG({ ...g, plan: e.target.value })}><option value="plus">Plus</option><option value="pro">Pro</option><option value="none">No plan change</option></select></label>
          <label className="field"><span>Days</span><input className="input" type="number" min={1} max={366} value={g.days} onChange={(e) => setG({ ...g, days: num(e.target.value) })} /></label>
          <label className="field"><span>Credits (+/-)</span><input className="input" type="number" value={g.credits} onChange={(e) => setG({ ...g, credits: num(e.target.value) })} /></label>
        </div>
        <button className="btn" onClick={grant} disabled={!g.username.trim()}>Grant</button>
      </section>
    </div>
  );
}

function TeachersTab({ reload }: { reload: () => void }) {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [filter, setFilter] = useState("pending");
  const { toast } = useApp();
  const load = useCallback(() => { get<{ apps: AppRow[] }>(`/api/admin/apps?status=${filter}`).then((d) => setApps(d?.apps || [])); }, [filter]);
  useEffect(load, [load]);
  async function decide(id: string, approve: boolean) {
    let reason = "";
    if (!approve) { reason = prompt("Reason for rejecting (the applicant will see it):") || ""; if (!reason) return; }
    const r = await post("/api/admin/decide", { kind: "app", id, approve, reason });
    toast(r.ok ? "Done" : "Failed"); load(); reload();
  }
  return (
    <div className="stack">
      <div className="seg" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{["pending", "approved", "rejected"].map((s) => <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>)}</div>
      {!apps ? <div className="skeleton" style={{ height: 120 }} /> : !apps.length ? <div className="lc muted">No {filter} applications.</div> : apps.map((a) => (
        <div key={a.id} className="lc stack">
          <div className="row"><b className="grow">{a.display_name} <span className="muted small">@{a.username}</span></b><span className="chip">{a.years} yrs</span></div>
          <div className="small"><b>Teaches:</b> {a.subjects}</div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>{a.bio}</div>
          {a.doc_name ? <a className="btn sm" href={`/api/admin/doc/${a.id}`} target="_blank" rel="noreferrer">Open proof: {a.doc_name}</a> : <span className="hint">Proof file already wiped.</span>}
          {a.reason && <div className="hint">Reason: {a.reason}</div>}
          {a.status === "pending" && <div className="row-actions"><button className="btn ok sm" onClick={() => decide(a.id, true)}>Approve</button><button className="btn danger sm" onClick={() => decide(a.id, false)}>Reject</button></div>}
        </div>
      ))}
    </div>
  );
}

type Rep = { id: number; lesson_id: string; word: string | null; note: string; status: string; created_at: string; username: string };
function ReportsTab() {
  const [rows, setRows] = useState<Rep[] | null>(null);
  const [filter, setFilter] = useState("open");
  const { toast } = useApp();
  const load = useCallback(() => { get<{ reports: Rep[] }>(`/api/admin/en-reports?status=${filter}`).then((d) => setRows(d?.reports || [])); }, [filter]);
  useEffect(load, [load]);
  async function setStatus(id: number, status: string) { const r = await post("/api/admin/en-reports", { id, status }); toast(r.ok ? "Done" : "Failed"); load(); }
  return (
    <div className="stack">
      <div className="seg" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>{["open", "fixed", "dismissed"].map((s) => <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s}</button>)}</div>
      {!rows ? <div className="skeleton" style={{ height: 120 }} /> : !rows.length ? <div className="lc muted">No {filter} reports.</div> : rows.map((x) => (
        <div key={x.id} className="lc stack">
          <div className="row"><b className="grow">{x.lesson_id}{x.word ? ` · ${x.word}` : ""}</b><span className="muted small">@{x.username}</span></div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>{x.note}</div>
          {x.status === "open" && <div className="row-actions"><button className="btn ok sm" onClick={() => setStatus(x.id, "fixed")}>Fixed</button><button className="btn sm" onClick={() => setStatus(x.id, "dismissed")}>Dismiss</button></div>}
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [d, setD] = useState<{ total: number; rows: UserRow[] } | null>(null);
  const { toast } = useApp();
  const load = useCallback(() => { get<{ total: number; rows: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(setD); }, [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  async function ban(u: UserRow) { const r = await post("/api/admin/decide", { kind: "ban", id: u.id, banned: !u.banned }); toast(r.ok ? "Done" : "Failed"); load(); }
  return (
    <div className="stack">
      <input className="input" placeholder="Search by username" value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} />
      {!d ? <div className="skeleton" style={{ height: 120 }} /> : d.rows.map((u) => (
        <div key={u.id} className="lc row" style={{ padding: 12 }}>
          <div className="grow"><b>@{u.username}</b> {u.role !== "user" && <span className="chip v">{u.role}</span>} {u.banned && <span className="chip bad">banned</span>}
            <div className="muted small num">{u.plan ? `${u.plan} until ${u.plan_until?.slice(0, 10)}` : "free"} · {u.credits} credits · {u.xp ?? 0} XP · streak {u.streak}</div></div>
          <button className="btn sm" onClick={() => ban(u)}>{u.banned ? "Unban" : "Ban"}</button>
        </div>
      ))}
      {d && <div className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="grow muted small" style={{ textAlign: "center" }}>{d.total} users</span><button className="btn sm" disabled={(page + 1) * 30 >= d.total} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

export default function Admin() {
  const { user, ready } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [o, setO] = useState<Overview | null>(null);
  const reload = useCallback(() => { get<Overview>("/api/admin/en").then(setO); }, []);
  useEffect(() => { if (user?.role === "admin") reload(); }, [user, reload]);
  if (!ready) return <div className="skeleton" style={{ height: 120 }} />;
  if (user?.role !== "admin") return <div className="lc">This page is for admins only.</div>;
  return (
    <div className="stack">
      <h1 style={{ fontSize: 22 }}>Admin</h1>
      <div className="seg" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>{TABS.map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} style={{ fontSize: 13 }}>{t}{t === "Teachers" && o?.teacher_pending ? ` (${o.teacher_pending})` : ""}</button>)}</div>
      {tab === "Overview" && <OverviewTab o={o} />}
      {tab === "Plans & AI" && <PlansTab o={o} reload={reload} />}
      {tab === "Teachers" && <TeachersTab reload={reload} />}
      {tab === "Reports" && <ReportsTab />}
      {tab === "Users" && <UsersTab />}
    </div>
  );
}
