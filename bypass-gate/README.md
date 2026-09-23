# Bypass Gate — test bench

Tests for the **Bypass Gate – TIMER SKIP** Tampermonkey userscript (v5.3-TIMER as
pasted → **v5.4-TIMER fixed**).

## Files

| File | What it is |
|---|---|
| `bypass-gate-timer-skip.user.js` | **Fixed v5.4** userscript (manual mode — no auto-click) |
| `original.user.js` | v5.3-TIMER, exactly as pasted (kept for comparison) |
| `gate-page.html` | Realistic mock of a vplink-style ad-gate page (the test fixture) |
| `test.js` | Automated test harness (Node + jsdom) |
| `index.html` | Live-preview launcher — open it in a real browser and run the gate with either script |

## Run the automated tests

```bash
cd bypass-gate
npm install     # jsdom + playwright
node test.js    # jsdom suite (fast, no browser needed)
node test.js fixed   # only the fixed script

sudo node test-real.js    # REAL BROWSER suite (headless Chromium 153 via Playwright)
```

Exit code is 0 only when the fixed script passes everything.

**Real browser suite notes:** this sandbox's `user` has no capabilities
(`CapEff=0`) so Chromium's zygote can't create its namespaces as a normal
user — run the suite (and the browser) as **root**. The Chromium binary is
`/tmp/chromium` (153.0.8010.0) with its bundled system libs in
`/tmp/al2023/lib` and SwiftShader in `/tmp`; override with `CHROME_PATH` /
`CHROME_LD_LIBRARY_PATH`. The real suite additionally exercises true layout
(the `offsetWidth/offsetHeight` detection branch) and real hit-tested clicks:
`page.click()` refuses disabled or covered elements, so A6 proves a human
could actually click through.

## Latest result (2026-09-23)

| Check | v5.3 original | v5.4 fixed |
|---|---|---|
| S1 all `@match` patterns valid | ❌ `*://vplink.*/*`, `*://*.vplink.*/*` are invalid host patterns | ✅ |
| S2 auto-click code wired (or absent) | ❌ `autoClickGetLink()` declared, **never called** (dead code) | ✅ (removed, manual mode) |
| S3 MutationObserver attach is run-at safe | ❌ only attaches if `document.body` exists at script start; default `@run-at` is `document-start` → observer silently never installed, scanning stops after the 11s timeout ladder | ✅ retry until body exists |
| A1 gate-1 overlay removed | ❌ keyword matching is case-**and** punctuation-sensitive (“CLICK ADS WAIT” never matches “Click ads & wait”) | ✅ hidden ~0.8s |
| A2 “Get Link” force-enabled early | ✅ ~0.9s | ✅ ~0.8s |
| A3 page countdown still ticks | ✅ (skip = early enable, not a faked stop) | ✅ |
| A4 no auto-click | ✅ | ✅ |
| A5a gate-2 overlay removed (new element) | ❌ same keyword bug | ✅ hidden ~0.2s after appearing |
| A5b “Continue” force-enabled early | ✅ | ✅ |
| A6 user reaches the link | ✅ (2 real clicks) | ✅ |
| A7 late-appearing gate removed (text change) | ❌ `processed` WeakSet cached the element at first scan, never re-checked | ✅ hidden ~0.4s after text changed |
| A8 no uncaught page errors | ✅ | ✅ |
| D1 decoy footer link (INFO) | ⚪ force-enabled too (aggressive scope by design — verify on real pages) | ⚪ same |

**Same table in a REAL browser** (Chromium 153 headless + Playwright,
`sudo node test-real.js`, 2026-09-23): identical results — original **7/13**
(6 FAILED), fixed **13/13 passed**, and A6 confirmed with real hit-tested
clicks ("both clicks landed as real user clicks").

## What the mock page simulates

* **Gate 1** — full-screen `position:fixed; z-index:99999` overlay with
  “⚡ Click ads & wait”, a fake ad tile, a real JS countdown, and a separate
  disabled **Get Link** button (typical layout: button is a sibling, not a child,
  of the overlay).
* **Gate 2** — a brand-new overlay + disabled **Continue** button, created only
  when Get Link is clicked.
* **Gate 3** — pre-existing corner toast whose *text* changes to gate text 3s
  after load (isolates the `processed`-WeakSet bug).
* **Decoy** — locked footer “Download original” link (informational check of
  force-enable scope).
* Countdowns are real `setInterval`s; the site itself unlocks each button when
  its timer reaches 0 — so “early unlock” is only possible if the script works.

## Environment & how the browsers are obtained (read this)

* Browser CDNs (cdn.playwright.dev, googleapis, jsdelivr, …) are **blocked from
  this sandbox's egress** — only the npm registry, GitHub and PyPI are
  reachable. Chromium 153 was therefore obtained from the npm package
  `@sparticuz/chromium@153.0.0`, which ships the binary + Amazon-Linux system
  libs + SwiftShader inside the tarball (`/tmp/chromium`, `/tmp/al2023/lib`,
  `/tmp/*swiftshader*`).
* The first browser failures were **not** the sandbox kernel: the sandbox user
  has `CapEff=0`, so namespace creation (Chromium's zygote) failed as a normal
  user. As **root** everything works (mount/user/pid namespaces OK) — the real
  suite runs as root.
* The **jsdom suite** (`test.js`) needs no browser: real timers, events,
  `MutationObserver`, computed styles — but no layout/GPU, so overlay detection
  is exercised through the z-index branch and `innerText` is polyfilled as
  `textContent`. Keep it for fast/CI runs.
* The **real-browser suite** (`test-real.js`) covers the rest: true layout,
  true `innerText`, trusted hit-tested clicks.
* The live-preview pages (`index.html` → `gate-page.html?script=…`) run in
  **your real browser** — use them for the click-through check.
  `gate-page.html` self-injects the script when `?script=original|fixed` is set;
  the harnesses omit that param and inject the script themselves.
