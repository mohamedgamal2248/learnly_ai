import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // The PDF generator reads the Arabic fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/files/dl/[id]/[name]": ["./assets/fonts/**"] },
  // The learning features (AI chat, courses, community, study plan, certificates) are hidden. Set SHOW_LEGACY=1 to bring them back.
  async redirects() {
    if (process.env.SHOW_LEGACY === "1") return [];
    return ["/chat", "/courses", "/course", "/community", "/academy", "/learn", "/teach", "/cert"].map((source) => ({ source, destination: "/", permanent: false }));
  },
  serverExternalPackages: ["exceljs", "docx", "pdf-lib", "@pdf-lib/fontkit", "unpdf"],
};

export default nextConfig;
