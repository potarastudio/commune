/**
 * The screen share picker's page: markup, styles and script in one document,
 * loaded from a data: URL with no preload and no Node.
 *
 * It talks to the main process through document.title: "share:{id,sound}",
 * "cancel", or "settings:<n>" to open System Settings. The main process feeds
 * it with window.render(state), first when it loads and then every few
 * seconds, so thumbnails stay live and newly opened windows appear.
 *
 * Window names are other apps' titles, so they only reach the DOM through
 * textContent. The script avoids backticks and dollar-brace so this file can
 * hold it in a template string untouched.
 */
export const PICKER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Share your screen</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #121212;
    --card: rgba(255,255,255,.035);
    --card-hover: rgba(255,255,255,.065);
    --well: #0a0a0a;
    --line: rgba(255,255,255,.09);
    --line-strong: rgba(255,255,255,.16);
    --text: #fafafa;
    --muted: rgba(255,255,255,.56);
    --faint: rgba(255,255,255,.38);
    --accent: #f05710;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { height: 100%; }
  body {
    margin: 0; display: flex; flex-direction: column; overflow: hidden;
    background: var(--bg); color: var(--text);
    font: 13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none;
  }
  button { font: inherit; color: inherit; }

  header { flex: none; display: flex; align-items: center; gap: 16px; height: 56px; padding: 0 16px 0 20px; border-bottom: 1px solid var(--line); }
  h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -.015em; }
  .search { position: relative; display: flex; align-items: center; width: 240px; }
  .search svg { position: absolute; left: 10px; width: 14px; height: 14px; color: var(--faint); pointer-events: none; }
  .search input {
    width: 100%; height: 32px; padding: 0 10px 0 30px; border-radius: 8px;
    border: 1px solid var(--line-strong); background: rgba(255,255,255,.04); color: var(--text);
    font: inherit; outline: none; user-select: text; -webkit-user-select: text;
  }
  .search input::placeholder { color: var(--faint); }
  .search input::-webkit-search-cancel-button { -webkit-appearance: none; }
  .search input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(240,87,16,.22); }

  main { flex: 1; min-height: 0; overflow: auto; padding: 4px 20px 20px; }
  h2 { display: flex; align-items: baseline; gap: 6px; margin: 16px 2px 10px; font-size: 12px; font-weight: 600; color: var(--muted); }
  h2 .count { font-weight: 500; color: var(--faint); font-variant-numeric: tabular-nums; }
  .grid { display: grid; gap: 12px; }
  .grid.screens { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .grid.windows { grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); }

  .src {
    position: relative; display: flex; flex-direction: column; gap: 9px; min-width: 0;
    padding: 6px 6px 9px; border-radius: 12px; border: 1px solid var(--line); background: var(--card);
    text-align: left; cursor: default; transition: border-color .12s, background-color .12s, box-shadow .12s;
  }
  .src:hover { border-color: var(--line-strong); background: var(--card-hover); }
  .src:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .src[aria-checked="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--card-hover); }
  .thumb { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 10; border-radius: 7px; overflow: hidden; background: var(--well); }
  .thumb .shot { display: block; width: 100%; height: 100%; object-fit: contain; }
  .thumb .stand-in { width: 34px; height: 34px; opacity: .85; }
  .check {
    position: absolute; top: 12px; right: 12px; display: none; place-items: center; width: 20px; height: 20px;
    border-radius: 50%; background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.45);
  }
  .check svg { width: 12px; height: 12px; }
  .src[aria-checked="true"] .check { display: grid; }
  .meta { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 0 3px; }
  .meta .icon { flex: none; width: 16px; height: 16px; }
  .meta .text { display: flex; flex-direction: column; min-width: 0; }
  .name, .detail { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .name { font-size: 12.5px; font-weight: 500; }
  .detail { font-size: 11.5px; color: var(--muted); }

  .banner {
    display: flex; align-items: center; gap: 12px; margin: 14px 0 0; padding: 10px 10px 10px 14px; border-radius: 10px;
    border: 1px solid rgba(240,87,16,.35); background: rgba(240,87,16,.08);
  }
  .banner p { flex: 1; margin: 0; font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,.82); }
  .empty { margin: 56px 0; text-align: center; color: var(--muted); }
  .blocked { max-width: 430px; margin: 64px auto 0; text-align: center; }
  .blocked .tile { display: grid; place-items: center; width: 44px; height: 44px; margin: 0 auto 14px; border-radius: 12px; background: rgba(240,87,16,.12); color: var(--accent); }
  .blocked .tile svg { width: 22px; height: 22px; }
  .blocked h2 { display: block; margin: 0 0 6px; font-size: 15px; color: var(--text); }
  .blocked p { margin: 0 0 18px; color: var(--muted); line-height: 1.55; }

  footer { flex: none; display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 16px 0 20px; border-top: 1px solid var(--line); }
  .sound { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.82); }
  .sound input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }
  .spacer { flex: 1; }
  .secondary, .primary { height: 34px; border-radius: 9px; font-weight: 600; cursor: default; }
  .secondary { padding: 0 13px; border: 1px solid var(--line-strong); background: rgba(255,255,255,.05); }
  .secondary:hover { background: rgba(255,255,255,.1); }
  .primary { padding: 0 16px; border: 1px solid var(--accent); background: var(--accent); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.18); }
  .primary:hover { filter: brightness(1.08); }
  .primary:disabled { opacity: .4; filter: none; }
  .secondary:focus-visible, .primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
</head>
<body>
<header>
  <h1>Share your screen</h1>
  <label class="search" id="search-wrap" hidden>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.75"/><path d="m10.5 10.5 3.5 3.5" stroke-linecap="round"/></svg>
    <input id="search" type="search" placeholder="Find a window" autocomplete="off" spellcheck="false" aria-label="Find a screen or window">
  </label>
</header>
<main>
  <div class="banner" id="banner" hidden>
    <p>Some windows may be missing. Allow screen recording for Commune in System Settings, then quit and reopen Commune.</p>
    <button type="button" class="secondary" data-action="settings">Open System Settings</button>
  </div>
  <div id="list" role="radiogroup" aria-label="Screens and windows" hidden>
    <section id="screens">
      <h2>Screens <span class="count" id="screens-count"></span></h2>
      <div class="grid screens" id="screens-grid"></div>
    </section>
    <section id="windows">
      <h2>Windows <span class="count" id="windows-count"></span></h2>
      <div class="grid windows" id="windows-grid"></div>
    </section>
  </div>
  <p class="empty" id="no-match" hidden></p>
  <p class="empty" id="loading">Looking for screens and windows…</p>
  <p class="empty" id="nothing" hidden>There's nothing to share right now.</p>
  <div class="blocked" id="blocked" hidden>
    <div class="tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></div>
    <h2>Allow screen recording for Commune</h2>
    <p>macOS needs your permission before Commune can share a screen or a window. In System Settings, open Privacy &amp; Security, then Screen &amp; System Audio Recording, and turn on Commune. Then quit and reopen Commune.</p>
    <button type="button" class="primary" data-action="settings">Open System Settings</button>
  </div>
</main>
<footer>
  <label class="sound" id="sound-wrap" hidden><input type="checkbox" id="sound"> Share sound</label>
  <span class="spacer"></span>
  <button type="button" class="secondary" data-action="cancel">Cancel</button>
  <button type="button" class="primary" id="share" disabled>Share</button>
</footer>
<script>
(function () {
  var CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 6.2 2.3 2.3 4.7-4.9"/></svg>';
  var state = { items: [], offerSound: false, permission: "granted", loaded: false };
  var selected = null;
  var query = "";
  var cards = new Map();
  var settingsClicks = 0;
  var focusedOnce = false;
  function el(id) { return document.getElementById(id); }
  function send(message) { document.title = message; }

  function visibleCards() {
    return Array.prototype.slice.call(document.querySelectorAll("#list .src")).filter(function (c) { return !c.closest("[hidden]"); });
  }
  function columns(grid) { return getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1; }

  function select(id) { selected = id; paintSelection(); }
  function focusCard(card) {
    select(card.dataset.id);
    card.focus();
    card.scrollIntoView({ block: "nearest" });
  }
  function share() {
    if (!selected) return;
    send("share:" + JSON.stringify({ id: selected, sound: el("sound").checked }));
  }

  function card(item) {
    var c = cards.get(item.id);
    if (!c) {
      c = document.createElement("button");
      c.type = "button";
      c.className = "src";
      c.setAttribute("role", "radio");
      c.dataset.id = item.id;
      c.innerHTML = '<span class="thumb"><img class="shot" alt=""><img class="stand-in" alt=""></span><span class="meta"><img class="icon" alt=""><span class="text"><span class="name"></span><span class="detail"></span></span></span><span class="check">' + CHECK + "</span>";
      c.addEventListener("click", function () { focusCard(c); });
      c.addEventListener("dblclick", function () { select(item.id); share(); });
      cards.set(item.id, c);
    }
    var shot = c.querySelector(".shot");
    var standIn = c.querySelector(".stand-in");
    var icon = c.querySelector(".icon");
    if (item.thumb && shot.getAttribute("src") !== item.thumb) shot.src = item.thumb;
    shot.hidden = !item.thumb;
    standIn.hidden = Boolean(item.thumb) || !item.icon;
    if (!item.thumb && item.icon && standIn.getAttribute("src") !== item.icon) standIn.src = item.icon;
    icon.hidden = !item.icon;
    if (item.icon && icon.getAttribute("src") !== item.icon) icon.src = item.icon;
    c.querySelector(".name").textContent = item.name;
    c.querySelector(".detail").textContent = item.detail;
    c.querySelector(".detail").hidden = !item.detail;
    c.title = item.name;
    return c;
  }

  function sync(grid, items) {
    items.forEach(function (item, i) {
      var c = card(item);
      if (grid.children[i] !== c) grid.insertBefore(c, grid.children[i] || null);
    });
    while (grid.children.length > items.length) grid.removeChild(grid.lastChild);
  }

  function paintSelection() {
    var list = visibleCards();
    var hasSelected = list.some(function (c) { return c.dataset.id === selected; });
    list.forEach(function (c, i) {
      var on = c.dataset.id === selected;
      c.setAttribute("aria-checked", on ? "true" : "false");
      c.tabIndex = on || (!hasSelected && i === 0) ? 0 : -1;
    });
    var item = state.items.filter(function (it) { return it.id === selected; })[0];
    el("share").disabled = !item;
    el("share").textContent = item ? (item.kind === "screen" ? "Share screen" : "Share window") : "Share";
  }

  function draw() {
    var q = query.trim().toLowerCase();
    var visible = state.items.filter(function (it) { return !q || it.name.toLowerCase().indexOf(q) !== -1; });
    var screens = visible.filter(function (it) { return it.kind === "screen"; });
    var windows = visible.filter(function (it) { return it.kind === "window"; });
    var none = state.items.length === 0;
    var blocked = state.permission === "missing";

    el("loading").hidden = state.loaded;
    el("blocked").hidden = !(state.loaded && none && blocked);
    el("nothing").hidden = !(state.loaded && none && !blocked);
    el("banner").hidden = none || !blocked;
    el("search-wrap").hidden = none;
    el("list").hidden = none;
    el("screens").hidden = screens.length === 0;
    el("windows").hidden = windows.length === 0;
    el("screens-count").textContent = String(screens.length);
    el("windows-count").textContent = String(windows.length);
    el("no-match").hidden = !(q && !none && visible.length === 0);
    el("no-match").textContent = "Nothing matches \\u201c" + query.trim() + "\\u201d.";
    el("sound-wrap").hidden = !state.offerSound;

    sync(el("screens-grid"), screens);
    sync(el("windows-grid"), windows);
    if (selected && !visible.some(function (it) { return it.id === selected; })) selected = null;
    paintSelection();
  }

  window.render = function (next) {
    state = { items: next.items || [], offerSound: Boolean(next.offerSound), permission: next.permission || "granted", loaded: true };
    window.__renders = (window.__renders || 0) + 1;
    draw();
    if (!focusedOnce && state.items.length) {
      focusedOnce = true;
      var first = visibleCards()[0];
      if (first) first.focus();
    }
  };

  document.addEventListener("click", function (e) {
    var action = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!action) return;
    if (action.dataset.action === "cancel") send("cancel");
    if (action.dataset.action === "settings") send("settings:" + (++settingsClicks));
  });
  el("share").addEventListener("click", share);
  el("search").addEventListener("input", function (e) { query = e.target.value; draw(); });

  document.addEventListener("keydown", function (e) {
    var search = el("search");
    var active = document.activeElement;
    if (e.key === "Escape") {
      e.preventDefault();
      if (active === search && query) { search.value = ""; query = ""; draw(); return; }
      send("cancel");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") { e.preventDefault(); search.focus(); search.select(); return; }
    var list = visibleCards();
    if (active === search) {
      if (e.key === "ArrowDown" && list.length) { e.preventDefault(); focusCard(list[0]); }
      if (e.key === "Enter" && list.length === 1) { e.preventDefault(); select(list[0].dataset.id); share(); }
      return;
    }
    var current = active && active.closest ? active.closest(".src") : null;
    if (!current) return;
    if (e.key === "Enter") { e.preventDefault(); select(current.dataset.id); share(); return; }
    if (e.key === " ") { e.preventDefault(); focusCard(current); return; }
    var i = list.indexOf(current);
    var siblings = Array.prototype.slice.call(current.parentElement.children);
    var j = siblings.indexOf(current);
    var cols = columns(current.parentElement);
    var next = null;
    if (e.key === "ArrowRight") next = list[i + 1] || null;
    if (e.key === "ArrowLeft") next = list[i - 1] || null;
    if (e.key === "ArrowDown") {
      // The card below, or the last one on a shorter final row, or the next section's first.
      if (Math.floor(j / cols) < Math.floor((siblings.length - 1) / cols)) next = siblings[Math.min(j + cols, siblings.length - 1)];
      else next = list[i + (siblings.length - j)] || null;
    }
    if (e.key === "ArrowUp") {
      if (j - cols >= 0) next = siblings[j - cols];
      else if (i - j - 1 >= 0) next = list[i - j - 1];
      else { e.preventDefault(); search.focus(); return; }
    }
    if (next) { e.preventDefault(); focusCard(next); }
  });
})();
</script>
</body>
</html>`;
