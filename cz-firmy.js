const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = value => new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 0}).format(value);
const money = value => value == null ? "—" : new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 0, maximumFractionDigits: 1}).format(value);
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
  const category = $("#entity-category");
  const owner = $("#entity-owner");
  const body = $("#public-entity-rows");
  const owners = [...new Set(data.entities.map(row => row.owner_level))].sort((a, b) => a.localeCompare(b, "cs"));
  owner.insertAdjacentHTML("beforeend", owners.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));

  function render() {
    const query = search.value.trim().toLocaleLowerCase("cs");
    const visible = data.entities.filter(row =>
      (category.value === "all" || row.category === category.value) &&
      (owner.value === "all" || row.owner_level === owner.value) &&
      (!query || `${row.name} ${row.ico}`.toLocaleLowerCase("cs").includes(query))
    );
    body.innerHTML = visible.map(row => `<tr${row.strategic_highlight ? ' class="strategic-highlight"' : ""}>
      <td><strong>${esc(row.name)}</strong><small>IČO ${esc(row.ico)} · ${esc(row.legal_form)}</small></td>
      <td><span class="entity-type">${esc(row.category)}</span></td>
      <td>${esc(row.owner_level)}</td>
      <td class="numeric">${row.revenue_mczk == null ? "—" : `${money(row.revenue_mczk)} <small>mil. Kč</small>`}</td>
      <td class="numeric ${row.net_result_mczk < 0 ? "negative" : ""}">${row.net_result_mczk == null ? "—" : `${valueLabel(row.net_result_mczk, true)} <small>mil. Kč</small>`}</td>
      <td>${row.financial_source_kind ? `<span class="data-available">${esc(row.financial_source_kind)}</span>` : '<span class="data-missing">výkaz chybí</span>'}${row.strategic_highlight ? '<small class="highlight-label">TOP 38 highlight</small>' : ""}</td>
    </tr>`).join("");
    $("#registry-count").textContent = `Zobrazeno ${number(visible.length)} z ${number(data.summary.entity_count)} subjektů`;
  }

  $("#registry-coverage").textContent = `${number(data.summary.financial_result_count)} / ${number(data.summary.entity_count)} s výsledkem`;
  [search, category, owner].forEach(control => control.addEventListener(control === search ? "input" : "change", render));
  render();
}

Promise.all([
  fetch("data/cz-state-enterprises-2024.json"),
  fetch("data/cz-public-entities-2024.json")
])
  .then(async responses => {
    for (const response of responses) if (!response.ok) throw new Error(`Dataset odpověděl ${response.status}`);
    return Promise.all(responses.map(response => response.json()));
  })
  .then(([data, publicData]) => {
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
    $("#profit-sum").textContent = billion(publicData.summary.positive_net_result_sum_mczk);
    $("#loss-sum").textContent = `−${billion(publicData.summary.negative_net_result_absolute_sum_mczk)}`;
    $("#net-sum").textContent = billion(publicData.summary.net_result_sum_mczk);
    $("#turnover-sum").textContent = billion(publicData.summary.revenue_sum_mczk);
    $("#hero-result").textContent = `${billion(data.summary.net_result_portfolio_reported)} mld.`;
    $("#hero-transfer").textContent = `${billion(data.summary.budget_transfers_total)} mld.`;
    $("#return-chart").innerHTML = returnChart(data.budget_transfers);
    $("#reconciliation-note").textContent = `Kontrola součtů: ${data.summary.reconciliation_note}`;
    $("#schema-version").textContent = data.schema_version;
    $("#source-links").innerHTML = data.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)}: ${esc(source.title)} ↗</a>`).join("");
    document.querySelectorAll("#ranking-mode button").forEach(button => button.addEventListener("click", () => renderRanking(button.dataset.mode)));
    renderPublicRegistry(publicData);
    renderRanking("profit");
  })
  .catch(error => {
    document.body.dataset.error = "true";
    $("#enterprise-list").innerHTML = `<p class="load-error">Data se nepodařilo načíst: ${esc(error.message)}</p>`;
    console.error(error);
  });
