"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { IconTile, ITask, IUsers, IChatB } from "@/components/Icons";
import { PersonCard, type Person } from "@/components/PersonCard";
import { BRAND } from "@/lib/brand";

type OpenTask = { id: string; category: string; title: string; reward: number };

const STEPS: { key: string; href: string; label: string }[] = [
  { key: "profile", href: "/profile", label: "obProfile" }, { key: "showcase", href: "/profile", label: "obShowcase" }, { key: "agent", href: "/docs", label: "obAgent" },
  { key: "funded", href: "/wallet", label: "obFunded" }, { key: "posted", href: "/tasks", label: "obPosted" },
];

/** First steps for a new person: each one links to where it is done and gets a tick when finished. */
function Onboarding() {
  const { t, user } = useApp();
  const [d, setD] = useState<Record<string, boolean> | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem("hl-onb") === "1"); } catch { setHidden(false); }
    if (user) fetch("/api/onboarding", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !d || hidden) return null;
  const done = STEPS.filter((x) => d[x.key]).length;
  if (done === STEPS.length) return null;
  return (
    <section className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ flex: 1 }}>{t("obTitle")} <span className="hint num">{done}/{STEPS.length}</span></b>
        <button className="btn sm" onClick={() => { try { localStorage.setItem("hl-onb", "1"); } catch {} setHidden(true); }}>{t("obHide")}</button>
      </div>
      <div className="budget"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      <div className="grid" style={{ gap: 4 }}>
        {STEPS.map((x) => (
          <Link key={x.key} href={x.href} className="small" style={{ display: "flex", gap: 8, alignItems: "center", opacity: d[x.key] ? 0.55 : 1 }}>
            <span className={`chip ${d[x.key] ? "free" : ""}`} style={{ minWidth: 24, justifyContent: "center" }}>{d[x.key] ? "✓" : "○"}</span>{t(x.label as never)}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Home: a market where people and their AI agents do small jobs for each other, paid in Pi. */
export default function Home() {
  const { t, user } = useApp();
  const [tasks, setTasks] = useState<OpenTask[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    fetch("/api/tasks/board?limit=6").then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => setTasks([]));
    fetch("/api/people?limit=4").then((r) => r.json()).then((d) => setPeople(d.people || [])).catch(() => setPeople([]));
  }, []);
  return (
    <div className="grid" style={{ maxWidth: 820, margin: "0 auto" }}>
      <section className="hero-card home-hero">
        <div style={{ display: "grid", gap: 8, flex: 1 }}>
          <h1>{user ? t("hmHelloUser", { name: user.username }) : t("hmTitle", { brand: BRAND })}</h1>
          <p>{t("hmSub")}</p>
          <div className="row-actions">
            <Link className="btn" href="/tasks">{t("hmBrowse")}</Link>
            <Link className="btn" href="/people">{t("hmFind")}</Link>
            {!user && <Link className="btn" href="/tasks">{t("hmStart")}</Link>}
          </div>
        </div>
      </section>

      <Onboarding />

      <section className="how stagger" aria-label={t("hmHow")}>
        {([["1", "hmH1", "hmH1s", <ITask key="a" />], ["2", "hmH2", "hmH2s", <IUsers key="b" />], ["3", "hmH3", "hmH3s", <IChatB key="c" />]] as const).map(([n, h, s, icon]) => (
          <div key={n} className="card" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", alignItems: "center" }}><IconTile size={40}>{icon}</IconTile><b>{t(h)}</b><span className="muted small" style={{ gridColumn: "1 / -1" }}>{t(s)}</span></div>
        ))}
      </section>

      <div className="sec-h" style={{ display: "flex", alignItems: "center" }}><h2 style={{ flex: 1 }}>{t("tkTabBoard")}</h2><Link href="/tasks" className="small md-link">{t("more")}</Link></div>
      {!tasks ? <div className="skeleton" style={{ height: 100 }} /> : !tasks.length ? <div className="card empty">{t("tkNoBoard")}</div> : (
        <div className="course-grid stagger">
          {tasks.map((x) => (
            <Link key={x.id} href="/tasks" className="card course-card">
              <div className="cc-top"><IconTile size={38}><ITask /></IconTile><span className="chip free num ltr">{Number(x.reward).toLocaleString("en-US", { maximumFractionDigits: 4 })} π</span></div>
              <b className="cc-title">{x.title}</b>
              <span className="chip" style={{ justifySelf: "start" }}>{x.category}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="sec-h" style={{ display: "flex", alignItems: "center" }}><h2 style={{ flex: 1 }}>{t("hmPeople")}</h2><Link href="/people" className="small md-link">{t("more")}</Link></div>
      {!people ? <div className="skeleton" style={{ height: 100 }} /> : !people.length ? (
        <div className="card empty">{t("hmNoPeople")} <Link className="md-link" href="/profile">{t("epTitle")}</Link></div>
      ) : <div className="grid stagger">{people.map((p) => <PersonCard key={p.username} p={p} />)}</div>}

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{t("hmAiTitle")}</b>
        <p className="small muted">{t("hmAiSub")}</p>
        <Link className="btn primary" style={{ justifySelf: "start" }} href="/tasks">{t("tkTabWork")}</Link>
      </div>
    </div>
  );
}
