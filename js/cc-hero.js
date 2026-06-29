/* Capabilities "signal through the system" hero - intro choreography + the
   pause-to-explore popovers. Progressive enhancement: no-ops without .cc-flow.

   Intro (non-reduced-motion only): the tool icons spawn clustered around the
   BMA logo, connected by lines (a hub); they then spread into the horizontal
   chain while BMA lifts to the top to supervise; the cards/track/labels fade
   in; finally the looping signal animation is released. The loop itself is
   pure CSS but held at frame 0 by the `cc-flow--prep` class (animation paused),
   so the entrance and the loop share one start. Under reduced motion the intro
   is skipped and the hero renders in its final, static state. */
const flow = document.querySelector(".cc-flow");

if (flow) {
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chips = Array.prototype.slice.call(
    flow.querySelectorAll(".cc-station"),
  );
  const bma = flow.querySelector(".cc-bma");
  const pop = flow.querySelector(".cc-pop");
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------------------------- intro ----------------------------------- */
  function center(el, fr) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - fr.left,
      y: r.top + r.height / 2 - fr.top,
    };
  }

  function runIntro() {
    if (reduce || !chips.length || !bma) return; // final static state already shown
    flow.classList.add("cc-flow--prep"); // pause the loop at frame 0 + hide the rest

    const fr = flow.getBoundingClientRect();
    const pipe = flow.querySelector(".cc-pipe") || flow;
    const pr = pipe.getBoundingClientRect();
    const hubX = pr.left + pr.width / 2 - fr.left;
    const hubY = pr.top + pr.height / 2 - fr.top; // the chip line
    const bc = center(bma, fr);
    const R = Math.max(74, Math.min(150, pr.width / 3.2));

    const hub = [];
    chips.forEach((chip, i) => {
      const c = center(chip, fr);
      const ang = ((-90 + i * (360 / chips.length)) * Math.PI) / 180;
      const hx = hubX + R * Math.cos(ang);
      const hy = hubY + R * Math.sin(ang);
      hub.push({ x: hx, y: hy });
      chip.style.transition = "none";
      chip.style.transform =
        "translate(" +
        (hx - c.x).toFixed(1) +
        "px," +
        (hy - c.y).toFixed(1) +
        "px)";
      chip.style.opacity = "0";
    });
    bma.style.transition = "none";
    bma.style.transform =
      "translate(" +
      (hubX - bc.x).toFixed(1) +
      "px," +
      (hubY - bc.y).toFixed(1) +
      "px) scale(1.15)";
    bma.style.opacity = "0";

    // hub connector lines (BMA center -> each clustered icon)
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "cc-entry-lines");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 " + fr.width + " " + fr.height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.opacity = "0";
    svg.style.transition = "opacity 0.4s ease";
    hub.forEach((p) => {
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("x1", hubX.toFixed(1));
      ln.setAttribute("y1", hubY.toFixed(1));
      ln.setAttribute("x2", p.x.toFixed(1));
      ln.setAttribute("y2", p.y.toFixed(1));
      ln.setAttribute("stroke", "rgba(31,78,115,0.3)");
      ln.setAttribute("stroke-width", "1.4");
      ln.setAttribute("stroke-dasharray", "4 5");
      svg.appendChild(ln);
    });
    flow.insertBefore(svg, flow.firstChild);

    // A: spawn clustered around BMA + draw the connecting lines
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        bma.style.transition =
          "opacity 0.45s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1)";
        bma.style.opacity = "1";
        svg.style.opacity = "1";
        chips.forEach((chip, i) => {
          chip.style.transition =
            "opacity 0.4s ease " + (i * 0.05).toFixed(2) + "s";
          chip.style.opacity = "1";
        });
      }),
    );

    // B: spread into the chain + BMA rises to the top + lines retract
    setTimeout(() => {
      chips.forEach((chip, i) => {
        chip.style.transition =
          "transform 0.95s cubic-bezier(0.16,1,0.3,1) " +
          (i * 0.04).toFixed(2) +
          "s";
        chip.style.transform = "";
      });
      bma.style.transform = "";
      svg.style.opacity = "0";
    }, 1000);

    // C: fade the cards, track and labels in from left to right (stagger each
    // element's delay by its horizontal position across the hero)
    setTimeout(() => {
      const w = fr.width || 1;
      flow
        .querySelectorAll(
          ".cc-flow-end, .cc-pipe-line, .cc-st-act, .cc-score, .cc-hint",
        )
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          const t = Math.max(
            0,
            Math.min(1, (r.left + r.width / 2 - fr.left) / w),
          );
          el.style.transition = "opacity 0.55s ease, transform 0.55s ease";
          el.style.transitionDelay = (t * 0.7).toFixed(2) + "s";
          el.style.opacity = "1";
        });
    }, 2000);

    // D: release the loop (unpause) and clean up inline state
    setTimeout(() => {
      chips.forEach((chip) => {
        chip.style.transition = "";
        chip.style.transform = "";
        chip.style.opacity = "";
      });
      bma.style.transition = "";
      bma.style.transform = "";
      if (svg.parentNode) svg.parentNode.removeChild(svg);
      flow.classList.remove("cc-flow--prep"); // loop plays from frame 0
    }, 3350);
  }

  /* ---------------------- pause-to-explore popovers --------------------- */
  let openIdx = -1;

  function placePop(i) {
    const chip = chips[i];
    if (!chip || !pop) return;
    const cr = chip.getBoundingClientRect();
    let left = cr.left + cr.width / 2 - pop.offsetWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pop.offsetWidth - 8));
    pop.style.left = left + "px";
    pop.style.top = cr.bottom + 12 + "px";
  }

  function openPop(i) {
    const chip = chips[i];
    if (!chip || !pop) return;
    openIdx = i;
    flow.classList.add("is-paused");
    const name = chip.getAttribute("data-name") || "";
    pop.querySelector(".cc-pop-name").textContent = name;
    pop.querySelector(".cc-pop-desc").textContent =
      chip.getAttribute("data-desc") || "";
    const link = pop.querySelector(".cc-pop-link");
    link.href = chip.getAttribute("href");
    link.textContent = "Visit " + name + " →";
    chips.forEach((c, j) => c.classList.toggle("is-inspecting", j === i));
    pop.classList.add("is-open");
    placePop(i);
  }

  function resume() {
    if (openIdx === -1) return;
    openIdx = -1;
    flow.classList.remove("is-paused");
    chips.forEach((c) => c.classList.remove("is-inspecting"));
    if (pop) pop.classList.remove("is-open");
  }

  chips.forEach((chip, i) => {
    chip.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // open the real link
      e.preventDefault();
      if (openIdx === i) resume();
      else openPop(i);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (openIdx === -1) return;
    if (e.key === "Escape") {
      resume();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n =
        (openIdx + (e.key === "ArrowRight" ? 1 : -1) + chips.length) %
        chips.length;
      openPop(n);
      chips[n].focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (
      openIdx !== -1 &&
      !e.target.closest(".cc-station") &&
      !e.target.closest(".cc-pop")
    ) {
      resume();
    }
  });
  window.addEventListener("scroll", resume, { passive: true });
  window.addEventListener("resize", () => {
    if (openIdx !== -1) placePop(openIdx);
  });

  runIntro();
}
