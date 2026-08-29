// SAT Strategy Deck — pure-JS app, no dependencies, no build step.
(() => {
  "use strict";

  const STORAGE_KEY = "sat-deck-v1";
  const THEME_KEY = "sat-deck-theme";
  const SOTD_KEY = "sat-deck-sotd";

  // ----- State -----
  const state = {
    all: [],          // all strategies
    visible: [],      // filtered strategies
    sections: new Set(),
    channels: new Set(),
    activeSections: new Set(),  // empty = all
    activeChannels: new Set(),
    query: "",
    sort: "default",
    practiced: new Set(),  // set of strategy IDs
    sotd: null,            // strategy-of-the-day
  };

  function strategyId(s) {
    // Stable id: channel + first 60 chars of rule + video id
    return `${s.source_channel}::${s.source_video_id}::${s.rule.toLowerCase()}`;
  }

  // ----- Boot -----
  document.addEventListener("DOMContentLoaded", boot);

  async function boot() {
    loadTheme();
    loadProgress();
    bindUI();
    try {
      const res = await fetch("data/strategies.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.all = await res.json();
    } catch (e) {
      document.getElementById("cards").innerHTML =
        `<div class="empty">Failed to load strategies.json: ${e.message}</div>`;
      return;
    }
    indexFacets();
    document.getElementById("strategyCount").textContent =
      `${state.all.length} strategies from ${state.channels.size} channels`;
    pickStrategyOfTheDay();
    renderChips();
    applyFilters();
  }

  function indexFacets() {
    state.all.forEach(s => {
      state.sections.add(s.section);
      state.channels.add(s.source_channel);
    });
  }

  // ----- UI binding -----
  function bindUI() {
    document.getElementById("search").addEventListener("input", (e) => {
      state.query = e.target.value.trim().toLowerCase();
      applyFilters();
    });
    document.getElementById("sort").addEventListener("change", (e) => {
      state.sort = e.target.value;
      applyFilters();
    });
    document.getElementById("theme").addEventListener("click", toggleTheme);
    document.getElementById("export").addEventListener("click", exportProgress);
    document.getElementById("import").addEventListener("click", () => {
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", importProgress);
    document.getElementById("reset").addEventListener("click", () => {
      if (confirm("Reset all progress?")) {
        state.practiced.clear();
        saveProgress();
        applyFilters();
      }
    });
  }

  // ----- Theme -----
  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ----- Progress -----
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.practiced = new Set(arr);
      }
    } catch (_) { /* ignore */ }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.practiced]));
  }
  function exportProgress() {
    const data = {
      version: 1,
      generated: new Date().toISOString(),
      practiced: [...state.practiced],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat-deck-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importProgress(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.practiced)) {
          state.practiced = new Set(data.practiced.map(String));
          saveProgress();
          applyFilters();
        } else {
          alert("Invalid file: missing 'practiced' array");
        }
      } catch (err) {
        alert("Invalid JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // allow re-importing same file
  }

  // ----- Strategy of the day -----
  function pickStrategyOfTheDay() {
    if (!state.all.length) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const cached = JSON.parse(localStorage.getItem(SOTD_KEY) || "null");
      if (cached && cached.date === today && cached.id) {
        const found = state.all.find(s => strategyId(s) === cached.id);
        if (found) { state.sotd = found; renderSOTD(); return; }
      }
    } catch (_) { /* ignore */ }
    // Seeded random from date so it's stable across the day
    const seed = hashString(today);
    const idx = seed % state.all.length;
    state.sotd = state.all[idx];
    localStorage.setItem(SOTD_KEY, JSON.stringify({
      date: today,
      id: strategyId(state.sotd),
    }));
    renderSOTD();
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }
  function renderSOTD() {
    if (!state.sotd) return;
    const s = state.sotd;
    document.getElementById("sotd").hidden = false;
    document.getElementById("sotd-rule").textContent = s.rule;
    document.getElementById("sotd-why").textContent = s.why || "";
    const link = document.getElementById("sotd-link");
    link.href = s.source_url;
    link.textContent = `${s.source_channel} — ${s.source_title}` + (s.source_timestamp_sec ? ` (at ${formatTime(s.source_timestamp_sec)})` : "");
  }

  // ----- Filters -----
  function renderChips() {
    const secChips = document.getElementById("sectionChips");
    secChips.innerHTML = "";
    [...state.sections].sort().forEach(sec => {
      secChips.appendChild(makeChip(sec, state.activeSections, "section"));
    });
    const chChips = document.getElementById("channelChips");
    chChips.innerHTML = "";
    [...state.channels].sort().forEach(ch => {
      chChips.appendChild(makeChip(ch, state.activeChannels, "channel"));
    });
  }
  function makeChip(label, activeSet, kind) {
    const el = document.createElement("span");
    el.className = "chip" + (activeSet.has(label) ? " active" : "");
    el.textContent = label;
    el.addEventListener("click", () => {
      if (activeSet.has(label)) activeSet.delete(label);
      else activeSet.add(label);
      el.classList.toggle("active");
      applyFilters();
    });
    return el;
  }

  function applyFilters() {
    const q = state.query;
    state.visible = state.all.filter(s => {
      if (state.activeSections.size && !state.activeSections.has(s.section)) return false;
      if (state.activeChannels.size && !state.activeChannels.has(s.source_channel)) return false;
      if (q) {
        const hay = [s.rule, s.why, s.source_channel, s.source_title, ...(s.tags || [])]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    sortVisible();
    renderCards();
    renderProgress();
  }
  function sortVisible() {
    if (state.sort === "section") {
      state.visible.sort((a, b) => a.section.localeCompare(b.section) || a.rule.localeCompare(b.rule));
    } else if (state.sort === "channel") {
      state.visible.sort((a, b) => a.source_channel.localeCompare(b.source_channel) || a.rule.localeCompare(b.rule));
    } else if (state.sort === "practiced") {
      state.visible.sort((a, b) => {
        const ap = state.practiced.has(strategyId(a)) ? 1 : 0;
        const bp = state.practiced.has(strategyId(b)) ? 1 : 0;
        return ap - bp;
      });
    }
  }

  // ----- Ads (AdSense in-feed) -----
  // Create the in-feed unit in AdSense, then paste its two values here.
  const AD_CLIENT     = "ca-pub-5866794555885279";
  const AD_SLOT       = "REPLACE_ME";   // in-feed unit id
  const AD_LAYOUT_KEY = "REPLACE_ME";   // data-ad-layout-key from the same unit
  const AD_AFTER = 8;   // no ad before this many cards (keeps the first screen clean)
  const AD_EVERY = 12;  // then at most one ad every N cards
  const AD_MAX   = 4;   // hard cap of ad slots per render — nothing after ~card 45
  const AD_READY = AD_SLOT !== "REPLACE_ME" && AD_LAYOUT_KEY !== "REPLACE_ME";

  let adObserver = null;
  let adsFilled = 0;

  function resetAds() {
    if (adObserver) adObserver.disconnect();
    adObserver = null;
    adsFilled = 0;
  }

  // Ads are noise while the reader is hunting for a specific card, and every
  // keystroke re-renders the list and throws the slots away. Only show them on
  // the full, unfiltered deck.
  function adsAllowed() {
    return AD_READY
      && !state.query
      && state.activeSections.size === 0
      && state.activeChannels.size === 0;
  }

  function makeAdSlot() {
    const wrap = document.createElement("div");
    wrap.className = "ad-slot";
    const label = document.createElement("span");
    label.className = "ad-label";
    label.textContent = "Advertisement";
    const target = document.createElement("div");
    target.className = "ad-target";
    wrap.appendChild(label);
    wrap.appendChild(target);
    return wrap;
  }

  function fillAdSlot(slot) {
    const target = slot.querySelector(".ad-target");
    if (!target || target.firstChild) return;
    // The <ins> is created here, not at render time: adsbygoogle.push() binds to
    // the first empty <ins> in DOM order, so pre-rendering every slot's <ins>
    // would fill the top of the list instead of the slot scrolled into view.
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.dataset.adClient = AD_CLIENT;
    ins.dataset.adSlot = AD_SLOT;
    ins.dataset.adFormat = "fluid";
    ins.dataset.adLayoutKey = AD_LAYOUT_KEY;
    target.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adsFilled++;
    } catch (_) {
      slot.remove(); // blocker or script never loaded — drop the gap
    }
  }

  function onAdVisible(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      adObserver.unobserve(entry.target);
      fillAdSlot(entry.target);
    }
  }

  // ----- Render -----
  function renderCards() {
    const root = document.getElementById("cards");
    const empty = document.getElementById("empty");
    resetAds();
    if (!state.visible.length) {
      root.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const showAds = adsAllowed();
    let placed = 0;
    // Use a DocumentFragment for batch insertion
    const frag = document.createDocumentFragment();
    state.visible.forEach((s, i) => {
      frag.appendChild(makeCard(s));
      if (showAds && placed < AD_MAX && i >= AD_AFTER && (i - AD_AFTER) % AD_EVERY === 0) {
        frag.appendChild(makeAdSlot());
        placed++;
      }
    });
    root.innerHTML = "";
    root.appendChild(frag);
    if (placed) {
      adObserver = new IntersectionObserver(onAdVisible, { rootMargin: "600px 0px" });
      root.querySelectorAll(".ad-slot").forEach((el) => adObserver.observe(el));
    }
  }
  function makeCard(s) {
    const id = strategyId(s);
    const card = document.createElement("article");
    card.className = "card";
    if (state.practiced.has(id)) card.classList.add("practiced");

    const header = document.createElement("div");
    header.className = "card-header";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "card-checkbox";
    cb.checked = state.practiced.has(id);
    cb.setAttribute("aria-label", "Mark as practiced");
    cb.addEventListener("change", () => {
      if (cb.checked) state.practiced.add(id);
      else state.practiced.delete(id);
      saveProgress();
      card.classList.toggle("practiced", cb.checked);
      renderProgress();
    });
    header.appendChild(cb);

    const body = document.createElement("div");
    body.className = "card-body";

    const sec = document.createElement("div");
    sec.className = "card-section";
    sec.textContent = s.section;
    body.appendChild(sec);

    const rule = document.createElement("h3");
    rule.className = "card-rule";
    rule.textContent = s.rule;
    body.appendChild(rule);

    if (s.why) {
      const why = document.createElement("p");
      why.className = "card-why";
      why.textContent = s.why;
      body.appendChild(why);
    }

    if (s.tags && s.tags.length) {
      const tags = document.createElement("div");
      tags.className = "card-tags";
      s.tags.slice(0, 5).forEach(t => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = t;
        tags.appendChild(tag);
      });
      body.appendChild(tags);
    }

    header.appendChild(body);
    card.appendChild(header);

    const source = document.createElement("div");
    source.className = "card-source";
    const ch = document.createElement("span");
    ch.className = "channel";
    ch.textContent = s.source_channel;
    source.appendChild(ch);
    const link = document.createElement("a");
    link.href = s.source_url;
    link.target = "_blank";
    link.rel = "noopener";
    const ts = s.source_timestamp_sec ? ` @ ${formatTime(s.source_timestamp_sec)}` : "";
    link.textContent = `Source${ts} →`;
    link.title = s.source_title;
    source.appendChild(link);
    card.appendChild(source);

    return card;
  }

  function renderProgress() {
    const total = state.all.length;
    const done = [...state.practiced].filter(id =>
      state.all.some(s => strategyId(s) === id)
    ).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressText").textContent =
      `${done} / ${total} practiced (${pct}%) — showing ${state.visible.length}`;
  }

  function formatTime(sec) {
    sec = Math.max(0, parseInt(sec, 10) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
})();
