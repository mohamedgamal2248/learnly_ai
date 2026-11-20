"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";
import { UI_LANGS } from "@/lib/i18n";
import { BuyModal } from "./BuyModal";
import { ITask, IChatB, IClose, IDashboard, IHome, IMenu, IMoon, IPerson, ISun, IUsers, IWallet } from "./Icons";

import { BRAND } from "@/lib/brand";

export function Shell({ children }: { children: ReactNode }) {
  const { t, ui, setLang, theme, toggleTheme, user, ready, login, logout, loggingIn, buyOpen } = useApp();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const path = usePathname();

  useEffect(() => { setOpen(false); setLangOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setLangOpen(false); } };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const [bal, setBal] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) { setBal(null); setUnread(0); return; }
    fetch("/api/earnings", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setBal(Number(d.balance))).catch(() => {});
    fetch("/api/deals?unread=1", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setUnread(Number(d.unread) || 0)).catch(() => {});
  }, [user?.id, path]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = [
    { href: "/", label: t("nHome"), icon: <IHome /> },
    { href: "/tasks", label: t("nTasks"), icon: <ITask /> },
    { href: "/people", label: t("nPeople"), icon: <IUsers /> },
    { href: "/deals", label: t("nDeals"), icon: <IChatB />, badge: unread },
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
          <Link className="brand" href="/" aria-label={BRAND}><span>{BRAND}</span></Link>
          <div className="spacer" />
          {user ? (
            <Link className="credit-btn" href="/wallet" aria-label={t("nWallet")}>
              <IWallet width={16} height={16} strokeWidth={2.2} />
              <span className="bal num ltr">{credits} π</span>
            </Link>
          ) : (
            <button className="credit-btn" onClick={login} aria-label={t("login")}><span className="lbl">{t("login")}</span></button>
          )}
          <div className="lang-wrap">
            <button className="lang" onClick={() => setLangOpen((v) => !v)} aria-label="Language" aria-expanded={langOpen} aria-haspopup="listbox">
              {ui.toUpperCase()}
            </button>
            {langOpen && (
              <>
                <div className="lang-scrim" onClick={() => setLangOpen(false)} />
                <ul className="lang-menu" role="listbox" aria-label="Language">
                  {UI_LANGS.map((l) => (
                    <li key={l.code}>
                      <button role="option" aria-selected={ui === l.code} className={ui === l.code ? "on" : ""}
                        onClick={() => { setLang(l.code); setLangOpen(false); }}>
                        <span>{l.name}</span><span className="code">{l.code.toUpperCase()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
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
          <div className="nav-sep" />
          <button className="nav-item" onClick={toggleTheme}>
            {theme === "dark" ? <ISun /> : <IMoon />}<span>{theme === "dark" ? t("lightMode") : t("darkMode")}</span>
          </button>
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
