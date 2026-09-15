/* Annapurna Eco Lodge Resort — menu + order pad
   Display only. Nothing is sent anywhere; the guest shows
   the final screen to a server, who writes it down. */

const MENU_URL = "data/menu.json";
const STORE_KEY = "aelr.order.v1";

const DIETS = { vegetarian: "Vegetarian", vegan: "Vegan", spicy: "Spicy" };

const TAG_LABELS = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  spicy: "Spicy",
  popular: "Guest favourite",
};

const state = {
  data: null,
  category: "all",
  query: "",
  diets: new Set(),
  order: new Map(), // id -> { qty, note }
  table: "",
};

const $ = (id) => document.getElementById(id);

const ui = {};
[
  "chips", "menu", "state", "featured", "featuredScroller", "resultbar", "toolbar",
  "searchOpen", "searchWrap", "search", "searchClose", "filterOpen", "filterBadge",
  "sheet", "sheetBackdrop", "dietOptions", "dietClear", "sheetDone", "footerNote", "toTop",
  "orderbar", "orderCount", "orderTotal", "openBasket",
  "basketScreen", "basketClose", "basketList", "basketTotal", "tableNo",
  "clearOrder", "showWaiter",
  "waiterScreen", "waiterTable", "waiterList", "waiterTotal", "waiterTime", "waiterDone",
].forEach((k) => { ui[k] = $(k); });

start();

async function start() {
  try {
    const res = await fetch(MENU_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.data = await res.json();
  } catch (err) {
    console.error("Could not load " + MENU_URL, err);
    ui.state.innerHTML =
      '<p class="empty__title">The menu did not load</p>' +
      "<p>Check your connection and refresh the page, or ask us for a printed copy.</p>";
    return;
  }

  ui.footerNote.textContent = state.data.restaurant.footerNote || "";
  restore();
  buildChips();
  buildDietOptions();
  buildFeatured();
  wireUp();
  render();
  syncOrderBar();
}

/* =========================================================
   Order state
   ========================================================= */

function itemById(id) {
  return state.data.items.find((i) => String(i.id) === String(id));
}

function isOrderable(categoryId) {
  const cat = state.data.categories.find((c) => c.id === categoryId);
  return !cat || cat.orderable !== false;
}

function qtyOf(id) {
  const line = state.order.get(String(id));
  return line ? line.qty : 0;
}

function setQty(id, qty) {
  const key = String(id);
  if (qty <= 0) {
    state.order.delete(key);
  } else {
    const line = state.order.get(key) || { qty: 0, note: "" };
    line.qty = Math.min(qty, 99);
    state.order.set(key, line);
  }
  persist();
  refreshQty(key);
  syncOrderBar();
  if (!ui.basketScreen.hidden) renderBasket();
}

function setNote(id, text) {
  const line = state.order.get(String(id));
  if (!line) return;
  line.note = text.slice(0, 120);
  persist();
}

function clearOrder() {
  const ids = [...state.order.keys()];
  state.order.clear();
  state.table = "";
  ui.tableNo.value = "";
  persist();
  ids.forEach(refreshQty);
  syncOrderBar();
}

function orderCount() {
  let n = 0;
  state.order.forEach((l) => { n += l.qty; });
  return n;
}

function orderTotal() {
  let t = 0;
  state.order.forEach((l, id) => {
    const item = itemById(id);
    if (item) t += item.price * l.qty;
  });
  return t;
}

/* Survives an accidental refresh. Wrapped so that a browser with
   storage disabled simply keeps the order in memory instead. */
function persist() {
  try {
    const payload = {
      table: state.table,
      lines: [...state.order.entries()].map(([id, l]) => [id, l.qty, l.note]),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch (e) { /* memory only */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.table = saved.table || "";
    ui.tableNo.value = state.table;
    (saved.lines || []).forEach(([id, qty, note]) => {
      if (itemById(id) && qty > 0) state.order.set(String(id), { qty, note: note || "" });
    });
  } catch (e) { /* start empty */ }
}

function money(n) {
  return (state.data.restaurant.currency || "") + " " +
    String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* =========================================================
   Quantity controls
   ========================================================= */

function renderQtyInto(host, item) {
  const qty = qtyOf(item.id);
  host.innerHTML = "";

  if (qty === 0) {
    const add = document.createElement("button");
    add.className = "add";
    add.type = "button";
    add.setAttribute("aria-label", "Add " + item.name + " to your order");
    add.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>';
    add.addEventListener("click", () => setQty(item.id, 1));
    host.appendChild(add);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "stepper";

  const dec = document.createElement("button");
  dec.className = "stepper__btn";
  dec.type = "button";
  dec.setAttribute("aria-label", qty === 1 ? "Remove " + item.name : "One fewer " + item.name);
  dec.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12"/></svg>';
  dec.addEventListener("click", () => setQty(item.id, qty - 1));

  const n = document.createElement("span");
  n.className = "stepper__n";
  n.textContent = String(qty);

  const inc = document.createElement("button");
  inc.className = "stepper__btn";
  inc.type = "button";
  inc.setAttribute("aria-label", "One more " + item.name);
  inc.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>';
  inc.addEventListener("click", () => setQty(item.id, qty + 1));

  wrap.append(dec, n, inc);
  host.appendChild(wrap);
}

/* Updates only the controls for one dish, so the page never
   re-renders and the guest keeps their scroll position. */
function refreshQty(id) {
  const item = itemById(id);
  if (!item) return;
  document.querySelectorAll('[data-qty="' + id + '"]').forEach((host) => {
    renderQtyInto(host, item);
    const row = host.closest(".dish");
    if (row) row.classList.toggle("is-in-order", qtyOf(id) > 0);
  });
}

/* =========================================================
   Static pieces
   ========================================================= */

function buildChips() {
  state.data.categories.forEach((cat) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.textContent = cat.label;
    b.dataset.id = cat.id;
    b.setAttribute("aria-pressed", String(cat.id === state.category));
    b.addEventListener("click", () => {
      state.category = cat.id;
      [...ui.chips.children].forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.id === cat.id))
      );
      b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      render();
    });
    ui.chips.appendChild(b);
  });
}

function buildDietOptions() {
  Object.entries(DIETS).forEach(([key, label]) => {
    const count = state.data.items.filter((i) => (i.tags || []).includes(key)).length;
    if (!count) return;

    const b = document.createElement("button");
    b.className = "opt";
    b.type = "button";
    b.dataset.diet = key;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML =
      "<span>" + label + ' <span class="opt__count">' + count + " dishes</span></span>" +
      '<span class="opt__box" aria-hidden="true"></span>';
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", String(!on));
      if (on) state.diets.delete(key); else state.diets.add(key);
      syncFilterButton();
      render();
    });
    ui.dietOptions.appendChild(b);
  });
}

function buildFeatured() {
  const picks = state.data.items.filter((i) => i.featured);
  if (!picks.length) return;

  picks.forEach((item) => {
    const card = document.createElement("article");
    card.className = "fcard";

    const name = document.createElement("h3");
    name.className = "fcard__name";
    name.textContent = item.name;
    card.appendChild(name);

    if (item.description) {
      const d = document.createElement("p");
      d.className = "fcard__desc";
      d.textContent = item.description;
      card.appendChild(d);
    }

    const foot = document.createElement("div");
    foot.className = "fcard__foot";

    const price = document.createElement("p");
    price.className = "fcard__price";
    price.textContent = money(item.price);
    foot.appendChild(price);

    if (isOrderable(item.category)) {
      const host = document.createElement("div");
      host.className = "qty";
      host.dataset.qty = String(item.id);
      renderQtyInto(host, item);
      foot.appendChild(host);
    }

    card.appendChild(foot);
    ui.featuredScroller.appendChild(card);
  });

  ui.featured.hidden = false;
}

/* =========================================================
   Menu rendering
   ========================================================= */

function visibleItems() {
  const q = state.query.trim().toLowerCase();
  return state.data.items.filter((item) => {
    if (state.category !== "all" && item.category !== state.category) return false;
    for (const diet of state.diets) {
      if (!(item.tags || []).includes(diet)) return false;
    }
    if (q) {
      const hay = (item.name + " " + (item.description || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function render() {
  const items = visibleItems();
  const filtering = state.query.trim() !== "" || state.diets.size > 0 || state.category !== "all";

  ui.featured.hidden = filtering || !state.data.items.some((i) => i.featured);

  if (filtering) {
    ui.resultbar.hidden = false;
    ui.resultbar.textContent = items.length === 0
      ? "Nothing matches"
      : items.length + (items.length === 1 ? " dish" : " dishes") + summaryTail();
  } else {
    ui.resultbar.hidden = true;
  }

  ui.menu.innerHTML = "";

  if (!items.length) {
    ui.menu.innerHTML =
      '<div class="empty">' +
      '<p class="empty__title">Nothing matches that</p>' +
      "<p>Try a shorter word, or a different section.</p>" +
      '<button class="empty__btn" type="button" id="resetAll">Clear filters and search</button>' +
      "</div>";
    $("resetAll").addEventListener("click", resetAll);
    return;
  }

  state.data.categories.forEach((cat) => {
    if (cat.id === "all") return;
    const inCat = items.filter((i) => i.category === cat.id);
    if (inCat.length) ui.menu.appendChild(buildSection(cat, inCat));
  });
}

function summaryTail() {
  const bits = [];
  if (state.diets.size) bits.push([...state.diets].map((d) => DIETS[d].toLowerCase()).join(" and "));
  if (state.query.trim()) bits.push('matching "' + state.query.trim() + '"');
  return bits.length ? ", " + bits.join(", ") : "";
}

function buildSection(cat, items) {
  const section = document.createElement("section");
  section.className = "section";

  const head = document.createElement("div");
  head.className = "section__head";
  head.innerHTML = '<h2 class="section__title"></h2><span class="section__count"></span>';
  head.querySelector(".section__title").textContent = cat.label;
  head.querySelector(".section__count").textContent =
    items.length + (items.length === 1 ? " item" : " items");
  section.appendChild(head);

  if (cat.note && !state.query.trim()) {
    const note = document.createElement("p");
    note.className = "section__note";
    note.textContent = cat.note;
    section.appendChild(note);
  }

  const panel = document.createElement("div");
  panel.className = "panel";
  items.forEach((item) => panel.appendChild(buildDish(item)));
  section.appendChild(panel);
  return section;
}

function buildDish(item) {
  const row = document.createElement("article");
  row.className = "dish";
  if (qtyOf(item.id) > 0) row.classList.add("is-in-order");

  const body = document.createElement("div");
  body.className = "dish__body";

  const name = document.createElement("h3");
  name.className = "dish__name";
  highlightInto(name, item.name);
  body.appendChild(name);

  if (item.description) {
    const desc = document.createElement("p");
    desc.className = "dish__desc";
    highlightInto(desc, item.description);
    body.appendChild(desc);
  }

  const tags = (item.tags || []).filter((t) => TAG_LABELS[t]);
  if (tags.length) {
    const ul = document.createElement("ul");
    ul.className = "tags";
    tags.forEach((t) => {
      const li = document.createElement("li");
      li.className = "tag tag--" + t;
      li.textContent = TAG_LABELS[t];
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  const side = document.createElement("div");
  side.className = "dish__side";

  const price = document.createElement("p");
  price.className = "dish__price";
  const cur = document.createElement("span");
  cur.textContent = state.data.restaurant.currency || "";
  price.appendChild(cur);
  price.append(String(item.price));
  side.appendChild(price);

  if (isOrderable(item.category)) {
    const host = document.createElement("div");
    host.className = "qty";
    host.dataset.qty = String(item.id);
    renderQtyInto(host, item);
    side.appendChild(host);
  }

  row.append(body, side);
  return row;
}

function highlightInto(el, text) {
  const q = state.query.trim();
  if (!q) { el.textContent = text; return; }
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) { el.textContent = text; return; }
  const mark = document.createElement("mark");
  mark.textContent = text.slice(at, at + q.length);
  el.append(text.slice(0, at), mark, text.slice(at + q.length));
}

/* =========================================================
   Order bar
   ========================================================= */

function syncOrderBar() {
  const n = orderCount();
  if (n === 0) {
    ui.orderbar.hidden = true;
    document.body.classList.remove("has-order");
    if (!ui.basketScreen.hidden) closeBasket();
    return;
  }
  ui.orderbar.hidden = false;
  document.body.classList.add("has-order");
  ui.orderCount.textContent = n === 1 ? "1 item in your order" : n + " items in your order";
  ui.orderTotal.textContent = money(orderTotal());
}

/* =========================================================
   Basket
   ========================================================= */

function renderBasket() {
  ui.basketList.innerHTML = "";

  state.order.forEach((line, id) => {
    const item = itemById(id);
    if (!item) return;

    const box = document.createElement("div");
    box.className = "bline";

    const top = document.createElement("div");
    top.className = "bline__top";

    const names = document.createElement("div");
    names.style.flex = "1 1 auto";
    const nm = document.createElement("p");
    nm.className = "bline__name";
    nm.textContent = item.name;
    const each = document.createElement("p");
    each.className = "bline__each";
    each.textContent = money(item.price) + " each";
    names.append(nm, each);

    const sum = document.createElement("p");
    sum.className = "bline__sum";
    sum.textContent = money(item.price * line.qty);

    top.append(names, sum);
    box.appendChild(top);

    if (line.note) {
      const note = document.createElement("p");
      note.className = "bline__note";
      note.textContent = line.note;
      box.appendChild(note);
    }

    const controls = document.createElement("div");
    controls.className = "bline__controls";

    const host = document.createElement("div");
    host.className = "qty";
    host.dataset.qty = String(item.id);
    renderQtyInto(host, item);

    const actions = document.createElement("div");
    actions.className = "bline__actions";

    const noteBtn = document.createElement("button");
    noteBtn.className = "linkbtn";
    noteBtn.type = "button";
    noteBtn.textContent = line.note ? "Edit note" : "Add note";
    noteBtn.addEventListener("click", () => {
      const existing = box.querySelector(".noteinput");
      if (existing) { existing.remove(); return; }
      const input = document.createElement("input");
      input.className = "noteinput";
      input.type = "text";
      input.maxLength = 120;
      input.placeholder = "No onion, less spicy, no salt…";
      input.value = line.note || "";
      input.addEventListener("input", () => setNote(id, input.value));
      input.addEventListener("blur", () => renderBasket());
      box.appendChild(input);
      input.focus();
    });

    const del = document.createElement("button");
    del.className = "linkbtn linkbtn--danger";
    del.type = "button";
    del.textContent = "Remove";
    del.addEventListener("click", () => setQty(id, 0));

    actions.append(noteBtn, del);
    controls.append(host, actions);
    box.appendChild(controls);

    ui.basketList.appendChild(box);
  });

  ui.basketTotal.textContent = money(orderTotal());
}

function openBasket() {
  renderBasket();
  ui.basketScreen.hidden = false;
  document.body.classList.add("is-locked");
}

function closeBasket() {
  ui.basketScreen.hidden = true;
  if (ui.waiterScreen.hidden) document.body.classList.remove("is-locked");
}

/* =========================================================
   Server screen
   ========================================================= */

let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* not supported, no harm */ }
}

function showWaiter() {
  ui.waiterTable.textContent = state.table.trim()
    ? "Table " + state.table.trim()
    : "Order";

  ui.waiterList.innerHTML = "";

  state.data.categories.forEach((cat) => {
    if (cat.id === "all") return;
    const lines = [];
    state.order.forEach((line, id) => {
      const item = itemById(id);
      if (item && item.category === cat.id) lines.push({ item, line });
    });
    if (!lines.length) return;

    const group = document.createElement("div");
    group.className = "wgroup";

    const gname = document.createElement("p");
    gname.className = "wgroup__name";
    gname.textContent = cat.label;
    group.appendChild(gname);

    lines.forEach(({ item, line }) => {
      const row = document.createElement("div");
      row.className = "wline";
      const q = document.createElement("span");
      q.className = "wline__qty";
      q.textContent = line.qty + "\u00D7";
      const nm = document.createElement("span");
      nm.className = "wline__name";
      nm.textContent = item.name;
      row.append(q, nm);
      group.appendChild(row);

      if (line.note) {
        const note = document.createElement("p");
        note.className = "wline__note";
        note.textContent = line.note;
        group.appendChild(note);
      }
    });

    ui.waiterList.appendChild(group);
  });

  ui.waiterTotal.textContent = money(orderTotal());
  ui.waiterTime.textContent = "Shown at " +
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  ui.waiterScreen.hidden = false;
  document.body.classList.add("is-locked");
  keepAwake(true);
}

function hideWaiter() {
  ui.waiterScreen.hidden = true;
  keepAwake(false);
  if (ui.basketScreen.hidden) document.body.classList.remove("is-locked");
}

/* =========================================================
   Wiring
   ========================================================= */

function wireUp() {
  ui.searchOpen.addEventListener("click", () => {
    ui.toolbar.classList.add("is-searching");
    ui.searchWrap.hidden = false;
    ui.search.focus();
  });
  ui.searchClose.addEventListener("click", closeSearch);
  ui.search.addEventListener("input", () => { state.query = ui.search.value; render(); });
  ui.search.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); });

  ui.filterOpen.addEventListener("click", openSheet);
  ui.sheetDone.addEventListener("click", closeSheet);
  ui.sheetBackdrop.addEventListener("click", closeSheet);
  ui.dietClear.addEventListener("click", () => {
    state.diets.clear();
    [...ui.dietOptions.children].forEach((o) => o.setAttribute("aria-pressed", "false"));
    syncFilterButton();
    render();
  });

  ui.openBasket.addEventListener("click", openBasket);
  ui.basketClose.addEventListener("click", closeBasket);
  ui.showWaiter.addEventListener("click", showWaiter);
  ui.waiterDone.addEventListener("click", hideWaiter);

  ui.tableNo.addEventListener("input", () => {
    state.table = ui.tableNo.value;
    persist();
  });

  ui.clearOrder.addEventListener("click", () => {
    if (orderCount() && !confirm("Clear the whole order?")) return;
    clearOrder();
    closeBasket();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!ui.waiterScreen.hidden) hideWaiter();
    else if (!ui.basketScreen.hidden) closeBasket();
    else if (!ui.sheet.hidden) closeSheet();
  });

  ui.toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const sentinel = document.createElement("div");
  ui.toolbar.parentNode.insertBefore(sentinel, ui.toolbar);
  new IntersectionObserver(
    ([entry]) => ui.toolbar.classList.toggle("is-stuck", !entry.isIntersecting),
    { rootMargin: "-60px 0px 0px 0px" }
  ).observe(sentinel);

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ui.toTop.hidden = window.scrollY < 700;
      ticking = false;
    });
  }, { passive: true });
}

function closeSearch() {
  ui.toolbar.classList.remove("is-searching");
  ui.searchWrap.hidden = true;
  ui.search.value = "";
  state.query = "";
  render();
}

function openSheet() {
  ui.sheet.hidden = false;
  ui.sheetBackdrop.hidden = false;
  document.body.classList.add("is-locked");
  ui.filterOpen.setAttribute("aria-expanded", "true");
  const first = ui.dietOptions.querySelector(".opt");
  if (first) first.focus();
}

function closeSheet() {
  ui.sheet.hidden = true;
  ui.sheetBackdrop.hidden = true;
  if (ui.basketScreen.hidden && ui.waiterScreen.hidden) {
    document.body.classList.remove("is-locked");
  }
  ui.filterOpen.setAttribute("aria-expanded", "false");
  ui.filterOpen.focus();
}

function syncFilterButton() {
  const n = state.diets.size;
  ui.filterOpen.classList.toggle("is-on", n > 0);
  ui.filterBadge.hidden = n === 0;
  ui.filterBadge.textContent = String(n);
}

function resetAll() {
  state.diets.clear();
  state.query = "";
  state.category = "all";
  ui.search.value = "";
  [...ui.dietOptions.children].forEach((o) => o.setAttribute("aria-pressed", "false"));
  [...ui.chips.children].forEach((c) =>
    c.setAttribute("aria-pressed", String(c.dataset.id === "all"))
  );
  closeSearch();
  syncFilterButton();
  render();
}
