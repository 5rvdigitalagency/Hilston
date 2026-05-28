/* Hilston Park  --  script.js */
document.addEventListener("DOMContentLoaded", function () {

  /* ---- Accordion ---- */
  var items = document.querySelectorAll(".accordion-item");
  items.forEach(function (item) {
    var btn = item.querySelector(".accordion-btn");
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      items.forEach(function (i) { i.classList.remove("open"); });
      if (\!isOpen) { item.classList.add("open"); }
    });
  });

  /* ---- Mobile nav toggle (hamburger placeholder) ---- */
  /* Nav wraps on small screens via CSS flex-wrap; no JS needed */

});
