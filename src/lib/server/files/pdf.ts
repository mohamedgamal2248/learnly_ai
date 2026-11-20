import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FileSpec } from "./spec";

const A4: [number, number] = [595.28, 841.89];
const M = 50;
const BLUE = rgb(0.094, 0.467, 0.949);
const INK = rgb(0.11, 0.12, 0.13);
const MUTED = rgb(0.4, 0.4, 0.42);
const LINE = rgb(0.85, 0.87, 0.89);

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
// The font has no emoji or symbols outside these ranges; drop them instead of drawing empty boxes.
const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

type Run = { text: string; rtl: boolean };

class Writer {
  page!: PDFPage;
  y = 0;
  glyphs: Set<number>;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public rtl: boolean) {
    this.glyphs = new Set(font.getCharacterSet());
    this.newPage();
  }

  /** Drops characters the font can't draw (they'd show as empty boxes). */
  safe(text: string) {
    let out = "";
    for (const ch of clean(text)) if (ch === " " || this.glyphs.has(ch.codePointAt(0)!)) out += ch;
    return out.replace(/\s+/g, " ").trim();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
  }
  ensure(h: number) { if (this.y - h < M) this.newPage(); }

  width(t: string, f: PDFFont, size: number) { return f.widthOfTextAtSize(t, size); }

  wrap(text: string, f: PDFFont, size: number, max: number): string[] {
    const words = this.safe(text).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (this.width(next, f, size) <= max || !cur) cur = next;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /**
   * Draws one line inside [x0, x0+w]. Words are grouped by direction: on an Arabic line, runs of
   * Latin words/numbers stay left-to-right as one segment; fontkit shapes and reverses Arabic segments.
   */
  drawLine(line: string, f: PDFFont, size: number, x0: number, w: number, color = INK) {
    const segs: Run[] = [];
    for (const word of line.split(" ").filter(Boolean)) {
      const rtlWord = ARABIC.test(word);
      const last = segs[segs.length - 1];
      // Group words that run against the base direction so their internal order is kept.
      if (last && last.rtl === rtlWord && rtlWord !== this.rtl) last.text += ` ${word}`;
      else segs.push({ text: word, rtl: rtlWord });
    }
    const space = this.width(" ", f, size);
    let x = this.rtl ? x0 + w : x0;
    for (const s of segs) {
      const sw = this.width(s.text, f, size);
      if (this.rtl) x -= sw;
      this.page.drawText(s.text, { x, y: this.y, size, font: f, color });
      x = this.rtl ? x - space : x + sw + space;
    }
  }

  paragraph(text: string, opts: { size?: number; f?: PDFFont; color?: typeof INK; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 11.5, f = opts.f ?? this.font, indent = opts.indent ?? 0;
    const lh = size * 1.6;
    const usable = A4[0] - 2 * M - indent;
    for (const line of this.wrap(text, f, size, usable)) {
      this.ensure(lh);
      this.y -= lh;
      this.drawLine(line, f, size, this.rtl ? M : M + indent, usable, opts.color);
    }
    this.y -= opts.gap ?? 6;
  }

  bullet(text: string) {
    const size = 11.5, lh = size * 1.6, indent = 16;
    const usable = A4[0] - 2 * M - indent;
    const lines = this.wrap(text, this.font, size, usable);
    lines.forEach((line, i) => {
      this.ensure(lh);
      this.y -= lh;
      if (i === 0) {
        const cx = this.rtl ? A4[0] - M - 5 : M + 5;
        this.page.drawCircle({ x: cx, y: this.y + size * 0.32, size: 2.2, color: BLUE });
      }
      this.drawLine(line, this.font, size, this.rtl ? M : M + indent, usable);
    });
    this.y -= 3;
  }

  table(rows: string[][]) {
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const total = A4[0] - 2 * M;
    const cw = total / cols;
    const size = 10, lh = size * 1.5, pad = 5;
    rows.forEach((row, ri) => {
      const f = ri === 0 ? this.bold : this.font;
      const cells = Array.from({ length: cols }, (_, ci) => this.wrap(String(row[ci] ?? ""), f, size, cw - 2 * pad));
      const h = Math.max(...cells.map((c) => c.length)) * lh + 2 * pad;
      this.ensure(h);
      const top = this.y;
      cells.forEach((lines, ci) => {
        const x = this.rtl ? M + total - (ci + 1) * cw : M + ci * cw;
        this.page.drawRectangle({
          x, y: top - h, width: cw, height: h, borderColor: LINE, borderWidth: 0.8,
          color: ri === 0 ? rgb(0.906, 0.941, 0.992) : undefined,
        });
        let y = top - pad;
        for (const line of lines) {
          y -= lh;
          const saved = this.y;
          this.y = y + 3;
          this.drawLine(line, f, size, x + pad, cw - 2 * pad);
          this.y = saved;
        }
      });
      this.y = top - h;
    });
    this.y -= 10;
  }
}

export async function renderPdf(spec: FileSpec): Promise<Uint8Array> {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const [reg, bold] = await Promise.all([
    readFile(path.join(dir, "IBMPlexSansArabic-Regular.ttf")),
    readFile(path.join(dir, "IBMPlexSansArabic-Bold.ttf")),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(spec.title);
  doc.setCreator("HireLoop");
  const font = await doc.embedFont(reg, { subset: true });
  const fontB = await doc.embedFont(bold, { subset: true });
  const w = new Writer(doc, font, fontB, spec.lang === "ar");

  w.paragraph(spec.title, { size: 20, f: fontB, color: BLUE, gap: 4 });
  w.y -= 2;
  w.page.drawLine({ start: { x: M, y: w.y }, end: { x: A4[0] - M, y: w.y }, thickness: 1.2, color: BLUE });
  w.y -= 14;

  for (const s of spec.sections) {
    if (s.heading) { w.y -= 4; w.paragraph(s.heading, { size: 14.5, f: fontB, gap: 2 }); }
    for (const p of s.paragraphs || []) w.paragraph(p);
    for (const b of s.bullets || []) w.bullet(b);
    if (s.table?.length) { w.y -= 4; w.table(s.table); }
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `HireLoop · ${i + 1} / ${pages.length}`;
    p.drawText(label, { x: A4[0] / 2 - font.widthOfTextAtSize(label, 8.5) / 2, y: 24, size: 8.5, font, color: MUTED });
  });
  return doc.save();
}
