/* Hilston Park  --  script.js */
document.addEventListener("DOMContentLoaded", function () {

  /* ---- Accordion ---- */
  var SVG_DOWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="acc-svg"><path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
  var SVG_UP   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="acc-svg"><path fill-rule="evenodd" d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd" /></svg>';

  var items = document.querySelectorAll(".accordion-item");
  items.forEach(function (item) {
    var btn  = item.querySelector(".accordion-btn");
    var iconR = item.querySelector(".acc-icon");
    var iconL = item.querySelector(".acc-icon-l");
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      items.forEach(function (i) {
        i.classList.remove("open");
        var ir = i.querySelector(".acc-icon");
        var il = i.querySelector(".acc-icon-l");
        if (ir) ir.innerHTML = SVG_DOWN;
        if (il) il.innerHTML = SVG_DOWN;
      });
      if (!isOpen) {
        item.classList.add("open");
        if (iconR) iconR.innerHTML = SVG_UP;
        if (iconL) iconL.innerHTML = SVG_UP;
      }
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
          '<div class="bkm-weather" id="bkm-weather">',
            '<span class="bkm-weather-icon" id="bkm-weather-icon"></span>',
            '<div class="bkm-weather-info">',
              '<span class="bkm-weather-temp" id="bkm-weather-temp"></span>',
              '<span class="bkm-weather-desc" id="bkm-weather-desc">&#8212;</span>',
            '</div>',
          '</div>',
        '</div>',

        '<!-- Phase 1: Calendar date picker -->',
        '<div class="bkm-form" id="bkm-form-panel">',
          '<button class="bkm-close" id="bkm-close-btn" aria-label="Close">&times;</button>',
          '<p class="bkm-form-title">Plan your visit</p>',
          '<!-- selected dates summary row -->',
          '<div class="bkm-date-summary" id="bkm-date-summary">',
            '<div class="bkm-date-chip" id="bkm-chip-in">',
              '<span class="bkm-chip-label">Arrival</span>',
              '<span class="bkm-chip-value" id="bkm-chip-in-val">Select date</span>',
            '</div>',
            '<div class="bkm-date-chip-arrow">&#8594;</div>',
            '<div class="bkm-date-chip" id="bkm-chip-out">',
              '<span class="bkm-chip-label">Departure</span>',
              '<span class="bkm-chip-value" id="bkm-chip-out-val">Select date</span>',
            '</div>',
          '</div>',
          '<!-- calendar grid -->',
          '<div class="bkm-cal" id="bkm-cal">',
            '<div class="bkm-cal-nav">',
              '<button class="bkm-cal-prev" id="bkm-cal-prev" aria-label="Previous month">&#8249;</button>',
              '<span class="bkm-cal-month" id="bkm-cal-month"></span>',
              '<button class="bkm-cal-next" id="bkm-cal-next" aria-label="Next month">&#8250;</button>',
            '</div>',
            '<div class="bkm-cal-dow">',
              '<span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>',
            '</div>',
            '<div class="bkm-cal-grid" id="bkm-cal-grid"></div>',
          '</div>',
          '<p class="bkm-error" id="bkm-error">Please select both an arrival and departure date.</p>',
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

  /* ---- Calendar picker logic ---- */
  var calPickIn  = null; /* Date object */
  var calPickOut = null;
  var calStep    = "in"; /* "in" | "out" */
  var calView    = new Date(); /* first day of displayed month */
  calView.setDate(1);

  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var todayD = new Date(); todayD.setHours(0,0,0,0);

  function fmtDate(d) {
    if (!d) { return "Select date"; }
    return d.getDate() + " " + MONTHS[d.getMonth()].slice(0,3) + " " + d.getFullYear();
  }
  function sameDay(a, b) {
    return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }
  function between(d, a, b) {
    if (!a || !b) { return false; }
    return d > a && d < b;
  }

  function renderCalendar() {
    var grid  = document.getElementById("bkm-cal-grid");
    var label = document.getElementById("bkm-cal-month");
    if (!grid || !label) { return; }

    label.textContent = MONTHS[calView.getMonth()] + " " + calView.getFullYear();

    var year  = calView.getFullYear();
    var month = calView.getMonth();
    var first = new Date(year, month, 1).getDay(); /* 0=Sun */
    var days  = new Date(year, month + 1, 0).getDate();

    var html = "";
    /* empty cells before first day */
    for (var i = 0; i < first; i++) {
      html += '<span class="bkm-day bkm-day-empty"></span>';
    }
    for (var d = 1; d <= days; d++) {
      var dt = new Date(year, month, d);
      var iso = year + "-" + ("0"+(month+1)).slice(-2) + "-" + ("0"+d).slice(-2);
      var cls = "bkm-day";
      var past = dt < todayD;
      if (past) {
        cls += " bkm-day-past";
      } else {
        if (sameDay(dt, calPickIn))  { cls += " bkm-day-start"; }
        if (sameDay(dt, calPickOut)) { cls += " bkm-day-end"; }
        if (calPickIn && calPickOut && between(dt, calPickIn, calPickOut)) { cls += " bkm-day-range"; }
        if (sameDay(dt, todayD))     { cls += " bkm-day-today"; }
        /* hover preview: if choosing end, highlight range up to hover */
        cls += " bkm-day-pick";
      }
      html += '<span class="' + cls + '" data-date="' + iso + '">' + d + '</span>';
    }
    grid.innerHTML = html;

    /* update summary chips */
    document.getElementById("bkm-chip-in-val").textContent  = fmtDate(calPickIn);
    document.getElementById("bkm-chip-out-val").textContent = fmtDate(calPickOut);
    /* highlight active chip */
    document.getElementById("bkm-chip-in").classList.toggle("active",  calStep === "in");
    document.getElementById("bkm-chip-out").classList.toggle("active", calStep === "out");
  }

  /* Grid click */
  document.getElementById("bkm-cal-grid").addEventListener("click", function (e) {
    var dayEl = e.target.closest(".bkm-day-pick");
    if (!dayEl) { return; }
    var parts = dayEl.dataset.date.split("-");
    var clicked = new Date(+parts[0], +parts[1]-1, +parts[2]);
    if (calStep === "in") {
      calPickIn  = clicked;
      calPickOut = null;
      calStep = "out";
    } else {
      if (clicked <= calPickIn) {
        /* clicked before start: reset */
        calPickIn  = clicked;
        calPickOut = null;
        calStep = "out";
      } else {
        calPickOut = clicked;
        calStep = "done";
      }
    }
    renderCalendar();
  });

  /* Grid hover — live range preview */
  document.getElementById("bkm-cal-grid").addEventListener("mouseover", function (e) {
    if (calStep !== "out") { return; }
    var dayEl = e.target.closest(".bkm-day-pick");
    if (!dayEl) { return; }
    var parts = dayEl.dataset.date.split("-");
    var hov = new Date(+parts[0], +parts[1]-1, +parts[2]);
    var grid = document.getElementById("bkm-cal-grid");
    Array.prototype.forEach.call(grid.querySelectorAll(".bkm-day-pick"), function (el) {
      var ps = el.dataset.date.split("-");
      var ed = new Date(+ps[0], +ps[1]-1, +ps[2]);
      el.classList.toggle("bkm-day-hover-range", ed > calPickIn && ed < hov);
      el.classList.toggle("bkm-day-hover-end",   ed.getTime() === hov.getTime() && hov > calPickIn);
    });
  });
  document.getElementById("bkm-cal-grid").addEventListener("mouseleave", function () {
    var grid = document.getElementById("bkm-cal-grid");
    Array.prototype.forEach.call(grid.querySelectorAll(".bkm-day-hover-range, .bkm-day-hover-end"), function (el) {
      el.classList.remove("bkm-day-hover-range", "bkm-day-hover-end");
    });
  });

  /* chip clicks to reselect */
  document.getElementById("bkm-chip-in").addEventListener("click", function () {
    calStep = "in"; calPickIn = null; calPickOut = null; renderCalendar();
  });
  document.getElementById("bkm-chip-out").addEventListener("click", function () {
    if (calPickIn) { calStep = "out"; renderCalendar(); }
  });

  /* month nav */
  document.getElementById("bkm-cal-prev").addEventListener("click", function () {
    calView.setMonth(calView.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("bkm-cal-next").addEventListener("click", function () {
    calView.setMonth(calView.getMonth() + 1);
    renderCalendar();
  });

  /* -- live weather at Hilston Park via Open-Meteo (no API key) -- */
  (function fetchWeather() {
    var WMO = {
      0:  ["\u2600", "Clear sky"],
      1:  ["\uD83C\uDF24", "Mostly clear"],
      2:  ["\u26C5", "Partly cloudy"],
      3:  ["\u2601", "Overcast"],
      45: ["\uD83C\uDF2B", "Foggy"],
      48: ["\uD83C\uDF2B", "Foggy"],
      51: ["\uD83C\uDF26", "Light drizzle"],
      53: ["\uD83C\uDF26", "Drizzle"],
      55: ["\uD83C\uDF27", "Heavy drizzle"],
      61: ["\uD83C\uDF27", "Light rain"],
      63: ["\uD83C\uDF27", "Rain"],
      65: ["\uD83C\uDF27", "Heavy rain"],
      71: ["\u2744", "Light snow"],
      73: ["\u2744", "Snow"],
      75: ["\u2744", "Heavy snow"],
      77: ["\u2744", "Snow grains"],
      80: ["\uD83C\uDF27", "Light showers"],
      81: ["\uD83C\uDF27", "Showers"],
      82: ["\uD83C\uDF27", "Heavy showers"],
      85: ["\u2744", "Snow showers"],
      86: ["\u2744", "Heavy snow showers"],
      95: ["\u26C8", "Thunderstorm"],
      96: ["\u26C8", "Thunderstorm"],
      99: ["\u26C8", "Thunderstorm"]
    };
    fetch("https://api.open-meteo.com/v1/forecast?latitude=51.786&longitude=-2.868&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=Europe%2FLondon")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c    = d.current;
        var info = WMO[c.weather_code] || ["\uD83C\uDF21", ""];
        document.getElementById("bkm-weather-icon").textContent = info[0];
        document.getElementById("bkm-weather-temp").textContent = Math.round(c.temperature_2m) + "\xB0C";
        document.getElementById("bkm-weather-desc").textContent = info[1];
      })
      .catch(function () {
        var el = document.getElementById("bkm-weather");
        if (el) { el.style.display = "none"; }
      });
  }());

  /* -- resize the rates iframe via postMessage from QBook -- */
  window.addEventListener("message", function (e) {
    var frame = document.getElementById(QBOOK_RATES_ID);
    if (frame && frame.contentWindow === e.source) {
      var h = (e.data && e.data.qbookheight) ? e.data.qbookheight + "px" : null;
      if (h) { frame.height = h; frame.style.height = h; }
    }
  });

  var modal       = document.getElementById("booking-modal");
  var panel       = document.getElementById("bkm-panel");
  var closeBtn    = document.getElementById("bkm-close-btn");
  var submitBtn   = document.getElementById("bkm-submit");
  var backBtn     = document.getElementById("bkm-back-btn");
  var widgetClose = document.getElementById("bkm-widget-close");
  var errEl       = document.getElementById("bkm-error");
  var bookIframe  = document.getElementById("bkm-booking-iframe");

  function openModal() {
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    renderCalendar();
  }
  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    panel.classList.remove("bkm-widget-active");
    bookIframe.src = "about:blank";
    /* reset calendar */
    calPickIn = null; calPickOut = null; calStep = "in";
    calView = new Date(); calView.setDate(1);
  }
  function showWidget() {
    panel.classList.add("bkm-widget-active");
    bookIframe.src = QBOOK_RATES_SRC;
  }
  function showPicker() {
    panel.classList.remove("bkm-widget-active");
    bookIframe.src = "about:blank";
  }

  /* -- submit: validate then show booking widget in-modal -- */
  submitBtn.addEventListener("click", function () {
    errEl.classList.remove("visible");
    if (!calPickIn || !calPickOut) {
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
