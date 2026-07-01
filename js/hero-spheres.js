/* Hero "two-sphere scroll roll" - a small sphere rolls along a big planet's lit
   limb and off-screen as you scroll, pin-and-scrubbed to Lenis. Canvas 2D.

   - Big planet: canvas-shaded (dark body + bright crescent limb), only its limb
     shows on screen.
   - Small sphere: drawn from assets/hero-sphere.avif (falls back to a canvas
     sphere if the image fails); it rolls along the limb and exits the viewport.
   - Fluted glass: a ribbed-glass panel on the left vertically streaks whatever
     crosses it (the limb + the small sphere as it rolls through), by resampling
     each flute from a thin centreline strip stretched vertically.

   Desktop (fine pointer, >=768, motion ok) fake-pins the stage with a transform
   (sticky is broken here - body has overflow-x:hidden) for one screen of scroll;
   progress 0->1 rolls the sphere and fades the copy. Touch / coarse / small /
   reduced-motion get one static frame, no pin.

   Live-tunable via window.__bmaHero (edit in the console, redraws next frame).
   __bmaHero.dump() logs geometry; __bmaHero.debug = true overlays the paths. */
(function () {
  const section = document.querySelector("[data-hero-sphere]");
  if (!section) return;
  const canvas = section.querySelector(".hero-sphere-canvas");
  const stage = section.querySelector(".hero-sphere-stage");
  if (!canvas || !stage) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const reduce = mq("(prefers-reduced-motion: reduce)");
  const coarse = mq("(hover: none)") || mq("(pointer: coarse)");
  const noPin = reduce || coarse || window.innerWidth < 768;

  /* ----------------------------- tunables ------------------------------ */
  const HERO = (window.__bmaHero = window.__bmaHero || {});
  const defaults = {
    bigCx: 1.16, // big planet centre X (fraction of width, off-screen right)
    bigCy: 1.34, // big planet centre Y (fraction of height, off-screen bottom)
    bigR: 1.46, // big planet radius (fraction of height) - only its limb shows
    smallR: 0.095, // small sphere radius (fraction of height)
    gap: 0.014, // clearance between the small sphere and the limb (frac height)
    angStart: -130, // small sphere angle at p=0 (deg; on-screen, upper area)
    angEnd: -196, // small sphere angle at p=1 (rolled down + off the bottom-left)
    lightDeg: -123, // light direction (deg) - upper-left of the planet centre
    spin: 1, // 1 = small sphere spins as it rolls, 0 = off
    smallImg: "assets/hero-sphere.png", // small sphere image (transparent circle)
    imgZoom: 1.04, // slight over-draw so the circle fills the clip with no fringe
    rim: "#d4e6f6", // limb / rim-light colour
    baseLit: "#13243d", // lit-side base of the canvas spheres
    baseDark: "#070d18", // far-side shadow of the canvas spheres
    bg0: "#0c1728", // background gradient, upper-left
    bg1: "#080f1e", // background gradient, middle
    bg2: "#05080f", // background gradient, lower-right corner
    fluteFrac: 0.6, // left fraction of the width covered by the fluted glass
    fluteCount: 22, // number of vertical flutes
    fluteStretch: 0.2, // vertical streak elongation per flute
    fluteShade: 0.55, // ribbed light/dark shading strength (0..1)
    copyFade: 1.55, // how fast the copy fades across the scrub (read by CSS)
    staticP: 0.16, // progress shown on the no-pin / reduced-motion frame
    debug: false,
  };
  for (const k in defaults) if (HERO[k] == null) HERO[k] = defaults[k];

  /* ----------------------------- helpers ------------------------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function hx(c) {
    let s = c.replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  function rgba(c, a) {
    const o = hx(c);
    return "rgba(" + o.r + "," + o.g + "," + o.b + "," + a + ")";
  }
  function mix(c1, c2, t) {
    const a = hx(c1),
      b = hx(c2);
    return (
      "rgb(" +
      Math.round(lerp(a.r, b.r, t)) +
      "," +
      Math.round(lerp(a.g, b.g, t)) +
      "," +
      Math.round(lerp(a.b, b.b, t)) +
      ")"
    );
  }

  /* ----------------------- small-sphere image -------------------------- */
  let imgReady = false;
  let repaint = function () {}; // set by whichever path runs
  const img = new Image();
  img.decoding = "async";
  img.onload = function () {
    imgReady = true;
    repaint();
  };
  img.onerror = function () {
    imgReady = false; // fall back to the canvas-drawn sphere
  };
  img.src = HERO.smallImg;

  /* --------------------------- big-planet image ------------------------ */
  // The big "circle" is now planet-blue.png. Its center is placed off-screen
  // bottom-right (same geo() center as the canvas sphere), scaled so its radius
  // matches g.bR - so only the planet's TOP-LEFT quarter curves into frame.
  let planetReady = false;
  const planetImg = new Image();
  planetImg.decoding = "async";
  planetImg.onload = function () {
    planetReady = true;
    repaint();
  };
  planetImg.onerror = function () {
    planetReady = false; // fall back to the canvas-drawn sphere
  };
  planetImg.src = HERO.planetImg || "assets/planet-blue.png";

  /* --------------------------- sizing / dpr ---------------------------- */
  let W = 0,
    H = 0,
    dpr = 1;
  const fbuf = document.createElement("canvas"); // flute-refraction snapshot
  const fctx = fbuf.getContext("2d");
  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    const cap = window.innerWidth < 900 ? 1.25 : 1.5;
    dpr = Math.min(cap, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }

  /* ----------------------------- geometry ------------------------------ */
  function geo() {
    const bcx = HERO.bigCx * W;
    const bcy = HERO.bigCy * H;
    const bR = HERO.bigR * H;
    const sR = HERO.smallR * H;
    const orbit = bR + HERO.gap * H + sR;
    return { bcx, bcy, bR, sR, orbit };
  }
  function smallPos(p, g) {
    const ang = (lerp(HERO.angStart, HERO.angEnd, p) * Math.PI) / 180;
    return {
      x: g.bcx + g.orbit * Math.cos(ang),
      y: g.bcy + g.orbit * Math.sin(ang),
      ang,
    };
  }

  /* ----------------------------- rendering ----------------------------- */
  function background() {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, HERO.bg0);
    grad.addColorStop(0.55, HERO.bg1);
    grad.addColorStop(1, HERO.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // a shaded sphere lit from HERO.lightDeg, with a soft crescent rim and an
  // optional sharp limb line. Used for the big planet and as the small fallback.
  function sphere(cx, cy, r, opts) {
    const la = (HERO.lightDeg * Math.PI) / 180;
    const lx = Math.cos(la),
      ly = Math.sin(la);
    opts = opts || {};

    const gx = cx + lx * r * 0.5;
    const gy = cy + ly * r * 0.5;
    const bg = ctx.createRadialGradient(gx, gy, r * 0.04, cx, cy, r * 1.04);
    bg.addColorStop(0, mix(HERO.baseLit, HERO.baseDark, 0.15));
    bg.addColorStop(0.5, mix(HERO.baseLit, HERO.baseDark, 0.55));
    bg.addColorStop(1, HERO.baseDark);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    const ex = cx + lx * r,
      ey = cy + ly * r;
    const spread = (opts.rimSpread || 0.62) * r;
    const rg = ctx.createRadialGradient(ex, ey, 0, ex, ey, spread);
    rg.addColorStop(
      0,
      rgba(HERO.rim, opts.rimAlpha != null ? opts.rimAlpha : 0.8),
    );
    rg.addColorStop(0.45, rgba(HERO.rim, 0.16));
    rg.addColorStop(1, rgba(HERO.rim, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    if (opts.limb) {
      const half = opts.limbArc || Math.PI / 2.1;
      ctx.beginPath();
      ctx.arc(cx, cy, r - opts.limbW * 0.5, la - half, la + half);
      ctx.lineWidth = opts.limbW;
      ctx.strokeStyle = rgba(HERO.rim, opts.limbAlpha || 0.85);
      ctx.lineCap = "round";
      ctx.shadowColor = rgba(HERO.rim, 0.6);
      ctx.shadowBlur = opts.limbW * 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawSmall(p, g) {
    const s = smallPos(p, g);
    const r = g.sR;
    const sweep = ((HERO.angEnd - HERO.angStart) * Math.PI) / 180;
    const rollSpin = HERO.spin ? (g.orbit * sweep * p) / r : 0;
    if (imgReady) {
      // clip to a circle (insurance against any square/white edge in the asset)
      // and over-draw slightly so the image circle fills the clip cleanly.
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.clip();
      ctx.translate(s.x, s.y);
      ctx.rotate(rollSpin);
      const z = HERO.imgZoom || 1;
      ctx.drawImage(img, -r * z, -r * z, r * 2 * z, r * 2 * z);
      ctx.restore();
      // a soft rim glow to seat the image in the scene's light
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.clip();
      const la = (HERO.lightDeg * Math.PI) / 180;
      const ex = s.x + Math.cos(la) * r,
        ey = s.y + Math.sin(la) * r;
      const rg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.85);
      rg.addColorStop(0, rgba(HERO.rim, 0.5));
      rg.addColorStop(0.5, rgba(HERO.rim, 0.08));
      rg.addColorStop(1, rgba(HERO.rim, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      sphere(s.x, s.y, r, {
        rimSpread: 0.7,
        rimAlpha: 0.82,
        limb: true,
        limbW: Math.max(1, r * 0.05),
        limbArc: Math.PI / 2.3,
        limbAlpha: 0.7,
      });
    }
  }

  // ribbed-glass pass over the left region: snapshot it, then redraw each flute
  // from a thin centreline strip stretched across the flute width and vertically,
  // so anything crossing (limb, sphere) smears into vertical streaks. Operates in
  // device pixels (call after the main scene has been drawn + ctx restored).
  function flutePass() {
    if (HERO.fluteFrac <= 0 || HERO.fluteCount < 1) return;
    const Hd = canvas.height;
    const span = Math.min(
      canvas.width,
      Math.round(canvas.width * HERO.fluteFrac),
    );
    if (span < 2) return;
    if (fbuf.width !== span || fbuf.height !== Hd) {
      fbuf.width = span;
      fbuf.height = Hd;
    }
    fctx.clearRect(0, 0, span, Hd);
    fctx.drawImage(canvas, 0, 0, span, Hd, 0, 0, span, Hd);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // device px
    const n = HERO.fluteCount;
    const fw = span / n;
    const sw = Math.max(1, fw * 0.32);
    const vs = 1 + HERO.fluteStretch;
    const dy = -((vs - 1) * Hd) * 0.5;
    for (let i = 0; i < n; i++) {
      const x0 = i * fw;
      const cxs = x0 + fw * 0.5;
      const sx = clamp(cxs - sw / 2, 0, span - sw);
      // fade the effect out over the rightmost flutes so there's no hard seam
      const a = clamp((n - i) / (n * 0.26), 0, 1);
      ctx.globalAlpha = a;
      ctx.drawImage(fbuf, sx, 0, sw, Hd, x0, dy, fw + 0.6, Hd * vs);
      const lg = ctx.createLinearGradient(x0, 0, x0 + fw, 0);
      lg.addColorStop(0, rgba("#ffffff", 0.05 * HERO.fluteShade * a));
      lg.addColorStop(0.5, rgba("#000000", 0.12 * HERO.fluteShade * a));
      lg.addColorStop(1, rgba("#ffffff", 0.05 * HERO.fluteShade * a));
      ctx.fillStyle = lg;
      ctx.fillRect(x0, 0, fw + 1, Hd);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // draw planet-blue.png as the big planet: center at g.bcx/g.bcy (off-screen
  // bottom-right), radius g.bR, clipped to a circle so the limb reads clean. Only
  // the top-left quarter falls inside the viewport. Falls back to canvas sphere.
  function drawBigPlanet(g) {
    if (!planetReady) {
      sphere(g.bcx, g.bcy, g.bR, {
        rimSpread: 0.18,
        rimAlpha: 0.55,
        limb: true,
        limbW: Math.max(1.4, H * 0.0022),
        limbArc: Math.PI / 2.6,
        limbAlpha: 0.92,
      });
      return;
    }
    const r = g.bR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.bcx, g.bcy, r, 0, TAU);
    ctx.clip();
    ctx.drawImage(planetImg, g.bcx - r, g.bcy - r, r * 2, r * 2);
    ctx.restore();
    // a soft rim light along the lit limb so it seats into the scene
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.bcx, g.bcy, r, 0, TAU);
    ctx.clip();
    const la = (HERO.lightDeg * Math.PI) / 180;
    const ex = g.bcx + Math.cos(la) * r,
      ey = g.bcy + Math.sin(la) * r;
    const rg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.5);
    rg.addColorStop(0, rgba(HERO.rim, 0.35));
    rg.addColorStop(0.5, rgba(HERO.rim, 0.08));
    rg.addColorStop(1, rgba(HERO.rim, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(g.bcx - r, g.bcy - r, r * 2, r * 2);
    ctx.restore();
  }

  function render(p) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    background();

    const g = geo();
    drawBigPlanet(g);
    drawSmall(p, g);

    if (HERO.debug) {
      ctx.beginPath();
      ctx.arc(g.bcx, g.bcy, g.bR, 0, TAU);
      ctx.strokeStyle = "rgba(255,0,80,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(g.bcx, g.bcy, g.orbit, 0, TAU);
      ctx.strokeStyle = "rgba(0,200,255,0.25)";
      ctx.stroke();
    }
    ctx.restore();

    flutePass();
  }

  HERO.dump = function () {
    const g = geo();
    return {
      W,
      H,
      dpr,
      imgReady,
      big: { x: g.bcx, y: g.bcy, r: g.bR },
      smallR: g.sR,
      start: smallPos(0, g),
      end: smallPos(1, g),
    };
  };

  /* ----------------------- static (no-pin) path ------------------------ */
  function setStatic() {
    section.classList.add("hero-sphere--static");
    resize();
    section.style.setProperty("--hp", String(HERO.staticP));
    repaint = function () {
      render(HERO.staticP);
    };
    repaint();
    let raf = 0;
    window.addEventListener(
      "resize",
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          resize();
          render(HERO.staticP);
        });
      },
      { passive: true },
    );
  }

  if (noPin) {
    setStatic();
    return;
  }

  /* ------------------------- pinned scrub path ------------------------- */
  resize();
  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  let anchor = null;
  let pinDist = 0;
  function measure() {
    const docTop = section.getBoundingClientRect().top + scrollPos();
    anchor = docTop;
    pinDist = window.innerHeight;
  }

  let lastP = -1;
  function frame() {
    if (anchor === null) measure();
    const s = scrollPos();
    const t = clamp(s - anchor, 0, pinDist);
    stage.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    const p = pinDist > 0 ? t / pinDist : 0;
    if (Math.abs(p - lastP) > 0.0005) {
      lastP = p;
      section.style.setProperty("--hp", p.toFixed(4));
      // once the copy has faded out, drop it from the tab order so keyboard
      // users don't land on invisible CTAs (CSS hides it via visibility).
      section.classList.toggle("hero-sphere--past", p > 0.62);
      render(p);
    }
  }
  repaint = function () {
    lastP = -1;
    frame();
  };

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
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { rootMargin: "200px 0px 200px 0px", threshold: 0 },
    ).observe(section);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (section.getBoundingClientRect().bottom > 0) start();
  });
  window.addEventListener(
    "resize",
    () => {
      anchor = null;
      resize();
      lastP = -1;
      frame();
    },
    { passive: true },
  );

  // first paint: frame() renders with the correct scroll value, so this is right
  // even if the script loads after the page has already been scrolled.
  frame();
})();
