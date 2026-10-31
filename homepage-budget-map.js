/* Homepage map of Czech municipal budgets, 2021–2025. The page owns layout, copy and
 * accounting semantics; PSDPlot draws the choropleth. Every value is a PSD calculation
 * from the published dataset /data/czech-municipal-budget-map.v1.json. */
(() => {
  const root = document.querySelector("#home-budget-map-root");
  if (!root) return;
  const DATA_URL = "/data/czech-municipal-budget-map.v1.json";
  const METRICS = ["o", "k", "f", "m"];
  const BINS = { o: [-.10, 0, .10, .20, .30, .40], k: [2500, 5000, 7500, 10000, 15000, 25000], f: [-.10, -.05, 0, .05, .10, .20], m: [2, 4, 6, 10, 15, 24] };
  const SIZES = [5000, 20000, 1000, 0];
  const SOURCES = [
    "https://monitor.statnipokladna.gov.cz/datovy-katalog/transakcni-data",
    "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer",
    "https://data.csu.gov.cz/datastat/info/SADA/OBY01B01",
  ];
  const copy = {
    en: {
      kicker: "Czechia / 6,254 municipalities", title: "Best and worst municipal budgets",
      lede: "Operating balance, investment, overall result and cash reserves for every Czech municipality, 2021–2025. Hover or tap a municipality; search finds one by name.",
      loading: "Loading the municipal map…", failed: "The municipal map could not be loaded.",
      find: "Find a municipality", size: "Rank municipalities with", anySize: "any size", residents: "residents",
      metrics: { o: "Operating 2021–25", k: "Investment 2021–25", f: "Overall 2021–25", m: "Cash reserves" },
      key: { o: "Operating balance 2021–25, share of current revenue", k: "Capital spending a year per resident, 2021–25 average", f: "Overall result 2021–25, share of revenue", m: "Cash reserves, months of 2025 spending" },
      best: { o: "Largest operating surplus", k: "Most investment", f: "Largest surplus", m: "Largest reserves" },
      worst: { o: "Smallest operating surplus", k: "Least investment", f: "Largest deficit", m: "Smallest reserves" },
      amount: { m: "Cash at 31 Dec 2025" },
      ledger: ["2021–25 budget", "Operating balance", "Capital spending", "Capital revenue and investment grants", "Overall result"],
      ranked: n => `${n} ranked`, missing: "No municipal budget", open: "Open budget →",
      perResident: "CZK", months: "mo", surplus: "in surplus", deficit: "in deficit", median: "median",
      medianPerResident: "median per resident a year", bottom: "bottom decile", top: "top decile", under2: "under 2 months", over24: "over 2 years",
      note: {
        o: "Operating balance = current revenue minus current spending (class 5), as a share of current revenue. Current revenue is taxes, non-tax revenue and operating grants (items 41xx); capital revenue, investment grants (42xx) and capital spending (class 6) are left out. Loan repayments are financing and are not subtracted. Summed over 2021–2025.",
        k: "Capital spending (class 6) summed over 2021–2025, divided by five and by the average mid-year population. Neither good nor bad on its own: it follows grants won, one-off projects and existing infrastructure. Small municipalities swing the most.",
        f: "Overall result = revenue minus spending after consolidation, investment included, summed over 2021–2025 and divided by five-year revenue. A deficit often means a town spent savings on investment; read it with the operating and investment views.",
        m: "Cash on the municipality’s bank and treasury accounts at the end of 2025 divided by 2025 spending, times twelve. Cash of municipal contributory organisations is excluded.",
      },
      calculation: "PSD calculation from published warehouse releases.",
      sources: ["MONITOR, Ministry of Finance: FIN 2-12 M 2021–2025, grants by type from FINM201 class 4 items", "ČÚZK RÚIAN municipality boundaries, simplified to 180 m", "ČSÚ population at 1 July"],
      columns: { name: "Municipality", ico: "IČO", region: "Region", population: "Population" },
    },
    cs: {
      kicker: "Česko / 6 254 obcí", title: "Nejlepší a nejhorší rozpočty obcí",
      lede: "Provozní saldo, investice, celkové saldo a hotovostní rezervy všech českých obcí za roky 2021–2025. Najeďte na obec nebo na ni klepněte; vyhledávání ji najde podle názvu.",
      loading: "Načítám mapu obcí…", failed: "Mapu obcí se nepodařilo načíst.",
      find: "Najít obec", size: "Pořadí obcí s", anySize: "všech velikostí", residents: "obyvatel",
      metrics: { o: "Provoz 2021–25", k: "Investice 2021–25", f: "Celkem 2021–25", m: "Hotovostní rezervy" },
      key: { o: "Provozní saldo 2021–25, podíl na běžných příjmech", k: "Kapitálové výdaje ročně na obyvatele, průměr 2021–25", f: "Celkové saldo 2021–25, podíl na příjmech", m: "Rezervy, měsíce výdajů 2025" },
      best: { o: "Nejvyšší provozní přebytek", k: "Nejvíc investic", f: "Nejvyšší přebytek", m: "Nejvyšší rezervy" },
      worst: { o: "Nejnižší provozní přebytek", k: "Nejméně investic", f: "Nejvyšší schodek", m: "Nejnižší rezervy" },
      amount: { m: "Peníze k 31. 12. 2025" },
      ledger: ["Rozpočet 2021–25", "Provozní saldo", "Kapitálové výdaje", "Kapitálové příjmy a investiční dotace", "Celkové saldo"],
      ranked: n => `${n} v pořadí`, missing: "Bez obecního rozpočtu", open: "Otevřít rozpočet →",
      perResident: "Kč", months: "měs.", surplus: "s přebytkem", deficit: "se schodkem", median: "medián",
      medianPerResident: "medián na obyvatele ročně", bottom: "dolní decil", top: "horní decil", under2: "pod 2 měs.", over24: "nad 2 roky",
      note: {
        o: "Provozní saldo = běžné příjmy minus běžné výdaje (třída 5) jako podíl na běžných příjmech. Běžné příjmy jsou daně, nedaňové příjmy a neinvestiční dotace (položky 41xx); kapitálové příjmy, investiční dotace (42xx) a kapitálové výdaje (třída 6) nejsou započteny. Splátky úvěrů jsou financováním a odečteny nejsou. Sečteno za roky 2021–2025.",
        k: "Kapitálové výdaje (třída 6) za roky 2021–2025 vydělené pěti a průměrným počtem obyvatel. Samo o sobě není dobré ani špatné: odráží získané dotace, jednorázové stavby a stav infrastruktury. Nejvíc kolísají malé obce.",
        f: "Celkové saldo = příjmy minus výdaje po konsolidaci včetně investic, sečtené za roky 2021–2025 a vydělené pětiletými příjmy. Schodek často znamená, že obec investovala z úspor; čtěte ho spolu s provozním a investičním pohledem.",
        m: "Peníze na bankovních a státních účtech obce na konci roku 2025 vydělené výdaji 2025, krát dvanáct. Bez peněz příspěvkových organizací obce.",
      },
      calculation: "Výpočet PSD z publikovaných vydání skladu.",
      sources: ["MONITOR, Ministerstvo financí: FIN 2-12 M 2021–2025, dotace podle druhu z položek třídy 4 FINM201", "ČÚZK RÚIAN hranice obcí, zjednodušené na 180 m", "ČSÚ počet obyvatel k 1. 7."],
      columns: { name: "Obec", ico: "IČO", region: "Kraj", population: "Obyvatel" },
    },
  };
  const state = { lang: window.PSDLanguage?.current?.() === "en" || document.documentElement.lang === "en" ? "en" : "cs", metric: "o", minPop: 5000, data: null, chart: null, pinned: null };
  const t = () => copy[state.lang];
  const loc = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (value, digits = 0) => value.toLocaleString(loc(), { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const pct = value => `${value > 0 ? "+" : value < 0 ? "−" : ""}${num(Math.abs(value * 100), 1)} %`;
  const months = value => `${num(value, 1)} ${t().months}`;
  const format = (value, metric = state.metric) => value == null ? "—" : metric === "m" ? months(value) : metric === "k" ? `${num(Math.round(value))} ${t().perResident}` : pct(value);
  function czk(value) {
    if (value == null) return "—";
    const abs = Math.abs(value), sign = value < 0 ? "−" : "", cs = state.lang === "cs";
    if (abs >= 1e9) return `${sign}${num(abs / 1e9, 1)} ${cs ? "mld. Kč" : "bn CZK"}`;
    if (abs >= 1e6) return `${sign}${num(abs / 1e6, 1)} ${cs ? "mil. Kč" : "m CZK"}`;
    return `${sign}${num(Math.round(abs / 1e3))} ${cs ? "tis. Kč" : "k CZK"}`;
  }
  const signed = value => value == null ? "—" : `${value > 0 ? "+" : ""}${czk(value)}`;
  const legendFormat = value => state.metric === "k" ? num(value / 1000, value % 1000 ? 1 : 0) + (state.lang === "cs" ? " tis." : "k") : state.metric === "m" ? num(value) : `${value > 0 ? "+" : value < 0 ? "−" : ""}${num(Math.abs(value * 100))}`;
  const region = name => String(name || "").replace(" kraj", "").replace("Kraj ", "");
  const byCode = () => new Map(state.data.municipalities.map(row => [row.c, row]));
  const budgetHref = row => `${row.s}?lang=${state.lang}`;

  function ranked() {
    return state.data.municipalities.filter(row => row[state.metric] != null).sort((a, b) => b[state.metric] - a[state.metric]);
  }
  function spec() {
    const rows = state.data.municipalities, c = t();
    return {
      type: "choropleth", title: `${c.title} — ${c.key[state.metric]}`, locale: loc(), viewBox: state.data.viewBox,
      ramp: state.metric === "k" ? "sequential" : "diverging", bins: BINS[state.metric], legendFormat,
      labels: { missing: c.missing },
      areas: rows.map(row => ({ id: row.c, path: row.d, value: row[state.metric], row })),
      context: { outline: state.data.state, regions: state.data.regions.map(item => item.d), empty: state.data.unbudgeted.map(item => ({ path: item.d, label: item.n })) },
      order: ranked().map(row => row.c),
      tooltip: ({ row }) => ({
        title: row.n, meta: `${row.r} · ${row.p ? `${num(row.p)} ${c.residents}` : ""}`,
        value: format(row[state.metric]), valueLabel: c.key[state.metric],
        linesTitle: c.ledger[0],
        lines: [
          // The other views' amounts are already ledger lines.
          ...(state.metric === "m" ? [{ label: c.amount.m, value: czk(row.cc) }] : []),
          { label: c.ledger[1], value: signed(row.ob) }, { label: c.ledger[2], value: signed(row.cx == null ? null : -row.cx) },
          { label: c.ledger[3], value: signed(row.cf) }, { label: c.ledger[4], value: signed(row.fb), total: true },
        ],
        link: { href: budgetHref(row), label: c.open },
      }),
      onSelect: area => { state.pinned = area ? area.row : null; markRows(); },
      onInspect: area => markRows(area?.row),
      tableColumns: [
        { key: "name", label: c.columns.name }, { key: "ico", label: c.columns.ico }, { key: "region", label: c.columns.region },
        { key: "population", label: c.columns.population, numeric: true },
        { key: "o", label: `${c.metrics.o} (%)`, numeric: true }, { key: "k", label: `${c.metrics.k} (CZK / ${c.residents})`, numeric: true },
        { key: "f", label: `${c.metrics.f} (%)`, numeric: true }, { key: "m", label: `${c.metrics.m} (${c.months})`, numeric: true },
        { key: "operating", label: `${c.ledger[1]} (CZK)`, numeric: true }, { key: "capital", label: `${c.ledger[2]} (CZK)`, numeric: true },
        { key: "funding", label: `${c.ledger[3]} (CZK)`, numeric: true }, { key: "overall", label: `${c.ledger[4]} (CZK)`, numeric: true },
      ],
      // Every municipality, ranked by the selected measure; missing values stay empty, last.
      tableRows: () => ranked().concat(rows.filter(row => row[state.metric] == null)).map(row => ({
        name: row.n, ico: row.i, region: row.r, population: row.p,
        o: row.o == null ? null : Math.round(row.o * 1000) / 10, k: row.k, f: row.f == null ? null : Math.round(row.f * 1000) / 10, m: row.m,
        operating: row.ob, capital: row.cx, funding: row.cf, overall: row.fb,
      })),
    };
  }

  function stats() {
    const c = t(), values = ranked().map(row => row[state.metric]).reverse();
    const at = share => values[Math.min(values.length - 1, Math.floor(values.length * share))];
    const items = state.metric === "k" ? [[format(at(.5)), c.medianPerResident], [format(at(.1)), c.bottom], [format(at(.9)), c.top]]
      : state.metric === "m" ? [[num(values.filter(v => v < 2).length), c.under2], [num(values.filter(v => v >= 24).length), c.over24], [months(at(.5)), c.median]]
      : [[num(values.filter(v => v > 0).length), c.surplus], [num(values.filter(v => v < 0).length), c.deficit], [pct(at(.5)), c.median]];
    return items.map(([value, label]) => `<span><b>${esc(value)}</b> ${esc(label)}</span>`).join("");
  }
  function rowHTML(row, index, max) {
    const value = row[state.metric], width = Math.min(100, Math.abs(value) / max * 100);
    let bin = 0; while (bin < BINS[state.metric].length && value >= BINS[state.metric][bin]) bin++;
    return `<li><button type="button" data-code="${row.c}"><span class="home-budget-map-rank">${index + 1}</span><span class="home-budget-map-name">${esc(row.n)}<small>${esc(region(row.r))} · ${esc(num(row.p || 0))}</small></span><span class="home-budget-map-bar"><i class="b${bin}" style="width:${width}%"></i></span><span class="home-budget-map-value">${esc(format(value))}</span></button></li>`;
  }
  function lists() {
    const c = t(), pool = ranked().filter(row => (row.p || 0) >= state.minPop);
    const best = pool.slice(0, 10), worst = pool.slice(-10).reverse();
    const max = Math.max(...best.concat(worst).map(row => Math.abs(row[state.metric]))) || 1;
    root.querySelector("[data-list=best]").innerHTML = best.map((row, i) => rowHTML(row, i, max)).join("");
    root.querySelector("[data-list=worst]").innerHTML = worst.map((row, i) => rowHTML(row, i, max)).join("");
    root.querySelector("[data-title=best]").textContent = c.best[state.metric];
    root.querySelector("[data-title=worst]").textContent = c.worst[state.metric];
    root.querySelectorAll("[data-count]").forEach(node => { node.textContent = c.ranked(num(pool.length)); });
    markRows();
  }
  function markRows(inspected) {
    const code = (inspected || state.pinned)?.c;
    root.querySelectorAll(".home-budget-map-lists button").forEach(node => node.classList.toggle("is-active", Number(node.dataset.code) === code));
  }
  function paintCopy() {
    const c = t();
    root.querySelector(".home-budget-map-switch").innerHTML = METRICS.map(key => `<button type="button" data-metric="${key}" aria-pressed="${key === state.metric}">${esc(c.metrics[key])}</button>`).join("");
    root.querySelector(".home-budget-map-stats").innerHTML = `${stats()}<span>${esc(c.key[state.metric])}</span>`;
    // List bars reuse the map's ramp swatches from shared-charts.css.
    root.querySelector(".home-budget-map-lists").dataset.ramp = state.metric === "k" ? "sequential" : "diverging";
    root.querySelector(".home-budget-map-note").textContent = `${c.note[state.metric]} ${c.calculation}`;
    lists();
  }
  function shell() {
    const c = t();
    root.innerHTML = `<div class="compact-title"><div><span class="kicker">${esc(c.kicker)}</span><h2>${esc(c.title)}</h2></div><p>${esc(c.lede)}</p></div>
      <article class="home-budget-map-object" data-psd-chart="home-cz-municipal-budget-map">
        <div class="home-budget-map-controls"><div class="home-budget-map-switch" role="group" aria-label="${esc(c.title)}"></div>
          <div class="home-budget-map-find"><input type="search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="home-budget-map-options" aria-autocomplete="list" placeholder="${esc(c.find)}" aria-label="${esc(c.find)}"><ul id="home-budget-map-options" role="listbox" hidden></ul></div></div>
        <div class="home-budget-map-grid"><div class="home-budget-map-plot"><div class="home-budget-map-chart"></div><div class="home-budget-map-stats"></div></div>
          <div class="home-budget-map-lists psd-choropleth"><label class="home-budget-map-size"><span>${esc(c.size)}</span><select>${SIZES.map(size => `<option value="${size}"${size === state.minPop ? " selected" : ""}>${size ? `${esc(num(size))}+ ${esc(c.residents)}` : esc(c.anySize)}</option>`).join("")}</select></label>
            <section><h3><span data-title="best"></span><small data-count></small></h3><ol data-list="best"></ol></section>
            <section><h3><span data-title="worst"></span><small data-count></small></h3><ol data-list="worst"></ol></section></div></div>
        <p class="home-budget-map-note"></p>
        <ol class="home-budget-map-sources">${c.sources.map((source, i) => `<li>[${i + 1}] <a href="${SOURCES[i]}" target="_blank" rel="noreferrer">${esc(source)} ↗</a></li>`).join("")}</ol>
      </article>`;
    bind();
  }
  function register() {
    if (!window.PSDChart || !state.chart) return;
    const c = t();
    window.PSDChart.register({
      slug: "home-cz-municipal-budget-map", el: root.querySelector(`[data-psd-chart="home-cz-municipal-budget-map"]`),
      title: () => t().title,
      accessor: () => state.chart.accessor,
      source: { name: c.sources[0], url: SOURCES[0], edition: `PSD ${state.data.dataset_id} · ${state.data.releases.history.slice(0, 8)} / ${state.data.releases.transfers.slice(0, 8)}`, definition: `${c.note.o} ${c.calculation}`, vintage: "outturn" },
    });
  }
  function draw() {
    if (state.chart) { state.chart.update(spec()); paintCopy(); return; }
    state.chart = window.PSDPlot.render(root.querySelector(".home-budget-map-chart"), spec());
    paintCopy();
    register();
  }
  function rerender() {
    state.chart?.destroy(); state.chart = null; state.pinned = null;
    shell(); draw();
  }

  function bind() {
    const input = root.querySelector(".home-budget-map-find input"), options = root.querySelector("#home-budget-map-options");
    const fold = text => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let hits = [], selected = -1;
    const close = () => { options.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
    const paint = () => {
      options.innerHTML = hits.map((row, i) => `<li role="option" id="home-budget-map-option-${i}" aria-selected="${i === selected}" data-code="${row.c}"><span>${esc(row.n)}</span><small>${esc(region(row.r))}</small></li>`).join("");
      options.hidden = !hits.length; input.setAttribute("aria-expanded", String(Boolean(hits.length)));
      if (selected >= 0) input.setAttribute("aria-activedescendant", `home-budget-map-option-${selected}`);
    };
    const pick = row => { close(); input.value = row.n; state.chart.select(row.c); };
    input.addEventListener("input", () => {
      const query = fold(input.value.trim()); selected = -1;
      hits = query.length < 2 ? [] : state.data.municipalities.filter(row => fold(row.n).includes(query))
        .sort((a, b) => (fold(b.n).startsWith(query) - fold(a.n).startsWith(query)) || ((b.p || 0) - (a.p || 0))).slice(0, 8);
      paint();
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") { close(); return; }
      if (!hits.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length; paint(); }
      else if (event.key === "Enter") { event.preventDefault(); pick(hits[Math.max(selected, 0)]); }
    });
    options.addEventListener("click", event => { const item = event.target.closest("[data-code]"); if (item) pick(byCode().get(Number(item.dataset.code))); });
    root.querySelector(".home-budget-map-switch").addEventListener("click", event => {
      const button = event.target.closest("[data-metric]"); if (!button || button.dataset.metric === state.metric) return;
      state.metric = button.dataset.metric; draw();
    });
    root.querySelector(".home-budget-map-size select").addEventListener("change", event => { state.minPop = Number(event.target.value); lists(); });
    const listsNode = root.querySelector(".home-budget-map-lists");
    listsNode.addEventListener("click", event => { const button = event.target.closest("button[data-code]"); if (button) state.chart.select(Number(button.dataset.code)); });
    listsNode.addEventListener("pointerover", event => { const button = event.target.closest("button[data-code]"); if (button) state.chart.inspect(Number(button.dataset.code)); });
    listsNode.addEventListener("focusin", event => { const button = event.target.closest("button[data-code]"); if (button) state.chart.inspect(Number(button.dataset.code)); });
    listsNode.addEventListener("pointerleave", () => state.chart.inspect(null));
  }

  async function load() {
    root.innerHTML = `<p class="home-budget-map-loading">${esc(t().loading)}</p>`;
    try {
      const [response] = await Promise.all([fetch(DATA_URL), window.PSDPlotReady]);
      if (!response.ok) throw new Error(`Municipal map HTTP ${response.status}`);
      state.data = await response.json();
      if (state.data.schema_version !== 1) throw new Error("Unsupported municipal map contract");
      shell(); draw();
    } catch (error) {
      console.error(error);
      root.innerHTML = `<p class="home-budget-map-loading">${esc(t().failed)}</p>`;
    }
  }
  addEventListener("psdlanguagechange", event => {
    state.lang = event.detail?.lang === "en" ? "en" : "cs";
    if (state.data) rerender(); else if (!state.started) root.querySelector(".home-budget-map-loading")?.replaceChildren(t().loading);
  });
  // The dataset is about 800 kB gzipped: fetch it only when the section approaches the viewport.
  const start = () => { if (state.started) return; state.started = true; load(); };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); } }, { rootMargin: "600px 0px" });
    observer.observe(root);
  } else start();
})();
