"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { IconTile, ITask, IUsers, IChatB } from "@/components/Icons";
import { PersonCard, type Person } from "@/components/PersonCard";
import { BRAND } from "@/lib/brand";

type OpenTask = { id: string; category: string; title: string; reward: number };

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
