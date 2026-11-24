// Link-preview image (1200x630). Run after brand.mjs: node scripts/og.cjs
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const icon = readFileSync("public/icon.svg", "utf8");
const html = `<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#3FA0FF,#0D58D6);display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#fff">
<div style="width:300px;height:300px;flex:none;filter:drop-shadow(0 18px 40px rgba(0,30,90,.35))">${icon.replace("<svg ", '<svg width="300" height="300" ')}</div>
<div><div style="font-size:112px;font-weight:800;letter-spacing:-2px">Learnly <span style="color:#CFE5FF">AI</span></div>
<div style="font-size:38px;margin-top:22px;opacity:.92;line-height:1.3">Learn English in your language.<br/>With an AI tutor. Pay with Pi.</div></div></body></html>`;
(async () => {
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.screenshot({ path: "public/og.png" });
await b.close();
})();
