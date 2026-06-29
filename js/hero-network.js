/* Hero network for BMA - a modern skyscraper made of light.
   Tower nodes spring to a stepped lattice (corner columns, floor rings, crown
   spire) and sway gently. Six radiant capability hubs float all around and
   through it (clickable, with icon popups). A cinematic camera spirals around
   the tower - panning a slow circle while rising and zooming, then easing back.
   Click-drag grabs the model and turns it freely; it resumes the orbit when
   idle. Only the three.js core is a dependency; the rest is generated. */
import * as THREE from "./vendor/three.module.js";

const NODE = { mist: 0x9ab3c4, steel: 0x6f8fa6, orange: 0xd98a4a };

const HUBS = [
  {
    title: "GTM Strategy",
    icon: "icons/strategy.svg",
    blurb: "Turns market priorities into a clear prospecting motion.",
    deliverables: "ICP logic, market maps, workflow roadmap",
    outcome: "A focused motion the team can execute and improve.",
    color: 0xe8b07a,
  },
  {
    title: "Prospecting Systems",
    icon: "icons/System.svg",
    blurb:
      "Builds workflows that identify, enrich, qualify, and route target accounts.",
    deliverables: "Sourcing logic, research fields, routing rules",
    outcome: "A repeatable source of qualified accounts and contacts.",
    color: 0x6fb6c9,
  },
  {
    title: "Data Enrichment & CRM Hygiene",
    icon: "icons/data.svg",
    blurb: "Cleans, enriches, and refreshes account and contact data.",
    deliverables: "Field maps, validation rules, refresh logic",
    outcome: "Better targeting, cleaner handoffs, and stronger reporting.",
    color: 0x5fb6a8,
  },
  {
    title: "Multi-Channel Outbound",
    icon: "icons/outbound.svg",
    blurb: "Connects research, messaging, sequencing, and human follow-up.",
    deliverables: "Message architecture, sequence logic, trigger rules",
    outcome:
      "Consistent outreach that reaches the right accounts at the right time.",
    color: 0x8fa6d6,
  },
  {
    title: "Pipeline Operations",
    icon: "icons/pipeline.svg",
    blurb:
      "Defines ownership, routing, QA, and reporting for pipeline workflows.",
    deliverables: "CRM rules, dashboards, QA checks",
    outcome: "Clear handoffs and visibility across the funnel.",
    color: 0xd98a4a,
  },
  {
    title: "Warm Contact Intelligence",
    icon: "icons/intelligence.svg",
    blurb:
      "Maps relationship paths and warm introductions into target accounts.",
    deliverables: "Relationship maps, contact paths, activation workflows",
    outcome: "More effective outreach through trusted connections.",
    color: 0xb9c6d2,
  },
  {
    title: "Data Warehouse Enrichment",
    icon: "icons/warehouse.svg",
    blurb:
      "Enriches internal datasets with structured fields and quality checks.",
    deliverables: "Enriched schema, quality report, operating notes",
    outcome: "Data that can support actual GTM decisions.",
    color: 0xb392d6,
  },
];
const HUB_HREF = "capabilities.html";

const Y_BOT = -17,
  Y_TOP = 15,
  FLOORS = 15;
const DEEP_STEP = 8; // vertical spacing of the plunging shaft / base floors
const Y_WIDEN = -74; // depth where the shaft stops running straight and flares out
const WIDEN_SPAN = 34; // vertical distance over which the flare fully opens
const WIDEN_X = 1.8; // length-side flare - the long face widens most
const WIDEN_Z = 0.85; // width-side flare - the short face widens less
const THICK_LEN = 56; // length of the thick shaft, and the height of the base below
const BASE_MULT = 6; // the base footprint is ~6x the slender top of the tower
const RING_SP = 7; // node spacing around a shaft floor's perimeter
const GRID_SP = 7.5; // node spacing across the solid base block
const FADE_START = -118; // nodes stay crisp above the fog, then dissolve into it
const Y_DEEP = -210; // fully faded by here - the base is swallowed by the mist
const HXB = 7.6,
  HZB = 5.6;
const STRUCT_STEP = 3.4; // tight floor spacing for the structured descent (top-like)
const Y_STRUCT_END = -100; // carry the top's lattice this far down before it thins
function footprint(t) {
  if (t > 0.88) return 0.5;
  if (t > 0.66) return 0.66;
  if (t > 0.4) return 0.83;
  return 1;
}
function depthFade(y) {
  if (y >= FADE_START) return 1;
  const c = Math.max(0, Math.min(1, (y - Y_DEEP) / (FADE_START - Y_DEEP)));
  return c * c * (3 - 2 * c); // smoothstep dissolve into the dark city below
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function ss(u) {
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * u * (u * (u * 6 - 15) + 10); // smootherstep: speed-ramp ease
}
function lerpAng(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t; // interpolate angles along the shortest path
}
// Frame-rate-independent critically damped smoothing (no overshoot). Returns
// [newValue, newVelocity]; om is the response frequency, dt the frame time.
function smoothDamp(cur, target, vel, om, dt) {
  const f = om * dt;
  const e = 1 / (1 + f + 0.48 * f * f + 0.235 * f * f * f);
  const ch = cur - target;
  const tmp = (vel + om * ch) * dt;
  return [target + (ch + tmp) * e, (vel - om * tmp) * e];
}
// One floor's perimeter ring, nodes spaced ~RING_SP so wide floors stay linked.
function pushRing(H, y, hx, hz) {
  const nx = Math.max(1, Math.round((2 * hx) / RING_SP));
  const nz = Math.max(1, Math.round((2 * hz) / RING_SP));
  H.push([-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz]);
  for (let s = 1; s < nx; s++) {
    const x = -hx + (2 * hx * s) / nx;
    H.push([x, y, -hz], [x, y, hz]);
  }
  for (let s = 1; s < nz; s++) {
    const z = -hz + (2 * hz * s) / nz;
    H.push([-hx, y, z], [hx, y, z]);
  }
}
// One floor of the solid base: a filled grid of nodes (not just a ring).
function pushSlab(H, y, hx, hz, sp) {
  const nx = Math.max(1, Math.round((2 * hx) / sp));
  const nz = Math.max(1, Math.round((2 * hz) / sp));
  for (let ix = 0; ix <= nx; ix++) {
    const x = -hx + (2 * hx * ix) / nx;
    for (let iz = 0; iz <= nz; iz++) {
      const z = -hz + (2 * hz * iz) / nz;
      H.push([x, y, z]);
    }
  }
}
// One floor in the slender top's own style: corners + edge nodes, filled so wide
// floors stay linked. Reproduces the top's 8-node ring exactly when narrow.
function pushFloor(H, y, hx, hz) {
  const nx = Math.max(2, Math.round((2 * hx) / RING_SP));
  const nz = Math.max(2, Math.round((2 * hz) / RING_SP));
  for (let s = 0; s <= nx; s++) {
    const x = -hx + (2 * hx * s) / nx;
    H.push([x, y, -hz], [x, y, hz]);
  }
  for (let s = 1; s < nz; s++) {
    const z = -hz + (2 * hz * s) / nz;
    H.push([-hx, y, z], [hx, y, z]);
  }
}
function buildTower() {
  const H = [];
  for (let f = 0; f < FLOORS; f++) {
    const t = f / (FLOORS - 1);
    const y = Y_BOT + (Y_TOP - Y_BOT) * t;
    const s = footprint(t);
    const hx = HXB * s,
      hz = HZB * s;
    pushFloor(H, y, hx, hz);
  }
  for (let k = 1; k <= 5; k++) H.push([0, Y_TOP + k * 1.5, 0]);
  // Descending shaft: straight at the base width, flares wider below Y_WIDEN
  // (the long face most), then holds that thick width down to the base.
  const FLARE_END = Y_WIDEN - WIDEN_SPAN;
  const Y_THICK_END = FLARE_END - THICK_LEN; // bottom of the constant thick shaft
  const flareW = (y) => {
    const w = Math.max(0, Math.min(1, (Y_WIDEN - y) / WIDEN_SPAN));
    return w * w * (3 - 2 * w); // smoothstep flare
  };
  // Carry the top's dense floor pattern well past Y_BOT on a tight spacing, then
  // thin to a sparser cage (DEEP_STEP) for the deep shaft down to the base.
  for (
    let y = Y_BOT - STRUCT_STEP;
    y >= Y_THICK_END;
    y -= y > Y_STRUCT_END ? STRUCT_STEP : DEEP_STEP
  ) {
    const e = flareW(y);
    const hx = HXB * (1 + WIDEN_X * e),
      hz = HZB * (1 + WIDEN_Z * e);
    if (y > Y_STRUCT_END) pushFloor(H, y, hx, hz);
    else pushRing(H, y, hx, hz);
  }
  // Massive base: a solid, densely filled block ~6x the slender top, dropping
  // the same height as the thick shaft so it reads as a heavy foundation.
  const baseHx = HXB * footprint(1) * BASE_MULT;
  const baseHz = HZB * footprint(1) * BASE_MULT;
  for (
    let y = Y_THICK_END - DEEP_STEP;
    y >= Y_THICK_END - THICK_LEN;
    y -= DEEP_STEP
  ) {
    pushSlab(H, y, baseHx, baseHz, GRID_SP);
  }
  return H;
}

function glowTexture() {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
function haloTexture() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.12, "rgba(255,255,255,0.5)");
  g.addColorStop(0.3, "rgba(255,255,255,0.2)");
  g.addColorStop(0.55, "rgba(255,255,255,0.06)");
  g.addColorStop(0.8, "rgba(255,255,255,0.015)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function fogTexture() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.26)");
  g.addColorStop(0.8, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export function initHeroNetwork(canvas) {
  if (!canvas || canvas.dataset.bmaInit === "1") return;
  canvas.dataset.bmaInit = "1";

  const host = canvas.parentElement;
  let width = host.clientWidth || window.innerWidth;
  let height = host.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4)); // cap fill cost
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();

  // 360 city backdrop: drop an equirectangular panorama at assets/city360.jpg
  // and the tower sits inside it - the camera orbit pans across the skyline.
  // A night cityscape keeps the additive glow readable. Missing/failed file
  // silently falls back to the transparent canvas over the CSS navy gradient.
  new THREE.TextureLoader().load(
    "assets/city360.jpg",
    function (tex) {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      scene.background = tex;
      scene.backgroundIntensity = 0.5; // dim it so the glowing tower stays the hero
      scene.backgroundBlurriness = 0.08; // soft depth behind the lattice
    },
    undefined,
    function () {
      /* no panorama present - keep the navy gradient showing through */
    },
  );

  // far plane clears the full tower + fog (base ~-220) from the pulled-back
  // overview, so the deep structure never clips as the camera orbits
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);

  const TOWER_X = 9;
  const VIEW_SHIFT = -0.07; // nudge the framed tower a little right of centre
  // while focusing a dot, sit it up and to the right so the info card tucks into
  // the space beside it (negative X pushes content right, positive Y pushes up)
  const FOCUS_SHIFT_X = -0.078, // dot lands just left of the popup (~58% width)
    FOCUS_SHIFT_Y = 0.19; // dot sits at the popup card's vertical middle (top:31%)
  let viewShift = VIEW_SHIFT; // horizontal view nudge, eased per state
  let viewShiftY = 0; // vertical view nudge, only while focusing a dot
  function applyViewOffset() {
    camera.setViewOffset(
      width,
      height,
      width * viewShift,
      height * viewShiftY,
      width,
      height,
    );
  }
  applyViewOffset();

  const tower = new THREE.Group();
  tower.position.x = TOWER_X;
  scene.add(tower);
  const ORBIT_C = new THREE.Vector3(TOWER_X, 0, 0);

  const LINK_DIST = 8.6,
    LINK_DIST_SQ = LINK_DIST * LINK_DIST;
  const HUB_LINK_SQ = 12 * 12;
  const SPRING = 0.022,
    DAMP = 0.86;
  const sharedGlow = glowTexture();
  const haloGlow = haloTexture();

  // --- Tower nodes -------------------------------------------------------
  const HOMES = buildTower();
  const COUNT = HOMES.length;
  const homes = new Float32Array(COUNT * 3);
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const pointColors = new Float32Array(COUNT * 3);
  const nodeFade = new Float32Array(COUNT);
  const tmp = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const h = HOMES[i];
    homes[i * 3] = h[0];
    homes[i * 3 + 1] = h[1];
    homes[i * 3 + 2] = h[2];
    positions[i * 3] = h[0] + (Math.random() - 0.5) * 28;
    positions[i * 3 + 1] = h[1] + (Math.random() - 0.5) * 28;
    positions[i * 3 + 2] = h[2] + (Math.random() - 0.5) * 28;
    const fade = depthFade(h[1]);
    nodeFade[i] = fade;
    const rr = Math.random();
    tmp.setHex(rr < 0.14 ? NODE.orange : rr < 0.55 ? NODE.steel : NODE.mist);
    pointColors[i * 3] = tmp.r * fade;
    pointColors[i * 3 + 1] = tmp.g * fade;
    pointColors[i * 3 + 2] = tmp.b * fade;
  }
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointsGeo.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));
  const pointsMat = new THREE.PointsMaterial({
    size: 1.5,
    map: sharedGlow,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  tower.add(new THREE.Points(pointsGeo, pointsMat));

  // --- Fog bank: the tower sinks into drifting mist toward its base -------
  // Soft sprites, denser and wider toward the bottom, veil the deep shaft and
  // foundation so the structure dissolves into night fog rather than the dark.
  const fogTex = fogTexture();
  const FOG_TOP = -92, // mist begins just below the densely-built zone
    FOG_BOT = -216; // and fully swallows the base
  const fog = [];
  for (let i = 0; i < 30; i++) {
    const t = Math.sqrt(Math.random()); // bias the puffs toward the lower band
    const y = FOG_TOP + (FOG_BOT - FOG_TOP) * t;
    const spread = 14 + 42 * t; // a wider pool of mist lower down
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * spread;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fogTex,
        color: 0x8a9bb0, // cool night haze, lit faintly by the city glow
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    const sc = 30 + 34 * t + Math.random() * 12;
    sp.scale.set(sc * 1.4, sc, 1); // flattened so the mist spreads horizontally
    sp.position.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad * 0.7);
    tower.add(sp);
    fog.push({
      sp,
      x: sp.position.x,
      z: sp.position.z,
      phase: Math.random() * Math.PI * 2,
      spd: 0.05 + Math.random() * 0.06,
      drift: 3 + Math.random() * 5,
      op: 0.1 + 0.16 * t, // a denser veil toward the base
    });
  }

  // --- Radiant hubs: float all around + some within the tower ------------
  const hubs = HUBS.map((def, idx) => {
    const color = new THREE.Color(def.color);
    const mk = (sc, tex) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      sp.scale.set(sc, sc, 1);
      return sp;
    };
    const halo = mk(11, haloGlow),
      core = mk(3, sharedGlow);
    core.userData.hub = idx;
    tower.add(halo);
    tower.add(core);
    const ang = (idx / HUBS.length) * Math.PI * 2 + 0.4;
    const inside = idx % 2 === 1; // alternate: through the volume / orbiting outside
    const rad = inside ? 2 + Math.random() * 3 : HXB + 3 + Math.random() * 5;
    return {
      def,
      color,
      halo,
      core,
      pos: [
        Math.cos(ang) * rad,
        Y_BOT + ((idx + 0.5) / HUBS.length) * (Y_TOP - Y_BOT),
        Math.sin(ang) * rad,
      ],
      vel: [
        (Math.random() - 0.5) * 0.011,
        (Math.random() - 0.5) * 0.011,
        (Math.random() - 0.5) * 0.011,
      ],
      pulse: Math.random() * 6.28,
      flare: 0,
      fade: 0,
    };
  });
  const HB = { x0: -13, x1: 13, y0: -19, y1: 23, z0: -12, z1: 12 };

  // --- Links -------------------------------------------------------------
  // The tower's link topology is fixed by the home lattice (nodes only sway a
  // little), so we find the structural links ONCE here instead of running an
  // O(n^2) neighbour search every frame. Per frame we just stream the current
  // node positions into these fixed links; only the roaming hubs link live.
  const lineCol = new THREE.Color(NODE.mist);
  const sI = [],
    sJ = [],
    sT = []; // static link endpoints (i, j) + baked intensity
  for (let i = 0; i < COUNT; i++) {
    if (nodeFade[i] < 0.03) continue; // dissolved deep node - no links
    const ix = homes[i * 3],
      iy = homes[i * 3 + 1],
      iz = homes[i * 3 + 2];
    for (let j = i + 1; j < COUNT; j++) {
      const dx = ix - homes[j * 3],
        dy = iy - homes[j * 3 + 1],
        dz = iz - homes[j * 3 + 2];
      const dsq = dx * dx + dy * dy + dz * dz;
      if (dsq < LINK_DIST_SQ) {
        const lf = nodeFade[i] < nodeFade[j] ? nodeFade[i] : nodeFade[j];
        if (lf < 0.03) continue;
        sI.push(i);
        sJ.push(j);
        sT.push((1 - dsq / LINK_DIST_SQ) * lf);
      }
    }
  }
  const nStatic = sI.length;
  const nPairs = nStatic; // packets travel the static lattice
  const MAX_LINKS = nStatic + COUNT + 260; // lattice + margin for live hub links
  const linkPos = new Float32Array(MAX_LINKS * 6);
  const linkCol = new Float32Array(MAX_LINKS * 6);
  const linksGeo = new THREE.BufferGeometry();
  linksGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
  linksGeo.setAttribute("color", new THREE.BufferAttribute(linkCol, 3));
  tower.add(
    new THREE.LineSegments(
      linksGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  // bake the static link colours once - they never change
  for (let k = 0; k < nStatic; k++) {
    const t = sT[k],
      a = k * 6,
      r = lineCol.r * t,
      g = lineCol.g * t,
      b = lineCol.b * t;
    linkCol[a] = r;
    linkCol[a + 1] = g;
    linkCol[a + 2] = b;
    linkCol[a + 3] = r;
    linkCol[a + 4] = g;
    linkCol[a + 5] = b;
  }
  let nLinks = 0;

  function addLink(ax, ay, az, bx, by, bz, t, col) {
    if (nLinks >= MAX_LINKS) return;
    const a = nLinks * 6;
    linkPos[a] = ax;
    linkPos[a + 1] = ay;
    linkPos[a + 2] = az;
    linkPos[a + 3] = bx;
    linkPos[a + 4] = by;
    linkPos[a + 5] = bz;
    const r = col.r * t,
      g = col.g * t,
      b = col.b * t;
    linkCol[a] = r;
    linkCol[a + 1] = g;
    linkCol[a + 2] = b;
    linkCol[a + 3] = r;
    linkCol[a + 4] = g;
    linkCol[a + 5] = b;
    nLinks++;
  }

  function rebuildLinks(hoverHub) {
    // stream current node positions into the fixed structural links
    for (let k = 0; k < nStatic; k++) {
      const i = sI[k] * 3,
        j = sJ[k] * 3,
        a = k * 6;
      linkPos[a] = positions[i];
      linkPos[a + 1] = positions[i + 1];
      linkPos[a + 2] = positions[i + 2];
      linkPos[a + 3] = positions[j];
      linkPos[a + 4] = positions[j + 1];
      linkPos[a + 5] = positions[j + 2];
    }
    nLinks = nStatic;
    for (let h = 0; h < hubs.length; h++) {
      const p = hubs[h].pos;
      const bright = (h === hoverHub ? 1.6 : 1) * (0.8 + hubs[h].flare);
      for (let i = 0; i < COUNT; i++) {
        const dx = p[0] - positions[i * 3],
          dy = p[1] - positions[i * 3 + 1],
          dz = p[2] - positions[i * 3 + 2];
        const dsq = dx * dx + dy * dy + dz * dz;
        if (dsq < HUB_LINK_SQ) {
          addLink(
            p[0],
            p[1],
            p[2],
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
            Math.min(1, (1 - dsq / HUB_LINK_SQ) * bright),
            hubs[h].color,
          );
        }
      }
    }
    linksGeo.setDrawRange(0, nLinks * 2);
    linksGeo.attributes.position.needsUpdate = true;
    linksGeo.attributes.color.needsUpdate = true;
  }

  // --- Signal packets ----------------------------------------------------
  const PACKETS = width < 700 ? 12 : 26;
  const pkPos = new Float32Array(PACKETS * 3);
  const pkState = [];
  for (let k = 0; k < PACKETS; k++)
    pkState.push({
      i: 0,
      j: 0,
      t: Math.random(),
      speed: 0.0022 + Math.random() * 0.005,
    });
  const pkColors = new Float32Array(PACKETS * 3);
  for (let k = 0; k < PACKETS; k++) {
    pkColors[k * 3] = 1;
    pkColors[k * 3 + 1] = 0.95;
    pkColors[k * 3 + 2] = 0.78;
  }
  const pkGeo = new THREE.BufferGeometry();
  pkGeo.setAttribute("position", new THREE.BufferAttribute(pkPos, 3));
  pkGeo.setAttribute("color", new THREE.BufferAttribute(pkColors, 3));
  const packets = new THREE.Points(
    pkGeo,
    new THREE.PointsMaterial({
      size: 0.85,
      map: sharedGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  tower.add(packets);

  // --- Hover popup -------------------------------------------------------
  const pop = document.createElement("div");
  pop.className = "bma-node-pop";
  pop.innerHTML =
    '<p class="bma-node-pop__t"><span class="bma-node-pop__ic"><span class="bma-node-pop__icmask"></span></span><span class="bma-node-pop__tt"></span></p>' +
    '<p class="bma-node-pop__b"></p>' +
    '<div class="bma-node-pop__meta"><span class="bma-node-pop__label">Deliverables</span><span class="bma-node-pop__val" data-k="deliv"></span></div>' +
    '<div class="bma-node-pop__meta"><span class="bma-node-pop__label">Business Outcome</span><span class="bma-node-pop__val" data-k="out"></span></div>' +
    '<p class="bma-node-pop__c">View capability &rarr;</p>';
  host.appendChild(pop);
  const popIcon = pop.querySelector(".bma-node-pop__ic");
  const popIconMask = pop.querySelector(".bma-node-pop__icmask");
  const popTitle = pop.querySelector(".bma-node-pop__tt");
  const popBody = pop.querySelector(".bma-node-pop__b");
  const popDeliv = pop.querySelector('[data-k="deliv"]');
  const popOut = pop.querySelector('[data-k="out"]');
  // popup stays open while hovered, and clicking it opens the capability
  let popPinned = false;
  pop.addEventListener("pointerenter", () => {
    popPinned = true;
  });
  pop.addEventListener("pointerleave", () => {
    popPinned = false;
  });
  pop.addEventListener("click", () => {
    window.location.href = HUB_HREF;
  });

  // --- Guided-tour card: a wider, FIXED card above the hero text. It does not
  // follow the dot (so it never lags or jitters); content cross-fades as the
  // tour moves from dot to dot. Same styling as the hover card. -------------
  const tourPop = document.createElement("div");
  tourPop.className = "bma-tour-pop";
  tourPop.innerHTML =
    '<p class="bma-tour-pop__tt"></p>' +
    '<p class="bma-tour-pop__b"></p>' +
    '<span class="bma-tour-pop__c">Learn more &rarr;</span>';
  host.appendChild(tourPop);
  const tTitle = tourPop.querySelector(".bma-tour-pop__tt");
  const tBody = tourPop.querySelector(".bma-tour-pop__b");
  tourPop.addEventListener("click", () => {
    window.location.href = HUB_HREF;
  });

  // --- Interaction -------------------------------------------------------
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0, inside: false };
  let hoverHub = -1;
  // orbit state - the camera ALWAYS orbits the building centre (ORBIT_C); only
  // the eased look-at point moves, so focusing a dot centres it on screen
  // without ever changing the rotation axis.
  const orbit = { az: -0.5, el: 1.0, r: 16 }; // start zoomed into the top
  const look = new THREE.Vector3(ORBIT_C.x, Y_TOP - 1, ORBIT_C.z); // smoothed look-at
  const lookTarget = new THREE.Vector3();
  const lookVel = new THREE.Vector3(); // spring velocity for the look-at
  const SLOW_MIN = 0.12; // bullet-time scale while a capability popup is open
  // scripted tour
  const OV = { az: 0.7, el: 0.42, r: 60 }; // pulled-out overview framing
  const T_INTRO = 2.5,
    T_PAUSE = 3,
    T_FLY = 1.7,
    T_HOLD = 3; // seconds: zoom-out, pause, fly-to-hub, dwell
  const tourOrder = hubs.map((_, i) => i);
  let camState = "intro",
    stateT = 0,
    tourIdx = -1,
    tourHub = -1;
  // camera spring: the state machine only sets these targets, and a critically
  // damped spring eases the orbit toward them - carrying velocity across stage
  // changes so every transition is seamless (no per-stage snapshots needed).
  let tAz = orbit.az,
    tEl = orbit.el,
    tR = orbit.r,
    vAz = 0,
    vEl = 0,
    vR = 0,
    approachDir = 1, // sign the dwell-spin keeps, matching the fly-in's turn
    resumeT = 99; // ramps the spring back up gradually after a manual grab
  // framing to view a dot: sit out past it (still orbiting the centre)
  function hubFraming(hp) {
    const dx = hp[0], // hp is tower-local and the tower origin is ORBIT_C,
      dz = hp[2]; // so the local coords already are the offset from centre
    return { az: Math.atan2(dx, dz), el: 0.16, r: Math.hypot(dx, dz) + 20 };
  }
  // sign of the shortest azimuth turn from where the camera is now to a dot's
  // framing - i.e. which way the fly-in rotates - so the dwell keeps that spin
  function dirToHub(idx) {
    let d =
      (hubFraming(hubs[tourOrder[idx]].pos).az - orbit.az) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d < -Math.PI) d += Math.PI * 2;
    return d < 0 ? -1 : 1;
  }
  // grab swivel: direct 1:1 drag (no lag), with a smoothed throw on release
  let manual = false,
    dragging = false,
    dragMoved = 0,
    dragX = 0,
    dragY = 0,
    pendAz = 0, // raw drag input accumulated this frame
    pendEl = 0,
    velAz = 0, // smoothed swivel speed -> consistent throw inertia
    velEl = 0,
    settle = 0; // frames the drift has been ~stopped

  function onPointer(e) {
    const r = host.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width;
    pointer.y = (e.clientY - r.top) / r.height;
    pointer.inside =
      pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
    ndc.set(pointer.x * 2 - 1, -(pointer.y * 2) + 1);
  }
  function onDown(e) {
    dragging = true;
    manual = true; // grabbing interrupts the tour and any drift
    dragMoved = 0;
    settle = 0;
    velAz = 0; // start from rest so the swivel ramps up (startup inertia)
    velEl = 0;
    pendAz = 0;
    pendEl = 0;
    dragX = e.clientX;
    dragY = e.clientY;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  }
  function onDrag(e) {
    if (!dragging) return;
    const dx = e.clientX - dragX,
      dy = e.clientY - dragY;
    dragX = e.clientX;
    dragY = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    pendAz += -dx * 0.006; // eased into velocity in step()
    pendEl += dy * 0.006;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    settle = 0;
    velAz *= 1.25; // gentle throw; velAz already holds the smoothed swivel speed
    velEl *= 1.25;
    if (dragMoved < 6 && hoverHub >= 0) window.location.href = HUB_HREF; // tap = open
  }
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointermove", onDrag, { passive: true });
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);

  function resize() {
    width = host.clientWidth || window.innerWidth;
    height = host.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    applyViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener("resize", resize);

  let running = true;
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((en) => {
        running = en.isIntersecting;
        if (running) loop();
      }),
    { threshold: 0.01 },
  );
  io.observe(host);

  const v = new THREE.Vector3();
  let lastNow = performance.now();
  let frame = 0,
    flareTimer = 150,
    lastHub = -1,
    slow = 1, // eased time scale: drops while a popup is open, then resumes
    swayT = 0, // sway phase accumulator (advances at the slowed rate)
    popX = 0, // smoothed popup screen position (px) for a non-clunky follow
    popY = 0,
    popW = 340, // cached popup size (measured once on open, not every frame)
    popH = 220,
    tourShown = -1; // which hub the fixed guided-tour card is currently showing

  function step() {
    const now = performance.now();
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (dt > 0.1) dt = 0.1; // clamp after a tab stall or a paused loop
    // bullet-time while a capability popup is open: ease the whole scene's
    // motion down a lot, then back up once the cursor leaves the dot/card.
    const showing =
      (tourHub >= 0 && !manual) || lastHub >= 0 || hoverHub >= 0 || popPinned;
    slow += ((showing && !dragging ? SLOW_MIN : 1) - slow) * 0.06;
    swayT += 0.01 * slow;
    const time = swayT;

    // nodes spring to a gently swaying tower home
    for (let i = 0; i < COUNT; i++) {
      const p = i * 3;
      const tx = homes[p] + Math.sin(time * 0.4 + i * 0.6) * 0.22;
      const ty = homes[p + 1] + Math.cos(time * 0.32 + i * 0.4) * 0.16;
      const tz = homes[p + 2] + Math.sin(time * 0.5 + i * 0.9) * 0.22;
      velocities[p] += (tx - positions[p]) * SPRING;
      velocities[p + 1] += (ty - positions[p + 1]) * SPRING;
      velocities[p + 2] += (tz - positions[p + 2]) * SPRING;
      velocities[p] *= DAMP;
      velocities[p + 1] *= DAMP;
      velocities[p + 2] *= DAMP;
      positions[p] += velocities[p];
      positions[p + 1] += velocities[p + 1];
      positions[p + 2] += velocities[p + 2];
    }
    // subtle cursor repulsion (skipped while dragging the model)
    if (pointer.inside && !dragging) {
      v.set(ndc.x, ndc.y, 0.5).unproject(camera);
      v.sub(camera.position).normalize();
      const d = (ORBIT_C.z - camera.position.z) / v.z;
      v.set(
        camera.position.x + v.x * d,
        camera.position.y + v.y * d,
        ORBIT_C.z,
      );
      tower.worldToLocal(v);
      const cx = v.x,
        cy = v.y,
        R2 = 40;
      for (let i = 0; i < COUNT; i++) {
        const dx = positions[i * 3] - cx,
          dy = positions[i * 3 + 1] - cy;
        const dsq = dx * dx + dy * dy;
        if (dsq < R2 && dsq > 0.01) {
          const f = (1 - dsq / R2) * 0.02,
            inv = 1 / Math.sqrt(dsq);
          velocities[i * 3] += dx * inv * f;
          velocities[i * 3 + 1] += dy * inv * f;
        }
      }
    }
    pointsGeo.attributes.position.needsUpdate = true;

    // floating hubs (bounce inside their box)
    flareTimer -= slow;
    if (flareTimer <= 0) {
      hubs[(Math.random() * hubs.length) | 0].flare = 1;
      flareTimer = 150 + Math.random() * 180;
    }
    for (let h = 0; h < hubs.length; h++) {
      const n = hubs[h];
      n.pos[0] += n.vel[0] * slow;
      n.pos[1] += n.vel[1] * slow;
      n.pos[2] += n.vel[2] * slow;
      if (n.pos[0] < HB.x0 || n.pos[0] > HB.x1) n.vel[0] *= -1;
      if (n.pos[1] < HB.y0 || n.pos[1] > HB.y1) n.vel[1] *= -1;
      if (n.pos[2] < HB.z0 || n.pos[2] > HB.z1) n.vel[2] *= -1;
      n.pulse += 0.018 * slow;
      if (n.flare > 0) n.flare = Math.max(0, n.flare - 0.007 * slow);
      const breathe = 0.5 + 0.5 * Math.sin(n.pulse);
      // big hubs light up when hovered, when their tour card is showing, or when
      // their popup is pinned - eased per hub so the glow swells in and fades out
      const litTarget =
        h === hoverHub || h === tourHub || (popPinned && h === lastHub) ? 1 : 0;
      n.glow = (n.glow || 0) + (litTarget - (n.glow || 0)) * 0.12;
      const hot = n.glow;
      n.fade = Math.min(1, n.fade + 0.02);
      n.core.position.set(n.pos[0], n.pos[1], n.pos[2]);
      n.halo.position.set(n.pos[0], n.pos[1], n.pos[2]);
      const hs = 12 + breathe * 2.4 + n.flare * 8 + hot * 6.5;
      n.halo.scale.set(hs, hs, 1);
      n.halo.material.opacity =
        (0.32 + breathe * 0.16 + n.flare * 0.55 + hot * 0.5) * n.fade;
      const cs = 2.6 + breathe * 0.5 + hot * 1.2 + n.flare * 1.2;
      n.core.scale.set(cs, cs, 1);
      n.core.material.opacity = Math.min(1, (0.85 + hot * 0.35) * n.fade);
    }

    rebuildLinks(hoverHub);

    for (let k = 0; k < PACKETS; k++) {
      const s = pkState[k];
      s.t += s.speed * slow;
      if (s.t >= 1 || s.i === s.j) {
        s.t = 0;
        if (nPairs > 0) {
          const idx = (Math.random() * nPairs) | 0;
          s.i = sI[idx];
          s.j = sJ[idx];
        }
        s.speed = 0.0022 + Math.random() * 0.005;
      }
      const ai = s.i * 3,
        bi = s.j * 3,
        t = s.t;
      pkPos[k * 3] = positions[ai] + (positions[bi] - positions[ai]) * t;
      pkPos[k * 3 + 1] =
        positions[ai + 1] + (positions[bi + 1] - positions[ai + 1]) * t;
      pkPos[k * 3 + 2] =
        positions[ai + 2] + (positions[bi + 2] - positions[ai + 2]) * t;
    }
    pkGeo.attributes.position.needsUpdate = true;

    // --- camera: scripted tour around the building centre, grab-interruptible
    // Always orbit ORBIT_C; the look-at point eases between the centre and the
    // focused dot, so a dot is centred without ever moving the rotation axis. A
    // grab swivels 1:1 (no lag) around the centre and throws on release; the
    // tour resumes once that inertia has mostly settled.
    const FRICTION = 0.95, // drift decay after release
      OM = 3.6, // camera smoothing frequency (lower = slower, more languid glide)
      OML = 4.4; // look-at smoothing frequency
    let omL = OML; // look-at frequency, ramped down briefly after a grab resumes
    if (manual) {
      lookTarget.copy(ORBIT_C); // grab looks at the centre = clean building orbit
      if (dragging) {
        orbit.az += pendAz; // direct: responsive, no lag
        orbit.el = Math.max(-0.35, Math.min(1.35, orbit.el + pendEl));
        velAz = velAz * 0.65 + pendAz * 0.35; // smoothed speed for the throw
        velEl = velEl * 0.65 + pendEl * 0.35;
        pendAz = 0;
        pendEl = 0;
      } else {
        orbit.az += velAz; // drift, decaying to a stop
        orbit.el = Math.max(-0.35, Math.min(1.35, orbit.el + velEl));
        velAz *= FRICTION;
        velEl *= FRICTION;
        if (Math.abs(velAz) + Math.abs(velEl) < 0.0016) settle++;
        else settle = 0;
        if (settle > 18) {
          manual = false; // inertia gone - smoothly resume the tour
          vAz = 0;
          vEl = 0;
          vR = 0;
          resumeT = 0; // ease back into the tour gradually, not at full speed
          if (camState === "toHub") stateT = 0; // give the fly-in its full time
        }
      }
    } else {
      resumeT += dt; // count up from a resume so the spring ramps back to full
      if (!(camState === "atHub" && popPinned)) stateT += dt; // hovering holds dwell
      if (camState === "intro") {
        tAz = OV.az;
        tEl = OV.el;
        tR = OV.r;
        lookTarget.set(ORBIT_C.x, 0, ORBIT_C.z);
        if (stateT >= T_INTRO) {
          camState = "pause";
          stateT = 0;
        }
      } else if (camState === "pause") {
        tAz = OV.az + stateT * 0.1; // slow rotation while holding the overview
        tEl = OV.el;
        tR = OV.r;
        lookTarget.set(ORBIT_C.x, 0, ORBIT_C.z);
        if (stateT >= T_PAUSE) {
          tourIdx = 0;
          approachDir = dirToHub(0);
          camState = "toHub";
          stateT = 0;
        }
      } else if (camState === "toHub") {
        const hp = hubs[tourOrder[tourIdx]].pos;
        const f = hubFraming(hp);
        tAz = f.az;
        tEl = f.el;
        tR = f.r;
        lookTarget.set(ORBIT_C.x + hp[0], hp[1], hp[2]); // dot world pos, centred
        if (stateT >= T_FLY) {
          camState = "atHub";
          stateT = 0;
        }
      } else {
        const hp = hubs[tourOrder[tourIdx]].pos;
        const f = hubFraming(hp);
        tAz = f.az + stateT * 0.05 * approachDir; // dwell-spin follows the approach
        tEl = f.el;
        tR = f.r;
        lookTarget.set(ORBIT_C.x + hp[0], hp[1], hp[2]); // dot world pos, centred
        tourHub = tourOrder[tourIdx];
        if (stateT >= T_HOLD) {
          tourHub = -1;
          if (tourIdx + 1 >= tourOrder.length) {
            camState = "intro";
            stateT = 0;
            tourIdx = -1;
          } else {
            tourIdx++;
            approachDir = dirToHub(tourIdx);
            camState = "toHub";
            stateT = 0;
          }
        }
      }
      // critically damped, frame-rate-independent smoothing toward the target.
      // just after a grab releases, omO ramps from gentle up to full so the
      // camera eases back into the tour gradually instead of snapping to it
      const ramp = 0.3 + 0.7 * ss(Math.min(1, resumeT / 1.3));
      const omO = OM * ramp;
      omL = OML * ramp;
      [orbit.az, vAz] = smoothDamp(
        orbit.az,
        lerpAng(orbit.az, tAz, 1),
        vAz,
        omO,
        dt,
      );
      [orbit.el, vEl] = smoothDamp(orbit.el, tEl, vEl, omO, dt);
      orbit.el = Math.max(-0.35, Math.min(1.35, orbit.el));
      [orbit.r, vR] = smoothDamp(orbit.r, tR, vR, omO, dt);
    }
    // smooth the look-at toward its target every frame (all states, dt-based)
    [look.x, lookVel.x] = smoothDamp(look.x, lookTarget.x, lookVel.x, omL, dt);
    [look.y, lookVel.y] = smoothDamp(look.y, lookTarget.y, lookVel.y, omL, dt);
    [look.z, lookVel.z] = smoothDamp(look.z, lookTarget.z, lookVel.z, omL, dt);
    // while focusing a dot, ease the framing up and to the right so the info
    // card sits beside it; otherwise hold the gentle right-bias at centre height
    const focusing = !manual && (camState === "toHub" || camState === "atHub");
    viewShift += ((focusing ? FOCUS_SHIFT_X : VIEW_SHIFT) - viewShift) * 0.06;
    viewShiftY += ((focusing ? FOCUS_SHIFT_Y : 0) - viewShiftY) * 0.06;
    applyViewOffset();
    const ce = Math.cos(orbit.el),
      se = Math.sin(orbit.el);
    camera.position.set(
      ORBIT_C.x + orbit.r * ce * Math.sin(orbit.az),
      ORBIT_C.y + orbit.r * se,
      ORBIT_C.z + orbit.r * ce * Math.cos(orbit.az),
    );
    camera.lookAt(look);
    tower.updateMatrixWorld();

    const reveal = Math.min(1, frame / 80);
    pointsMat.opacity = 0.95 * reveal;
    packets.material.opacity = reveal;

    // drifting fog: gentle horizontal sway + a slow breathing opacity
    for (let i = 0; i < fog.length; i++) {
      const f = fog[i];
      f.sp.position.x = f.x + Math.sin(time * f.spd + f.phase) * f.drift;
      f.sp.position.z =
        f.z + Math.cos(time * f.spd * 0.8 + f.phase) * f.drift * 0.6;
      f.sp.material.opacity =
        f.op * reveal * (0.82 + 0.18 * Math.sin(time * 0.5 + f.phase));
    }

    // during the auto explanatory sequence (flying to / dwelling on a dot, and
    // not user-driven) dot selection is locked out - you can only pick another
    // dot when zoomed out (intro / pause) or once you've grabbed control
    const tourLocked =
      !manual && (camState === "toHub" || camState === "atHub");
    if (pointer.inside && !tourLocked) {
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(
        hubs.map((h) => h.core),
        false,
      )[0];
      hoverHub = hit ? hit.object.userData.hub : -1;
    } else hoverHub = -1;
    canvas.style.cursor = dragging
      ? "grabbing"
      : hoverHub >= 0
        ? "pointer"
        : "grab";

    // Two separate cards: the guided tour uses a FIXED, wider card above the
    // hero text (no dot-following); manual hover uses the dot-anchored card.
    // They never show together, so hovering can't hijack the tour mid-sequence.
    const tourActive = !manual && tourHub >= 0;
    if (tourActive) {
      if (tourHub !== tourShown) {
        const n = hubs[tourHub];
        const c = "#" + n.color.getHexString();
        tourPop.style.setProperty("--pop-accent", c);
        tTitle.textContent = n.def.title;
        tBody.textContent = n.def.blurb;
        tourPop.classList.add("is-on");
        tourShown = tourHub;
      }
    } else if (tourShown !== -1) {
      tourPop.classList.remove("is-on");
      tourShown = -1;
    }
    // manual hover card - dot-anchored, suppressed during the guided tour
    let activeHub = -1;
    if (!dragging && !tourActive) {
      if (hoverHub >= 0) activeHub = hoverHub;
      else if (popPinned && lastHub >= 0) activeHub = lastHub;
    }
    if (activeHub >= 0) {
      const n = hubs[activeHub];
      const justOpened = activeHub !== lastHub;
      if (justOpened) {
        const c = "#" + n.color.getHexString();
        pop.style.setProperty("--pop-accent", c); // tints rail, icon, CTA
        popIcon.style.background = c + "1f";
        popIcon.style.borderColor = c + "3a";
        popIconMask.style.background = c;
        popIconMask.style.webkitMaskImage = 'url("' + n.def.icon + '")';
        popIconMask.style.maskImage = 'url("' + n.def.icon + '")';
        popTitle.textContent = n.def.title;
        popBody.textContent = n.def.blurb;
        popDeliv.textContent = n.def.deliverables;
        popOut.textContent = n.def.outcome;
        pop.classList.add("is-on");
        lastHub = activeHub;
        popW = pop.offsetWidth || 340; // measure once per open (no per-frame reflow)
        popH = pop.offsetHeight || 220;
      }
      // project the dot, then ease the card toward it so the follow is smooth
      n.core.getWorldPosition(v).project(camera);
      const sx = (v.x * 0.5 + 0.5) * width,
        sy = (-v.y * 0.5 + 0.5) * height;
      if (justOpened) {
        popX = sx; // appear at the dot, no slide-in from a stale spot
        popY = sy;
      } else {
        popX += (sx - popX) * 0.2;
        popY += (sy - popY) * 0.2;
      }
      // anchor to the RIGHT of the dot; flip left if it would run off-screen,
      // and clamp vertically (popW/popH cached on open - no per-frame reflow)
      pop.classList.toggle("bma-node-pop--left", popX + 34 + popW > width - 16);
      const cy = Math.max(
        96 + popH / 2,
        Math.min(height - 16 - popH / 2, popY),
      );
      pop.style.left = popX + "px";
      pop.style.top = cy + "px";
    } else if (lastHub !== -1) {
      pop.classList.remove("is-on");
      lastHub = -1;
    }

    renderer.render(scene, camera);
    frame++;
  }

  let rafId = 0;
  let revealed = false;
  function loop() {
    if (!running) return;
    step();
    if (!revealed) {
      // hold the first (heavy/blank) frame at opacity 0, then reveal the
      // already-rendered scene next frame so the fade starts from real content
      revealed = true;
      requestAnimationFrame(() => canvas.classList.add("is-on"));
    }
    rafId = requestAnimationFrame(loop);
  }
  loop();

  return function destroy() {
    running = false;
    cancelAnimationFrame(rafId);
    io.disconnect();
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointermove", onDrag);
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("resize", resize);
    pop.remove();
    renderer.dispose();
  };
}
