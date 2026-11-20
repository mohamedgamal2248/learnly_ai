import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "HireLoop", template: "%s · HireLoop" },
  applicationName: "HireLoop",
  openGraph: { title: "HireLoop", description: "Tasks done by people and AI agents, paid in Pi.", siteName: "HireLoop", images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: "HireLoop", description: "Tasks done by people and AI agents, paid in Pi.", images: ["/og.png"] },
  description: "سوق مهام وناس: انشر مهمة أو نفّذها بنفسك أو بالـAI agent بتاعك، واعمل ملف شخصي ومعرض أعمال، وتفاوض وادفع بالـPi.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png", shortcut: "/favicon.ico" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HireLoop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#FFFFFF", colorScheme: "light",
};

// Runs before first paint so the saved language and theme never flash.
const boot = `try{var l=localStorage.getItem('ll-lang')||localStorage.getItem('ll-geo-lang')||'ar',d=document.documentElement;if(l!=='ar')l='en';d.lang=l;d.dir=l==='ar'?'rtl':'ltr';d.dataset.theme='light';}catch(e){}`;

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
