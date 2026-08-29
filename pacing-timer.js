// Single-module Digital SAT pacing timer. Wall-clock based so pause/resume stays accurate.
(() => {
  "use strict";

  const MODULES = {
    rw:   { secs: 32 * 60, questions: 27 },
    math: { secs: 35 * 60, questions: 22 },
  };

  const $ = (id) => document.getElementById(id);
  const moduleEl = $("module"), clockEl = $("clock"), barEl = $("bar");
  const startEl = $("start"), pauseEl = $("pause"), resetEl = $("reset");
  const qnumEl = $("qnum"), onpaceEl = $("onpace"), perqEl = $("perq"), statusEl = $("status");

  let mod = MODULES.rw;
  let remaining = mod.secs;   // seconds left
  let endAt = 0;              // timestamp the module hits 0
  let running = false;
  let ticker = null;

  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  function render() {
    clockEl.textContent = fmt(remaining);
    clockEl.classList.toggle("warn", remaining > 60 && remaining <= 300);
    clockEl.classList.toggle("danger", remaining <= 60);

    const elapsed = mod.secs - remaining;
    const perQ = mod.secs / mod.questions;
    perqEl.textContent = Math.round(perQ);
    barEl.style.width = (100 * elapsed / mod.secs).toFixed(1) + "%";

    const onPaceQ = Math.min(mod.questions, Math.max(1, Math.floor(elapsed / perQ) + 1));
    onpaceEl.textContent = "Q " + onPaceQ;

    const you = parseInt(qnumEl.value, 10);
    statusEl.className = "pace-status";
    if (!you || you < 1) { statusEl.textContent = ""; return; }
    if (remaining <= 0) { statusEl.textContent = "Time."; return; }

    const diffQ = you - onPaceQ;
    if (diffQ >= 1) {
      statusEl.classList.add("ahead");
      statusEl.textContent = `Ahead by ~${diffQ} question${diffQ > 1 ? "s" : ""}`;
    } else if (diffQ <= -1) {
      statusEl.classList.add("behind");
      const secsBehind = Math.round(-diffQ * perQ);
      statusEl.textContent = `Behind by ~${-diffQ} question${-diffQ > 1 ? "s" : ""} (${fmt(secsBehind)})`;
    } else {
      statusEl.textContent = "On pace";
    }
  }

  function tick() {
    remaining = (endAt - Date.now()) / 1000;
    if (remaining <= 0) {
      remaining = 0;
      stop();
    }
    render();
  }

  function start() {
    if (running) return;
    if (remaining <= 0) remaining = mod.secs;
    endAt = Date.now() + remaining * 1000;
    running = true;
    ticker = setInterval(tick, 250);
    startEl.disabled = true;
    pauseEl.disabled = false;
    moduleEl.disabled = true;
    render();
  }

  function stop() {
    running = false;
    if (ticker) { clearInterval(ticker); ticker = null; }
    startEl.disabled = false;
    pauseEl.disabled = true;
  }

  function pause() {
    if (!running) return;
    remaining = (endAt - Date.now()) / 1000;
    stop();
    render();
  }

  function reset() {
    stop();
    mod = MODULES[moduleEl.value];
    remaining = mod.secs;
    moduleEl.disabled = false;
    render();
  }

  startEl.addEventListener("click", start);
  pauseEl.addEventListener("click", pause);
  resetEl.addEventListener("click", reset);
  moduleEl.addEventListener("change", reset);
  qnumEl.addEventListener("input", render);

  reset();
})();
