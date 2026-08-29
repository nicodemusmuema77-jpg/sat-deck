// Shared theme handling for the secondary pages (the deck page does its own in app.js).
(() => {
  "use strict";
  const KEY = "sat-deck-theme";
  const apply = (t) => document.documentElement.setAttribute("data-theme", t);
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (_) { return null; } })();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  apply(saved || (prefersDark ? "dark" : "light"));

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      const next = cur === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (_) { /* ignore */ }
    });
  });
})();
