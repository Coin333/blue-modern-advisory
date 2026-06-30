/* Site-wide scroll-linked reveal - "attached to the Lenis scroll".
   Every content block eases in (opacity + lift + a hair of scale) as a function
   of where it sits in the viewport, scrubbed off the smoothed Lenis scroll, so
   the whole page feels coupled to the scroll instead of popping. Bidirectional:
   scroll back up and blocks settle back down. Sections that own their motion
   (hero, the pinned pipeline, nav, the marquee track) are excluded. Honors
   reduced-motion and degrades to the plain, fully-visible page without JS. */
(function () {
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // leave everything visible and still

  // blocks to attach to the scroll, grouped so siblings cascade
  const SELECTORS = [
    ".pricing-header > *",
    ".pricing-card",
    ".uc-header > *",
    ".uc-row",
    "#faq .section-heading",
    ".faq-item",
    ".trusted-by--full .reviewer-group",
    ".trusted-by--full .trusted-stars-row",
    ".ft__cta",
    ".ft__nav",
    ".ft__nws",
  ];
  // these own their own motion - never touch anything inside them
  const EXCLUDE =
    "#home, #what-bma-builds, .nav-wrapper, .trusted-marquee-outer";

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const set = new Set();
  document.querySelectorAll(SELECTORS.join(",")).forEach((el) => {
    if (!el.closest(EXCLUDE)) set.add(el);
  });
  const items = [...set];
  if (!items.length) return;

  // stagger index = position among tracked siblings under the same parent
  const seen = new Map();
  // Cache each block's resting document-top (a layout position, unaffected by
  // the transform we apply) so the per-frame scroll work is pure arithmetic.
  // Previously apply() called getBoundingClientRect() on every tracked block on
  // every scroll frame, forcing a full reflow each frame - the main scroll-jank
  // source on long pages. offsetTop walks the layout tree once instead.
  function docTop(el) {
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }
  const records = items.map((el) => {
    const p = el.parentElement;
    const i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.transition = "none"; // scrubbed: we drive transform every frame
    return { el, stagger: i, top: docTop(el) };
  });

  const START = 0.96; // begin revealing when the block's top is 96% down the viewport
  const END = 0.72; // fully revealed by 72% up - low enough that page-bottom blocks resolve
  const DIST = 34; // px of lift
  const STAGGER = 22; // px of extra scroll per sibling, for the cascade

  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  function apply() {
    const vh = window.innerHeight;
    const top = START * vh;
    const denom = (START - END) * vh || 1;
    const sy = scrollPos();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      // viewport-relative top from the cached layout top + scroll: no layout
      // read in the hot path, so scrolling never triggers a reflow here
      const rectTop = r.top - sy;
      const p = clamp((top - rectTop - r.stagger * STAGGER) / denom, 0, 1);
      r.el.style.opacity = p.toFixed(3);
      r.el.style.transform =
        "translate3d(0," +
        ((1 - p) * DIST).toFixed(1) +
        "px,0) scale(" +
        (0.992 + 0.008 * p).toFixed(4) +
        ")";
    }
  }

  // rAF loop reads the (Lenis-smoothed) scroll each frame and only does the
  // work when it actually moved, so it's free while the page is idle
  let last = NaN;
  function loop() {
    const y = scrollPos();
    if (y !== last) {
      last = y;
      apply();
    }
    requestAnimationFrame(loop);
  }

  apply(); // prime synchronously so on-screen blocks never flash hidden
  requestAnimationFrame(loop);
  // geometry shifts on resize or as lazy below-the-fold images finish loading;
  // re-cache the resting tops then (a one-off reflow, never in the scroll path)
  function refresh() {
    for (const r of records) r.top = docTop(r.el);
    last = NaN;
  }
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);
})();
