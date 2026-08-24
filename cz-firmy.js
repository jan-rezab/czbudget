const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const uiLanguage = document.documentElement.lang === "en" ? "en" : "cs";
const english = uiLanguage === "en";
const locale = english ? "en-GB" : "cs-CZ";
const number = value => new Intl.NumberFormat(locale, {maximumFractionDigits: 0}).format(value);
const money = value => value == null ? "—" : new Intl.NumberFormat(locale, {minimumFractionDigits: 0, maximumFractionDigits: 1}).format(value);
const percent = value => value == null ? "—" : `${new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value)} %`;
const billion = value => new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value / 1000);
const labels = {
  category:{Firma:"Company",Nemocnice:"Hospital","Vysoká škola":"University","Zdravotní pojišťovna":"Health insurer"},
  owner:{"Jiný veřejný vlastník":"Other public owner",Obec:"Municipality",Kraj:"Region",Stát:"State",DSO:"Municipal association","Územní veřejná úroveň":"Territorial public tier","Stát / ústřední úroveň":"State / central tier","Veřejné zdravotní pojištění":"Public health insurance"},
  sector:{Energetika:"Energy","Doprava a infrastruktura":"Transport and infrastructure","Finance a rozvoj":"Finance and development","Reality a cestovní ruch":"Real estate and tourism","Digitální a veřejné služby":"Digital and public services","Obrana a strategický průmysl":"Defence and strategic industry","Přírodní zdroje a sanace":"Natural resources and remediation","Zemědělství a potraviny":"Agriculture and food","Vodní hospodářství":"Water management"},
  topLine:{obrat:"turnover",výnosy:"revenue"},
  financialSource:{"MF strategické subjekty":"Ministry of Finance strategic entities","ČSÚIS VZZ":"CSUIS income statement"}
};
const translated = (group, value) => english ? (labels[group]?.[value] || value) : value;

function enterpriseRows(rows, metric, kind) {
  const maximum = Math.max(...rows.map(row => Math.abs(row.metrics[metric])));
  return rows.map((row, index) => {
    const value = row.metrics[metric];
    const rowKind = value < 0 ? "loss" : kind;
    const secondary = metric === "total_assets"
      ? `${english ? "Result" : "Výsledek"} ${valueLabel(row.metrics.net_result, true)} · ${number(row.metrics.employees)} ${english ? "employees" : "zaměstnanců"}`
      : `${english ? "Assets" : "Aktiva"} ${number(row.metrics.total_assets)} ${english ? "CZK m" : "mil. Kč"} · ${english ? "turnover" : "obrat"} ${number(row.metrics.turnover)} ${english ? "CZK m" : "mil. Kč"}`;
    return `<article class="enterprise-row ${rowKind}">
      <span class="enterprise-rank">${String(index + 1).padStart(2, "0")}</span>
      <div class="enterprise-name"><strong>${esc(row.name)}</strong><small>${esc(translated("sector", row.classification?.sector_name))} · ${english ? "ID" : "IČO"} ${esc(row.ico)}</small></div>
      <div class="enterprise-bar" aria-hidden="true"><i style="width:${(Math.abs(value) / maximum * 100).toFixed(1)}%"></i></div>
      <strong class="enterprise-value">${valueLabel(value, metric === "net_result")}<small>${english ? "CZK m" : "mil. Kč"}</small></strong>
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
    <b>${number(row.value)} <small>${english ? "CZK m" : "mil. Kč"}</small></b>
  </div>`).join("");
}

function renderPublicRegistry(data) {
  const search = $("#entity-search");
  const owner = $("#entity-owner");
  const sort = $("#entity-sort");
  const body = $("#public-entity-rows");
  const tabs = [...document.querySelectorAll("#entity-tabs button")];
  let activeCategory = "all";
  const owners = [...new Set(data.entities.map(row => row.owner_level))].sort((a, b) => translated("owner", a).localeCompare(translated("owner", b), locale));
  owner.insertAdjacentHTML("beforeend", owners.map(value => `<option value="${esc(value)}">${esc(translated("owner", value))}</option>`).join(""));

  const tabCounts = {all: "#tab-all", Firma: "#tab-companies", "Vysoká škola": "#tab-universities", Nemocnice: "#tab-hospitals", "Zdravotní pojišťovna": "#tab-health-insurers"};
  Object.entries(tabCounts).forEach(([key, selector]) => {
    const group = data.summary.groups[key];
    $(selector).textContent = `${number(group.entity_count)} · ${number(group.financial_result_count)} ${english ? "with results" : "s výsledkem"}`;
  });

  function updateSummary() {
    const group = data.summary.groups[activeCategory];
    const label = english ? (activeCategory === "all" ? "all entities" : activeCategory === "Firma" ? "companies" : activeCategory === "Vysoká škola" ? "universities" : activeCategory === "Nemocnice" ? "hospitals" : "health insurers") : (activeCategory === "all" ? "všechny subjekty" : activeCategory === "Firma" ? "firmy" : activeCategory === "Vysoká škola" ? "vysoké školy" : activeCategory === "Nemocnice" ? "nemocnice" : "zdravotní pojišťovny");
    const hasFinancials = group.financial_result_count > 0;
    $("#profit-sum").textContent = hasFinancials ? billion(group.positive_net_result_sum_mczk) : "—";
    $("#loss-sum").textContent = hasFinancials ? `−${billion(group.negative_net_result_absolute_sum_mczk)}` : "—";
    $("#net-sum").textContent = hasFinancials ? billion(group.net_result_sum_mczk) : "—";
    $("#turnover-sum").textContent = hasFinancials ? billion(group.revenue_sum_mczk) : "—";
    $("#aggregate-scope").textContent = english ? `Totals for ${label}: ${number(group.financial_result_count)} of ${number(group.entity_count)} entities have an available 2024 result.` : `Součty za ${label}: ${number(group.financial_result_count)} z ${number(group.entity_count)} subjektů s dostupným výsledkem za rok 2024.`;
    $("#registry-coverage").textContent = `${number(group.financial_result_count)} / ${number(group.entity_count)} ${english ? "with results" : "s výsledkem"}`;
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
      <td><strong>${esc(row.name)}</strong><small>${english ? "ID" : "IČO"} ${esc(row.ico)} · ${esc(row.legal_form)}</small></td>
      <td><span class="entity-type">${esc(translated("category", row.category))}</span></td>
      <td>${esc(translated("owner", row.owner_level))}</td>
      <td class="numeric">${row.top_line.value_mczk == null ? "—" : `${money(row.top_line.value_mczk)} <small>${english ? "CZK m" : "mil. Kč"} · ${esc(translated("topLine", row.top_line.definition))}</small>`}</td>
      <td class="numeric ${row.top_line.net_result_mczk < 0 ? "negative" : ""}">${row.top_line.net_result_mczk == null ? "—" : `${row.top_line.net_result_mczk < 0 ? "−" : "+"}${money(Math.abs(row.top_line.net_result_mczk))} <small>${english ? "CZK m" : "mil. Kč"}</small>`}</td>
      <td class="numeric ${row.top_line.net_margin_pct < 0 ? "negative" : ""}">${percent(row.top_line.net_margin_pct)}</td>
      <td>${row.financial_source_kind ? `<span class="data-available">${esc(translated("financialSource", row.financial_source_kind))}</span>` : row.category === "Zdravotní pojišťovna" ? `<span class="data-missing">${english ? "special statement outside the income-statement dataset" : "speciální výkaz mimo VZZ"}</span>` : `<span class="data-missing">${english ? "statement unavailable" : "výkaz chybí"}</span>`}${row.strategic_highlight ? '<small class="highlight-label">TOP 38 highlight</small>' : ""}</td>
    </tr>`).join("");
    $("#registry-count").textContent = english ? `Showing ${number(visible.length)} of ${number(data.summary.groups[activeCategory].entity_count)} entities in this tab` : `Zobrazeno ${number(visible.length)} z ${number(data.summary.groups[activeCategory].entity_count)} subjektů v záložce`;
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
  root.innerHTML=`<div class="public-history-summary"><article><span>${english ? "Entities with a financial series" : "Subjekty s účetní řadou"}</span><strong>${number(data.summary.entities_with_financial_series)}</strong><small>${english ? `of ${number(data.summary.entity_count)} in the historical inventory` : `z ${number(data.summary.entity_count)} v historickém inventáři`}</small></article><article><span>${english ? "Documented entity-years" : "Doložené účetní roky"}</span><strong>${number(data.summary.financial_rows)}</strong><small>${data.summary.first_year}–${data.summary.last_year}</small></article><label><span>${english ? "Select an entity" : "Vyberte subjekt"}</span><select id="public-history-entity">${entities.map(row=>`<option value="${esc(row.ico)}">${esc(row.name)} · ${esc(row.ico)}</option>`).join("")}</select></label></div><div class="public-history-grid"><article class="public-history-chart-panel"><header><div><span id="public-history-category">—</span><h3 id="public-history-name">—</h3></div><strong id="public-history-period">—</strong></header><div class="public-history-legend"><span><i class="history-revenue"></i>${english ? "Revenue" : "Výnosy"}</span><span><i class="history-cost"></i>${english ? "Costs" : "Náklady"}</span><span><i class="history-result"></i>${english ? "Result" : "Výsledek"}</span></div><div id="public-history-chart"></div><details><summary>${english ? "Annual data table" : "Roční data v tabulce"}</summary><div><table><thead><tr><th>${english ? "Year" : "Rok"}</th><th>${english ? "Revenue" : "Výnosy"}</th><th>${english ? "Costs" : "Náklady"}</th><th>${english ? "Result" : "Výsledek"}</th><th>${english ? "Source" : "Zdroj"}</th></tr></thead><tbody id="public-history-rows"></tbody></table></div></details></article><aside class="public-history-coverage"><header><span>${english ? "Open income-statement coverage" : "Pokrytí otevřeného VZZ"}</span><strong>${english ? "year by year" : "rok po roku"}</strong></header><div>${[...coverageByYear.values()].map(row=>{const rate=row.entities?row.financial/row.entities*100:0;return `<div><span>${row.year}</span><i><b style="width:${rate}%"></b></i><strong>${money(rate)} % <small>${row.financial}/${row.entities}</small></strong></div>`}).join("")}</div><p>${esc(data.status)} ${english ? "A missing statement remains null and is excluded from totals." : "Chybějící výkaz zůstává prázdný a nevstupuje do součtů."}</p></aside></div><div class="public-history-sources"><strong>${english ? "Source series" : "Zdrojová řada"}</strong>${data.sources.slice(0,4).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.item)} · ${esc(source.period)} ↗</a>`).join("")}</div>`;
  const select=root.querySelector("#public-history-entity");
  function renderEntity(){
    const entity=entities.find(row=>row.ico===select.value)||entities[0],series=entity.series;
    $("#public-history-name").textContent=entity.name;$("#public-history-category").textContent=`${translated("category", entity.category)} · ${translated("owner", entity.owner_level)}`;$("#public-history-period").textContent=`${entity.first_financial_year}–${entity.last_financial_year} · ${series.length} ${english ? "years" : "let"}`;
    const width=820,height=370,left=64,right=20,top=24,bottom=43,values=series.flatMap(row=>[row.revenue_mczk,row.cost_mczk,row.net_result_mczk]).filter(value=>Number.isFinite(value)&&value>=0),maximum=Math.max(...values,1),x=index=>left+(index+.5)*(width-left-right)/series.length,y=value=>top+(maximum-Math.max(0,value))/(maximum)*(height-top-bottom);
    const axisMoney=value=>new Intl.NumberFormat(locale,{minimumFractionDigits:value>0&&value<1?2:1,maximumFractionDigits:value>0&&value<1?2:1}).format(value);
    const grid=[0,.25,.5,.75,1].map(fraction=>{const value=maximum*(1-fraction),cy=top+(height-top-bottom)*fraction;return `<line x1="${left}" x2="${width-right}" y1="${cy}" y2="${cy}"/><text x="${left-8}" y="${cy+4}" text-anchor="end">${axisMoney(value/1000)}</text>`}).join("");
    const path=field=>series.map((row,index)=>`${index?"L":"M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" "),years=series.map((row,index)=>`<text x="${x(index)}" y="${height-17}" text-anchor="middle">${row.year}</text>`).join("");
    $("#public-history-chart").innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${english ? "Revenue and costs for" : "Výnosy a náklady subjektu"} ${esc(entity.name)}"><g class="public-history-gridlines">${grid}${years}<text x="10" y="17">${english ? "CZK bn" : "mld. Kč"}</text></g><path class="public-history-line revenue" d="${path("revenue_mczk")}"/><path class="public-history-line cost" d="${path("cost_mczk")}"/>${series.map((row,index)=>`<circle class="public-history-result-point ${row.net_result_mczk<0?"negative":""}" cx="${x(index)}" cy="${y(row.net_result_mczk)}" r="4"><title>${row.year}: ${money(row.net_result_mczk)} ${english ? "CZK m" : "mil. Kč"}</title></circle>`).join("")}</svg>`;
    $("#public-history-rows").innerHTML=[...series].reverse().map(row=>`<tr><th>${row.year}</th><td>${money(row.revenue_mczk)} ${english ? "CZK m" : "mil. Kč"}</td><td>${money(row.cost_mczk)} ${english ? "CZK m" : "mil. Kč"}</td><td class="${row.net_result_mczk<0?"negative":""}">${row.net_result_mczk<0?"−":"+"}${money(Math.abs(row.net_result_mczk))} ${english ? "CZK m" : "mil. Kč"}</td><td><a href="${esc(row.source_financial)}" target="_blank" rel="noreferrer">${english ? "Statement" : "VZZ"} ↗</a></td></tr>`).join("");
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
        heading: english ? "Most profitable" : "Nejziskovější",
        count: "TOP 20",
        metric: "net_result",
        rows: [...data.entities].sort((a, b) => b.metrics.net_result - a.metrics.net_result).slice(0, 20),
        note: english ? "Ranked by each entity's individual result after tax. ČEZ is the parent company, not the consolidated group." : "Pořadí podle individuálního výsledku hospodaření po zdanění. ČEZ je mateřská společnost, nikoli konsolidovaná skupina.",
        kind: "profit"
      },
      weakest: {
        heading: english ? "Weakest financial result" : "Nejslabší hospodářský výsledek",
        count: `BOTTOM 20 · ${data.summary.loss_making_count} ${english ? "losses" : "ztrát"}`,
        metric: "net_result",
        rows: [...data.entities].sort((a, b) => a.metrics.net_result - b.metrics.net_result).slice(0, 20),
        note: english ? `Only ${data.summary.loss_making_count} of 38 entities report a loss. The remaining positions are the lowest positive results, not losses.` : `Záporný výsledek má pouze ${data.summary.loss_making_count} z 38 subjektů. Zbývající pozice jsou nejnižší kladné výsledky, nikoli ztráty.`,
        kind: "loss"
      },
      largest: {
        heading: english ? "Largest by assets" : "Největší podle aktiv",
        count: "TOP 20",
        metric: "total_assets",
        rows: [...data.entities].sort((a, b) => b.metrics.total_assets - a.metrics.total_assets).slice(0, 20),
        note: english ? "Scale is measured by total assets. Turnover would disadvantage infrastructure and financial institutions, while employee count would disadvantage capital-intensive enterprises." : "Velikost měříme aktivy celkem. Obrat by znevýhodnil infrastrukturní a finanční instituce a počet zaměstnanců zase kapitálově náročné podniky.",
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
    $("#reconciliation-note").textContent = `${english ? "Reconciliation check" : "Kontrola součtů"}: ${data.summary.reconciliation_note}`;
    $("#schema-version").textContent = data.schema_version;
    $("#source-links").innerHTML = data.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)}: ${esc(source.title)} ↗</a>`).join("");
    document.querySelectorAll("#ranking-mode button").forEach(button => button.addEventListener("click", () => renderRanking(button.dataset.mode)));
    renderPublicRegistry(publicData);
    renderPublicHistory(publicHistory);
    renderRanking("profit");
  })
  .catch(error => {
    document.body.dataset.error = "true";
    $("#enterprise-list").innerHTML = `<p class="load-error">${english ? "Data could not be loaded" : "Data se nepodařilo načíst"}: ${esc(error.message)}</p>`;
    console.error(error);
  });
