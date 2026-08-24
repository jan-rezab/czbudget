const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = value => new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 0}).format(value);
const money = value => value == null ? "—" : new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 0, maximumFractionDigits: 1}).format(value);
const percent = value => value == null ? "—" : `${new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value)} %`;
const billion = value => new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value / 1000);

function enterpriseRows(rows, metric, kind) {
  const maximum = Math.max(...rows.map(row => Math.abs(row.metrics[metric])));
  return rows.map((row, index) => {
    const value = row.metrics[metric];
    const rowKind = value < 0 ? "loss" : kind;
    const secondary = metric === "total_assets"
      ? `Výsledek ${valueLabel(row.metrics.net_result, true)} · ${number(row.metrics.employees)} zaměstnanců`
      : `Aktiva ${number(row.metrics.total_assets)} mil. Kč · obrat ${number(row.metrics.turnover)} mil. Kč`;
    return `<article class="enterprise-row ${rowKind}">
      <span class="enterprise-rank">${String(index + 1).padStart(2, "0")}</span>
      <div class="enterprise-name"><strong>${esc(row.name)}</strong><small>${esc(row.classification?.sector_name)} · IČO ${esc(row.ico)}</small></div>
      <div class="enterprise-bar" aria-hidden="true"><i style="width:${(Math.abs(value) / maximum * 100).toFixed(1)}%"></i></div>
      <strong class="enterprise-value">${valueLabel(value, metric === "net_result")}<small>mil. Kč</small></strong>
      <p>${secondary}</p>
    </article>`;
  }).join("");
}

function valueLabel(value, signed = false) {
  if (value < 0) return `−${number(Math.abs(value))}`;
  return `${signed ? "+" : ""}${number(value)}`;
}

function returnChart(rows) {
  const maximum = Math.max(...rows.map(row => row.value));
  return rows.map(row => `<div class="return-row">
    <span>${String(row.rank).padStart(2, "0")}</span>
    <strong>${esc(row.name)}</strong>
    <div><i style="width:${(row.value / maximum * 100).toFixed(1)}%"></i></div>
    <b>${number(row.value)} <small>mil. Kč</small></b>
  </div>`).join("");
}

function renderPublicRegistry(data) {
  const search = $("#entity-search");
  const owner = $("#entity-owner");
  const sort = $("#entity-sort");
  const body = $("#public-entity-rows");
  const tabs = [...document.querySelectorAll("#entity-tabs button")];
  let activeCategory = "all";
  const owners = [...new Set(data.entities.map(row => row.owner_level))].sort((a, b) => a.localeCompare(b, "cs"));
  owner.insertAdjacentHTML("beforeend", owners.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));

  const tabCounts = {all: "#tab-all", Firma: "#tab-companies", "Vysoká škola": "#tab-universities", Nemocnice: "#tab-hospitals", "Zdravotní pojišťovna": "#tab-health-insurers"};
  Object.entries(tabCounts).forEach(([key, selector]) => {
    const group = data.summary.groups[key];
    $(selector).textContent = `${number(group.entity_count)} · ${number(group.financial_result_count)} s výsledkem`;
  });

  function updateSummary() {
    const group = data.summary.groups[activeCategory];
    const label = activeCategory === "all" ? "všechny subjekty" : activeCategory === "Firma" ? "firmy" : activeCategory === "Vysoká škola" ? "vysoké školy" : activeCategory === "Nemocnice" ? "nemocnice" : "zdravotní pojišťovny";
    const hasFinancials = group.financial_result_count > 0;
    $("#profit-sum").textContent = hasFinancials ? billion(group.positive_net_result_sum_mczk) : "—";
    $("#loss-sum").textContent = hasFinancials ? `−${billion(group.negative_net_result_absolute_sum_mczk)}` : "—";
    $("#net-sum").textContent = hasFinancials ? billion(group.net_result_sum_mczk) : "—";
    $("#turnover-sum").textContent = hasFinancials ? billion(group.revenue_sum_mczk) : "—";
    $("#aggregate-scope").textContent = `Součty za ${label}: ${number(group.financial_result_count)} z ${number(group.entity_count)} subjektů s dostupným výsledkem za rok 2024.`;
    $("#registry-coverage").textContent = `${number(group.financial_result_count)} / ${number(group.entity_count)} s výsledkem`;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase("cs");
    const visible = data.entities.filter(row =>
      (activeCategory === "all" || row.category === activeCategory) &&
      (owner.value === "all" || row.owner_level === owner.value) &&
      (!query || `${row.name} ${row.ico}`.toLocaleLowerCase("cs").includes(query))
    );
    visible.sort((a, b) => {
      if (sort.value === "name") return a.name.localeCompare(b.name, "cs");
      const field = sort.value === "result" ? "net_result_mczk" : sort.value === "margin" ? "net_margin_pct" : "value_mczk";
      const left = a.top_line[field];
      const right = b.top_line[field];
      if (left == null && right == null) return a.name.localeCompare(b.name, "cs");
      if (left == null) return 1;
      if (right == null) return -1;
      return right - left || a.name.localeCompare(b.name, "cs");
    });
    body.innerHTML = visible.map(row => `<tr${row.strategic_highlight ? ' class="strategic-highlight"' : ""}>
      <td><strong>${esc(row.name)}</strong><small>IČO ${esc(row.ico)} · ${esc(row.legal_form)}</small></td>
      <td><span class="entity-type">${esc(row.category)}</span></td>
      <td>${esc(row.owner_level)}</td>
      <td class="numeric">${row.top_line.value_mczk == null ? "—" : `${money(row.top_line.value_mczk)} <small>mil. Kč · ${esc(row.top_line.definition)}</small>`}</td>
      <td class="numeric ${row.top_line.net_result_mczk < 0 ? "negative" : ""}">${row.top_line.net_result_mczk == null ? "—" : `${row.top_line.net_result_mczk < 0 ? "−" : "+"}${money(Math.abs(row.top_line.net_result_mczk))} <small>mil. Kč</small>`}</td>
      <td class="numeric ${row.top_line.net_margin_pct < 0 ? "negative" : ""}">${percent(row.top_line.net_margin_pct)}</td>
      <td>${row.financial_source_kind ? `<span class="data-available">${esc(row.financial_source_kind)}</span>` : row.category === "Zdravotní pojišťovna" ? '<span class="data-missing">speciální výkaz mimo VZZ</span>' : '<span class="data-missing">výkaz chybí</span>'}${row.strategic_highlight ? '<small class="highlight-label">TOP 38 highlight</small>' : ""}</td>
    </tr>`).join("");
    $("#registry-count").textContent = `Zobrazeno ${number(visible.length)} z ${number(data.summary.groups[activeCategory].entity_count)} subjektů v záložce`;
  }

  tabs.forEach(tab => tab.addEventListener("click", () => {
    activeCategory = tab.dataset.category;
    tabs.forEach(item => item.setAttribute("aria-selected", String(item === tab)));
    updateSummary();
    render();
  }));
  [search, owner, sort].forEach(control => control.addEventListener(control === search ? "input" : "change", render));
  updateSummary();
  render();
}

function renderPublicHistory(data) {
  const root=$("#public-entity-history-root");
  if (!root) return;
  const entities=[...data.entities].sort((a,b)=>a.name.localeCompare(b.name,"cs"));
  const coverageByYear=new Map();
  data.coverage.forEach(row=>{
    const item=coverageByYear.get(row.year)||{year:row.year,entities:0,financial:0};
    item.entities+=row.entity_count||0;item.financial+=row.financial_count||0;coverageByYear.set(row.year,item);
  });
  root.innerHTML=`<div class="public-history-summary"><article><span>Subjekty s účetní řadou</span><strong>${number(data.summary.entities_with_financial_series)}</strong><small>z ${number(data.summary.entity_count)} v historickém inventáři</small></article><article><span>Doložené účetní roky</span><strong>${number(data.summary.financial_rows)}</strong><small>${data.summary.first_year}–${data.summary.last_year}</small></article><label><span>Vyberte subjekt</span><select id="public-history-entity">${entities.map(row=>`<option value="${esc(row.ico)}">${esc(row.name)} · ${esc(row.ico)}</option>`).join("")}</select></label></div><div class="public-history-grid"><article class="public-history-chart-panel"><header><div><span id="public-history-category">—</span><h3 id="public-history-name">—</h3></div><strong id="public-history-period">—</strong></header><div class="public-history-legend"><span><i class="history-revenue"></i>Výnosy</span><span><i class="history-cost"></i>Náklady</span><span><i class="history-result"></i>Výsledek</span></div><div id="public-history-chart"></div><details><summary>Roční data v tabulce</summary><div><table><thead><tr><th>Rok</th><th>Výnosy</th><th>Náklady</th><th>Výsledek</th><th>Zdroj</th></tr></thead><tbody id="public-history-rows"></tbody></table></div></details></article><aside class="public-history-coverage"><header><span>Pokrytí otevřeného VZZ</span><strong>rok po roku</strong></header><div>${[...coverageByYear.values()].map(row=>{const rate=row.entities?row.financial/row.entities*100:0;return `<div><span>${row.year}</span><i><b style="width:${rate}%"></b></i><strong>${money(rate)} % <small>${row.financial}/${row.entities}</small></strong></div>`}).join("")}</div><p>${esc(data.status)} Chybějící výkaz zůstává prázdný a nevstupuje do součtů.</p></aside></div><div class="public-history-sources"><strong>Zdrojová řada</strong>${data.sources.slice(0,4).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.item)} · ${esc(source.period)} ↗</a>`).join("")}</div>`;
  const select=root.querySelector("#public-history-entity");
  function renderEntity(){
    const entity=entities.find(row=>row.ico===select.value)||entities[0],series=entity.series;
    $("#public-history-name").textContent=entity.name;$("#public-history-category").textContent=`${entity.category} · ${entity.owner_level}`;$("#public-history-period").textContent=`${entity.first_financial_year}–${entity.last_financial_year} · ${series.length} let`;
    const width=820,height=370,left=64,right=20,top=24,bottom=43,values=series.flatMap(row=>[row.revenue_mczk,row.cost_mczk,row.net_result_mczk]).filter(value=>Number.isFinite(value)&&value>=0),maximum=Math.max(...values,1),x=index=>left+(index+.5)*(width-left-right)/series.length,y=value=>top+(maximum-Math.max(0,value))/(maximum)*(height-top-bottom);
    const axisMoney=value=>new Intl.NumberFormat("cs-CZ",{minimumFractionDigits:value>0&&value<1?2:1,maximumFractionDigits:value>0&&value<1?2:1}).format(value);
    const grid=[0,.25,.5,.75,1].map(fraction=>{const value=maximum*(1-fraction),cy=top+(height-top-bottom)*fraction;return `<line x1="${left}" x2="${width-right}" y1="${cy}" y2="${cy}"/><text x="${left-8}" y="${cy+4}" text-anchor="end">${axisMoney(value/1000)}</text>`}).join("");
    const path=field=>series.map((row,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" "),years=series.map((row,index)=>`<text x="${x(index)}" y="${height-17}" text-anchor="middle">${row.year}</text>`).join("");
    $("#public-history-chart").innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Výnosy a náklady subjektu ${esc(entity.name)}"><g class="public-history-gridlines">${grid}${years}<text x="10" y="17">mld. Kč</text></g><path class="public-history-line revenue" d="${path("revenue_mczk")}"/><path class="public-history-line cost" d="${path("cost_mczk")}"/>${series.map((row,index)=>`<circle class="public-history-result-point ${row.net_result_mczk<0?"negative":""}" cx="${x(index)}" cy="${y(row.net_result_mczk)}" r="4"><title>${row.year}: ${money(row.net_result_mczk)} mil. Kč</title></circle>`).join("")}</svg>`;
    $("#public-history-rows").innerHTML=[...series].reverse().map(row=>`<tr><th>${row.year}</th><td>${money(row.revenue_mczk)} mil. Kč</td><td>${money(row.cost_mczk)} mil. Kč</td><td class="${row.net_result_mczk<0?"negative":""}">${row.net_result_mczk<0?"−":"+"}${money(Math.abs(row.net_result_mczk))} mil. Kč</td><td><a href="${esc(row.source_financial)}" target="_blank" rel="noreferrer">VZZ ↗</a></td></tr>`).join("");
  }
  select.addEventListener("change",renderEntity);renderEntity();
}

Promise.all([
  fetch("data/cz-state-enterprises-2024.json?v=20260820-3"),
  fetch("data/cz-public-entities-2024.json?v=20260824-history"),
  fetch("data/cz-public-entity-history.v1.json?v=20260824-history")
])
  .then(async responses => {
    for (const response of responses) if (!response.ok) throw new Error(`Dataset odpověděl ${response.status}`);
    return Promise.all(responses.map(response => response.json()));
  })
  .then(([data, publicData, publicHistory]) => {
    const modes = {
      profit: {
        heading: "Nejziskovější",
        count: "TOP 20",
        metric: "net_result",
        rows: [...data.entities].sort((a, b) => b.metrics.net_result - a.metrics.net_result).slice(0, 20),
        note: "Pořadí podle individuálního výsledku hospodaření po zdanění. ČEZ je mateřská společnost, nikoli konsolidovaná skupina.",
        kind: "profit"
      },
      weakest: {
        heading: "Nejslabší hospodářský výsledek",
        count: `BOTTOM 20 · ${data.summary.loss_making_count} ztrát`,
        metric: "net_result",
        rows: [...data.entities].sort((a, b) => a.metrics.net_result - b.metrics.net_result).slice(0, 20),
        note: `Záporný výsledek má pouze ${data.summary.loss_making_count} z 38 subjektů. Zbývající pozice jsou nejnižší kladné výsledky, nikoli ztráty.`,
        kind: "loss"
      },
      largest: {
        heading: "Největší podle aktiv",
        count: "TOP 20",
        metric: "total_assets",
        rows: [...data.entities].sort((a, b) => b.metrics.total_assets - a.metrics.total_assets).slice(0, 20),
        note: "Velikost měříme aktivy celkem. Obrat by znevýhodnil infrastrukturní a finanční instituce a počet zaměstnanců zase kapitálově náročné podniky.",
        kind: "largest"
      }
    };

    function renderRanking(modeName) {
      const mode = modes[modeName];
      $("#ranking-heading").textContent = mode.heading;
      $("#ranking-count").textContent = mode.count;
      $("#ranking-note").textContent = mode.note;
      $("#enterprise-list").innerHTML = enterpriseRows(mode.rows, mode.metric, mode.kind);
      document.querySelectorAll("#ranking-mode button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === modeName)));
    }

    $("#entity-count").textContent = number(data.summary.entity_count);
    $("#net-result").textContent = billion(data.summary.net_result_portfolio_reported);
    $("#budget-transfers").textContent = billion(data.summary.budget_transfers_total);
    $("#employee-count").textContent = number(data.summary.employees_portfolio_reported);
    $("#hero-result").textContent = `${billion(data.summary.net_result_portfolio_reported)} mld.`;
    $("#hero-transfer").textContent = `${billion(data.summary.budget_transfers_total)} mld.`;
    $("#return-chart").innerHTML = returnChart(data.budget_transfers);
    $("#reconciliation-note").textContent = `Kontrola součtů: ${data.summary.reconciliation_note}`;
    $("#schema-version").textContent = data.schema_version;
    $("#source-links").innerHTML = data.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)}: ${esc(source.title)} ↗</a>`).join("");
    document.querySelectorAll("#ranking-mode button").forEach(button => button.addEventListener("click", () => renderRanking(button.dataset.mode)));
    renderPublicRegistry(publicData);
    renderPublicHistory(publicHistory);
    renderRanking("profit");
  })
  .catch(error => {
    document.body.dataset.error = "true";
    $("#enterprise-list").innerHTML = `<p class="load-error">Data se nepodařilo načíst: ${esc(error.message)}</p>`;
    console.error(error);
  });
