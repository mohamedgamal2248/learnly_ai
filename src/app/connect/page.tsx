"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { IconTile, ITask } from "@/components/Icons";
import { oauthAppName } from "@/lib/oauth-client";

function ConnectInner() {
  const { t } = useApp();
  const q = useSearchParams();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const msg = (e: string) => ({ bad_code: "cnBad", code_expired: "cnExpired", code_used: "cnUsedUp", code_replaced: "cnReplaced", slow_down: "cnSlow" } as const)[e as "bad_code"];
  const p = {
    client_id: q.get("client_id") || "", redirect_uri: q.get("redirect_uri") || "", state: q.get("state") || "",
    code_challenge: q.get("code_challenge") || "", code_challenge_method: q.get("code_challenge_method") || "",
  };
  if (!p.client_id || !p.redirect_uri || !p.code_challenge) {
    return (
      <div className="card" style={{ display: "grid", gap: 10, maxWidth: 520, margin: "0 auto" }}>
        <p className="muted">{t("cnMissing")}</p>
        <Link className="btn primary" href="/tasks">{t("cnGoTasks")}</Link>
      </div>
    );
  }
  async function allow(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/oauth/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, code }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && d.redirect) window.location.href = d.redirect;
    else { const k = msg(d.error); setErr(k ? t(k) : `${t("cnTech")} (${d.error || r.status})`); }
  }
  return (
    <form className="card" onSubmit={allow} style={{ display: "grid", gap: 12, maxWidth: 520, margin: "0 auto" }}>
      <IconTile size={48}><ITask /></IconTile>
      <h1 style={{ fontSize: 20 }}>{t("cnTitle")}</h1>
      <p className="muted">{t("cnSub", { app: oauthAppName(p.client_id) })}</p>
      <label className="field"><span>{t("cnCode")}</span>
        <input className="input ltr pair-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" maxLength={9} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <span className="hint">{t("cnCodeHint")}</span></label>
      {err && <div className="notice bad">{err}</div>}
      <button className="btn primary" disabled={busy || code.replace(/[^A-Z0-9]/gi, "").length < 8}>{t("cnAllow")}</button>
    </form>
  );
}

export default function ConnectPage() {
  return <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}><ConnectInner /></Suspense>;
}
