"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { IBook, IBriefcase, ICap, ICode, ILang, ISearch, IShield, IUsers, IBot } from "@/components/Icons";
import { botText, lastBot, loadBots, TRACK_KEYS, type BotInfo } from "@/lib/bots";

const TRACK_ICON: Record<string, React.ReactNode> = {
  school: <IBook width={18} height={18} />, uni: <ICap width={18} height={18} />, job: <IBriefcase width={18} height={18} />,
  code: <ICode width={18} height={18} />, lang: <ILang width={18} height={18} />, academy: <IShield width={18} height={18} />,
};

export default function Home() {
  const { t, user, lang } = useApp();
  const [bots, setBots] = useState<BotInfo[] | null>(null);
  const [track, setTrack] = useState<string>("all");
  const [q, setQ] = useState("");
  const [resume, setResume] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadBots().then(setBots).catch(() => setBots([]));
    setResume(lastBot());
  }, []);

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
          {resume && (
            <Link className="resume" href={`/chat?b=${resume.id}`}>
              <IBot />
              <span style={{ display: "grid" }}><span className="k">{t("resume")}</span><span className="t">{resume.name}</span></span>
            </Link>
          )}
        </section>

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
      </aside>
    </div>
  );
}
