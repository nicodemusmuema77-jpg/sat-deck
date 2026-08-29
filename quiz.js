// Active-recall quiz over the strategy deck, with a Leitner-box review schedule.
(() => {
  "use strict";

  const SRS_KEY = "sat-deck-srs";
  const SESSION_SIZE = 20;
  const INTERVALS = [0, 1, 3, 7, 16, 35]; // days until next review, indexed by box

  const $ = (id) => document.getElementById(id);
  const progressEl = $("progress"), cardEl = $("card"), metaEl = $("meta");
  const promptEl = $("prompt"), answerEl = $("answer");
  const revealRow = $("revealRow"), revealEl = $("reveal");
  const gradeRow = $("gradeRow"), doneEl = $("done"), doneText = $("doneText"), againEl = $("again");

  let DATA = [];
  let srs = load();
  let deck = [];
  let idx = 0;
  let tally = { again: 0, hard: 0, good: 0, easy: 0 };

  fetch("data/strategies.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((d) => { DATA = d; startSession(); })
    .catch((e) => { progressEl.textContent = "Could not load strategies (" + e.message + ")."; });

  function load() {
    try { return JSON.parse(localStorage.getItem(SRS_KEY) || "{}") || {}; }
    catch (_) { return {}; }
  }
  function save() {
    try { localStorage.setItem(SRS_KEY, JSON.stringify(srs)); } catch (_) { /* ignore */ }
  }
  const iso = (d) => d.toISOString().slice(0, 10);
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startSession() {
    const today = iso(new Date());
    const due = DATA.filter((s) => srs[s.id] && srs[s.id].due <= today);
    const fresh = DATA.filter((s) => !srs[s.id]);
    deck = shuffle(due).concat(shuffle(fresh)).slice(0, SESSION_SIZE);
    if (deck.length < SESSION_SIZE) {
      // Everything is scheduled ahead and nothing is new — just review a random slice.
      const seen = new Set(deck.map((s) => s.id));
      deck = deck.concat(shuffle(DATA).filter((s) => !seen.has(s.id))).slice(0, SESSION_SIZE);
    }
    idx = 0;
    tally = { again: 0, hard: 0, good: 0, easy: 0 };
    doneEl.hidden = true;
    cardEl.hidden = false;
    show();
  }

  function show() {
    const s = deck[idx];
    progressEl.textContent = `Card ${idx + 1} of ${deck.length}`;
    metaEl.textContent = s.section + (s.tags && s.tags.length ? " · " + s.tags.slice(0, 3).join(", ") : "");
    promptEl.textContent = s.why
      ? s.why
      : "Recall the " + s.section + " strategy for: " + (s.tags || []).slice(0, 3).join(", ");
    answerEl.hidden = true;
    answerEl.innerHTML = "";
    revealRow.hidden = false;
    gradeRow.hidden = true;
  }

  function reveal() {
    const s = deck[idx];
    answerEl.textContent = "";
    const b = document.createElement("b");
    b.textContent = s.rule;
    answerEl.appendChild(b);
    const href = safeUrl(s.source_url);
    if (href) {
      answerEl.appendChild(document.createTextNode(" "));
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = (s.source_channel || "source") + " →";
      answerEl.appendChild(a);
    }
    answerEl.hidden = false;
    revealRow.hidden = true;
    gradeRow.hidden = false;
  }

  // Only http(s) URLs from the data file get turned into clickable links.
  function safeUrl(u) {
    try {
      const p = new URL(u, location.href);
      return (p.protocol === "https:" || p.protocol === "http:") ? p.href : "";
    } catch (_) { return ""; }
  }

  function grade(g) {
    const s = deck[idx];
    const cur = srs[s.id] || { box: 0 };
    let box = cur.box | 0;
    if (g === "again") box = 0;
    else if (g === "hard") box = Math.max(0, box);
    else if (g === "good") box = Math.min(INTERVALS.length - 1, box + 1);
    else box = Math.min(INTERVALS.length - 1, box + 2);
    srs[s.id] = { box, due: addDays(INTERVALS[box]) };
    save();
    tally[g]++;
    idx++;
    if (idx >= deck.length) finish();
    else show();
  }

  function finish() {
    cardEl.hidden = true;
    doneEl.hidden = false;
    const today = iso(new Date());
    const dueNow = DATA.filter((s) => srs[s.id] && srs[s.id].due <= today).length;
    doneText.textContent =
      `Done — ${deck.length} cards. ` +
      `Again ${tally.again}, Hard ${tally.hard}, Good ${tally.good}, Easy ${tally.easy}. ` +
      `${dueNow} card${dueNow === 1 ? "" : "s"} still due.`;
  }

  revealEl.addEventListener("click", reveal);
  gradeRow.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-g]");
    if (b) grade(b.dataset.g);
  });
  againEl.addEventListener("click", startSession);
})();
