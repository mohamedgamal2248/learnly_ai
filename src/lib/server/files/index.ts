import "server-only";
import type { FileSpec } from "./spec";
import { renderPdf } from "./pdf";
import { renderDocx, renderPptx, renderXlsx } from "./office";

export async function renderFile(spec: FileSpec): Promise<Uint8Array> {
  switch (spec.format) {
    case "pdf": return renderPdf(spec);
    case "docx": return renderDocx(spec);
    case "pptx": return renderPptx(spec);
    case "xlsx": return renderXlsx(spec);
  }
}
