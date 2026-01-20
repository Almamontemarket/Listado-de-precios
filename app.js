const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRot1AcxBJqPKUFTIHwKbMa7Bf_Z9p2QzgEBy5uBzo2-uCxKci8cmy0NuYJRbS980YkH3IR9Lnrm1nI/pub?gid=0&single=true&output=csv";

const elContenedor = document.getElementById("contenedor");
const elBuscador = document.getElementById("buscador");
const elToggleNo = document.getElementById("toggleNoStock");
const elCount = document.getElementById("count");
const elUpdated = document.getElementById("updated");

let elNavCats = document.getElementById("navCats");
let elNavSearch = document.getElementById("navSearch");

let RAW = [];

/* =========================
   Helpers
========================= */
function normText(s){
  return (s ?? "").toString().trim();
}

/* Quita tildes, baja a minúsculas: mani == maní */
function fold(str){
  return (str ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
   Drawer / Hamburguesa
   (auto-crea markup si no existe)
========================= */
function ensureSideNav(){
  // Si ya existen en el HTML, no hacemos nada
  let menuBtn = document.querySelector(".menuBtn");
  let sidenav = document.querySelector(".sidenav");
  let backdrop = document.querySelector(".backdrop");

  // Crear botón hamburguesa si no existe
  if (!menuBtn){
    menuBtn = document.createElement("button");
    menuBtn.className = "menuBtn";
    menuBtn.type = "button";
    menuBtn.setAttribute("aria-label", "Abrir categorías");
    menuBtn.innerHTML = `<span></span><span></span><span></span>`;
    document.body.appendChild(menuBtn);
  }

  // Crear backdrop si no existe
  if (!backdrop){
    backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.style.display = "none";
    document.body.appendChild(backdrop);
  }

  // Crear sidenav si no existe
  if (!sidenav){
    sidenav = document.createElement("aside");
    sidenav.className = "sidenav";
    sidenav.innerHTML = `
      <div class="sidenav__body">
        <div class="sidenav__top">
          <div class="sidenav__title">Categorías</div>
          <button class="sidenav__close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <input id="navSearch" type="search" placeholder="Buscar categoría o producto..." autocomplete="off" />
        <div id="navCats" class="navcats"></div>
      </div>
    `;
    document.body.appendChild(sidenav);
  }

  // Actualizar refs (por si los creamos)
  elNavCats = document.getElementById("navCats");
  elNavSearch = document.getElementById("navSearch");

  const closeBtn = sidenav.querySelector(".sidenav__close");

  function openNav(){
    sidenav.classList.add("is-open");
    backdrop.style.display = "";
  }
  function closeNav(){
    sidenav.classList.remove("is-open");
    backdrop.style.display = "none";
  }

  menuBtn.addEventListener("click", () => {
    if (sidenav.classList.contains("is-open")) closeNav();
    else openNav();
  });

  backdrop.addEventListener("click", closeNav);
  closeBtn?.addEventListener("click", closeNav);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // listener del buscador del drawer
  elNavSearch?.addEventListener("input", filterSideNav);
}

/* =========================
   SideNav (categorías/productos)
========================= */
function buildSideNav(grouped){
  if (!elNavCats) return;
  elNavCats.innerHTML = "";

  for (const [cat, items] of grouped){
    const catId = "cat-" + slugify(cat);

    const box = document.createElement("div");
    box.className = "navcat";
    box.dataset.cat = fold(cat);

    const head = document.createElement("div");
    head.className = "navcat__head";
    head.addEventListener("click", () => {
      box.classList.toggle("is-open");
      const sec = document.getElementById(catId);
      if (sec) sec.scrollIntoView({ behavior:"smooth", block:"start" });
    });

    const name = document.createElement("div");
    name.className = "navcat__name";
    name.textContent = cat;

    const count = document.createElement("div");
    count.className = "navcat__count";
    count.textContent = items.length;

    head.appendChild(name);
    head.appendChild(count);

    const list = document.createElement("div");
    list.className = "navcat__list";

    for (const it of items){
      const row = document.createElement("div");
      row.className = "navitem";
      row.dataset.prod = it.producto_fold || fold(it.producto);

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = document.getElementById(it._id);
        if (target) target.scrollIntoView({ behavior:"smooth", block:"center" });
      });

      const p = document.createElement("div");
      p.className = "navitem__p";
      p.textContent = it.producto;

      const pr = document.createElement("div");
      pr.className = "navitem__price";
      pr.textContent = Number.isFinite(it.precio_num) ? `$ ${formatoCLP(it.precio_num)}` : "";

      row.appendChild(p);
      row.appendChild(pr);
      list.appendChild(row);
    }

    box.appendChild(head);
    box.appendChild(list);
    elNavCats.appendChild(box);
  }
}

function filterSideNav(){
  if (!elNavCats || !elNavSearch) return;

  const q = fold(elNavSearch.value);
  const cats = elNavCats.querySelectorAll(".navcat");

  for (const c of cats){
    const catName = c.dataset.cat || "";
    const items = c.querySelectorAll(".navitem");

    let anyItem = false;
    for (const it of items){
      const ok = !q || catName.includes(q) || (it.dataset.prod || "").includes(q);
      it.style.display = ok ? "" : "none";
      if (ok) anyItem = true;
    }

    const catOk = !q || catName.includes(q) || anyItem;
    c.style.display = catOk ? "" : "none";

    if (q && catOk) c.classList.add("is-open");
    if (!q) c.classList.remove("is-open");
  }
}

/* =========================
   Render principal
========================= */
function render(){
  const q = fold(elBuscador?.value);
  const showNo = !!elToggleNo?.checked;

  let rows = RAW
    .filter(r => r.categoria && r.producto)
    .filter(r => showNo ? true : r.disponibilidad !== "NO")
    .filter(r => !q ? true : (r.producto_fold.includes(q)));

  const grouped = groupByCategoria(rows);

  const totalItems = rows.length;
  const totalCats = grouped.length;
  if (elCount) elCount.textContent = `${totalCats} categorías · ${totalItems} productos`;

  elContenedor.innerHTML = "";

  if (grouped.length === 0){
    elContenedor.innerHTML =
      `<div class="section">
        <div class="section__head"><h3 class="section__title">Sin resultados</h3></div>
        <div style="padding:16px;color:var(--muted)">Prueba con otra búsqueda o muestra NO disponibles.</div>
      </div>`;
    if (elNavCats) elNavCats.innerHTML = "";
    return;
  }

  for (const [cat, items] of grouped){
    items.sort((a,b)=>a.producto.localeCompare(b.producto, "es"));

    const catId = "cat-" + slugify(cat);

    const section = document.createElement("section");
    section.className = "section";
    section.id = catId;

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
      const baseId = "p-" + slugify(cat) + "-" + slugify(it.producto);
      it._id = baseId + "-" + Math.random().toString(16).slice(2,6);

      const card = document.createElement("div");
      card.className = "item" + (it.disponibilidad === "NO" ? " muted" : "");
      card.id = it._id;

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

  buildSideNav(grouped);
  filterSideNav();
}

/* =========================
   Load CSV
========================= */
async function load(){
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const csvText = await res.text();

  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data || [];

      RAW = data.map(r => {
        const producto = normText(r.producto);
        const categoria = normText(r.categoria);

        return {
          categoria,
          producto,
          unidad: normText(r.unidad),
          precio_raw: r.precio,
          precio_num: parsePrecio(r.precio),
          disponibilidad: normDisponibilidad(r.disponibilidad),

          // claves normalizadas para búsqueda inteligente
          producto_fold: fold(producto),
          categoria_fold: fold(categoria),
        };
      });

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
   Init
========================= */
ensureSideNav();

elBuscador?.addEventListener("input", render);
elToggleNo?.addEventListener("change", render);

load();
