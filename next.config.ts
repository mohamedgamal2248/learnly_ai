import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // The PDF generator reads the Arabic fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/files/dl/[id]/[name]": ["./assets/fonts/**"] },
  serverExternalPackages: ["exceljs", "docx", "pdf-lib", "@pdf-lib/fontkit", "unpdf"],
};

export default nextConfig;
