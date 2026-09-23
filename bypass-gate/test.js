/**
 * Bypass Gate — automated test harness
 *
 * Simulates a Tampermonkey run of the userscript on a realistic mock of a
 * vplink-style ad-gate page (gate-page.html) using jsdom:
 *   - real timers, real events, MutationObserver, inline-style getComputedStyle
 *   - NO real layout/GPU (browser binary cannot be downloaded in this sandbox),
 *     so overlay detection is exercised through the z-index branch exactly like
 *     real gate pages (they use z-index: 99999+), and innerText is polyfilled
 *     as textContent.
 *
 * Background recorders sample the DOM every 50ms from injection time, so every
 * assertion measures the TRUE moment a state change happened (no cascading
 * wait-until distortion).
 *
 * Run:  node test.js            (tests original + fixed)
 *       node test.js fixed      (tests only the given script file)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { stripHeader, staticChecks, print } = require('./lib');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

/* ---------------- runtime suite ---------------- */

async function runSuite(scriptFile) {
  const results = [];
  const infos = [];
  const add = (id, pass, detail) => results.push({ id, pass: !!pass, detail: detail == null ? '' : String(detail) });
  const addInfo = (id, detail) => infos.push({ id, detail: detail == null ? '' : String(detail) });
  const f2 = (n) => (n == null ? 'never' : '~' + n.toFixed(2) + 's');

  const errors = [];
  const logs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));
  vc.on('log', (...a) => logs.push(a.join(' ')));

  const dom = new JSDOM(read('gate-page.html'), {
    url: 'http://gate.local/?wait=4', // wait=4s gate-1, 2s gate-2 (page default: 15s)
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  const { document } = window;

  // jsdom does not implement layout-based innerText
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
  });

  const t0 = Date.now();
  const ts = () => (Date.now() - t0) / 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const computed = (el) => window.getComputedStyle(el);
  const userClick = (el) =>
    el.dispatchEvent(new window.MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

  const adGate = document.getElementById('ad-gate');
  const getlink1 = document.getElementById('getlink1');
  const gate2 = document.getElementById('gate2');
  const cont2 = document.getElementById('cont2');
  const promo = document.getElementById('promo');
  const cd1 = document.getElementById('cd1');
  const dlFooter = document.getElementById('dl-footer');

  // ---- background recorders (50ms sampling from t=0) ----
  const rec = { enabled: {}, hidden: {}, shown2: null };
  const recorders = [
    setInterval(() => {
      if (rec.enabled.getlink1 == null && !getlink1.disabled) rec.enabled.getlink1 = ts();
    }, 50),
    setInterval(() => {
      if (rec.enabled.cont2 == null && !cont2.disabled) rec.enabled.cont2 = ts();
    }, 50),
    setInterval(() => {
      if (rec.hidden.adGate == null && computed(adGate).display === 'none') rec.hidden.adGate = ts();
    }, 50),
    setInterval(() => {
      if (rec.shown2 == null && gate2.style.display !== 'none') rec.shown2 = ts();
      if (rec.hidden.gate2 == null && rec.shown2 != null && computed(gate2).display === 'none')
        rec.hidden.gate2 = ts();
    }, 50),
    setInterval(() => {
      if (rec.hidden.promo == null && computed(promo).display === 'none') rec.hidden.promo = ts();
    }, 50),
  ];

  // Inject the userscript once the gate DOM exists (document-idle-equivalent;
  // the document-start observer issue is covered separately by check S3)
  await new Promise((res) => {
    if (document.readyState !== 'loading') res();
    else window.addEventListener('DOMContentLoaded', res, { once: true });
  });
  window.eval(stripHeader(read(scriptFile)));

  // A9 — status UI (script should have created it right away)
  await sleep(600);
  const ui = document.getElementById('bypass-ui');
  add('A9 status UI panel present', !!ui && ui.textContent.trim().length > 0,
    ui ? 'panel shows: ' + ui.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : 'no #bypass-ui element');

  // A1 — gate-1 overlay (mixed-case "Click ads & wait") hidden within 2.5s?
  await sleep(2500);
  add('A1 gate-1 overlay removed', rec.hidden.adGate != null && rec.hidden.adGate <= 2.5,
    rec.hidden.adGate != null ? `hidden ${f2(rec.hidden.adGate)}` : 'STILL VISIBLE at 2.5s — keyword case-matching?');

  // A2 — Get Link force-enabled clearly before the site's own 4s unlock?
  add('A2 "Get Link" force-enabled early', rec.enabled.getlink1 != null && rec.enabled.getlink1 < 3.5,
    rec.enabled.getlink1 != null
      ? `enabled ${f2(rec.enabled.getlink1)} (site would unlock at ${window.__gate.wait1}s)`
      : 'not enabled by 2.5s+');

  // A3 — countdown honesty: the real timer keeps ticking (skip = early enable, not a faked stop)
  const c1a = cd1.textContent;
  await sleep(1200);
  const c1b = cd1.textContent;
  add('A3 page countdown still ticks', c1a !== c1b, `"${c1a}" → "${c1b}"`);

  // D1 — decoy footer link (informational only): force-enabling scope is aggressive by design
  const decoyOn = computed(dlFooter).pointerEvents !== 'none' && parseFloat(computed(dlFooter).opacity) >= 0.9;
  addInfo('D1 decoy "Download original" footer link',
    decoyOn ? 'was force-enabled too (aggressive scope — verify on real pages that no important controls live there)' : 'left untouched');

  // A4 — no auto-click: nothing may click before the user does
  await sleep(Math.max(0, 3800 - ts() * 1000));
  add('A4 no auto-click (manual mode)', (window.__clickLog || []).length === 0,
    `clickLog.length=${(window.__clickLog || []).length} before any user action`);

  // ---- user flow: real clicks dispatched by the harness ----
  userClick(getlink1); // user clicks Get Link (script must have enabled it by now)
  await sleep(1200);   // let gate-2 appear (~400ms) and the script a full scan cycle

  // A5a — gate-2 overlay (NEW element with gate text) hidden within 2s of appearing?
  const a5a = rec.shown2 != null && rec.hidden.gate2 != null && rec.hidden.gate2 - rec.shown2 <= 2.0;
  add('A5a gate-2 overlay removed', a5a,
    a5a ? `appeared ${f2(rec.shown2)}, hidden ${f2(rec.hidden.gate2)}`
        : rec.shown2 != null ? 'STILL VISIBLE 2s after appearing — second-stage gate left on screen'
                             : 'gate-2 never appeared');

  // A5b — Continue force-enabled within 1.5s of gate-2 appearing (before its own 2s site unlock)?
  const a5b = rec.shown2 != null && rec.enabled.cont2 != null && rec.enabled.cont2 - rec.shown2 <= 1.5;
  add('A5b "Continue" force-enabled early', a5b,
    a5b ? `enabled ${f2(rec.enabled.cont2)} ${rec.enabled.cont2 <= rec.shown2 ? '(pre-unlocked while hidden — harmless, user can only click it once gate-2 is up)' : '(gate-2 at ' + f2(rec.shown2) + ')'}`
        : rec.enabled.cont2 != null ? `enabled ${f2(rec.enabled.cont2)} but too late after gate-2 (${f2(rec.shown2)})`
                                    : 'still disabled');

  // user waits for Continue to be usable, then clicks → success
  const waitReady = Date.now();
  while (cont2.disabled && Date.now() - waitReady < 3000) await sleep(100);
  userClick(cont2);
  const a6 = window.__gateDone === true;
  add('A6 user reached the link (flow completes)', a6,
    a6 ? `success reached, total user clicks=${(window.__clickLog || []).length}` : 'never reached success');

  // A7 — pre-existing toast whose text BECOMES gate text at t=3s (processed-set trap)
  await sleep(Math.max(0, 5500 - ts() * 1000));
  add('A7 late-appearing gate removed', rec.hidden.promo != null && rec.hidden.promo <= 6.5,
    rec.hidden.promo != null ? `hidden ${f2(rec.hidden.promo)} (text changed at 3.0s)`
                             : 'STILL VISIBLE: "⏳ Click ads & wait for bonus link" — element was cached at first scan');

  // A8 — no uncaught page errors
  add('A8 no uncaught page errors', errors.length === 0,
    errors.length ? errors.slice(0, 3).join(' | ') : 'clean');

  recorders.forEach(clearInterval);
  window.close();
  return { results, infos, logs, errors };
}

(async () => {
  const only = process.argv[2] || null;
  const targets = [
    { label: 'ORIGINAL v5.3-TIMER (as pasted)', file: 'original.user.js' },
    { label: 'FIXED v5.4-TIMER (manual mode)', file: 'bypass-gate-timer-skip.user.js' },
  ].filter((t) => !only || t.file === only);

  const summary = {};
  for (const t of targets) {
    const staticRes = staticChecks(read(t.file));
    const rt = await runSuite(t.file);
    rt.results = [...staticRes, ...rt.results];
    print(t.label + '  —  ' + t.file, rt);
    summary[t.label] = rt.results.every((r) => r.pass);
  }

  console.log(`\n${'='.repeat(80)}\n SUMMARY\n${'='.repeat(80)}`);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${v ? 'PASS ✅' : 'FAIL ❌'}  ${k}`);

  // Expected: original fails (that's the point); fixed must pass.
  const fixedOk = summary['FIXED v5.4-TIMER (manual mode)'];
  process.exit(fixedOk === true ? 0 : 1);
})().catch((e) => { console.error('harness crashed:', e); process.exit(2); });
