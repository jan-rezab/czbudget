const historyRoot = document.querySelector("#history-explorer");
if (historyRoot) {
  const source = historyRoot.dataset.source;
  const fixedIco = historyRoot.dataset.fixedIco;
  const english = new URLSearchParams(location.search).get("lang") === "en" || localStorage.getItem("psd-lang") === "en";
  const select = historyRoot.querySelector("#history-city");
  const chart = historyRoot.querySelector("#history-chart");
  chart.tabIndex = 0;
  const tableBody = historyRoot.querySelector("#history-table-body");
  const kpis = historyRoot.querySelector("#history-kpis");
  const locale = english ? "en-GB" : "cs-CZ";
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const currency = () => window.MunicipalCurrency || {
    current: "CZK",
    convert: (value) => value,
    format: (value) => `${value < 0 ? "−" : ""}${decimal.format(Math.abs(value) / 1e9)} ${english ? "CZK bn" : "mld. Kč"}`,
  };
  const money = (value) => Number.isFinite(value) ? currency().format(value, { adaptive: true }) : "—";
  const svgEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const niceAxis = (domainMax, targetSteps = 4) => {
    const roughStep = domainMax / targetSteps;
    const power = 10 ** Math.floor(Math.log10(roughStep));
    const fraction = roughStep / power;
    const multiplier = [1, 2, 2.5, 5, 10].find((candidate) => candidate >= fraction) || 10;
    const step = multiplier * power;
    const max = Math.ceil(domainMax / step) * step;
    return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
  };
  let activeCity = null;

  function render(city) {
    activeCity = city;
    const series = city.series.filter((row) => Number.isFinite(row.revenue_actual) && Number.isFinite(row.expense_actual));
    if (!series.length) {
      kpis.innerHTML = `<p>${english ? "No historical records are available for this municipality." : "Pro tuto obec nejsou dostupné historické záznamy."}</p>`;
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }
    const latest = series.at(-1);
    const cumulative = series.reduce((sum, row) => sum + row.budget_balance, 0);
    const surplusYears = series.filter((row) => row.budget_balance >= 0).length;
    const yearCount = series.length;
    kpis.innerHTML = `<article><span>${english ? "Revenue" : "Příjmy"} ${latest.year}</span><strong>${money(latest.revenue_actual)}</strong></article><article><span>${english ? "Balance" : "Výsledek"} ${latest.year}</span><strong class="${latest.budget_balance >= 0 ? "positive" : "negative"}">${money(latest.budget_balance)}</strong></article><article><span>${english ? "Cash and deposits" : "Stav účtů"} ${latest.year}</span><strong>${money(latest.cash_current)}</strong></article><article><span>${english ? `${yearCount}-year cumulative balance` : `Součet výsledků za ${yearCount} let`}</span><strong class="${cumulative >= 0 ? "positive" : "negative"}">${money(cumulative)}</strong><small>${english ? `${surplusYears} of ${yearCount} years in surplus` : `${surplusYears} z ${yearCount} let v přebytku`}</small></article>`;
    const width = 1120, height = 460, left = 72, right = 26, top = 30, bottom = 54;
    const convertedValues = series.flatMap((row) => [row.revenue_actual, row.expense_actual, row.cash_current]).filter(Number.isFinite).map(currency().convert);
    const axis = niceAxis(Math.max(...convertedValues) * 1.04);
    const max = axis.max;
    const x = (index) => left + (index + .5) * ((width - left - right) / series.length);
    const y = (czk) => top + (max - currency().convert(czk)) / max * (height - top - bottom);
    const axisMoney = (value) => {
      const absolute = Math.abs(value);
      const divisor = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : absolute >= 1e3 ? 1e3 : 1;
      return decimal.format(value / divisor);
    };
    const axisUnit = max >= 1e9 ? (english ? "bn" : "mld.") : max >= 1e6 ? (english ? "m" : "mil.") : max >= 1e3 ? (english ? "k" : "tis.") : "";
    const ticks = axis.ticks.map((value) => ({ value, y: top + (max - value) / max * (height - top - bottom) }));
    const gridLines = ticks.map((tick) => `<line x1="${left}" x2="${width-right}" y1="${tick.y}" y2="${tick.y}"/><text x="${left-12}" y="${tick.y+4}" text-anchor="end">${axisMoney(tick.value)}</text>`).join("");
    const line = (field) => {
      let drawing = false;
      return series.map((row, index) => {
        if (!Number.isFinite(row[field])) { drawing = false; return ""; }
        const command = drawing ? "L" : "M";
        drawing = true;
        return `${command}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`;
      }).join(" ");
    };
    const years = series.map((row, index) => index % 2 === 0 || index === series.length - 1 ? `<text x="${x(index)}" y="${height-24}" text-anchor="middle">${row.year}</text>` : "").join("");
    const hitWidth = (width - left - right) / series.length;
    const interactions = series.map((row, index) => {
      const label = `${row.year}. ${english ? "Revenue" : "Příjmy"}: ${money(row.revenue_actual)}. ${english ? "Expenditure" : "Výdaje"}: ${money(row.expense_actual)}. ${english ? "Balance" : "Výsledek"}: ${money(row.budget_balance)}. ${english ? "Cash" : "Stav účtů"}: ${money(row.cash_current)}.`;
      const dots = [["revenue", row.revenue_actual], ["expense", row.expense_actual], ["cash", row.cash_current]].filter(([, value]) => Number.isFinite(value)).map(([kind, value]) => `<circle class="history-hover-dot ${kind}-dot" cx="${x(index)}" cy="${y(value)}" r="6"/>`).join("");
      return `<g class="history-year-interaction" data-index="${index}"><rect class="history-year-hit" x="${x(index)-hitWidth/2}" y="${top}" width="${hitWidth}" height="${height-top-bottom}" tabindex="0" role="img" aria-label="${svgEscape(label)}"/><line class="history-year-guide" x1="${x(index)}" x2="${x(index)}" y1="${top}" y2="${height-bottom}"/>${dots}</g>`;
    }).join("");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${english ? "Revenue, expenditure and cash trend for" : "Vývoj příjmů, výdajů a stavu účtů obce"} ${svgEscape(city.name)}"><g class="history-grid">${gridLines}${years}<text x="18" y="22">${svgEscape(currency().current)} ${axisUnit}</text></g><path class="history-line revenue-line" d="${line("revenue_actual")}"/><path class="history-line expense-line" d="${line("expense_actual")}"/><path class="history-line cash-line" d="${line("cash_current")}"/>${interactions}</svg><div class="history-tooltip" role="status" aria-live="polite" hidden></div>`;
    const tooltip = chart.querySelector(".history-tooltip");
    const showTooltip = (target, clientX) => {
      const row = series[Number(target.closest(".history-year-interaction")?.dataset.index)];
      if (!row) return;
      tooltip.innerHTML = `<strong>${row.year}</strong><span><i class="revenue-key"></i>${english ? "Revenue" : "Příjmy"}<b>${money(row.revenue_actual)}</b></span><span><i class="expense-key"></i>${english ? "Expenditure" : "Výdaje"}<b>${money(row.expense_actual)}</b></span><span><i class="cash-key"></i>${english ? "Cash and deposits" : "Stav účtů"}<b>${money(row.cash_current)}</b></span><span>${english ? "Balance" : "Výsledek"}<b class="${row.budget_balance >= 0 ? "positive" : "negative"}">${money(row.budget_balance)}</b></span>`;
      tooltip.hidden = false;
      const chartRect = chart.getBoundingClientRect();
      const hitRect = target.getBoundingClientRect();
      const requestedLeft = Number.isFinite(clientX) ? clientX - chartRect.left + 14 : hitRect.left - chartRect.left + hitRect.width / 2 + 14;
      tooltip.style.left = `${Math.max(8, Math.min(requestedLeft, chart.clientWidth - 238))}px`;
      tooltip.style.top = "22px";
    };
    chart.querySelectorAll(".history-year-hit").forEach((hit) => {
      hit.addEventListener("pointermove", (event) => showTooltip(hit, event.clientX));
      hit.addEventListener("focus", () => showTooltip(hit));
    });
    chart.addEventListener("pointerleave", () => { tooltip.hidden = true; });
    chart.addEventListener("focusout", (event) => { if (!chart.contains(event.relatedTarget)) tooltip.hidden = true; });
    tableBody.innerHTML = [...series].reverse().map((row) => `<tr><th>${row.year}</th><td>${money(row.revenue_actual)}</td><td>${money(row.expense_actual)}</td><td class="${row.budget_balance >= 0 ? "positive" : "negative"}">${money(row.budget_balance)}</td><td>${money(row.cash_current)}</td></tr>`).join("");
  }

  fetch(source).then((response) => {
    if (!response.ok) throw new Error(`History source returned ${response.status}`);
    return response.json();
  }).then((data) => {
    const cities = data.cities || [{ ...data.municipality, series: data.series }];
    if (select) {
      select.innerHTML = cities.map((city) => `<option value="${city.national_id}">${city.name}</option>`).join("");
      select.value = fixedIco || cities.find((city) => city.name === "Praha")?.national_id || cities[0].national_id;
      select.addEventListener("change", () => render(cities.find((city) => city.national_id === select.value)));
    }
    render(cities.find((city) => city.national_id === (fixedIco || select?.value)) || cities[0]);
  }).catch((error) => {
    console.error("Municipal history integration failed", error);
    kpis.innerHTML = `<p>${english ? "Historical data could not be loaded." : "Historická data se nepodařilo načíst."}</p>`;
  });
  addEventListener("municipal-currency-change", () => { if (activeCity) render(activeCity); });
}
