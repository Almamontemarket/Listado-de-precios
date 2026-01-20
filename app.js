const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRot1AcxBJqPKUFTIHwKbMa7Bf_Z9p2QzgEBy5uBzo2-uCxKci8cmy0NuYJRbS980YkH3IR9Lnrm1nI/pub?gid=0&single=true&output=csv";

const elContenedor = document.getElementById("contenedor");
const elBuscador = document.getElementById("buscador");
const elToggleNo = document.getElementById("toggleNoStock");
const elCount = document.getElementById("count");
const elUpdated = document.getElementById("updated");

const elNavCats = document.getElementById("navCats");
const elNavSearch = document.getElementById("navSearch");

let RAW = [];

// ====== NUEVO: filtro de categorías (drawer) ======
let ALL_CATS = [];              // array de keys (lowercase)
let selectedCats = new Set();   // keys seleccionadas

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

// key estable para comparar categorías
function catKey(cat){
  return normText(cat).toLowerCase();
}

function setAllCatsFromRaw(){
  const set = new Set();
  for (const r of RAW){
    if (r.categoria) set.add(catKey(r.categoria));
  }
  ALL_CATS = [...set].sort((a,b)=>a.localeCompare(b, "es"));
}

function selectAllCats(){
  selectedCats = new Set(ALL_CATS);
}

function updateAllCheckboxState(){
  const allBox = document.getElementById("navAll");
  if (!allBox) return;

  const selCount = selectedCats.size;
  const total = ALL_CATS.length;

  // checked si todas
  allBox.checked = (selCount === total);

  // indeterminate si algunas
  allBox.indeterminate = (selCount > 0 && selCount < total);
}

// ====== Drawer (categorías + ALL) ======
function buildSideNav(grouped){
  if (!elNavCats) return;
  elNavCats.innerHTML = "";

  // ----- fila ALL -----
  const allRow = document.createElement("div");
  allRow.className = "navall";

  const allLeft = document.createElement("div");
  allLeft.className = "navall__left";

  const allCb = document.createElement("input");
  allCb.type = "checkbox";
  allCb.id = "navAll";
  allCb.className = "navall__check";

  const allLbl = document.createElement("label");
  allLbl.htmlFor = "navAll";
  allLbl.className = "navall__name";
  allLbl.textContent = "ALL";

  allLeft.appendChild(allCb);
  allLeft.appendChild(allLbl);

  const allRight = document.createElement("div");
  allRight.className = "navall__hint";
  allRight.textContent = "Mostrar todo";

  allRow.appendChild(allLeft);
  allRow.appendChild(allRight);

  elNavCats.appendChild(allRow);

  // comportamiento ALL
  allCb.addEventListener("change", () => {
    if (allCb.checked){
      selectAllCats();
    } else {
      // si desmarca ALL, dejamos TODO desmarcado (no muestra nada) -> más lógico en UI.
      selectedCats.clear();
    }
    updateAllCheckboxState();
    render();
  });

  // ----- categorías -----
  for (const [cat, items] of grouped){
    const catId = "cat-" + slugify(cat);
    const key = catKey(cat);

    const box = document.createElement("div");
    box.className = "navcat";
    box.dataset.cat = key;

    const head = document.createElement("div");
    head.className = "navcat__head";
    head.addEventListener("click", () => {
      box.classList.toggle("is-open");
      const sec = document.getElementById(catId);
      if (sec) sec.scrollIntoView({ behavior:"smooth", block:"start" });
    });

    const left = document.createElement("div");
    left.className = "navcat__left";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "navcat__check";
    check.checked = selectedCats.has(key);

    // importantísimo: que no dispare el toggle de abrir/cerrar
    check.addEventListener("click", (e) => e.stopPropagation());
    check.addEventListener("change", () => {
      if (check.checked) selectedCats.add(key);
      else selectedCats.delete(key);

      updateAllCheckboxState();
      render();
    });

    const name = document.createElement("div");
    name.className = "navcat__name";
    name.textContent = cat;

    left.appendChild(check);
    left.appendChild(name);

    const count = document.createElement("div");
    count.className = "navcat__count";
    count.textContent = items.length;

    head.appendChild(left);
    head.appendChild(count);

    const list = document.createElement("div");
    list.className = "navcat__list";

    for (const it of items){
      const row = document.createElement("div");
      row.className = "navitem";
      row.dataset.prod = (it.producto || "").toLowerCase();

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

  updateAllCheckboxState();
}

function filterSideNav(){
  if (!elNavCats || !elNavSearch) return;

  const q = normText(elNavSearch.value).toLowerCase();
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

// ====== Render principal ======
function render(){
  const q = normText(elBuscador?.value).toLowerCase();
  const showNo = !!elToggleNo?.checked;

  let rows = RAW
    .filter(r => r.categoria && r.producto)
    .filter(r => showNo ? true : r.disponibilidad !== "NO")
    .filter(r => !q ? true : (r.producto.toLowerCase().includes(q)));

  // NUEVO: filtro por categorías seleccionadas
  // Si selectedCats está vacío -> no mostrar nada (coherente con ALL desmarcado)
  if (selectedCats.size > 0){
    rows = rows.filter(r => selectedCats.has(catKey(r.categoria)));
  } else {
    rows = [];
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
        <div style="padding:16px;color:var(--muted)">Prueba con otra búsqueda, muestra NO disponibles o marca ALL en categorías.</div>
      </div>`;

    // aunque no haya resultados, el drawer se arma desde RAW (no desde rows)
    const groupedAll = groupByCategoria(RAW.filter(r => r.categoria && r.producto));
    buildSideNav(groupedAll);
    filterSideNav();
    return;
  }

  // render de secciones (colapsables)
  for (const [cat, items] of grouped){
    items.sort((a,b)=>a.producto.localeCompare(b.producto, "es"));
    const catId = "cat-" + slugify(cat);

    const section = document.createElement("section");
    section.className = "section is-collapsed"; // <-- por defecto “achicada”
    section.id = catId;

    const head = document.createElement("div");
    head.className = "section__head section__head--collapsible";
    head.addEventListener("click", () => {
      section.classList.toggle("is-collapsed");
    });

    const title = document.createElement("h3");
    title.className = "section__title";
    title.textContent = cat;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${items.length}`;

    const chev = document.createElement("span");
    chev.className = "secChevron";
    chev.setAttribute("aria-hidden", "true");

    head.appendChild(title);
    head.appendChild(badge);
    head.appendChild(chev);

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
      left.appendChild(unit);

      const price = document.createElement("div");
      price.className = "item__price";
      price.innerHTML = Number.isFinite(it.precio_num)
        ? `$ ${formatoCLP(it.precio_num)} <small>CLP</small>`
        : `-`;

      top.appendChild(left);
      top.appendChild(price);

      card.appendChild(top);
      grid.appendChild(card);
    }

    section.appendChild(head);
    section.appendChild(grid);
    elContenedor.appendChild(section);
  }

  // drawer se arma desde RAW (para que siempre estén todas las categorías)
  const groupedAll = groupByCategoria(RAW.filter(r => r.categoria && r.producto));
  buildSideNav(groupedAll);
  filterSideNav();
}

// ====== Carga CSV ======
async function load(){
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const text = await res.text();

  // papa parse simple (sin lib) porque el CSV de Sheets es "normal"
  // (si usas PapaParse, puedes reemplazar esto por Papa.parse)
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim().toLowerCase());

  const idxCat = headers.indexOf("categoria");
  const idxProd = headers.indexOf("producto");
  const idxUni = headers.indexOf("unidad");
  const idxPre = headers.indexOf("precio");
  const idxDis = headers.indexOf("disponible");

  RAW = lines.map(line => {
    // split CSV simple; si tu CSV tiene comillas/commas internas, avísame y lo pasamos a PapaParse
    const cols = line.split(",");
    const categoria = normText(cols[idxCat]);
    const producto = normText(cols[idxProd]);
    const unidad = normText(cols[idxUni]);
    const precio_num = parsePrecio(cols[idxPre]);
    const disponibilidad = normDisponibilidad(cols[idxDis]);

    return { categoria, producto, unidad, precio_num, disponibilidad };
  });

  // timestamp
  if (elUpdated){
    const now = new Date();
    elUpdated.textContent = `Última carga: ${now.toLocaleString("es-CL")}`;
  }

  // init cats
  setAllCatsFromRaw();
  selectAllCats();          // <-- ALL por defecto seleccionado
  render();
}

// ====== eventos ======
elBuscador?.addEventListener("input", render);
elToggleNo?.addEventListener("change", render);
elNavSearch?.addEventListener("input", filterSideNav);

load().catch(err => {
  console.error(err);
  elContenedor.innerHTML = `<div class="section"><div style="padding:16px">Error cargando datos.</div></div>`;
});
