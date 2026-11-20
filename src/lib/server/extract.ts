import "server-only";
import JSZip from "jszip";

const MAX_CHARS = 300_000;

function decode(xml: string) {
  return xml
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
}

async function fromDocx(buf: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = (await zip.file("word/document.xml")?.async("string")) || "";
  return decode(xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, ""));
}

async function fromPptx(buf: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/g)!.pop()!) - parseInt(b.match(/\d+/g)!.pop()!));
  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async("string");
    const text = decode(xml.replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, "")).trim();
    if (text) parts.push(`[Slide ${i + 1}]\n${text}`);
  }
  return parts.join("\n\n");
}

async function fromPdf(buf: ArrayBuffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n");
}

async function fromXlsx(buf: ArrayBuffer) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const parts: string[] = [];
  wb.eachSheet((ws) => {
    const rows: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= 3000) return;
      const vals = (row.values as unknown[]).slice(1).map((v: any) => {
        if (v == null) return "";
        if (typeof v === "object") return v.result ?? v.text ?? (v.richText ? v.richText.map((r: any) => r.text).join("") : v instanceof Date ? v.toISOString().slice(0, 10) : "");
        return String(v);
      });
      rows.push(vals.join("\t"));
    });
    if (rows.length) parts.push(`[Sheet ${ws.name}]\n${rows.join("\n")}`);
  });
  return parts.join("\n\n");
}

/** Turns an uploaded teaching file into plain text the bot can quote from. */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  let text = "";
  if (name.endsWith(".pdf")) text = await fromPdf(buf);
  else if (name.endsWith(".docx")) text = await fromDocx(buf);
  else if (name.endsWith(".pptx")) text = await fromPptx(buf);
  else if (name.endsWith(".xlsx")) text = await fromXlsx(buf);
  else if (/\.(txt|md|csv)$/.test(name)) text = new TextDecoder().decode(buf);
  else throw new Error("unsupported_type");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return `### ${file.name}\n${text}`.slice(0, MAX_CHARS);
}
