/* Hilston Park — accessibility.js
   Accessibility toolbar: font size, colour invert, colourblind modes.
   Skip-to-main link. localStorage persistence across all pages.
   Applied immediately to prevent flash of un-transformed content.
*/

(function () {
  'use strict';

  /* =====================================================
     CONSTANTS
     ===================================================== */
  var FONT_STEP    = 2;
  var FONT_MIN     = 12;
  var FONT_MAX     = 28;
  var FONT_DEFAULT = 16;

  var LS = {
    fontSize : 'a11y_fontSize',
    invert   : 'a11y_invert',
    cbMode   : 'a11y_cbMode'
  };

  var CB_MODES = ['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia'];

  /* =====================================================
     RESTORE PREFERENCES IMMEDIATELY (before DOM ready)
     Avoids flash of un-transformed text on page load.
     ===================================================== */
  (function restoreEarly() {
    try {
      var savedSize = parseInt(localStorage.getItem(LS.fontSize), 10);
      if (savedSize && savedSize !== FONT_DEFAULT) {
        document.documentElement.style.fontSize = savedSize + 'px';
      }
      if (localStorage.getItem(LS.invert) === '1') {
        document.documentElement.classList.add('a11y-invert');
      }
      var savedCB = localStorage.getItem(LS.cbMode);
      if (savedCB && savedCB !== 'none') {
        document.documentElement.classList.add('a11y-' + savedCB);
      }
    } catch (e) { /* localStorage may be blocked in private browsing */ }
  })();

  /* =====================================================
     SVG COLOUR-BLIND FILTER DEFINITIONS
     Matrix values based on established colour vision research
     (Brettel, Vienot & Mollon / Machado et al.).
     ===================================================== */
  var SVG_FILTERS = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" '
    + 'style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;">'
    + '<defs>'

    /* Deuteranopia — green-cone deficiency (most common form of red-green colour blindness) */
    + '<filter id="a11y-deuteranopia-filter" color-interpolation-filters="linearRGB">'
    + '<feColorMatrix type="matrix" values="'
    +   '0.625 0.375 0     0 0 '
    +   '0.700 0.300 0     0 0 '
    +   '0     0.300 0.700 0 0 '
    +   '0     0     0     1 0"/>'
    + '</filter>'

    /* Protanopia — red-cone deficiency */
    + '<filter id="a11y-protanopia-filter" color-interpolation-filters="linearRGB">'
    + '<feColorMatrix type="matrix" values="'
    +   '0.567 0.433 0     0 0 '
    +   '0.558 0.442 0     0 0 '
    +   '0     0.242 0.758 0 0 '
    +   '0     0     0     1 0"/>'
    + '</filter>'

    /* Tritanopia — blue-cone deficiency (blue-yellow colour blindness) */
    + '<filter id="a11y-tritanopia-filter" color-interpolation-filters="linearRGB">'
    + '<feColorMatrix type="matrix" values="'
    +   '0.950 0.050 0     0 0 '
    +   '0     0.433 0.567 0 0 '
    +   '0     0.475 0.525 0 0 '
    +   '0     0     0     1 0"/>'
    + '</filter>'

    /* Achromatopsia — complete colour blindness (monochrome vision) */
    + '<filter id="a11y-achromatopsia-filter" color-interpolation-filters="linearRGB">'
    + '<feColorMatrix type="matrix" values="'
    +   '0.299 0.587 0.114 0 0 '
    +   '0.299 0.587 0.114 0 0 '
    +   '0.299 0.587 0.114 0 0 '
    +   '0     0     0     1 0"/>'
    + '</filter>'

    + '</defs></svg>';

  /* =====================================================
     TOOLBAR HTML
     ===================================================== */
  var TOOLBAR_HTML = [
    '<div class="a11y-fab" id="a11y-fab" role="region" aria-label="Accessibility options">',

      /* ---- Expanding panel (hidden by default) ---- */
      '<div class="a11y-panel" id="a11y-panel" aria-hidden="true" role="dialog" aria-labelledby="a11y-panel-title">',

        '<div class="a11y-panel-header">',
          '<span class="a11y-panel-title" id="a11y-panel-title">Accessibility</span>',
          '<button class="a11y-panel-close" id="a11y-panel-close" aria-label="Close accessibility panel">&times;</button>',
        '</div>',

        /* Text size */
        '<div class="a11y-section">',
          '<span class="a11y-section-label" id="a11y-font-label-heading">Text Size</span>',
          '<div class="a11y-font-row">',
            '<button class="a11y-font-btn" id="a11y-font-dec" aria-label="Decrease text size" aria-describedby="a11y-font-label-heading">A&#8722;</button>',
            '<span class="a11y-font-size-label" id="a11y-font-label" aria-live="polite" aria-atomic="true">Default</span>',
            '<button class="a11y-font-btn" id="a11y-font-inc" aria-label="Increase text size" aria-describedby="a11y-font-label-heading">A+</button>',
          '</div>',
          '<button class="a11y-font-reset" id="a11y-font-reset" aria-label="Reset text size to default">Reset to default size</button>',
        '</div>',

        '<hr class="a11y-divider">',

        /* Colour invert */
        '<div class="a11y-section">',
          '<div class="a11y-toggle-row">',
            '<label class="a11y-toggle-label" for="a11y-invert-chk">Invert colours</label>',
            '<label class="a11y-switch">',
              '<input type="checkbox" id="a11y-invert-chk" role="switch" aria-checked="false">',
              '<span class="a11y-switch-slider"></span>',
            '</label>',
          '</div>',
        '</div>',

        '<hr class="a11y-divider">',

        /* Colour vision modes */
        '<div class="a11y-section">',
          '<span class="a11y-section-label" id="a11y-cb-label">Colour Vision</span>',
          '<button class="a11y-cb-none active" id="a11y-cb-none" data-mode="none" aria-pressed="true" aria-label="No colour filter \u2014 normal vision (currently active)">',
            '<span aria-hidden="true">&#10003; </span>No colour filter \u2014 normal vision',
          '</button>',
          '<div class="a11y-cb-grid" role="group" aria-labelledby="a11y-cb-label">',
            '<button class="a11y-cb-btn" data-mode="deuteranopia" aria-pressed="false" aria-label="Deuteranopia red-green colour blindness simulation">Deuteranopia <small>red-green</small></button>',
            '<button class="a11y-cb-btn" data-mode="protanopia" aria-pressed="false" aria-label="Protanopia red deficiency colour blindness simulation">Protanopia <small>red deficiency</small></button>',
            '<button class="a11y-cb-btn" data-mode="tritanopia" aria-pressed="false" aria-label="Tritanopia blue-yellow colour blindness simulation">Tritanopia <small>blue-yellow</small></button>',
            '<button class="a11y-cb-btn" data-mode="achromatopsia" aria-pressed="false" aria-label="Achromatopsia monochrome colour blindness simulation">Achromatopsia <small>monochrome</small></button>',
          '</div>',
        '</div>',

        '<hr class="a11y-divider">',

        '<button class="a11y-reset-all" id="a11y-reset-all" aria-label="Reset all settings to accessibility defaults"><span aria-hidden="true">&#8635; </span>Reset all settings</button>',

      '</div>',
      /* ---- Trigger button ---- */
      '<button class="a11y-toggle" id="a11y-toggle-btn"',
        ' aria-expanded="false"',
        ' aria-controls="a11y-panel"',
        ' aria-label="Open accessibility options"',
        ' title="Accessibility">',
        /* Universal Access / person icon */
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">',
          '<circle cx="12" cy="3.5" r="1.8"/>',
          '<path d="M18.5 8.5h-5.28l-.6-1.6H8a.9.9 0 000 1.8h3.18l.6 1.6H7.1a.9.9 0 00-.86 1.18l1.9 5.7a.9.9 0 00.86.62h.16l-.62 3.2a.9.9 0 001.76.36L11.25 18h1.5l.95 3.36a.9.9 0 001.76-.36l-.62-3.2h.16a.9.9 0 00.86-.62l1.9-5.7a.9.9 0 00-.86-1.18h-3.18l-.3-.8h5.08a.9.9 0 000-1.8z"/>',
        '</svg>',
      '</button>',

    '</div>'
  ].join('');

  /* =====================================================
     STATE
     ===================================================== */
  var currentFontSize;
  try {
    currentFontSize = parseInt(localStorage.getItem(LS.fontSize), 10) || FONT_DEFAULT;
  } catch(e) {
    currentFontSize = FONT_DEFAULT;
  }

  /* =====================================================
     HELPERS
     ===================================================== */
  function applyFontSize(size) {
    currentFontSize = size;
    if (size === FONT_DEFAULT) {
      document.documentElement.style.fontSize = '';
    } else {
      document.documentElement.style.fontSize = size + 'px';
    }
    try { localStorage.setItem(LS.fontSize, size); } catch(e) {}
    var label = document.getElementById('a11y-font-label');
    if (label) {
      label.textContent = (size === FONT_DEFAULT) ? 'Default' : size + 'px';
    }
    var decBtn = document.getElementById('a11y-font-dec');
    var incBtn = document.getElementById('a11y-font-inc');
    if (decBtn) decBtn.disabled = (size <= FONT_MIN);
    if (incBtn) incBtn.disabled = (size >= FONT_MAX);
    /* Show/hide the individual font reset link */
    var fontReset = document.getElementById('a11y-font-reset');
    if (fontReset) {
      fontReset.classList.toggle('is-visible', size !== FONT_DEFAULT);
    }
  }

  function applyInvert(on) {
    var html = document.documentElement;
    if (on) {
      html.classList.add('a11y-invert');
    } else {
      html.classList.remove('a11y-invert');
    }
    try { localStorage.setItem(LS.invert, on ? '1' : '0'); } catch(e) {}
    var chk = document.getElementById('a11y-invert-chk');
    if (chk) {
      chk.checked = on;
      chk.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  function applyColorblind(mode) {
    var html = document.documentElement;
    CB_MODES.forEach(function (m) { html.classList.remove('a11y-' + m); });
    if (mode && mode !== 'none') {
      html.classList.add('a11y-' + mode);
    }
    try { localStorage.setItem(LS.cbMode, mode); } catch(e) {}

    /* Update the "No filter" button */
    var noneBtn = document.getElementById('a11y-cb-none');
    if (noneBtn) {
      var isNone = (!mode || mode === 'none');
      noneBtn.classList.toggle('active', isNone);
      noneBtn.setAttribute('aria-pressed', isNone ? 'true' : 'false');
      noneBtn.setAttribute('aria-label', isNone
        ? 'No colour filter \u2014 normal vision (currently active)'
        : 'Remove colour filter and return to normal vision');
      noneBtn.innerHTML = isNone
        ? '<span aria-hidden="true">&#10003; </span>No colour filter \u2014 normal vision'
        : '<span aria-hidden="true">&#8592; </span>Remove filter \u2014 return to normal';
    }

    /* Update the mode buttons */
    document.querySelectorAll('.a11y-cb-btn').forEach(function (btn) {
      var m = btn.getAttribute('data-mode');
      var isActive = (m === mode);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        btn.setAttribute('aria-label', 'Currently active: ' + btn.textContent.trim() + ' \u2014 click to remove this filter');
      } else {
        btn.setAttribute('aria-label', btn.textContent.trim() + ' colour vision simulation');
      }
    });
  }

  function resetAll() {
    applyFontSize(FONT_DEFAULT);
    applyInvert(false);
    applyColorblind('none');
    try {
      localStorage.removeItem(LS.fontSize);
      localStorage.removeItem(LS.invert);
      localStorage.removeItem(LS.cbMode);
    } catch(e) {}
  }

  function openPanel() {
    var panel     = document.getElementById('a11y-panel');
    var toggleBtn = document.getElementById('a11y-toggle-btn');
    if (!panel || !toggleBtn) return;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Close accessibility options');
    /* Move focus into panel */
    var firstFocusable = panel.querySelector('button, input, [tabindex]');
    if (firstFocusable) firstFocusable.focus();
  }

  function closePanel() {
    var panel     = document.getElementById('a11y-panel');
    var toggleBtn = document.getElementById('a11y-toggle-btn');
    if (!panel || !toggleBtn) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Open accessibility options');
    toggleBtn.focus();
  }

  /* =====================================================
     DOM READY — inject UI & wire events
     ===================================================== */
  document.addEventListener('DOMContentLoaded', function () {

    /* 1. Wrap all existing body content in #a11y-page-wrap.
          The CSS colour/invert filters are applied to this wrapper (not body)
          so that position:fixed elements that are siblings of the wrapper
          (the FAB, below) are NOT inside the filtered subtree and keep
          correct viewport-relative positioning. */
    var pageWrap = document.createElement('div');
    pageWrap.id = 'a11y-page-wrap';
    while (document.body.firstChild) {
      pageWrap.appendChild(document.body.firstChild);
    }
    document.body.appendChild(pageWrap);

    /* 2. Inject SVG filter definitions into body, before the wrap */
    var filterContainer = document.createElement('div');
    filterContainer.innerHTML = SVG_FILTERS;
    document.body.insertBefore(filterContainer.firstChild, pageWrap);

    /* 3. Inject skip-to-main link into body, before the wrap (first in tab order) */
    var skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    document.body.insertBefore(skipLink, pageWrap);

    /* 4. Inject toolbar into body AFTER the wrap (outside filtered subtree) */
    document.body.insertAdjacentHTML('beforeend', TOOLBAR_HTML);

    /* 5. Sync UI to restored preferences */
    applyFontSize(currentFontSize);

    var savedInvert = false;
    try { savedInvert = localStorage.getItem(LS.invert) === '1'; } catch(e) {}
    applyInvert(savedInvert);

    var savedCB = 'none';
    try { savedCB = localStorage.getItem(LS.cbMode) || 'none'; } catch(e) {}
    applyColorblind(savedCB);

    /* 6. Toggle button */
    var toggleBtn = document.getElementById('a11y-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var panel = document.getElementById('a11y-panel');
        if (panel && panel.classList.contains('is-open')) {
          closePanel();
        } else {
          openPanel();
        }
      });
    }

    /* Close button inside panel */
    var panelCloseBtn = document.getElementById('a11y-panel-close');
    if (panelCloseBtn) {
      panelCloseBtn.addEventListener('click', function () { closePanel(); });
    }

    /* Close on Escape key */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var panel = document.getElementById('a11y-panel');
        if (panel && panel.classList.contains('is-open')) {
          closePanel();
        }
      }
    });

    /* Close when clicking outside the fab */
    document.addEventListener('click', function (e) {
      var fab   = document.getElementById('a11y-fab');
      var panel = document.getElementById('a11y-panel');
      if (fab && panel && panel.classList.contains('is-open') && !fab.contains(e.target)) {
        closePanel();
      }
    });

    /* 7. Font size buttons */
    var decBtn = document.getElementById('a11y-font-dec');
    var incBtn = document.getElementById('a11y-font-inc');
    if (decBtn) {
      decBtn.addEventListener('click', function () {
        applyFontSize(Math.max(FONT_MIN, currentFontSize - FONT_STEP));
      });
    }
    if (incBtn) {
      incBtn.addEventListener('click', function () {
        applyFontSize(Math.min(FONT_MAX, currentFontSize + FONT_STEP));
      });
    }

    /* 8. Invert switch */
    var invertChk = document.getElementById('a11y-invert-chk');
    if (invertChk) {
      invertChk.addEventListener('change', function () {
        applyInvert(invertChk.checked);
      });
    }

    /* 9. Colour-blind mode buttons — clicking active button removes the filter */
    document.querySelectorAll('.a11y-cb-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var clickedMode = btn.getAttribute('data-mode');
        /* If this mode is already active, clicking it again removes it */
        if (btn.classList.contains('active') && clickedMode !== 'none') {
          applyColorblind('none');
        } else {
          applyColorblind(clickedMode);
        }
      });
    });

    /* "No filter" button */
    var noneBtn = document.getElementById('a11y-cb-none');
    if (noneBtn) {
      noneBtn.addEventListener('click', function () {
        applyColorblind('none');
      });
    }

    /* Font reset */
    var fontResetBtn = document.getElementById('a11y-font-reset');
    if (fontResetBtn) {
      fontResetBtn.addEventListener('click', function () {
        applyFontSize(FONT_DEFAULT);
      });
    }

    /* 10. Reset all */
    var resetBtn = document.getElementById('a11y-reset-all');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () { resetAll(); });
    }

  }); /* end DOMContentLoaded */

})();
