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

  // Touch / coarse-pointer / small screens never pin: the transform "fake pin"
  // fights native momentum scroll there and feels like it locks you in place
  // (Lenis runs with syncTouch off, so its scroll value lags touch). They get
  // the no-pin path below instead.
  const coarsePointer =
    !!window.matchMedia &&
    (window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches);
  const noPin = coarsePointer || window.innerWidth < 768;

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

  // reduced motion: no pin, no scrub - just show the finished wired-up state
  if (reduce) {
    nodes[0].classList.add("is-lit"); // entry node + first card, like the live paths
    if (cards[0]) cards[0].classList.add("is-on");
    render(1);
    return;
  }

  // Touch / mobile: don't pin. The page scrolls normally; the wire draws itself
  // ONCE (a time-based tween, not scroll-scrubbed) the first time the section
  // comes into view, then stays drawn. No transform on .section-wrap, so nothing
  // ever "holds" the viewport in place.
  if (noPin) {
    pipe.classList.add("is-armed");
    nodes[0].classList.add("is-lit");
    if (cards[0]) cards[0].classList.add("is-on");
    render(0);
    let played = false;
    function playOnce() {
      if (played) return;
      played = true;
      const DUR = 1500;
      let t0 = 0;
      function tick(ts) {
        if (!t0) t0 = ts;
        const k = clamp((ts - t0) / DUR, 0, 1);
        render(k);
        if (k < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              playOnce();
              io.disconnect();
            }
          }),
        { threshold: 0.35 },
      );
      io.observe(section);
    } else {
      render(1);
    }
    return;
  }

  // scrub mode: turn the section into a pinned track and drive the draw by scroll
  section.classList.add("is-scrub");
  pipe.classList.add("is-armed", "pipe--scrub");
  nodes[0].classList.add("is-lit"); // first node is the entry point, always lit
  if (cards[0]) cards[0].classList.add("is-on");

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
  // idle auto-advance: when the section is in view and the user stops scrolling,
  // the pipeline gently keeps building itself forward; any scroll takes over
  // again and scrubs directly. The rendered fill eases toward its target so the
  // hand-off between scroll and auto-play stays smooth (no snap).
  let autoP = 0; // idle auto-advance progress target
  let curP = 0; // eased rendered progress (what we actually draw)
  let lastScrollV = NaN;
  let idleMs = 0;
  let lastFrameT = performance.now();
  const AUTO_SECS = 7; // idle: seconds to build the whole pipeline 0 -> 1
  const IDLE_DELAY = 900; // ms after scroll stops before auto-play resumes
  const EASE_OMEGA = 7; // how snappily the drawn fill follows its target
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
    const now = performance.now();
    let dt = (now - lastFrameT) / 1000;
    lastFrameT = now;
    if (dt > 0.05) dt = 0.05;
    if (!(dt > 0)) dt = 0.016;
    if (pinDist <= 0) {
      curT = 0;
      wrap.style.transform = "";
      autoP = curP = 0;
      render(0);
      return;
    }
    const s = scrollPos();
    const t = clamp(s - anchor, 0, pinDist); // 0 before, full after
    curT = t;
    wrap.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    const scrollP = clamp(t / pinDist, 0, 1);

    // While the user scrolls, the scroll position drives the fill directly. Once
    // it settles, the build gently auto-advances forward; auto never drags the
    // fill below the scroll position, so scrolling always takes over cleanly.
    const moving = Math.abs(s - lastScrollV) > 0.5;
    lastScrollV = s;
    if (moving) {
      autoP = scrollP; // follow the scroll (keeps auto and scroll in sync)
      idleMs = 0;
    } else {
      idleMs += dt * 1000;
      if (idleMs > IDLE_DELAY) autoP = Math.min(1, autoP + dt / AUTO_SECS);
    }
    const target = Math.max(scrollP, autoP);
    curP += (target - curP) * (1 - Math.exp(-EASE_OMEGA * dt)); // smooth follow
    render(curP);
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
    lastFrameT = performance.now(); // avoid a huge dt after an idle gap
    lastScrollV = NaN;
    loop();
  }
  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    const end = section.getBoundingClientRect().top < 0 ? 1 : 0; // full above, empty below
    curP = autoP = end;
    lastScrollV = NaN;
    render(end);
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
      curP = autoP = 1;
      render(1); // show the wire fully drawn as you fly by, not mid-scrub
    },
    unfreeze() {
      if (!jumpFreeze) return;
      jumpFreeze = false;
      anchor = null; // geometry may have shifted; re-measure on the next frame
      lastFrameT = performance.now();
      lastScrollV = NaN;
      if (!active) render(section.getBoundingClientRect().top < 0 ? 1 : 0);
    },
  };

  window.addEventListener("resize", () => {
    anchor = null;
  }); // re-measure geometry on resize
  frame(); // prime to the current scroll position
})();
