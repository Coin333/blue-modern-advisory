# Hero OffscreenCanvas Worker — Design Spec

**Date:** 2026-06-29
**Status:** Architecture approved; pending spec review
**Owner:** BMA static site (`site/`)

## Goal

Render the homepage hero three.js scene in a Web Worker via `OffscreenCanvas` so
it never competes with main-thread scrolling (Lenis). Visuals and interactions
must stay **identical**. A main-thread fallback guarantees the hero still works
where `OffscreenCanvas`-WebGL is unsupported or if the worker fails to boot.

## Non-goals

- No visual change: geometry, motion, camera, colors, sprites, interactions all unchanged.
- No change to other pages or to the scroll system. Lenis stays.
- No new build step. Plain ES modules, same as today.

## Current state

`site/js/hero-network.js` (~1190 lines), dynamically imported by `index.html`,
exports `initHeroNetwork(canvas)`. It currently:

- Builds a tower lattice (points + links), six hub sprites with SVG icons + text
  labels (drawn onto `document.createElement('canvas')` → `THREE.CanvasTexture`),
  and a blurred 360° panorama background (`THREE.TextureLoader` → `assets/city360.jpg`).
- Runs a per-frame `step()` (camera state machine, sway, links, packets, focus)
  ending in `renderer.render()`, driven by `requestAnimationFrame`, gated by an
  `IntersectionObserver`. DPR drops while scrolling (recent change).
- Handles pointer interactions: drag-rotate, click hubs → DOM popup + guided-tour
  card positioned from a 3D→2D projection, hover.

## Target architecture — 3 modules, dual render path

### 1. `hero-scene.js` — environment-agnostic scene core

`createHeroScene(opts) -> controller`

- `opts = { canvas, width, height, dpr, assets, emit }`
  - `canvas`: an `OffscreenCanvas` (worker) **or** a real `<canvas>` (fallback).
  - `assets = { panorama: ImageBitmap, icons: ImageBitmap[] }` — all image decoding
    happens **outside** this module.
  - `emit(type, payload)`: send data out. In the worker this wraps `postMessage`;
    on the main thread it is a direct callback.
- `controller = { frame(now), resize(w,h,dpr), setDpr(dpr), input(evt), setRunning(bool), destroy() }`
- Holds everything currently in `initHeroNetwork` **except** DOM access, image
  loading, event listeners, and the rAF/IO scheduling (those move to the host).
- Sprite icon/label canvases use `OffscreenCanvas` + `drawImage(bitmap)` (works in
  both contexts) instead of `document.createElement('canvas')`.
- When a popup is active, computes the node's projected screen coords each frame
  and calls `emit('popup', {x,y,...})`.

### 2. `hero-worker.js` — worker host (module worker)

- On `{type:'init', canvas, width, height, dpr, assets}` → `createHeroScene(...)`, start loop.
- **Loop:** workers have **no `requestAnimationFrame`**. Drive with a self-scheduled
  `setTimeout(~16ms)` loop, fully decoupled from the main thread (the whole point).
  Caveat: not vsync-aligned; if jitter appears in testing, fall back to main-thread
  rAF-tick forwarding (one cheap `postMessage` per frame, no render work on main).
- Routes inbound `pointer` / `resize` / `dpr` / `running` to controller methods;
  posts outbound `ready` / `popup` / `hub-activate` / `error`.

### 3. `hero-network.js` — orchestrator (public `initHeroNetwork(canvas)` unchanged)

- **Support check:** `Worker` exists, `'transferControlToOffscreen' in canvas`, and a
  worker-WebGL probe. If false → main-thread fallback.
- **Asset preload (main thread):** `fetch()` each SVG icon + `city360.jpg` → `createImageBitmap()`.
- `const off = canvas.transferControlToOffscreen()`.
- Spawn `new Worker('./js/hero-worker.js', {type:'module'})`; post `init` with `off`
  - bitmaps as transferables.
- **Bridge:** forward `pointermove/down/up`, `wheel/scroll/touchmove` (→ DPR), `resize`,
  and the IntersectionObserver running flag as messages. Receive `popup` → position the
  DOM popup / tour-card elements; receive `hub-activate` → navigate.
- **Fallback:** if the support check fails, or `worker.onerror` fires before the first
  frame, run `createHeroScene` on the **main thread** with the real canvas, driven by the
  existing rAF + IO (today's behavior). The hero is never blank.

## Message protocol

- main → worker: `init`, `pointer{type,x,y,buttons}`, `dpr{value}`, `resize{w,h}`, `running{bool}`
- worker → main: `ready`, `popup{visible,x,y,w,h,hub}`, `hub-activate{href}`, `error{message}`

## Risks & mitigations

| Risk                                                           | Mitigation                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Workers lack `requestAnimationFrame`                           | self-scheduled `setTimeout` loop; rAF-tick forwarding as backup                                         |
| Sprite/label raster differs (OffscreenCanvas vs HTMLCanvas 2D) | Phase 0 runs OffscreenCanvas sprites on the main thread, so any diff is caught before the worker exists |
| Popup follow latency (cross-thread per frame)                  | only while a popup is open = at rest, never during scroll; existing popX/popY easing smooths it         |
| Browser support (Safari < 16.4, FF < 105)                      | fallback path renders identically                                                                       |
| Untestable in this environment                                 | local verify by the user (chosen) before any push to `main`                                             |

## Phasing

- **Phase 0 (low risk):** extract `hero-scene.js` (env-agnostic, OffscreenCanvas sprites),
  still running on the **main thread** via `hero-network.js`. Goal: hero behaves identically.
  User verifies locally. Revert is trivial.
- **Phase 1:** add `hero-worker.js` + orchestrator bridge + fallback. User verifies locally
  (smooth scroll + identical interactions) before push to `main`.

## Acceptance criteria

- Hero visually identical: panorama, lattice, links, sprites, labels, camera motion.
- All interactions work: drag-rotate, hub click → popup + navigate, hover, guided tour.
- Scrolling near the top is smooth (no main-thread render contention) in Chromium.
- Fallback renders identically on a browser without OffscreenCanvas support / on worker error.
- No console errors.

## Test plan (local)

`cd site && python3 -m http.server 8123`, open in Chrome:

1. Hero renders identically; let the camera orbit, open a hub popup, drag-rotate, hover.
2. Scroll up/down near the top — confirm smooth.
3. DevTools → Rendering → Frame Rendering Stats (or Performance trace) → scroll frames hold ~60fps.
4. Force the fallback (temporary flag) → confirm identical main-thread render.

Built with D1 Vibe Coding
