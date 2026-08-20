const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const number = value => new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 0}).format(value);
const billion = value => new Intl.NumberFormat("cs-CZ", {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(value / 1000);

function enterpriseRows(rows, kind) {
  const maximum = Math.max(...rows.map(row => Math.abs(row.value)));
  return rows.map(row => {
    const share = row.state_share_pct === 100 ? "100 % stát" : `${new Intl.NumberFormat("cs-CZ", {maximumFractionDigits: 2}).format(row.state_share_pct)} % stát`;
    return `<article class="enterprise-row ${kind}">
      <span class="enterprise-rank">${String(row.rank).padStart(2, "0")}</span>
      <div class="enterprise-name"><strong>${esc(row.name)}</strong><small>${esc(row.legal_form)} · ${share}</small></div>
      <div class="enterprise-bar" aria-hidden="true"><i style="width:${(Math.abs(row.value) / maximum * 100).toFixed(1)}%"></i></div>
      <strong class="enterprise-value">${row.value > 0 ? "+" : "−"}${number(Math.abs(row.value))}<small>mil. Kč</small></strong>
      <p>${esc(row.note)}</p>
    </article>`;
  }).join("");
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

fetch("data/cz-state-enterprises-2024.json")
  .then(response => {
    if (!response.ok) throw new Error(`Dataset odpověděl ${response.status}`);
    return response.json();
  })
  .then(data => {
    $("#entity-count").textContent = number(data.summary.entity_count);
    $("#net-result").textContent = billion(data.summary.net_result_total);
    $("#budget-transfers").textContent = billion(data.summary.budget_transfers_total);
    $("#employee-count").textContent = number(data.summary.employees);
    $("#hero-result").textContent = `${billion(data.summary.net_result_total)} mld.`;
    $("#hero-transfer").textContent = `${billion(data.summary.budget_transfers_total)} mld.`;
    $("#profit-list").innerHTML = enterpriseRows(data.profit_rank, "profit");
    $("#loss-list").innerHTML = enterpriseRows(data.loss_rank, "loss");
    $("#return-chart").innerHTML = returnChart(data.budget_transfers);
    $("#schema-version").textContent = data.schema_version;
    $("#source-links").innerHTML = data.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)}: ${esc(source.title)} ↗</a>`).join("");
  })
  .catch(error => {
    document.body.dataset.error = "true";
    $("#profit-list").innerHTML = `<p class="load-error">Data se nepodařilo načíst: ${esc(error.message)}</p>`;
    console.error(error);
  });
