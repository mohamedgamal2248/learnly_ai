"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { post } from "@/lib/pi-client";
import type { Key } from "@/lib/i18n";

type Overview = {
  config: Record<string, number | boolean>;
  today: { cost_usd?: number; credits?: number; msgs?: number };
  users: number; paid_users: number; revenue_pi: number;
  apps: { id: string; username: string; display_name: string; subjects: string; bio: string; years: number; doc_name: string | null; has_doc: boolean }[];
  bots: { id: string; name: string; subject: string; teacher_name: string; description: string; instructions: string; knowledge_chars: number; fee: number }[];
  reported: { id: number; username: string; body: string; reports: number }[];
};

const LIMIT_FIELDS: [string, Key, number][] = [
  ["markup", "lMarkup", 0.5], ["welcome_credits", "lWelcome", 10], ["free_daily_msgs", "lFreeMsgs", 1],
  ["daily_budget_usd", "lBudget", 0.5], ["max_reserve", "lReserve", 10], ["file_fee", "lFileFee", 1],
];

export default function AdminPage() {
  const { t, user, ready, toast, lang } = useApp();
  const [o, setO] = useState<Overview | null>(null);
  const [cfg, setCfg] = useState<Record<string, number | boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/overview", { credentials: "include", cache: "no-store" });
    if (!r.ok) return;
    const d: Overview = await r.json();
    setO(d); setCfg(d.config);
  }, []);
  useEffect(() => { if (user?.role === "admin") load(); }, [user, load]);

  if (!ready) return <div className="skeleton" style={{ height: 160 }} />;
  if (user?.role !== "admin") return <div className="card empty">{t("forbidden")}</div>;
  if (!o) return <div className="skeleton" style={{ height: 160 }} />;

  const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: d });
  const budget = Number(o.config.daily_budget_usd) || 1;
  const cost = Number(o.today.cost_usd || 0);

  async function decide(kind: "app" | "bot" | "post", id: string | number, approve: boolean) {
    const r = await post("/api/admin/decide", { kind, id, approve, reason: reasons[String(id)] });
    if (r.ok) { toast(t("decided")); load(); } else toast(t("errGeneric"));
  }
  async function saveCfg(patch?: Record<string, number | boolean>) {
    const r = await post("/api/admin/config", patch ?? cfg);
    if (r.ok) { setCfg(r.data.config); toast(t("savedOk")); } else toast(`${t("errGeneric")} ${r.data?.field ?? ""}`);
  }

  return (
    <div className="grid">
      <div className="card"><h1 style={{ fontSize: 20 }}>{t("adminTitle")}</h1></div>
      <div className="kpis stagger">
        <div className="card kpi"><div className="v num">{fmt(o.users)}</div><div className="l">{t("kUsers")}</div></div>
        <div className="card kpi"><div className="v num">{fmt(o.paid_users)}</div><div className="l">{t("kPaid")}</div></div>
        <div className="card kpi"><div className="v num ltr">{fmt(o.revenue_pi, 4)} π</div><div className="l">{t("kRevenue")}</div></div>
        <div className="card kpi">
          <div className="v num ltr">${cost.toFixed(3)} / ${budget}</div>
          <div className="l">{t("kCost")} · {fmt(o.today.msgs || 0)} {t("kMsgs")}</div>
          <div className="budget"><i style={{ width: `${Math.min(100, (cost / budget) * 100)}%` }} /></div>
        </div>
      </div>

      <div className="sec-h"><h2>{t("apps")}</h2></div>
      {o.apps.length === 0 ? <div className="card empty">{t("noApps")}</div> : o.apps.map((a) => (
        <div key={a.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>{a.display_name}</b><span className="chip ltr">@{a.username}</span><span className="chip">{t("years", { n: a.years })}</span>
          </div>
          <p className="small"><b>{a.subjects}</b></p>
          <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{a.bio}</p>
          {a.has_doc && <a className="link" href={`/api/admin/doc/${a.id}`} target="_blank" rel="noopener noreferrer">{t("viewDoc")} · {a.doc_name}</a>}
          <input className="input" placeholder={t("reasonPh")} value={reasons[a.id] || ""} onChange={(e) => setReasons({ ...reasons, [a.id]: e.target.value })} aria-label={t("reasonPh")} />
          <div className="row-actions">
            <button className="btn ok sm" onClick={() => decide("app", a.id, true)}>{t("approve")}</button>
            <button className="btn danger sm" onClick={() => decide("app", a.id, false)}>{t("reject")}</button>
          </div>
        </div>
      ))}

      <div className="sec-h"><h2>{t("botsReview")}</h2></div>
      {o.bots.length === 0 ? <div className="card empty">{t("noBotsReview")}</div> : o.bots.map((b) => (
        <div key={b.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>{b.name}</b><span className="chip">{b.subject}</span><span className="chip">{b.teacher_name}</span>
            <span className="chip num">{t("knowledge", { n: b.knowledge_chars })}</span>
            {b.fee > 0 && <span className="chip num">{t("perMsg", { n: b.fee })}</span>}
          </div>
          {b.description && <p className="small">{b.description}</p>}
          {b.instructions && <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{b.instructions}</p>}
          <div className="row-actions">
            <Link className="btn sm" href={`/chat?b=${b.id}`}>{t("try")}</Link>
            <button className="btn ok sm" onClick={() => decide("bot", b.id, true)}>{t("approve")}</button>
            <button className="btn danger sm" onClick={() => decide("bot", b.id, false)}>{t("reject")}</button>
          </div>
        </div>
      ))}

      <div className="sec-h"><h2>{t("reportedPosts")}</h2></div>
      {o.reported.length === 0 ? <div className="card empty">{t("noReported")}</div> : o.reported.map((p) => (
        <div key={p.id} className="card" style={{ display: "grid", gap: 8 }}>
          <div><b className="ltr">@{p.username}</b> <span className="chip bad num">{p.reports}</span></div>
          <p className="post-body small">{p.body}</p>
          <div className="row-actions">
            <button className="btn danger sm" onClick={() => decide("post", p.id, false)}>{t("hide")}</button>
            <button className="btn sm" onClick={() => decide("post", p.id, true)}>{t("keep")}</button>
          </div>
        </div>
      ))}

      <div className="sec-h"><h2>{t("limits")}</h2></div>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <label className="switch">
          <span>{t("killFree")}</span>
          <input type="checkbox" id="kill_free" checked={!!cfg.kill_free} onChange={(e) => saveCfg({ kill_free: e.target.checked })} style={{ width: 22, height: 22 }} />
        </label>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {LIMIT_FIELDS.map(([k, label, step]) => (
            <label key={k} className="field"><span>{t(label)}</span>
              <input className="input num" id={`cfg-${k}`} type="number" step={step} value={String(cfg[k] ?? "")}
                onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <button className="btn primary" style={{ justifySelf: "start" }} onClick={() => { const { kill_free, ...nums } = cfg; void kill_free; saveCfg(nums); }}>{t("save")}</button>
      </div>
    </div>
  );
}
