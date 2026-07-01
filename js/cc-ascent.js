/* cc-ascent.js - Capabilities "Ascent".

   One scroll-scrubbed cinematic that replaces the jump from the 3D laptop to
   the ring carousel. Everything is a pure function of one scroll progress p in
   [0,1], so it scrubs forward AND backward exactly (no time-based animation in
   the scrubbed range).

   Phases (fractions are tunable in PHASES below):
     dolly    - scroll pushes the camera INTO the laptop (the zoom is no longer
                automatic; cc-laptop.js reads window.__bmaLaptop.scrollDrive)
     dwell    - a beat held at full zoom
     look-up  - the camera tilts up off the lid; sky gradients white -> #5b9bc9
     handoff  - at uniform blue the WebGL parks and the cards fade in
     climb    - each of 7 cards rises, holds to read, then accelerates off-side
     settle   - releases into the page

   Desktop-only. On reduced-motion / coarse-pointer / small / weak devices the
   section stays hidden (CSS) and #gtm-systems runs as before. Mirrors the
   carousel's fake-pin (position:sticky is broken under the page's
   overflow-x:hidden) and its Lenis scroll read. */

const section = document.querySelector("#cc-ascent");
const stage = section && section.querySelector("[data-cc-ascent-stage]");

if (section && stage) init(section, stage);

function init(section, stage) {
  const root = document.documentElement;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);

  // ---- phase fractions of p (kept in one place so the timeline is tunable) ---
  const PHASES = {
    // Simple sequence: the camera zooms INTO the laptop screen (fills it), holds a
    // beat, then tilts UP off the lid into the sky and hands off to the cards.
    zoomEnd: 0.16, // 0..0.16 = dolly INTO the screen until it fills the viewport
    dwellEnd: 0.2, // 0.16..0.2 = brief beat held at full screen
    lookEnd: 0.34, // 0.2..0.34 = pull back off the screen + rise up into the sky
    handoffEnd: 0.4, // 0.34..0.4 = at full blue, fade the cards in
    climbEnd: 1.0, // 0.4..1.0 = the scroll-linked card flythrough (constant velocity)
  };

  // ---- capability gate (mirror carousel.js + cc-laptop.js fallbacks) --------
  let webglOK = null;
  function hasWebGL() {
    if (webglOK !== null) return webglOK;
    try {
      const c = document.createElement("canvas");
      webglOK = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl"))
      );
    } catch (e) {
      webglOK = false;
    }
    return webglOK;
  }
  function eligible() {
    if (mq("(prefers-reduced-motion: reduce)")) return false;
    if (mq("(hover: none)") || mq("(pointer: coarse)")) return false;
    if (window.innerWidth < 860) return false;
    const supports3d =
      !window.CSS ||
      !CSS.supports ||
      CSS.supports("transform-style", "preserve-3d");
    if (!supports3d) return false;
    const lowMem =
      typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    if (lowMem) return false;
    if (navigator.connection && navigator.connection.saveData) return false;
    if (!hasWebGL()) return false;
    return true;
  }

  // ---- state ----------------------------------------------------------------
  let on = false; // ascent engaged for this device
  let inView = false; // section near the viewport (loop gate)
  let anchor = null; // scroll position where the pin starts
  let pinDist = 0; // scroll length over which the stage stays pinned
  let curT = 0; // current pin translateY
  let p = 0; // scroll progress 0..1
  let isClimb = false; // true once the sky is full blue and the cards take over
  let cardsBuilt = false;
  const cardsLayer = section.querySelector("[data-cc-ascent-cards]");

  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  function measure() {
    const vh = window.innerHeight;
    const stageH = stage.offsetHeight || vh;
    // center the (overscanned) stage on the viewport; negative when stageH > vh so
    // it hangs past the top AND bottom edges -> never exposes a white edge
    const targetTop = (vh - stageH) / 2;
    const docTop = stage.getBoundingClientRect().top - curT + scrollPos();
    anchor = docTop - targetTop;
    pinDist = Math.max(0, section.offsetHeight - stageH - targetTop);
  }

  // Deterministic (no easing) so it is safe to call from the rAF loop AND
  // synchronously on every Lenis tick - keeps the pin glued with no one-frame lag.
  function applyPin() {
    if (anchor === null) return;
    const t = clamp(scrollPos() - anchor, 0, pinDist);
    curT = t;
    stage.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    p = pinDist > 0 ? clamp(t / pinDist, 0, 1) : 0;
    drive(p);
  }

  // ---- the timeline: map p -> visuals ---------------------------------------
  function sub(a, b, x) {
    return b > a ? clamp((x - a) / (b - a), 0, 1) : x >= b ? 1 : 0;
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIn = (x) => x * x * x; // accelerating - used for the quick exit
  // smootherstep (Perlin): 6x^5-15x^4+10x^3. Both the 1st AND 2nd derivatives are
  // 0 at x=0 and x=1, so eased ramps join with matching (zero) velocity - no
  // acceleration jump / seam. Used for the screen-zoom and the sky look-up.
  const smoother = (x) => {
    const t = clamp(x, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  // The card scroll: the 7 cards sit on a fixed depth RAIL and you glide along it.
  // A single focus value f glides linearly from 0 (card 01 dead-centre) to n-1
  // (card 07 dead-centre) across the card band; card i sits at z=(f-i)*zStep. The
  // focused card is at the focal plane (z 0, centred, full size), already-passed
  // cards sit IN FRONT (+z, bigger, fading out), upcoming cards sit BEHIND (-z,
  // smaller, fading in). Only the two endpoints snap to a perfectly centred card;
  // everything between is a smooth continuous glide through centre. All px are in
  // the CSS perspective space (perspective:1500px on .cc-ascent-cards).
  const CARDS = {
    n: 7,
    zStep: 900, // depth between consecutive cards on the rail (px)
    zFar: -2400, // deep edge: a card has fully faded IN by the time it's this near
    fadeIn: 1150, // fade-in distance from the deep back
    frontEnd: 900, // a card is fully faded OUT by z = frontEnd (~one step), so nothing
    //               occludes the centred card at either snapped endpoint
  };
  function drive(pp) {
    // sky: white through the zoom/dwell, white -> blue over the look-up, blue after
    const sky = sub(PHASES.dwellEnd, PHASES.lookEnd, pp);
    stage.style.setProperty("--sky", sky.toFixed(4));
    // laptop: scroll zooms the camera INTO the screen until it fills the viewport
    // (0..zoomEnd), holds a beat (dwell), then over the look-up band the camera
    // pulls back off the flattened screen and RISES up into the sky (pan to cards).
    const CFG = window.__bmaLaptop;
    if (CFG && CFG.scrollDrive) {
      const zoom = smoother(sub(0, PHASES.zoomEnd, pp)); // eased dolly into the screen
      // pull back out of the screen (first half of look-up) so the laptop returns,
      // then rise the camera up off it into the sky (second half) - no grazing smear.
      const lookMid = (PHASES.dwellEnd + PHASES.lookEnd) / 2;
      const pullBack = smoother(sub(PHASES.dwellEnd, lookMid, pp));
      CFG.scrollDrive.zoom = zoom * (1 - pullBack);
      CFG.scrollDrive.up = smoother(sub(lookMid, PHASES.lookEnd, pp));
    }
    // hand-off: at full blue, park the laptop (CSS hides the host so cc-laptop's
    // IO stops its loop) and fade the cards in over the short hand-off band.
    const climb = pp >= PHASES.lookEnd;
    if (climb !== isClimb) {
      isClimb = climb;
      stage.classList.toggle("is-climb", climb);
    }
    if (cardsLayer) {
      const f = sub(PHASES.lookEnd, PHASES.handoffEnd, pp);
      cardsLayer.style.opacity = (f * f * (3 - 2 * f)).toFixed(3); // smoothstep in
    }
    if (cardsBuilt) updateCards(pp);
  }

  // Depth-rail glide. Card i sits at z = (f - i) * zStep for the current focus f
  // (0..n-1). The focused card is at z 0 (focal plane, centred, full size); passed
  // cards move to +z (in front, fading out fast so they never occlude the centred
  // one), upcoming cards sit at -z (behind, smaller, fading in). f is a pure linear
  // function of scroll so the whole thing scrubs both ways; the ends are snapped
  // (f=0 => 01 centred, f=n-1 => 07 centred). Transform + opacity only per frame.
  function updateCards(pp) {
    const cards = cardsLayer.children;
    const n = CARDS.n;
    // cards finish gliding (07 dead-centre) by p=0.8, then HOLD 07 while the pinned
    // tail [0.8, 1.0] plays the white paint wipe (cc-handoff) - the lock never breaks.
    const f = sub(PHASES.handoffEnd, 0.8, pp) * (n - 1);
    let liveIdx = -1;
    let liveDist = Infinity;
    for (let i = 0; i < n; i++) {
      const el = cards[i];
      if (!el) continue;
      const z = (f - i) * CARDS.zStep;
      const far = clamp((z - CARDS.zFar) / CARDS.fadeIn, 0, 1); // fade in from the back
      const front = clamp((CARDS.frontEnd - z) / CARDS.frontEnd, 0, 1); // fade out in front
      const op = far * front;
      if (op <= 0.001) {
        if (el.style.visibility !== "hidden") {
          el.style.visibility = "hidden";
          el.classList.remove("is-card-live");
        }
        continue;
      }
      el.style.visibility = "visible";
      el.style.opacity = op.toFixed(3);
      el.style.transform = "translate3d(0px,0px," + z.toFixed(1) + "px)";
      if (op > 0.85) {
        const d = Math.abs(z); // 0 depth = the focal plane
        if (d < liveDist) {
          liveDist = d;
          liveIdx = i;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (cards[i]) cards[i].classList.toggle("is-card-live", i === liveIdx);
    }
  }

  // ---- loop / wake (only runs while engaged AND near the viewport) ----------
  let measureTick = 0;
  let rafId = 0;
  let running = false;
  function frame() {
    if (!on || !inView) {
      running = false;
      return;
    }
    measureTick = (measureTick + 1) & 3;
    if (anchor === null || measureTick === 0) measure();
    applyPin();
    rafId = requestAnimationFrame(frame);
  }
  function wake() {
    if (running || !on || !inView) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  // ---- laptop mount: reparent the live WebGL host into the pinned stage ------
  // The laptop's zoom is now scroll-driven, so it has to stay pinned + visible
  // while you scroll the dolly/look-up. We move the same .cc-os element (canvas
  // + CSS3D screen, context preserved) into the pinned stage and hand cc-laptop
  // a scrollDrive hook; on disengage we put it back.
  const lapSlot = section.querySelector("[data-cc-ascent-lap]");
  let lapHost = null;
  let lapHome = null;
  function mountLaptop(into) {
    if (!lapHost) {
      lapHost = document.querySelector("[data-cc-os]");
      lapHome = lapHost ? lapHost.parentNode : null;
    }
    if (!lapHost || !lapSlot) return;
    const CFG = (window.__bmaLaptop = window.__bmaLaptop || {});
    if (into) {
      if (lapHost.parentNode !== lapSlot) lapSlot.appendChild(lapHost);
      CFG.scrollDrive = CFG.scrollDrive || {
        active: true,
        zoom: 0,
        up: 0,
      };
      CFG.scrollDrive.active = true;
      // moderate dolly: bring the laptop CLOSER (bigger/nearer) but NOT so far that
      // the screen fills the viewport - the whole laptop stays framed. (Old 2.1
      // pushed the screen to full-bleed; combined with CFG.zoomCap this just nears.)
      if (CFG.scrollDrive.fillBoost == null) CFG.scrollDrive.fillBoost = 1.5;
    } else {
      if (lapHome && lapHost.parentNode !== lapHome)
        lapHome.appendChild(lapHost);
      if (CFG.scrollDrive) CFG.scrollDrive.active = false;
    }
    // the host changed parent/size; let cc-laptop reframe its camera + renderer
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  // ---- clone the 7 capability cards out of the (now hidden) ring ------------
  // Reuse the exact #gtm-systems .gtm-card nodes (content + SVG viz) so there is
  // no duplicated copy to maintain. The ring's own #gtm-systems-scoped 3D rules
  // don't reach these clones, so .cc-ascent-card styles them fresh.
  function cloneCards() {
    if (cardsBuilt || !cardsLayer) return;
    const src = document.querySelectorAll(
      "#gtm-systems [data-gtm-ring] .gtm-card",
    );
    if (!src.length) return;
    src.forEach((node, i) => {
      const c = node.cloneNode(true);
      c.removeAttribute("style"); // drop the ring's inline --i
      c.classList.add("cc-ascent-card");
      c.style.setProperty("--ci", i);
      cardsLayer.appendChild(c);
    });
    cardsBuilt = true;
  }

  // ---- engage / disengage for this device -----------------------------------
  function setOn(next) {
    if (next === on) return;
    on = next;
    root.classList.toggle("cc-ascent-on", on);
    mountLaptop(on);
    if (on) cloneCards();
    if (on) {
      // a layout swap (ring hidden + laptop reparented) just happened; measure next frame
      requestAnimationFrame(() => {
        anchor = null;
        wake();
      });
    } else {
      stage.style.transform = "";
      curT = 0;
    }
  }

  // ---- observers ------------------------------------------------------------
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          inView = e.isIntersecting;
          if (inView) wake();
        }),
      { rootMargin: "300px 0px 300px 0px", threshold: 0 },
    ).observe(section);
  } else {
    inView = true;
  }

  window.addEventListener("resize", () => {
    anchor = null;
    setOn(eligible());
    wake();
  });
  // layout shifts that invalidate the anchor: the laptop boot collapse + font swap
  document.addEventListener("bma:os-emit", () => {
    anchor = null;
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      anchor = null;
    });
  }

  // Keep the pin glued to Lenis the instant it updates its smoothed scroll
  // (in addition to the rAF loop), exactly like the carousel does.
  (function bindLenis(tries) {
    if (window.lenis && typeof window.lenis.on === "function") {
      window.lenis.on("scroll", () => {
        if (on && inView) {
          applyPin();
          wake();
        }
      });
    } else if (tries < 120) {
      requestAnimationFrame(() => bindLenis(tries + 1));
    }
  })(0);

  // expose for live tuning / inspection in the console
  window.__bmaAscent = {
    PHASES,
    get on() {
      return on;
    },
    get p() {
      return p;
    },
    get pinDist() {
      return pinDist;
    },
    get anchor() {
      return anchor;
    },
    remeasure() {
      anchor = null;
    },
  };

  // ---- go -------------------------------------------------------------------
  setOn(eligible());
}
