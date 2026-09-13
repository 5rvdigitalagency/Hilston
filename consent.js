/**
 * consent.js — Hilston Park Cookie Consent Manager
 *
 * MUST load synchronously (no async/defer) BEFORE the Google Tag Manager
 * script so that Consent Mode v2 defaults are pushed to dataLayer before
 * GTM initialises. Any tags inside GTM that depend on analytics_storage,
 * ad_storage, etc. will wait until the user grants consent.
 *
 * Public API:  window.hilstonConsent.open()  — open preference centre
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hp_consent_v1';

  /* ── 1. Consent Mode v2 defaults (all denied) ──────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (!window.gtag) { window.gtag = gtag; }

  gtag('consent', 'default', {
    analytics_storage:       'denied',
    ad_storage:              'denied',
    ad_user_data:            'denied',
    ad_personalization:      'denied',
    functionality_storage:   'denied',
    personalization_storage: 'denied',
    security_storage:        'granted',
    wait_for_update:         500
  });

  /* ── 2. Storage helpers ────────────────────────────────────────────────── */
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) {}
    applyConsent(prefs);
    if (prefs.analytics && window.hilstonLoadGTM) {
      window.hilstonLoadGTM();
    }
  }

  function applyConsent(prefs) {
    gtag('consent', 'update', {
      analytics_storage:       prefs.analytics ? 'granted' : 'denied',
      ad_storage:              prefs.marketing  ? 'granted' : 'denied',
      ad_user_data:            prefs.marketing  ? 'granted' : 'denied',
      ad_personalization:      prefs.marketing  ? 'granted' : 'denied',
      functionality_storage:   prefs.functional ? 'granted' : 'denied',
      personalization_storage: prefs.functional ? 'granted' : 'denied',
      security_storage:        'granted'
    });
  }

  /* Apply saved preferences immediately — before GTM script runs */
  var saved = getPrefs();
  if (saved) { applyConsent(saved); }

  /* ── 3. UI injection ───────────────────────────────────────────────────── */
  function injectUI() {
    var cookieButton = document.getElementById('hp-cookie-reopen');
    if (!cookieButton) {
      cookieButton = document.createElement('button');
      cookieButton.id = 'hp-cookie-reopen';
      cookieButton.className = 'hp-cookie-reopen';
      cookieButton.type = 'button';
      cookieButton.setAttribute('aria-label', 'Manage cookie preferences');
      cookieButton.setAttribute('title', 'Manage cookie preferences');
      cookieButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="28" height="28"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="8.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="13.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="14.5" r="0.8" fill="currentColor" stroke="none"/></svg>';
      document.body.appendChild(cookieButton);
    }
    cookieButton.addEventListener('click', function (event) {
      event.preventDefault();
      openModal();
    });
    if (!getPrefs()) { injectBanner(); }
  }

  /* Bottom consent banner */
  function injectBanner() {
    if (document.getElementById('hp-cookie-banner')) { return; }
    var el = document.createElement('div');
    el.id = 'hp-cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<div class="hpcc-inner">' +
        '<div class="hpcc-text">' +
          '<strong>We use cookies</strong>' +
          '<p>We use cookies to personalise content, analyse site traffic, and support our marketing. ' +
          'You can accept all, decline non-essential cookies, or manage your preferences.</p>' +
        '</div>' +
        '<div class="hpcc-actions">' +
          '<button class="hpcc-btn hpcc-manage" id="hp-cc-manage">Manage Preferences</button>' +
          '<button class="hpcc-btn hpcc-decline" id="hp-cc-decline">Decline All</button>' +
          '<button class="hpcc-btn hpcc-accept" id="hp-cc-accept">Accept All</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('hpcc-show'); });
    });
    document.getElementById('hp-cc-accept').addEventListener('click', acceptAll);
    document.getElementById('hp-cc-decline').addEventListener('click', declineAll);
    document.getElementById('hp-cc-manage').addEventListener('click', function () { openModal(); });
  }

  function closeBanner() {
    var b = document.getElementById('hp-cookie-banner');
    if (b) {
      b.classList.remove('hpcc-show');
      setTimeout(function () { if (b.parentNode) { b.parentNode.removeChild(b); } }, 350);
    }
  }

  function acceptAll() {
    savePrefs({ analytics: true, marketing: true, functional: true });
    closeBanner();
    closeModal();
  }

  function declineAll() {
    savePrefs({ analytics: false, marketing: false, functional: false });
    closeBanner();
    closeModal();
  }

  /* ── 4. Preference centre modal ────────────────────────────────────────── */
  function openModal() {
    if (document.getElementById('hp-cookie-modal')) { return; }
    closeBanner();
    var p = getPrefs() || { analytics: false, marketing: false, functional: false };

    var el = document.createElement('div');
    el.id = 'hp-cookie-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Cookie preference centre');

    el.innerHTML =
      '<div class="hpcm-overlay" id="hp-cm-overlay"></div>' +
      '<div class="hpcm-panel">' +
        '<button class="hpcm-close" id="hp-cm-close" aria-label="Close">\u00d7</button>' +
        '<h2>Cookie Preferences</h2>' +
        '<p class="hpcm-intro">Choose which cookies you allow. You can update these at any time ' +
        'by clicking the cookie icon at the bottom-left of every page.</p>' +

        '<div class="hpcm-cat">' +
          '<div class="hpcm-cat-hd">' +
            '<div class="hpcm-cat-info">' +
              '<strong>Essential Cookies</strong>' +
              '<p>Required for the website to function correctly. Cannot be disabled.</p>' +
            '</div>' +
            '<span class="hpcm-always">Always on</span>' +
          '</div>' +
        '</div>' +

        '<div class="hpcm-cat">' +
          '<div class="hpcm-cat-hd">' +
            '<div class="hpcm-cat-info">' +
              '<strong>Analytics Cookies</strong>' +
              '<p>Help us understand how visitors interact with our site (e.g. Google Analytics).</p>' +
            '</div>' +
            '<label class="hpcm-toggle" for="hp-pref-analytics">' +
              '<input type="checkbox" id="hp-pref-analytics" aria-label="Enable analytics cookies"' + (p.analytics ? ' checked' : '') + '>' +
              '<span class="hpcm-slider" aria-hidden="true"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div class="hpcm-cat">' +
          '<div class="hpcm-cat-hd">' +
            '<div class="hpcm-cat-info">' +
              '<strong>Marketing &amp; Advertising Cookies</strong>' +
              '<p>Allow us to personalise content and measure campaign effectiveness ' +
              '(e.g. Meta Pixel, Microsoft Clarity).</p>' +
            '</div>' +
            '<label class="hpcm-toggle" for="hp-pref-marketing">' +
              '<input type="checkbox" id="hp-pref-marketing" aria-label="Enable marketing and advertising cookies"' + (p.marketing ? ' checked' : '') + '>' +
              '<span class="hpcm-slider" aria-hidden="true"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div class="hpcm-cat">' +
          '<div class="hpcm-cat-hd">' +
            '<div class="hpcm-cat-info">' +
              '<strong>Functional Cookies</strong>' +
              '<p>Enable enhanced features such as live chat and personalised content.</p>' +
            '</div>' +
            '<label class="hpcm-toggle" for="hp-pref-functional">' +
              '<input type="checkbox" id="hp-pref-functional" aria-label="Enable functional cookies"' + (p.functional ? ' checked' : '') + '>' +
              '<span class="hpcm-slider" aria-hidden="true"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div class="hpcm-foot">' +
          '<button class="hpcc-btn hpcc-decline" id="hp-cm-decline-btn">Decline All</button>' +
          '<button class="hpcc-btn hpcc-save"    id="hp-cm-save-btn">Save Preferences</button>' +
          '<button class="hpcc-btn hpcc-accept"  id="hp-cm-accept-btn">Accept All</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('hpcm-show'); });
    });

    document.getElementById('hp-cm-close').addEventListener('click', closeModal);
    document.getElementById('hp-cm-overlay').addEventListener('click', closeModal);
    document.getElementById('hp-cm-decline-btn').addEventListener('click', declineAll);
    document.getElementById('hp-cm-accept-btn').addEventListener('click', acceptAll);
    document.getElementById('hp-cm-save-btn').addEventListener('click', function () {
      savePrefs({
        analytics: document.getElementById('hp-pref-analytics').checked,
        marketing:  document.getElementById('hp-pref-marketing').checked,
        functional: document.getElementById('hp-pref-functional').checked
      });
      closeBanner();
      closeModal();
    });

    var focusable = el.querySelectorAll('button, input');
    if (focusable[0]) { focusable[0].focus(); }
    document.addEventListener('keydown', handleEsc);
  }

  function closeModal() {
    var m = document.getElementById('hp-cookie-modal');
    if (m) {
      m.classList.remove('hpcm-show');
      setTimeout(function () { if (m.parentNode) { m.parentNode.removeChild(m); } }, 350);
    }
    document.removeEventListener('keydown', handleEsc);
  }

  function handleEsc(e) {
    if (e.key === 'Escape') { closeModal(); }
  }

  /* ── 5. Public API ─────────────────────────────────────────────────────── */
  window.hilstonConsent = { open: openModal };

  /* ── 6. Boot ───────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

}());
