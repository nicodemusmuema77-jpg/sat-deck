// Digital SAT raw-to-scaled ESTIMATE.
// The College Board publishes no single conversion table; these anchor points are a
// rough consensus from released Bluebook practice-test curves. Interpolated linearly
// and rounded to the nearest 10. Not a prediction — see the disclaimer on the page.
(() => {
  "use strict";

  const RW_MAX = 54;
  const MATH_MAX = 44;

  const RW_ANCHORS = [
    [0, 200], [5, 290], [10, 350], [15, 410], [20, 460], [24, 500], [27, 530],
    [30, 560], [33, 590], [36, 620], [39, 650], [42, 680], [45, 710], [48, 740],
    [51, 770], [53, 790], [54, 800],
  ];
  const MATH_ANCHORS = [
    [0, 200], [3, 250], [6, 310], [9, 360], [12, 410], [15, 460], [18, 500],
    [21, 540], [24, 580], [27, 620], [30, 660], [33, 700], [36, 730], [39, 760],
    [41, 780], [43, 790], [44, 800],
  ];

  function interp(anchors, raw) {
    const max = anchors[anchors.length - 1][0];
    raw = Math.max(0, Math.min(max, raw));
    for (let i = 0; i < anchors.length - 1; i++) {
      const [x0, y0] = anchors[i];
      const [x1, y1] = anchors[i + 1];
      if (raw >= x0 && raw <= x1) {
        const t = x1 === x0 ? 0 : (raw - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return anchors[anchors.length - 1][1];
  }

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round10 = (n) => Math.round(n / 10) * 10;
  const scaled = (anchors, raw) => clamp(round10(interp(anchors, raw)), 200, 800);
  // Points gained per additional correct answer near a given raw score.
  const slope = (anchors, raw) =>
    (interp(anchors, raw + 1) - interp(anchors, raw - 1)) / 2;

  const $ = (id) => document.getElementById(id);
  const rwEl = $("rw"), mathEl = $("math"), targetEl = $("target");
  const out = $("out"), gapRow = $("gapRow"), gapLabel = $("gapLabel"), gapEl = $("gap");

  function num(el, max) {
    if (el.value.trim() === "") return null;
    const n = parseInt(el.value, 10);
    if (Number.isNaN(n)) return null;
    return clamp(n, 0, max);
  }

  function update() {
    const rw = num(rwEl, RW_MAX);
    const math = num(mathEl, MATH_MAX);
    if (rw === null && math === null) { out.hidden = true; return; }
    out.hidden = false;

    const rwScore = rw === null ? 200 : scaled(RW_ANCHORS, rw);
    const mathScore = math === null ? 200 : scaled(MATH_ANCHORS, math);
    const total = rwScore + mathScore;

    $("rwScore").textContent = rw === null ? "—" : rwScore;
    $("mathScore").textContent = math === null ? "—" : mathScore;
    $("total").textContent = total;

    const target = targetEl.value.trim() === "" ? null : clamp(parseInt(targetEl.value, 10) || 0, 400, 1600);
    if (target === null || rw === null || math === null) { gapRow.hidden = true; return; }

    const diff = target - total;
    gapRow.hidden = false;
    if (diff <= 0) {
      gapLabel.textContent = "Versus target";
      gapEl.textContent = diff === 0 ? "on target" : `${-diff} above`;
      return;
    }
    // Split the remaining points across whichever section currently gains the most
    // per additional correct answer.
    const sRw = Math.max(1, slope(RW_ANCHORS, rw));
    const sMath = Math.max(1, slope(MATH_ANCHORS, math));
    const avgSlope = (sRw + sMath) / 2;
    const moreCorrect = Math.ceil(diff / avgSlope);
    gapLabel.textContent = "To reach target";
    gapEl.textContent = `+${diff} — roughly ${moreCorrect} more correct`;
  }

  [rwEl, mathEl, targetEl].forEach((el) => el.addEventListener("input", update));
})();
