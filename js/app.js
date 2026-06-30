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
    // the horizontally-scrollable pill rail; the active pill is centered in it
    var selector = showcase.querySelector(".uc-selector");
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var current = 0;

    // ---- Auto-advance: one rAF clock fills a progress bar on the active pill;
    // when it tops out, selection advances to the next use case. The clock
    // freezes (the bar simply holds) while the section is hovered, keyboard-
    // focused, or off-screen, and never runs under reduced motion. ----
    var AUTO_MS = 5200;
    var elapsed = 0; // ms banked toward the next advance
    var lastTs = 0; // previous rAF timestamp (0 = clock parked)
    var raf = 0;
    var inView = false;
    var hovered = false;
    var focused = false;

    function setProgress(p) {
      // only the active pill renders a bar, so only its var needs updating
      tabs[current].style.setProperty("--uc-progress", p);
    }
    function isKeyboardFocus(el) {
      // pause for keyboard focus, not for a mouse click that focuses the button
      try {
        return el.matches(":focus-visible");
      } catch (_) {
        return false;
      }
    }

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
      elapsed = 0; // restart the dwell clock for the newly active pill
      setProgress(0);
      // keep the active pill in view in the rail (so it's never half-off-screen
      // on a phone). Only scroll when the pill is actually clipped - on desktop
      // every pill fits, and a no-op smooth-scroll still repaints the masked
      // rail on each advance, which stutters.
      if (selector) {
        var sr = selector.getBoundingClientRect();
        var tr = tabs[i].getBoundingClientRect();
        if (tr.left < sr.left + 8 || tr.right > sr.right - 8) {
          var delta = tr.left + tr.width / 2 - (sr.left + sr.width / 2);
          selector.scrollTo({
            left: selector.scrollLeft + delta,
            behavior: reduce ? "auto" : "smooth",
          });
        }
      }
      if (focus) tabs[i].focus({ preventScroll: true });
    }

    var running = false; // true only while the bar is actively filling
    function setRunning(on) {
      if (on === running) return;
      running = on;
      // CSS fades the bar in while this class is present, out when it's gone
      showcase.classList.toggle("uc-running", on);
    }

    function tick(ts) {
      raf = 0;
      var go = inView && !hovered && !focused;
      setRunning(go);
      if (go) {
        if (lastTs) {
          elapsed += ts - lastTs;
          if (elapsed >= AUTO_MS) {
            select(current + 1, false); // resets elapsed + bar to 0
          } else {
            setProgress(elapsed / AUTO_MS);
          }
        }
        lastTs = ts;
      } else {
        lastTs = 0; // parked: drop the stale delta so resuming never jumps
      }
      if (inView && !reduce) raf = requestAnimationFrame(tick);
    }
    function startLoop() {
      if (reduce || raf) return;
      lastTs = 0;
      raf = requestAnimationFrame(tick);
    }
    function stopLoop() {
      setRunning(false);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    // Pause while the pointer is actively over the pill rail (so a pill never
    // slides out from under you as you reach for it) and while a pill holds
    // keyboard focus. The hover flag self-clears on a timeout: a wheel-scroll
    // fires no pointerleave, so without it the bar could freeze for good.
    var hoverTO = 0;
    var hoverRail = selector || showcase;
    function holdForHover() {
      hovered = true;
      if (hoverTO) clearTimeout(hoverTO);
      hoverTO = setTimeout(function () {
        hovered = false;
        lastTs = 0;
      }, 900);
    }
    function clearHover() {
      if (hoverTO) {
        clearTimeout(hoverTO);
        hoverTO = 0;
      }
      hovered = false;
      lastTs = 0;
    }
    hoverRail.addEventListener("pointermove", holdForHover);
    hoverRail.addEventListener("pointerleave", clearHover);
    showcase.addEventListener("focusin", function (e) {
      if (isKeyboardFocus(e.target)) focused = true;
    });
    showcase.addEventListener("focusout", function () {
      focused = false;
      lastTs = 0;
    });

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        select(i, false); // jump + restart the clock; the cycle keeps running
      });
      tab.addEventListener("keydown", function (e) {
        var k = e.key;
        if (k === "ArrowDown" || k === "ArrowRight") {
          e.preventDefault();
          select(current + 1, true);
        } else if (k === "ArrowUp" || k === "ArrowLeft") {
          e.preventDefault();
          select(current - 1, true);
        } else if (k === "Home") {
          e.preventDefault();
          select(0, true);
        } else if (k === "End") {
          e.preventDefault();
          select(tabs.length - 1, true);
        }
      });
    });

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
              startLoop();
            } else {
              // leaving the viewport clears any held hover/focus so the bar
              // always resumes (and re-fades-in) cleanly when it scrolls back
              hovered = false;
              focused = false;
              stopLoop();
            }
          });
        },
        { threshold: 0.25 },
      );
      io.observe(showcase);
    } else {
      inView = true;
      goLive();
      startLoop();
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
