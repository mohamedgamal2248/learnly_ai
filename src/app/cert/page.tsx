"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";

type Cert = { id: string; kind: string; title: string; title_en: string; username: string; hash: string; txid: string | null; network: string | null; created_at: string };
type Verify = { hashOk: boolean; chainOk: boolean | null; chainUrl: string | null };

function CertView() {
  const { t, lang, toast } = useApp();
  const id = useSearchParams().get("id") || "";
  const [d, setD] = useState<{ cert: Cert; verify: Verify } | null | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/certs?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, [id]);
  if (d === undefined) return <div className="skeleton" style={{ height: 320 }} />;
  if (!d) return <div className="card empty">{t("certMissing")}</div>;
  const { cert: c, verify: v } = d;
  const title = lang === "ar" ? c.title : c.title_en || c.title;
  const date = new Date(c.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Learnly AI — ${title}`, url });
      else { await navigator.clipboard.writeText(url); toast(t("copied")); }
    } catch {}
  }

  return (
    <div className="grid" style={{ maxWidth: 720, margin: "0 auto" }}>
      <article className="cert">
        <div className="cert-brand">Learnly <b>AI</b></div>
        <div className="cert-k">{t("certOf")}</div>
        <div className="cert-name ltr">@{c.username}</div>
        <div className="cert-k">{t("certFor")}</div>
        <h1 className="cert-title">{title}</h1>
        <div className="cert-date num">{date}</div>
        <div className={`cert-seal${v.chainOk ? " ok" : ""}`}>{v.chainOk ? "✓" : "π"}</div>
      </article>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>{t("certVerify")}</b>
        <div className="vrow"><span className={`chip ${v.hashOk ? "free" : "bad"}`}>{v.hashOk ? "✓" : "✗"}</span>{t("certHashOk")}</div>
        <div className="vrow">
          <span className={`chip ${v.chainOk ? "free" : v.chainOk === false ? "bad" : "warn"}`}>{v.chainOk ? "✓" : v.chainOk === false ? "✗" : "…"}</span>
          {v.chainOk ? t("certChainOk", { net: c.network === "mainnet" ? "Mainnet" : "Testnet" }) : c.txid ? t("certChainBad") : t("certChainPending")}
        </div>
        <span className="hint ltr" style={{ overflowWrap: "anywhere" }}>SHA-256: {c.hash}</span>
        {v.chainUrl && <a className="hint ltr md-link" href={v.chainUrl} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>tx: {c.txid}</a>}
        <div className="row-actions"><button className="btn primary" onClick={share}>{t("certShare")}</button></div>
      </div>
    </div>
  );
}

export default function CertPage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}><CertView /></Suspense>;
}
