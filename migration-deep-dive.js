(() => {
  const assetRoot = new URL(".", document.currentScript.src).href;
  const params = new URLSearchParams(location.search);
  const state = {
    data: null,
    geometry: null,
    country: params.get("code") || "EU27",
    year: Number(params.get("year")) || 2024,
    mapMetric: "net",
    trendUnit: "absolute",
    rankingUnit: "rate",
  };
  const copy = {
    cs: {
      eyebrow:"Hloubkový profil / EU-27",titleLead:"Evropa",titleEm:"v pohybu.",intro:"Přistěhování, vystěhování a výsledné saldo všech 27 členských států v jedné srovnatelné časové řadě.",heroCta:"Otevřít migrační mapu ↓",dataset:"Nejnovější úplný součet EU",arrivals:"Přistěhování",departures:"Vystěhování",balance:"Saldo",coverage:"Pokrytí",heroNote:"Počet migračních událostí; předběžné a odhadované hodnoty zůstávají označené.",
      navMap:"Mapa",navTrend:"Vývoj",navRanking:"Srovnání",navAtlas:"Atlas zemí",navMethod:"Metodika",arrivalLabel:"PŘISTĚHOVÁNÍ",arrivalDefinition:"Nové obvyklé bydliště alespoň na 12 měsíců.",departureLabel:"VYSTĚHOVÁNÍ",departureDefinition:"Ukončení obvyklého bydliště alespoň na 12 měsíců.",netLabel:"SALDO",netDefinition:"Přistěhování minus vystěhování; ne totéž co statisticky dopočtená čistá migrace.",
      mapKicker:"01 / Signaturní pohled",mapTitle:"Jedna Evropa. Velmi rozdílná intenzita.",mapIntro:"Mapa přepočítává migrační toky na 1 000 obyvatel, aby malé a velké státy šlo číst na stejné stupnici.",year:"Rok",metric:"Ukazatel",perThousand:"na 1 000 obyvatel",mapSource:"Zdroj: Eurostat migr_imm8, migr_emi2 a demo_gind.",trendKicker:"02 / Vývoj v čase",trendTitle:"Příchody a odchody, ne jen výsledné číslo.",trendIntro:"Stejné saldo může vzniknout z malých i velmi velkých protisměrných toků. Proto zobrazujeme obě strany vedle výsledku.",country:"Země",unit:"Jednotka",people:"Osoby",trendSource:"Roční migrační události. Mezery znamenají chybějící data, nikoli nulu.",
      rankingKicker:"03 / Srovnání zemí",rankingTitle:"Měřítko a intenzita vyprávějí jiný příběh.",rankingIntro:"Přepínač odděluje absolutní počet lidí od intenzity vzhledem k velikosti populace.",rankingMeasure:"Zobrazení",atlasKicker:"04 / Atlas EU-27",atlasTitle:"Všechny země. Stejný rok. Stejná definice.",atlasIntro:"Tabulka používá rok zvolený na mapě a přiznává chybějící nebo označené hodnoty.",netRate:"Saldo / 1 000",quality:"Kvalita",methodKicker:"05 / Jak data číst",methodTitle:"Tok lidí, ne počet migrantů.",methodIntro:"Jedna osoba může během delšího období vytvořit více migračních událostí. Čísla neříkají státní občanství, důvod přesunu ani právní status.",
      methodFlowTitle:"Událost",methodFlow:"Roční počet přistěhování a vystěhování podle obvyklého bydliště a dvanáctiměsíčního pravidla.",methodAggregateTitle:"Součet EU",methodAggregate:"Pohyb mezi dvěma státy EU vstupuje do přistěhování jedné země a vystěhování druhé. Součet není počet překročení vnější hranice.",methodRateTitle:"Intenzita",methodRate:"Sazba dělí tok průměrnou roční populací z demo_gind a násobí jej 1 000.",methodQualityTitle:"Revize",methodQuality:"Eurostat označuje zlomy, odhady, předběžná čísla a hodnoty s metodickou poznámkou. Zdroj se může revidovat.",openImmigration:"Otevřít přistěhování v Eurostatu ↗",openEmigration:"Otevřít vystěhování v Eurostatu ↗",openMetadata:"Metodika Eurostatu ↗",footer:"European migration · Eurostat",eu27:"Evropská unie — 27 zemí",noData:"Pro tento rok není srovnatelná hodnota.",ofPopulation:"na 1 000 obyvatel",population:"Průměrná populace",status:"Označení Eurostatu",countriesAvailable:(n,total)=>`${n} z ${total} zemí má hodnotu pro vybraný rok.`,flag_b:"zlom řady",flag_e:"odhad",flag_i:"viz metodika",flag_p:"předběžné",selectedYear:"Vybraný rok",positive:"kladné saldo",negative:"záporné saldo",chartUnitPeople:"osob",chartUnitRate:"na 1 000 obyvatel",loadError:"Migrační data se nepodařilo načíst."
    },
    en: {
      eyebrow:"Deep dive / EU-27",titleLead:"Europe",titleEm:"in motion.",intro:"Immigration, emigration and the resulting balance for all 27 Member States in one comparable time series.",heroCta:"Open the migration map ↓",dataset:"Latest complete EU total",arrivals:"Immigration",departures:"Emigration",balance:"Balance",coverage:"Coverage",heroNote:"Migration events; provisional and estimated values remain visibly flagged.",
      navMap:"Map",navTrend:"Trend",navRanking:"Comparison",navAtlas:"Country atlas",navMethod:"Method",arrivalLabel:"IMMIGRATION",arrivalDefinition:"A new usual residence expected to last at least 12 months.",departureLabel:"EMIGRATION",departureDefinition:"Ending usual residence for at least 12 months.",netLabel:"BALANCE",netDefinition:"Immigration minus emigration; not the same as statistically adjusted net migration.",
      mapKicker:"01 / Signature view",mapTitle:"One Europe. Very different intensity.",mapIntro:"The map scales migration flows per 1,000 residents so small and large Member States can be read on the same footing.",year:"Year",metric:"Measure",perThousand:"per 1,000 residents",mapSource:"Source: Eurostat migr_imm8, migr_emi2 and demo_gind.",trendKicker:"02 / Change over time",trendTitle:"Arrivals and departures, not only the result.",trendIntro:"The same balance can come from small or very large flows in opposite directions. Both sides therefore remain visible beside the result.",country:"Country",unit:"Unit",people:"People",trendSource:"Annual migration events. Gaps mean missing data, not zero.",
      rankingKicker:"03 / Country comparison",rankingTitle:"Scale and intensity tell different stories.",rankingIntro:"The switch separates the absolute number of people from intensity relative to population size.",rankingMeasure:"View",atlasKicker:"04 / EU-27 atlas",atlasTitle:"Every country. Same year. Same definition.",atlasIntro:"The table follows the year selected on the map and keeps missing or flagged values visible.",netRate:"Balance / 1,000",quality:"Quality",methodKicker:"05 / How to read it",methodTitle:"Flows of people, not a migrant population.",methodIntro:"One person can generate more than one migration event over a longer period. These numbers do not describe citizenship, reason for moving or legal status.",
      methodFlowTitle:"Event",methodFlow:"Annual immigration and emigration under the usual-residence and twelve-month definitions.",methodAggregateTitle:"EU total",methodAggregate:"A move between two EU states enters immigration in one country and emigration in the other. The total is not a count of external-border crossings.",methodRateTitle:"Intensity",methodRate:"The rate divides each flow by average annual population from demo_gind and multiplies by 1,000.",methodQualityTitle:"Revisions",methodQuality:"Eurostat flags breaks, estimates, provisional figures and values with methodological notes. Source data can be revised.",openImmigration:"Open immigration in Eurostat ↗",openEmigration:"Open emigration in Eurostat ↗",openMetadata:"Eurostat methodology ↗",footer:"European migration · Eurostat",eu27:"European Union — 27 countries",noData:"No comparable value is available for this year.",ofPopulation:"per 1,000 residents",population:"Average population",status:"Eurostat flag",countriesAvailable:(n,total)=>`${n} of ${total} countries have a value for the selected year.`,flag_b:"break in series",flag_e:"estimated",flag_i:"see metadata",flag_p:"provisional",selectedYear:"Selected year",positive:"positive balance",negative:"negative balance",chartUnitPeople:"people",chartUnitRate:"per 1,000 residents",loadError:"Migration data could not be loaded."
    }
  };
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const t = (key) => copy[lang()][key];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const number = (value, digits = 0) => value == null ? "—" : new Intl.NumberFormat(locale(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  const compact = (value) => value == null ? "—" : new Intl.NumberFormat(locale(), { notation:"compact", maximumFractionDigits:1 }).format(value);
  const signed = (value, digits = 0) => value == null ? "—" : `${value > 0 ? "+" : ""}${number(value, digits)}`;
  const metricKey = (metric, unit = "absolute") => unit === "rate" ? `${metric}_per_1000` : metric;
  const country = (code = state.country) => state.data.countries.find((item) => item.iso3 === code);
  const countryName = (item) => lang() === "en" ? item.name_en : item.name_cs;
  const rows = (code = state.country) => code === "EU27" ? state.data.eu27 : country(code)?.rows || [];
  const rowAt = (code, year) => rows(code).find((row) => row.year === year);
  const selectedName = () => state.country === "EU27" ? t("eu27") : countryName(country());

  function translate() {
    document.querySelectorAll("[data-migration-copy]").forEach((node) => {
      const value = t(node.dataset.migrationCopy);
      if (typeof value === "string") node.textContent = value;
    });
    document.title = lang() === "en" ? "European migration over time — Public Spending Data" : "Evropská migrace v čase — Public Spending Data";
    document.querySelector('meta[name="description"]').content = lang() === "en" ? "Immigration, emigration and migration balance across all 27 EU countries from 2000 to 2024, based on Eurostat." : "Přistěhování, vystěhování a migrační saldo všech 27 zemí EU v letech 2000–2024 podle Eurostatu.";
  }

  function statusLabels(flags) {
    const codes = [...new Set(Object.values(flags || {}).filter(Boolean).join("").replace(/[^beip]/g, "").split(""))];
    return codes.map((code) => t(`flag_${code}`));
  }

  function updateUrl() {
    const url = new URL(location.href);
    if (state.country === "EU27") url.searchParams.delete("code"); else url.searchParams.set("code", state.country);
    url.searchParams.set("year", state.year);
    url.searchParams.set("lang", lang());
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function renderHero() {
    const latest = [...state.data.eu27].reverse().find((row) => row.immigration != null && row.emigration != null);
    $("#hero-year").textContent = latest.year;
    $("#hero-immigration").textContent = compact(latest.immigration);
    $("#hero-emigration").textContent = compact(latest.emigration);
    $("#hero-net").textContent = signed(latest.net);
  }

  function interpolate(a, b, amount) {
    const parse = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    const start = parse(a), end = parse(b);
    return `#${start.map((value, index) => Math.round(value + (end[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
  }

  function renderMap() {
    const values = state.data.countries.map((item) => rowAt(item.iso3, state.year)?.[`${state.mapMetric}_per_1000`]).filter(Number.isFinite);
    const magnitudes = values.map(Math.abs).sort((a,b)=>a-b);
    const max = Math.max(1, magnitudes[Math.floor((magnitudes.length-1)*.9)] || 1);
    const fill = (value) => {
      if (!Number.isFinite(value)) return "url(#missing-data)";
      if (state.mapMetric === "net") return value < 0 ? interpolate("#ece7db", "#c93237", Math.min(1, Math.abs(value) / max)) : interpolate("#ece7db", "#a8b63f", Math.min(1, value / max));
      return interpolate("#ece7db", "#a8b63f", Math.min(1, value / max));
    };
    const geometry = new Map(state.geometry.locations.map((location) => [location.id, location]));
    const paths = state.data.countries.map((item) => {
      const location = geometry.get(item.map_id);
      if (!location) return "";
      const value = rowAt(item.iso3, state.year)?.[`${state.mapMetric}_per_1000`];
      return `<path class="migration-country-shape ${item.iso3 === state.country ? "selected" : ""}" data-country="${item.iso3}" d="${location.path}" style="fill:${fill(value)}" role="button" tabindex="0"><title>${esc(countryName(item))}: ${Number.isFinite(value) ? signed(value, 1) : t("noData")}</title></path>`;
    }).join("");
    $("#migration-map").innerHTML = `<svg viewBox="435 172 150 230" role="group" aria-label="${esc(t("mapTitle"))}"><defs><pattern id="missing-data" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#ddd8ce"></rect><path d="M0 4L4 0" stroke="#b5b0a6" stroke-width=".7"></path></pattern></defs>${paths}</svg>`;
    $("#migration-map").querySelectorAll("[data-country]").forEach((path) => { path.addEventListener("click", () => selectCountry(path.dataset.country)); path.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectCountry(path.dataset.country)}}); });
    $("#map-scale-low").textContent = state.mapMetric === "net" ? signed(-max, 1) : "0";
    $("#map-scale-high").textContent = `≥ ${signed(max, 1)}`;
    const scale = $(".migration-map-figure figcaption i");
    scale.style.background = state.mapMetric === "net" ? "linear-gradient(90deg,#c93237,#ece7db,#a8b63f)" : "linear-gradient(90deg,#ece7db,#a8b63f)";
    renderMapReadout();
  }

  function renderMapReadout() {
    const row = rowAt(state.country, state.year);
    const metric = row?.[state.mapMetric];
    const rate = row?.[`${state.mapMetric}_per_1000`];
    const flags = statusLabels(row?.flags);
    const metricLabel = state.mapMetric === "immigration" ? t("arrivals") : state.mapMetric === "emigration" ? t("departures") : t("balance");
    $("#migration-map-readout").innerHTML = `<span>${state.year} · ${esc(metricLabel)}</span><h3>${esc(selectedName())}</h3>${metric == null ? `<p>${esc(t("noData"))}</p>` : `<strong class="${metric < 0 ? "negative" : metric > 0 ? "positive" : ""}">${state.mapMetric === "net" ? signed(metric) : number(metric)}</strong><dl><div><dt>${esc(t("ofPopulation"))}</dt><dd>${state.mapMetric === "net" ? signed(rate, 1) : number(rate, 1)}</dd></div><div><dt>${esc(t("population"))}</dt><dd>${compact(row.population)}</dd></div><div><dt>${esc(t("status"))}</dt><dd>${esc(flags.join(" · ") || "—")}</dd></div></dl>`}`;
  }

  function linePath(points, x, y) {
    const segments = [];
    let current = [];
    points.forEach((point) => {
      if (!Number.isFinite(point.value)) { if (current.length) segments.push(current); current = []; return; }
      current.push(point);
    });
    if (current.length) segments.push(current);
    return segments.map((segment) => segment.map((point, index) => `${index ? "L" : "M"}${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")).join(" ");
  }

  function renderTrend() {
    const dataRows = rows();
    const unit = state.trendUnit;
    const series = ["immigration", "emigration", "net"].map((metric) => ({ metric, points:dataRows.map((row) => ({ year:row.year, value:row[metricKey(metric, unit)] })) }));
    const values = series.flatMap((item) => item.points.map((point) => point.value)).filter(Number.isFinite);
    if (!values.length) { $("#migration-line-chart").innerHTML = `<p class="migration-empty">${esc(t("noData"))}</p>`; return; }
    const W = 1040, H = 430, left = 75, right = 24, top = 20, bottom = 48;
    const minYear = Math.min(...dataRows.map((row) => row.year)), maxYear = Math.max(...dataRows.map((row) => row.year));
    const rawMin = Math.min(0, ...values), rawMax = Math.max(0, ...values);
    const padding = (rawMax - rawMin || 1) * .08;
    const min = rawMin < 0 ? rawMin - padding : 0, max = rawMax + padding;
    const x = (year) => left + (year - minYear) / (maxYear - minYear || 1) * (W - left - right);
    const y = (value) => top + (max - value) / (max - min || 1) * (H - top - bottom);
    const yTicks = Array.from({ length:5 }, (_, index) => min + (max - min) * index / 4);
    const grid = yTicks.map((tick) => `<line class="${Math.abs(tick) < (max-min)/100 ? "migration-zero-line" : "migration-grid-line"}" x1="${left}" x2="${W-right}" y1="${y(tick)}" y2="${y(tick)}"></line><text class="migration-axis-label" x="${left-10}" y="${y(tick)+4}" text-anchor="end">${esc(unit === "rate" ? number(tick,1) : compact(tick))}</text>`).join("");
    const xTicks = [2000,2005,2010,2015,2020,2024].filter((year) => year >= minYear && year <= maxYear).map((year) => `<text class="migration-axis-label" x="${x(year)}" y="${H-17}" text-anchor="middle">${year}</text>`).join("");
    const paths = series.map((item) => `<path class="migration-line ${item.metric}" d="${linePath(item.points,x,y)}"></path>`).join("");
    $("#migration-line-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${selectedName()} — ${t("trendTitle")}`)}">${grid}${xTicks}${paths}<line id="migration-focus-line" class="migration-focus-line" x1="0" x2="0" y1="${top}" y2="${H-bottom}" hidden></line><rect class="migration-hit" x="${left}" y="${top}" width="${W-left-right}" height="${H-top-bottom}"></rect></svg>`;
    const svg = $("#migration-line-chart svg");
    const detail = (year) => {
      const row = dataRows.reduce((best, candidate) => Math.abs(candidate.year-year) < Math.abs(best.year-year) ? candidate : best, dataRows[0]);
      const format = (metric) => unit === "rate" ? (metric === "net" ? signed(row[metricKey(metric,unit)],1) : number(row[metricKey(metric,unit)],1)) : (metric === "net" ? signed(row[metric],0) : number(row[metric]));
      $("#migration-line-detail").innerHTML = `<strong>${row.year}</strong><span>${esc(t("arrivals"))}: ${format("immigration")}</span><span>${esc(t("departures"))}: ${format("emigration")}</span><span>${esc(t("balance"))}: ${format("net")}</span><span>${esc(unit === "rate" ? t("chartUnitRate") : t("chartUnitPeople"))}</span>`;
      const focus = $("#migration-focus-line"); focus.hidden = false; focus.setAttribute("x1", x(row.year)); focus.setAttribute("x2", x(row.year));
    };
    detail(dataRows.at(-1).year);
    svg.querySelector(".migration-hit").addEventListener("pointermove", (event) => { const rect = svg.getBoundingClientRect(); const viewX = (event.clientX-rect.left)/rect.width*W; detail(minYear + (viewX-left)/(W-left-right)*(maxYear-minYear)); });
  }

  function rankingRows() {
    const key = metricKey(state.mapMetric, state.rankingUnit);
    return state.data.countries.map((item) => ({ item, value:rowAt(item.iso3,state.year)?.[key] })).filter((entry) => Number.isFinite(entry.value)).sort((a,b) => b.value-a.value);
  }

  function renderRanking() {
    const entries = rankingRows();
    const max = Math.max(1,...entries.map((entry) => Math.abs(entry.value)));
    $("#ranking-coverage").textContent = t("countriesAvailable")(entries.length,state.data.countries.length);
    if (!entries.length) { $("#migration-ranking").innerHTML = `<p class="migration-empty">${esc(t("noData"))}</p>`; return; }
    $("#migration-ranking").innerHTML = entries.map(({item,value}) => `<div class="migration-rank-row ${item.iso3===state.country?"selected":""}"><button type="button" data-country="${item.iso3}">${esc(countryName(item))}</button><div class="migration-rank-track"><i class="${value<0?"negative":"positive"}" style="width:${Math.abs(value)/max*50}%"></i></div><strong>${state.mapMetric === "net" ? signed(value,state.rankingUnit==="rate"?1:0) : number(value,state.rankingUnit==="rate"?1:0)}</strong></div>`).join("");
    $("#migration-ranking").querySelectorAll("[data-country]").forEach((button) => button.addEventListener("click",()=>selectCountry(button.dataset.country)));
  }

  function renderTable() {
    const entries = state.data.countries.map((item) => ({ item, row:rowAt(item.iso3,state.year) })).sort((a,b) => (b.row?.net_per_1000 ?? -Infinity)-(a.row?.net_per_1000 ?? -Infinity));
    $("#migration-table-body").innerHTML = entries.map(({item,row}) => { const labels=statusLabels(row?.flags); return `<tr class="${item.iso3===state.country?"selected":""}"><td><button type="button" data-country="${item.iso3}">${esc(countryName(item))}</button></td><td>${number(row?.immigration)}</td><td>${number(row?.emigration)}</td><td class="${row?.net<0?"negative":row?.net>0?"positive":""}">${signed(row?.net)}</td><td class="${row?.net_per_1000<0?"negative":row?.net_per_1000>0?"positive":""}">${signed(row?.net_per_1000,1)}</td><td class="migration-quality" title="${esc(labels.join(", "))}">${esc(labels.join(" · ")||"—")}</td></tr>`; }).join("");
    $("#migration-table-body").querySelectorAll("[data-country]").forEach((button)=>button.addEventListener("click",()=>selectCountry(button.dataset.country)));
  }

  function selectCountry(code) {
    state.country = country(code) ? code : "EU27";
    $("#migration-country").value = state.country;
    updateUrl();
    renderMap(); renderTrend(); renderRanking(); renderTable();
  }

  function renderAll() { translate(); renderHero(); renderMap(); renderTrend(); renderRanking(); renderTable(); }

  function bindControls() {
    const select = $("#migration-country");
    select.innerHTML = `<option value="EU27">${esc(t("eu27"))}</option>${[...state.data.countries].sort((a,b)=>countryName(a).localeCompare(countryName(b),locale())).map((item)=>`<option value="${item.iso3}">${esc(countryName(item))}</option>`).join("")}`;
    select.value = state.country;
    select.addEventListener("change",()=>selectCountry(select.value));
    $("#migration-year").value = state.year;
    $("#migration-year-output").textContent = state.year;
    $("#migration-year").addEventListener("input",(event)=>{state.year=Number(event.target.value);$("#migration-year-output").textContent=state.year;updateUrl();renderMap();renderRanking();renderTable()});
    document.querySelectorAll("[data-map-metric]").forEach((button)=>button.addEventListener("click",()=>{state.mapMetric=button.dataset.mapMetric;document.querySelectorAll("[data-map-metric]").forEach((item)=>item.classList.toggle("active",item===button));renderMap();renderRanking()}));
    document.querySelectorAll("[data-unit]").forEach((button)=>button.addEventListener("click",()=>{state.trendUnit=button.dataset.unit;document.querySelectorAll("[data-unit]").forEach((item)=>item.classList.toggle("active",item===button));renderTrend()}));
    document.querySelectorAll("[data-ranking-unit]").forEach((button)=>button.addEventListener("click",()=>{state.rankingUnit=button.dataset.rankingUnit;document.querySelectorAll("[data-ranking-unit]").forEach((item)=>item.classList.toggle("active",item===button));renderRanking()}));
    $("#source-immigration").href=state.data.sources.immigration.browser_url;
    $("#source-emigration").href=state.data.sources.emigration.browser_url;
    $("#source-metadata").href=state.data.sources.metadata_url;
  }

  Promise.all([fetch(`${assetRoot}data/eu-migration.v1.json`).then((response)=>{if(!response.ok)throw new Error(response.status);return response.json()}),fetch(`${assetRoot}data/world-map.v1.json`).then((response)=>{if(!response.ok)throw new Error(response.status);return response.json()})]).then(([data,geometry])=>{
    state.data=data;state.geometry=geometry;
    state.year=Math.max(data.scope.first_year,Math.min(data.scope.last_year,state.year));
    if(state.country!=="EU27"&&!country(state.country))state.country="EU27";
    bindControls();renderAll();
  }).catch((error)=>{console.error("migration deep dive",error);$("#migration-map").innerHTML=`<p class="migration-empty">${esc(t("loadError"))}</p>`});
  addEventListener("psdlanguagechange",()=>{if(!state.data)return;const select=$("#migration-country");select.querySelector('option[value="EU27"]').textContent=t("eu27");state.data.countries.forEach((item)=>{const option=select.querySelector(`option[value="${item.iso3}"]`);if(option)option.textContent=countryName(item)});renderAll()});
})();
