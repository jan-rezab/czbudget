(() => {
  const root = document.querySelector("#ageing-bill-root");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const state = {
    code: (params.get("code") || "CZE").toUpperCase(),
    lang: document.documentElement.lang === "en" ? "en" : "cs",
    year: 2045,
    threshold: 65,
    sex: "total",
    data: null,
    detail: null,
    detailCache: new Map(),
  };
  const names = {
    CZE:["Česko","Czechia"], DEU:["Německo","Germany"], DNK:["Dánsko","Denmark"],
    FRA:["Francie","France"], GBR:["Spojené království","United Kingdom"], POL:["Polsko","Poland"],
    SWE:["Švédsko","Sweden"], CHE:["Švýcarsko","Switzerland"], UKR:["Ukrajina","Ukraine"], USA:["Spojené státy","United States"],
  };
  const copy = {
    cs: {
      projectionKicker:"Oficiální projekce", projectionTitle:"Vývoj populace do vybraného roku", projectionCopy:"Všechny hodnoty jsou počty osob z hlavní nebo střední varianty uvedeného zdroje. Vyberte rok 2025–2045.",
      totalPopulation:"Celková populace", populationChange:"Změna od roku 2025", workingAge:"Věk 20–64", olderPopulation:"Věk 65+", oldestPopulation:"Věk 80+", dependency:"65+ na 100 lidí 20–64", people:"osob", from2025:"od 2025", selectedYear:"Vybraný rok", indexTitle:"Vývoj populace · index 2025 = 100", total:"Celkem", age20:"20–64", age65:"65+", age80:"80+", composition:"Složení populace", age0:"0–19", projectionVariant:"Varianta projekce",
      calculatorKicker:"Demografická kalkulačka", calculatorTitle:"Posuňte si věkovou hranici", calculatorCopy:"Kalkulačka sčítá uložené řádky věk × pohlaví × rok. Hranice je statistická, nikoli předpoklad skutečného věku odchodu do důchodu.", year:"Rok", boundary:"Statistická hranice", boundaryHint:"Pracovní věk je zde pouze počet osob od 20 let do roku před zvolenou hranicí.", group:"Skupina", all:"Celkem", men:"Muži", women:"Ženy", belowBoundary:"Věk 20 až", atBoundary:"Věk", andOlder:"a více", per100:"na 100 osob pod hranicí", peopleBelow:"Osob pod hranicí na jednu osobu nad ní", shareTotal:"Podíl skupiny nad hranicí", noFiscal:"Toto není projekce zaměstnanosti, důchodů, zdravotních nákladů, daní ani veřejného dluhu. Výpočet používá pouze věk, pohlaví a počet osob.",
      comparisonKicker:"Deset zemí", comparisonTitle:"Deset zemí ve stejném roce", comparisonCopy:"Pořadí je pouze podle poměru osob ve věku 65+ k populaci 20–64. Nejde o žebříček kvality politik ani fiskální udržitelnosti.", country:"Země", change:"Populace vs. 2025", workingChange:"20–64 vs. 2025", share65:"Podíl 65+", share80:"Podíl 80+", ratio:"65+ / 100 lidí 20–64",
      methodKicker:"Rozsah a zdroj", methodTitle:"Oficiální varianty projekcí a vlastní součty", methodCopy:"Každá země používá pojmenovanou oficiální hlavní nebo střední variantu. Společné statistiky počítáme přímo z uložených jednoletých věkových řádků.", referenceDate:"Referenční datum", rows:"uložených řádků", openSource:"Otevřít zdroj", download:"Stáhnout věk × pohlaví × rok", commonMethod:"Společná metodika", methodBody:"Období pro srovnání je omezeno na roky 2025–2045, které mají všechny země. Věk 100+ zůstává otevřeným horním pásmem. Chybějící údaj není nula a žádná hodnota není převáděna na peníze.", loading:"Načítám detailní věková data…", error:"Projekční data se nepodařilo načíst.",
    },
    en: {
      projectionKicker:"Official projection", projectionTitle:"Population change to the selected year", projectionCopy:"Every value is a person count from the named principal or middle projection variant. Select a year from 2025 to 2045.",
      totalPopulation:"Total population", populationChange:"Change since 2025", workingAge:"Ages 20–64", olderPopulation:"Ages 65+", oldestPopulation:"Ages 80+", dependency:"People 65+ per 100 aged 20–64", people:"people", from2025:"since 2025", selectedYear:"Selected year", indexTitle:"Population path · index 2025 = 100", total:"Total", age20:"20–64", age65:"65+", age80:"80+", composition:"Population composition", age0:"0–19", projectionVariant:"Projection variant",
      calculatorKicker:"Demographic calculator", calculatorTitle:"Set your own age boundary", calculatorCopy:"The calculator sums the stored age × sex × year rows. The boundary is statistical, not an assumption about the actual retirement age.", year:"Year", boundary:"Statistical age boundary", boundaryHint:"Working age here means only the number of people from age 20 through the year before the selected boundary.", group:"Group", all:"Total", men:"Men", women:"Women", belowBoundary:"Ages 20 to", atBoundary:"Ages", andOlder:"and over", per100:"per 100 people below the boundary", peopleBelow:"People below the boundary per one person above it", shareTotal:"Share of total at or above boundary", noFiscal:"This is not a forecast of employment, pensions, healthcare costs, taxes or public debt. The calculation uses only age, sex and person counts.",
      comparisonKicker:"Ten countries", comparisonTitle:"Ten countries in the same year", comparisonCopy:"Countries are ordered only by people aged 65+ relative to ages 20–64. This is not a ranking of policy quality or fiscal sustainability.", country:"Country", change:"Population vs 2025", workingChange:"20–64 vs 2025", share65:"Share aged 65+", share80:"Share aged 80+", ratio:"65+ / 100 aged 20–64",
      methodKicker:"Scope and source", methodTitle:"Official projection variants and our own sums", methodCopy:"Each country uses a named official principal or middle variant. Shared statistics are calculated directly from the stored single-year-of-age rows.", referenceDate:"Reference date", rows:"stored rows", openSource:"Open source", download:"Download age × sex × year", commonMethod:"Shared method", methodBody:"The comparison window is limited to 2025–2045, available for every country. Age 100+ remains an open-ended top band. Missing data are not zero and no value is converted into money.", loading:"Loading detailed age data…", error:"Projection data could not be loaded.",
    },
  };

  const t = () => copy[state.lang];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const integer = value => Number(value).toLocaleString(locale(), {maximumFractionDigits:0});
  const decimal = (value, digits = 1) => Number(value).toLocaleString(locale(), {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const pct = (from, to) => from ? (to / from - 1) * 100 : 0;
  const signed = value => `${value > 0 ? "+" : ""}${decimal(value)} %`;
  const classFor = value => value > 0 ? "aging-positive" : value < 0 ? "aging-negative" : "";
  const countryName = code => names[code]?.[state.lang === "en" ? 1 : 0] || code;
  const profile = () => state.data?.countries[state.code];
  const rowFor = (country, year) => country?.years.find(row => row.year === year);
  const older = row => row.age_65_79 + row.age_80_plus;

  function lineChart(country) {
    const rows = country.years, width = 900, height = 300, pad = {l:54,r:24,t:20,b:38};
    const base = rows[0];
    const series = [
      ["total", row => row.total / base.total * 100],
      ["working", row => row.age_20_64 / base.age_20_64 * 100],
      ["older", row => older(row) / older(base) * 100],
      ["oldest", row => row.age_80_plus / base.age_80_plus * 100],
    ];
    const values = series.flatMap(([,fn]) => rows.map(fn));
    const min = Math.floor(Math.min(...values) / 10) * 10, max = Math.ceil(Math.max(...values) / 10) * 10;
    const x = year => pad.l + (year - 2025) / 20 * (width - pad.l - pad.r);
    const y = value => pad.t + (max - value) / Math.max(1, max - min) * (height - pad.t - pad.b);
    const gridValues = Array.from({length:(max-min)/10+1}, (_,index) => min + index * 10);
    const grid = gridValues.map(value => `<line x1="${pad.l}" y1="${y(value)}" x2="${width-pad.r}" y2="${y(value)}"/><text class="axis" x="${pad.l-9}" y="${y(value)+4}" text-anchor="end">${value}</text>`).join("");
    const paths = series.map(([key,fn]) => `<path class="${key}" d="${rows.map((row,index) => `${index ? "L" : "M"}${x(row.year).toFixed(1)},${y(fn(row)).toFixed(1)}`).join(" ")}"/>`).join("");
    const selected = rowFor(country, state.year);
    const dots = series.map(([key,fn]) => `<circle class="${key}" cx="${x(state.year)}" cy="${y(fn(selected))}" r="5"><title>${key}: ${decimal(fn(selected))}</title></circle>`).join("");
    return `<svg class="aging-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t().indexTitle)}"><g class="grid">${grid}</g><line class="marker" x1="${x(state.year)}" y1="${pad.t}" x2="${x(state.year)}" y2="${height-pad.b}"/>${paths}${dots}<text class="axis" x="${pad.l}" y="${height-10}">2025</text><text class="axis" x="${width-pad.r}" y="${height-10}" text-anchor="end">2045</text><text class="axis" x="${x(state.year)}" y="${pad.t+12}" text-anchor="middle">${state.year}</text></svg>`;
  }

  function composition(country) {
    const years = [2025,2030,2035,2040,2045];
    return `<div class="aging-composition">${years.map(year => {
      const row = rowFor(country, year);
      return `<div class="aging-composition-row"><b>${year}</b><div class="aging-stack"><i class="young" style="width:${row.shares_pct.age_0_19}%"></i><i class="working" style="width:${row.shares_pct.age_20_64}%"></i><i class="older" style="width:${row.shares_pct.age_65_79}%"></i><i class="oldest" style="width:${row.shares_pct.age_80_plus}%"></i></div><strong>${integer(row.total)}</strong></div>`;
    }).join("")}</div><div class="aging-composition-legend"><span class="young"><i></i>${t().age0}</span><span class="working"><i></i>${t().age20}</span><span class="older"><i></i>${t().age65.replace("+", "–79")}</span><span class="oldest"><i></i>${t().age80}</span></div>`;
  }

  function detailStats() {
    if (!state.detail) return null;
    const valueIndex = {male:3,female:4,total:5}[state.sex];
    const rows = state.detail.rows.filter(row => row[0] === state.year);
    const sum = predicate => rows.filter(predicate).reduce((total,row) => total + row[valueIndex], 0);
    const working = sum(row => row[1] >= 20 && row[1] < state.threshold);
    const above = sum(row => row[1] >= state.threshold);
    const total = sum(() => true);
    return {working,above,total,per100:working ? above / working * 100 : 0, inverse:above ? working / above : 0, share:total ? above / total * 100 : 0};
  }

  function updateCalculator() {
    const stats = detailStats();
    const outputYear = document.querySelector("#aging-year-output"), outputBoundary = document.querySelector("#aging-boundary-output");
    if (outputYear) outputYear.textContent = state.year;
    if (outputBoundary) outputBoundary.textContent = `${state.threshold}+`;
    if (!stats) return;
    const labels = {
      working:`${t().belowBoundary} ${state.threshold - 1}`,
      above:`${t().atBoundary} ${state.threshold} ${t().andOlder}`,
    };
    document.querySelector("#aging-calculator-results").innerHTML = `<article><span>${esc(labels.working)}</span><strong>${integer(stats.working)}</strong><small>${t().people}</small></article><article><span>${esc(labels.above)}</span><strong>${integer(stats.above)}</strong><small>${t().people}</small></article><article><span>${esc(labels.above)} ${t().per100}</span><strong>${decimal(stats.per100)}</strong><small>${integer(stats.above)} / ${integer(stats.working)}</small></article><article><span>${t().peopleBelow}</span><strong>${decimal(stats.inverse,2)}</strong><small>${t().shareTotal}: ${decimal(stats.share)} %</small></article><p class="aging-disclaimer">${t().noFiscal}</p>`;
  }

  function comparison() {
    const rows = Object.entries(state.data.countries).map(([code,country]) => {
      const base = rowFor(country, 2025), selected = rowFor(country, state.year);
      return {code,country,base,selected,dependency:selected.old_age_dependency_per_100_working_age};
    }).sort((a,b) => b.dependency - a.dependency);
    return `<div class="aging-table-wrap"><table class="aging-table"><thead><tr><th>${t().country}</th><th>${t().change}</th><th>${t().workingChange}</th><th>${t().share65}</th><th>${t().share80}</th><th>${t().ratio}</th></tr></thead><tbody>${rows.map((item,index) => {
      const share65 = older(item.selected) / item.selected.total * 100;
      return `<tr class="${item.code === state.code ? "selected" : ""}"><td><span class="rank">${index+1}</span><button type="button" data-aging-country="${item.code}">${esc(countryName(item.code))}</button></td><td class="${classFor(pct(item.base.total,item.selected.total))}">${signed(pct(item.base.total,item.selected.total))}</td><td class="${classFor(pct(item.base.age_20_64,item.selected.age_20_64))}">${signed(pct(item.base.age_20_64,item.selected.age_20_64))}</td><td>${decimal(share65)} %</td><td>${decimal(item.selected.shares_pct.age_80_plus)} %</td><td><strong>${decimal(item.dependency)}</strong></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function render() {
    const country = profile();
    if (!country) return;
    const base = rowFor(country, 2025), selected = rowFor(country, state.year);
    const populationDelta = pct(base.total, selected.total), workingDelta = pct(base.age_20_64, selected.age_20_64), olderDelta = pct(older(base), older(selected)), oldestDelta = pct(base.age_80_plus, selected.age_80_plus);
    root.innerHTML = `<section class="aging-section" id="projection"><div class="aging-heading"><div><span class="kicker">${t().projectionKicker}</span><h2>${t().projectionTitle}</h2></div><p>${t().projectionCopy}</p></div>
      <div class="aging-kpis"><article><span>${t().totalPopulation}</span><strong>${integer(selected.total)}</strong><small class="${classFor(populationDelta)}">${signed(populationDelta)} ${t().from2025}</small></article><article><span>${t().workingAge}</span><strong>${integer(selected.age_20_64)}</strong><small class="${classFor(workingDelta)}">${signed(workingDelta)} ${t().from2025}</small></article><article><span>${t().olderPopulation}</span><strong>${integer(older(selected))}</strong><small class="${classFor(olderDelta)}">${signed(olderDelta)} ${t().from2025}</small></article><article><span>${t().oldestPopulation}</span><strong>${integer(selected.age_80_plus)}</strong><small class="${classFor(oldestDelta)}">${signed(oldestDelta)} ${t().from2025}</small></article></div>
      <article class="aging-timeline"><header><div><span class="kicker">${t().selectedYear} · ${state.year}</span><h3>${esc(country.projection)}</h3></div><div class="aging-legend"><span><i></i>${t().total}</span><span class="working"><i></i>${t().age20}</span><span class="older"><i></i>${t().age65}</span><span class="oldest"><i></i>${t().age80}</span></div></header>${lineChart(country)}<h3>${t().composition}</h3>${composition(country)}</article></section>
      <section class="aging-section" id="calculator"><div class="aging-heading"><div><span class="kicker">${t().calculatorKicker}</span><h2>${t().calculatorTitle}</h2></div><p>${t().calculatorCopy}</p></div><div class="aging-calculator"><div class="aging-controls"><div class="aging-control"><label for="aging-year"><span>${t().year}</span><output id="aging-year-output">${state.year}</output></label><input id="aging-year" type="range" min="2025" max="2045" step="1" value="${state.year}"></div><div class="aging-control"><label for="aging-boundary"><span>${t().boundary}</span><output id="aging-boundary-output">${state.threshold}+</output></label><input id="aging-boundary" type="range" min="60" max="75" step="1" value="${state.threshold}"><small>${t().boundaryHint}</small></div><div class="aging-control"><label for="aging-sex"><span>${t().group}</span></label><select id="aging-sex"><option value="total" ${state.sex === "total" ? "selected" : ""}>${t().all}</option><option value="male" ${state.sex === "male" ? "selected" : ""}>${t().men}</option><option value="female" ${state.sex === "female" ? "selected" : ""}>${t().women}</option></select></div></div><div class="aging-calculator-results" id="aging-calculator-results"><p class="aging-disclaimer">${t().loading}</p></div></div></section>
      <section class="aging-section" id="comparison"><div class="aging-heading"><div><span class="kicker">${t().comparisonKicker}</span><h2>${t().comparisonTitle}</h2></div><p>${t().comparisonCopy}</p></div>${comparison()}</section>
      <section class="aging-section" id="method"><div class="aging-heading"><div><span class="kicker">${t().methodKicker}</span><h2>${t().methodTitle}</h2></div><p>${t().methodCopy}</p></div><div class="aging-method-grid"><article class="aging-source-card"><span>${t().projectionVariant}</span><h3>${esc(country.projection)}</h3><p>${esc(country.source.location || country.coverage)} · ${t().referenceDate}: ${esc(country.reference_date)} · ${esc(country.source.period)}</p><div><a href="${esc(country.source.url)}" target="_blank" rel="noreferrer">${t().openSource} ↗</a><a href="../../${esc(country.detail)}">${t().download} ↗</a></div></article><article class="aging-source-card"><span>${t().commonMethod}</span><h3>2025–2045</h3><p>${t().methodBody}</p><div><strong>${integer(country.detail_row_count)} ${t().rows}</strong></div></article></div><p class="aging-method-note">${esc(state.data.methodology[state.lang])}</p></section>`;
    bind();
    updateCalculator();
  }

  function bind() {
    const year = document.querySelector("#aging-year"), boundary = document.querySelector("#aging-boundary"), sex = document.querySelector("#aging-sex");
    year?.addEventListener("input", () => { state.year = Number(year.value); updateCalculator(); });
    year?.addEventListener("change", render);
    boundary?.addEventListener("input", () => { state.threshold = Number(boundary.value); updateCalculator(); });
    sex?.addEventListener("change", () => { state.sex = sex.value; updateCalculator(); });
    document.querySelectorAll("[data-aging-country]").forEach(button => button.addEventListener("click", () => chooseCountry(button.dataset.agingCountry)));
  }

  async function loadDetail() {
    const country = profile();
    if (!country) return;
    if (!state.detailCache.has(state.code)) {
      const response = await fetch(`../../${country.detail}`);
      if (!response.ok) throw new Error(response.status);
      state.detailCache.set(state.code, await response.json());
    }
    state.detail = state.detailCache.get(state.code);
    updateCalculator();
  }

  function chooseCountry(code) {
    if (!state.data?.countries[code]) return;
    state.code = code; state.detail = null;
    const selector = document.querySelector("#deep-dive-country");
    if (selector) selector.value = code;
    const url = new URL(location.href); url.searchParams.set("code", code); url.searchParams.set("lang", state.lang); history.replaceState({}, "", url);
    const title = document.querySelector("#deep-dive-country-name"), badge = document.querySelector("#deep-dive-country-code"), link = document.querySelector("#deep-dive-country-profile");
    if (title) title.textContent = countryName(code); if (badge) badge.textContent = code; if (link) link.href = window.PSDCountryRoutes.href(code,state.lang);
    render(); loadDetail().catch(showError);
  }

  function showError(error) {
    console.error("Ageing projection", error);
    const target = document.querySelector("#aging-calculator-results");
    if (target) target.innerHTML = `<p class="aging-disclaimer">${t().error}</p>`;
    else root.innerHTML = `<p class="aging-loading">${t().error}</p>`;
  }

  addEventListener("countryprofilechange", event => {
    state.lang = event.detail.lang === "en" ? "en" : "cs";
    if (event.detail.code !== state.code) chooseCountry(event.detail.code);
  });
  fetch("../../data/country-demography.v1.json").then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  }).then(data => {
    state.data = data;
    if (!data.countries[state.code]) state.code = "CZE";
    render(); return loadDetail();
  }).catch(showError);
})();
