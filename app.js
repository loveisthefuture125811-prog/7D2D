"use strict";
/* ===== Core logic (no DOM) ===== */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Loose normalization: case-insensitive, curly quotes -> straight, punctuation ignored, spaces collapsed.
function normalize(s) {
  return String(s).toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function buildIndex(data) {
  const index = [];
  (data.boxes || []).forEach((box) => {
    (box.items || []).forEach((name) => {
      index.push({ name: name, norm: normalize(name), boxId: box.id, boxName: box.name });
    });
  });
  return index;
}

function validateData(data, index) {
  const errors = [], warnings = [];
  if (!data || typeof data !== "object") return { errors: ["STORAGE_DATA missing"], warnings, stats: {} };
  ["game", "version", "source"].forEach((k) => { if (!data[k]) errors.push("Missing field: " + k); });
  if (!Array.isArray(data.boxes) || !data.boxes.length) { errors.push("boxes must be a non-empty array"); return { errors, warnings, stats: {} }; }
  const boxIds = new Set(), seen = new Map();
  let total = 0;
  data.boxes.forEach((b, bi) => {
    const tag = "Box #" + bi + (b && b.name ? " (" + b.name + ")" : "");
    if (!b || typeof b !== "object") { errors.push(tag + ": malformed"); return; }
    if (typeof b.id !== "string" || !b.id.trim()) errors.push(tag + ": missing id");
    else if (boxIds.has(b.id)) errors.push("Duplicate box id: " + b.id); else boxIds.add(b.id);
    if (typeof b.name !== "string" || !b.name.trim()) errors.push(tag + ": missing name");
    if (!Array.isArray(b.items)) { errors.push(tag + ": items is not an array"); return; }
    if (!b.items.length) errors.push(tag + ": box is empty");
    b.items.forEach((it, ii) => {
      if (typeof it !== "string" || !it.trim()) { errors.push(tag + ": invalid item at " + ii); return; }
      if (it !== it.trim()) warnings.push(tag + ": item has surrounding whitespace: '" + it + "'");
      total++;
      if (seen.has(it)) errors.push("Duplicate item '" + it + "' in '" + seen.get(it) + "' and '" + b.name + "'");
      else seen.set(it, b.name);
    });
  });
  if (index.length !== total) errors.push("Index size " + index.length + " != item count " + total);
  const idxKeys = new Set();
  index.forEach((e) => {
    if (!boxIds.has(e.boxId)) errors.push("Orphaned index entry: " + e.name);
    const k = e.boxId + "|" + e.name;
    if (idxKeys.has(k)) errors.push("Duplicate searchable entry: " + e.name); idxKeys.add(k);
  });
  const v = data.validation;
  if (v) {
    if (v.includedInventoryItems !== total) errors.push("validation.includedInventoryItems " + v.includedInventoryItems + " != actual " + total);
    const sum = total + v.excludedEntries + v.exactDuplicateSourceEntries;
    if (sum !== v.sourceEntriesReviewed) errors.push("Source accounting mismatch: " + sum + " != " + v.sourceEntriesReviewed);
    if (data.source && v.sourceEntriesReviewed !== data.source.sourceItemCount) errors.push("sourceItemCount mismatch");
    const ex = (data.excluded || []).reduce((n, g) => n + g.names.length, 0);
    if (ex !== v.excludedEntries) errors.push("Excluded list has " + ex + " names, expected " + v.excludedEntries);
    if ((data.exactDuplicateSourceNames || []).length !== v.exactDuplicateSourceEntries) errors.push("Duplicate-name list length mismatch");
  } else warnings.push("No validation block in data");
  return { errors, warnings, stats: { boxes: data.boxes.length, items: total } };
}

// Ranking: 0 exact, 1 starts-with, 2 substring, 3 all words present; then alphabetical.
function searchIndex(index, query) {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(" ");
  const out = [];
  for (const e of index) {
    let r = -1;
    if (e.norm === q) r = 0;
    else if (e.norm.startsWith(q)) r = 1;
    else if (e.norm.includes(q)) r = 2;
    else if (words.length > 1 && words.every((w) => e.norm.includes(w))) r = 3;
    if (r >= 0) out.push({ e: e, r: r });
  }
  out.sort((a, b) => a.r - b.r || a.e.name.localeCompare(b.e.name, "en", { sensitivity: "base", numeric: true }));
  return out.map((x) => x.e);
}

function filterItems(items, query) {
  const q = normalize(query);
  if (!q) return items.slice();
  const words = q.split(" ");
  return items.filter((n) => { const x = normalize(n); return x.includes(q) || words.every((w) => x.includes(w)); });
}

if (typeof module !== "undefined") module.exports = { escapeHtml, normalize, buildIndex, validateData, searchIndex, filterItems };

/* ===== UI ===== */
if (typeof document !== "undefined") (function () {
  const $ = (id) => document.getElementById(id);
  const MAX_RESULTS = 150;
  let INDEX = [], BOXES = new Map(), homeScroll = 0;

  try {
    INDEX = buildIndex(STORAGE_DATA);
    const report = validateData(STORAGE_DATA, INDEX);
    console.log("[7DTD Storage] validation:", report.errors.length ? "FAILED" : "OK", report.stats);
    report.warnings.forEach((w) => console.warn("[7DTD Storage]", w));
    if (report.errors.length) {
      report.errors.forEach((e) => console.error("[7DTD Storage]", e));
      const w = $("warn"); w.hidden = false; w.textContent = "Data validation found " + report.errors.length + " problem(s). See console.";
    }
  } catch (err) {
    console.error("[7DTD Storage] data load failed", err);
    const w = $("warn"); w.hidden = false; w.textContent = "Could not load storage data.";
  }
  (STORAGE_DATA.boxes || []).forEach((b) => BOXES.set(b.id, b));

  function renderGrid() {
    $("grid").innerHTML = STORAGE_DATA.boxes.map((b) =>
      '<button class="card" type="button" data-box="' + escapeHtml(b.id) + '"><span class="n">' + escapeHtml(b.name) +
      '</span><span class="c">' + b.items.length + (b.items.length === 1 ? " item" : " items") + "</span></button>").join("");
    const total = INDEX.length;
    $("foot").textContent = STORAGE_DATA.boxes.length + " boxes \u00b7 " + total + " items \u00b7 7 Days to Die " + STORAGE_DATA.version;
  }

  function renderResults() {
    const q = $("global-search").value, box = $("results");
    if (!normalize(q)) { box.hidden = true; box.innerHTML = ""; $("grid").hidden = false; return; }
    const res = searchIndex(INDEX, q);
    $("grid").hidden = true; box.hidden = false;
    if (!res.length) { box.innerHTML = '<p class="msg">No items match \u201c' + escapeHtml(q.trim()) + "\u201d.</p>"; return; }
    const shown = res.slice(0, MAX_RESULTS);
    box.innerHTML = '<p class="msg">' + res.length + (res.length === 1 ? " result" : " results") +
      (res.length > shown.length ? " (showing first " + shown.length + " - type more to narrow)" : "") + "</p>" +
      shown.map((e) => '<button class="result" type="button" data-box="' + escapeHtml(e.boxId) + '" data-item="' + escapeHtml(e.name) +
        '"><span class="i">' + escapeHtml(e.name) + '</span><span class="b">' + escapeHtml(e.boxName) + "</span></button>").join("");
  }

  function renderBox(box, hl) {
    $("box-title").textContent = box.name;
    $("box-count").textContent = box.items.length + (box.items.length === 1 ? " item" : " items");
    renderItems(box, $("box-search").value, hl);
  }
  function renderItems(box, q, hl) {
    const list = filterItems(box.items, q);
    $("items").innerHTML = list.map((n) => '<li' + (n === hl ? ' class="hl" id="hl"' : "") + ">" + escapeHtml(n) + "</li>").join("");
    $("box-empty").hidden = list.length > 0;
    if (hl) { const el = $("hl"); if (el) el.scrollIntoView({ block: "center" }); }
  }

  function showHome() {
    $("box").hidden = true; $("home").hidden = false;
    window.scrollTo(0, homeScroll);
  }
  function showBox(id, hl) {
    const box = BOXES.get(id);
    if (!box) { showHome(); return; }
    if ($("home").hidden === false) homeScroll = window.scrollY;
    $("box-search").value = "";
    $("home").hidden = true; $("box").hidden = false;
    window.scrollTo(0, 0);
    renderBox(box, hl);
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "box" && h[1]) {
      let item = null; try { item = h[2] ? decodeURIComponent(h[2]) : null; } catch (e) {}
      showBox(decodeURIComponent(h[1]), item);
    } else showHome();
  }
  function go(hash) { history.pushState({ inApp: true }, "", hash); route(); }

  $("grid").addEventListener("click", (e) => { const b = e.target.closest("[data-box]"); if (b) go("#/box/" + encodeURIComponent(b.dataset.box)); });
  $("results").addEventListener("click", (e) => {
    const b = e.target.closest("[data-box]");
    if (b) go("#/box/" + encodeURIComponent(b.dataset.box) + "/" + encodeURIComponent(b.dataset.item));
  });
  $("btn-home").addEventListener("click", () => { if (location.hash && location.hash !== "#/") go("#/"); });
  $("btn-back").addEventListener("click", () => {
    if (history.state && history.state.inApp) history.back();
    else { history.replaceState(null, "", "#/"); route(); }
  });
  $("global-search").addEventListener("input", renderResults);
  $("box-search").addEventListener("input", () => {
    const h = location.hash.replace(/^#\/?/, "").split("/"), box = BOXES.get(decodeURIComponent(h[1] || ""));
    if (box) renderItems(box, $("box-search").value, null);
  });
  window.addEventListener("popstate", route);

  renderGrid();
  route();

  // Offline shell caching. The app works fine if this fails.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      try { navigator.serviceWorker.register("sw.js").catch((err) => console.warn("[7DTD Storage] SW registration failed:", err)); }
      catch (err) { console.warn("[7DTD Storage] SW registration error:", err); }
    });
  }
})();
