// ==UserScript==
// @name         Bypass Gate - TIMER SKIP
// @namespace    http://tampermonkey.net/
// @version      5.3-TIMER
// @description  Removes gate overlay AND skips wait/countdown timers
// @author       You
// @match        *://vplink.in/*
// @match        *://*.vplink.in/*
// @match        *://vplink.*/*
// @match        *://*.vplink.*/*
// @match        *://vplink.in/7ff3*
// @match        *://study.hittracks.in.net/*
// @match        *://*.hittracks.in.net/*
// @match        *://hittracks.in.net/*
// @match        *://studyaf.com/*
// @match        *://*.studyaf.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GATE_KEYWORDS = ['CLICK ADS WAIT', 'Click Image & Wait', 'Get Link - Download'];

    let statusDot=null, statusText=null, detailsText=null;

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
        for (let i = 0; i < GATE_KEYWORDS.length; i++) {
            if (text.indexOf(GATE_KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    // ============ TIMER SKIP ============

    // Find disabled buttons/links whose text looks like a "get link" action and enable them
    function forceEnableGetLink() {
        let changed = 0;
        const els = document.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            const text = (el.innerText || el.value || '').toUpperCase();
            const isGetLink = text.indexOf('GET LINK') !== -1 ||
                              text.indexOf('CONTINUE') !== -1 ||
                              text.indexOf('DOWNLOAD') !== -1 ||
                              text.indexOf('PROCEED') !== -1;
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

    // Neutralize countdown text / data attributes that may block progression
    function killCountdown() {
        let touched = 0;
        const all = document.querySelectorAll('[class*="timer"], [class*="count"], [id*="timer"], [id*="count"], [data-countdown], [data-timer]');
        for (let i = 0; i < all.length; i++) {
            const el = all[i];
            if (el.id === 'bypass-ui' || (el.closest && el.closest('#bypass-ui'))) continue;
            // Skip huge wrappers
            if ((el.innerText || '').length > 600) continue;
            el.setAttribute('data-countdown', '0');
            el.setAttribute('data-timer', '0');
            touched++;
        }
        return touched;
    }

    // ============ OVERLAY REMOVAL (safe) ============
    const processed = new WeakSet();
    function removeGateOverlay() {
        if (!document.body) return 0;
        let removed = 0;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const candidates = document.querySelectorAll('div, section, aside, dialog');
        for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            if (el === document.body || el === document.documentElement) continue;
            if (el.id === 'bypass-ui' || (el.closest && el.closest('#bypass-ui'))) continue;
            if (processed.has(el)) continue;
            processed.add(el);

            const txt = el.innerText || '';
            if (!hasGateKeyword(txt)) continue;
            if (txt.length > 600) continue;

            const style = window.getComputedStyle(el);
            if (!(style.position === 'fixed' || style.position === 'sticky')) continue;

            const z = parseInt(style.zIndex || '0', 10);
            if ((el.offsetWidth >= vw * 0.3 && el.offsetHeight >= vh * 0.2) || z >= 100) {
                el.style.setProperty('display', 'none', 'important');
                removed++;
            }
        }
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
        if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
        return removed;
    }

    // ============ AUTO CLICK CONTINUE/GET LINK ============
    function autoClickGetLink() {
        const els = document.querySelectorAll('a, button, input[type="submit"]');
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            const text = (el.innerText || el.value || '').toUpperCase();
            if (text.indexOf('CONTINUE') !== -1 || text.indexOf('GET LINK') !== -1) {
                // Only click if it's visible and enabled
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                if (el.disabled) continue;
                logWithUI('🔘 Auto-clicking', (el.innerText || '').trim().substring(0, 30), '#FFA726');
                const ev = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                el.dispatchEvent(ev);
                return true;
            }
        }
        return false;
    }

    // ============ MAIN LOOP ============
    let scheduled = false;
    function runOnce() {
        const removed = removeGateOverlay();
        const enabled = forceEnableGetLink();
        const timers= killCountdown();

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
        logWithUI('🚀 Timer-Skip Gate loaded', 'Ready', '#4FC3F7');
    }

    initUI();

    setTimeout(runOnce, 800);
    setTimeout(runOnce, 2000);
    setTimeout(runOnce, 4000);
    setTimeout(runOnce, 7000);
    setTimeout(runOnce, 11000);

    if (document.body) {
        const mo = new MutationObserver(function() { scheduleRun(); });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    console.log('=== Timer-Skip Gate loaded ===');
})();
