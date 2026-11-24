import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Shell } from "@/components/Shell";
import { LearnProvider } from "@/components/LearnProvider";

export const metadata: Metadata = {
  title: { default: "Learnly AI · Learn English with an AI tutor", template: "%s · Learnly AI" },
  applicationName: "Learnly AI",
  description: "Learn English step by step with short lessons explained in your own language (Arabic, Indonesian, Vietnamese, Korean) and an AI tutor. Pay with Pi.",
  openGraph: { title: "Learnly AI", description: "Learn English in your own language, with an AI tutor. Pay with Pi.", siteName: "Learnly AI", images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: "Learnly AI", description: "Learn English in your own language, with an AI tutor. Pay with Pi.", images: ["/og.png"] },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Learnly AI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#FFFFFF", colorScheme: "light",
};

// The interface is English only; lesson explanations follow the learner's own language.
const boot = `try{var d=document.documentElement;d.lang='en';d.dir='ltr';d.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap" />
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" />
        <AppProvider>
          <LearnProvider>
            <Shell>{children}</Shell>
          </LearnProvider>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  );
}
