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
  /* All Item Availability widget — full inventory grid with live prices for all room types */
  var QBOOK_RATES_SRC = "https://widgets.hotels.uk.com/display-rates/51665/eff381e2425e310943f59d71f160fa71";
  var QBOOK_RATES_ID  = "QBOOKWIDGET_RATES_ALLITEMS_202788cc19e79e9d082d25e00f1693f4";
  /* Inquiry endpoint — Formsubmit relays form data to this email; first submission triggers a confirmation email to activate */
  var INQUIRY_ENDPOINT = "https://formsubmit.co/ajax/info@hilstonpark.com";

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

        '<!-- RIGHT column: holds picker / configure / inquire phases -->',
        '<div class="bkm-right">',
          '<button class="bkm-close" id="bkm-close-btn" aria-label="Close">&times;</button>',

          '<!-- PHASE 0: Service picker -->',
          '<div class="bkm-phase bkm-phase-picker" id="bkm-phase-picker">',
            '<p class="bkm-form-title">What would you like to do?</p>',
            '<p class="bkm-form-sub">Choose what fits &mdash; you can switch at any time.</p>',
            '<div class="bkm-tiles">',
              '<button class="bkm-tile" data-pick="stay"><span class="bkm-tile-icon">&#x1F3E1;</span><span class="bkm-tile-label">Stay with us</span><span class="bkm-tile-desc">Self-catered country house &amp; group accommodation &mdash; live rates &amp; availability</span></button>',
              '<button class="bkm-tile" data-pick="inquire"><span class="bkm-tile-icon">&#x2709;</span><span class="bkm-tile-label">Enquire about</span><span class="bkm-tile-desc">Events, weddings, corporate days, school trips &mdash; send us a message</span></button>',
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
                '<input type="date" id="bkm-checkin" min="' + today + '">',
              '</div>',
              '<div class="bkm-field">',
                '<label for="bkm-checkout">Departure</label>',
                '<input type="date" id="bkm-checkout" min="' + today + '">',
              '</div>',
            '</div>',
            '<div class="bkm-fields">',
              '<div class="bkm-field">',
                '<label for="bkm-adults">Adults</label>',
                '<input type="number" id="bkm-adults" min="1" max="200" value="2">',
              '</div>',
              '<div class="bkm-field">',
                '<label for="bkm-children">Children</label>',
                '<input type="number" id="bkm-children" min="0" max="200" value="0">',
              '</div>',
            '</div>',
            '<div class="bkm-field">',
              '<label for="bkm-acctype">Accommodation type</label>',
              '<select id="bkm-acctype">',
                '<option value="any">Show all accommodation</option>',
                '<option value="cosy-king">Cosy King Room</option>',
                '<option value="double-garden">Double Garden View</option>',
                '<option value="large-double-garden">Large Double Garden View</option>',
                '<option value="family-room">Family Room</option>',
                '<option value="dormitory">Dormitory / Group Bunk Rooms</option>',
                '<option value="exclusive-use">Exclusive Use of House</option>',
              '</select>',
            '</div>',
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
              '<div class="bkm-field"><label for="bkm-inq-name">Your name <span class="bkm-req">*</span></label><input type="text" id="bkm-inq-name" required></div>',
              '<div class="bkm-field"><label for="bkm-inq-email">Email <span class="bkm-req">*</span></label><input type="email" id="bkm-inq-email" required></div>',
              '<div class="bkm-field"><label for="bkm-inq-phone">Phone number <span class="bkm-req">*</span></label><input type="tel" id="bkm-inq-phone" required></div>',
              '<div class="bkm-field">',
                '<label for="bkm-inq-about">Enquiry about <span class="bkm-req">*</span></label>',
                '<select id="bkm-inq-about" required>',
                  '<option value="">Please select&hellip;</option>',
                  '<option value="Wedding">Wedding</option>',
                  '<option value="Private event / party">Private event / party</option>',
                  '<option value="Corporate day / team building">Corporate day / team building</option>',
                  '<option value="School trip / educational">School trip / educational</option>',
                  '<option value="Group accommodation">Group accommodation</option>',
                  '<option value="Exclusive use of house">Exclusive use of house</option>',
                  '<option value="Other">Other</option>',
                '</select>',
              '</div>',
              '<div class="bkm-fields">',
                '<div class="bkm-field"><label for="bkm-inq-adults">Adults</label><input type="number" id="bkm-inq-adults" min="0" max="500" value="0"></div>',
                '<div class="bkm-field"><label for="bkm-inq-children">Children</label><input type="number" id="bkm-inq-children" min="0" max="500" value="0"></div>',
              '</div>',
              '<div class="bkm-field"><label for="bkm-inq-message">Your enquiry <span class="bkm-req">*</span></label><textarea id="bkm-inq-message" rows="4" required></textarea></div>',
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
        '</div>',

        '<!-- PHASE 3: Full QBook widget (replaces whole panel) -->',
        '<div class="bkm-widget-panel" id="bkm-widget-panel">',
          '<div class="bkm-widget-header">',
            '<button class="bkm-back-btn" id="bkm-back-btn">&#8592; Back</button>',
            '<img src="Logo/Hilston_Park_Logo_White.png" alt="Hilston Park" class="bkm-widget-logo">',
            '<span class="bkm-widget-title" id="bkm-widget-title">Availability &amp; Booking</span>',
            '<button class="bkm-widget-close" id="bkm-widget-close">&times;</button>',
          '</div>',
          '<div class="bkm-widget-accent"></div>',
          '<iframe id="bkm-booking-iframe" class="bkm-booking-iframe" src="about:blank" allowtransparency="1" frameborder="0" title="Hilston Park Booking"></iframe>',
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

  var modal      = document.getElementById("booking-modal");
  var panel      = document.getElementById("bkm-panel");
  var closeBtn   = document.getElementById("bkm-close-btn");
  var submitBtn  = document.getElementById("bkm-submit");
  var backBtn    = document.getElementById("bkm-back-btn");
  var widgetClose = document.getElementById("bkm-widget-close");
  var inEl       = document.getElementById("bkm-checkin");
  var outEl      = document.getElementById("bkm-checkout");
  var adultsEl   = document.getElementById("bkm-adults");
  var childrenEl = document.getElementById("bkm-children");
  var accTypeEl  = document.getElementById("bkm-acctype");
  var errEl      = document.getElementById("bkm-error");
  var bookIframe = document.getElementById("bkm-booking-iframe");

  var phasePicker  = document.getElementById("bkm-phase-picker");
  var phaseConfig  = document.getElementById("bkm-phase-config");
  var phaseInquire = document.getElementById("bkm-phase-inquire");
  var brandLead    = document.getElementById("bkm-brand-lead");
  var brandScript  = document.getElementById("bkm-brand-script");
  var configTitle  = document.getElementById("bkm-config-title");
  var configSub    = document.getElementById("bkm-config-sub");
  var widgetTitle  = document.getElementById("bkm-widget-title");
  var inqTitle     = document.getElementById("bkm-inq-title");
  var inqSub       = document.getElementById("bkm-inq-sub");
  var inqForm      = document.getElementById("bkm-inq-form");
  var inqSuccess   = document.getElementById("bkm-inq-success");
  var inqContext   = document.getElementById("bkm-inq-context");
  var inqErr       = document.getElementById("bkm-inq-error");
  var inqDone      = document.getElementById("bkm-inq-done");
  var switchCfg    = document.getElementById("bkm-switch-config");
  var switchInq    = document.getElementById("bkm-switch-inquire");

  var currentService = null;

  function setBrand(svc) {
    var s = BKM_SERVICES[svc] || { lead: "Plan Your", script: "Visit" };
    brandLead.textContent = s.lead.replace(/&[a-z]+;/g, "");
    brandScript.textContent = s.script;
  }

  function showPhase(name) {
    [phasePicker, phaseConfig, phaseInquire].forEach(function (p) { p.hidden = true; });
    panel.classList.remove("bkm-widget-active");
    if (name === "picker")  phasePicker.hidden  = false;
    if (name === "config")  phaseConfig.hidden  = false;
    if (name === "inquire") phaseInquire.hidden = false;
    if (name === "widget")  panel.classList.add("bkm-widget-active");
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
    bookIframe.src = "about:blank";
    showPhase("picker");
    currentService = null;
  }
  function showWidget() {
    var s = BKM_SERVICES[currentService] || BKM_SERVICES.stay;
    widgetTitle.innerHTML = "Availability &amp; Booking &mdash; " + s.label;
    showPhase("widget");
    bookIframe.src = QBOOK_RATES_SRC;
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
    if ((inEl.value || outEl.value) && (!inEl.value || !outEl.value || outEl.value <= inEl.value)) {
      errEl.classList.add("visible");
      return;
    }
    showWidget();
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
    if (!name || !email || !phone || !about || !msg || !/.+@.+\..+/.test(email)) {
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
        _subject: "Website enquiry: " + about,
        _template: "table",
        _captcha: "false",
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

  /* -- back/close on widget phase -- */
  backBtn.addEventListener("click", function () {
    bookIframe.src = "about:blank";
    /* return to configure phase for current service */
    if (currentService && BKM_SERVICES[currentService] && BKM_SERVICES[currentService].flow !== "inquire") {
      showPhase("config");
    } else {
      showPhase("picker");
    }
  });
  widgetClose.addEventListener("click", closeModal);

  /* -- close behaviours -- */
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { closeModal(); }
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
    /* if the link goes somewhere real and the attrs aren't set, let it through */
    var hasAttr = el.hasAttribute("data-booking-type") || el.hasAttribute("data-inquire");
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
     INSTAGRAM MARQUEE  —  Behold.so JSON API
     ========================================================= */
  var instaInner = document.getElementById("insta-inner");
  if (instaInner) {
    fetch("https://feeds.behold.so/qbsvzG0laaLxFdO8loEs")
      .then(function(r){ return r.json(); })
      .then(function(data) {
        var posts = Array.isArray(data) ? data : (data.posts || []);
        if (!posts.length) return;

        function buildSet(posts, hidden) {
          var set = document.createElement("div");
          set.className = "insta-set";
          if (hidden) set.setAttribute("aria-hidden", "true");
          posts.forEach(function(p) {
            var imgSrc = (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl)
                      || (p.sizes && p.sizes.small  && p.sizes.small.mediaUrl)
                      || p.mediaUrl;
            if (!imgSrc) return;
            var a = document.createElement("a");
            a.href = p.permalink || "https://www.instagram.com/hilstonparkofficial/";
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.setAttribute("aria-label", p.caption ? p.caption.slice(0, 80) : "View on Instagram");
            var img = document.createElement("img");
            img.src = imgSrc;
            img.alt = "";
            img.loading = "lazy";
            a.appendChild(img);
            set.appendChild(a);
          });
          return set;
        }

        var firstSet = buildSet(posts, false);
        var dupeSet  = buildSet(posts, true);
        instaInner.appendChild(firstSet);
        instaInner.appendChild(dupeSet);

        /* measure first set after images load so the loop is pixel-perfect */
        var imgs = firstSet.querySelectorAll("img");
        var loaded = 0;
        function onImgLoad() {
          loaded++;
          if (loaded === imgs.length) {
            var w = firstSet.offsetWidth + 6; /* +6 for the trailing margin-right */
            instaInner.style.setProperty("--scroll-dist", "-" + w + "px");
          }
        }
        imgs.forEach(function(img) {
          if (img.complete) { onImgLoad(); }
          else { img.addEventListener("load", onImgLoad); img.addEventListener("error", onImgLoad); }
        });
        if (!imgs.length) {
          var w = firstSet.offsetWidth + 6;
          instaInner.style.setProperty("--scroll-dist", "-" + w + "px");
        }
      })
      .catch(function(){
        var strip = document.querySelector(".insta-strip");
        if (strip) strip.style.display = "none";
      });
  }

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

});
