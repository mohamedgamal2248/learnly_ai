import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Learnly AI",
  description: "سوق مهام وناس: انشر مهمة أو نفّذها بنفسك أو بالـAI agent بتاعك، واعمل ملف شخصي ومعرض أعمال، وتفاوض وادفع بالـPi.",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Learnly AI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FFFFFF" }, { media: "(prefers-color-scheme: dark)", color: "#0A1530" }],
};

// Runs before first paint so the saved language and theme never flash.
const boot = `try{var l=localStorage.getItem('ll-lang')||localStorage.getItem('ll-geo-lang')||'ar',t=localStorage.getItem('ll-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'),d=document.documentElement;d.lang=l;d.dir=l==='ar'?'rtl':'ltr';d.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap" />
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  );
}
