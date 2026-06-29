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
  const records = items.map((el) => {
    const p = el.parentElement;
    const i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.transition = "none"; // scrubbed: we drive transform every frame
    return { el, stagger: i };
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
    // read all positions first, then write - keeps layout from thrashing
    const ps = records.map((r) => {
      const rect = r.el.getBoundingClientRect();
      return clamp((top - rect.top - r.stagger * STAGGER) / denom, 0, 1);
    });
    for (let i = 0; i < records.length; i++) {
      const p = ps[i];
      const el = records[i].el;
      el.style.opacity = p.toFixed(3);
      el.style.transform =
        "translate3d(0," +
        ((1 - p) * DIST).toFixed(1) +
        "px,0) scale(" +
        (0.992 + 0.008 * p).toFixed(4) +
        ")";
    }
  }

  // rAF loop reads the (Lenis-smoothed) scroll each frame and only does the
  // layout work when it actually moved, so it's free while the page is idle
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
  window.addEventListener("resize", () => {
    last = NaN;
  });
})();
