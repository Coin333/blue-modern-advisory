/* Blue Modern Advisory - motion & polish orchestration ("clay.com" pass).
   Progressive enhancement only: every effect is optional and degrades to the
   plain site if a dependency, API, or capability is missing. Pairs with
   css/enhancements.css. Loaded as a module (deferred by default). */

const mqReduce =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
const reduceMotion = !!(mqReduce && mqReduce.matches);
const finePointer =
  window.matchMedia &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ---- Skip link + main landmark + count-up markup (no HTML edits needed) -- */
function initA11yAndStats() {
  // Skip link as the first focusable element.
  if (!document.querySelector(".bma-skip")) {
    const skip = document.createElement("a");
    skip.className = "bma-skip";
    skip.href = "#main";
    skip.textContent = "Skip to content";
    document.body.insertBefore(skip, document.body.firstChild);
  }
  // Ensure a focusable #main landmark for the skip link to target. Some pages
  // wrap content in a <div> (.about-page / .auth-shell) with no <main>, which
  // is not focusable by default, so make whatever we target programmatically
  // focusable and move focus on activation.
  if (!document.getElementById("main")) {
    const main =
      document.querySelector("main") ||
      document.querySelector(".about-page") ||
      document.querySelector(".auth-shell");
    if (main) main.id = "main";
  }
  const mainEl = document.getElementById("main");
  if (mainEl && !mainEl.hasAttribute("tabindex")) {
    mainEl.setAttribute("tabindex", "-1");
    mainEl.style.outline = "none";
  }
  const skipLink = document.querySelector(".bma-skip");
  if (skipLink) {
    skipLink.addEventListener("click", () => {
      const t = document.getElementById("main");
      if (t) requestAnimationFrame(() => t.focus({ preventScroll: false }));
    });
  }
  // Wrap the leading number of the social-proof line for count-up.
  const proof = document.querySelector(".trusted-recommend strong");
  if (proof && !proof.querySelector(".bma-count")) {
    const m = proof.textContent.match(/^(\d+)(\+?)([\s\S]*)$/);
    if (m) {
      proof.textContent = "";
      const span = document.createElement("span");
      span.className = "bma-count";
      span.setAttribute("data-count-to", m[1]);
      span.textContent = m[1];
      proof.appendChild(span);
      proof.appendChild(document.createTextNode(m[2] + m[3]));
    }
  }
}

/* ---- Decorative layers injected once (keeps the 4 HTML files clean) ------ */
function injectDecor() {
  if (document.querySelector(".bma-mesh")) return; // idempotent
  const frag = document.createDocumentFragment();

  const mesh = document.createElement("div");
  mesh.className = "bma-mesh";
  mesh.setAttribute("aria-hidden", "true");
  frag.appendChild(mesh);

  const progress = document.createElement("div");
  progress.className = "bma-progress";
  progress.setAttribute("aria-hidden", "true");
  frag.appendChild(progress);

  // Grain is a fixed, full-viewport blended layer: only worth its compositor
  // cost on capable, non-touch displays and when motion is allowed.
  if (finePointer && !reduceMotion) {
    const grain = document.createElement("div");
    grain.className = "bma-grain";
    grain.setAttribute("aria-hidden", "true");
    frag.appendChild(grain);
  }

  document.body.appendChild(frag);
}

/* ---- Scroll-coupled UI: progress bar, condensing nav, marquee velocity --- */
function getMarquees() {
  return document.querySelectorAll(".trusted-marquee-outer");
}

function initScrollCoupled(getScroll) {
  const docEl = document.documentElement;
  const navWrap = document.querySelector(".nav-wrapper");
  const navPill = document.querySelector(".nav-pill");
  const marquees = getMarquees();

  function update(scrollY, velocity) {
    const max = docEl.scrollHeight - window.innerHeight;
    const progress = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
    docEl.style.setProperty("--bma-progress", progress.toFixed(4));

    if (navWrap) navWrap.classList.toggle("is-scrolled", scrollY > 24);
    if (navPill) navPill.classList.toggle("nav-pill--scrolled", scrollY > 24);

    if (!reduceMotion && marquees.length) {
      const skew = clamp((velocity || 0) * 0.18, -4, 4);
      marquees.forEach((m) => {
        m.style.transform = `skewX(${skew.toFixed(2)}deg)`;
      });
    }
  }

  // Prime once, then drive from whatever scroll source is provided.
  update(getScroll().y, 0);
  return update;
}

/* ---- Magnetic CTAs (fine pointer, motion allowed) ----------------------- */
function initMagnetic() {
  if (reduceMotion || !finePointer) return;
  const targets = document.querySelectorAll(
    ".pricing-cta-primary, .final-cta-btn-primary, " +
      ".ft__cta-btn, .auth-btn-primary",
  );
  targets.forEach((el) => {
    el.classList.add("bma-magnetic");
    const strength = 0.32;
    // Measure the resting rect (translate is 0 here) so the pull is computed
    // from the true center, not the already-displaced one.
    let rest = null;
    const measure = () => {
      rest = el.getBoundingClientRect();
    };
    el.addEventListener("pointerenter", measure);
    el.addEventListener("pointermove", (e) => {
      if (!rest) measure();
      const dx = (e.clientX - (rest.left + rest.width / 2)) * strength;
      const dy = (e.clientY - (rest.top + rest.height / 2)) * strength;
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.translate = "0 0";
      rest = null;
    });
  });
}

/* ---- Count-up stats ----------------------------------------------------- */
function initCountUp() {
  const els = document.querySelectorAll(".bma-count[data-count-to]");
  if (!els.length) return;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => {
      el.textContent = el.getAttribute("data-count-to");
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        const to = parseInt(el.getAttribute("data-count-to"), 10) || 0;
        const dur = 1200;
        let start = null;
        function tick(ts) {
          if (start === null) start = ts;
          const p = clamp((ts - start) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(to * eased).toString();
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = to.toString();
        }
        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}

/* ---- Form micro-feedback: light the dormant valid state ----------------- */
function initFormFeedback() {
  const form = document.querySelector(".auth-form");
  if (!form) return;
  form.querySelectorAll(".auth-field").forEach((field) => {
    const input = field.querySelector("input");
    if (!input) return;
    const sync = () => {
      const ok = input.value.trim() !== "" && input.checkValidity();
      field.classList.toggle("is-valid", ok);
    };
    input.addEventListener("input", sync);
    input.addEventListener("blur", sync);
  });
}

/* ---- Smooth in-page anchor scrolling via Lenis -------------------------- */
function initAnchors(lenis) {
  document.querySelectorAll('a[href*="#"]').forEach((a) => {
    const url = a.getAttribute("href");
    const hash = url.slice(url.indexOf("#"));
    if (hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return; // hash must resolve in THIS document to be same-page
    const base = url.split("#")[0];
    const last = location.pathname.split("/").pop();
    const samePage =
      base === "" ||
      base === last ||
      ((location.pathname === "/" || location.pathname.endsWith("/")) &&
        /^index\.html?$/i.test(base));
    if (!samePage) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -90 });
      else target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---- Cross-page transition: fade the current page out, then navigate ---- */
function initPageTransitions() {
  if (reduceMotion) return;
  const docEl = document.documentElement;

  // Returning via the back/forward cache must clear the leaving state so the
  // restored page is not stuck faded out.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) docEl.classList.remove("bma-leaving");
  });

  document.addEventListener("click", (e) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return; // let modified clicks (open-in-new-tab etc.) behave normally
    }
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const raw = a.getAttribute("href");
    if (!raw || raw.startsWith("#")) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try {
      url = new URL(a.href, location.href);
    } catch (_) {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== location.origin) return; // external link: normal nav
    if (url.href === location.href) return;
    // pure in-page anchor (same path + hash) is handled by smooth scrolling
    if (url.pathname === location.pathname && url.hash) return;
    // Per request: only crossfade when navigating TO the home page.
    const lastSeg = url.pathname.split("/").pop();
    if (lastSeg !== "" && !/^index\.html?$/i.test(lastSeg)) return;
    e.preventDefault();
    docEl.classList.add("bma-leaving");
    setTimeout(() => {
      window.location.href = url.href;
    }, 230);
  });
}

/* ---- Boot --------------------------------------------------------------- */
async function boot() {
  initA11yAndStats();
  injectDecor();
  initMagnetic();
  initCountUp();
  initFormFeedback();
  initPageTransitions();

  let lenis = null;
  let onScroll = null;

  // Native scroll only. Smooth-scroll libraries (Lenis) drive scrolling from a
  // main-thread rAF loop, so they stutter whenever that thread is busy (e.g. the
  // hero WebGL render). Native scroll runs on the compositor thread and stays
  // smooth regardless. `lenis` stays null, so the native path below runs.

  // Fallback (reduced motion OR Lenis failed): native scroll listener. Native
  // scroll fires no event at rest, so debounce a trailing reset to settle the
  // marquee skew back to 0 instead of freezing at the last velocity.
  if (!lenis) {
    onScroll = initScrollCoupled(() => ({ y: window.scrollY }));
    let lastY = window.scrollY;
    let settle = 0;
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        onScroll(y, y - lastY);
        lastY = y;
        clearTimeout(settle);
        settle = setTimeout(() => onScroll(window.scrollY, 0), 120);
      },
      { passive: true },
    );
  }

  initAnchors(lenis);

  // Honor a live switch to reduced motion (common AT workflow): stop Lenis and
  // reset the marquee skew so JS state matches the CSS reduced-motion guards.
  if (mqReduce && mqReduce.addEventListener) {
    mqReduce.addEventListener("change", (e) => {
      if (!e.matches) return;
      if (lenis) {
        try {
          lenis.destroy();
        } catch (_) {
          /* ignore */
        }
        lenis = null;
      }
      getMarquees().forEach((m) => {
        m.style.transform = "";
      });
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
