/* Trusted-by marquee: directional 3D bend.
   On first pointer-enter, each logo tips (rotateY) toward the side the cursor
   came in on. The direction is captured ONCE on enter and held - moving around
   inside the logo never flips or re-runs it - so it bends in and stays until the
   pointer leaves, then eases back to flat (handled by the CSS transition). */
(function () {
  const items = document.querySelectorAll(".trusted-marquee-item");
  if (!items.length) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // honour reduced-motion: leave the logos flat

  // Touch / coarse-pointer devices have no hover, and pointerenter fires on tap -
  // which made the logo tip and feel blocky on the moving ticker. Skip the bend
  // there entirely; the logos are plain <a> links, so a tap just opens them.
  const finePointer =
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!finePointer) return;

  const BEND = 22; // degrees, matches the original Stanford turn

  items.forEach(function (el) {
    el.addEventListener("pointerenter", function (e) {
      const r = el.getBoundingClientRect();
      // entered on the left half -> tip one way, right half -> the other
      const fromLeft = e.clientX < r.left + r.width / 2;
      el.style.setProperty("--bend", (fromLeft ? BEND : -BEND) + "deg");
      el.classList.add("is-bent");
    });
    el.addEventListener("pointerleave", function () {
      el.classList.remove("is-bent");
    });
  });
})();
