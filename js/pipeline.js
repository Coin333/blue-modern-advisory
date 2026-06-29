/* "What We Build" network pipeline - scroll-scrubbed.
   The section pins (held in place with a transform, since body has overflow-x
   hidden which would break position:sticky) while you scroll through a tall
   track, and the wire fills dot-to-dot in proportion to scroll position: it
   draws on the way down and un-draws on the way up. Driven by window scroll,
   which tracks Lenis's smoothed scroll position. Respects reduced-motion. */
(function () {
  const section = document.querySelector("#what-bma-builds");
  const pipe = section && section.querySelector("[data-pipe]");
  const wrap = section && section.querySelector(".section-wrap");
  if (!section || !pipe || !wrap) return;

  const segs = [...pipe.querySelectorAll(".pipe-seg")];
  const nodes = [...pipe.querySelectorAll(".pipe-node")];
  const cards = [...pipe.querySelectorAll(".pipe-card")];
  if (!segs.length || nodes.length < 2) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // reduced motion: no pin, no scrub - just show the finished wired-up state
  if (reduce) {
    segs.forEach((s) => {
      s.style.strokeDashoffset = "0";
      s.classList.add("is-on");
    });
    nodes.forEach((n) => n.classList.add("is-lit"));
    cards.forEach((c) => c.classList.add("is-on"));
    return;
  }

  // scrub mode: turn the section into a pinned track and drive the draw by scroll
  section.classList.add("is-scrub");
  pipe.classList.add("is-armed", "pipe--scrub");
  nodes[0].classList.add("is-lit"); // first node is the entry point, always lit
  if (cards[0]) cards[0].classList.add("is-on");

  const N = segs.length; // 3 segments between 4 nodes
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // p in [0,1] across the whole pipeline -> partial wire fill + node/card reveals
  function render(p) {
    for (let i = 0; i < N; i++) {
      const local = clamp(p * N - i, 0, 1); // this segment's own 0..1 fill
      segs[i].style.strokeDashoffset = String(1 - local);
      segs[i].classList.toggle("is-on", local > 0.001);
    }
    for (let i = 1; i <= N; i++) {
      const arrived = p >= i / N - 0.03; // light the node as the signal lands
      if (nodes[i]) nodes[i].classList.toggle("is-lit", arrived);
      if (cards[i]) cards[i].classList.toggle("is-on", arrived);
    }
  }

  // Pin math is NON-feedback: the translate depends only on the scroll position
  // and cached geometry, never on the wrap's own (already transformed) rect, so
  // it can't oscillate. Scroll is read from Lenis when present (the smoothed
  // value the page actually renders at) and falls back to native scroll.
  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  let curT = 0;
  let anchor = null; // scroll px at which the pin begins (wrap reaches hold line)
  let pinDist = 0;
  let jumpFreeze = false; // true while the hero glides past us to the carousel
  function measure() {
    const vh = window.innerHeight;
    const wrapH = wrap.offsetHeight;
    const targetTop = Math.max(96, (vh - wrapH) / 2); // hold line in the viewport
    // wrap's document-top with our own transform removed -> a stable anchor
    const wrapDocTop = wrap.getBoundingClientRect().top - curT + scrollPos();
    anchor = wrapDocTop - targetTop;
    pinDist = Math.min(vh * 0.9, section.offsetHeight - wrapH - targetTop - 20);
  }
  function frame() {
    if (jumpFreeze) return; // held as a static block during the hero->carousel jump
    if (anchor === null) measure();
    if (pinDist <= 0) {
      curT = 0;
      wrap.style.transform = "";
      render(0);
      return;
    }
    const t = clamp(scrollPos() - anchor, 0, pinDist); // 0 before, full after
    curT = t;
    wrap.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    render(clamp(t / pinDist, 0, 1));
  }

  // Run a rAF loop only while the tall section is on (or near) screen; that is
  // exactly when scrubbing matters. When it leaves, settle to the end state and
  // stop the loop so we are not reading layout every frame for nothing.
  let rafId = 0;
  let active = false;
  function loop() {
    frame();
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (active) return;
    active = true;
    loop();
  }
  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    render(section.getBoundingClientRect().top < 0 ? 1 : 0); // full above, empty below
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { rootMargin: "300px 0px 300px 0px", threshold: 0 },
    );
    io.observe(section);
  } else {
    start(); // no IO: just keep the loop running
  }
  // While the hero glides the page down to the carousel, this pinned scrub sits
  // between here and there; scrubbing it at the glide's high velocity looks
  // blocky, so for the duration of that jump we drop the pin and hold it as a
  // plain, finished static block, then re-sync once we land. Exposed for the
  // carousel's scrollToCard to drive.
  window.bmaPipeline = {
    freeze() {
      jumpFreeze = true;
      curT = 0;
      wrap.style.transform = ""; // drop the pin so the page scrolls past naturally
      render(1); // show the wire fully drawn as you fly by, not mid-scrub
    },
    unfreeze() {
      if (!jumpFreeze) return;
      jumpFreeze = false;
      anchor = null; // geometry may have shifted; re-measure on the next frame
      if (!active) render(section.getBoundingClientRect().top < 0 ? 1 : 0);
    },
  };

  window.addEventListener("resize", () => {
    anchor = null;
  }); // re-measure geometry on resize
  frame(); // prime to the current scroll position
})();
