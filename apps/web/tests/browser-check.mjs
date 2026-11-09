import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// ponytail: Chromium CDP only; use a device lab when physical touch/keyboard coverage is required.
const port = Number(process.argv[2]);
assert(Number.isInteger(port) && port > 0 && port <= 65535, "Pass the test browser's CDP port.");
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === "page" && /^http:\/\/(127\.0\.0\.1|localhost):5180\//.test(t.url));
assert(target, "Open the local app on port 5180 in an isolated test browser first.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map(), errors = [], evidence = [];
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  const call = pending.get(message.id);
  if (!call) return;
  pending.delete(message.id);
  clearTimeout(call.timeout);
  if (message.error) call.reject(new Error(JSON.stringify(message.error)));
  else call.resolve(message.result);
};
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const call = ++id;
    const timeout = setTimeout(() => { pending.delete(call); reject(new Error(`Timeout: ${method}`)); }, 8000);
    pending.set(call, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: call, method, params }));
  });
}
async function js(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 60; i++) { if (await js(expression)) return; await delay(50); }
  throw new Error(`Condition did not settle: ${expression}`);
}
async function click(selector) {
  const point = await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled || e.closest('[inert]')) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  assert(point, `Control not available: ${selector}`);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}
async function key(key, code = key, modifiers = 0) {
  const keyCode = { Escape: 27, Tab: 9, Enter: 13, ArrowRight: 39, ArrowDown: 40, ArrowUp: 38 }[key] || 0;
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}
async function fill(selector, text) {
  await click(selector);
  await key("a", "KeyA", 2);
  await cdp("Input.insertText", { text });
}
function check(name, data, condition = true) {
  evidence.push({ name, pass: !!condition, data });
  assert(condition, `${name}: ${JSON.stringify(data)}`);
}
async function health() {
  await js("document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
  return js(`(() => {
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.width&&r.height&&!e.closest('[inert]');};
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,svg:document.querySelectorAll('svg').length,
      broken:[...document.images].filter(i=>visible(i)&&i.complete&&!i.naturalWidth).map(i=>i.src),
      nameless:[...document.querySelectorAll('button,a[href],select')].filter(e=>visible(e)&&!e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length).map(e=>e.outerHTML.slice(0,120)),
      pointer:[...document.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),summary')].filter(e=>visible(e)&&getComputedStyle(e).cursor!=='pointer').map(e=>e.outerHTML.slice(0,100))};
  })()`);
}
const paths = ["ringkasan", "bengkel", "motor", "stok", "transaksi", "pelanggan", "supplier", "penerimaan", "laporan", "kontrol", "audit", "pengaturan"];
let width = 1440;
async function viewport(value) {
  width = value;
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: false });
  await js("new Promise(r => requestAnimationFrame(r))");
  await wait(`innerWidth === ${width}`);
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
}
async function navigate(path) {
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
  if (width <= 760) {
    await click("button[aria-controls=sidebar]");
    await wait("document.querySelector('.sidebar.open') && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(document.querySelector('.sidebar')).transform)");
  }
  await click(`.sidebar a[href='#/${path}']`);
  await wait(`location.hash === '#/${path}' && !document.querySelector('.sidebar.open')`);
  await delay(220);
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
}
const out = join(process.env.LOCALAPPDATA, "Temp", "opencode", "garasi-ui-evidence");
mkdirSync(out, { recursive: true });
try {
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  if (await js("!!document.querySelector('.login-screen')")) {
    await click("button[type=submit]");
    await wait("location.hash === '#/ringkasan'");
    check("Login demo", await js("document.querySelector('h1').textContent"));
  }
  for (const size of [320, 375, 768, 1024, 1440]) {
    await viewport(size);
    for (const path of paths) {
      await navigate(path);
      const data = await health();
      check(`${size}: /${path}`, data, data.scroll <= data.width && data.h1 === 1 && data.svg === 0 && !data.broken.length && !data.nameless.length && !data.pointer.length);
    }
  }
  await navigate("bengkel");
  for (const index of [1, 2, 3, 4, 5, 6]) {
    await click(`.work-status-filters button:nth-child(${index})`);
    check(`Workshop status filter ${index}`, await js("document.querySelector('.work-status-filters button[aria-pressed=true]')?.textContent"), await js(`document.querySelector('.work-status-filters button:nth-child(${index})').getAttribute('aria-pressed') === 'true'`));
  }
  await click(".work-status-filters button:first-child");
  await navigate("motor");
  await click(".view-toggle button:last-child");
  check("Showroom list", await js("!!document.querySelector('table')"), await js("!!document.querySelector('table')"));
  await click(".view-toggle button:first-child");
  await click(".tabs button:last-of-type");
  check("Showroom empty state", await js("document.querySelector('.empty')?.textContent"), await js("!!document.querySelector('.empty')"));
  await click(".tabs button:first-of-type");
  await key("ArrowRight");
  check("Tab keyboard", await js("document.activeElement.textContent"), await js("document.activeElement.getAttribute('aria-selected') === 'true'"));
  await click(".tabs button:first-of-type");
  await fill(".search input", "tidak-ada-motor-ini");
  check("Search empty", await js("document.querySelector('.empty')?.textContent"), await js("!!document.querySelector('.empty')"));
  await click(".search button");
  await click(".motor-card");
  await wait("!!document.querySelector('.photo-thumbnails')");
  const photoTransition = await js("({name:getComputedStyle(document.querySelector('.detail-motor-photo')).viewTransitionName,animations:document.getAnimations().filter(a=>a.playState==='running').length})");
  check("Catalog photo continuity", photoTransition, photoTransition.name.startsWith('motor-'));
  for (const n of [2, 3, 1]) await click(`.photo-thumbnails button:nth-child(${n})`);
  check("Photo thumbnails", await js("document.querySelector('.photo-thumbnails .active').getAttribute('aria-label')"));
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
  await click(".page-actions a");
  await wait("!!document.querySelector('.form-grid')");
  const editorHealth = await health();
  check("Vehicle editor layout", editorHealth, editorHealth.scroll <= editorHealth.width && !editorHealth.broken.length);
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
  const visualShots = [["motor", "showroom-desktop"], ["bengkel", "workshop-desktop"]];
  for (const [path, name] of visualShots) {
    await navigate(path);
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(join(out, `${name}.png`), Buffer.from(shot.data, "base64"));
  }
  await navigate("pelanggan");
  await click(".page-actions button");
  await click("dialog button[type=submit]");
  check("Empty form validation", await js("document.querySelector('dialog input:invalid')?.validationMessage"), await js("!!document.querySelector('dialog input:invalid')"));
  await fill("dialog input", "Uji UI (data contoh)");
  await click("dialog button[type=submit]");
  await wait("!document.querySelector('dialog')");
  check("Save customer", await js("document.querySelector('table').textContent.includes('Uji UI (data contoh)')"), await js("document.querySelector('table').textContent.includes('Uji UI (data contoh)')"));
  await viewport(390);
  await click("button[aria-controls=sidebar]");
  await wait("document.querySelector('.sidebar.open') && document.activeElement === document.querySelector('.sidebar a')");
  await key("Tab", "Tab", 8);
  check("Drawer focus trap", await js("document.activeElement.className"), await js("document.activeElement.classList.contains('account')"));
  await key("Escape");
  check("Drawer Escape focus", await js("document.activeElement.getAttribute('aria-controls')"), await js("document.activeElement.getAttribute('aria-controls') === 'sidebar'"));
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
  await click(".topbar button.avatar");
  await wait("!!document.querySelector('dialog[open]')");
  check("Account bottom sheet opens", await js("document.querySelector('dialog').getBoundingClientRect().bottom"), await js("document.querySelector('dialog').open"));
  await wait("document.getAnimations().every(a => a.playState !== 'running')");
  await key("Escape");
  await wait("!document.querySelector('dialog')");
  check("Dialog Escape focus", await js("document.activeElement.getAttribute('aria-label')"), await js("document.activeElement.getAttribute('aria-label') === 'Akun demo'"));
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await click("button[aria-controls=sidebar]");
  await wait("['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(document.querySelector('.sidebar')).transform)");
  const reduced = await js("({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.querySelector('.sidebar').getAnimations().length})");
  check("Reduced motion drawer", reduced, reduced.matches && reduced.animations === 0);
  await key("Escape");
  await cdp("Emulation.setEmulatedMedia", { features: [] });
  await navigate("bengkel");
  const cards = await js("({cards:[...document.querySelectorAll('.mobile-work-orders .work-order-card')].filter(e=>e.getBoundingClientRect().width>0).length,desktop:getComputedStyle(document.querySelector('.desktop-work-orders')).display})");
  check("Mobile service cards, not squeezed table", cards, cards.cards > 0 && cards.desktop === 'none');
  await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }).then(shot => writeFileSync(join(out, "workshop-mobile.png"), Buffer.from(shot.data, "base64")));
  await click(".mobile-work-orders .work-order-card");
  await wait("!!document.querySelector('.detail-summary')");
  const detailHealth = await health();
  check("Mobile work detail layout", detailHealth, detailHealth.scroll <= detailHealth.width && !detailHealth.broken.length);
  await viewport(1440);
  await navigate("ringkasan");
  await viewport(390);
  await click(".revenue-details summary");
  check("Mobile revenue disclosure", await js("document.querySelector('.revenue-details').open"), await js("document.querySelector('.revenue-details').open"));
  await click(".revenue-details summary");
  await viewport(1440);
  for (const destination of ["/laporan?status=Pending", "/laporan?status=Failed", "/laporan?status=Expired", "/kontrol", "/bengkel?status=Inspeksi", "/bengkel?status=Menunggu%20Persetujuan", "/bengkel?status=Menunggu%20Barang", "/bengkel?status=Dikerjakan", "/bengkel?status=Siap%20Diambil", "/motor?status=Tersedia", "/motor?status=Reserved", "/motor?status=Terjual"]) {
    await click(`.route-view a[href='#${destination}']`);
    await wait(`location.hash === ${JSON.stringify(`#${destination}`)}`);
    await delay(240);
    check(`Dashboard link ${destination}`, await js("document.querySelector('h1').textContent"));
    await navigate("ringkasan");
  }
  for (const selector of [".page-actions a", ".workbench-jobs .panel-heading a", ".vehicle-cell", ".workbench-stock .panel-heading a", ".low-stock-list > a", ".showroom-preview"]) {
    await click(selector);
    await wait("location.hash !== '#/ringkasan'");
    check(`Dashboard control ${selector}`, await js("location.hash"));
    await delay(220);
    await navigate("ringkasan");
  }
  await click("select[aria-label='Periode pendapatan']");
  await key("ArrowDown", "ArrowDown");
  await key("Enter", "Enter");
  check("Revenue period selector", await js("document.querySelector('.revenue-top').textContent"), await js("document.querySelector('select[aria-label=\"Periode pendapatan\"]').value === 'all'"));
  await click(".topbar a.notification-button");
  await wait("location.hash === '#/notifikasi'");
  check("Stock notifications", await js("document.querySelector('h1').textContent"));
  await navigate("pengaturan");
  await click(".tabs button:last-of-type");
  await click("a[href='#/status']");
  await wait("location.hash === '#/status' && document.querySelectorAll('.tabs button').length === 5 && document.querySelector('h1').textContent === 'Status sistem'");
  for (const index of [1, 2, 3, 4, 5]) {
    await click(`.tabs button:nth-of-type(${index})`);
    check(`System state ${index}`, await js("document.querySelector('.panel').textContent.trim().slice(0,120)"));
  }
  await navigate("motor");
  await click(".sidebar a[href='#/bengkel']");
  await wait("location.hash === '#/bengkel'");
  await click(".sidebar a[href='#/stok']");
  await wait("location.hash === '#/stok' && document.querySelector('h1').textContent === 'Suku cadang'");
  check("Rapid navigation does not block input", await js("location.hash"));
  await navigate("ringkasan");
  await wait("innerWidth === 1440");
  await delay(100);
  if (await js("!!document.querySelector('.toast button')")) await click(".toast button");
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 800, y: 70 });
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(join(out, "desktop.png"), Buffer.from(shot.data, "base64"));
  await viewport(390);
  await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }).then(shot => writeFileSync(join(out, "mobile.png"), Buffer.from(shot.data, "base64")));
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const users = await js("JSON.parse(localStorage.getItem('garasi-hobby-demo-v1')).users.filter(u=>u.active).map(u=>({id:u.id,role:u.role}))");
  for (const user of users) {
    const path = user.role === 'Owner' ? 'ringkasan' : user.role === 'Staf Showroom' ? 'motor' : user.role === 'Staf Gudang' ? 'stok' : 'bengkel';
    await js(`sessionStorage.setItem('gh-demo-user', ${JSON.stringify(user.id)}); location.hash = ${JSON.stringify(`/${path}`)}`);
    await cdp("Page.reload");
    await wait("!!document.querySelector('.app-shell') && !!document.querySelector('h1')");
    const roleHealth = await health();
    check(`Mobile role ${user.role}`, roleHealth, roleHealth.h1 === 1 && roleHealth.scroll <= roleHealth.width && !roleHealth.broken.length && !roleHealth.nameless.length);
  }
  await js("sessionStorage.setItem('gh-demo-user', JSON.parse(localStorage.getItem('garasi-hobby-demo-v1')).users.find(u=>u.role==='Owner').id); location.hash='/ringkasan'");
  await cdp("Page.reload");
  await wait("!!document.querySelector('.revenue-panel')");
  await cdp("Emulation.setEmulatedMedia", { features: [] });
  check("Console errors", errors, errors.length === 0);
  console.log(`${evidence.length} browser checks passed. ${out}`);
} catch (error) {
  const debug = await js("({width:innerWidth,hash:location.hash,active:document.activeElement.outerHTML.slice(0,400),sidebar:document.querySelector('.sidebar')?.className, transform:getComputedStyle(document.querySelector('.sidebar')).transform,menu:document.querySelector('button[aria-controls=sidebar]').getBoundingClientRect().toJSON(),elementAtMenu:(()=>{const r=document.querySelector('button[aria-controls=sidebar]').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,300)})()})");
  writeFileSync(join(out, 'debug.json'), JSON.stringify(debug, null, 2));
  const shot = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(out, "failure.png"), Buffer.from(shot.data, "base64"));
  throw error;
} finally {
  writeFileSync(join(out, "checks.json"), JSON.stringify(evidence, null, 2));
  socket.close();
}
