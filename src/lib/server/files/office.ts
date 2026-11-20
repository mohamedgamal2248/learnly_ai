import "server-only";
import {
  AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, ShadingType,
} from "docx";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";
import type { FileSpec } from "./spec";

const BLUE = "1877F2";
const INK = "1C1E21";

/* ---------- Word ---------- */
export async function renderDocx(spec: FileSpec): Promise<Uint8Array> {
  const rtl = spec.lang === "ar";
  const font = rtl ? "Arial" : "Calibri";
  const run = (text: string, extra: Record<string, unknown> = {}) => new TextRun({ text, rightToLeft: rtl, font, ...extra });
  const para = (text: string, extra: Record<string, unknown> = {}) =>
    new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(text)], spacing: { after: 120 }, ...extra });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      bidirectional: rtl, heading: HeadingLevel.TITLE, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [run(spec.title, { bold: true, size: 40, color: BLUE })], spacing: { after: 240 },
    }),
  ];
  for (const s of spec.sections) {
    if (s.heading) {
      children.push(new Paragraph({
        bidirectional: rtl, heading: HeadingLevel.HEADING_1, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [run(s.heading, { bold: true, size: 30, color: INK })], spacing: { before: 240, after: 120 },
      }));
    }
    for (const p of s.paragraphs || []) children.push(para(p));
    for (const b of s.bullets || []) children.push(para(b, { bullet: { level: 0 } }));
    if (s.table?.length) {
      const cols = Math.max(...s.table.map((r) => r.length));
      children.push(new Table({
        visuallyRightToLeft: rtl,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: s.table.map((row, ri) => new TableRow({
          tableHeader: ri === 0,
          children: Array.from({ length: cols }, (_, ci) => new TableCell({
            shading: ri === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "E7F0FD" } : undefined,
            children: [new Paragraph({ bidirectional: rtl, children: [run(String(row[ci] ?? ""), { bold: ri === 0 })] })],
          })),
        })),
      }));
      children.push(new Paragraph({ children: [] }));
    }
  }
  const doc = new Document({ creator: "HireLoop", title: spec.title, sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/* ---------- PowerPoint ---------- */
export async function renderPptx(spec: FileSpec): Promise<Uint8Array> {
  const rtl = spec.lang === "ar";
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.rtlMode = rtl;
  pptx.title = spec.title;
  pptx.author = "HireLoop";
  const font = rtl ? "Arial" : "Calibri";
  const align = rtl ? "right" : "left";

  const cover = pptx.addSlide();
  cover.background = { color: BLUE };
  cover.addText(spec.title, { x: 0.8, y: 2.4, w: 11.7, h: 1.6, fontFace: font, fontSize: 40, bold: true, color: "FFFFFF", align, rtlMode: rtl });
  cover.addText("HireLoop", { x: 0.8, y: 4.2, w: 11.7, h: 0.6, fontFace: font, fontSize: 18, color: "DCE8FD", align, rtlMode: rtl });

  spec.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: BLUE }, line: { color: BLUE } });
    slide.addText(s.title, { x: 0.7, y: 0.45, w: 11.9, h: 0.9, fontFace: font, fontSize: 28, bold: true, color: INK, align, rtlMode: rtl });
    if (s.bullets?.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { indent: 18 }, paraSpaceAfter: 10 } })),
        { x: 0.8, y: 1.6, w: 11.7, h: 5.2, fontFace: font, fontSize: 20, color: "333A44", valign: "top", align, rtlMode: rtl },
      );
    }
    slide.addText(String(i + 2), { x: rtl ? 0.3 : 12.4, y: 7.0, w: 0.6, h: 0.3, fontSize: 11, color: "8A8D91", align: "center" });
    if (s.notes) slide.addNotes(s.notes);
  });
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return new Uint8Array(out);
}

/* ---------- Excel ---------- */
export async function renderXlsx(spec: FileSpec): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HireLoop";
  wb.title = spec.title;
  const used = new Set<string>();
  for (const sh of spec.sheets) {
    let name = sh.name || "Sheet";
    while (used.has(name)) name = `${name.slice(0, 28)}_${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: spec.lang === "ar", state: "frozen", ySplit: 1 }] });
    sh.rows.forEach((r) => ws.addRow(r));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BLUE}` } };
    head.alignment = { vertical: "middle", horizontal: "center" };
    const cols = Math.max(0, ...sh.rows.map((r) => r.length));
    for (let c = 1; c <= cols; c++) {
      const longest = Math.max(...sh.rows.map((r) => String(r[c - 1] ?? "").length));
      ws.getColumn(c).width = Math.min(50, Math.max(10, longest + 2));
    }
    if (sh.rows.length > 1 && cols > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } };
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
