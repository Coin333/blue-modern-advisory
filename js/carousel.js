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

  // Pause every card's looping SVG viz whenever the whole section is off-screen
  // (a cheap, separate gate from the 3D rAF below; see styles.css .viz-live).
  // Set up before the capability gate so it also covers the flat-grid fallback
  // on mobile - exactly the weak devices that benefit most.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) =>
        entries.forEach((e) =>
          section.classList.toggle("viz-live", e.isIntersecting),
        ),
      { rootMargin: "200px 0px 200px 0px", threshold: 0 },
    ).observe(section);
  } else {
    section.classList.add("viz-live");
  }

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
  // Touch / coarse-pointer devices get the readable flat grid too: the scroll-
  // pinned 3D ring relies on the Lenis-smoothed scroll, which runs with syncTouch
  // off, so on a phone or touch tablet the spin scrubs blockily and the pin fights
  // momentum scroll. Routing them to the flat grid is the clean experience.
  const coarse =
    !!window.matchMedia &&
    (window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches);
  // capability gate: leave the flat grid in place when we can't do this well -
  // but still honor a cross-page ?card=N by scrolling to that card's element
  if (reduce || !supports3d || coarse || window.innerWidth < 860) {
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

  // render() rewrites a CSS custom prop on all 7 cards and toggles is-front. While the
  // ring is idle but still on screen the eased angle stops changing, so those writes
  // repeat identically every frame. Skip them unless the rendered value changes.
  function renderIfChanged(deg) {
    const k = deg.toFixed(2);
    if (k === lastRenderKey) return;
    lastRenderKey = k;
    render(deg);
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
  let settledFrames = 0; // consecutive frames fully at rest -> park the loop
  let lastNow = performance.now();
  // throttle the geometry re-read (see frame()); cache the last rendered ring key
  let measureTick = 0;
  let lastRenderKey = "";
  function measure() {
    const vh = window.innerHeight;
    const wrapH = wrap.offsetHeight;
    const targetTop = Math.max(40, (vh - wrapH) / 2);
    const wrapDocTop = wrap.getBoundingClientRect().top - curT + scrollPos();
    anchor = wrapDocTop - targetTop;
    pinDist = Math.min(vh * 1.4, section.offsetHeight - wrapH - targetTop - 20);
  }
  // Apply only the pin translate for the current scroll. Deterministic (no easing)
  // and uses the cached anchor, so it is safe to call both from the rAF loop and
  // synchronously on every Lenis scroll update. The latter keeps the stage locked
  // to the scroll even when the rAF loop is momentarily starved - e.g. while the
  // laptop GLB decodes during a ?card= landing - which would otherwise leave the
  // cards unpinned for a frame and flash them off the top of the viewport.
  function applyPin() {
    if (anchor === null) return 0;
    if (pinDist <= 0) {
      if (curT !== 0) {
        curT = 0;
        wrap.style.transform = "";
      }
      return 0;
    }
    const t = clamp(scrollPos() - anchor, 0, pinDist);
    curT = t;
    wrap.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    return t;
  }
  function frame() {
    // The anchor is scroll-invariant (measure() subtracts the current transform), so it
    // only changes when layout genuinely shifts - it does NOT need re-reading every
    // frame. getBoundingClientRect()/offsetHeight here force a synchronous layout flush
    // that is the loop's entire per-frame cost (~7ms on this 3D-heavy page) and that
    // amplifies any other layout work sharing the frame. Re-read at ~15Hz instead of
    // 60Hz (self-corrects the Core Competencies collapse within ~4 frames - the section
    // above mounts a panel that collapses the page a few hundred px ~0.5s after load
    // with no resize event), plus immediately whenever the anchor is invalidated by the
    // listeners below (resize, the laptop "bma:os-emit" collapse, or the web-font swap).
    measureTick = (measureTick + 1) & 3;
    if (anchor === null || measureTick === 0) measure();
    const now = performance.now();
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt > 0.05) dt = 0.05;
    if (!(dt > 0)) dt = 0.016;
    if (pinDist <= 0) {
      curT = 0;
      wrap.style.transform = "";
      angle = 0;
      renderIfChanged(0);
      return;
    }
    const s = scrollPos();
    const t = applyPin();
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
    renderIfChanged(angle);

    // Park the loop once the ring is fully at rest: not scrolling, snapped to a
    // card, and the eased angle has reached it. While parked we do zero per-frame
    // work (no measure()/layout reads) until a scroll, wheel, or resize wakes it.
    // angle is left untouched, so waking resumes exactly where it stopped.
    if (!moving && idleFrames > IDLE_SNAP && Math.abs(target - angle) < 0.02) {
      if (++settledFrames > 8) park();
    } else {
      settledFrames = 0;
    }
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
    settledFrames = 0; // a fresh wake gets a full run before it can re-park
    loop();
  }
  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    const end = section.getBoundingClientRect().top < 0 ? -TURN : 0;
    angle = end;
    renderIfChanged(end);
  }
  // Park is "stop the loop without changing the angle": used when the ring is at
  // rest but still on screen, so it sits exactly as drawn until a wake restarts.
  function park() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
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
    start(); // wake a parked loop so it re-measures + re-pins for the new size
  });
  // Re-read geometry once when the page actually shifts under us, rather than polling
  // it every frame: the Core Competencies laptop powers on and collapses the page a
  // few hundred px ~0.5s after load with no resize event, and the web-font swap reflows
  // too. Each just invalidates the anchor; the next frame re-measures once.
  document.addEventListener("bma:os-emit", () => {
    anchor = null;
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      anchor = null;
    });
  }

  // Keep the pin glued to Lenis's scroll. Lenis emits "scroll" the instant it
  // updates its smoothed value, so applying the translate here (in addition to
  // the rAF loop) guarantees the stage is pinned for the exact scroll Lenis just
  // rendered - no one-frame lag, even mid-glide on a ?card= landing. Lenis is set
  // up in a later module script, so poll briefly until it exists, then subscribe.
  (function bindLenisScroll(tries) {
    if (window.lenis && typeof window.lenis.on === "function") {
      window.lenis.on("scroll", () => {
        applyPin(); // keep the pin glued every Lenis tick (no one-frame lag)
        start(); // and wake the eased-rotation loop if it had parked
      });
    } else if (tries < 120) {
      requestAnimationFrame(() => bindLenisScroll(tries + 1));
    }
  })(0);

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
  // that card once Lenis is up and the ring geometry has stopped moving. The
  // Core Competencies panel above collapses by a few hundred px ~0.5s after load,
  // so landing the instant Lenis is ready glides to a target computed from the
  // pre-collapse layout; the collapse then lands mid-glide and the cards overshoot
  // the pin and flash off the top. Wait for the target to hold steady across a few
  // frames (layout settled) before gliding, with a hard cap as a safety net.
  const landIdx = cardParam();
  if (landIdx >= 0) {
    let tries = 0;
    let lastTarget = null;
    let steadyFrames = 0;
    (function land() {
      const y = window.lenis ? cardScrollTarget(landIdx) : null;
      if (y != null) {
        steadyFrames =
          lastTarget != null && Math.abs(y - lastTarget) < 2
            ? steadyFrames + 1
            : 0;
        lastTarget = y;
        if (steadyFrames >= 5 || tries > 90) {
          window.gtmCarousel.scrollToCard(landIdx);
          return;
        }
      }
      if (tries++ < 150) requestAnimationFrame(land);
    })();
  }

  frame(); // prime so the ring is placed before first paint
})();
