/* "What We Build" network pipeline.
   A signal pulse travels node -> node along a wire; each segment draws itself as
   the pulse crosses it, and on arrival the node lights and its card reveals.
   Runs once when the section scrolls into view; respects reduced-motion. */
(function () {
  const pipe = document.querySelector("[data-pipe]");
  if (!pipe) return;

  const nodes = [...pipe.querySelectorAll(".pipe-node")];
  const segs = [...pipe.querySelectorAll(".pipe-seg")];
  const cards = [...pipe.querySelectorAll(".pipe-card")];
  const pulse = pipe.querySelector("[data-pulse]");
  if (!nodes.length || !cards.length) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TRAVEL = 850; // ms to draw one segment (matches CSS --travel)
  const DWELL = 280; // brief beat at each node so the line flows across the top

  // reduced motion: skip the animation, just show the finished wired-up state
  if (reduce) {
    nodes.forEach((n) => n.classList.add("is-lit"));
    segs.forEach((s) => s.classList.add("is-on"));
    cards.forEach((c) => c.classList.add("is-on"));
    return;
  }

  // arm the hidden state up front so the reveals animate from empty
  pipe.classList.add("is-armed");

  let played = false;
  function play() {
    if (played) return;
    played = true;
    if (pulse) pulse.classList.add("is-on");
    nodes[0].classList.add("is-lit");
    cards[0].classList.add("is-on");

    let i = 0;
    (function step() {
      if (i >= segs.length) {
        pipe.classList.add("is-done");
        return;
      }
      const seg = segs[i];
      const to = nodes[i + 1];
      const k = i + 1;
      seg.classList.add("is-on"); // draw this segment of wire
      if (pulse && to) {
        pulse.style.left = to.style.left; // glide the pulse to the next node
        pulse.style.top = to.style.top;
      }
      setTimeout(function () {
        nodes[k].classList.add("is-lit"); // arrive: node lights
        cards[k].classList.add("is-on"); // ...and its card says it
        i++;
        setTimeout(step, DWELL);
      }, TRAVEL);
    })();
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            play();
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(pipe);
  } else {
    play();
  }
})();
