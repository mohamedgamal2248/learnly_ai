// Generates the Learnly AI logo (SVG) and every PNG size from it. Run: node scripts/brand.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Learnly AI logo: a speech bubble (talking English) with an "L" inside and a sparkle (the AI tutor).
const spark = (cx, cy, r, fill) => `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}"/>`;
const glyph = `<g>
<path d="M118 126H394a42 42 0 0 1 42 42V300a42 42 0 0 1-42 42H266L190 404V342H118a42 42 0 0 1-42-42V168a42 42 0 0 1 42-42Z" fill="#fff"/>
<path d="M178 190V294H262" fill="none" stroke="#0D58D6" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
${spark(338, 214, 40, "#1877F2")}${spark(376, 290, 17, "#7DB8FF")}</g>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3FA0FF"/><stop offset="1" stop-color="#0D58D6"/></linearGradient></defs>`;
const svg = (bg, g = glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg}${g}</svg>`;
const tile = `<rect width="512" height="512" rx="116" fill="url(#g)"/>`;
const full = `<rect width="512" height="512" fill="url(#g)"/>`;
const scaled = (k) => `<g transform="translate(${256 * (1 - k)} ${256 * (1 - k)}) scale(${k})">${glyph}</g>`;

writeFileSync("public/icon.svg", svg(tile));
const png = (s, size, out) => sharp(Buffer.from(s), { density: 384 }).resize(size, size).png().toFile(out);
await png(svg(tile), 512, "public/icon-512.png");
await png(svg(tile), 192, "public/icon-192.png");
await png(svg(full, scaled(0.8)), 512, "public/icon-512-maskable.png");
await png(svg(full, scaled(0.92)), 180, "public/apple-touch-icon.png");
await png(svg(full), 1024, "public/learnly-1024.png");
await png(svg(tile), 1024, "public/learnly-1024-rounded.png");

// favicon.ico: PNG-in-ICO (16/32/48)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svg(tile)), { density: 384 }).resize(s, s).png().toBuffer()));
const head6 = Buffer.alloc(6); head6.writeUInt16LE(1, 2); head6.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = Buffer.concat(sizes.map((s, i) => { const e = Buffer.alloc(16); e[0] = s; e[1] = s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length; return e; }));
writeFileSync("public/favicon.ico", Buffer.concat([head6, dir, ...pngs]));
console.log("ok");
