/**
 * Bypass Gate — REAL BROWSER test harness (Chromium 153 via Playwright)
 *
 * Runs the exact same scenario as test.js (jsdom) but in a real headless
 * Chromium: real layout, real innerText, real hit-tested clicks
 * (page.click() refuses to click disabled/covered elements — like a human),
 * real timers.
 *
 * The sandbox user has no capabilities (CapEff=0), but root can create the
 * namespaces Chromium's zygote needs — so this MUST run as root:
 *
 *     sudo node test-real.js
 *
 * Uses the Chromium binary extracted to /tmp/chromium (with its bundled
 * system libs in /tmp/al2023/lib and SwiftShader in /tmp). Override with
 * CHROME_PATH / CHROME_LD_LIBRARY_PATH env vars if needed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const { stripHeader, staticChecks, print } = require('./lib');

const CHROME = process.env.CHROME_PATH || '/tmp/chromium';
const CHROME_LD = process.env.CHROME_LD_LIBRARY_PATH || '/tmp:/tmp/al2023/lib';
const PORT = 8099;
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.user.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/' || rel === '') { res.writeHead(404); res.end('not found'); return; }
      const f = path.join(__dirname, rel);
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function runSuite(scriptFile) {
  const results = [];
  const infos = [];
  const add = (id, pass, detail) => results.push({ id, pass: !!pass, detail: detail == null ? '' : String(detail) });
  const addInfo = (id, detail) => infos.push({ id, detail: detail == null ? '' : String(detail) });
  const f2 = (n) => (n == null ? 'never' : '~' + n.toFixed(2) + 's');

  const errors = [];
  const logs = [];

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: CHROME_LD },
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--font-render-hinting=none',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('[Bypass]') || t.startsWith('===')) logs.push(t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/gate-page.html?wait=4`, { waitUntil: 'domcontentloaded' });

  // inject the userscript into the page context (like @grant none Tampermonkey)
  await page.addScriptTag({ content: stripHeader(read(scriptFile)) });

  // in-page background recorder (50ms sampling from t=0)
  const t0Host = Date.now();
  await page.evaluate(() => {
    window.__rec = { enabled: {}, hidden: {}, shown2: null, t0: performance.now() };
    const r = window.__rec;
    const rel = () => (performance.now() - r.t0) / 1000;
    const g = (id) => document.getElementById(id);
    const vis = (id) => getComputedStyle(g(id)).display !== 'none';
    setInterval(() => {
      if (r.enabled.getlink1 == null && !g('getlink1').disabled) r.enabled.getlink1 = rel();
      if (r.enabled.cont2 == null && !g('cont2').disabled) r.enabled.cont2 = rel();
      if (r.hidden.adGate == null && !vis('ad-gate')) r.hidden.adGate = rel();
      if (r.shown2 == null && g('gate2').style.display !== 'none') r.shown2 = rel();
      if (r.hidden.gate2 == null && r.shown2 != null && !vis('gate2')) r.hidden.gate2 = rel();
      if (r.hidden.promo == null && !vis('promo')) r.hidden.promo = rel();
    }, 50);
  });
  const rec = () => page.evaluate(() => window.__rec);
  const wall = () => Date.now() - t0Host;
  const sleep = (ms) => page.waitForTimeout(ms);
  const waitWall = async (ms) => { const left = ms - wall(); if (left > 0) await sleep(left); };

  // A9 — status UI
  await sleep(600);
  const uiText = await page.$eval('#bypass-ui', (el) => el.textContent.trim()).catch(() => '');
  add('A9 status UI panel present', uiText.length > 0,
    uiText ? 'panel shows: ' + uiText.replace(/\s+/g, ' ').slice(0, 90) : 'no #bypass-ui element');

  // A1 — gate-1 overlay hidden within 2.5s?
  await waitWall(2500);
  let r = await rec();
  add('A1 gate-1 overlay removed', r.hidden.adGate != null && r.hidden.adGate <= 2.5,
    r.hidden.adGate != null ? `hidden ${f2(r.hidden.adGate)}` : 'STILL VISIBLE at 2.5s — keyword case/punctuation matching?');

  // A2 — Get Link force-enabled before the site's own 4s unlock?
  add('A2 "Get Link" force-enabled early', r.enabled.getlink1 != null && r.enabled.getlink1 < 3.5,
    r.enabled.getlink1 != null
      ? `enabled ${f2(r.enabled.getlink1)} (site would unlock at ~4s after load)`
      : 'not enabled by 2.5s+');

  // A3 — countdown honesty: real timer keeps ticking
  const c1a = await page.$eval('#cd1', (el) => el.textContent);
  await sleep(1200);
  const c1b = await page.$eval('#cd1', (el) => el.textContent);
  add('A3 page countdown still ticks', c1a !== c1b, `"${c1a}" → "${c1b}"`);

  // D1 — decoy footer link (informational)
  const decoy = await page.$eval('#dl-footer', (el) => {
    const s = getComputedStyle(el);
    return { pe: s.pointerEvents, op: parseFloat(s.opacity) };
  });
  const decoyOn = decoy.pe !== 'none' && decoy.op >= 0.9;
  addInfo('D1 decoy "Download original" footer link',
    decoyOn ? 'was force-enabled too (aggressive scope — verify on real pages that no important controls live there)' : 'left untouched');

  // A4 — no auto-click: nothing may click before the user does
  await waitWall(3800);
  const clicks0 = await page.evaluate(() => (window.__clickLog || []).length);
  add('A4 no auto-click (manual mode)', clicks0 === 0,
    `clickLog.length=${clicks0} before any user action`);

  // ---- user flow: real hit-tested clicks (Playwright refuses disabled/covered elements) ----
  let clickOk1 = true;
  try { await page.click('#getlink1', { timeout: 4000 }); } catch { clickOk1 = false; }
  await sleep(1200);
  r = await rec();

  const a5a = r.shown2 != null && r.hidden.gate2 != null && r.hidden.gate2 - r.shown2 <= 2.0;
  add('A5a gate-2 overlay removed', a5a,
    a5a ? `appeared ${f2(r.shown2)}, hidden ${f2(r.hidden.gate2)}`
        : r.shown2 != null ? 'STILL VISIBLE 2s after appearing — second-stage gate left on screen'
                           : 'gate-2 never appeared');

  const a5b = r.shown2 != null && r.enabled.cont2 != null && r.enabled.cont2 - r.shown2 <= 1.5;
  add('A5b "Continue" force-enabled early', a5b,
    a5b ? `enabled ${f2(r.enabled.cont2)} ${r.enabled.cont2 <= r.shown2 ? '(pre-unlocked while hidden — harmless)' : '(gate-2 at ' + f2(r.shown2) + ')'}`
        : r.enabled.cont2 != null ? `enabled ${f2(r.enabled.cont2)} but too late after gate-2 (${f2(r.shown2)})`
                                  : 'still disabled');

  // wait until Continue is actually usable, then click it
  let ready = false;
  for (let i = 0; i < 30; i++) {
    ready = await page.$eval('#cont2', (el) => !el.disabled && getComputedStyle(el).display !== 'none');
    if (ready) break;
    await sleep(100);
  }
  let clickOk2 = ready;
  if (ready) { try { await page.click('#cont2', { timeout: 4000 }); } catch { clickOk2 = false; } }
  const done = await page.evaluate(() => window.__gateDone === true);
  add('A6 user reached the link (flow completes)', done,
    done ? `success reached${clickOk1 && clickOk2 ? ', both clicks landed as real user clicks' : ' (a click step failed: ' + (clickOk1 ? 'cont2' : 'getlink1') + ')'}`
         : 'never reached success' + (clickOk1 ? '' : ' — first click never landed (button not usable?)'));

  // A7 — pre-existing toast whose text BECOMES gate text ~3s after load
  await waitWall(5500);
  r = await rec();
  add('A7 late-appearing gate removed', r.hidden.promo != null && r.hidden.promo <= 6.5,
    r.hidden.promo != null ? `hidden ${f2(r.hidden.promo)} (text changed ~3s after load)`
                           : 'STILL VISIBLE: "⏳ Click ads & wait for bonus link" — element was cached at first scan');

  // A8 — no uncaught page errors
  add('A8 no uncaught page errors', errors.length === 0,
    errors.length ? errors.slice(0, 3).join(' | ') : 'clean');

  await browser.close();
  return { results, infos, logs, errors };
}

(async () => {
  const only = process.argv[2] || null;
  const targets = [
    { label: 'REAL BROWSER — ORIGINAL v5.3-TIMER (as pasted)', file: 'original.user.js' },
    { label: 'REAL BROWSER — FIXED v5.4-TIMER (manual mode)', file: 'bypass-gate-timer-skip.user.js' },
  ].filter((t) => !only || t.file === only);

  if (!fs.existsSync(CHROME)) {
    console.error(`Chromium binary not found at ${CHROME}.`);
    console.error('Set CHROME_PATH, or extract it (see README) — it cannot be downloaded in this sandbox.');
    process.exit(3);
  }

  const server = await startServer();
  const summary = {};
  try {
    for (const t of targets) {
      const staticRes = staticChecks(read(t.file));
      const rt = await runSuite(t.file);
      rt.results = [...staticRes, ...rt.results];
      print(t.label + '  —  ' + t.file, rt);
      summary[t.label] = rt.results.every((x) => x.pass);
    }
  } finally {
    server.close();
  }

  console.log(`\n${'='.repeat(80)}\n SUMMARY (real browser)\n${'='.repeat(80)}`);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${v ? 'PASS ✅' : 'FAIL ❌'}  ${k}`);
  const fixedOk = summary['REAL BROWSER — FIXED v5.4-TIMER (manual mode)'];
  process.exit(fixedOk === true ? 0 : 1);
})().catch((e) => { console.error('harness crashed:', e); process.exit(2); });
