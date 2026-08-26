document.addEventListener("DOMContentLoaded", function () {

  /* =========================================================
     CREATE ACCESSIBILITY HTML
  ========================================================= */

  const accessibilityHTML = `
    <div id="hilston-accessibility-badge" aria-label="Accessibility Menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true" focusable="false">
        <circle cx="12" cy="4" r="2"></circle>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="12" y1="9" x2="12" y2="16"></line>
        <line x1="12" y1="16" x2="8" y2="22"></line>
        <line x1="12" y1="16" x2="16" y2="22"></line>
      </svg>
    </div>

    <div id="hilston-accessibility-sidebar">
      <div>

        <div class="hilston-header">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true" focusable="false">
              <circle cx="12" cy="4" r="2"></circle>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="12" y1="9" x2="12" y2="16"></line>
              <line x1="12" y1="16" x2="8" y2="22"></line>
              <line x1="12" y1="16" x2="16" y2="22"></line>
            </svg>
            Accessibility menu
          </h3>

          <button id="hilston-close-btn" type="button">
            ✕
          </button>
        </div>

        <div class="hilston-content">

          <!-- Accessibility Profiles -->
          <div class="hilston-section">
            <h4>Accessibility Profiles</h4>

            <div class="hilston-features-sec">

              <button type="button"
                class="hilston-profile-btn"
                data-profile="seizure">
                Seizure Safe
              </button>

              <button type="button"
                class="hilston-profile-btn"
                data-profile="adhd">
                ADHD Friendly
              </button>

              <button type="button"
                class="hilston-profile-btn"
                data-profile="lowvision">
                Low Vision
              </button>

            </div>
          </div>

          <!-- Typography -->
          <div class="hilston-section">
            <h4>Typography Controls</h4>

            <div class="hilston-features-sec">

              <button type="button" id="hilston-font-increase">
                Increase Font Size
              </button>

              <button type="button" id="hilston-font-decrease">
                Decrease Font Size
              </button>

              <button type="button" id="hilston-letter-spacing">
                Increase Letter Spacing
              </button>

              <button type="button" id="hilston-line-height">
                Increase Line Height
              </button>

              <button type="button" id="hilston-font-weight">
                Bold Font Weight
              </button>

              <button type="button" id="hilston-highlight-links">
                Highlight Links
              </button>

            </div>
          </div>

          <!-- Contrast & Saturation -->
          <div class="hilston-section">
            <h4>Contrast & Saturation</h4>

            <div class="hilston-features-sec">

              <button type="button" data-mode="dark">
                Dark
              </button>

              <button type="button" data-mode="light">
                Light
              </button>

              <button type="button"
                data-mode="low-saturation"
                style="display:none">
                Low Saturation
              </button>

              <button type="button"
                data-mode="grayscale"
                style="display:none">
                Grayscale
              </button>

            </div>
          </div>

          <!-- Motion & Audio -->
          <div class="hilston-section">
            <h4>Motion & Audio</h4>

            <div class="hilston-features-sec">

              <button type="button" id="hilston-pause-animations">
                Pause Animations
              </button>

              <button type="button" id="hilston-pause-videos">
                Pause Videos
              </button>

              <button type="button" id="hilston-mute-audio">
                Mute Audio
              </button>

            </div>
          </div>

          <!-- Reset -->
          <div class="hilston-section">
            <button type="button" id="hilston-reset">
              Reset Accessibility Settings
            </button>
          </div>

        </div>
      </div>
    </div>

    <!-- Reading Mask -->
    <div id="hilston-reading-mask" aria-hidden="true"></div>
  `;

  document.body.insertAdjacentHTML("beforeend", accessibilityHTML);


  /* =========================================================
     ELEMENTS
  ========================================================= */

  const html = document.documentElement;
  const body = document.body;

  const badge = document.getElementById(
    "hilston-accessibility-badge"
  );

  const sidebar = document.getElementById(
    "hilston-accessibility-sidebar"
  );

  const closeBtn = document.getElementById(
    "hilston-close-btn"
  );

  const readingMask = document.getElementById(
    "hilston-reading-mask"
  );


  /* =========================================================
     OPEN / CLOSE MENU
  ========================================================= */

  badge.addEventListener("click", function () {
    sidebar.classList.add("active");
  });

  closeBtn.addEventListener("click", function () {
    sidebar.classList.remove("active");
  });


  /* =========================================================
     FONT SIZE
  ========================================================= */

  const increaseSizes = [
    "hilston-font-scale-110",
    "hilston-font-scale-120",
    "hilston-font-scale-130",
    "hilston-font-scale-140",
    "hilston-font-scale-150",
    "hilston-font-scale-175",
    "hilston-font-scale-200"
  ];

  const decreaseSizes = [
    "hilston-font-scale-90",
    "hilston-font-scale-80",
    "hilston-font-scale-70",
    "hilston-font-scale-60",
    "hilston-font-scale-50"
  ];

  const allFontSizes = [
    ...increaseSizes,
    ...decreaseSizes
  ];

  let increaseIndex = -1;
  let decreaseIndex = -1;

  document
    .getElementById("hilston-font-increase")
    .addEventListener("click", function () {

      decreaseIndex = -1;

      if (increaseIndex < increaseSizes.length - 1) {

        increaseIndex++;

        html.classList.remove(...allFontSizes);

        html.classList.add(
          increaseSizes[increaseIndex]
        );
      }
    });


  document
    .getElementById("hilston-font-decrease")
    .addEventListener("click", function () {

      increaseIndex = -1;

      if (decreaseIndex < decreaseSizes.length - 1) {

        decreaseIndex++;

        html.classList.remove(...allFontSizes);

        html.classList.add(
          decreaseSizes[decreaseIndex]
        );
      }
    });


  /* =========================================================
     TYPOGRAPHY
  ========================================================= */

  document
    .getElementById("hilston-letter-spacing")
    .addEventListener("click", function () {

      html.classList.toggle(
        "hilston-letter-spacing"
      );
    });


  document
    .getElementById("hilston-line-height")
    .addEventListener("click", function () {

      html.classList.toggle(
        "hilston-line-height"
      );
    });


  document
    .getElementById("hilston-font-weight")
    .addEventListener("click", function () {

      html.classList.toggle(
        "hilston-bold-font"
      );
    });


  document
    .getElementById("hilston-highlight-links")
    .addEventListener("click", function () {

      html.classList.toggle(
        "hilston-highlight-links"
      );
    });


  /* =========================================================
     CONTRAST / SATURATION
  ========================================================= */

  document
    .querySelectorAll("[data-mode]")
    .forEach(function (button) {

      button.addEventListener("click", function () {

        const mode = button.dataset.mode;

        body.classList.remove(
          "hilston-dark-contrast",
          "hilston-light-contrast",
          "hilston-low-saturation",
          "hilston-grayscale"
        );

        if (mode === "dark") {
          body.classList.add(
            "hilston-dark-contrast"
          );
        }

        if (mode === "light") {
          body.classList.add(
            "hilston-light-contrast"
          );
        }

        if (mode === "low-saturation") {
          body.classList.add(
            "hilston-low-saturation"
          );
        }

        if (mode === "grayscale") {
          body.classList.add(
            "hilston-grayscale"
          );
        }

      });

    });


  /* =========================================================
     RESET PROFILE CLASSES
  ========================================================= */

  function resetProfiles() {

    html.classList.remove(
      "hilston-seizure-safe",
      "hilston-adhd",
      "hilston-low-vision",
      "hilston-stop-motion"
    );

    body.classList.remove(
      "hilston-seizure-safe",
      "hilston-adhd",
      "hilston-low-vision",
      "hilston-stop-motion"
    );

    readingMask.classList.remove("active");
  }


  /* =========================================================
     PAUSE ANIMATIONS
  ========================================================= */

  const pauseAnimations = document.getElementById(
    "hilston-pause-animations"
  );

  if (pauseAnimations) {

    pauseAnimations.addEventListener(
      "click",
      function () {

        html.classList.toggle(
          "hilston-stop-motion"
        );

      }
    );

  }


  /* =========================================================
     PAUSE VIMEO VIDEOS
  ========================================================= */

  document
    .getElementById("hilston-pause-videos")
    .addEventListener("click", function () {

      document
        .querySelectorAll('iframe[src*="vimeo.com"]')
        .forEach(function (iframe) {

          if (typeof Vimeo !== "undefined") {

            new Vimeo.Player(iframe)
              .pause()
              .catch(function (error) {
                console.log(error);
              });

          }

        });

    });

document
  .getElementById("hilston-pause-videos")
  .addEventListener("click", function () {

    // Pause all HTML5 videos
    document.querySelectorAll("video").forEach(function (video) {
      video.pause();
    });

    // Pause Vimeo videos if present
    if (typeof Vimeo !== "undefined") {
      document
        .querySelectorAll('iframe[src*="vimeo.com"]')
        .forEach(function (iframe) {
          try {
            new Vimeo.Player(iframe).pause().catch(function () {});
          } catch (error) {
            console.log(error);
          }
        });
    }

  });
  /* =========================================================
     MUTE VIMEO AUDIO
  ========================================================= */

  document
    .getElementById("hilston-mute-audio")
    .addEventListener("click", function () {

      document
        .querySelectorAll('iframe[src*="vimeo.com"]')
        .forEach(function (iframe) {

          if (typeof Vimeo !== "undefined") {

            new Vimeo.Player(iframe)
              .setVolume(0)
              .catch(function (error) {
                console.log(error);
              });

          }

        });

    });


  /* =========================================================
     ACCESSIBILITY PROFILES
  ========================================================= */

  document
    .querySelectorAll(".hilston-profile-btn")
    .forEach(function (button) {

      button.addEventListener("click", function () {

        resetProfiles();

        const profile = button.dataset.profile;


        /* -------------------------
           SEIZURE SAFE
        ------------------------- */

        if (profile === "seizure") {

          html.classList.add(
            "hilston-seizure-safe"
          );

          html.classList.add(
            "hilston-stop-motion"
          );

          document
            .querySelectorAll("video")
            .forEach(function (video) {
              video.pause();
            });


          document
            .querySelectorAll('iframe[src*="vimeo.com"]')
            .forEach(function (iframe) {

              if (typeof Vimeo !== "undefined") {

                try {

                  new Vimeo.Player(iframe)
                    .pause()
                    .catch(function () {});

                } catch (error) {
                  console.log(error);
                }

              }

            });

        }


        /* -------------------------
           ADHD FRIENDLY
        ------------------------- */

        if (profile === "adhd") {

          body.classList.add(
            "hilston-adhd"
          );

          html.classList.add(
            "hilston-stop-motion"
          );

          readingMask.classList.add(
            "active"
          );

        }


        /* -------------------------
           LOW VISION
        ------------------------- */

        if (profile === "lowvision") {

          body.classList.add(
            "hilston-bold-font"
          );

          body.classList.add(
            "hilston-low-vision"
          );

        }

      });

    });


  /* =========================================================
     READING MASK MOVEMENT
  ========================================================= */

  document.addEventListener(
    "mousemove",
    function (event) {

      if (
        readingMask &&
        readingMask.classList.contains("active")
      ) {

        readingMask.style.top =
          (event.clientY - 75) + "px";

      }

    }
  );


  /* =========================================================
     RESET EVERYTHING
  ========================================================= */

  document
    .getElementById("hilston-reset")
    .addEventListener("click", function () {

      html.classList.remove(
        "hilston-seizure-safe",
        "hilston-adhd",
        "hilston-low-vision",
        "hilston-stop-motion",
        "hilston-font-scale-110",
        "hilston-font-scale-120",
        "hilston-font-scale-130",
        "hilston-font-scale-140",
        "hilston-font-scale-150",
        "hilston-font-scale-175",
        "hilston-font-scale-200",
        "hilston-font-scale-90",
        "hilston-font-scale-80",
        "hilston-font-scale-70",
        "hilston-font-scale-60",
        "hilston-font-scale-50",
        "hilston-letter-spacing",
        "hilston-line-height",
        "hilston-bold-font",
        "hilston-highlight-links"
      );


      body.classList.remove(
        "hilston-seizure-safe",
        "hilston-adhd",
        "hilston-low-vision",
        "hilston-stop-motion",
        "hilston-dark-contrast",
        "hilston-light-contrast",
        "hilston-low-saturation",
        "hilston-grayscale",
        "hilston-bold-font"
      );


      readingMask.classList.remove(
        "active"
      );


      /* Reset audio */

      document
        .querySelectorAll("audio")
        .forEach(function (audio) {

          audio.muted = false;

        });


      /* Reset Vimeo volume */

      document
        .querySelectorAll('iframe[src*="vimeo.com"]')
        .forEach(function (iframe) {

          if (typeof Vimeo !== "undefined") {

            try {

              new Vimeo.Player(iframe)
                .setVolume(1)
                .catch(function () {});

            } catch (error) {
              console.log(error);
            }

          }

        });


      /* Reset font indexes */

      increaseIndex = -1;
      decreaseIndex = -1;


      /* Reset stored settings */

      localStorage.removeItem(
        "hilston-font-size"
      );

    });

});