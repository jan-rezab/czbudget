const historyRoot = document.querySelector("#history-explorer");
if (historyRoot) {
  const source = historyRoot.dataset.source;
  const fixedIco = historyRoot.dataset.fixedIco;
  const english = new URLSearchParams(location.search).get("lang") === "en" || localStorage.getItem("psd-lang") === "en";
  const select = historyRoot.querySelector("#history-city");
  const chart = historyRoot.querySelector("#history-chart");
  const tableBody = historyRoot.querySelector("#history-table-body");
  const kpis = historyRoot.querySelector("#history-kpis");
  const fmt = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
  const compact = (value) => `${value < 0 ? "−" : ""}${fmt.format(Math.abs(value) / 1e9)} mld. Kč`;
  const svgEscape = (value) => String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);

  function render(city) {
    const series = city.series;
    const latest = series.at(-1);
    const cumulative = series.reduce((sum, row) => sum + row.budget_balance, 0);
    const surplusYears = series.filter((row) => row.budget_balance >= 0).length;
    kpis.innerHTML = `<article><span>${english ? "Revenue" : "Příjmy"} ${latest.year}</span><strong>${compact(latest.revenue_actual)}</strong></article><article><span>${english ? "Balance" : "Výsledek"} ${latest.year}</span><strong class="${latest.budget_balance >= 0 ? "positive" : "negative"}">${compact(latest.budget_balance)}</strong></article><article><span>${english ? "Cash and deposits" : "Stav účtů"} ${latest.year}</span><strong>${compact(latest.cash_current)}</strong></article><article><span>${english ? "20-year cumulative balance" : "Součet výsledků za 20 let"}</span><strong class="${cumulative >= 0 ? "positive" : "negative"}">${compact(cumulative)}</strong><small>${english ? `${surplusYears} of 20 years in surplus` : `${surplusYears} z 20 let v přebytku`}</small></article>`;
    const width = 1120, height = 460, left = 72, right = 26, top = 30, bottom = 54;
    const values = series.flatMap((row) => [row.revenue_actual, row.expense_actual, row.cash_current]);
    const max = Math.max(...values) * 1.08;
    const x = (index) => left + index * ((width - left - right) / (series.length - 1));
    const y = (value) => top + (max - value) / max * (height - top - bottom);
    const ticks = [0, .25, .5, .75, 1].map((share) => ({ value: max * share, y: y(max * share) }));
    const gridLines = ticks.map((tick) => `<line x1="${left}" x2="${width-right}" y1="${tick.y}" y2="${tick.y}"/><text x="${left-12}" y="${tick.y+4}" text-anchor="end">${fmt.format(tick.value/1e9)}</text>`).join("");
    const line = (field) => series.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
    const points = series.map((row, index) => `<g class="history-point"><circle cx="${x(index)}" cy="${y(row.cash_current)}" r="4"><title>${row.year}: ${compact(row.cash_current)}</title></circle></g>`).join("");
    const years = series.map((row, index) => index % 2 === 0 || index === series.length - 1 ? `<text x="${x(index)}" y="${height-24}" text-anchor="middle">${row.year}</text>` : "").join("");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${english ? "Revenue, expenditure and cash trend for" : "Vývoj příjmů, výdajů a stavu účtů města"} ${svgEscape(city.name)}"><g class="history-grid">${gridLines}${years}<text x="18" y="22">${english ? "CZK bn" : "mld. Kč"}</text></g><path class="history-line revenue-line" d="${line("revenue_actual")}"/><path class="history-line expense-line" d="${line("expense_actual")}"/><path class="history-line cash-line" d="${line("cash_current")}"/>${points}</svg>`;
    tableBody.innerHTML = [...series].reverse().map((row) => `<tr><th>${row.year}</th><td>${compact(row.revenue_actual)}</td><td>${compact(row.expense_actual)}</td><td class="${row.budget_balance >= 0 ? "positive" : "negative"}">${compact(row.budget_balance)}</td><td>${compact(row.cash_current)}</td></tr>`).join("");
  }

  fetch(source).then((response) => response.json()).then((data) => {
    const cities = data.cities;
    if (select) {
      select.innerHTML = cities.map((city) => `<option value="${city.national_id}">${city.name}</option>`).join("");
      select.value = fixedIco || cities.find((city) => city.name === "Praha")?.national_id || cities[0].national_id;
      select.addEventListener("change", () => render(cities.find((city) => city.national_id === select.value)));
    }
    render(cities.find((city) => city.national_id === (fixedIco || select?.value)) || cities[0]);
  });
}
