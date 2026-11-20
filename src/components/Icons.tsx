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
