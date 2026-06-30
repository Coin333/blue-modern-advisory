/* cc-laptop.js — "The BMA Operating System".

   A full-width 3D laptop (the OPEN one in laptop.glb; the closed laptop in the
   same model is hidden) with the REAL capabilities pipeline embedded on its
   screen in true 3D. The screen content is HTML rendered by CSS3DRenderer that
   shares the WebGL camera, so the live pipeline (and the boot screen) sit on the
   display and tilt with the model toward the cursor.

   Sequence: the screen powers on (brand-blue boot + BMA logo + loader), then
   "loads into" the pipeline — at which point it fires `bma:os-emit`, and
   cc-hero.js reveals/plays the pipeline that now lives on the screen.

   Placement is intentionally tunable: every framing/screen value is read LIVE
   from `window.__bmaLaptop` each frame, so it can be nudged in the console and
   updates instantly. Tell me the values that look right and I'll bake them in.

   Progressive enhancement: gated to capable desktops. On reduced-motion, small
   viewports, low memory, or data-saver the laptop is skipped, the pipeline is
   left in normal flow full-width, and `bma:os-emit` fires immediately. */
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { CSS3DRenderer, CSS3DObject } from "./vendor/CSS3DRenderer.js";

const host = document.querySelector("[data-cc-os]");
const flow = document.querySelector(".cc-flow");

let emitted = false;
function emitPipeline() {
  if (emitted) return;
  emitted = true;
  document.dispatchEvent(new CustomEvent("bma:os-emit"));
}

if (host && flow) {
  const mq =
    window.matchMedia || (() => ({ matches: false, addEventListener() {} }));
  const reduce = mq("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 900;
  const lowMem =
    typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  // Mobile is allowed (shown smaller); only genuinely weak contexts fall back.
  if (reduce || lowMem || saveData) {
    host.setAttribute("data-cc-os-skip", "");
    emitPipeline(); // pipeline plays full-width in normal flow
  } else {
    let started = false;
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          started = true;
          near.disconnect();
          boot().catch((err) => {
            console.warn("[cc-laptop] boot failed, falling back:", err);
            host.setAttribute("data-cc-os-skip", "");
            emitPipeline();
          });
        }
      },
      { rootMargin: "500px 0px" },
    );
    near.observe(host);
  }
}

async function boot() {
  window.__bmaEmbed = true; // cc-hero: skip the flat cluster intro, just reveal

  /* ---- tunables (live; edit window.__bmaLaptop.* in the console) ---------- */
  const CFG = (window.__bmaLaptop = window.__bmaLaptop || {});
  const def = (k, v) => (CFG[k] = CFG[k] ?? v);
  // zoom: end size of the push-in. Bigger = the screen reads more legibly. The
  // keyboard runs off the bottom at the end; that's intended (focus on the app).
  def("fill", window.innerWidth < 700 ? 1.5 : 2.1);
  def("fov", 32);
  def("baseYaw", -0.18); // resting turn of the laptop (rad)
  def("basePitch", -0.02);
  def("baseRoll", 0);
  def("tiltYaw", 0.28); // cursor yaw range
  def("tiltPitch", 0.16); // cursor pitch range
  def("scrX", 0); // screen-center offset from the lid anchor (model units)
  def("scrY", 8);
  def("scrZ", -37); // seat the screen onto the lid glass (off the AABB front)
  def("scrRotX", -0.36); // match the lid's open angle
  def("scrRotY", 0);
  def("scrSquash", 0.95); // vertical scale of the screen only (<1 = less tall)
  def("scrScale", 0.21); // tuned size on the lid (overrides the auto-derived fit)
  def("spin", 0); // inspection sweep: set >0 to yaw the laptop back and forth
  def("pxW", 1100); // screen element width (px); height is set from lid aspect
  // camY, pxH are derived from the model geometry after it loads

  /* ------------------------------- renderers ----------------------------- */
  const canvas = document.createElement("canvas");
  canvas.className = "cc-os-canvas";
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.innerWidth < 700 ? 1.25 : 1.5,
    ),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const css = new CSS3DRenderer();
  css.domElement.className = "cc-os-css";
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 1, 6000);

  const key = new THREE.DirectionalLight(0xf2f7ff, 2.2);
  key.position.set(0.6, 1.4, 1.2);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 1.2);
  rim.position.set(-1.2, 0.6, -0.9);
  const amb = new THREE.HemisphereLight(0xdce9f6, 0x0b1d2e, 1.1);
  scene.add(key, rim, amb);

  const group = new THREE.Group(); // tilt pivot (WebGL laptop)
  const cssGroup = new THREE.Group(); // tilt pivot mirror (CSS3D screen)
  scene.add(group);
  cssScene.add(cssGroup);

  /* ------------------------------ the screen ----------------------------- */
  // One element holds the boot overlay + the real pipeline; CSS3DObject puts it
  // in 3D on the lid. The existing .cc-flow is MOVED in (kept interactive).
  const screen = document.createElement("div");
  screen.className = "cc-screen";
  screen.style.width = CFG.pxW + "px";
  screen.style.height = (CFG.pxH || 700) + "px"; // refined to lid aspect on load
  screen.innerHTML =
    '<div class="cc-screen-boot" aria-hidden="true">' +
    '<div class="cc-screen-badge"><img src="assets/bma.png" alt=""></div>' +
    '<div class="cc-screen-word">Blue Modern Advisory</div>' +
    '<div class="cc-screen-sub">GTM OPERATING SYSTEM</div>' +
    '<div class="cc-screen-bar"><span></span></div>' +
    "</div>";
  const flowWrap = document.createElement("div");
  flowWrap.className = "cc-screen-app";
  flow.parentNode.insertBefore(flowWrap, flow);
  flowWrap.appendChild(flow); // relocate the live pipeline onto the screen
  screen.appendChild(flowWrap);

  const screenObj = new CSS3DObject(screen);
  cssGroup.add(screenObj);

  /* ------------------------------ load model ----------------------------- */
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().load("assets/macbook.glb", res, undefined, rej),
  );
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh && o.material) {
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      });
    }
  });

  // Normalize to a known size, THEN center. The macbook exports at sub-unit
  // (metre) scale, which made the camera/screen math collapse - normalizing
  // makes all framing + screen placement scale-independent.
  const TARGET = 240;
  let cbox = new THREE.Box3().setFromObject(model);
  const csize = cbox.getSize(new THREE.Vector3());
  model.scale.setScalar(TARGET / (Math.max(csize.x, csize.y, csize.z) || 1));
  model.updateWorldMatrix(true, true);
  cbox = new THREE.Box3().setFromObject(model);
  model.position.sub(cbox.getCenter(new THREE.Vector3()));
  group.add(model);
  group.updateWorldMatrix(true, true);

  const wbox = new THREE.Box3().setFromObject(model);
  const wsize = wbox.getSize(new THREE.Vector3());
  const wcenter = wbox.getCenter(new THREE.Vector3());
  const fitR = wbox.getBoundingSphere(new THREE.Sphere()).radius; // for framing

  // soft contact shadow so the laptop reads as resting on a surface
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(wsize.x, wsize.z) * 0.55, 48),
    new THREE.MeshBasicMaterial({
      color: 0x0b1d2e,
      transparent: true,
      opacity: 0.16,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = wbox.min.y + 1;
  group.add(shadow);

  // Auto-detect the display: the largest broad, thin panel in the upper half
  // (the open lid). Its front face + size calibrate the screen so it lands ON
  // the lid regardless of the model. Fine-tune via window.__bmaLaptop.scr*.
  let disp = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    const s = b.getSize(new THREE.Vector3());
    const c = b.getCenter(new THREE.Vector3());
    const thin = Math.min(s.x, s.y, s.z);
    const broad = (s.x * s.y * s.z) / (thin || 1e-6);
    if (c.y >= wcenter.y && (!disp || broad > disp.broad)) {
      disp = { broad, c, s, box: b };
    }
  });

  const lidAnchor = new THREE.Vector3();
  if (disp) {
    lidAnchor.set(disp.c.x, disp.c.y, disp.box.max.z); // front face of the lid
    def("scrScale", (disp.s.x * 0.94) / CFG.pxW);
    CFG.pxH = Math.round(CFG.pxW * (disp.s.y / disp.s.x)); // match lid aspect
    screen.style.height = CFG.pxH + "px";
  } else {
    lidAnchor.set(0, wbox.max.y * 0.5, wbox.max.z * 0.55);
    def("scrScale", (wsize.x * 0.6) / CFG.pxW);
  }
  def("camY", wsize.y * 0.14); // gentle look-down, proportional to the model
  def("targetY", lidAnchor.y * 0.62); // zoom-in ends focused up on the screen

  // expose for live tuning + in-console geometry analysis
  window.__bmaScene = {
    THREE,
    scene,
    camera,
    group,
    cssGroup,
    model,
    screenObj,
  };

  /* ------------------------------ boot timeline -------------------------- */
  // pure CSS/JS on the screen element; fires emit when it loads into the app
  requestAnimationFrame(() => {
    canvas.classList.add("is-on");
    css.domElement.classList.add("is-on");
    screen.classList.add("is-powering");
  });
  setTimeout(() => screen.classList.add("is-branded"), 900);
  setTimeout(() => {
    screen.classList.add("is-live"); // boot fades out, pipeline shown
    emitPipeline();
  }, 3000);
  setTimeout(emitPipeline, 6500); // failsafe

  /* ------------------------------ cursor tilt ---------------------------- */
  let tgX = 0,
    tgY = 0,
    curX = 0,
    curY = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      tgX = (e.clientX / window.innerWidth) * 2 - 1;
      tgY = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  /* --------------------------- resize + visibility ----------------------- */
  function resize() {
    const w = host.clientWidth || 960;
    const h = host.clientHeight || 560;
    renderer.setSize(w, h, false);
    css.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let visible = true;
  new IntersectionObserver(
    (entries) => entries.forEach((e) => (visible = e.isIntersecting)),
    { threshold: 0 },
  ).observe(host);

  /* ------------------------------- render -------------------------------- */
  const clock = new THREE.Clock();
  let t = 0;
  let acc = 0;
  const STEP = 1 / 36; // throttle to ~36fps: the tilt + pipeline don't need 60
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    if (!visible) return;
    acc += dt;
    if (acc < STEP) return; // skip frames to cut CSS3D + WebGL cost
    acc = 0;

    // live framing: fit the bounding SPHERE so the whole laptop stays visible
    // at any rotation (tilt/spin) and accounts for depth + corners. CFG.fill is
    // the zoom (1 = sphere touches the frame; raise it for a larger laptop).
    camera.fov = CFG.fov;
    const vt = Math.tan((CFG.fov * Math.PI) / 360);
    const tight = Math.min(vt, vt * camera.aspect); // tighter half-fov (tan)
    // one-time zoom-in onto the animation: start pulled back on the whole
    // laptop, then push in and pan up to the screen as the pipeline loads (~3s)
    const zp = Math.min(1, Math.max(0, (t - 3) / 1.7));
    const ez = 1 - Math.pow(1 - zp, 3); // easeOut
    const effFill = CFG.fill * (0.5 + 0.5 * ez);
    const dist = fitR / (tight / Math.sqrt(1 + tight * tight)) / effFill;
    camera.position.set(0, CFG.camY, dist);
    camera.lookAt(0, CFG.targetY * ez, 0); // pan up onto the screen
    camera.updateProjectionMatrix();

    // tilt toward cursor + idle float, mirrored onto the CSS3D group
    curX += (tgX - curX) * 0.06;
    curY += (tgY - curY) * 0.06;
    const idle = Math.sin(t * 0.55) * 0.02;
    const yaw = CFG.spin
      ? Math.sin(t * 0.4) * CFG.spin // sweep side to side to check alignment
      : CFG.baseYaw + curX * CFG.tiltYaw + idle;
    const pitch = CFG.basePitch + curY * CFG.tiltPitch * 0.5;
    group.rotation.set(pitch, yaw, CFG.baseRoll);
    cssGroup.rotation.copy(group.rotation);

    // place the screen on the lid (live-tunable)
    screenObj.position.set(
      lidAnchor.x + CFG.scrX,
      lidAnchor.y + CFG.scrY,
      lidAnchor.z + CFG.scrZ,
    );
    screenObj.rotation.set(CFG.scrRotX, CFG.scrRotY, 0);
    screenObj.scale.set(
      CFG.scrScale,
      CFG.scrScale * CFG.scrSquash,
      CFG.scrScale,
    );

    renderer.render(scene, camera);
    css.render(cssScene, camera);
  }
  loop();

  console.info(
    "[cc-laptop] tune with window.__bmaLaptop (live):",
    JSON.stringify(CFG),
  );
}
