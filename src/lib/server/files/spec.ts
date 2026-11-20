export type Section = { heading?: string; paragraphs?: string[]; bullets?: string[]; table?: string[][] };
export type Slide = { title: string; bullets?: string[]; notes?: string };
export type Sheet = { name: string; rows: (string | number)[][] };
export type FileSpec = {
  format: "pdf" | "docx" | "pptx" | "xlsx";
  title: string;
  lang: "ar" | "en";
  sections: Section[];
  slides: Slide[];
  sheets: Sheet[];
};

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "");
const arr = <T>(v: unknown, max: number): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : []);

/** Cleans whatever the model sent into a bounded, predictable spec. Returns null if unusable. */
export function normalizeSpec(raw: unknown): FileSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const format = r.format as FileSpec["format"];
  if (!["pdf", "docx", "pptx", "xlsx"].includes(format)) return null;
  const title = str(r.title, 120) || "Learnly";
  const lang: FileSpec["lang"] = r.lang === "en" ? "en" : "ar";

  const sections: Section[] = arr<any>(r.sections, 60).map((s) => ({
    heading: str(s?.heading, 200) || undefined,
    paragraphs: arr<unknown>(s?.paragraphs, 30).map((p) => str(p)).filter(Boolean),
    bullets: arr<unknown>(s?.bullets, 40).map((p) => str(p, 600)).filter(Boolean),
    table: arr<unknown[]>(s?.table, 60).map((row) => arr<unknown>(row, 12).map((c) => str(String(c ?? ""), 300))),
  }));
  let slides: Slide[] = arr<any>(r.slides, 30).map((s) => ({
    title: str(s?.title, 160) || title,
    bullets: arr<unknown>(s?.bullets, 8).map((p) => str(p, 300)).filter(Boolean),
    notes: str(s?.notes, 2000) || undefined,
  }));
  let sheets: Sheet[] = arr<any>(r.sheets, 10).map((s, i) => ({
    name: (str(s?.name, 31) || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, " "),
    rows: arr<unknown[]>(s?.rows, 2000).map((row) =>
      arr<unknown>(row, 40).map((c) => (typeof c === "number" && isFinite(c) ? c : str(String(c ?? ""), 500)))),
  }));

  // Fall back gracefully when the model filled the wrong field.
  if (format === "pptx" && !slides.length) {
    slides = sections.map((s) => ({ title: s.heading || title, bullets: [...(s.bullets || []), ...(s.paragraphs || [])].slice(0, 6) }));
  }
  if (format === "xlsx" && !sheets.length) {
    sheets = sections.filter((s) => s.table?.length).map((s, i) => ({ name: (s.heading || `Sheet${i + 1}`).slice(0, 31), rows: s.table! }));
  }
  const docSections = sections.length ? sections
    : slides.map((s) => ({ heading: s.title, bullets: s.bullets, paragraphs: [] as string[] }));

  const spec: FileSpec = { format, title, lang, sections: docSections, slides, sheets };
  const empty =
    (format === "pptx" && !slides.length) ||
    (format === "xlsx" && !sheets.some((s) => s.rows.length)) ||
    ((format === "pdf" || format === "docx") && !docSections.length);
  return empty ? null : spec;
}

export const MIME: Record<FileSpec["format"], string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
