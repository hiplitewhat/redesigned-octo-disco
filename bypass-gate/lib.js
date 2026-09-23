/**
 * Shared helpers for the bypass-gate test harnesses (jsdom + real browser).
 */
'use strict';

const stripHeader = (src) =>
  src.replace(/^\s*\/\/ ==\/UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');

// W3C user-script @match validation (enough for this script's patterns)
function isValidMatchPattern(p) {
  const m = p.match(/^([*a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/]*)(\/.*)?$/);
  if (!m) return false;
  const host = m[2];
  const validHost =
    host === '*' ||
    /^(\*\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+)?$/.test(host);
  if (!validHost) return false;
  const segOk = (m[3] || '/').split('/').every((s) => /^[a-zA-Z0-9_.!*-]*$/.test(s));
  return segOk;
}

function staticChecks(src) {
  const out = [];
  const matches = [...src.matchAll(/^\/\/ @match\s+(.+)$/gm)].map((m) => m[1].trim());
  const bad = matches.filter((m) => !isValidMatchPattern(m));
  out.push({
    id: 'S1 all @match patterns valid',
    pass: bad.length === 0,
    detail: bad.length ? 'INVALID: ' + bad.join('  |  ') : matches.length + ' patterns OK',
  });

  const decl = (src.match(/function\s+autoClickGetLink\s*\(/g) || []).length;
  const calls = (src.match(/autoClickGetLink\s*\(/g) || []).length - decl;
  out.push({
    id: 'S2 auto-click code wired (or absent)',
    pass: decl === 0 || calls > 0,
    detail: decl === 0 ? 'no auto-click code (manual mode — OK)' : `autoClickGetLink declared ${decl}x, called ${calls}x`,
  });

  const moGuard = /if\s*\(\s*document\.body\s*\)\s*\{[\s\S]{0,240}?new MutationObserver/.test(src);
  const hasRetry = /readyState|attachObserver|observeWhenReady/.test(src);
  out.push({
    id: 'S3 MutationObserver attach is run-at safe',
    pass: !moGuard || hasRetry,
    detail:
      moGuard && !hasRetry
        ? 'observer only attaches when document.body already exists at script start — default @run-at is document-start, so with the default run-at the observer silently never gets installed and scanning stops after the 11s timeout ladder'
        : 'OK',
  });
  return out;
}

function print(name, { results, infos, logs }) {
  console.log(`\n${'='.repeat(80)}\n ${name}\n${'='.repeat(80)}`);
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS ✅' : 'FAIL ❌'}  ${r.id}`);
    if (r.detail) console.log('          ' + r.detail);
  }
  for (const r of infos) {
    console.log(`  INFO ⚪  ${r.id}`);
    if (r.detail) console.log('          ' + r.detail);
  }
  const fail = results.filter((r) => !r.pass).length;
  console.log(`  ---- ${results.length - fail}/${results.length} passed${fail ? `, ${fail} FAILED` : ''} ----`);
  const bypassLogs = (logs || []).filter((l) => l.startsWith('[Bypass]') || l.startsWith('=== '));
  if (bypassLogs.length) {
    console.log('  script log (last 3):');
    bypassLogs.slice(-3).forEach((l) => console.log('    ' + l.slice(0, 110)));
  }
}

module.exports = { stripHeader, isValidMatchPattern, staticChecks, print };
