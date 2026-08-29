// Week-by-week SAT study plan built from the strategy deck.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const dateEl = $("date"), targetEl = $("target"), hoursEl = $("hours");
  const makeEl = $("make"), printEl = $("print"), errEl = $("err"), planEl = $("plan");
  const PREFS_KEY = "sat-deck-plan";

  let DATA = [];
  let bySection = {};

  fetch("data/strategies.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((d) => {
      DATA = d;
      bySection = groupBy(d, (s) => s.section);
      restore();
    })
    .catch((e) => showErr("Could not load strategies (" + e.message + "). Try reloading."));

  // ---- helpers ----
  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => { const k = keyFn(x); (out[k] = out[k] || []).push(x); });
    return out;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sample(arr, n, rnd) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  }
  const iso = (d) => d.toISOString().slice(0, 10);
  function showErr(msg) { errEl.textContent = msg; errEl.hidden = false; }
  function clearErr() { errEl.hidden = true; }

  // ---- plan model ----
  function build() {
    clearErr();
    if (!DATA.length) { showErr("Strategies still loading — one moment."); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const test = dateEl.value ? new Date(dateEl.value + "T00:00:00") : null;
    if (!test || isNaN(test)) { showErr("Pick a test date."); return; }
    const days = Math.round((test - today) / 86400000);
    if (days < 3) { showErr("Set a test date at least a few days out."); return; }

    const target = targetEl.value ? Math.max(400, Math.min(1600, parseInt(targetEl.value, 10) || 0)) : null;
    const hours = Math.max(1, Math.min(40, parseInt(hoursEl.value, 10) || 6));
    const weeks = Math.max(1, Math.min(20, Math.ceil(days / 7)));

    localStorage.setItem(PREFS_KEY, JSON.stringify({ date: dateEl.value, target, hours }));

    const rnd = mulberry32(days * 1000 + weeks * 7 + hours);
    const picksPerWeek = hours >= 10 ? 5 : hours >= 6 ? 4 : 3;
    const practicePhaseStart = Math.max(1, Math.ceil(weeks * 0.6));

    // Rotation of content focuses for the learning phase.
    const contentRotation = ["Math", "Reading", "Writing"];
    const plan = [];

    for (let w = 1; w <= weeks; w++) {
      const isFinal = w === weeks;
      const isPractice = !isFinal && w > practicePhaseStart;
      let focus, pool, task;

      if (isFinal) {
        focus = "Test week";
        pool = (bySection["Test-Day"] || []).concat(bySection["Mindset"] || []);
        task = "One full timed practice test early in the week. Spend the rest reviewing every miss. Light review only in the last 2 days.";
      } else if (isPractice) {
        focus = "Timed practice + review";
        const mix = ["Math", "Reading", "Writing"][(w - 1) % 3];
        pool = (bySection[mix] || []).concat(bySection["Test-Day"] || []);
        task = `${Math.max(1, Math.round(hours / 3))} timed section(s) this week, then log and categorise every wrong answer. Re-drill the weakest ${mix} topic.`;
      } else {
        focus = contentRotation[(w - 1) % contentRotation.length];
        pool = bySection[focus] || [];
        const sets = Math.max(1, Math.round(hours / 4));
        task = `Learn and drill: ${sets} untimed problem set(s) in ${focus}. Make a note card for every strategy below you had not seen.`;
      }

      plan.push({
        week: w,
        focus,
        strategies: sample(pool.length ? pool : DATA, picksPerWeek, rnd),
        task,
      });
    }

    render({ weeks, days, target, hours, plan });
  }

  function render(model) {
    const { weeks, days, target, hours, plan } = model;
    const touchPoints = plan.reduce((n, w) => n + w.strategies.length, 0);

    const head = document.createElement("div");
    head.className = "plan-week";
    const hFocus = document.createElement("div");
    hFocus.className = "focus";
    hFocus.textContent = "Overview";
    const hTitle = document.createElement("h3");
    hTitle.textContent = `${weeks} week${weeks > 1 ? "s" : ""} until test day (${days} days)`;
    const hTask = document.createElement("div");
    hTask.className = "task";
    hTask.textContent = `${hours} h/week` + (target ? ` · target ${target}` : "") +
      ` · ${touchPoints} strategy touch-points`;
    head.append(hFocus, hTitle, hTask);

    planEl.textContent = "";
    planEl.appendChild(head);

    plan.forEach((wk) => {
      const el = document.createElement("div");
      el.className = "plan-week";

      const focusEl = document.createElement("div");
      focusEl.className = "focus";
      focusEl.textContent = `Week ${wk.week} · ${wk.focus}`;
      el.appendChild(focusEl);

      const ul = document.createElement("ul");
      wk.strategies.forEach((s) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = s.rule.length > 130 ? s.rule.slice(0, 127) + "…" : s.rule;
        li.appendChild(span);
        const href = safeUrl(s.source_url);
        if (href) {
          li.appendChild(document.createTextNode(" "));
          const a = document.createElement("a");
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = "source →";
          li.appendChild(a);
        }
        ul.appendChild(li);
      });
      el.appendChild(ul);

      const taskEl = document.createElement("div");
      taskEl.className = "task";
      taskEl.textContent = wk.task;
      el.appendChild(taskEl);

      planEl.appendChild(el);
    });

    printEl.hidden = false;
    planEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Only http(s) URLs from the data file get turned into clickable links.
  function safeUrl(u) {
    try {
      const p = new URL(u, location.href);
      return (p.protocol === "https:" || p.protocol === "http:") ? p.href : "";
    } catch (_) { return ""; }
  }

  function restore() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (p) {
        if (p.date) dateEl.value = p.date;
        if (p.target) targetEl.value = p.target;
        if (p.hours) hoursEl.value = p.hours;
      }
    } catch (_) { /* ignore */ }
    // Default the date input to 8 weeks out if empty.
    if (!dateEl.value) {
      const d = new Date(); d.setDate(d.getDate() + 56);
      dateEl.value = iso(d);
    }
    dateEl.min = iso(new Date());
  }

  makeEl.addEventListener("click", build);
  printEl.addEventListener("click", () => window.print());
})();
