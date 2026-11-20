import type React from "react";
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IMenu = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IHome = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 11l9-7 9 7v9H3z" /></svg>;
export const IBot = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="4" y="6" width="16" height="12" rx="4" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><path d="M12 3v3" /></svg>;
export const ICap = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></svg>;
export const IUsers = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20c1-4 4-6 7-6s6 2 7 6M15 14c3 0 5 2 6 5" /></svg>;
export const IShield = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /></svg>;
export const IGear = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
export const IMoon = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
export const ISun = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>;
export const ISearch = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const ISend = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IStop = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>;
export const IDownload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IRefresh = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>;
export const ICode = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 6l-6 6 6 6M16 6l6 6-6 6" /></svg>;
export const IBriefcase = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2" /></svg>;
export const ILang = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 5h9M8 3v2M6 5c0 4 3 7 7 8M11 5c-1 4-4 7-7 8" /><path d="M13 21l4-9 4 9M14.5 18h5" /></svg>;
export const IClip = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>;
export const ITask = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V3h6v1" /><path d="m8.5 12 2 2 4-4" /><path d="M9 17.5h6" /></svg>;
export const IBook = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 19V5h12l4 4v10z" /><path d="M8 10h8M8 14h6" /></svg>;

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <rect width="72" height="72" rx="18" fill="var(--primary)" />
      <path d="M15 37 l9 9 l15 -18" fill="none" stroke="var(--primary-ink)" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 41 l8 8 l20 -25" fill="none" stroke="var(--primary-ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- brand icon set (line icons, same stroke as the rest) ----
type P = SVGProps<SVGSVGElement>;
export const ICourses = (p: P) => <svg {...base(p)}><path d="M2.5 5.5c3.2-1.4 6.4-1.2 9.5.8 3.1-2 6.3-2.2 9.5-.8v13c-3.2-1.4-6.4-1.2-9.5.8-3.1-2-6.3-2.2-9.5-.8z" /><path d="M12 6.3v13" /><path d="m6 10 2 0M6 13.5h2.5M15.5 10h2.5M15.5 13.5h2" /></svg>;

/** Courses mark: an open book with a play button on the brand gradient. */
export function CoursesMark({ size = 46 }: { size?: number }) {
  const id = `cm${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C9AFF" /><stop offset=".55" stopColor="#1877F2" /><stop offset="1" stopColor="#0B4FAE" /></linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DCE9FF" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id}g)`} />
      <path d="M8 14.5c5-2 10-1.8 16 1.4v20c-6-3.2-11-3.4-16-1.4z" fill={`url(#${id}p)`} />
      <path d="M40 14.5c-5-2-10-1.8-16 1.4v20c6-3.2 11-3.4 16-1.4z" fill="#FFFFFF" />
      <path d="M24 15.9v20" stroke="#1877F2" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M12 20.5c2.6-.6 5-.4 7.5.6M12 24.5c2.6-.6 5-.4 7.5.6M12 28.5c2.6-.6 5-.4 7.5.6" stroke="#1877F2" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="25" r="5.2" fill="#1877F2" />
      <path d="M30.6 22.6v4.8l4-2.4z" fill="#FFFFFF" />
      <path d="M36.5 9.5l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z" fill="#FFC15A" />
    </svg>
  );
}
export const IChat = (p: P) => <svg {...base(p)}><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3H12" /></svg>;
export const ILock = (p: P) => <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></svg>;
export const IWallet = (p: P) => <svg {...base(p)}><path d="M4 7a2 2 0 0 1 2-2h11v4" /><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M16 13.5h2.5" /></svg>;
export const IAlert = (p: P) => <svg {...base(p)}><path d="M12 3 2.5 20h19z" /><path d="M12 10v4.5M12 17.3v.2" /></svg>;
export const ICompass = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>;
export const IAward = (p: P) => <svg {...base(p)}><circle cx="12" cy="9" r="6" /><path d="m9 14.5-1.5 7L12 19l4.5 2.5-1.5-7" /><path d="m10 9 1.5 1.5L14.5 7.5" /></svg>;
export const IFlame = (p: P) => <svg {...base(p)}><path d="M12 21c-4 0-7-2.8-7-6.6 0-3 2-5 3.5-6.6.2 1.8 1.2 3 2.5 3.3C11 7.5 12.5 5 15 3c-.3 3 1 4.7 2.4 6.5A7.6 7.6 0 0 1 19 14.4C19 18.2 16 21 12 21z" /><path d="M12 21c-1.7 0-3-1.2-3-2.8 0-1.8 1.5-2.8 3-4.7 1.5 1.9 3 2.9 3 4.7 0 1.6-1.3 2.8-3 2.8z" /></svg>;
export const IRotate = (p: P) => <svg {...base(p)}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4h4" /></svg>;
export const ISparkle = (p: P) => <svg {...base(p)}><path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" /><path d="M19 15c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" /></svg>;
export const IImage = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>;
export const IStar = (p: P) => <svg {...base({ ...p, fill: p.fill ?? "currentColor", strokeWidth: p.strokeWidth ?? 1.5 })}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>;
export const ICheck = (p: P) => <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IDashboard = (p: P) => <svg {...base(p)}><rect x="3" y="3" width="7.5" height="9" rx="2" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="2" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" /><rect x="3" y="15" width="7.5" height="6" rx="2" /></svg>;
export const IChart = (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const IPlan = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="m8.5 15 2 2 4-4" /></svg>;

/** Brand tile: rounded square in the site's blue gradient with a white line icon. */
export function IconTile({ children, size = 46, tone = "blue", glass = false }: {
  children: React.ReactNode; size?: number; tone?: "blue" | "pink" | "teal" | "amber" | "green"; glass?: boolean;
}) {
  return (
    <span className={`tile tile-${tone}${glass ? " tile-glass" : ""}`} style={{ width: size, height: size, borderRadius: size * 0.3 }} aria-hidden="true">
      {children}
    </span>
  );
}
