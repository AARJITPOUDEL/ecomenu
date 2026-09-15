/* Annapurna Eco Lodge Resort — about page */

const MENU_URL = "data/menu.json";
const $ = (id) => document.getElementById(id);

load();

async function load() {
  let data;
  try {
    const res = await fetch(MENU_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
  } catch (err) {
    console.error("Could not load " + MENU_URL, err);
    $("story").innerHTML =
      "<p>This page did not load. Check your connection and refresh.</p>";
    return;
  }

  const info = data.restaurant || {};
  const about = data.about || {};

  $("lede").textContent = about.lede || info.tagline || "";
  $("footerNote").textContent = info.footerNote || "";

  const story = $("story");
  (about.paragraphs || []).forEach((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    story.appendChild(p);
  });

  const hl = $("highlights");
  (about.highlights || []).forEach((h) => {
    const div = document.createElement("div");
    div.className = "hl";
    div.innerHTML = '<p class="hl__title"></p><p class="hl__text"></p>';
    div.querySelector(".hl__title").textContent = h.title;
    div.querySelector(".hl__text").textContent = h.text;
    hl.appendChild(div);
  });

  $("address").textContent = info.address || "";
  $("hours").textContent = info.hours || "";

  const phones = $("phones");
  (info.phones || []).forEach((num) => {
    const a = document.createElement("a");
    a.href = "tel:" + num.replace(/[^\d+]/g, "");
    a.textContent = num;
    phones.appendChild(a);
  });
}
