/* "What We Build" - a ball rolling a fluted QUARTER-CIRCLE arc (v6).

   Redesign: the ball no longer rides a serpentine line. It rolls slowly along a
   quarter-circle arc that reads as the COMPLETION of the hero's big circle. The
   arc itself is not a drawn line - it's the ball's invisible path. The hero's
   fluted-glass "distortion pattern" is copied here verbatim: a band of subtle
   VERTICAL light/dark ribbed strips down the LEFT of the stage, fading out on
   the right so there's no seam. As the ball travels, ONE card is shown per
   quarter of the arc, each replacing the last.

   Everything is scroll-scrubbed (pure function of pin progress p in [0,1]) so it
   reverses exactly. The arc is STATIC in the pinned viewport (you see the whole
   quarter) and the ball moves along it - no camera follow.

   All geometry is live-tunable via window.__bmaWwb (edit in the console; it
   rebuilds on the next resize, or call __bmaWwb.rebuild()):
     cx, cy   - arc circle centre as a fraction of (stage width, height)
     R        - arc radius as a fraction of stage height
     angStart - ball's angle at p=0 (deg)   |  a 90 deg span = a quarter circle
     angEnd   - ball's angle at p=1 (deg)    |
     flutes   - number of vertical ribbed strips in the left glass band
     fluteFrac - left fraction of stage width the glass band covers
     fluteShade - ribbed light/dark strength (0..1; copied from the hero)
     rollFactor - how fast the ball spins vs distance rolled
     flipV    - mirror the arc top-to-bottom (curve bends the other way)
     fluteStretch - vertical stretch of each refracted strip (hero flutePass)
     circleShow - draw the circle the ball rides along

   Fake pin (transform, since sticky is broken under overflow-x:hidden). Touch /
   coarse / small / reduced-motion get a static fallback. Uses vanilla Motion
   (motion-web) for scroll(). */
import { scroll } from "https://cdn.jsdelivr.net/npm/motion@12/+esm";

(function () {
  const section = document.querySelector("#what-bma-builds");
  const scene = section && section.querySelector("[data-wwb-scene]");
  if (!section || !scene) return;

  // carousel.js calls window.bmaPipeline.freeze()/unfreeze() during the hero ->
  // carousel glide. Keep the shim so nothing downstream breaks.
  if (!window.bmaPipeline) {
    window.bmaPipeline = { freeze() {}, unfreeze() {} };
  }

  const stage = scene.querySelector(".wwb2-stage");
  const pathWrap = scene.querySelector(".wwb2-path");
  const svg = scene.querySelector(".wwb2-zig");
  const linePath = scene.querySelector(".wwb2-zig-path");
  const ball = scene.querySelector(".wwb2-ball");
  const cards = [...scene.querySelectorAll(".wwb2-card")];
  if (!stage || !pathWrap || !svg || !linePath || !ball || cards.length !== 4)
    return;

  // the fluted glass is drawn the hero's way, on a canvas layered in the stage.
  const ballImg = ball.querySelector("img");
  const cvs = document.createElement("canvas");
  cvs.className = "wwb2-canvas";
  stage.insertBefore(cvs, stage.firstChild);
  const cx2d = cvs.getContext("2d");
  const fbuf = document.createElement("canvas"); // flute-refraction snapshot
  const fctx = fbuf.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  ball.style.opacity = "0"; // the canvas draws the ball so the glass can refract it
  ball.style.pointerEvents = "none";
  // the header lives inside the stage now; we scrub its opacity per frame (inline
  // beats the scroll-reveal class) and kill its transition so there's no lag.
  const header = scene.querySelector(".bridge-text");
  if (header) {
    header.style.transition = "none";
    header.style.pointerEvents = "none";
  }

  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const reduce = mq("(prefers-reduced-motion: reduce)");
  const coarse = mq("(hover: none)") || mq("(pointer: coarse)");
  const noPin = reduce || coarse || window.innerWidth < 768;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const NS = "http://www.w3.org/2000/svg";
  const QUARTERS = 4; // one card per quarter of the arc
  const LUT_N = 400;

  // ---- live-tunable geometry (window.__bmaWwb) ----------------------------
  const WWB = (window.__bmaWwb = window.__bmaWwb || {});
  const wdef = {
    cx: 0.9, // arc centre x (frac of stage width) - off to the right
    cy: 1.02, // arc centre y (frac of stage height) - just below the bottom
    R: 1.0, // arc radius (frac of stage height)
    angStart: 182, // p=0 angle (deg): left of centre, ball high on the left
    angEnd: 268, // p=1 angle (deg): top of centre -> ~86 deg quarter sweep
    flutes: 24, // vertical ribbed strips in the left glass band (hero ~22)
    fluteFrac: 0.55, // left fraction of stage width the glass band covers
    fluteShade: 0.55, // ribbed light/dark strength (0..1; copied from the hero)
    rollFactor: 1.1, // ball spin vs distance rolled
    flipV: true, // mirror the arc top-to-bottom (curve bends the other way)
    fluteStretch: 0.2, // vertical stretch of each refracted strip (hero value)
    circleShow: true, // draw the circle the ball rides along
  };
  for (const k in wdef) if (WWB[k] == null) WWB[k] = wdef[k];

  // ---- geometry state -----------------------------------------------------
  let W = 0,
    H = 0,
    BALL_R = 48,
    TOTAL_LEN = 0;
  const CIRC = { cx: 0, cy: 0, R: 0 }; // circle the ball rides (px): centre + radius
  const lutX = new Float64Array(LUT_N + 1);
  const lutY = new Float64Array(LUT_N + 1);
  const lutRoll = new Float64Array(LUT_N + 1);

  function buildGeometry() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    BALL_R = ball.getBoundingClientRect().width / 2 || 48;

    const cx = WWB.cx * W;
    const cy = WWB.cy * H;
    const R = WWB.R * H;
    const a0 = (WWB.angStart * Math.PI) / 180;
    const a1 = (WWB.angEnd * Math.PI) / 180;

    // author the arc directly in stage-pixel coords (viewBox = 0 0 W H) so the
    // LUT points map 1:1 to stage space -> ball positioning needs no scaling.
    const SEG = 160;
    const rawX = new Array(SEG + 1);
    const rawY = new Array(SEG + 1);
    let yMin = Infinity,
      yMax = -Infinity;
    for (let i = 0; i <= SEG; i++) {
      const a = a0 + (a1 - a0) * (i / SEG);
      rawX[i] = cx + R * Math.cos(a);
      rawY[i] = cy + R * Math.sin(a);
      if (rawY[i] < yMin) yMin = rawY[i];
      if (rawY[i] > yMax) yMax = rawY[i];
    }
    // "flip it vertically": mirror the arc about its own vertical centre so it
    // keeps its screen position but the curve bends the opposite way. Applied to
    // the path, the ball's LUT (read off the path) and the flutes alike.
    const yMid = (yMin + yMax) / 2;
    const fy = WWB.flipV ? (y) => 2 * yMid - y : (y) => y;
    CIRC.cx = cx;
    CIRC.cy = WWB.flipV ? 2 * yMid - cy : cy;
    CIRC.R = R;
    let d = "";
    for (let i = 0; i <= SEG; i++) {
      d +=
        (i ? " L " : "M ") + rawX[i].toFixed(2) + " " + fy(rawY[i]).toFixed(2);
    }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    pathWrap.style.transform = "translateY(0px)";
    pathWrap.style.height = H + "px";
    linePath.setAttribute("d", d); // kept for getPointAtLength; styled invisible

    // ---- arc-length LUT (len -> x, y, rolling spin) ------------------------
    TOTAL_LEN = linePath.getTotalLength();
    const arcStep = TOTAL_LEN / LUT_N;
    let rollAccum = 0;
    let prevX = null;
    for (let i = 0; i <= LUT_N; i++) {
      const pt = linePath.getPointAtLength((TOTAL_LEN * i) / LUT_N);
      lutX[i] = pt.x;
      lutY[i] = pt.y;
      if (prevX !== null) {
        const dx = pt.x - prevX;
        const sign = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        rollAccum +=
          (arcStep / BALL_R) * WWB.rollFactor * (180 / Math.PI) * sign;
      }
      prevX = pt.x;
      lutRoll[i] = rollAccum;
    }

    sizeCanvas();
  }

  // the hero's "distortion pattern", ported verbatim: a band of VERTICAL flutes
  // down the LEFT of the stage. Each flute is a full-height strip carrying the
  // hero's ribbed light|dark|light shading (white 0.05 / black 0.12, scaled by
  // fluteShade), and the band fades out over its rightmost flutes so there's no
  // hard seam - exactly the falloff the hero uses over its rightmost ribs.
  function buildFlutes() {
    ensureRibGradient();
    let g = svg.querySelector(".wwb2-flute-group");
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.setAttribute("class", "wwb2-flute-group");
    }
    svg.appendChild(g); // keep the ribs on top: glass over the sphere
    while (g.firstChild) g.removeChild(g.firstChild);

    const n = Math.max(2, WWB.flutes | 0);
    const band = clamp(WWB.fluteFrac, 0, 1) * W; // left glass band width
    const fw = band / n; // per-flute width
    for (let i = 0; i < n; i++) {
      const x0 = i * fw;
      // fade the effect out over the rightmost ~26% of flutes (hero's trick)
      const a = clamp((n - i) / (n * 0.26), 0, 1);
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "wwb2-flute");
      r.setAttribute("x", x0.toFixed(1));
      r.setAttribute("y", "0");
      r.setAttribute("width", (fw + 0.6).toFixed(2));
      r.setAttribute("height", H.toFixed(1));
      r.setAttribute("fill", "url(#wwb2-rib)"); // objectBoundingBox: light|dark|light per strip
      r.setAttribute("opacity", a.toFixed(3));
      g.appendChild(r);
    }
  }

  function ensureDefs() {
    let defs = svg.querySelector("defs.wwb2-defs");
    if (!defs) {
      defs = document.createElementNS(NS, "defs");
      defs.setAttribute("class", "wwb2-defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    return defs;
  }

  // one linear gradient reused by every flute (objectBoundingBox units, so it
  // maps light->dark->light across each strip's own width). The stop opacities
  // are the hero's flutePass values (0.05 white edges, 0.12 black centre) scaled
  // by fluteShade; re-applied on every rebuild so the knob is live.
  function ensureRibGradient() {
    const defs = ensureDefs();
    if (!defs.querySelector("#wwb2-rib")) {
      const lg = document.createElementNS(NS, "linearGradient");
      lg.setAttribute("id", "wwb2-rib");
      lg.setAttribute("x1", "0");
      lg.setAttribute("y1", "0");
      lg.setAttribute("x2", "1");
      lg.setAttribute("y2", "0");
      ["0", "0.5", "1"].forEach((off, i) => {
        const s = document.createElementNS(NS, "stop");
        s.setAttribute("offset", off);
        s.setAttribute("stop-color", i === 1 ? "#000000" : "#ffffff");
        lg.appendChild(s);
      });
      defs.appendChild(lg);
    }
    const shade = clamp(WWB.fluteShade, 0, 1);
    const stops = defs.querySelectorAll("#wwb2-rib stop");
    if (stops.length === 3) {
      stops[0].setAttribute("stop-opacity", (0.05 * shade).toFixed(4));
      stops[1].setAttribute("stop-opacity", (0.12 * shade).toFixed(4));
      stops[2].setAttribute("stop-opacity", (0.05 * shade).toFixed(4));
    }
  }

  // the ball's refraction as it rolls through the glass: a purely VERTICAL
  // gaussian blur (stdDeviation x~0.4, y = live) so the moving ball smears into a
  // vertical streak the way the hero's fluted glass stretches the sphere. Lives
  // in the wwb2 svg; the ball (a DOM node) references it via CSS
  // `filter: url(#wwb2-ballsmear)`. stdDeviation.y is set per frame in render().
  function ensureBallSmear() {
    const defs = ensureDefs();
    if (!defs.querySelector("#wwb2-ballsmear")) {
      const f = document.createElementNS(NS, "filter");
      f.setAttribute("id", "wwb2-ballsmear");
      f.setAttribute("x", "-40%");
      f.setAttribute("y", "-90%");
      f.setAttribute("width", "180%");
      f.setAttribute("height", "280%");
      f.setAttribute("color-interpolation-filters", "sRGB");
      const b = document.createElementNS(NS, "feGaussianBlur");
      b.setAttribute("in", "SourceGraphic");
      b.setAttribute("stdDeviation", "0.4 0");
      f.appendChild(b);
      defs.appendChild(f);
    }
  }
  function setBallSmear(y) {
    const b = svg.querySelector("#wwb2-ballsmear feGaussianBlur");
    if (b) b.setAttribute("stdDeviation", "0.4 " + Math.max(0, y).toFixed(1));
  }

  function sampleLUT(lenFrac) {
    const t = clamp(lenFrac, 0, 1) * LUT_N;
    const i = Math.min(LUT_N - 1, Math.floor(t));
    const f = t - i;
    return {
      x: lutX[i] + (lutX[i + 1] - lutX[i]) * f,
      y: lutY[i] + (lutY[i + 1] - lutY[i]) * f,
      roll: lutRoll[i] + (lutRoll[i + 1] - lutRoll[i]) * f,
    };
  }

  // ---- canvas: draw the scene, then refract the left band (hero flutePass) --
  function sizeCanvas() {
    cvs.width = Math.round(W * DPR);
    cvs.height = Math.round(H * DPR);
    cvs.style.width = W + "px";
    cvs.style.height = H + "px";
  }

  // draw the scene the hero way: navy field, the circle the ball rides, and the
  // ball itself - then refract the left band through the flutes (flutePass).
  function drawScene(s, p) {
    const g = cx2d;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = g.createRadialGradient(
      0.78 * W,
      0.6 * H,
      0,
      0.78 * W,
      0.6 * H,
      1.05 * Math.max(W, H),
    );
    bg.addColorStop(0, "#1b2b46");
    bg.addColorStop(0.52, "#111f36");
    bg.addColorStop(1, "#0b1526");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // the ball "comes in" - fades up over the first sliver of the lock (the same
    // window the header text fades out over).
    let intro = 1;
    if (typeof p === "number") {
      const t = clamp(p / 0.12, 0, 1);
      intro = t * t * (3 - 2 * t); // smoothstep
    }
    // the big circle (sphere limb) is ALWAYS fully drawn so the rolling ball has a
    // surface to sit on and the two spheres read as touching.
    if (WWB.circleShow !== false) {
      g.strokeStyle = "rgba(202,227,249,0.5)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(CIRC.cx, CIRC.cy, CIRC.R, 0, Math.PI * 2);
      g.stroke();
    }
    // the ball sits tangent just OUTSIDE the circle (pushed out along the radius by
    // its own radius) so the small sphere touches the big one instead of straddling
    // its line.
    if (ballImg && ballImg.complete && ballImg.naturalWidth && intro > 0.01) {
      const nx = s.x - CIRC.cx;
      const ny = s.y - CIRC.cy;
      const nlen = Math.hypot(nx, ny) || 1;
      const off = BALL_R * 0.92;
      g.save();
      g.globalAlpha = intro;
      g.translate(s.x + (nx / nlen) * off, s.y + (ny / nlen) * off);
      g.rotate((s.roll * Math.PI) / 180);
      g.drawImage(ballImg, -BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);
      g.restore();
    }
    flutePass();
  }

  // ===== ported VERBATIM from the hero (hero-spheres.js flutePass) ===========
  // snapshot the left region, then redraw each flute from a thin centreline strip
  // stretched across the flute width and vertically so anything crossing it
  // smears into vertical streaks; then lay the ribbed light/dark shading on top.
  function flutePass() {
    const frac = clamp(WWB.fluteFrac, 0, 1);
    const n = WWB.flutes | 0;
    if (frac <= 0 || n < 1) return;
    const Hd = cvs.height;
    const span = Math.min(cvs.width, Math.round(cvs.width * frac));
    if (span < 2) return;
    if (fbuf.width !== span || fbuf.height !== Hd) {
      fbuf.width = span;
      fbuf.height = Hd;
    }
    fctx.clearRect(0, 0, span, Hd);
    fctx.drawImage(cvs, 0, 0, span, Hd, 0, 0, span, Hd);

    cx2d.save();
    cx2d.setTransform(1, 0, 0, 1, 0, 0); // device px
    const fw = span / n;
    const sw = Math.max(1, fw * 0.32);
    const vs = 1 + (WWB.fluteStretch || 0);
    const dy = -((vs - 1) * Hd) * 0.5;
    const shade = clamp(WWB.fluteShade, 0, 1);
    for (let i = 0; i < n; i++) {
      const x0 = i * fw;
      const cxs = x0 + fw * 0.5;
      const sx = clamp(cxs - sw / 2, 0, span - sw);
      const a = clamp((n - i) / (n * 0.26), 0, 1);
      cx2d.globalAlpha = a;
      cx2d.drawImage(fbuf, sx, 0, sw, Hd, x0, dy, fw + 0.6, Hd * vs);
      const lg = cx2d.createLinearGradient(x0, 0, x0 + fw, 0);
      lg.addColorStop(0, "rgba(255,255,255," + 0.05 * shade * a + ")");
      lg.addColorStop(0.5, "rgba(0,0,0," + 0.12 * shade * a + ")");
      lg.addColorStop(1, "rgba(255,255,255," + 0.05 * shade * a + ")");
      cx2d.fillStyle = lg;
      cx2d.fillRect(x0, 0, fw + 1, Hd);
    }
    cx2d.globalAlpha = 1;
    cx2d.restore();
  }

  // ---- render: static arc, ball moves along it, one card per quarter ------
  function render(p) {
    p = clamp(p, 0, 1);
    const s = sampleLUT(p); // p maps linearly onto arc length -> constant speed
    drawScene(s, p); // navy + full circle + tangent ball, refracted via flutePass
    // the header fades out as the ball comes in (same 0 -> ~0.14 window)
    if (header) header.style.opacity = clamp(1 - p / 0.14, 0, 1).toFixed(3);

    const active = clamp(Math.floor(p * QUARTERS), 0, QUARTERS - 1);
    for (let k = 0; k < QUARTERS; k++) {
      cards[k].classList.toggle("is-open", k === active);
    }
    scene.style.setProperty("--wwb-p", p.toFixed(4));
    scene.style.setProperty("--wwb-card", String(active));
  }

  // ---- static / no-pin fallback ------------------------------------------
  function setStatic() {
    scene.classList.add("wwb2--static");
    buildGeometry();
    if (header) header.style.opacity = "1";
    drawScene(sampleLUT(0.001));
    if (ballImg && !ballImg.complete)
      ballImg.addEventListener("load", () => drawScene(sampleLUT(0.001)), {
        once: true,
      });
    cards.forEach((c, k) => c.classList.toggle("is-open", k === 0));
  }
  if (noPin) {
    setStatic();
    WWB.rebuild = setStatic;
    return;
  }

  scene.classList.add("wwb2--scrub");
  section.classList.add("is-scrub");

  // ---- fake pin (translateY the stage) ------------------------------------
  const scrollPos = () =>
    window.lenis && typeof window.lenis.scroll === "number"
      ? window.lenis.scroll
      : window.scrollY || window.pageYOffset || 0;

  let anchor = null;
  let pinDist = 0;
  let curT = 0;
  function measurePin() {
    const vh = window.innerHeight;
    const stageH = stage.offsetHeight || vh;
    const targetTop = Math.max(0, (vh - stageH) / 2);
    const docTop = stage.getBoundingClientRect().top - curT + scrollPos();
    anchor = docTop - targetTop;
    const sectionDocTop = section.getBoundingClientRect().top + scrollPos();
    const sectionDocBottom = sectionDocTop + section.offsetHeight;
    pinDist = Math.max(1, sectionDocBottom - vh - anchor);
  }
  function applyPin() {
    if (anchor === null) measurePin();
    const t = clamp(scrollPos() - anchor, 0, pinDist);
    curT = t;
    stage.style.transform = t ? "translateY(" + t.toFixed(1) + "px)" : "";
    return pinDist > 0 ? t / pinDist : 0;
  }

  buildGeometry();
  scroll(
    () => {
      render(applyPin());
    },
    { target: section, offset: ["start start", "end end"] },
  );

  let raf = 0;
  function reprime() {
    anchor = null;
    buildGeometry();
    render(applyPin());
  }
  WWB.rebuild = reprime;
  window.addEventListener(
    "resize",
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(reprime);
    },
    { passive: true },
  );

  render(applyPin());
  if (ballImg && !ballImg.complete)
    ballImg.addEventListener("load", () => render(applyPin()), { once: true });
})();
