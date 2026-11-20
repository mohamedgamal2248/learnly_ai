"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";
import { BuyModal } from "./BuyModal";
import { IBot, IClose, IGear, IHome, IMenu, IMoon, IPlus, IShield, ISun, IUsers, ICap } from "./Icons";

export function Shell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, theme, toggleTheme, user, ready, login, logout, loggingIn, openBuy, buyOpen } = useApp();
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const nav = [
    { href: "/", label: t("nHome"), icon: <IHome /> },
    { href: "/chat", label: t("nChat"), icon: <IBot /> },
    { href: "/community", label: t("nCommunity"), icon: <IUsers />, tag: t("free") },
    { href: "/academy", label: t("nAcademy"), icon: <IShield />, tag: t("free") },
    { href: "/teach", label: t("nTeach"), icon: <ICap /> },
  ];
  const isOn = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const credits = user ? user.credits.toLocaleString(lang === "ar" ? "ar-EG" : "en-US") : "0";

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button className="icon-btn" aria-label={t("menu")} aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
            <IMenu />
          </button>
          <Link className="brand" href="/" aria-label="Learnly AI"><span>Learnly <b>AI</b></span></Link>
          <div className="spacer" />
          <button className="credit-btn" onClick={() => (user ? openBuy() : login())} aria-label={t("credits")}>
            <IPlus width={16} height={16} strokeWidth={2.4} />
            <span className="lbl">{t("credits")}</span>
            <span className="bal num">{credits}</span>
          </button>
          <button className="lang" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label="Language">
            {lang === "ar" ? "EN" : "AR"}
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
            <Link key={n.href} href={n.href} className={`nav-item${isOn(n.href) ? " on" : ""}`}>
              {n.icon}<span>{n.label}</span>{n.tag && <span className="tag">{n.tag}</span>}
            </Link>
          ))}
          {user?.role === "admin" && (
            <>
              <div className="nav-sep" />
              <Link href="/admin" className={`nav-item${isOn("/admin") ? " on" : ""}`}><IGear /><span>{t("nAdmin")}</span></Link>
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
                  <div className="who-sub">{t("piUser")} · <span className="num">{credits}</span> {t("credits")}</div>
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
