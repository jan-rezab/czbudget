(() => {
  const assetRoot = new URL(".", document.currentScript?.src || location.href);
  const root = document.querySelector("#smlouvy-v-case");
  if (!root) return;

  const lang = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "cs";
  const locale = lang === "en" ? "en-GB" : "cs-CZ";
  const copy = {
    cs: {
      pageTitle:"Plzeň: smlouvy a skutečné platby — Public Spending Data", home:"Domů", reports:"Reporty", breadcrumb:"Plzeň: smlouvy a platby", heroKicker:"Datový speciál · Plzeň", heroTitle:"Smlouvy nestačí. Důležité je, kdy město opravdu zaplatilo.", heroIntro:"Propojujeme kompletní registr smluv města s 555 stavebními investicemi a jejich skutečnými platbami po fiskálních letech.", heroPrimary:"Projít časovou osu", heroDetail:"Smlouvy 2026", heroBack:"Zpět na profil Plzně", heroStat:"11,2 mld. Kč", heroStatLabel:"časově alokovaných projektových plateb", methodKicker:"Data & metodika", methodTitle:"Co je přesné a co je odhad", methodIntro:"Smluvní hodnota je událost v registru. Platba je skutečný výdaj z účtu města, ale dostupný jen na úrovni investiční akce. Vazba mezi nimi nese vlastní příznak jistoty.", sourceContracts:"Kompletní smlouvy", sourceProjects:"Investiční projekty", sourceTimeline:"Propojená časová data",
      kicker:"Dvě časové osy · 2016–2026", title:"Od podpisu smlouvy ke skutečné platbě", intro:"Registr zachycuje vznik a zveřejnění závazku. Rozpočet města u 555 stavebních investic navíc ukazuje, ve kterém fiskálním roce peníze skutečně odešly.",
      commitment:"Závazek", commitmentText:"Hodnota smlouvy v datu podpisu. Víceletou částku dál nerozpočítáváme odhadem.", register:"Registr", registerText:"Datum zveřejnění je okamžik, kdy se záznam objevil veřejně. Není to datum platby.", cash:"Skutečná platba", cashText:"Částka „Uhrazeno“ z městské investiční akce, přesně přiřazená k fiskálnímu roku projektu.",
      activityTitle:"Měsíční aktivita všech smluv", eventLabel:"Čas události", signed:"Podpis · vznik závazku", published:"Zveřejnění v registru", metricLabel:"Měřítko", knownValue:"Známá hodnota", count:"Počet smluv", activityNote:"Výška sloupce patří jednomu měsíci. Smlouvy s neuvedenou cenou vstupují do počtu, nikoli do hodnoty; záporné dodatky míří pod nulovou osu a chybné budoucí datum podpisu graf ignoruje.",
      portfolioTitle:"Investiční portfolio: závazky proti hotovosti", portfolioIntro:"Oranžově jsou známé hodnoty propojených smluv podle roku podpisu. Zeleně skutečné platby všech 555 sledovaných akcí podle fiskálního roku.", portfolioNote:"Smluvní řada je neúplná, dokud projekt nejde bezpečně propojit s registrem. Platební řada je přesná pro rozsah stavebních investic MMP zveřejněný městem; nejde o všechny výdaje Plzně.",
      projectTitle:"Závazky a hotovost na jedné projektové ose", projectIntro:"Vyberte investiční akci. Oranžové sloupce ukazují smlouvy podle podpisu, zelené skutečně uhrazené částky podle fiskálního roku.", projectLabel:"Investiční akce", projectNote:"Platby jsou přesné na úrovni městské investiční akce, nikoli jednotlivé smlouvy. Připojení smlouvy k projektu je ověřené interním kódem nebo konzervativně odhadnuté podle názvu a IČO dodavatele; nejisté shody jsou označené.",
      total:"Celkem v zobrazeném období", peak:"Největší měsíční pohyb", coverage:"Cenová úplnost", lag:"Medián zveřejnění", days:"dní po podpisu", contracts:"smluv", known:"se známou cenou", period:"Období", noData:"Pro tuto volbu nejsou data.", loading:"Načítám časovou osu…", error:"Časovou osu se nepodařilo načíst.",
      contractLane:"Smlouvy · podle podpisu", paymentLane:"Uhrazeno · fiskální rok", linkedValue:"Spárovaná smluvní hodnota", paid:"Uhrazeno na projektu", invoiced:"Vyfakturováno", matchQuality:"Kvalita propojení", linkedContracts:"Připojené smlouvy", verified:"kódem ověřeno", high:"silná shoda", medium:"odhad", noContracts:"K projektu zatím nemáme bezpečně připojenou smlouvu z registru.", asOf:"Data projektu k", preparation:"Začátek přípravy", delivery:"Začátek realizace", finish:"Konec realizace", sourceScope:"555 stavebních investičních akcí MMP · nejde o všechny výdaje města", valueUnknown:"cena neuvedena", allProjects:"projektů", matchedProjects:"projektů propojeno se smlouvami", linkedToProjects:"smluv připojeno k investičním akcím", paidByYear:"uhrazeno rozděleno po fiskálních letech", explicitCodes:"přímých shod interním kódem"
    },
    en: {
      pageTitle:"Plzeň: contracts and actual payments — Public Spending Data", home:"Home", reports:"Reports", breadcrumb:"Plzeň: contracts and payments", heroKicker:"Data special · Plzeň", heroTitle:"Contracts are not enough. What matters is when the city actually paid.", heroIntro:"We connect the city's complete contract register to 555 construction investments and their actual cash payments by fiscal year.", heroPrimary:"Explore the timeline", heroDetail:"2026 contracts", heroBack:"Back to Plzeň profile", heroStat:"CZK 11.2bn", heroStatLabel:"project payments allocated over time", methodKicker:"Data & method", methodTitle:"What is exact and what is inferred", methodIntro:"Contract value is an event in the register. Payment is actual cash expenditure, but available only at investment-project level. Every link between them carries its own confidence flag.", sourceContracts:"Complete contracts", sourceProjects:"Investment projects", sourceTimeline:"Linked timeline data",
      kicker:"Two time axes · 2016–2026", title:"From contract signature to actual cash payment", intro:"The register records when a commitment was made and published. For 555 construction investments, the city budget also shows the fiscal year in which cash was actually paid.",
      commitment:"Commitment", commitmentText:"Contract value at signature. We do not invent a multi-year allocation for the stated total.", register:"Register", registerText:"Publication is when the record became public. It is not a payment date.", cash:"Actual payment", cashText:"The city's “Paid” amount, assigned to the project's actual fiscal year.",
      activityTitle:"Monthly activity across all contracts", eventLabel:"Event date", signed:"Signature · commitment", published:"Register publication", metricLabel:"Measure", knownValue:"Known value", count:"Contract count", activityNote:"Each bar is one month. Contracts without a stated price count toward volume but not value; negative amendments fall below zero and invalid future signature dates are excluded.",
      portfolioTitle:"Investment portfolio: commitments versus cash", portfolioIntro:"Orange shows known values of linked contracts by signature year. Green shows actual payments for all 555 tracked projects by fiscal year.", portfolioNote:"The contract series stays incomplete until a project can be linked safely to the register. Payments are exact for the MMP construction-investment scope published by the city; this is not all Plzeň expenditure.",
      projectTitle:"Commitments and cash on one project timeline", projectIntro:"Choose an investment project. Orange bars show contracts by signature; green bars show cash paid by fiscal year.", projectLabel:"Investment project", projectNote:"Payments are exact at city-project level, not individual-contract level. Contracts are linked by an explicit internal code or conservatively inferred from title and supplier registration ID; uncertain links remain labelled.",
      total:"Total in displayed period", peak:"Largest monthly movement", coverage:"Price coverage", lag:"Median publication lag", days:"days after signature", contracts:"contracts", known:"with known value", period:"Period", noData:"No data for this selection.", loading:"Loading timeline…", error:"The timeline could not be loaded.",
      contractLane:"Contracts · signature year", paymentLane:"Paid · fiscal year", linkedValue:"Linked contract value", paid:"Paid on project", invoiced:"Invoiced", matchQuality:"Link quality", linkedContracts:"Linked contracts", verified:"code verified", high:"strong match", medium:"estimate", noContracts:"No register contract is linked to this project with sufficient confidence yet.", asOf:"Project data as of", preparation:"Preparation started", delivery:"Delivery started", finish:"Delivery finished", sourceScope:"555 MMP construction-investment projects · not all city expenditure", valueUnknown:"value not stated", allProjects:"projects", matchedProjects:"projects linked to contracts", linkedToProjects:"contracts linked to investment projects", paidByYear:"paid cash allocated by fiscal year", explicitCodes:"direct internal-code matches"
    }
  }[lang];

  document.title = copy.pageTitle;
  document.querySelectorAll("[data-ct-copy]").forEach(node => {
    const value = copy[node.dataset.ctCopy];
    if (value) node.textContent = value;
  });
  const profileLink = document.querySelector('[data-ct-copy="heroBack"]');
  if (profileLink) profileLink.href = new URL(`cz/municipalities/plzen/?lang=${lang}`, assetRoot).href;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const number = value => new Intl.NumberFormat(locale, {maximumFractionDigits:0}).format(value || 0);
  const fullMoney = value => value == null ? "—" : new Intl.NumberFormat(locale, {style:"currency", currency:"CZK", maximumFractionDigits:0}).format(value);
  const compactMoney = value => {
    if (value == null) return "—";
    const absolute = Math.abs(value);
    const unit = absolute >= 1e9 ? (lang === "en" ? "bn" : "mld.") : absolute >= 1e6 ? (lang === "en" ? "m" : "mil.") : absolute >= 1e3 ? (lang === "en" ? "k" : "tis.") : "";
    const divisor = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : absolute >= 1e3 ? 1e3 : 1;
    return `${new Intl.NumberFormat(locale, {maximumFractionDigits: absolute / divisor < 10 ? 1 : 0}).format(value / divisor)} ${unit} Kč`.replace("  ", " ");
  };
  const displayDate = value => value ? new Intl.DateTimeFormat(locale).format(new Date(value)) : "—";
  const monthName = value => new Intl.DateTimeFormat(locale, {month:"short", year:"numeric"}).format(new Date(`${value}-01T12:00:00`));
  const fmtMetric = (value, metric) => metric === "value" ? compactMoney(value) : `${number(value)} ${copy.contracts}`;
  const chart = root.querySelector("#contract-time-chart");
  const chartKpis = root.querySelector("#contract-time-kpis");
  const coverageStrip = root.querySelector("#contract-time-coverage");
  const portfolioChart = root.querySelector("#portfolio-time-chart");
  const portfolioKpis = root.querySelector("#portfolio-time-kpis");
  const projectChart = root.querySelector("#project-time-chart");
  const projectKpis = root.querySelector("#project-time-kpis");
  const projectContracts = root.querySelector("#project-time-contracts");
  const projectSelect = root.querySelector("#project-time-select");
  const state = {data:null, event:"signed", metric:"value", project:"02TUUIN14"};

  function niceMaximum(value) {
    if (!value) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const scaled = value / power;
    const nice = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return nice * power;
  }

  function renderActivity() {
    const rows = state.data.contract_activity_monthly;
    const key = `${state.event}_${state.metric === "value" ? "value_czk" : "count"}`;
    const knownKey = `${state.event}_known_count`;
    const countKey = `${state.event}_count`;
    const values = rows.map(row => Number(row[key] || 0));
    const maximum = niceMaximum(Math.max(0, ...values));
    const minimum = Math.min(0, ...values);
    const domainMinimum = minimum < 0 ? -niceMaximum(Math.abs(minimum)) : 0;
    const domainSize = maximum - domainMinimum;
    const width = 1080, height = 390, left = 66, right = 18, top = 20, bottom = 48;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const step = plotWidth / rows.length, barWidth = Math.max(2, step - 1.5);
    const color = state.event === "signed" ? "#d2674d" : "#315ba6";
    const yFor = value => top + (maximum-value)/domainSize*plotHeight;
    const ticks = domainMinimum < 0 ? [domainMinimum, domainMinimum/2, 0, maximum/2, maximum] : [0, maximum*.25, maximum*.5, maximum*.75, maximum];
    const zeroY = yFor(0);
    const grid = ticks.map(value => {
      const y = yFor(value);
      return `<line class="${value === 0 ? "zero-line" : ""}" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-10}" y="${y+4}" text-anchor="end">${esc(fmtMetric(value, state.metric))}</text>`;
    }).join("");
    const bars = rows.map((row, index) => {
      const value = values[index];
      const valueY = yFor(value);
      const h = Math.abs(zeroY-valueY);
      const y = Math.min(zeroY, valueY);
      const x = left + index * step + (step - barWidth) / 2;
      const label = `${monthName(row.month)} · ${fmtMetric(value, state.metric)}`;
      return `<rect class="${value < 0 ? "negative" : ""}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(h, value ? 1 : 0).toFixed(2)}" fill="${color}" tabindex="0"><title>${esc(label)}</title></rect>`;
    }).join("");
    const yearLabels = rows.map((row, index) => row.month.endsWith("-01") ? `<text class="year-label" x="${(left+(index+.5)*step).toFixed(2)}" y="${height-18}" text-anchor="middle">${esc(row.month.slice(0,4))}</text>` : "").join("");
    const total = values.reduce((sum, value) => sum + value, 0);
    const peakValue = values.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
    const peakIndex = values.indexOf(peakValue);
    const eventCount = rows.reduce((sum, row) => sum + Number(row[countKey] || 0), 0);
    const knownCount = rows.reduce((sum, row) => sum + Number(row[knownKey] || 0), 0);
    const coverage = eventCount ? knownCount / eventCount * 100 : 0;
    chartKpis.innerHTML = [
      [fmtMetric(total, state.metric), copy.total],
      [`${monthName(rows[peakIndex].month)} · ${fmtMetric(values[peakIndex], state.metric)}`, copy.peak],
      [`${new Intl.NumberFormat(locale, {maximumFractionDigits:1}).format(coverage)} %`, `${copy.coverage} · ${number(knownCount)} ${copy.known}`],
      [`${number(state.data.summary.data_quality.publication_lag_median_days)} ${copy.days}`, copy.lag]
    ].map(([value,label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-label="${esc(copy.activityTitle)}"><g class="contract-time-grid">${grid}</g><g class="contract-time-bars">${bars}</g><g class="contract-time-years">${yearLabels}</g></svg>`;
  }

  function renderCoverage() {
    const summary = state.data.summary;
    coverageStrip.innerHTML = [
      [number(summary.projects), copy.allProjects],
      [number(summary.projects_with_contracts), copy.matchedProjects],
      [number(summary.matched_contracts), copy.linkedToProjects],
      [compactMoney(summary.tracked_project_paid_czk), copy.paidByYear]
    ].map(([value,label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
  }

  function renderPortfolio() {
    const rows = state.data.annual_comparison.filter(row => Number(row.year) >= 2016 && Number(row.year) <= 2026);
    const commitments = rows.map(row => Number(row.matched_signed_value_czk || 0));
    const payments = rows.map(row => Number(row.tracked_project_paid_czk || 0));
    const maximum = niceMaximum(Math.max(...commitments, ...payments));
    const width = 1080, height = 390, left = 72, right = 20, top = 34, bottom = 54;
    const plotWidth = width-left-right, plotHeight = height-top-bottom, step = plotWidth/rows.length, zeroY = top+plotHeight;
    const grid = [0,.25,.5,.75,1].map(ratio => {
      const y = top+plotHeight*(1-ratio);
      return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-12}" y="${y+4}" text-anchor="end">${esc(compactMoney(maximum*ratio))}</text>`;
    }).join("");
    const bars = rows.map((row,index) => {
      const x = left+index*step, barWidth = Math.min(30,step*.34);
      const commitmentHeight = commitments[index]/maximum*plotHeight;
      const paymentHeight = payments[index]/maximum*plotHeight;
      return `<g><rect class="commitment-bar" x="${(x+step*.5-barWidth-2).toFixed(2)}" y="${(zeroY-commitmentHeight).toFixed(2)}" width="${barWidth}" height="${Math.max(commitmentHeight,commitments[index]?1:0).toFixed(2)}" tabindex="0"><title>${row.year} · ${esc(copy.contractLane)} · ${esc(fullMoney(commitments[index]))}</title></rect><rect class="payment-bar" x="${(x+step*.5+2).toFixed(2)}" y="${(zeroY-paymentHeight).toFixed(2)}" width="${barWidth}" height="${Math.max(paymentHeight,payments[index]?1:0).toFixed(2)}" tabindex="0"><title>${row.year} · ${esc(copy.paymentLane)} · ${esc(fullMoney(payments[index]))}</title></rect><text class="year-label" x="${(x+step*.5).toFixed(2)}" y="${height-22}" text-anchor="middle">${esc(row.year)}</text></g>`;
    }).join("");
    const summary = state.data.summary;
    portfolioKpis.innerHTML = [
      [compactMoney(summary.tracked_project_paid_czk), copy.paidByYear],
      [number(summary.matched_contracts), copy.linkedToProjects],
      [`${number(summary.projects_with_contracts)} / ${number(summary.projects)}`, copy.matchedProjects],
      [number(summary.match_methods.project_code || 0), copy.explicitCodes]
    ].map(([value,label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    portfolioChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-label="${esc(copy.portfolioTitle)}"><g class="contract-time-grid">${grid}</g><g class="project-bars">${bars}</g><g class="project-chart-legend"><text x="${left}" y="18"><tspan class="commitment-key">■</tspan> ${esc(copy.contractLane)}　<tspan class="payment-key">■</tspan> ${esc(copy.paymentLane)}</text></g></svg>`;
  }

  function projectYears(project) {
    const years = [];
    (project.paid_by_fiscal_year || []).forEach(row => years.push(Number(row.year)));
    (project.matched_contracts || []).forEach(row => {
      const year = Number(String(row.signed_at || "").slice(0,4));
      if (year >= 2016 && year <= 2026) years.push(year);
    });
    (project.budget_by_year || []).forEach(row => years.push(Number(row.year)));
    const minimum = Math.min(...years.filter(Number.isFinite), 2016);
    const maximum = Math.max(...years.filter(Number.isFinite), 2026);
    return Array.from({length:maximum-minimum+1}, (_, index) => minimum + index);
  }

  function renderProject() {
    const project = state.data.projects.find(item => item.code === state.project) || state.data.projects[0];
    if (!project) return;
    state.project = project.code;
    projectSelect.value = project.code;
    const years = projectYears(project);
    const commitments = Object.fromEntries(years.map(year => [year, 0]));
    const payments = Object.fromEntries(years.map(year => [year, 0]));
    (project.matched_contracts || []).forEach(contract => {
      const year = Number(String(contract.signed_at || "").slice(0,4));
      if (year in commitments && contract.value_czk != null) commitments[year] += Number(contract.value_czk);
    });
    (project.paid_by_fiscal_year || []).forEach(payment => {
      if (Number(payment.year) in payments) payments[Number(payment.year)] += Number(payment.amount_czk || 0);
    });
    const maximum = niceMaximum(Math.max(...Object.values(commitments), ...Object.values(payments)));
    const width = Math.max(920, years.length * 92), height = 390, left = 172, right = 24, top = 30, bottom = 58;
    const plotWidth = width-left-right, plotHeight = height-top-bottom, step = plotWidth/years.length;
    const zeroY = top + plotHeight;
    const grid = [0,.25,.5,.75,1].map(ratio => {
      const y = top + plotHeight * (1-ratio);
      return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text x="${left-12}" y="${y+4}" text-anchor="end">${esc(compactMoney(maximum*ratio))}</text>`;
    }).join("");
    const bars = years.map((year,index) => {
      const x = left + index*step;
      const contractHeight = commitments[year]/maximum*plotHeight;
      const paymentHeight = payments[year]/maximum*plotHeight;
      const barWidth = Math.min(26, step*.32);
      return `<g><rect class="commitment-bar" x="${(x+step*.5-barWidth-2).toFixed(2)}" y="${(zeroY-contractHeight).toFixed(2)}" width="${barWidth}" height="${Math.max(contractHeight, commitments[year] ? 1 : 0).toFixed(2)}" tabindex="0"><title>${year} · ${esc(copy.contractLane)} · ${esc(fullMoney(commitments[year]))}</title></rect><rect class="payment-bar" x="${(x+step*.5+2).toFixed(2)}" y="${(zeroY-paymentHeight).toFixed(2)}" width="${barWidth}" height="${Math.max(paymentHeight, payments[year] ? 1 : 0).toFixed(2)}" tabindex="0"><title>${year} · ${esc(copy.paymentLane)} · ${esc(fullMoney(payments[year]))}</title></rect><text class="year-label" x="${(x+step*.5).toFixed(2)}" y="${height-24}" text-anchor="middle">${year}</text></g>`;
    }).join("");
    const linked = project.match_summary || {};
    const qualityParts = [[linked.verified, copy.verified], [linked.high, copy.high], [linked.medium, copy.medium]].filter(([value]) => value).map(([value,label]) => `${number(value)} ${label}`);
    projectKpis.innerHTML = [
      [compactMoney(linked.known_value_czk || 0), `${copy.linkedValue} · ${number(linked.contracts || 0)} ${copy.contracts}`],
      [compactMoney(project.paid_czk || 0), copy.paid],
      [compactMoney(project.invoiced_czk || 0), copy.invoiced],
      [qualityParts.join(" · ") || "—", copy.matchQuality]
    ].map(([value,label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    const phases = [
      [copy.preparation, project.preparation_started_at],
      [copy.delivery, project.delivery_started_at],
      [copy.finish, project.delivery_finished_at],
      [copy.asOf, project.as_of]
    ].filter(([,value]) => value).map(([label,value]) => `<span><b>${esc(label)}</b>${esc(displayDate(value))}</span>`).join("");
    projectChart.innerHTML = `<div class="project-time-heading"><div><span class="project-code">${esc(project.code)}</span><h4>${esc(project.title)}</h4></div><span>${esc(copy.sourceScope)}</span></div><div class="project-phase-strip">${phases}</div><div class="project-chart-scroll"><svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px" aria-label="${esc(project.title)}"><g class="contract-time-grid">${grid}</g><g class="project-bars">${bars}</g><g class="project-chart-legend"><text x="${left}" y="17"><tspan class="commitment-key">■</tspan> ${esc(copy.contractLane)}　<tspan class="payment-key">■</tspan> ${esc(copy.paymentLane)}</text></g></svg></div>`;

    const linkedContracts = [...(project.matched_contracts || [])].sort((a,b) => String(b.signed_at || "").localeCompare(String(a.signed_at || "")));
    projectContracts.innerHTML = `<h4>${esc(copy.linkedContracts)} <span>${number(linkedContracts.length)}</span></h4>${linkedContracts.length ? `<div>${linkedContracts.map(contract => `<a href="${esc(contract.source_url)}" target="_blank" rel="noopener"><time>${esc(displayDate(contract.signed_at))}</time><span><strong>${esc(contract.subject)}</strong><small class="match-${esc(contract.confidence)}">${esc(contract.confidence === "verified" ? copy.verified : contract.confidence === "high" ? copy.high : copy.medium)} · ${esc(fullMoney(contract.value_czk) === "—" ? copy.valueUnknown : fullMoney(contract.value_czk))}</small></span></a>`).join("")}</div>` : `<p>${esc(copy.noContracts)}</p>`}`;
  }

  fetch(new URL("data/contracts/00075370.timeline.v1.json", assetRoot)).then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  }).then(data => {
    state.data = data;
    const projects = [...data.projects].sort((a,b) => {
      const matched = Number((b.match_summary?.contracts || 0) > 0) - Number((a.match_summary?.contracts || 0) > 0);
      return matched || Number(b.paid_czk || 0) - Number(a.paid_czk || 0);
    });
    projectSelect.innerHTML = projects.map(project => `<option value="${esc(project.code)}">${esc(project.code)} · ${esc(project.title)} · ${esc(compactMoney(project.paid_czk || 0))}</option>`).join("");
    const defaultProject = projects.find(project => project.code === state.project) || projects[0];
    state.project = defaultProject.code;
    renderCoverage();
    renderActivity();
    renderPortfolio();
    renderProject();
  }).catch(() => {
    chart.innerHTML = `<p>${esc(copy.error)}</p>`;
    projectChart.innerHTML = `<p>${esc(copy.error)}</p>`;
  });

  root.querySelector("#contract-time-event").addEventListener("change", event => { state.event = event.target.value; renderActivity(); });
  root.querySelector("#contract-time-metric").addEventListener("change", event => { state.metric = event.target.value; renderActivity(); });
  projectSelect.addEventListener("change", event => { state.project = event.target.value; renderProject(); });
})();
