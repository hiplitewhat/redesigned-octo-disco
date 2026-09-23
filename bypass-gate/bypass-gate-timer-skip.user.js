// ==UserScript==
// @name         Bypass Gate - TIMER SKIP
// @namespace    http://tampermonkey.net/
// @version      5.4-TIMER
// @description  Removes gate overlays AND force-enables Get Link/Continue buttons (manual click — no auto-click)
// @author       You
// @match        *://vplink.in/*
// @match        *://*.vplink.in/*
// @match        *://vplink.in/7ff3*
// @match        *://hittracks.in.net/*
// @match        *://*.hittracks.in.net/*
// @match        *://study.hittracks.in.net/*
// @match        *://studyaf.com/*
// @match        *://*.studyaf.com/*
// @grant        none
// ==/UserScript==
//
// v5.4 changes vs 5.3-TIMER
//  - REMOVED invalid @match patterns *://vplink.*/* and *://*.vplink.*/*
//    (a host wildcard may only be a leading "*." or the whole host "*";
//     trailing wildcards inside a hostname are not legal match patterns).
//  - Gate keyword matching is now case- AND punctuation-insensitive: text is
//    normalized (uppercased, non-alphanumerics collapsed to spaces) before
//    comparing. 5.3 compared uppercase keywords against raw page text, so
//    "Click ads & wait" never matched — not on case alone, but because the
//    keyword "CLICK ADS WAIT" also lacks the "&" real pages use.
//  - Removed the `processed` WeakSet: it cached EVERY scanned element on first
//    sight, so an element whose text LATER became gate text was never re-checked.
//    Elements we hide are tracked in `hiddenByUs` and re-hidden if the page
//    tries to show them again.
//  - MutationObserver now attaches with a retry until document.body exists, so
//    it works even with the default @run-at (document-start), where 5.3 silently
//    never installed the observer and scanning stopped after the 11s timeouts.
//    The observer also watches characterData (text-only changes).
//  - Removed the global `overflow: auto !important` stamp on <html>/<body>.
//  - Removed dead autoClickGetLink() (it was never called). v5.4 is MANUAL mode:
//    it unlocks the buttons, a real user click does the rest.
//  - Keyword scanning uses textContent (layout-free, much cheaper than innerText
//    on every pass).

(function() {
    'use strict';

    const GATE_KEYWORDS = ['CLICK ADS WAIT', 'CLICK IMAGE & WAIT', 'GET LINK - DOWNLOAD'];
    const KEYWORD_HINTS = ['GET LINK', 'CONTINUE', 'DOWNLOAD', 'PROCEED'];

    // Normalize: uppercase + collapse all non-alphanumeric runs to a single
    // space. "Click ads & wait!" -> "CLICK ADS WAIT", "Get link - download"
    // -> "GET LINK DOWNLOAD". Matching happens in normalized space so casing,
    // "&", "-", "…" etc. in the page text can't defeat the keywords.
    function norm(s) {
        return s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const GATE_KEYWORDS_N = GATE_KEYWORDS.map(norm);

    let statusDot = null, statusText = null, detailsText = null;

    function createUI() {
        const existingUI = document.getElementById('bypass-ui');
        if (existingUI) existingUI.remove();
        const ui = document.createElement('div');
        ui.id = 'bypass-ui';
        ui.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:rgba(0,0,0,0.88);color:#fff;padding:12px 14px;border-radius:8px;font-family:Segoe UI,Arial,sans-serif;font-size:12px;max-width:340px;min-width:220px;box-shadow:0 4px 20px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);pointer-events:none;user-select:text;';
        ui.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-weight:bold;color:#4FC3F7;">🔄 Bypass Gate</span><span id="bypass-status-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#FFA726;"></span></div><div id="bypass-status-text" style="color:#ccc;font-size:11px;word-break:break-word;">Initializing...</div><div id="bypass-details" style="color:#888;font-size:10px;margin-top:4px;word-break:break-word;max-height:140px;overflow-y:auto;"></div>';
        document.body.appendChild(ui);
    }

    function updateUI(status, details, dotColor) {
        if (!statusDot || !statusText || !detailsText) {
            statusDot = document.getElementById('bypass-status-dot');
            statusText = document.getElementById('bypass-status-text');
            detailsText = document.getElementById('bypass-details');
            if (!statusDot) return;
        }
        if (status) statusText.textContent = status;
        if (details) detailsText.textContent = details;
        if (dotColor) statusDot.style.background = dotColor;
    }

    function logWithUI(message, details, dotColor) {
        console.log('[Bypass]', message, details || '');
        updateUI(message, details, dotColor);
    }

    function hasGateKeyword(text) {
        if (!text) return false;
        const up = norm(text);
        for (let i = 0; i < GATE_KEYWORDS_N.length; i++) {
            if (up.indexOf(GATE_KEYWORDS_N[i]) !== -1) return true;
        }
        return false;
    }

    function inOurUI(el) {
        return el.id === 'bypass-ui' || (el.closest && el.closest('#bypass-ui'));
    }

    // ============ TIMER SKIP ============

    // Find disabled buttons/links whose text looks like a "get link" action and enable them
    function forceEnableGetLink() {
        let changed = 0;
        const els = document.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            if (inOurUI(el)) continue;
            const text = (el.innerText || el.value || '').toUpperCase();
            let isGetLink = false;
            for (let k = 0; k < KEYWORD_HINTS.length; k++) {
                if (text.indexOf(KEYWORD_HINTS[k]) !== -1) { isGetLink = true; break; }
            }
            if (!isGetLink) continue;

            let didChange = false;

            // Remove common disable mechanisms
            if (el.disabled) { el.disabled = false; didChange = true; }
            if (el.hasAttribute('disabled')) { el.removeAttribute('disabled'); didChange = true; }

            const cls = (el.className || '').toString();
            if (/disabled|inactive|locked/i.test(cls)) {
                el.classList.remove('disabled', 'inactive', 'locked');
                didChange = true;
            }

            const style = window.getComputedStyle(el);
            if (style.pointerEvents === 'none') {
                el.style.setProperty('pointer-events', 'auto', 'important');
                didChange = true;
            }
            if (parseFloat(style.opacity) < 0.9) {
                el.style.setProperty('opacity', '1', 'important');
                didChange = true;
            }

            if (didChange) changed++;
        }
        return changed;
    }

    // Best-effort: stamp data attributes some gate pages read. The real "skip"
    // is forceEnableGetLink() making the button usable before the countdown ends.
    function killCountdown() {
        let touched = 0;
        const all = document.querySelectorAll('[class*="timer"], [class*="count"], [id*="timer"], [id*="count"], [data-countdown], [data-timer]');
        for (let i = 0; i < all.length; i++) {
            const el = all[i];
            if (inOurUI(el)) continue;
            if ((el.innerText || '').length > 600) continue;
            el.setAttribute('data-countdown', '0');
            el.setAttribute('data-timer', '0');
            touched++;
        }
        return touched;
    }

    // ============ OVERLAY REMOVAL (safe) ============
    // Elements we hid. Re-checked every pass so the page can't simply
    // re-show them; dropped from the set if removed from the DOM.
    const hiddenByUs = new Set();

    function removeGateOverlay() {
        if (!document.body) return 0;
        let removed = 0;

        // 1) Keep our hidden overlays hidden
        for (const el of hiddenByUs) {
            if (!el.isConnected) { hiddenByUs.delete(el); continue; }
            if (window.getComputedStyle(el).display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
                removed++;
            }
        }

        // 2) Hide new gates
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const candidates = document.querySelectorAll('div, section, aside, dialog');
        for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            if (el === document.body || el === document.documentElement) continue;
            if (inOurUI(el)) continue;
            if (hiddenByUs.has(el)) continue;

            const txt = el.textContent || '';
            if (!hasGateKeyword(txt)) continue;
            if (txt.length > 600) continue;

            const style = window.getComputedStyle(el);
            if (!(style.position === 'fixed' || style.position === 'sticky')) continue;

            const z = parseInt(style.zIndex || '0', 10);
            if ((el.offsetWidth >= vw * 0.3 && el.offsetHeight >= vh * 0.2) || z >= 100) {
                el.style.setProperty('display', 'none', 'important');
                hiddenByUs.add(el);
                removed++;
            }
        }
        return removed;
    }

    // ============ MAIN LOOP ============
    let scheduled = false;
    function runOnce() {
        const removed = removeGateOverlay();
        const enabled = forceEnableGetLink();
        const timers = killCountdown();

        let msg = '';
        if (removed) msg += 'removed:' + removed + ' ';
        if (enabled) msg += 'enabled:' + enabled + ' ';
        if (timers) msg += 'timers:' + timers;

        if (msg) {
            logWithUI('✅ Gate handled', msg, '#4CAF50');
        } else {
            logWithUI('🔍 Scanning...', 'Looking for gate/timer', '#FFA726');
        }
    }

    function scheduleRun() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function() {
            scheduled = false;
            runOnce();
        }, 500);
    }

    function initUI() {
        if (!document.body) { setTimeout(initUI, 150); return; }
        createUI();
        statusDot = document.getElementById('bypass-status-dot');
        statusText = document.getElementById('bypass-status-text');
        detailsText = document.getElementById('bypass-details');
        logWithUI('🚀 Timer-Skip Gate v5.4 loaded', 'Manual mode: click Get Link when it unlocks', '#4FC3F7');
    }

    // Attach the observer whenever body exists — works for document-start,
    // document-idle and any run-at in between.
    let observerAttached = false;
    function attachObserver() {
        if (observerAttached) return;
        if (!document.body) { setTimeout(attachObserver, 100); return; }
        observerAttached = true;
        const mo = new MutationObserver(function() { scheduleRun(); });
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    initUI();
    attachObserver();

    setTimeout(runOnce, 800);
    setTimeout(runOnce, 2000);
    setTimeout(runOnce, 4000);
    setTimeout(runOnce, 7000);
    setTimeout(runOnce, 11000);

    console.log('=== Timer-Skip Gate v5.4 loaded (manual mode) ===');
})();
