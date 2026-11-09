import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.argv[2]);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === "page" && t.url.startsWith("http://127.0.0.1:5180/"));
assert(target, "Local isolated test tab required");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.onopen = resolve);
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
async function cdp(method, params) {
  return new Promise((resolve) => {
    const call = ++id; pending.set(call, resolve);
    ws.send(JSON.stringify({ id: call, method, params }));
  });
}
async function js(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert(!result.error && !result.result.exceptionDetails, JSON.stringify(result));
  return result.result.result.value;
}
function inspectContrast() {
  const linear = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const rgb = s => { const a = s.match(/[\d.]+/g)?.map(Number) || []; return [a[0] || 0, a[1] || 0, a[2] || 0, a.length > 3 ? a[3] : 1]; };
  const blend = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const lum = a => .2126 * linear(a[0]) + .7152 * linear(a[1]) + .0722 * linear(a[2]);
  const failures = [], images = [];
  let checked = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!el.textContent.trim() || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || !r.height || s.visibility === "hidden" || s.display === "none" || el.closest("[inert]")) continue;
    if (el.closest(".sidebar") && innerWidth <= 760) continue;
    let bg = [255, 255, 255, 1], layers = [], unknown = false;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.backgroundImage !== "none") unknown = true;
      layers.push(rgb(style.backgroundColor));
    }
    if (unknown || el.closest(".login-photo-caption")) { images.push(el.textContent.trim().slice(0, 40)); continue; }
    for (const layer of layers.reverse()) bg = blend(layer, bg);
    const fg = blend(rgb(s.color), bg), ls = [lum(fg), lum(bg)].sort((a, b) => b - a), ratio = (ls[0] + .05) / (ls[1] + .05);
    const large = parseFloat(s.fontSize) >= 24 || parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700;
    checked++;
    if (ratio < (large ? 3 : 4.5)) failures.push({ tag: el.tagName, cls: el.className, text: el.textContent.trim().slice(0, 70), ratio: Math.round(ratio * 100) / 100, fg: s.color, bg: bg.map(Math.round), font: s.fontSize });
  }
  return { checked, failures, images };
}
const results = [];
try {
  await cdp("Emulation.setDeviceMetricsOverride", { width: Number(process.argv[3] || 1440), height: 960, deviceScaleFactor: 1, mobile: false });
  for (const path of ["ringkasan", "bengkel", "bengkel/WO-2611-0042", "motor", "motor/v1", "motor/v1/edit", "stok", "stok/i1", "transaksi", "pelanggan", "supplier", "penerimaan", "laporan", "kontrol", "audit", "pengaturan", "pengaturan/pengguna", "pengaturan/master", "status", "masuk"]) {
    await js(`location.hash = ${JSON.stringify(`/${path}`)}`);
    await delay(300);
    await js("document.fonts.ready");
    results.push({ path, ...await js(`(${inspectContrast.toString()})()`) });
  }
  console.log(JSON.stringify(results.filter(r => r.failures.length), null, 2));
  assert(results.every(r => !r.failures.length), "Text contrast failures recorded in contrast.json");
} finally {
  const out = join(process.env.LOCALAPPDATA, "Temp", "opencode", "garasi-ui-evidence");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "contrast.json"), JSON.stringify(results, null, 2));
  ws.close();
}
