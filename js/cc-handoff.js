/* cc-handoff.js - the WHITE paint wipe that carries you, WITHOUT ever leaving the
   scroll-lock or showing a seam, from the Ascent (locked on card 07) into the
   Delivery "four cards" page.

   Sequence (all a pure function of scroll -> fully reversible):
   - The Ascent holds card 07 dead-centre while still PINNED over its tail
     (cc-ascent p 0.8 -> 1.0). During that locked tail a white sheet with ROUNDED
     paint-drip edges sweeps in from the right and covers the viewport white.
   - It HOLDS full white across the ascent->delivery scroll swap (so the next
     section never "comes up at the bottom"), then FADES into the Delivery
     section's own white background - white into white, no seam.
   - The Delivery heading fades in then out; its 4 cards then stack as you scroll
     (that stacking is the section's existing behaviour in enhance.js - untouched).

   The paint sits BELOW the nav (z < nav) so it never covers the nav bar. Reads the
   Ascent pin geometry from window.__bmaAscent. Desktop only (root.cc-ascent-on).
   Live-tunable via window.__bmaHandoff (call .rebuild() after edits). */
(function () {
  const delivery = document.querySelector(".delivery-section");
  if (!delivery) return;
  const root = document.documentElement;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (x) => {
    const t = clamp(x, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  const H = (window.__bmaHandoff = window.__bmaHandoff || {});
  const def = {
    coverStartP: 0.8, // ascent p where the white sweep begins (07 is held from here)
    holdVh: 0.6, // vh of full-white hold after the pin ends (hides the section swap)
    fadeVh: 0.7, // vh over which the white sheet fades into the delivery background
    sheetW: 150, // paint sheet width (vw)
    edgeInset: 14, // paint band inset from the sheet's own edges (element %)
    drips: 6, // rounded drip tendrils per vertical edge
    dripAmp: 6, // tendril reach (element %)
    samples: 110, // polygon samples per edge (high => smooth, ROUNDED tips)
    paint: "#ffffff", // wipe colour (white)
    zIndex: 150, // BELOW the nav (nav z ~200) so it never covers the nav bar
    headInVh: 0.5, // heading fully in when the delivery top is this many vh below the top
    headOutVh: -0.4, // heading fully out once the delivery top is this far above the top
  };
  for (const k in def) if (H[k] == null) H[k] = def[k];

  // ---- paint overlay --------------------------------------------------------
  const paint = document.createElement("div");
  paint.className = "cc-paint";
  paint.setAttribute("aria-hidden", "true");
  Object.assign(paint.style, {
    position: "fixed",
    top: "0",
    left: "0",
    height: "100vh",
    pointerEvents: "none",
    display: "none",
    willChange: "transform, opacity",
  });
  document.body.appendChild(paint);
  applyPaintStyle();

  function applyPaintStyle() {
    paint.style.width = H.sheetW + "vw";
    paint.style.background = H.paint;
    paint.style.zIndex = String(H.zIndex);
    paint.style.clipPath = dripClip();
  }

  // Rounded paint drips: a densely-sampled sin^2 profile so each tendril is a
  // smooth rounded blob (no jagged points). Coordinates are element-% so the drips
  // ride with the sheet as it translates.
  function dripClip() {
    const L = H.edgeInset;
    const R = 100 - H.edgeInset;
    const n = Math.max(1, H.drips | 0);
    const a = H.dripAmp;
    const S = Math.max(8, H.samples | 0);
    const drip = (t) =>
      Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * n - Math.PI / 2), 2);
    const pts = [];
    pts.push(L.toFixed(2) + "% 0%", R.toFixed(2) + "% 0%");
    for (let i = 1; i < S; i++) {
      const y = (i / S) * 100;
      pts.push((R + a * drip(i / S)).toFixed(2) + "% " + y.toFixed(2) + "%");
    }
    pts.push(R.toFixed(2) + "% 100%", L.toFixed(2) + "% 100%");
    for (let i = S - 1; i >= 1; i--) {
      const y = (i / S) * 100;
      pts.push((L - a * drip(i / S)).toFixed(2) + "% " + y.toFixed(2) + "%");
    }
    return "polygon(" + pts.join(",") + ")";
  }

  // clear the earlier slide-in we used to apply (superseded: the deck's own stack
  // does the "cards stack on top of each other" now).
  delivery.querySelectorAll(".bma-stack-inner").forEach((el) => {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.willChange = "";
  });
  const headEls = [
    ...delivery.querySelectorAll(
      ".section-wrap > .eyebrow, .section-wrap > .section-heading",
    ),
  ];
  headEls.forEach((el) => (el.style.willChange = "opacity"));

  // ---- driver (pure function of scroll) -------------------------------------
  function drive() {
    const vh = window.innerHeight;
    const on = root.classList.contains("cc-ascent-on");
    if (!on) {
      paint.style.display = "none";
      headEls.forEach((e) => (e.style.opacity = ""));
      return;
    }
    const A = window.__bmaAscent;
    if (!A || A.anchor == null) {
      paint.style.display = "none";
      return;
    }
    const aAnchor = A.anchor;
    const aPin = A.pinDist;
    const pinEnd = aAnchor + aPin;
    const sc = scrollPos();

    // white sweep-in over the ascent's locked tail [coverStartP*pin .. pinEnd]
    const coverStart = aAnchor + H.coverStartP * aPin;
    const cover = clamp(
      (sc - coverStart) / Math.max(1, pinEnd - coverStart),
      0,
      1,
    );
    // full-white hold after the pin ends, then fade into the (white) delivery bg
    const holdPx = H.holdVh * vh;
    const fadePx = H.fadeVh * vh;
    const fade = clamp((sc - (pinEnd + holdPx)) / Math.max(1, fadePx), 0, 1);

    if (cover <= 0.001 || fade >= 0.999) {
      paint.style.display = "none";
    } else {
      paint.style.display = "block";
      // the band sweeps in from the right to full cover as `cover` 0->1, then holds
      const bandL = (H.edgeInset / 100) * H.sheetW;
      const enterP = 100 - bandL; // band's left edge at 100vw (off right)
      const coverP = 50 - H.sheetW / 2; // band centred on the viewport
      const P = enterP + (coverP - enterP) * smooth(cover);
      paint.style.transform = "translateX(" + P.toFixed(2) + "vw)";
      paint.style.opacity = (1 - fade).toFixed(3);
    }

    // delivery heading: fade IN as the section rises into view, then OUT as it goes
    const delTop = delivery.getBoundingClientRect().top + sc;
    const belowVh = (delTop - sc) / vh; // vh the delivery top sits below the viewport top
    const inP = clamp((1 - belowVh) / (1 - H.headInVh), 0, 1);
    const outP = clamp(
      (belowVh - H.headOutVh) / (H.headInVh - H.headOutVh),
      0,
      1,
    );
    const hOp = Math.min(smooth(inP), smooth(outP));
    headEls.forEach((e) => (e.style.opacity = hOp.toFixed(3)));
  }

  // ---- run: bind to Lenis (or window) scroll + a short rAF settle ------------
  let raf = 0;
  function kick() {
    cancelAnimationFrame(raf);
    let n = 0;
    const step = () => {
      drive();
      if (++n < 4) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  (function bind(t) {
    if (window.lenis && typeof window.lenis.on === "function") {
      window.lenis.on("scroll", drive);
    } else if (t < 120) {
      requestAnimationFrame(() => bind(t + 1));
    } else {
      window.addEventListener("scroll", drive, { passive: true });
    }
  })(0);
  window.addEventListener(
    "resize",
    () => {
      applyPaintStyle();
      kick();
    },
    { passive: true },
  );
  document.addEventListener("bma:os-emit", kick);

  H.rebuild = () => {
    applyPaintStyle();
    kick();
  };
  kick();
})();
