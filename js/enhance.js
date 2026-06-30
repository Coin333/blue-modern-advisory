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

    // Velocity skew is a fine-pointer flourish only. On touch the scroll-velocity
    // signal is coarse and jumpy, so skewing the marquee made it look blocky -
    // leave the ticker unskewed there so it runs smoothly.
    if (!reduceMotion && finePointer && marquees.length) {
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
      ".auth-btn-primary, .about-close-btn",
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

/* ---- Capabilities "four systems" stacking showcase ----------------------
   Sticky cards layer over one another; the covered card recedes (scale + dim)
   behind the incoming one. Coverage is derived from the NEXT card's top vs the
   pin line and this card's *layout* height (offsetHeight, unaffected by the
   transform we apply), so a card's recede never feeds back into its own
   measurement. Runs only while the section is on screen; the `is-active` class
   also gates the SVG illustration motion (see styles.css). */
function initPipelineStack() {
  const stack = document.querySelector(".bma-stack");
  if (!stack) return;
  const cards = Array.prototype.slice.call(
    stack.querySelectorAll(".bma-stack-card"),
  );
  if (!cards.length) return;

  // Reduced motion / no observer: render static, fully-stacked, no recede.
  if (reduceMotion || !("IntersectionObserver" in window)) {
    stack.classList.add("is-active");
    return;
  }

  // Touch / coarse-pointer / small screens: do NOT fake-pin the deck. The
  // transform pin is driven by the Lenis-smoothed scroll (syncTouch off), so on
  // a phone it fights momentum scroll and feels like it locks you in place. Let
  // the cards flow naturally; just light the per-card SVG build animations as the
  // deck scrolls into view (is-active gates them in CSS).
  const noPin = !finePointer || window.innerWidth < 768;
  if (noPin) {
    const io = new IntersectionObserver(
      (entries) =>
        stack.classList.toggle("is-active", entries[0].isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(stack);
    return;
  }

  // position:sticky is broken site-wide (html/body overflow-x:hidden), so the
  // deck never pins on its own and the cards just scroll past. We fake the pin
  // with a transform tied to the (Lenis-smoothed) scroll: each card holds at
  // its staggered CSS `top` line once scrolled to, until the stack's own bottom
  // would push it out - exactly what sticky would do - then the whole deck
  // scrolls away. Natural geometry is measured once with transforms cleared and
  // cached, so a card's pin never feeds back into its own measurement.
  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  let cardTops = []; // natural document-top of each card (no transform)
  let cardHs = []; // natural layout height (unaffected by transform)
  let pinLines = []; // the CSS `top` line each card pins at (the deck stagger)
  let containerBottom = 0;
  let measured = false;
  function measure() {
    cards.forEach((c) => (c.style.transform = "")); // read natural positions
    const sp = scrollPos();
    cardTops = cards.map((c) => c.getBoundingClientRect().top + sp);
    cardHs = cards.map((c) => c.offsetHeight || 1);
    pinLines = cards.map((c) => parseFloat(getComputedStyle(c).top) || 0);
    containerBottom = stack.getBoundingClientRect().bottom + sp;
    measured = true;
  }

  let active = false;
  let rafId = 0;

  function frame() {
    if (!active) {
      rafId = 0;
      return;
    }
    if (!measured) measure();
    const sp = scrollPos();
    const buildStart = (window.innerHeight || 800) * 0.92;

    // pin each card: translate it down to hold at its line once scrolled to,
    // clamped so it can't escape past the bottom of the stack
    const tY = [];
    const viewTop = []; // each card's resulting viewport-top after the pin
    for (let i = 0; i < cards.length; i++) {
      const pinStart = cardTops[i] - pinLines[i];
      const maxT = Math.max(0, containerBottom - (cardTops[i] + cardHs[i]));
      const t = clamp(sp - pinStart, 0, maxT);
      tY[i] = t;
      viewTop[i] = cardTops[i] - sp + t;
    }

    for (let i = 0; i < cards.length; i++) {
      // `--p` scrubs the SVG assembly: 0 entering, 1 once the card is pinned
      const denom = buildStart - pinLines[i] || 1;
      const p =
        viewTop[i] <= pinLines[i] + 24
          ? 1
          : clamp((buildStart - viewTop[i]) / denom, 0, 1);
      cards[i].style.setProperty("--p", p.toFixed(3));

      // recede: tilt + dim each covered card back behind the incoming one
      let transform = "translateY(" + tY[i].toFixed(1) + "px)";
      if (i < cards.length - 1) {
        const coverage = clamp(
          1 - (viewTop[i + 1] - pinLines[i + 1]) / cardHs[i],
          0,
          1,
        );
        if (coverage > 0) {
          transform +=
            " perspective(1100px) rotateX(" +
            (coverage * 7).toFixed(2) +
            "deg) scale(" +
            (1 - coverage * 0.02).toFixed(4) +
            ")";
          cards[i].style.opacity = (1 - coverage * 0.18).toFixed(3);
        } else {
          cards[i].style.opacity = "";
        }
      }
      cards[i].style.transform = transform;
    }
    rafId = requestAnimationFrame(frame);
  }

  // Start every card un-built so each assembles as it scrolls in (rather than
  // flashing complete-then-empty when the section first intersects).
  cards.forEach((c) => c.style.setProperty("--p", "0"));

  const io = new IntersectionObserver(
    (entries) => {
      active = entries[0].isIntersecting;
      stack.classList.toggle("is-active", active);
      if (active) {
        if (!rafId) rafId = requestAnimationFrame(frame);
      } else {
        cards.forEach((c) => {
          c.style.transform = "";
          c.style.opacity = "";
        });
      }
    },
    { threshold: 0, rootMargin: "0px 0px -10% 0px" },
  );
  io.observe(stack);
  window.addEventListener("resize", () => {
    measured = false; // re-measure natural geometry after a layout change
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

/* ---- About page: scroll-scrubbed "wired editorial spread" ----------------
   Everything on the About page is tied to the smoothed Lenis scroll. Per
   section we publish three CSS custom properties the stylesheet consumes:
     --aw-in   0..1  entrance progress (content rises + fades in)
     --aw-fill 0..1  how far the left spine wire has drawn down the section
     --aw-par  px    parallax offset for the header node-field
   plus a page-level --aw-vel (0..1) scroll-velocity charge that glows the
   heading beads. The CSS falls back to the finished state (var(..., 1)) so a
   no-JS or reduced-motion visit shows the page fully drawn and static.
   Returns an update(scrollY, velocity) the boot loop feeds each scroll frame,
   or null when there is nothing to drive. */
function initAboutScroll() {
  const page = document.querySelector(".about-page");
  if (!page) return null;
  const sections = Array.prototype.slice.call(page.querySelectorAll(".aw"));
  if (!sections.length) return null;

  const setFinal = () => {
    sections.forEach((s) => {
      s.style.setProperty("--aw-in", "1");
      s.style.setProperty("--aw-fill", "1");
      s.style.setProperty("--aw-par", "0px");
    });
    page.style.setProperty("--aw-vel", "0");
  };

  // Motion off: draw everything finished, drive nothing.
  if (reduceMotion) {
    setFinal();
    return null;
  }

  // Cache each section's absolute top + height so per-frame work is pure
  // arithmetic (no layout reads while scrolling). Re-measure when the viewport,
  // fonts, or team photos change the geometry.
  let metrics = [];
  const measure = () => {
    const sy = window.lenis ? window.lenis.scroll : window.scrollY;
    metrics = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return { top: r.top + sy, height: r.height || 1 };
    });
  };
  measure();
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure).catch(() => {});
  }
  page.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", measure, { once: true });
  });

  return function updateAboutScroll(scrollY, velocity) {
    const H = window.innerHeight || 800;
    for (let i = 0; i < sections.length; i++) {
      const m = metrics[i];
      if (!m) continue;
      const top = m.top - scrollY; // viewport-relative top this frame
      // entrance: 0 as the section crosses the bottom edge, 1 after it has
      // travelled ~40% of the viewport upward.
      const pIn = clamp((H - top) / (H * 0.42), 0, 1);
      // spine fill: a reading line at mid-viewport sweeps the section top->bottom.
      const pFill = clamp((H * 0.52 - top) / (m.height * 0.72), 0, 1);
      // parallax: signed distance of the section center from the viewport center.
      const center = (top + m.height / 2 - H / 2) / H;
      const s = sections[i];
      s.style.setProperty("--aw-in", pIn.toFixed(3));
      s.style.setProperty("--aw-fill", pFill.toFixed(3));
      s.style.setProperty(
        "--aw-par",
        (clamp(center, -1.2, 1.2) * 20).toFixed(1) + "px",
      );
    }
    page.style.setProperty(
      "--aw-vel",
      clamp(Math.abs(velocity || 0) * 0.015, 0, 1).toFixed(3),
    );
  };
}

/* ---- Use Cases: the wired, self-opening list (homepage #use-cases) --------
   A pipeline spine fills as you scroll; each row's node bead lights when the
   reading line passes it, and the row nearest the line auto-opens. Click and
   keyboard (the app.js accordion) keep working; reduced motion gets a full
   spine, lit beads, and the plain click accordion. Returns update(scrollY) the
   boot loop feeds each scroll frame, or null when the section is absent. */
function initUseCases() {
  const list = document.querySelector(".uc-list");
  if (!list) return null;
  const rows = Array.prototype.slice.call(list.querySelectorAll(".uc-row"));
  if (!rows.length) return null;
  const triggers = rows.map((r) => r.querySelector(".uc-trigger"));
  const details = rows.map((r) => r.querySelector(".uc-detail"));

  if (reduceMotion) {
    rows.forEach((r) => r.classList.add("is-lit"));
    list.style.setProperty("--uc-fill", "1");
    return null;
  }

  let lastActive = -1;
  const openRow = (idx) => {
    rows.forEach((r, i) => {
      const on = i === idx;
      r.classList.toggle("uc-row--open", on);
      if (details[i]) details[i].classList.toggle("uc-detail--open", on);
      if (triggers[i]) {
        triggers[i].setAttribute("aria-expanded", on ? "true" : "false");
      }
    });
  };

  return function updateUseCases() {
    const H = window.innerHeight || 800;
    const line = H * 0.42; // reading line
    // Batch the layout reads before any writes to avoid thrash.
    const lr = list.getBoundingClientRect();
    const centers = triggers.map((t) => {
      const r = t.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const fill = clamp((line - lr.top) / Math.max(lr.height, 1), 0, 1);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      rows[i].classList.toggle("is-lit", centers[i] <= line + 4);
      const d = Math.abs(centers[i] - line);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    list.style.setProperty("--uc-fill", fill.toFixed(3));
    const within = lr.top < H * 0.9 && lr.bottom > H * 0.1;
    let active = within ? best : -1;
    // Hysteresis: hold the open row unless another is clearly closer to the line.
    if (active !== lastActive && lastActive >= 0 && within) {
      const lastC = centers[lastActive];
      if (lastC !== undefined && Math.abs(lastC - line) - bestDist < 18) {
        active = lastActive;
      }
    }
    if (active !== lastActive) {
      openRow(active);
      lastActive = active;
    }
  };
}

/* ---- Boot --------------------------------------------------------------- */
async function boot() {
  initA11yAndStats();
  injectDecor();
  initMagnetic();
  initCountUp();
  initFormFeedback();
  initPipelineStack();
  initPageTransitions();

  // About page: scroll-scrubbed "wired editorial spread", fed the smoothed
  // Lenis scroll (or native scroll) each frame. null when absent / reduced.
  const aboutScroll = initAboutScroll();
  // Homepage Use Cases: the wired, self-opening list.
  const useCases = initUseCases();

  let lenis = null;
  let onScroll = null;

  if (!reduceMotion) {
    try {
      const mod =
        await import("https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.mjs");
      const Lenis = mod.default || mod.Lenis;
      lenis = new Lenis({
        lerp: 0.12,
        wheelMultiplier: 1,
        smoothWheel: true,
        syncTouch: false,
      });
      onScroll = initScrollCoupled(() => ({ y: lenis.scroll }));
      lenis.on("scroll", (e) => {
        onScroll(e.scroll, e.velocity);
        if (aboutScroll) aboutScroll(e.scroll, e.velocity);
        if (useCases) useCases();
      });
      window.lenis = lenis; // expose the smooth-scroll instance for scroll-driven UI
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    } catch (err) {
      lenis = null; // CDN/feature unavailable: fall back to native scroll
    }
  }

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
        const v = y - lastY;
        onScroll(y, v);
        if (aboutScroll) aboutScroll(y, v);
        if (useCases) useCases();
        lastY = y;
        clearTimeout(settle);
        settle = setTimeout(() => {
          onScroll(window.scrollY, 0);
          if (aboutScroll) aboutScroll(window.scrollY, 0);
          if (useCases) useCases();
        }, 120);
      },
      { passive: true },
    );
  }

  if (aboutScroll)
    aboutScroll(window.lenis ? window.lenis.scroll : window.scrollY, 0);
  if (useCases) useCases();

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
