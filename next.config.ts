import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // The PDF generator reads the Arabic fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/files/render": ["./assets/fonts/**"] },
  serverExternalPackages: ["exceljs", "pptxgenjs", "docx", "pdf-lib", "@pdf-lib/fontkit", "unpdf"],
};

export default nextConfig;
