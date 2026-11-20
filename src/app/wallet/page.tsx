"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Earnings } from "@/components/Earnings";
import { TopUp } from "@/components/TopUp";

/** One place for the Pi balance: add Pi (to post tasks and hire people) and withdraw earnings to your own wallet. */
export default function WalletPage() {
  const { t, user, ready, login } = useApp();
  const [n, setN] = useState(0);
  if (!ready) return <div className="skeleton" style={{ height: 200 }} />;
  if (!user) return <div className="card" style={{ display: "grid", gap: 10 }}><p className="muted">{t("tkLoginFirst")}</p><button className="btn primary" style={{ justifySelf: "start" }} onClick={login}>{t("login")}</button></div>;
  return (
    <div className="grid" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card"><h1 style={{ fontSize: 20 }}>{t("wlTitle")}</h1><p className="hint">{t("wlSub")}</p></div>
      <TopUp onDone={() => setN((x) => x + 1)} />
      <Earnings key={n} />
    </div>
  );
}
