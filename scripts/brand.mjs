// Generates the HireLoop logo (SVG) and every PNG size from it. Run: node scripts/brand.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const C = 256, R = 150, SW = 32;
const pt = (deg, r = R) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const f = (n) => n.toFixed(1);
function arc(a0, a1) {
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `<path d="M${f(x0)} ${f(y0)}A${R} ${R} 0 0 1 ${f(x1)} ${f(y1)}" fill="none" stroke="#fff" stroke-width="${SW}" stroke-linecap="round"/>`;
}
function head(deg) {
  const [px, py] = pt(deg), r = (deg * Math.PI) / 180;
  const T = [-Math.sin(r), Math.cos(r)], N = [Math.cos(r), Math.sin(r)];
  const tip = [px + T[0] * 46, py + T[1] * 46], b1 = [px + N[0] * 42, py + N[1] * 42], b2 = [px - N[0] * 42, py - N[1] * 42];
  return `<path d="M${f(tip[0])} ${f(tip[1])}L${f(b1[0])} ${f(b1[1])}L${f(b2[0])} ${f(b2[1])}Z" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`;
}
const spark = (cx, cy, r, fill) => `<path d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z" fill="${fill}"/>`;
const glyph = `<g>${arc(-150, -34)}${head(-34)}${arc(30, 146)}${head(146)}
<path d="M198 284L230 316L294 248" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
${spark(298, 176, 27, "#CFE5FF")}</g>`;
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
await png(svg(full), 1024, "public/hireloop-1024.png");
await png(svg(tile), 1024, "public/hireloop-1024-rounded.png");

// favicon.ico: PNG-in-ICO (16/32/48)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svg(tile)), { density: 384 }).resize(s, s).png().toBuffer()));
const head6 = Buffer.alloc(6); head6.writeUInt16LE(1, 2); head6.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = Buffer.concat(sizes.map((s, i) => { const e = Buffer.alloc(16); e[0] = s; e[1] = s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length; return e; }));
writeFileSync("public/favicon.ico", Buffer.concat([head6, dir, ...pngs]));
console.log("ok");
