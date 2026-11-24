import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // The PDF generator reads the Arabic fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/files/dl/[id]/[name]": ["./assets/fonts/**"] },
  // The old course/chat features and the tasks marketplace are hidden. SHOW_LEGACY=1 / SHOW_MARKET=1 bring them back.
  async redirects() {
    const legacy = process.env.SHOW_LEGACY === "1" ? [] : ["/chat", "/courses", "/course", "/community", "/academy", "/teach", "/cert"];
    const market = process.env.SHOW_MARKET === "1" ? [] : ["/tasks", "/people", "/deals", "/wallet", "/notifications", "/profile", "/u", "/docs"];
    return [...legacy, ...market].map((source) => ({ source, destination: "/", permanent: false }));
  },
  serverExternalPackages: ["exceljs", "docx", "pdf-lib", "@pdf-lib/fontkit", "unpdf"],
};

export default nextConfig;
