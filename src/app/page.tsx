"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "@/lib/i18n";
import { useApp } from "@/components/AppProvider";
import { CourseCards } from "@/components/CourseCards";
import { RatingChip, useRatings } from "@/components/Reviews";
import type { CourseCard } from "@/lib/courses";
import { IconTile, ITask, IBook, IBriefcase, ICap, ICode, ILang, ISearch, IShield, IUsers, IBot } from "@/components/Icons";
import { botText, lastBotId, loadBots, TRACK_KEYS, type BotInfo } from "@/lib/bots";

const TRACK_ICON: Record<string, React.ReactNode> = {
  school: <IBook width={18} height={18} />, uni: <ICap width={18} height={18} />, job: <IBriefcase width={18} height={18} />,
  code: <ICode width={18} height={18} />, lang: <ILang width={18} height={18} />, academy: <IShield width={18} height={18} />,
};

function fmtBig(n: number, lang: string) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export default function Home() {
  const { t, user, lang } = useApp();
  const [bots, setBots] = useState<BotInfo[] | null>(null);
  const [track, setTrack] = useState<string>("all");
  const [q, setQ] = useState("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const ratings = useRatings();
  const [openTasks, setOpenTasks] = useState<{ id: string; kind: string; title: string; reward: number }[]>([]);
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [stats, setStats] = useState<{ learners: number; bots: number; creators: number; messages: number } | null>(null);

  useEffect(() => {
    loadBots().then(setBots).catch(() => setBots([]));
    setResumeId(lastBotId());
    fetch("/api/courses").then((r) => r.json()).then((d) => setCourses(d.courses || [])).catch(() => setCourses([]));
    fetch("/api/tasks/board?limit=4").then((r) => r.json()).then((d) => setOpenTasks(d.tasks || [])).catch(() => {});
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const resumeBot = bots?.find((b) => b.id === resumeId);
  const resume = resumeBot ? { id: resumeBot.id, name: botText(resumeBot, lang).name } : null;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (bots || []).filter((b) =>
      (track === "all" || b.track === track) &&
      (!s || `${b.name} ${b.name_en ?? ""} ${b.subject} ${b.subject_en ?? ""} ${b.teacher_name ?? ""} ${b.description} ${b.description_en ?? ""}`.toLowerCase().includes(s)));
  }, [bots, track, q]);

  return (
    <div className="cols">
      <div style={{ minWidth: 0 }}>
        <section className="card hello">
          <h1>{user ? t("helloUser", { name: user.username }) : t("helloGuest")}</h1>
          <p className="muted">{t("tagline")}</p>
          <label className="search">
            <ISearch width={18} height={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} aria-label={t("searchPh")} />
          </label>
          {stats && stats.learners > 0 && (
            <div className="stats-row">
              {([["learners", "stLearners"], ["creators", "stCreators"], ["bots", "stBots"], ["messages", "stMsgs"]] as const).map(([k, key]) => (
                <div key={k} className="stat"><b className="num">{fmtBig(stats[k], lang)}</b><span>{t(key)}</span></div>
              ))}
            </div>
          )}
          {resume && (
            <Link className="resume" href={`/chat?b=${resume.id}`}>
              <IBot />
              <span style={{ display: "grid" }}><span className="k">{t("resume")}</span><span className="t">{resume.name}</span></span>
            </Link>
          )}
        </section>

        {!user && (
          <section className="how stagger" aria-label={t("howTitle")}>
            {([["1", "how1", "how1s"], ["2", "how2", "how2s"], ["3", "how3", "how3s"]] as const).map(([n, h, sub]) => (
              <div key={n} className="card how-step"><span className="how-n num">{n}</span><b>{t(h)}</b><span className="muted small">{t(sub)}</span></div>
            ))}
          </section>
        )}

        {courses && courses.length > 0 && (
          <>
            <div className="sec-h" style={{ display: "flex", alignItems: "center" }}>
              <h2 style={{ flex: 1 }}>{t("coursesTitle")}</h2><Link href="/courses" className="small md-link">{t("more")}</Link>
            </div>
            <CourseCards courses={courses.slice(0, 4)} />
          </>
        )}

        {openTasks.length > 0 && (
          <>
            <div className="sec-h" style={{ display: "flex", alignItems: "center" }}>
              <h2 style={{ flex: 1 }}>{t("tkTabBoard")}</h2><Link href="/tasks" className="small md-link">{t("more")}</Link>
            </div>
            <div className="course-grid stagger">
              {openTasks.map((x) => (
                <Link key={x.id} href="/tasks" className="card course-card">
                  <div className="cc-top"><IconTile size={38}><ITask /></IconTile><span className="chip free num ltr">{Number(x.reward).toLocaleString("en-US", { maximumFractionDigits: 4 })} π</span></div>
                  <b className="cc-title">{x.title}</b>
                  <span className="chip" style={{ justifySelf: "start" }}>{t(`kind_${x.kind}` as Key)}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="sec-h"><h2>{t("tracks")}</h2></div>
        <div className="chips" role="tablist">
          <button className={`pill${track === "all" ? " on" : ""}`} onClick={() => setTrack("all")}>{t("all")}</button>
          {Object.entries(TRACK_KEYS).map(([k, key]) => (
            <button key={k} className={`pill${track === k ? " on" : ""}`} onClick={() => setTrack(k)}>{t(key)}</button>
          ))}
        </div>

        <div className="sec-h"><h2>{t("botsTitle")}</h2></div>
        {!bots ? (
          <div className="bots">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
        ) : shown.length ? (
          <div className="bots stagger">
            {shown.map((b) => { const bt = botText(b, lang); return (
              <Link key={b.id} href={`/chat?b=${b.id}`} className="card bot-card">
                <div className="bot-top">
                  <div className="avatar">{TRACK_ICON[b.track] || bt.name.slice(0, 1)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="bot-name">{bt.name}{b.official ? <span className="chip v">{t("official")}</span> : <span className="chip v">{t("verified")}</span>}</div>
                    <div className="bot-sub">{bt.subject}{b.teacher_name && !b.official ? ` · ${b.teacher_name}` : ""}</div>
                  </div>
                </div>
                {bt.description && <p className="bot-desc">{bt.description}</p>}
                <div className="meta">
                  <RatingChip r={ratings[b.id]} />
                  {b.has_knowledge && <span className="chip">{t("fromFiles")}</span>}
                  {b.fee > 0 && <span className="chip num">{t("perMsg", { n: b.fee })}</span>}
                  <span className="chip free" style={{ marginInlineStart: "auto" }}>{t("ask")}</span>
                </div>
              </Link>
            ); })}
          </div>
        ) : (
          <div className="card empty">{t("noBots")}</div>
        )}
      </div>

      <aside className="side">
        <div className="card">
          <div className="sec-h" style={{ marginTop: 0 }}><h2>{t("teacherCta")}</h2></div>
          <p className="muted small" style={{ marginBottom: 12 }}>{t("teacherCtaSub")}</p>
          <Link href="/teach" className="btn primary block">{t("applyNow")}</Link>
        </div>
        <Link href="/community" className="card mini" style={{ textDecoration: "none" }}>
          <span className="ico"><IUsers width={18} height={18} /></span>
          <div><b>{t("nCommunity")} <span className="chip free">{t("free")}</span></b><span>{t("communityCta")}</span></div>
        </Link>
        <Link href="/academy" className="card mini" style={{ textDecoration: "none" }}>
          <span className="ico"><IShield width={18} height={18} /></span>
          <div><b>{t("nAcademy")} <span className="chip free">{t("free")}</span></b><span>{t("academyCta")}</span></div>
        </Link>
        <nav className="legal-links"><Link href="/privacy">{t("privacy")}</Link> · <Link href="/terms">{t("terms")}</Link> · <span>© 2026 Learnly AI</span></nav>
      </aside>
    </div>
  );
}
