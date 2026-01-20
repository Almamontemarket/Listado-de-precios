const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRot1AcxBJqPKUFTIHwKbMa7Bf_Z9p2QzgEBy5uBzo2-uCxKci8cmy0NuYJRbS980YkH3IR9Lnrm1nI/pub?gid=0&single=true&output=csv";

const elContenedor = document.getElementById("contenedor");
const elBuscador = document.getElementById("buscador");
const elToggleNo = document.getElementById("toggleNoStock");
const elCount = document.getElementById("count");
const elUpdated = document.getElementById("updated");

const elNavCats = document.getElementById("navCats");
const elNavSearch = document.getElementById("navSearch");

const elMenuBtn = document.getElementById("menuBtn");
const elSidenav = document.getElementById("sidenav");
const elBackdrop = document.getElementById("backdrop");
const elCloseNav = document.getElementById("closeNav");

let RAW = [];
let selectedCats = new Set();

function normText(s){
  return (s ?? "").toString().trim();
}

function normDisponibilidad(s){
  const v = normText(s).toUpperCase();
  if (!v) return "SI";
  if (["NO","FALSE","0","N"].includes(v)) return "NO";
  return "SI";
}

function parsePrecio(x){
  const t = normText(x)
    .replace(/\$/g,"")
    .replace(/\s/g,"")
    .replace(/\./g,"")
    .replace(/,/g,"");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatoCLP(n){
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-CL");
}

function groupByCategoria(rows){
  const m = new Map();
  for (const r of rows){
    if (!m.has(r.categoria)) m.set(r.categoria, []);
    m.get(r.categoria).push(r);
  }
  return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0], "es"));
}

function slugify(str){
  return normText(str)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
}

/* =========================
   Drawer open/close/toggle
========================= */
function isNavOpen(){
  return !!elSidenav?.classList.contains("is-open");
}

function openNav(){
  if (!elSidenav) return;
  elSidenav.classList.add("is-open");
  elSidenav.setAttribute("aria-hidden", "false");
  if (elBackdrop) elBackdrop.hidden = false;
  if (elMenuBtn) elMenuBtn.setAttribute("aria-expanded", "true");
}

function closeNav(){
  if (!elSidenav) return;
  elSidenav.classList.remove("is-open");
  elSidenav.setAttribute("aria-hidden", "true");
  if (elBackdrop) elBackdrop.hidden = true;
  if (elMenuBtn) elMenuBtn.setAttribute("aria-expanded", "false");
}

function toggleNav(){
  if (isNavOpen()) closeNav();
  else openNav();
}

/* =========================
   Side nav (SOLO categorías)
========================= */
function buildSideNavFromRows(rowsForNav){
  if (!elNavCats) return;

  const grouped = groupByCategoria(rowsForNav);
  elNavCats.innerHTML = "";

  for (const [cat, items] of grouped){
    const id = "catcheck-" + slugify(cat);

    const row = document.createElement("label");
    row.className = "navcat";
    row.dataset.cat = cat.toLowerCase();

    const left = document.createElement("div");
    left.className = "navcat__left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "navcat__check";
    chk.id = id;
    chk.checked = selectedCats.has(cat);

    chk.addEventListener("change", () => {
      if (chk.checked) selectedCats.add(cat);
      else selectedCats.delete(cat);
      render();
    });

    const name = document.createElement("div");
    name.className = "navcat__name";
    name.textContent = cat;

    left.appendChild(chk);
    left.appendChild(name);

    const count = document.createElement("div");
    count.className = "navcat__count";
    count.textContent = items.length;

    row.appendChild(left);
    row.appendChild(count);

    elNavCats.appendChild(row);
  }
}

function filterSideNav(){
  if (!elNavCats || !elNavSearch) return;

  const q = normText(elNavSearch.value).toLowerCase();
  const cats = elNavCats.querySelectorAll(".navcat");

  for (const c of cats){
    const catName = c.dataset.cat || "";
    c.style.display = (!q || catName.includes(q)) ? "" : "none";
  }
}

/* =========================
   Render principal
========================= */
function render(){
  const q = normText(elBuscador?.value).toLowerCase();
  const showNo = !!elToggleNo?.checked;

  let rows = RAW
    .filter(r => r.categoria && r.producto)
    .filter(r => showNo ? true : r.disponibilidad !== "NO")
    .filter(r => !q ? true : (r.producto.toLowerCase().includes(q)));

  if (selectedCats.size > 0){
    rows = rows.filter(r => selectedCats.has(r.categoria));
  }

  const grouped = groupByCategoria(rows);
  const totalItems = rows.length;
  const totalCats = grouped.length;

  if (elCount) elCount.textContent = `${totalCats} categorías · ${totalItems} productos`;

  elContenedor.innerHTML = "";

  if (grouped.length === 0){
    elContenedor.innerHTML =
      `<div class="section">
        <div class="section__head"><h3 class="section__title">Sin resultados</h3></div>
        <div style="padding:16px;color:var(--muted)">Prueba con otra búsqueda, cambia categorías o muestra NO disponibles.</div>
      </div>`;

    const rowsForNav = RAW
      .filter(r => r.categoria && r.producto)
      .filter(r => showNo ? true : r.disponibilidad !== "NO");
    buildSideNavFromRows(rowsForNav);
    filterSideNav();
    return;
  }

  for (const [cat, items] of grouped){
    items.sort((a,b)=>a.producto.localeCompare(b.producto, "es"));

    const section = document.createElement("section");
    section.className = "section";

    const head = document.createElement("div");
    head.className = "section__head";

    const title = document.createElement("h3");
    title.className = "section__title";
    title.textContent = cat;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${items.length}`;

    head.appendChild(title);
    head.appendChild(badge);

    const grid = document.createElement("div");
    grid.className = "grid";

    for (const it of items){
      const card = document.createElement("div");
      card.className = "item" + (it.disponibilidad === "NO" ? " muted" : "");

      const top = document.createElement("div");
      top.className = "item__top";

      const left = document.createElement("div");

      const name = document.createElement("div");
      name.className = "item__name";
      name.textContent = it.producto;

      const unit = document.createElement("div");
      unit.className = "item__unit";
      unit.textContent = it.unidad ? it.unidad : "";

      left.appendChild(name);
      if (it.unidad) left.appendChild(unit);

      const price = document.createElement("div");
      price.className = "item__price";
      if (Number.isFinite(it.precio_num)){
        price.innerHTML = `$ ${formatoCLP(it.precio_num)} <small>CLP</small>`;
      } else {
        price.textContent = normText(it.precio_raw) || "-";
      }

      top.appendChild(left);
      top.appendChild(price);
      card.appendChild(top);
      grid.appendChild(card);
    }

    section.appendChild(head);
    section.appendChild(grid);
    elContenedor.appendChild(section);
  }

  const rowsForNav = RAW
    .filter(r => r.categoria && r.producto)
    .filter(r => showNo ? true : r.disponibilidad !== "NO");

  buildSideNavFromRows(rowsForNav);
  filterSideNav();
}

/* =========================
   Load
========================= */
async function load(){
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const csvText = await res.text();

  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data || [];

      RAW = data.map(r => ({
        categoria: normText(r.categoria),
        producto: normText(r.producto),
        unidad: normText(r.unidad),
        precio_raw: r.precio,
        precio_num: parsePrecio(r.precio),
        disponibilidad: normDisponibilidad(r.disponibilidad),
      }));

      const now = new Date();
      if (elUpdated) elUpdated.textContent = `Última carga: ${now.toLocaleString("es-CL")}`;

      render();
    },
    error: () => {
      elContenedor.innerHTML =
        `<div class="section">
          <div class="section__head"><h3 class="section__title">Error</h3></div>
          <div style="padding:16px;color:var(--muted)">No se pudo leer el CSV.</div>
        </div>`;
    }
  });
}

/* =========================
   Events
========================= */
elBuscador?.addEventListener("input", render);
elToggleNo?.addEventListener("change", render);
elNavSearch?.addEventListener("input", filterSideNav);

elMenuBtn?.addEventListener("click", toggleNav);  // AHORA abre/cierra
elCloseNav?.addEventListener("click", closeNav);
elBackdrop?.addEventListener("click", closeNav);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNav();
});

load();
