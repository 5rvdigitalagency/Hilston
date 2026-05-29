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
     BOOKING MODAL  —  Cal.com-style popup
     Property: Hilston Park  |  QBook ID: 51665
     ========================================================= */
  var QBOOK_RATES_SRC = "https://cdn.hotels.uk.com/sc/51665/eff381e2425e310943f59d71f160fa71/0/4";
  var QBOOK_RATES_ID  = "QBOOKWIDGET_SC_BLOCKS_95cf3bb7f6e7ebf393fbcde248157d51";

  /* -- inject modal HTML -- */
  var modalHTML = [
    '<div id="booking-modal" class="bkm-overlay" role="dialog" aria-modal="true" aria-label="Book Your Stay">',
      '<div class="bkm-popup" id="bkm-popup">',
        '<div class="bkm-popup-header">',
          '<img src="Logo/Hilston_Park_Logo_White.png" alt="Hilston Park" class="bkm-popup-logo">',
          '<span class="bkm-popup-title">Book Your Stay</span>',
          '<button class="bkm-popup-close" id="bkm-close-btn" aria-label="Close">&times;</button>',
        '</div>',
        '<div class="bkm-popup-body">',
          '<iframe id="bkm-booking-iframe" class="bkm-popup-iframe" src="about:blank" allowtransparency="1" frameborder="0" scrolling="yes" title="Hilston Park Booking"></iframe>',
        '</div>',
      '</div>',
    '</div>'
  ].join("");

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  var modal      = document.getElementById("booking-modal");
  var bookIframe = document.getElementById("bkm-booking-iframe");
  var closeBtn   = document.getElementById("bkm-close-btn");
  var iframeLoaded = false;

  function openModal() {
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (iframeLoaded === false) {
      bookIframe.src = QBOOK_RATES_SRC;
      iframeLoaded = true;
    }
  }
  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { closeModal(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) { closeModal(); }
  });

  /* -- resize the rates iframe via postMessage from QBook (accommodation page) -- */
  window.addEventListener("message", function (e) {
    var frame = document.getElementById(QBOOK_RATES_ID);
    if (frame && frame.contentWindow === e.source) {
      var h = (e.data && e.data.qbookheight) ? e.data.qbookheight + "px" : null;
      if (h) { frame.height = h; frame.style.height = h; }
    }
  });

  /* -- intercept ALL Book Now buttons/links across every page -- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest(".btn-book, .btn-pill, [data-book]");
    if (!el) { return; }
    var href = el.getAttribute("href") || "";
    if (href && href !== "#" && !href.startsWith("#booking")) { return; }
    e.preventDefault();
    openModal();
  });

});
