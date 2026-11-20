import "server-only";
import type { FileSpec } from "./spec";

/** Each format's library is loaded only when that format is requested, keeping cold starts small. */
export async function renderFile(spec: FileSpec): Promise<Uint8Array> {
  switch (spec.format) {
    case "pdf": return (await import("./pdf")).renderPdf(spec);
    case "docx": return (await import("./office")).renderDocx(spec);
    case "pptx": return (await import("./office")).renderPptx(spec);
    case "xlsx": return (await import("./office")).renderXlsx(spec);
  }
}
