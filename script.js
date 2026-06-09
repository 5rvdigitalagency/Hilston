/* Hilston Park  --  script.js */
document.addEventListener("DOMContentLoaded", function () {

  /* =====================================================
     STICKY HEADER — compact on scroll
     ===================================================== */
  var stickyShell = document.getElementById("site-sticky");
  if (stickyShell) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 60) {
        stickyShell.classList.add("scrolled");
      } else {
        stickyShell.classList.remove("scrolled");
      }
    }, { passive: true });
  }

  /* =====================================================
     MOBILE NAV TOGGLE
     ===================================================== */
  var navToggle  = document.getElementById("nav-toggle");
  var mobileNav  = document.getElementById("mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = mobileNav.classList.contains("is-open");
      if (isOpen) {
        mobileNav.classList.remove("is-open");
        mobileNav.setAttribute("aria-hidden", "true");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.classList.remove("is-open");
        document.body.style.overflow = "";
      } else {
        mobileNav.classList.add("is-open");
        mobileNav.setAttribute("aria-hidden", "false");
        navToggle.setAttribute("aria-expanded", "true");
        navToggle.classList.add("is-open");
        document.body.style.overflow = "hidden";
      }
    });
    /* close on any link click */
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.classList.remove("is-open");
        mobileNav.setAttribute("aria-hidden", "true");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
    /* close on ✕ button */
    var mobileNavClose = document.getElementById("mobile-nav-close");
    if (mobileNavClose) {
      mobileNavClose.addEventListener("click", function () {
        mobileNav.classList.remove("is-open");
        mobileNav.setAttribute("aria-hidden", "true");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    }
    /* close on Escape */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("is-open")) {
        mobileNav.classList.remove("is-open");
        mobileNav.setAttribute("aria-hidden", "true");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.classList.remove("is-open");
        document.body.style.overflow = "";
      }
    });
  }

  /* =====================================================
     ACTIVE NAV LINK
     ===================================================== */
  var currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-list a").forEach(function (link) {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
  });

  /* =====================================================
     SCROLL REVEAL (IntersectionObserver)
     ===================================================== */
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.10, rootMargin: "0px 0px -48px 0px" });

    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    /* fallback: just show everything */
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* =====================================================
     STATS COUNTER ANIMATION
     ===================================================== */
  function animateCounter(el) {
    var target   = parseInt(el.getAttribute("data-target"), 10);
    var duration = 1400;
    var startTs  = null;
    function step(ts) {
      if (!startTs) startTs = ts;
      var elapsed  = ts - startTs;
      var progress = Math.min(elapsed / duration, 1);
      /* ease-out cubic */
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var statsSection = document.querySelector(".stats-bar");
  if (statsSection && "IntersectionObserver" in window) {
    var statsObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          document.querySelectorAll(".stat-num").forEach(animateCounter);
          statsObserver.disconnect();
        }
      });
    }, { threshold: 0.5 });
    statsObserver.observe(statsSection);
  }

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

  /* =========================================================
     BOOKING MODAL
     Property: Hilston Park  |  QBook ID: 51665
     ========================================================= */
  var QBOOK_BASE = "https://web-bookings.hotels.uk.com/#/booking/51665/items/availability";
  /* k= is the property-level auth token Q-Book embeds in all its widget links — required for the SPA to load */
  var QBOOK_K    = "JkS11OXJmyC7NCQPDqJUBbaGYNTE2NjU%3D";
  /* All Item Availability widget — full inventory grid with live prices for all room types */
  var QBOOK_RATES_SRC = "https://widgets.hotels.uk.com/display-rates/51665/eff381e2425e310943f59d71f160fa71";
  var QBOOK_RATES_ID  = "QBOOKWIDGET_RATES_ALLITEMS_202788cc19e79e9d082d25e00f1693f4";
  /* Server-rendered rates widget — CORS-open, server-side rendered HTML with live per-night pricing */
  var SC_RATES_URL = "https://cdn.hotels.uk.com/sc/51665/eff381e2425e310943f59d71f160fa71/0/4";
  /* Inquiry endpoint — Formsubmit relays form data to this email; first submission triggers a confirmation email to activate */
  var INQUIRY_ENDPOINT = "https://api.web3forms.com/submit";
  var INQUIRY_ACCESS_KEY = "d185ded1-269c-4f96-99db-28427596cf0a";

  /* Room definitions — sourced from Q-Book api/pull and accommodation page.
     maxAdults/maxChildren reflect Q-Book item occupancy settings.
     qItemIDs used to pre-filter the Q-Book deep-link URL. */
  /* maxGuests = total guests (adults + children) per Q-Book admin occupancy */
  var ROOM_DEFS = {
    'any':                { label: 'All rooms',                    maxGuests: 0, qItemIDs: [] },
    'cosy-king':          { label: 'Cosy King Room',               maxGuests: 4, qItemIDs: [83040, 83269] },
    'double-garden':      { label: 'Double Garden View',           maxGuests: 2, qItemIDs: [82356] },
    'large-double-garden':{ label: 'Large Double Garden View',     maxGuests: 6, qItemIDs: [82357, 82965] },
    'family-room':        { label: 'Family Room',                  maxGuests: 5, qItemIDs: [83057] },
    'dormitory':          { label: 'Dormitory / Group Bunk Rooms', maxGuests: 0, qItemIDs: [] },
    'exclusive-use':      { label: 'Exclusive Use of House',       maxGuests: 9, qItemIDs: [] }
  };

  /* -- service definitions -- */
  var BKM_SERVICES = {
    stay: {
      label: "Stay with us",
      script: "Stay",
      lead: "Book Your",
      sub: "Self-catered country house and group accommodation. Live availability via QBook.",
      configTitle: "Plan your stay",
      configSub: "Select dates, group size and accommodation type to see live rates.",
      icon: "&#x1F3E1;",
      flow: "book"
    },
    inquire: {
      label: "Enquire about",
      script: "Enquiry",
      lead: "Send an",
      sub: "Events, weddings, corporate days, school trips or anything else &mdash; tell us what you&rsquo;re considering.",
      configTitle: "Send us an enquiry",
      configSub: "Tell us what you&rsquo;re planning. The team responds within one working day.",
      icon: "&#x2709;",
      flow: "inquire"
    }
  };

  /* -- inject modal HTML once -- */
  var today = new Date().toISOString().split("T")[0];
  var modalHTML = [
    '<div id="booking-modal" class="bkm-overlay" role="dialog" aria-modal="true" aria-labelledby="bkm-heading">',
      '<div class="bkm-panel" id="bkm-panel">',

        '<!-- Estate image panel (left, shared across phases) -->',
        '<div class="bkm-brand">',
          '<div class="bkm-brand-bg"></div>',
          '<div class="bkm-brand-grad"></div>',
          '<div class="bkm-brand-inner">',
            '<img src="Logo/Hilston_Park_Logo_White.png" alt="Hilston Park" class="bkm-logo">',
            '<h2 class="bkm-brand-heading" id="bkm-heading"><span id="bkm-brand-lead">Plan Your</span><span class="bkm-brand-script" id="bkm-brand-script">Visit</span></h2>',
            '<address class="bkm-brand-address">Newcastle &middot; Monmouth &middot; Wales</address>',
            '<div class="bkm-weather" id="bkm-weather">',
              '<span class="bkm-weather-icon" id="bkm-weather-icon">&#x1F324;</span>',
              '<div class="bkm-weather-info">',
                '<span class="bkm-weather-temp" id="bkm-weather-temp">&#8212;</span>',
                '<span class="bkm-weather-desc" id="bkm-weather-desc">Monmouth, Wales</span>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',

        '<!-- RIGHT column: holds picker / configure / inquire phases -->',
        '<div class="bkm-right">',
          '<button class="bkm-close" id="bkm-close-btn" aria-label="Close">&times;</button>',

          '<!-- PHASE 0: Service picker -->',
          '<div class="bkm-phase bkm-phase-picker" id="bkm-phase-picker">',
            '<p class="bkm-form-title">What would you like to do?</p>',
            '<p class="bkm-form-sub">Choose what fits &mdash; you can switch at any time.</p>',
            '<div class="bkm-tiles">',
              '<button class="bkm-tile" data-pick="stay"><span class="bkm-tile-icon"><img src="Chnages/Stay with us model icon .png" alt="" aria-hidden="true" style="width:80px;height:80px;object-fit:contain;"></span><span class="bkm-tile-label">Stay with us</span><span class="bkm-tile-desc">Self-catered country house &amp; group accommodation &mdash; live rates &amp; availability</span></button>',
              '<button class="bkm-tile" data-pick="inquire"><span class="bkm-tile-icon"><img src="Chnages/Enquire about model icon .png" alt="" aria-hidden="true" style="width:80px;height:80px;object-fit:contain;"></span><span class="bkm-tile-label">Enquire about</span><span class="bkm-tile-desc">Events, weddings, corporate days, school trips &mdash; send us a message</span></button>',
            '</div>',
            '<p class="bkm-note">Secure booking powered by QBook &mdash; all availability and payment handled on this site.</p>',
          '</div>',

          '<!-- PHASE 1: Configure (dates / group size / accommodation) -->',
          '<div class="bkm-phase bkm-phase-config" id="bkm-phase-config" hidden>',
            '<div class="bkm-crumb"><button class="bkm-switch" id="bkm-switch-config">&larr; Choose different service</button></div>',
            '<p class="bkm-form-title" id="bkm-config-title">Plan your stay</p>',
            '<p class="bkm-form-sub" id="bkm-config-sub">Select dates, group size and accommodation type to see live rates.</p>',
            '<div class="bkm-fields">',
              '<div class="bkm-field">',
                '<label for="bkm-checkin">Arrival</label>',
                '<input type="date" id="bkm-checkin" placeholder="dd / mm / yyyy" min="' + today + '">',
              '</div>',
              '<div class="bkm-field">',
                '<label for="bkm-checkout">Departure</label>',
                '<input type="date" id="bkm-checkout" placeholder="dd / mm / yyyy" min="' + today + '">',
              '</div>',
            '</div>',
            '<div class="bkm-fields">',
              '<div class="bkm-field">',
                '<label>Adults</label>',
                '<div class="bkm-stepper">',
                  '<button type="button" class="bkm-step-btn bkm-step-dec" data-target="bkm-adults" aria-label="Decrease adults">&#8722;</button>',
                  '<input type="number" class="bkm-step-val bkm-step-editable" id="bkm-adults" value="2" min="1" max="999" inputmode="numeric" aria-label="Number of adults">',
                  '<button type="button" class="bkm-step-btn bkm-step-inc" data-target="bkm-adults" aria-label="Increase adults">+</button>',
                '</div>',
              '</div>',
              '<div class="bkm-field">',
                '<label>Children</label>',
                '<div class="bkm-stepper">',
                  '<button type="button" class="bkm-step-btn bkm-step-dec" data-target="bkm-children" aria-label="Decrease children">&#8722;</button>',
                  '<input type="number" class="bkm-step-val bkm-step-editable" id="bkm-children" value="0" min="0" max="999" inputmode="numeric" aria-label="Number of children">',
                  '<button type="button" class="bkm-step-btn bkm-step-inc" data-target="bkm-children" aria-label="Increase children">+</button>',
                '</div>',
              '</div>',
            '</div>',
            '<div class="bkm-field">',
              '<label id="bkm-acctype-lbl">Accommodation type</label>',
              '<div class="hcs hcs--line" aria-labelledby="bkm-acctype-lbl">',
                '<button type="button" class="hcs-btn" aria-haspopup="listbox" aria-expanded="false">',
                  '<span class="hcs-value">Show all accommodation</span>',
                  '<svg class="hcs-arrow" width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="1 1 7 7 13 1"/></svg>',
                '</button>',
                '<ul class="hcs-list" role="listbox">',
                  '<li class="hcs-opt hcs-selected" data-value="any" role="option">Show all accommodation</li>',
                  '<li class="hcs-opt" data-value="cosy-king" role="option">Cosy King Room</li>',
                  '<li class="hcs-opt" data-value="double-garden" role="option">Double Garden View</li>',
                  '<li class="hcs-opt" data-value="large-double-garden" role="option">Large Double Garden View</li>',
                  '<li class="hcs-opt" data-value="family-room" role="option">Family Room</li>',
                  '<li class="hcs-opt" data-value="dormitory" role="option">Dormitory / Group Bunk Rooms</li>',
                  '<li class="hcs-opt" data-value="exclusive-use" role="option">Exclusive Use of House</li>',
                '</ul>',
                '<input type="hidden" id="bkm-acctype" value="any">',
              '</div>',
            '</div>',
            '<p class="bkm-capacity-hint" id="bkm-capacity-hint"></p>',
            '<p class="bkm-error" id="bkm-error">Please select a valid arrival and departure date.</p>',
            '<button class="bkm-btn" id="bkm-submit">Apply</button>',
            '<p class="bkm-note" id="bkm-config-note">Secure booking powered by QBook.</p>',
          '</div>',

          '<!-- PHASE 2: Inquiry form -->',
          '<div class="bkm-phase bkm-phase-inquire" id="bkm-phase-inquire" hidden>',
            '<div class="bkm-crumb"><button class="bkm-switch" id="bkm-switch-inquire">&larr; Choose different service</button></div>',
            '<p class="bkm-form-title" id="bkm-inq-title">Send us an enquiry</p>',
            '<p class="bkm-form-sub" id="bkm-inq-sub">Tell us what you&rsquo;re planning. The team responds within one working day.</p>',
            '<form class="bkm-inq-form" id="bkm-inq-form" novalidate>',
              '<div class="bkm-field"><label for="bkm-inq-name">Your name <span class="bkm-req">*</span></label><input type="text" id="bkm-inq-name" autocomplete="name" required><span class="bkm-field-err" id="bkm-err-name"></span></div>',
              '<div class="bkm-field"><label for="bkm-inq-email">Email <span class="bkm-req">*</span></label><input type="email" id="bkm-inq-email" autocomplete="email" required><span class="bkm-field-err" id="bkm-err-email"></span></div>',
              '<div class="bkm-field"><label for="bkm-inq-phone">Phone number <span class="bkm-req">*</span></label><input type="tel" id="bkm-inq-phone" autocomplete="tel" required><span class="bkm-field-err" id="bkm-err-phone"></span></div>',
              '<div class="bkm-field">',
                '<label id="bkm-inq-about-lbl">Enquiry about <span class="hcs-req">*</span></label>',
                '<div class="hcs hcs--line" id="bkm-inq-about-hcs" aria-labelledby="bkm-inq-about-lbl">',
                  '<button type="button" class="hcs-btn" aria-haspopup="listbox" aria-expanded="false">',
                    '<span class="hcs-value hcs-placeholder">Please select…</span>',
                    '<svg class="hcs-arrow" width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="1 1 7 7 13 1"/></svg>',
                  '</button>',
                  '<ul class="hcs-list" role="listbox">',
                    '<li class="hcs-opt hcs-opt--placeholder" data-value="" role="option">Please select…</li>',
                    '<li class="hcs-opt" data-value="Wedding" role="option">Wedding</li>',
                    '<li class="hcs-opt" data-value="Private event / party" role="option">Private event / party</li>',
                    '<li class="hcs-opt" data-value="Corporate day / team building" role="option">Corporate day / team building</li>',
                    '<li class="hcs-opt" data-value="School trip / educational" role="option">School trip / educational</li>',
                    '<li class="hcs-opt" data-value="Group accommodation" role="option">Group accommodation</li>',
                    '<li class="hcs-opt" data-value="Exclusive use of house" role="option">Exclusive use of house</li>',
                    '<li class="hcs-opt" data-value="Other" role="option">Other</li>',
                  '</ul>',
                  '<input type="hidden" id="bkm-inq-about" value="">',
                '</div>',
                '<span class="bkm-field-err" id="bkm-err-about"></span>',
              '</div>',
              '<div class="bkm-fields">',
                '<div class="bkm-field">',
                  '<label>Adults</label>',
                  '<div class="bkm-stepper">',
                    '<button type="button" class="bkm-step-btn bkm-step-dec" data-target="bkm-inq-adults" aria-label="Decrease adults">&#8722;</button>',
                    '<input type="number" class="bkm-step-val bkm-step-editable" id="bkm-inq-adults" value="0" min="0" max="999" inputmode="numeric" aria-label="Number of adults">',
                    '<button type="button" class="bkm-step-btn bkm-step-inc" data-target="bkm-inq-adults" aria-label="Increase adults">+</button>',
                  '</div>',
                '</div>',
                '<div class="bkm-field">',
                  '<label>Children</label>',
                  '<div class="bkm-stepper">',
                    '<button type="button" class="bkm-step-btn bkm-step-dec" data-target="bkm-inq-children" aria-label="Decrease children">&#8722;</button>',
                    '<input type="number" class="bkm-step-val bkm-step-editable" id="bkm-inq-children" value="0" min="0" max="999" inputmode="numeric" aria-label="Number of children">',
                    '<button type="button" class="bkm-step-btn bkm-step-inc" data-target="bkm-inq-children" aria-label="Increase children">+</button>',
                  '</div>',
                '</div>',
              '</div>',
              '<div class="bkm-field"><label for="bkm-inq-message">Your enquiry <span class="bkm-req">*</span></label><textarea id="bkm-inq-message" rows="4" required></textarea><span class="bkm-field-err" id="bkm-err-message"></span></div>',
              '<input type="hidden" id="bkm-inq-context">',
              '<p class="bkm-error" id="bkm-inq-error">Please complete all required fields.</p>',
              '<button type="submit" class="bkm-btn">Send Enquiry</button>',
            '</form>',
            '<div class="bkm-inq-success" id="bkm-inq-success" hidden>',
              '<p class="bkm-form-title">Thank you.</p>',
              '<p class="bkm-form-sub">Your enquiry has been sent. We&rsquo;ll be in touch within one working day.</p>',
              '<button class="bkm-btn" id="bkm-inq-done">Close</button>',
            '</div>',
          '</div>',

        '<!-- PHASE 3: Booking summary confirmation -->',
        '<div class="bkm-phase bkm-phase-confirm" id="bkm-phase-confirm" hidden>',
          '<div class="bkm-crumb"><button class="bkm-switch" id="bkm-switch-confirm">&larr; Change dates</button></div>',
          '<p class="bkm-form-title">Your booking summary</p>',
          '<p class="bkm-form-sub">Review your details below, then proceed to complete your secure booking.</p>',
          '<div class="bkm-summary" id="bkm-summary"></div>',
          '<a class="bkm-btn bkm-btn-proceed" id="bkm-proceed-btn" href="#" target="_blank" rel="noopener">Proceed to Secure Booking &rarr;</a>',
          '<p class="bkm-note">You will be taken to our secure booking partner, Q-Book, to confirm and pay. Your details above will be pre-applied.</p>',
        '</div>',
        '</div>',

      '</div>',
    '</div>'
  ].join("");

  document.body.insertAdjacentHTML("beforeend", modalHTML);

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
      .catch(function () { /* keep widget visible with placeholder */ });
  }());

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
  var inEl       = document.getElementById("bkm-checkin");
  var outEl      = document.getElementById("bkm-checkout");
  var adultsEl   = document.getElementById("bkm-adults");
  var childrenEl = document.getElementById("bkm-children");
  var accTypeEl  = document.getElementById("bkm-acctype");
  var errEl        = document.getElementById("bkm-error");

  var phasePicker  = document.getElementById("bkm-phase-picker");
  var phaseConfig  = document.getElementById("bkm-phase-config");
  var phaseInquire = document.getElementById("bkm-phase-inquire");
  var phaseConfirm = document.getElementById("bkm-phase-confirm");
  var brandLead    = document.getElementById("bkm-brand-lead");
  var brandScript  = document.getElementById("bkm-brand-script");
  var configTitle  = document.getElementById("bkm-config-title");
  var configSub    = document.getElementById("bkm-config-sub");
  var inqTitle     = document.getElementById("bkm-inq-title");
  var inqSub       = document.getElementById("bkm-inq-sub");
  var inqForm      = document.getElementById("bkm-inq-form");
  var inqSuccess   = document.getElementById("bkm-inq-success");
  var inqContext   = document.getElementById("bkm-inq-context");
  var inqErr       = document.getElementById("bkm-inq-error");
  var inqDone      = document.getElementById("bkm-inq-done");
  var switchCfg    = document.getElementById("bkm-switch-config");
  var switchInq    = document.getElementById("bkm-switch-inquire");
  var switchConf   = document.getElementById("bkm-switch-confirm");
  var proceedBtn     = document.getElementById("bkm-proceed-btn");
  var summaryEl      = document.getElementById("bkm-summary");
  var capacityHintEl = document.getElementById("bkm-capacity-hint");

  var currentService = null;

  function setBrand(svc) {
    var s = BKM_SERVICES[svc] || { lead: "Plan Your", script: "Visit" };
    brandLead.textContent = s.lead.replace(/&[a-z]+;/g, "");
    brandScript.textContent = s.script;
  }

  function showPhase(name) {
    [phasePicker, phaseConfig, phaseInquire, phaseConfirm].forEach(function (p) { p.hidden = true; });
    panel.classList.remove("bkm-widget-active");
    if (name === "picker")  phasePicker.hidden  = false;
    if (name === "config")  phaseConfig.hidden  = false;
    if (name === "inquire") phaseInquire.hidden = false;
    if (name === "confirm") phaseConfirm.hidden = false;
    errEl.classList.remove("visible");
    inqErr.classList.remove("visible");
  }

  function configureFor(svc) {
    currentService = svc;
    var s = BKM_SERVICES[svc];
    if (!s) return;
    setBrand(svc);
    if (s.flow === "inquire") {
      inqTitle.innerHTML = s.configTitle;
      inqSub.innerHTML = s.configSub;
      inqContext.value = svc;
      inqForm.hidden = false;
      inqSuccess.hidden = true;
      showPhase("inquire");
      setTimeout(function () { document.getElementById("bkm-inq-name").focus(); }, 80);
    } else {
      configTitle.innerHTML = s.configTitle;
      configSub.innerHTML = s.configSub;
      showPhase("config");
      setTimeout(function () { inEl.focus(); }, 80);
    }
  }

  function openModal(svc) {
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (svc && BKM_SERVICES[svc]) {
      configureFor(svc);
    } else {
      currentService = null;
      setBrand(null);
      brandLead.textContent = "Plan Your";
      brandScript.textContent = "Visit";
      showPhase("picker");
    }
  }
  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    showPhase("picker");
    currentService = null;
  }

  function fmt(dateStr) {
    /* YYYY-MM-DD → "3 June 2026" */
    var d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  /* Fetch the live nightly rate for every night of the stay from Q-Book's CDN widget.
     Fetches at most one HTTP request per calendar month spanned.
     Calls back with an array of { date, perNight, minNights } — perNight is null if unavailable. */
  function fetchAllNightlyRates(ci, co, callback) {
    var ciDate = new Date(ci + "T12:00:00");
    var nights  = Math.round((new Date(co + "T12:00:00") - ciDate) / 86400000);
    if (nights < 1) { callback([]); return; }

    /* Build YYYY-MM-DD string for each night (check-in night through night before check-out) */
    var nightDates = [];
    for (var i = 0; i < nights; i++) {
      var d = new Date(ciDate.getTime());
      d.setDate(d.getDate() + i);
      nightDates.push(d.toISOString().slice(0, 10));
    }

    /* Identify unique YYYY-MM-01 month keys */
    var monthHtml = {};
    nightDates.forEach(function (ds) {
      var mk = ds.slice(0, 8) + "01";
      monthHtml[mk] = null;
    });
    var monthKeys = Object.keys(monthHtml);
    var remaining = monthKeys.length;

    function resolveRates() {
      var rates = nightDates.map(function (ds) {
        var nd  = new Date(ds + "T12:00:00");
        var day = ("0" + nd.getDate()).slice(-2);
        var mon = nd.toLocaleDateString("en-GB", { month: "short" });
        var mk  = ds.slice(0, 8) + "01";
        var html = monthHtml[mk] || "";
        var re  = new RegExp(
          'data-nights="(\\d+)"[\\s\\S]{0,300}?<span class="date">'
          + day + "\\s" + mon + "[^<]*<\\/span>[\\s\\S]{0,500}?\\xA3([\\d.]+)"
        );
        var m = re.exec(html);
        return m
          ? { date: ds, perNight: parseFloat(m[2]), minNights: parseInt(m[1], 10) }
          : { date: ds, perNight: null, minNights: 1 };
      });
      callback(rates);
    }

    monthKeys.forEach(function (mk) {
      fetch(SC_RATES_URL + "?start=" + mk)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          monthHtml[mk] = html;
          remaining--;
          if (remaining === 0) { resolveRates(); }
        })
        .catch(function () {
          monthHtml[mk] = "";
          remaining--;
          if (remaining === 0) { resolveRates(); }
        });
    });
  }

  /* Expose for use by the availability bar on the accommodation page */
  window._HP = {
    fetchAllNightlyRates: fetchAllNightlyRates,
    QBOOK_BASE:  QBOOK_BASE,
    QBOOK_K:     QBOOK_K,
    ROOM_DEFS:   ROOM_DEFS,
    SC_RATES_URL: SC_RATES_URL
  };

  function showConfirm(nightRates) {
    var ci = inEl.value;   /* YYYY-MM-DD */
    var co = outEl.value;
    var adults  = adultsEl   ? (parseInt(adultsEl.value,   10) || 0) : 0;
    var kids    = childrenEl ? (parseInt(childrenEl.value, 10) || 0) : 0;
    var accType = accTypeEl  ? accTypeEl.value : "";
    var nights  = Math.round((new Date(co) - new Date(ci)) / 86400000);
    var totalGuests = adults + kids;

    /* Confirmed property constants from Q-Book admin (per person per night) */
    var BREAKFAST_PP = 11;
    var DINNER_PP    = 18;

    /* Rate analysis */
    var allRatesKnown = (nightRates.length === nights) &&
                        nightRates.every(function (n) { return n.perNight !== null; });
    var anyRateKnown  = nightRates.some(function (n) { return n.perNight !== null; });
    var roomTotal = anyRateKnown
      ? nightRates.reduce(function (s, n) { return s + (n.perNight || 0); }, 0)
      : null;
    var lowestRate = anyRateKnown
      ? nightRates.reduce(function (lo, n) {
          return (n.perNight !== null && (lo === null || n.perNight < lo)) ? n.perNight : lo;
        }, null)
      : null;
    var minNights = (nightRates.length > 0) ? nightRates[0].minNights : 1;

    /* Room definition for selected type */
    var roomKey = accTypeEl ? accTypeEl.value : 'any';
    var roomDef = ROOM_DEFS[roomKey] || ROOM_DEFS['any'];
    var overCapacity = roomDef.maxGuests > 0 && (adults + kids) > roomDef.maxGuests;

    var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    /* Helper to build a summary row */
    var row = function (lbl, val, extra) {
      var cls = "bkm-sum-row" + (extra ? " " + extra : "");
      return '<div class="' + cls + '"><span class="bkm-sum-label">' + lbl +
             '</span><span class="bkm-sum-value">' + val + '</span></div>';
    };

    var html = "";

    /* --- Section 1: Trip details --- */
    html += '<div class="bkm-sum-section">Trip details</div>';
    html += row("Check-in",  fmt(ci));
    html += row("Check-out", fmt(co));
    html += row("Duration",  nights + (nights === 1 ? " night" : " nights"));
    if (minNights > 1) { html += row("Min. stay", minNights + " nights"); }
    html += row("Adults", adults);
    if (kids > 0) { html += row("Children", kids); }

    /* Room preference + capacity */
    if (roomKey !== 'any') {
      var capStr = roomDef.maxGuests > 0
        ? ' \u2014 max ' + roomDef.maxGuests + (roomDef.maxGuests === 1 ? ' guest' : ' guests')
        : '';
      html += row("Room type", roomDef.label + capStr);
      if (overCapacity) {
        html += '<div class="bkm-sum-capwarn">\u26A0\uFE0F ' + (adults + kids) + ' guests exceeds this room\u2019s capacity (max ' +
                roomDef.maxGuests + '). Please adjust or choose a different room on Q-Book.</div>';
      }
    }

    /* --- Section 2: Room rate --- */
    /* NOTE: SC_RATES_URL returns the property's lowest available nightly rate ("from" price),
       not the rate for the specific room type selected. All rate figures are therefore
       labelled as "from" — the confirmed price for the chosen room is shown on Q-Book. */
    if (anyRateKnown) {
      /* Section header: when a specific room type is selected the SC_RATES_URL still
         returns the property's lowest rate across ALL rooms, not that room's rate.
         Label accordingly so users aren't misled. */
      var rateSectionLabel = (roomKey !== 'any')
        ? 'Lowest available rate (any room, from)'
        : 'Room rate (from)';
      html += '<div class="bkm-sum-section">' + rateSectionLabel + '</div>';
      if (nights <= 7) {
        nightRates.forEach(function (n, idx) {
          var nd  = new Date(n.date + "T12:00:00");
          var lbl = "Night " + (idx + 1) + " \u2014 " + DAYS[nd.getDay()] + " " + nd.getDate();
          var val = n.perNight !== null ? "from \xA3" + n.perNight.toFixed(2) : "On request";
          html   += row(lbl, val, n.perNight === null ? "bkm-sum-row--muted" : "");
        });
      } else {
        html += row("Per night (from)", "from \xA3" + lowestRate.toFixed(2));
      }
      html += row(
        allRatesKnown ? "Room total (from)" : "Room total (partial, from)",
        "from \xA3" + roomTotal.toFixed(2),
        "bkm-sum-row--subtotal"
      );
      /* Inline notice when a specific room type is selected */
      if (roomKey !== 'any') {
        html += '<div class="bkm-sum-room-rate-notice">\u24D8 This is the property\u2019s lowest available starting rate \u2014 not the confirmed rate for ' + roomDef.label + '. Your exact price is shown on Q-Book after clicking Proceed.</div>';
      }
    }

    /* Partial availability warning — shown when some (but not all) nights returned
       a rate, suggesting one or more nights in the range may already be booked. */
    if (anyRateKnown && !allRatesKnown) {
      html += '<div class="bkm-sum-avail-warn">\u26A0\uFE0F One or more nights in this period show no available rate and may already be booked. Please confirm full availability on Q-Book before completing your booking, or choose different dates.</div>';
    }

    /* --- Section 3: Optional meal extras --- */
    if (totalGuests > 0) {
      var bkCost = BREAKFAST_PP * totalGuests * nights;
      var dnCost = DINNER_PP    * totalGuests * nights;
      html += '<div class="bkm-sum-section">Optional meal extras</div>';
      html += row(
        "Breakfast \u2014 \xA3" + BREAKFAST_PP + "/person/night",
        "\xA3" + bkCost.toFixed(2) + " (" + totalGuests + (totalGuests === 1 ? " guest" : " guests") + ")",
        "bkm-sum-row--meal"
      );
      html += row(
        "Dinner & Lunch \u2014 \xA3" + DINNER_PP + "/person/night",
        "\xA3" + dnCost.toFixed(2) + " (" + totalGuests + (totalGuests === 1 ? " guest" : " guests") + ")",
        "bkm-sum-row--meal"
      );
      if (allRatesKnown) {
        html += row(
          "Est. total with all meals",
          "from \xA3" + (roomTotal + bkCost + dnCost).toFixed(2),
          "bkm-sum-row--total"
        );
      }
      html += '<div class="bkm-sum-footnote">Meal extras are optional \u2014 add or remove when completing your booking on Q-Book.</div>';
      html += '<div class="bkm-sum-footnote bkm-sum-footnote--rate-note">'
        + (roomKey !== 'any'
            ? 'Rate shown is the property\u2019s lowest starting price across all rooms \u2014 not specific to ' + roomDef.label + '. Your confirmed rate for the selected room is shown on Q-Book.'
            : 'Room rates shown are starting prices. Your exact room rate is confirmed on Q-Book.')
        + '</div>';
    }

    summaryEl.innerHTML = html;

    /* Build Q-Book deep-link URL.
       If a specific room type is selected and it has Q-Book item IDs, pass the first as &i=
       so Q-Book can pre-filter the availability list to the relevant room. */
    var qUrl = QBOOK_BASE + "?from=" + ci + "&to=" + co + "&k=" + QBOOK_K;
    if (adults > 0) { qUrl += "&a=" + adults; }
    if (kids > 0)   { qUrl += "&c=" + kids; }
    if (roomDef.qItemIDs && roomDef.qItemIDs.length > 0) {
      qUrl += "&i=" + roomDef.qItemIDs[0];
    }
    proceedBtn.href = qUrl;

    setBrand("stay");
    showPhase("confirm");
  }

  /* -- picker tiles -- */
  phasePicker.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pick]");
    if (!t) return;
    configureFor(t.getAttribute("data-pick"));
  });

  /* -- "switch service" links -- */
  switchCfg.addEventListener("click", function () { showPhase("picker"); });
  switchInq.addEventListener("click", function () { showPhase("picker"); });
  switchConf.addEventListener("click", function () { showPhase("config"); });

  /* -- update capacity hint when accommodation type changes -- */
  function updateCapacityHint() {
    if (!capacityHintEl || !accTypeEl) return;
    var key = accTypeEl.value;
    var def = ROOM_DEFS[key];
    if (!def || key === 'any') {
      capacityHintEl.textContent = '';
      capacityHintEl.className = 'bkm-capacity-hint';
      return;
    }
    if (key === 'dormitory') {
      capacityHintEl.textContent = 'For group sizes and availability, use Enquire about or contact us directly.';
      capacityHintEl.className = 'bkm-capacity-hint bkm-capacity-hint--info';
      return;
    }
    var adults = parseInt(adultsEl.value, 10)  || 0;
    var kids   = parseInt(childrenEl.value, 10) || 0;
    var total  = adults + kids;
    var cap    = 'up to ' + def.maxGuests + (def.maxGuests === 1 ? ' guest' : ' guests');
    if (def.maxGuests > 0 && total > def.maxGuests) {
      capacityHintEl.textContent = '\u26A0\uFE0F Over capacity \u2014 this room holds ' + cap + '. Reduce guests or choose a different room.';
      capacityHintEl.className = 'bkm-capacity-hint bkm-capacity-hint--warn';
    } else if (def.maxGuests > 0) {
      capacityHintEl.textContent = 'Capacity: ' + cap + '.';
      capacityHintEl.className = 'bkm-capacity-hint bkm-capacity-hint--ok';
    } else {
      capacityHintEl.textContent = 'Enquire for availability and pricing.';
      capacityHintEl.className = 'bkm-capacity-hint bkm-capacity-hint--info';
    }
  }
  accTypeEl.addEventListener('change', updateCapacityHint);

  /* -- Flatpickr date pickers for booking modal dates -- */
  /* Resize the Flatpickr month <select> to fit the current month name so
     "June 2026" doesn't have an oversized gap caused by the browser sizing
     the select to its longest option ("September"). */
  function syncMonthWidth(fp) {
    if (!fp || !fp.calendarContainer) return;
    var sel = fp.calendarContainer.querySelector(".flatpickr-monthDropdown-months");
    if (!sel) return;
    var tmp = document.createElement("span");
    tmp.style.cssText = "position:absolute;visibility:hidden;font-family:'Bodoni72','Bodoni 72',Georgia,serif;font-size:1.05rem;white-space:nowrap;pointer-events:none";
    function resize() {
      var opt = sel.options[sel.selectedIndex];
      tmp.textContent = opt ? opt.text : sel.value;
      document.body.appendChild(tmp);
      sel.style.width = (tmp.offsetWidth + 6) + "px";
      document.body.removeChild(tmp);
    }
    resize();
    sel.addEventListener("change", resize);
  }

  var bkmOutFP = null;
  var bkmInFP  = null;
  if (window.flatpickr && inEl && outEl) {
    var fpBaseOpts = {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "j M Y",
      disableMobile: true,
      locale: { firstDayOfWeek: 1 },
      onReady: function () { syncMonthWidth(this); },
      onMonthChange: function () { syncMonthWidth(this); }
    };
    bkmOutFP = flatpickr(outEl, Object.assign({}, fpBaseOpts, { minDate: "today" }));
    if (bkmOutFP && bkmOutFP.altInput) { bkmOutFP.altInput.placeholder = "dd / mm / yyyy"; }
    bkmInFP  = flatpickr(inEl,  Object.assign({}, fpBaseOpts, {
      minDate: "today",
      onChange: function (selectedDates) {
        if (selectedDates.length > 0 && bkmOutFP) {
          var next = new Date(selectedDates[0]);
          next.setDate(next.getDate() + 1);
          bkmOutFP.set("minDate", next);
          if (outEl.value && outEl.value <= inEl.value) { bkmOutFP.clear(); }
        }
      }
    }));
    if (bkmInFP && bkmInFP.altInput) { bkmInFP.altInput.placeholder = "dd / mm / yyyy"; }
  } else {
    /* Fallback for browsers where Flatpickr didn't load */
    inEl.addEventListener("change", function () {
      if (inEl.value) {
        var next = new Date(inEl.value);
        next.setDate(next.getDate() + 1);
        outEl.min = next.toISOString().split("T")[0];
        if (outEl.value && outEl.value <= inEl.value) { outEl.value = ""; }
      }
    });
  }

  /* -- submit: validate dates then show on-site summary before handing off to Q-Book -- */
  submitBtn.addEventListener("click", function () {
    errEl.classList.remove("visible");
    if (!inEl.value || !outEl.value || outEl.value <= inEl.value) {
      errEl.textContent = "Please select a valid arrival and departure date.";
      errEl.classList.add("visible");
      return;
    }
    /* Block over-capacity bookings before proceeding.
       The orange capacity hint already describes the issue; scroll to it and return. */
    var selKey = accTypeEl ? accTypeEl.value : 'any';
    var selDef = ROOM_DEFS[selKey] || ROOM_DEFS['any'];
    if (selDef.maxGuests > 0) {
      var selAdults = parseInt(adultsEl.value,   10) || 0;
      var selKids   = parseInt(childrenEl.value, 10) || 0;
      if ((selAdults + selKids) > selDef.maxGuests) {
        /* Hint is already visible — just scroll it into view so user sees it */
        if (capacityHintEl) { capacityHintEl.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
        return;
      }
    }
    /* Show confirm phase immediately with a loading placeholder, then populate rates */
    setBrand("stay");
    showPhase("confirm");
    summaryEl.innerHTML = '<div class="bkm-sum-loading">Fetching live rates\u2026</div>';
    proceedBtn.style.opacity = "0.4";
    proceedBtn.style.pointerEvents = "none";
    fetchAllNightlyRates(inEl.value, outEl.value, function (nightRates) {
      proceedBtn.style.opacity = "";
      proceedBtn.style.pointerEvents = "";
      /* If the rates widget returned no rate for any night, those dates are not
         available — do not advance to Q-Book. Show the error on the config screen
         so the user can pick different dates or enquire. */
      if (nightRates.length > 0 && !nightRates.some(function (n) { return n.perNight !== null; })) {
        showPhase("config");
        errEl.textContent = "These dates don\u2019t appear to be available. Please choose different dates, or send us an enquiry.";
        errEl.classList.add("visible");
        return;
      }
      showConfirm(nightRates);
    });
  });

  /* -- inquiry submit: POST to Formsubmit (no signup, sends to info@hilstonpark.com) -- */
  inqForm.addEventListener("submit", function (e) {
    e.preventDefault();
    inqErr.classList.remove("visible");
    var name     = document.getElementById("bkm-inq-name").value.trim();
    var email    = document.getElementById("bkm-inq-email").value.trim();
    var phone    = document.getElementById("bkm-inq-phone").value.trim();
    var about    = document.getElementById("bkm-inq-about").value;
    var adults   = document.getElementById("bkm-inq-adults").value || "0";
    var children = document.getElementById("bkm-inq-children").value || "0";
    var msg      = document.getElementById("bkm-inq-message").value.trim();
    var ctx      = inqContext.value || "general";
    /* Per-field validation */
    var valid = true;
    function fieldErr(errId, errMsg) {
      var el = document.getElementById(errId);
      if (!el) { return; }
      el.textContent = errMsg;
      el.classList.toggle("visible", !!errMsg);
    }
    function setInvalid(inputId, invalid) {
      var el = document.getElementById(inputId);
      if (el) { el.classList.toggle("bkm-invalid", invalid); }
    }
    var nameOk = name.length >= 2 && /^[a-zA-Z\s'\-\.]+$/.test(name);
    fieldErr("bkm-err-name", nameOk ? "" : "Please enter your full name (letters only).");
    setInvalid("bkm-inq-name", !nameOk);

    var emailOk = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
    fieldErr("bkm-err-email", emailOk ? "" : "Please enter a valid email address.");
    setInvalid("bkm-inq-email", !emailOk);

    var phoneDigits = phone.replace(/\D/g, "");
    var phoneOk = phoneDigits.length >= 7 && phoneDigits.length <= 15 && /^[\+\d][\d\s\-\(\)\.]+$/.test(phone);
    fieldErr("bkm-err-phone", phoneOk ? "" : "Please enter a valid phone number (digits only).");
    setInvalid("bkm-inq-phone", !phoneOk);

    var aboutOk = !!about;
    fieldErr("bkm-err-about", aboutOk ? "" : "Please select what your enquiry is about.");
    var hcsAbout = document.getElementById("bkm-inq-about-hcs");
    if (hcsAbout) { hcsAbout.classList.toggle("hcs--invalid", !aboutOk); }

    var msgOk = msg.length >= 5;
    fieldErr("bkm-err-message", msgOk ? "" : "Please describe your enquiry (at least 5 characters).");
    setInvalid("bkm-inq-message", !msgOk);

    valid = nameOk && emailOk && phoneOk && aboutOk && msgOk;
    if (!valid) {
      inqErr.classList.add("visible");
      return;
    }
    var svcLabel = BKM_SERVICES[ctx] ? BKM_SERVICES[ctx].label.replace(/&[a-z]+;/g, "&") : ctx;
    var submitBtnEl = inqForm.querySelector("button[type=submit]");
    var origBtnText = submitBtnEl.textContent;
    submitBtnEl.disabled = true;
    submitBtnEl.textContent = "Sending\u2026";

    fetch(INQUIRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        access_key: INQUIRY_ACCESS_KEY,
        subject: "Website enquiry: " + about,
        name: name,
        email: email,
        phone: phone,
        enquiry_about: about,
        adults: adults,
        children: children,
        service: svcLabel,
        message: msg,
        source_page: window.location.pathname
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && (data.success === "true" || data.success === true)) {
          inqForm.hidden = true;
          inqSuccess.hidden = false;
        } else {
          /* Formsubmit returns success on first submit but asks for email confirmation;
             treat any non-error response as success so the user sees confirmation */
          inqForm.hidden = true;
          inqSuccess.hidden = false;
        }
      })
      .catch(function () {
        inqErr.textContent = "Sorry, we couldn\u2019t send that. Please email info@hilstonpark.com directly.";
        inqErr.classList.add("visible");
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = origBtnText;
      });
  });
  inqDone.addEventListener("click", closeModal);

  /* -- close behaviours --
        Track mousedown origin so a drag that starts inside the panel (e.g. native
        date-picker calendar release) doesn't close the modal on mouseup. -- */
  closeBtn.addEventListener("click", closeModal);
  var mouseDownOnOverlay = false;
  modal.addEventListener("mousedown", function (e) {
    mouseDownOnOverlay = (e.target === modal);
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal && mouseDownOnOverlay) { closeModal(); }
    mouseDownOnOverlay = false;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) { closeModal(); }
  });

  /* -- intercept booking/inquiry triggers
        Opt-in:   [data-booking-type="stay|event|corporate"], [data-inquire]
        Also:     .btn-book (nav Book Now) → opens picker
        IMPORTANT: no longer blanket-intercepts .btn-pill (was opening modal on LEARN MORE etc.) -- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-booking-type], [data-inquire], .btn-book");
    if (!el) { return; }
    var href = el.getAttribute("href") || "";
    var hasAttr = el.hasAttribute("data-booking-type") || el.hasAttribute("data-inquire");
    if (el.classList.contains("btn-book") && href === "#contact-form") { return; }
    if (el.classList.contains("btn-book")) {
      e.preventDefault();
      openModal();
      return;
    }
    /* if the link goes somewhere real and the attrs aren't set, let it through */
    if (!hasAttr && href && href !== "#" && !href.startsWith("#booking")) { return; }
    e.preventDefault();
    if (el.hasAttribute("data-inquire")) {
      openModal("inquire");
    } else if (el.hasAttribute("data-booking-type")) {
      var t = el.getAttribute("data-booking-type");
      /* legacy event/corporate tags now route into the unified enquiry flow */
      if (t !== "stay" && t !== "inquire") { t = "inquire"; }
      openModal(t);
    } else {
      openModal();
    }
  });

  /* =========================================================
     GUEST STEPPER  — +/- buttons for adults / children
     ========================================================= */
  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".bkm-step-btn");
    if (!btn) { return; }
    e.preventDefault();
    e.stopPropagation();
    var targetId = btn.getAttribute("data-target");
    var inp = document.getElementById(targetId);
    if (!inp) { return; }
    var val = parseInt(inp.value, 10);
    if (isNaN(val)) { val = 0; }
    var min = (targetId === "bkm-adults") ? 1 : 0;
    var max = 999;
    if (btn.classList.contains("bkm-step-inc")) {
      val = Math.min(val + 1, max);
    } else {
      val = Math.max(val - 1, min);
    }
    inp.value = val;
    /* Re-evaluate capacity hint whenever guest counts change */
    if (targetId === "bkm-adults" || targetId === "bkm-children") {
      updateCapacityHint();
    }
  });

  /* Editable steppers: allow only whole numbers; clamp on blur */
  document.addEventListener("input", function (e) {
    if (!e.target.classList.contains("bkm-step-editable")) { return; }
    var raw = e.target.value.replace(/[^0-9]/g, "");
    if (e.target.value !== raw) { e.target.value = raw; }
  });
  document.addEventListener("blur", function (e) {
    if (!e.target.classList.contains("bkm-step-editable")) { return; }
    var id  = e.target.id;
    var min = (id === "bkm-adults") ? 1 : 0;
    var val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < min) { val = min; }
    if (val > 999) { val = 999; }
    e.target.value = val;
    if (id === "bkm-adults" || id === "bkm-children") { updateCapacityHint(); }
  }, true);

  /* Live per-field validation on blur for enquiry form */
  (function () {
    function liveValidate(id) {
      var el = document.getElementById(id);
      if (!el) { return; }
      var val = el.value.trim ? el.value.trim() : el.value;
      if (!val) {
        el.classList.remove("bkm-invalid");
        var errKey = id.replace("bkm-inq-", "");
        var errEl = document.getElementById("bkm-err-" + errKey);
        if (errEl) { errEl.classList.remove("visible"); }
        return;
      }
      var ok = true; var msg = "";
      if (id === "bkm-inq-name") {
        ok = val.length >= 2 && /^[a-zA-Z\s'\-\.]+$/.test(val);
        msg = ok ? "" : "Please enter your full name (letters only).";
      } else if (id === "bkm-inq-email") {
        ok = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val);
        msg = ok ? "" : "Please enter a valid email address.";
      } else if (id === "bkm-inq-phone") {
        var digits = val.replace(/\D/g, "");
        ok = digits.length >= 7 && digits.length <= 15 && /^[\+\d][\d\s\-\(\)\.]+$/.test(val);
        msg = ok ? "" : "Please enter a valid phone number (digits only).";
      } else if (id === "bkm-inq-message") {
        ok = val.length >= 5;
        msg = ok ? "" : "Please describe your enquiry.";
      }
      var errKey = id.replace("bkm-inq-", "");
      var errEl = document.getElementById("bkm-err-" + errKey);
      if (errEl) { errEl.textContent = msg; errEl.classList.toggle("visible", !ok); }
      el.classList.toggle("bkm-invalid", !ok);
    }
    ["bkm-inq-name", "bkm-inq-email", "bkm-inq-phone", "bkm-inq-message"].forEach(function (fid) {
      document.addEventListener("blur",  function (e) { if (e.target.id === fid) { liveValidate(fid); } }, true);
      document.addEventListener("focus", function (e) {
        if (e.target.id !== fid) { return; }
        var errKey = fid.replace("bkm-inq-", "");
        var errEl = document.getElementById("bkm-err-" + errKey);
        if (errEl) { errEl.classList.remove("visible"); }
        e.target.classList.remove("bkm-invalid");
      }, true);
    });
    /* Clear "Enquiry about" error as soon as the HCS fires its change event */
    document.addEventListener("change", function (e) {
      if (e.target.id !== "bkm-inq-about") { return; }
      var errEl  = document.getElementById("bkm-err-about");
      var hcsEl  = document.getElementById("bkm-inq-about-hcs");
      if (e.target.value) {
        if (errEl)  { errEl.textContent = ""; errEl.classList.remove("visible"); }
        if (hcsEl)  { hcsEl.classList.remove("hcs--invalid"); }
      }
    });
  }());

  /* =========================================================
     INSTAGRAM MARQUEE  —  Behold.so JSON API + local fallback
     Tiles are <a> elements so CSS .insta-set a rules apply
     (width/height/overflow:hidden). Falls back to local gallery
     images on API timeout, network error, or empty feed.
     ========================================================= */
  var instaInner = document.getElementById("insta-inner");
  if (instaInner) {

    /* Local fallback images — always available, never break */
    var INSTA_FALLBACK = [
      { src: "images/gallery/5rv02864.jpg",  alt: "Outdoor activities at Hilston Park" },
      { src: "images/gallery/5rv02899.jpg",  alt: "Team activities at Hilston Park" },
      { src: "images/gallery/5rv02900.jpg",  alt: "Adventure experiences at Hilston Park" },
      { src: "images/gallery/5rv02909.jpg",  alt: "Group activities at Hilston Park" },
      { src: "images/gallery/5rv02928.jpg",  alt: "Outdoor experiences at Hilston Park" },
      { src: "images/gallery/5rv02984.jpg",  alt: "Hilston Park estate" },
      { src: "images/gallery/5rv03009.jpg",  alt: "Activities at Hilston Park" },
      { src: "images/gallery/5rv03031.jpg",  alt: "School trips at Hilston Park" },
      { src: "images/gallery/5rv03049.jpg",  alt: "Hilston Park outdoor centre" },
      { src: "images/gallery/5rv03072.jpg",  alt: "Hilston Park group activities" },
    ];

    /* Build one marquee set. Each tile is an <a> so CSS .insta-set a rules
       (width, height, overflow:hidden) apply correctly. */
    function buildSet(items, hidden) {
      var set = document.createElement("div");
      set.className = "insta-set";
      if (hidden) set.setAttribute("aria-hidden", "true");
      items.forEach(function(item) {
        var tile = document.createElement("a");
        tile.className = "insta-tile";
        tile.href   = item.permalink || "https://www.instagram.com/hilstonparkofficial/";
        tile.target = "_blank";
        tile.rel    = "noopener noreferrer";
        tile.setAttribute("aria-label", item.alt || "View on Instagram");
        if (hidden) tile.tabIndex = -1;
        var img = document.createElement("img");
        img.src     = item.src;
        img.alt     = item.alt || "";
        img.loading = "lazy";
        img.decoding = "async";
        tile.appendChild(img);
        set.appendChild(tile);
      });
      return set;
    }

    /* Populate the marquee and start the CSS animation. */
    function startMarquee(items) {
      /* Pad each set so it always fills ≥ 150% of the viewport */
      var tileSize   = 340 + 6;
      var minWidth   = Math.max(window.innerWidth * 1.5, 2400);
      var repeats    = Math.max(1, Math.ceil(minWidth / (items.length * tileSize)));
      var setItems   = [];
      for (var i = 0; i < repeats; i++) { setItems = setItems.concat(items); }

      instaInner.innerHTML = "";
      instaInner.appendChild(buildSet(setItems, false));
      instaInner.appendChild(buildSet(setItems, true));

      /* Inject exact keyframe after measuring real scrollWidth, then restart.
         Using an id prevents duplicate <style> tags on re-renders. */
      requestAnimationFrame(function() {
        var halfWidth = instaInner.scrollWidth / 2;
        var duration  = Math.max(40, Math.round(halfWidth / 80)); /* 80 px/s */
        var existing  = document.getElementById("insta-kf");
        if (existing) existing.remove();
        var s = document.createElement("style");
        s.id = "insta-kf";
        s.textContent = "@keyframes insta-scroll{from{transform:translateX(0)}to{transform:translateX(-" + halfWidth + "px)}}";
        document.head.appendChild(s);
        instaInner.style.animation = "none";
        instaInner.offsetWidth; /* force reflow so the new keyframe binds */
        instaInner.style.animation = "insta-scroll " + duration + "s linear infinite";

        /* Hover-pause: CSS animation-play-state cannot override an inline
           animation shorthand, so we wire it via JS instead. */
        var track = document.querySelector(".insta-track");
        if (track) {
          track.addEventListener("mouseenter", function() {
            instaInner.style.animationPlayState = "paused";
          });
          track.addEventListener("mouseleave", function() {
            instaInner.style.animationPlayState = "running";
          });
        }
      });
    }

    function startInstaFetch() {
    var ctrl  = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 5000) : null;

    fetch("https://feeds.behold.so/qbsvzG0laaLxFdO8loEs", ctrl ? { signal: ctrl.signal } : {})
      .then(function(r) {
        if (timer) clearTimeout(timer);
        return r.json();
      })
      .then(function(data) {
        var posts = Array.isArray(data) ? data : (data.posts || []);
        /* Keep only photo / carousel posts (skip stories / reels thumbnails) */
        posts = posts.filter(function(p) {
          var t = (p.mediaType || "").toUpperCase();
          return t === "IMAGE" || t === "CAROUSEL_ALBUM" || t === "";
        });
        if (!posts.length) { startMarquee(INSTA_FALLBACK); return; }

        var items = posts.map(function(p) {
          return {
            src: (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl)
              || (p.sizes && p.sizes.small  && p.sizes.small.mediaUrl)
              || p.mediaUrl || "",
            alt:       p.caption ? p.caption.slice(0, 80) : "Hilston Park on Instagram",
            permalink: p.permalink || "https://www.instagram.com/hilstonparkofficial/"
          };
        }).filter(function(i) { return i.src; });

        startMarquee(items.length ? items : INSTA_FALLBACK);
      })
      .catch(function() {
        if (timer) clearTimeout(timer);
        startMarquee(INSTA_FALLBACK);
      });
    }

    /* Only start fetch when Instagram section scrolls into view */
    var instaSection = instaInner.closest("section") || instaInner.parentElement;
    if ("IntersectionObserver" in window) {
      var instaObs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) { instaObs.disconnect(); startInstaFetch(); }
      }, { rootMargin: "300px" });
      instaObs.observe(instaSection);
    } else { startInstaFetch(); }
  }

  /* =========================================================
     ACCOMMODATION ROOM GALLERIES — fade between slides
     ========================================================= */
  document.querySelectorAll("[data-accom-gallery]").forEach(function(gallery) {
    var slides = gallery.querySelectorAll(".accom-gallery-slide");
    if (slides.length <= 1) return;
    var dotsContainer = gallery.querySelector(".accom-gal-dots");
    var current = 0;

    slides.forEach(function(_, i) {
      var dot = document.createElement("button");
      dot.className = "accom-gal-dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", "Go to image " + (i + 1));
      (function(idx) {
        dot.addEventListener("click", function() { goTo(idx); });
      })(i);
      dotsContainer.appendChild(dot);
    });

    function goTo(idx) {
      slides[current].classList.remove("active");
      dotsContainer.children[current].classList.remove("active");
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add("active");
      dotsContainer.children[current].classList.add("active");
    }

    var prevBtn = gallery.querySelector(".accom-gal-btn.prev");
    var nextBtn = gallery.querySelector(".accom-gal-btn.next");
    if (prevBtn) prevBtn.addEventListener("click", function() { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function() { goTo(current + 1); });
  });

  /* =========================================================
     AGE GROUP GALLERY — arrow navigation
     ========================================================= */
  var galleryTrack = document.getElementById("galleryTrack");
  if (galleryTrack) {
    var prevBtn = document.getElementById("galleryPrev");
    var nextBtn = document.getElementById("galleryNext");
    var slideWidth = function() {
      var slide = galleryTrack.querySelector(".gallery-slide-item");
      return slide ? slide.offsetWidth + 14 : 414; /* 400px + 14px gap */
    };
    if (prevBtn) prevBtn.addEventListener("click", function() {
      galleryTrack.scrollBy({ left: -slideWidth(), behavior: "smooth" });
    });
    if (nextBtn) nextBtn.addEventListener("click", function() {
      galleryTrack.scrollBy({ left: slideWidth(), behavior: "smooth" });
    });
  }

  /* =====================================================
     FOOTER COLLAPSIBLE COLUMNS (mobile only)
     ===================================================== */
  document.querySelectorAll(".footer-col").forEach(function (col) {
    var heading = col.querySelector("h2, h3, h4");
    if (!heading) return;
    heading.addEventListener("click", function () {
      if (window.innerWidth > 560) return;
      col.classList.toggle("is-open");
    });
  });

}); /* end DOMContentLoaded */

/* =====================================================
   COOKIE CONSENT BANNER
   ===================================================== */
(function () {
  var COOKIE_KEY = "hp_cookie_consent";

  function getConsent () {
    try { return JSON.parse(localStorage.getItem(COOKIE_KEY)); } catch (e) { return null; }
  }
  function saveConsent (prefs) {
    try { localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  /* Banner HTML */
  var bannerHTML = [
    '<div id="cookie-banner" class="cookie-banner" role="dialog" aria-label="Cookie notice" aria-live="polite">',
      '<div class="cookie-banner-inner">',
        '<div class="cookie-banner-text">',
          '<strong>Cookie Notice</strong>',
          '<p>We use cookies to improve your experience and understand how you use our site. See our <a href="privacy.html">Privacy Policy</a> for details.</p>',
        '</div>',
        '<div class="cookie-banner-actions">',
          '<button class="cookie-btn cookie-btn-manage" id="cookie-manage">Manage Preferences</button>',
          '<button class="cookie-btn cookie-btn-accept" id="cookie-accept">Accept All</button>',
        '</div>',
      '</div>',
    '</div>',

    '<div id="cookie-modal" class="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-modal-title">',
      '<div class="cookie-modal-panel">',
        '<button class="cookie-modal-close" id="cookie-modal-close" aria-label="Close preferences">&times;</button>',
        '<h2 id="cookie-modal-title">Cookie Preferences</h2>',
        '<p>Choose which cookies you allow. Necessary cookies keep the site working and cannot be disabled.</p>',
        '<div class="cookie-pref">',
          '<div class="cookie-pref-row">',
            '<div><strong>Necessary Cookies</strong><p>Required for the website to function correctly. Cannot be disabled.</p></div>',
            '<span class="cookie-toggle-fixed">Always On</span>',
          '</div>',
          '<div class="cookie-pref-row">',
            '<div><strong>Analytics Cookies</strong><p>Help us understand how visitors interact with our website so we can improve it.</p></div>',
            '<label class="cookie-toggle"><input type="checkbox" id="pref-analytics" aria-label="Analytics Cookies" checked><span class="cookie-toggle-slider"></span></label>',
          '</div>',
          '<div class="cookie-pref-row">',
            '<div><strong>Marketing Cookies</strong><p>Allow us to show relevant content and measure the effectiveness of our campaigns.</p></div>',
            '<label class="cookie-toggle"><input type="checkbox" id="pref-marketing" aria-label="Marketing Cookies"><span class="cookie-toggle-slider"></span></label>',
          '</div>',
        '</div>',
        '<div class="cookie-modal-actions">',
          '<button class="cookie-btn cookie-btn-accept" id="cookie-save-prefs">Save Preferences</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join("");

  /* Only show if consent not yet recorded */
  if (!getConsent()) {
    document.body.insertAdjacentHTML("beforeend", bannerHTML);

    var banner     = document.getElementById("cookie-banner");
    var modal      = document.getElementById("cookie-modal");
    var btnAccept  = document.getElementById("cookie-accept");
    var btnManage  = document.getElementById("cookie-manage");
    var btnClose   = document.getElementById("cookie-modal-close");
    var btnSave    = document.getElementById("cookie-save-prefs");
    var cbAnalytics = document.getElementById("pref-analytics");
    var cbMarketing = document.getElementById("pref-marketing");

    /* Show banner after short delay */
    setTimeout(function () {
      banner.classList.add("is-visible");
    }, 800);

    function dismissBanner (prefs) {
      saveConsent(prefs);
      banner.classList.remove("is-visible");
      setTimeout(function () { banner.parentNode && banner.parentNode.removeChild(banner); }, 500);
      if (modal.classList.contains("is-open")) {
        modal.classList.remove("is-open");
        document.body.style.overflow = "";
      }
    }

    btnAccept.addEventListener("click", function () {
      dismissBanner({ necessary: true, analytics: true, marketing: true, accepted: "all" });
    });

    btnManage.addEventListener("click", function () {
      modal.classList.add("is-open");
    });

    btnClose.addEventListener("click", function () {
      modal.classList.remove("is-open");
    });

    btnSave.addEventListener("click", function () {
      dismissBanner({
        necessary: true,
        analytics: cbAnalytics.checked,
        marketing: cbMarketing.checked,
        accepted: "custom"
      });
    });

    /* Close modal on overlay click */
    modal.addEventListener("click", function (e) {
      if (e.target === modal) { modal.classList.remove("is-open"); }
    });

    /* Close on Escape */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) {
        modal.classList.remove("is-open");
      }
    });
  }
}());

/* =====================================================
   WHATSAPP FLOATING BUTTON
   Number: PENDING — update href to wa.me/[full number with country code]
   e.g. href="https://wa.me/447700000000"
   ===================================================== */
(function () {
  /* TODO: replace with actual WhatsApp number (digits only, incl. country code, e.g. 447700000000) */
  var WA_NUMBER = "447700000000";

  var btn = document.createElement("a");
  btn.id            = "wa-btn";
  btn.className     = "wa-btn";
  btn.href          = "https://wa.me/" + WA_NUMBER;
  btn.target        = "_blank";
  btn.rel           = "noopener noreferrer";
  btn.setAttribute("aria-label", "Chat with Hilston Park on WhatsApp");

  btn.innerHTML = [
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>',
    '</svg>',
    '<span class="wa-tooltip">Chat on WhatsApp</span>'
  ].join("");

  document.body.appendChild(btn);

  /* Reveal after a moment so it doesn't flash on load */
  setTimeout(function () { btn.classList.add("is-visible"); }, 1200);
}());


/* =====================================================
   HCS — Hilston Custom Select Engine
   Replaces native <select> for consistent cross-platform styling.
   Usage: call initHCS(wrapEl) on any .hcs element.
   Auto-inits all .hcs present on DOMContentLoaded.
   ===================================================== */
function initHCS(wrap) {
  if (!wrap || wrap._hcsInit) return;
  wrap._hcsInit = true;

  var btn    = wrap.querySelector('.hcs-btn');
  var list   = wrap.querySelector('.hcs-list');
  var opts   = wrap.querySelectorAll('.hcs-opt');
  var valEl  = wrap.querySelector('.hcs-value');
  var input  = wrap.querySelector('input[type="hidden"]');
  var focIdx = -1;

  function openHCS() {
    document.querySelectorAll('.hcs.hcs-open').forEach(function (o) {
      if (o !== wrap) closeHCS(o);
    });
    wrap.classList.add('hcs-open');
    btn.setAttribute('aria-expanded', 'true');
    var sel = list.querySelector('.hcs-selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    focIdx = sel ? Array.prototype.indexOf.call(opts, sel) : 0;
    setFocus(focIdx);
  }

  function closeHCS(target) {
    target = target || wrap;
    target.classList.remove('hcs-open');
    var b = target.querySelector('.hcs-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
    opts.forEach(function (o) { o.classList.remove('hcs-focused'); });
  }

  function selectOpt(opt) {
    var val  = opt.getAttribute('data-value');
    var text = opt.textContent.trim();
    var isPlaceholder = opt.classList.contains('hcs-opt--placeholder');
    opts.forEach(function (o) { o.classList.remove('hcs-selected'); });
    if (!isPlaceholder && val !== '') {
      opt.classList.add('hcs-selected');
      valEl.textContent = text;
      valEl.classList.remove('hcs-placeholder');
      if (input) input.value = val;
    } else {
      valEl.textContent = text;
      valEl.classList.add('hcs-placeholder');
      if (input) input.value = '';
    }
    if (input) {
      var ev = document.createEvent('Event');
      ev.initEvent('change', true, true);
      input.dispatchEvent(ev);
    }
    closeHCS();
    btn.focus();
  }

  function setFocus(idx) {
    opts.forEach(function (o) { o.classList.remove('hcs-focused'); });
    if (opts[idx]) {
      opts[idx].classList.add('hcs-focused');
      opts[idx].scrollIntoView({ block: 'nearest' });
      focIdx = idx;
    }
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    wrap.classList.contains('hcs-open') ? closeHCS() : openHCS();
  });

  opts.forEach(function (opt, i) {
    opt.addEventListener('click', function (e) { e.stopPropagation(); selectOpt(opt); });
    opt.addEventListener('mouseenter', function () { setFocus(i); });
  });

  btn.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (wrap.classList.contains('hcs-open')) { if (opts[focIdx]) selectOpt(opts[focIdx]); }
      else { openHCS(); }
    } else if (k === 'ArrowDown') {
      e.preventDefault();
      if (!wrap.classList.contains('hcs-open')) { openHCS(); return; }
      setFocus(Math.min(focIdx + 1, opts.length - 1));
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      if (!wrap.classList.contains('hcs-open')) { openHCS(); return; }
      setFocus(Math.max(focIdx - 1, 0));
    } else if (k === 'Escape') {
      closeHCS(); btn.focus();
    } else if (k === 'Tab') {
      closeHCS();
    }
  });

  document.addEventListener('click', function () { closeHCS(); });
  if (list) list.addEventListener('click', function (e) { e.stopPropagation(); });
}

/* Auto-init on page load */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.hcs').forEach(function (w) { initHCS(w); });
});
