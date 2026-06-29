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
      '<a class="bma-mnav-cta" href="get-started.html">Sign In</a>';
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

  /* ---- FAQ accordion ---- */
  function initFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var btn = item.querySelector(".faq-btn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var open = item.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* ---- Use-case accordion ---- */
  function initUseCases() {
    document.querySelectorAll(".uc-row").forEach(function (row) {
      var trigger = row.querySelector(".uc-trigger");
      var detail = row.querySelector(".uc-detail");
      if (!trigger) return;
      trigger.addEventListener("click", function () {
        var open = row.classList.toggle("uc-row--open");
        if (detail) detail.classList.toggle("uc-detail--open", open);
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
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

  /* ---- Get-started: enable submit when fields filled ---- */
  function initAuthForm() {
    var form = document.querySelector(".auth-form");
    if (!form) return;
    var btn = form.querySelector(".auth-btn-primary");
    var inputs = form.querySelectorAll("input[required]");
    function check() {
      if (form.dataset.done) return;
      var ok = true;
      inputs.forEach(function (i) {
        if (!i.value.trim()) ok = false;
      });
      if (btn) btn.disabled = !ok;
    }
    inputs.forEach(function (i) {
      i.addEventListener("input", check);
    });
    check();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!btn) return;
      form.dataset.done = "1";
      btn.disabled = true;
      btn.innerHTML =
        '<span class="auth-spinner" aria-hidden="true"></span>Creating your workspace';
      setTimeout(function () {
        btn.innerHTML = "Thanks - we'll be in touch.";
      }, 1100);
    });
  }

  /* ---- Newsletter: no-op submit ---- */
  function initNewsletter() {
    document.querySelectorAll(".ft__nws-row").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = form.querySelector(".ft__nws-btn");
        if (btn) btn.textContent = "Subscribed";
      });
    });
  }

  function init() {
    initNav();
    initFaq();
    initUseCases();
    initReveal();
    initAuthForm();
    initNewsletter();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
