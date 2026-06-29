/* Blue Modern Advisory - static site interactions */
(function () {
  "use strict";

  /* ---- Mobile nav ---- */
  function initNav() {
    var burger = document.querySelector(".nav-hamburger");
    var pill = document.querySelector(".nav-pill");
    if (!burger || !pill) return;

    var menu = document.createElement("div");
    menu.className = "bma-mnav";
    menu.innerHTML =
      '<a href="index.html">Home</a>' +
      '<a href="capabilities.html">Capabilities</a>' +
      '<a href="about.html">About</a>' +
      '<a class="bma-mnav-cta" href="https://calendly.com/bluemodernadvisory/30min" target="_blank" rel="noreferrer noopener">Book a Call</a>';
    document.body.appendChild(menu);

    function close() {
      menu.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") close();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) close();
    });
  }

  /* ---- FAQ accordion: single-open, height-animated reveal (set to the
     answer's true height so it never clips), and the opened item eases into
     view on the Lenis smooth scroll so its answer never opens off-screen ---- */
  function initFaq() {
    var items = Array.prototype.slice.call(
      document.querySelectorAll(".faq-item"),
    );
    function setOpen(item, open) {
      item.classList.toggle("open", open);
      var btn = item.querySelector(".faq-btn");
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    items.forEach(function (item) {
      var btn = item.querySelector(".faq-btn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var willOpen = !item.classList.contains("open");
        items.forEach(function (other) {
          if (other !== item) setOpen(other, false); // single-open
        });
        setOpen(item, willOpen);
        if (
          willOpen &&
          window.lenis &&
          typeof window.lenis.scrollTo === "function"
        ) {
          window.lenis.scrollTo(item, { offset: -130, duration: 0.8 });
        }
      });
    });
  }

  /* ---- FAQ connector rail: fill it from the Lenis-smoothed scroll so the rail
     tracks how far you've read down the list (the section's scroll tie) ---- */
  function initFaqRail() {
    var list = document.querySelector(".faq-list");
    if (!list) return;
    var clamp = function (v, a, b) {
      return v < a ? a : v > b ? b : v;
    };
    function apply() {
      var r = list.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var focus = vh * 0.34; // read-line: the rail fills as the list passes it
      var p = clamp((focus - r.top) / (r.height || 1), 0, 1);
      list.style.setProperty("--faq-p", p.toFixed(4));
    }
    var last = NaN;
    function loop() {
      var y = window.lenis ? window.lenis.scroll : window.scrollY;
      if (y !== last) {
        last = y;
        apply();
      }
      requestAnimationFrame(loop);
    }
    apply();
    requestAnimationFrame(loop);
  }

  /* ---- Use-case showcase: tab selector + cross-fading stage. Gently
     auto-advances while in view and pauses for good on first interaction.
     Proper tabs pattern (arrow-key nav, roving tabindex). ---- */
  function initUseCases() {
    var showcase = document.querySelector("[data-uc-showcase]");
    if (!showcase) return;
    var tabs = [].slice.call(showcase.querySelectorAll(".uc-tab"));
    var panels = [].slice.call(showcase.querySelectorAll(".uc-panel"));
    if (tabs.length < 2 || panels.length !== tabs.length) return;
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var current = 0;

    function select(i, focus) {
      i = (i + tabs.length) % tabs.length;
      current = i;
      // Sweep all tabs so the connector "trail" (.is-filled on every tab above
      // the active one) and the active state stay in sync on any jump.
      tabs.forEach(function (tab, k) {
        var active = k === i;
        tab.classList.toggle("is-active", active);
        tab.classList.toggle("is-filled", k < i);
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
        panels[k].classList.toggle("is-active", active);
      });
      if (focus) tabs[i].focus();
    }

    // gentle auto-advance, gated to when the section is on screen
    var AUTO_MS = 5500;
    var timer = 0;
    var paused = false;
    var inView = false;
    function startTimer() {
      if (timer || paused || reduce) return;
      timer = setInterval(function () {
        if (!paused && inView) select(current + 1, false);
      }, AUTO_MS);
    }
    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = 0;
      }
    }
    function pausePermanently() {
      paused = true;
      stopTimer();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        pausePermanently();
        select(i, false);
      });
      tab.addEventListener("keydown", function (e) {
        var k = e.key;
        if (k === "ArrowDown" || k === "ArrowRight") {
          e.preventDefault();
          pausePermanently();
          select(current + 1, true);
        } else if (k === "ArrowUp" || k === "ArrowLeft") {
          e.preventDefault();
          pausePermanently();
          select(current - 1, true);
        } else if (k === "Home") {
          e.preventDefault();
          pausePermanently();
          select(0, true);
        } else if (k === "End") {
          e.preventDefault();
          pausePermanently();
          select(tabs.length - 1, true);
        }
      });
    });
    // first hover/interaction anywhere on the showcase stops the auto-tour
    showcase.addEventListener("pointerenter", pausePermanently);

    // .is-live (added the first time the showcase scrolls into view) gates the
    // diagrams' build animations in CSS, so each diagram assembles itself on
    // arrival and again whenever its tab is selected - never off-screen.
    function goLive() {
      showcase.classList.add("is-live");
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            inView = e.isIntersecting;
            if (inView) {
              goLive();
              startTimer();
            } else {
              stopTimer();
            }
          });
        },
        { threshold: 0.25 },
      );
      io.observe(showcase);
    } else {
      inView = true;
      goLive();
      startTimer();
    }
  }

  /* ---- Scroll reveal (progressive enhancement) ---- */
  function initReveal() {
    var sel = [
      ".bridge-text",
      ".bridge-card",
      ".pricing-header",
      ".pricing-card",
      ".uc-header",
      ".uc-row",
      ".faq-list",
      ".cap-overview-hero",
      ".cap-matrix-row",
      ".delivery-card",
      ".cc-header",
      ".about-team-card",
      ".reviewer-group",
      ".trusted-stars-row",
      ".trusted-label",
    ].join(",");
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (!els.length) return;

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No observer support or reduced motion -> leave everything visible.
    if (reduce || !("IntersectionObserver" in window)) return;

    els.forEach(function (el) {
      el.classList.add("bma-reveal");
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("bma-reveal--in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach(function (el) {
      io.observe(el);
    });

    // Fail-safe: never let content stay cloaked. Anything still hidden after a
    // beat (captured below the fold, observer never fired) gets revealed.
    setTimeout(function () {
      els.forEach(function (el) {
        el.classList.add("bma-reveal--in");
      });
    }, 1400);
  }

  /* ---- Newsletter: open a real email instead of faking a subscribe ----
     There is no newsletter backend yet, so rather than flip the button to
     "Subscribed" and silently discard the address, open a pre-filled email to
     the firm. Honest, and it actually reaches someone. ---- */
  function initNewsletter() {
    document.querySelectorAll(".ft__nws-row").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector(".ft__nws-input");
        var email = input && input.value ? input.value.trim() : "";
        var btn = form.querySelector(".ft__nws-btn");
        var subject = encodeURIComponent("Subscribe to BMA insights");
        var body = encodeURIComponent(
          "Please add " +
            (email || "me") +
            " to the Blue Modern Advisory insights list.",
        );
        window.location.href =
          "mailto:reem@bluemodernadvisory.com?subject=" +
          subject +
          "&body=" +
          body;
        if (btn) btn.textContent = "Opening email";
      });
    });
  }

  function init() {
    initNav();
    initFaq();
    initFaqRail();
    initUseCases();
    initReveal();
    initNewsletter();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
