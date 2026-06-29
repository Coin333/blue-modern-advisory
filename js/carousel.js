/* GTM systems - 3D scroll-spinnable ring carousel.
   The section pins (transform "fake pin", since body has overflow-x:hidden which
   breaks position:sticky) and the ring rotates with scroll, bringing each of the
   seven cards to the front in turn. Front-most card is emphasized; the rest
   recede in 3D. Driven by the Lenis-smoothed scroll. Falls back to the readable
   flat card grid on small screens, without 3D support, or for reduced-motion. */
(function () {
  const section = document.querySelector("#gtm-systems");
  // pin the STAGE only (not the heading) so the cards get the full viewport
  // height to centre in and never clip; the heading scrolls normally above
  const wrap = section && section.querySelector(".gtm-stage");
  const ring = section && section.querySelector("[data-gtm-ring]");
  if (!section || !wrap || !ring) return;
  const cards = [...ring.querySelectorAll(".gtm-card")];
  if (cards.length < 2) return;

  // cross-page landing: the hero sends us here as capabilities.html?card=N
  function cardParam() {
    const m = /[?&]card=(\d+)/.exec(window.location.search);
    if (!m) return -1;
    return Math.max(0, Math.min(cards.length - 1, parseInt(m[1], 10)));
  }

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supports3d =
    !window.CSS ||
    !CSS.supports ||
    CSS.supports("transform-style", "preserve-3d");
  // capability gate: leave the flat grid in place when we can't do this well -
  // but still honor a cross-page ?card=N by scrolling to that card's element
  if (reduce || !supports3d || window.innerWidth < 860) {
    const ci = cardParam();
    if (ci >= 0) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = cards[ci];
          if (window.lenis && typeof window.lenis.scrollTo === "function")
            window.lenis.scrollTo(el, { duration: 1.2 });
          else el.scrollIntoView({ behavior: "smooth", block: "center" });
        }),
      );
    }
    return;
  }

  section.classList.add("is-scrub");

  const N = cards.length; // 7
  const STEP = 360 / N; // angular spacing of cards on the ring
  // end the spin ON the last card (card 7) at p=1, not back at card 1
  const TURN = (360 * (N - 1)) / N; // 360*6/7 -> card index 6 faces front at p=1
  const OMEGA = 5.5; // rotation easing: lower = more inertia / float
  const IDLE_SNAP = 5; // idle frames before the ring settles onto the nearest card
  const DEG2RAD = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function render(ringDeg) {
    ring.style.setProperty("--ring", ringDeg.toFixed(2) + "deg");
    let frontIdx = 0;
    let frontMax = -2;
    for (let i = 0; i < N; i++) {
      const facing = Math.cos((ringDeg + i * STEP) * DEG2RAD); // 1 front, -1 back
      const t = (facing + 1) / 2; // 0..1
      cards[i].style.setProperty(
        "--front",
        (0.12 + 0.88 * Math.pow(t, 2.2)).toFixed(3),
      );
      if (facing > frontMax) {
        frontMax = facing;
        frontIdx = i;
      }
    }
    for (let i = 0; i < N; i++) {
      cards[i].classList.toggle("is-front", i === frontIdx);
    }
  }

  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  let curT = 0;
  let anchor = null;
  let pinDist = 0;
  let angle = 0; // current (eased) ring rotation, degrees
  let lastScroll = NaN;
  let idleFrames = 0;
  let lastNow = performance.now();
  function measure() {
    const vh = window.innerHeight;
    const wrapH = wrap.offsetHeight;
    const targetTop = Math.max(40, (vh - wrapH) / 2);
    const wrapDocTop = wrap.getBoundingClientRect().top - curT + scrollPos();
    anchor = wrapDocTop - targetTop;
    pinDist = Math.min(vh * 1.4, section.offsetHeight - wrapH - targetTop - 20);
  }
  function frame() {
    if (anchor === null) measure();
    const now = performance.now();
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt > 0.05) dt = 0.05;
    if (!(dt > 0)) dt = 0.016;
    if (pinDist <= 0) {
      curT = 0;
      wrap.style.transform = "";
      angle = 0;
      render(0);
      return;
    }
    const s = scrollPos();
    const t = clamp(s - anchor, 0, pinDist);
    curT = t;
    wrap.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    const scrollAngle = -clamp(t / pinDist, 0, 1) * TURN;

    // when the scroll settles, snap the ring onto the nearest card (you land on a
    // card "if you so wish"); while moving, the target just follows the scroll
    const moving = Math.abs(s - lastScroll) > 0.05;
    lastScroll = s;
    idleFrames = moving ? 0 : idleFrames + 1;
    const target =
      idleFrames > IDLE_SNAP
        ? Math.round(scrollAngle / STEP) * STEP
        : scrollAngle;

    // inertia: ease the rotation toward the target, frame-rate independent
    angle += (target - angle) * (1 - Math.exp(-OMEGA * dt));
    render(angle);
  }

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
    const end = section.getBoundingClientRect().top < 0 ? -TURN : 0;
    angle = end;
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
    start();
  }
  window.addEventListener("resize", () => {
    anchor = null;
  });

  // --- Sideways scroll also walks the ring -------------------------------
  // A horizontal trackpad swipe (or shift+wheel) while the ring is pinned is
  // translated into the same vertical scrub, so scrolling sideways carries you
  // through the cards just like scrolling down does. We grab the wheel in the
  // capture phase and stop it before Lenis (which only reads deltaY) sees it,
  // so the two never fight. Vertical intent and anything off the carousel pass
  // straight through untouched.
  let hTarget = null;
  let hIdle = 0;
  function onSideWheel(e) {
    if (!active || e.ctrlKey) return; // ctrl+wheel is pinch-zoom; leave it
    const dx =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2.5 // near-horizontal only; up/down keeps priority otherwise
        ? e.deltaX
        : e.shiftKey
          ? e.deltaY
          : 0;
    if (!dx) return; // vertical gesture: let Lenis scroll the page as usual
    if (anchor === null) measure();
    if (pinDist <= 0) return;
    const s = scrollPos();
    if (s < anchor - 8 || s > anchor + pinDist + 8) return; // ring not pinned
    e.preventDefault();
    if (typeof e.stopImmediatePropagation === "function")
      e.stopImmediatePropagation();
    const base =
      hTarget != null
        ? hTarget
        : window.lenis && typeof window.lenis.targetScroll === "number"
          ? window.lenis.targetScroll
          : s;
    hTarget = clamp(base + dx, anchor, anchor + pinDist);
    clearTimeout(hIdle);
    hIdle = setTimeout(() => {
      hTarget = null;
    }, 160);
    start(); // keep the ring loop easing while we glide
    if (window.lenis && typeof window.lenis.scrollTo === "function")
      window.lenis.scrollTo(hTarget, {
        duration: 0.4,
        lock: false,
        force: true,
      });
    else window.scrollTo(0, hTarget);
  }
  window.addEventListener("wheel", onSideWheel, {
    capture: true,
    passive: false,
  });

  // --- Navigation API ----------------------------------------------------
  // Let other UI (the hero's capability hubs) jump straight to a card. Card i
  // is front-facing when the scrub is t = pinDist * i/(N-1); we Lenis-glide the
  // page to anchor + that, and the ring eases round to meet it on arrival.
  function cardScrollTarget(i) {
    measure(); // fresh each call in case layout shifted since the loop measured
    if (pinDist <= 0) return null;
    const k = N > 1 ? clamp(i, 0, N - 1) / (N - 1) : 0;
    return anchor + pinDist * k;
  }
  window.gtmCarousel = {
    count: N,
    scrollToCard(i, opts) {
      const y = cardScrollTarget(i);
      if (y == null) return false;
      start(); // wake the ring loop so it's already easing as we arrive
      // freeze the "Revenue infrastructure" pinned scrub we glide past, so it
      // doesn't blockily fast-scrub during the jump; release on arrival, with a
      // safety net in case the glide gets interrupted partway
      const pipe = window.bmaPipeline;
      if (pipe && typeof pipe.freeze === "function") pipe.freeze();
      const release = () => {
        if (pipe && typeof pipe.unfreeze === "function") pipe.unfreeze();
      };
      if (window.lenis && typeof window.lenis.scrollTo === "function") {
        window.lenis.scrollTo(
          y,
          Object.assign({ duration: 1.5, onComplete: release }, opts || {}),
        );
        setTimeout(release, 2100);
      } else {
        window.scrollTo(0, y);
        release();
      }
      return true;
    },
  };

  // cross-page landing: if the hero sent us here as ?card=N, glide the ring to
  // that card once Lenis is up and the ring geometry is measurable
  const landIdx = cardParam();
  if (landIdx >= 0) {
    let tries = 0;
    (function land() {
      if (window.lenis && cardScrollTarget(landIdx) != null) {
        window.gtmCarousel.scrollToCard(landIdx);
      } else if (tries++ < 90) {
        requestAnimationFrame(land);
      }
    })();
  }

  frame(); // prime so the ring is placed before first paint
})();
