"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";
import { BuyModal } from "./BuyModal";
import { IBell, ITask, IChatB, IClose, IDashboard, IHome, IMenu, IPerson, IUsers, IWallet } from "./Icons";

import { BRAND } from "@/lib/brand";
import { Brand } from "./Brand";

export function Shell({ children }: { children: ReactNode }) {
  const { t, ui, setLang, user, ready, login, logout, loggingIn, buyOpen } = useApp();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); } };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const [bal, setBal] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState(0);
  useEffect(() => {
    // An invite link (?ref=name) is remembered until the person signs in.
    try { const r = new URLSearchParams(location.search).get("ref"); if (r && /^[\w.-]{2,60}$/.test(r)) localStorage.setItem("hl-ref", r); } catch {}
  }, [path]);
  useEffect(() => {
    if (!user) { setBal(null); setUnread(0); setNotifs(0); return; }
    fetch("/api/notifs?unread=1", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setNotifs(Number(d.unread) || 0)).catch(() => {});
    fetch("/api/earnings", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setBal(Number(d.balance))).catch(() => {});
    fetch("/api/deals?unread=1", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setUnread(Number(d.unread) || 0)).catch(() => {});
  }, [user?.id, path]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = [
    { href: "/", label: t("nHome"), icon: <IHome /> },
    { href: "/tasks", label: t("nTasks"), icon: <ITask /> },
    { href: "/people", label: t("nPeople"), icon: <IUsers /> },
    { href: "/deals", label: t("nDeals"), icon: <IChatB />, badge: unread },
    { href: "/notifications", label: t("nNotifs"), icon: <IBell />, badge: notifs },
    { href: "/wallet", label: t("nWallet"), icon: <IWallet /> },
    { href: user ? `/u?name=${encodeURIComponent(user.username)}` : "/profile", label: t("nProfile"), icon: <IPerson />, match: "/u" },
  ];
  const isOn = (href: string, match?: string) => (href === "/" ? path === "/" : path.startsWith(match || href.split("?")[0]));
  const credits = bal === null ? "…" : bal.toLocaleString("en-US", { maximumFractionDigits: 3 });

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button className="icon-btn" aria-label={t("menu")} aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
            <IMenu />
          </button>
          <Link className="brand" href="/" aria-label={BRAND}><Brand /></Link>
          <div className="spacer" />
          {user && (
            <Link className="icon-btn bell" href="/notifications" aria-label={t("nNotifs")}>
              <IBell />{notifs > 0 && <span className="bell-dot num">{notifs > 9 ? "9+" : notifs}</span>}
            </Link>
          )}
          {user ? (
            <Link className="credit-btn" href="/wallet" aria-label={t("nWallet")}>
              <IWallet width={16} height={16} strokeWidth={2.2} />
              <span className="bal num ltr">{credits} π</span>
            </Link>
          ) : (
            <button className="credit-btn" onClick={login} aria-label={t("login")}><span className="lbl">{t("login")}</span></button>
          )}
          <button className="lang" onClick={() => setLang(ui === "ar" ? "en" : "ar")} aria-label={ui === "ar" ? "Switch to English" : "التبديل للعربية"}>
            {ui === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </header>

      <div className={`scrim${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      <aside id="drawer" className={`drawer${open ? " open" : ""}`} aria-label={t("menu")} aria-hidden={!open}>
        <div className="drawer-head">
          <strong>{t("menu")}</strong>
          <button className="icon-btn" aria-label={t("close")} onClick={() => setOpen(false)}><IClose width={18} height={18} /></button>
        </div>
        <nav>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-item${isOn(n.href, n.match) ? " on" : ""}`}>
              {n.icon}<span>{n.label}</span>{n.badge ? <span className="tag num">{n.badge}</span> : null}
            </Link>
          ))}
          {user?.role === "admin" && (
            <>
              <div className="nav-sep" />
              <Link href="/admin" className={`nav-item${isOn("/admin") ? " on" : ""}`}><IDashboard /><span>{t("nAdmin")}</span></Link>
            </>
          )}
        </nav>
        <div className="legal-links" style={{ padding: "0 16px 8px" }}><Link href="/privacy">{t("privacy")}</Link> · <Link href="/terms">{t("terms")}</Link></div>
        <div className="drawer-foot">
          {user ? (
            <>
              <div className="who">
                <div className="avatar">{user.username.slice(0, 1)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="who-name ltr" style={{ textAlign: "start" }}>@{user.username}</div>
                  <div className="who-sub">{t("piUser")} · <span className="num ltr">{credits} π</span></div>
                </div>
              </div>
              <button className="btn danger block" onClick={() => { setOpen(false); logout(); }}>{t("logout")}</button>
            </>
          ) : (
            <>
              <div className="who">
                <div className="avatar">?</div>
                <div><div className="who-name">{t("guest")}</div><div className="who-sub">{t("guestSub")}</div></div>
              </div>
              <button className="btn primary block" onClick={login} disabled={loggingIn || !ready}>
                {loggingIn ? t("loggingIn") : t("login")}
              </button>
            </>
          )}
        </div>
      </aside>

      <main key={path} className="page">{children}</main>
      {buyOpen && <BuyModal />}
    </>
  );
}
