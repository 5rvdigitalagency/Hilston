/* Hilston Park  --  script.js */
document.addEventListener("DOMContentLoaded", function () {

  /* ---- Accordion ---- */
  var items = document.querySelectorAll(".accordion-item");
  items.forEach(function (item) {
    var btn = item.querySelector(".accordion-btn");
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      items.forEach(function (i) { i.classList.remove("open"); });
      if (!isOpen) { item.classList.add("open"); }
    });
  });

  /* ---- Mobile nav toggle (hamburger placeholder) ---- */
  /* Nav wraps on small screens via CSS flex-wrap; no JS needed */

  /* =========================================================
     BOOKING MODAL
     Property: Hilston Park  |  QBook ID: 51665
     ========================================================= */
  var QBOOK_BASE = "https://web-bookings.hotels.uk.com/#/booking/51665/items/availability";
  var QBOOK_RATES_SRC = "https://cdn.hotels.uk.com/sc/51665/eff381e2425e310943f59d71f160fa71/0/4";
  var QBOOK_RATES_ID  = "QBOOKWIDGET_SC_BLOCKS_95cf3bb7f6e7ebf393fbcde248157d51";

  /* -- inject modal HTML once -- */
  var today = new Date().toISOString().split("T")[0];
  var modalHTML = [
    '<div id="booking-modal" class="bkm-overlay" role="dialog" aria-modal="true" aria-labelledby="bkm-heading">',
      '<div class="bkm-panel" id="bkm-panel">',

        '<!-- Phase 1: Estate image panel -->',
        '<div class="bkm-brand">',
          '<div class="bkm-brand-bg"></div>',
          '<div class="bkm-brand-grad"></div>',
          '<div class="bkm-brand-inner">',
            '<img src="Logo/Hilston_Park_Logo_White.png" alt="Hilston Park" class="bkm-logo">',
            '<h2 class="bkm-brand-heading" id="bkm-heading">Book Your<span class="bkm-brand-script">Stay</span></h2>',
          '</div>',
          '<address class="bkm-brand-address">Newcastle &middot; Monmouth &middot; Wales</address>',
        '</div>',

        '<!-- Phase 1: Date picker form -->',
        '<div class="bkm-form" id="bkm-form-panel">',
          '<button class="bkm-close" id="bkm-close-btn" aria-label="Close">&times;</button>',
          '<p class="bkm-form-title">Plan your visit</p>',
          '<p class="bkm-form-sub">Select your arrival and departure dates, then check live availability &mdash; without leaving this page.</p>',
          '<div class="bkm-fields">',
            '<div class="bkm-field">',
              '<label for="bkm-checkin">Arrival</label>',
              '<input type="date" id="bkm-checkin" min="' + today + '">',
            '</div>',
            '<div class="bkm-field">',
              '<label for="bkm-checkout">Departure</label>',
              '<input type="date" id="bkm-checkout" min="' + today + '">',
            '</div>',
          '</div>',
          '<p class="bkm-error" id="bkm-error">Please select a valid arrival and departure date.</p>',
          '<hr class="bkm-sep">',
          '<button class="bkm-btn" id="bkm-submit">Check Availability</button>',
          '<p class="bkm-note">Secure booking powered by QBook &mdash; all availability and payment handled on this site.</p>',
        '</div>',

        '<!-- Phase 2: Full booking widget (hidden until submit) -->',
        '<div class="bkm-widget-panel" id="bkm-widget-panel">',
          '<div class="bkm-widget-header">',
            '<button class="bkm-back-btn" id="bkm-back-btn">&#8592; Back</button>',
            '<img src="Logo/Hilston_Park_Logo_White.png" alt="Hilston Park" class="bkm-widget-logo">',
            '<span class="bkm-widget-title">Availability &amp; Booking</span>',
            '<button class="bkm-widget-close" id="bkm-widget-close">&times;</button>',
          '</div>',
          '<div class="bkm-widget-accent"></div>',
          '<iframe id="bkm-booking-iframe" class="bkm-booking-iframe" src="about:blank" allowtransparency="1" frameborder="0" title="Hilston Park Booking"></iframe>',
        '</div>',

      '</div>',
    '</div>'
  ].join("");

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  /* -- resize the rates iframe via postMessage from QBook -- */
  window.addEventListener("message", function (e) {
    var frame = document.getElementById(QBOOK_RATES_ID);
    if (frame && frame.contentWindow === e.source) {
      var h = (e.data && e.data.qbookheight) ? e.data.qbookheight + "px" : null;
      if (h) { frame.height = h; frame.style.height = h; }
    }
  });

  var modal      = document.getElementById("booking-modal");
  var panel      = document.getElementById("bkm-panel");
  var closeBtn   = document.getElementById("bkm-close-btn");
  var submitBtn  = document.getElementById("bkm-submit");
  var backBtn    = document.getElementById("bkm-back-btn");
  var widgetClose = document.getElementById("bkm-widget-close");
  var inEl       = document.getElementById("bkm-checkin");
  var outEl      = document.getElementById("bkm-checkout");
  var errEl      = document.getElementById("bkm-error");
  var bookIframe = document.getElementById("bkm-booking-iframe");

  function openModal() {
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    inEl.focus();
  }
  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    /* reset back to picker phase and unload iframe */
    panel.classList.remove("bkm-widget-active");
    bookIframe.src = "about:blank";
  }
  function showWidget() {
    panel.classList.add("bkm-widget-active");
    bookIframe.src = QBOOK_RATES_SRC;
  }
  function showPicker() {
    panel.classList.remove("bkm-widget-active");
    bookIframe.src = "about:blank";
  }

  /* -- ensure checkout >= checkin + 1 day -- */
  inEl.addEventListener("change", function () {
    if (inEl.value) {
      var next = new Date(inEl.value);
      next.setDate(next.getDate() + 1);
      outEl.min = next.toISOString().split("T")[0];
      if (outEl.value && outEl.value <= inEl.value) { outEl.value = ""; }
    }
  });

  /* -- submit: validate then show booking widget in-modal -- */
  submitBtn.addEventListener("click", function () {
    errEl.classList.remove("visible");
    /* only validate if at least one date is filled */
    if ((inEl.value || outEl.value) && (!inEl.value || !outEl.value || outEl.value <= inEl.value)) {
      errEl.classList.add("visible");
      return;
    }
    showWidget();
  });

  /* -- back/close on widget phase -- */
  backBtn.addEventListener("click", showPicker);
  widgetClose.addEventListener("click", closeModal);

  /* -- close behaviours -- */
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { closeModal(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) { closeModal(); }
  });

  /* -- intercept ALL Book Now buttons/links across every page -- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest(".btn-book, .btn-pill, [data-book]");
    if (!el) { return; }
    /* skip links that point somewhere real (contact anchor, etc.) */
    var href = el.getAttribute("href") || "";
    if (href && href !== "#" && !href.startsWith("#booking")) { return; }
    e.preventDefault();
    openModal();
  });

});
