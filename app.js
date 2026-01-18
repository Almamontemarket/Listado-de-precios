const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRot1AcxBJqPKUFTIHwKbMa7Bf_Z9p2QzgEBy5uBzo2-uCxKci8cmy0NuYJRbS980YkH3IR9Lnrm1nI/pub?gid=0&single=true&output=csv";

const elContenedor = document.getElementById("contenedor");
const elBuscador = document.getElementById("buscador");
const elToggleNo = document.getElementById("toggleNoStock");
const elCount = document.getElementById("count");
const elUpdated = document.getElementById("updated");
const elNavCats = document.getElementById("navCats");
const elNavSearch = document.getElementById("navSearch");


let RAW = [];

function normText(s){
  return (s ?? "").toString().trim();
}

function normDisponibilidad(s){
  const v = normText(s).toUpperCase();
  if (!v) return "SI";
  // acepta: SI/NO, TRUE/FALSE, 1/0, DISPONIBLE/NO DISPONIBLE
  if (["NO","FALSE","0","N"].includes(v)) return "NO";
  return "SI";
}

function parsePrecio(x){
  // acepta "7.390", "7390", "7,390", "$ 7.390"
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
  // orden alfabético de categorías
  return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0], "es"));
}

function slugify(str){
  return normText(str)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
}

function buildSideNav(grouped){
  // grouped = [ [cat, items], ... ]
  elNavCats.innerHTML = "";

  for (const [cat, items] of grouped){
    const catId = "cat-" + slugify(cat);

    const box = document.createElement("div");
    box.className = "navcat";
    box.dataset.cat = cat.toLowerCase();

    const head = document.createElement("div");
    head.className = "navcat__head";
    head.addEventListener("click", () => {
      box.classList.toggle("is-open");
      // al click en el encabezado, también hace scroll a la sección
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

    // productos dentro (colapsado por defecto)
    for (const it of items){
      const row = document.createElement("div");
      row.className = "navitem";
      row.dataset.prod = it.producto.toLowerCase();
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

    // si la categoría coincide, la mostramos aunque no haya match exacto en items
    const catOk = !q || catName.includes(q) || anyItem;
    c.style.display = catOk ? "" : "none";

    // abre automáticamente si hay búsqueda y hay match
    if (q && catOk) c.classList.add("is-open");
    if (!q) c.classList.remove("is-open");
  }
}


function render(){
  const q = normText(elBuscador.value).toLowerCase();
  const showNo = elToggleNo.checked;

  let rows = RAW
    .filter(r => r.categoria && r.producto)
    .filter(r => showNo ? true : r.disponibilidad !== "NO")
    .filter(r => !q ? true : (r.producto.toLowerCase().includes(q)));

  const grouped = groupByCategoria(rows);

  // contador
  const totalItems = rows.length;
  const totalCats = grouped.length;
  elCount.textContent = `${totalCats} categorías · ${totalItems} productos`;

  elContenedor.innerHTML = "";

  if (grouped.length === 0){
    elContenedor.innerHTML = `<div class="section"><div class="section__head"><h3 class="section__title">Sin resultados</h3></div><div style="padding:16px;color:var(--muted)">Prueba con otra búsqueda o muestra NO disponibles.</div></div>`;
    return;
  }

  for (const [cat, items] of grouped){
    // orden dentro de cada categoría
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
}

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
        disponibilidad: normDisponibilidad(r.disponibilidad ?? r.disponibilidad ?? r.disponibilidad),
      }));

      // timestamp simple (del navegador)
      const now = new Date();
      elUpdated.textContent = `Última carga: ${now.toLocaleString("es-CL")}`;

      render();
    },
    error: () => {
      elContenedor.innerHTML = `<div class="section"><div class="section__head"><h3 class="section__title">Error</h3></div><div style="padding:16px;color:var(--muted)">No se pudo leer el CSV.</div></div>`;
    }
  });
}

elBuscador.addEventListener("input", render);
elToggleNo.addEventListener("change", render);

load();
