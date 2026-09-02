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
      eyebrow:"Report / 33 zemí",titleLead:"Evropská migrace",titleEm:"2000–2024",intro:"Přistěhování, vystěhování a výsledné saldo 33 evropských zemí v jedné srovnatelné časové řadě.",heroCta:"Otevřít migrační mapu ↓",dataset:"Nejnovější úplný součet EU-27",arrivals:"Přistěhování",departures:"Vystěhování",balance:"Saldo",coverage:"Pokrytí EU",heroNote:"Počet migračních událostí; předběžné a odhadované hodnoty zůstávají označené.",
      navMap:"Mapa",navTrend:"Vývoj",navProtection:"Ochrana",navRanking:"Srovnání",navAtlas:"Atlas zemí",navMethod:"Metodika",arrivalLabel:"PŘISTĚHOVÁNÍ",arrivalDefinition:"Nové obvyklé bydliště alespoň na 12 měsíců.",departureLabel:"VYSTĚHOVÁNÍ",departureDefinition:"Ukončení obvyklého bydliště alespoň na 12 měsíců.",netLabel:"SALDO",netDefinition:"Přistěhování minus vystěhování; ne totéž co statisticky dopočtená čistá migrace.",
      mapKicker:"Mapa Evropy / 33 zemí",mapTitle:"Intenzita migrace podle zemí",mapIntro:"Mapa přepočítává migrační toky na 1 000 obyvatel, aby malé a velké státy šlo číst na stejné stupnici.",year:"Rok",metric:"Ukazatel",perThousand:"na 1 000 obyvatel",mapSource:"Zdroj: Eurostat migr_imm8, migr_emi2 a demo_gind.",trendKicker:"Vývoj v čase",trendTitle:"Přistěhování, vystěhování a saldo",trendIntro:"Stejné saldo může vzniknout z malých i velmi velkých protisměrných toků. Proto zobrazujeme obě strany vedle výsledku.",country:"Země",unit:"Jednotka",people:"Osoby",trendSource:"Roční migrační události. Mezery znamenají chybějící data, nikoli nulu.",
      protectionKicker:"Azyl a ochrana",protectionTitle:"Udělená ochrana podle právního statusu",protectionIntro:"Počet osob s kladným rozhodnutím v prvním stupni nebo po odvolání. Jde o rozhodnutí vydaná v daném roce, nikoli o počet lidí žijících v zemi se statusem ochrany.",protectionLatest:"Udělená ochrana · nejnovější rok",protectionTrend:"Vývoj kladných rozhodnutí",refugeeStatus:"Status uprchlíka",subsidiaryStatus:"Doplňková ochrana",humanitarianStatus:"Humanitární status",protectionShare:"z udělené ochrany",protectionSource:"Zdroj: Eurostat migr_asydcfsta a migr_asydcfina. První a konečná kladná rozhodnutí jsou sečtena; dočasná ochrana není zahrnuta.",openProtection:"Otevřít data ↗",openProtectionFinal:"Konečná rozhodnutí o ochraně ↗",
      rankingKicker:"Srovnání zemí",rankingTitle:"Absolutní počty a přepočet na obyvatele",rankingIntro:"Přepínač odděluje absolutní počet lidí od intenzity vzhledem k velikosti populace.",rankingMeasure:"Zobrazení",atlasKicker:"Atlas Evropy",atlasTitle:"Všech 33 zemí ve zvoleném roce",atlasIntro:"Tabulka používá rok zvolený na mapě; chybějící nebo označené hodnoty nechává viditelné.",netRate:"Saldo / 1 000",quality:"Kvalita",methodKicker:"Jak data číst",methodTitle:"Co přesně čísla měří",methodIntro:"Jedna osoba může během delšího období vytvořit více migračních událostí. Migrační toky v první části neříkají státní občanství, důvod přesunu ani právní status; modul ochrany proto stojí samostatně.",
      methodFlowTitle:"Událost",methodFlow:"Roční počet přistěhování a vystěhování podle obvyklého bydliště a dvanáctiměsíčního pravidla.",methodAggregateTitle:"Součet EU",methodAggregate:"Pohyb mezi dvěma státy EU vstupuje do přistěhování jedné země a vystěhování druhé. Součet není počet překročení vnější hranice.",methodRateTitle:"Intenzita",methodRate:"Sazba dělí tok průměrnou roční populací z demo_gind a násobí jej 1 000.",methodQualityTitle:"Revize",methodQuality:"Eurostat označuje zlomy, odhady, předběžná čísla a hodnoty s metodickou poznámkou. Zdroj se může revidovat.",openImmigration:"Otevřít přistěhování v Eurostatu ↗",openEmigration:"Otevřít vystěhování v Eurostatu ↗",openMetadata:"Metodika Eurostatu ↗",footer:"European migration · Eurostat",eu27:"Evropská unie — 27 zemí",noData:"Pro tento rok není srovnatelná hodnota.",ofPopulation:"na 1 000 obyvatel",population:"Průměrná populace",status:"Označení Eurostatu",countriesAvailable:(n,total)=>`${n} z ${total} zemí má hodnotu pro vybraný rok.`,flag_b:"zlom řady",flag_e:"odhad",flag_i:"viz metodika",flag_p:"předběžné",selectedYear:"Vybraný rok",positive:"kladné saldo",negative:"záporné saldo",chartUnitPeople:"osob",chartUnitRate:"na 1 000 obyvatel",loadError:"Migrační data se nepodařilo načíst."
    },
    en: {
      eyebrow:"Report / 33 countries",titleLead:"European migration",titleEm:"2000–2024",intro:"Immigration, emigration and the resulting balance across 33 European countries in one comparable time series.",heroCta:"Open the migration map ↓",dataset:"Latest complete EU-27 total",arrivals:"Immigration",departures:"Emigration",balance:"Balance",coverage:"EU coverage",heroNote:"Migration events; provisional and estimated values remain visibly flagged.",
      navMap:"Map",navTrend:"Trend",navProtection:"Protection",navRanking:"Comparison",navAtlas:"Country atlas",navMethod:"Method",arrivalLabel:"IMMIGRATION",arrivalDefinition:"A new usual residence expected to last at least 12 months.",departureLabel:"EMIGRATION",departureDefinition:"Ending usual residence for at least 12 months.",netLabel:"BALANCE",netDefinition:"Immigration minus emigration; not the same as statistically adjusted net migration.",
      mapKicker:"Europe map / 33 countries",mapTitle:"Migration intensity by country",mapIntro:"The map scales migration flows per 1,000 residents so countries of different sizes can be read on the same footing.",year:"Year",metric:"Measure",perThousand:"per 1,000 residents",mapSource:"Source: Eurostat migr_imm8, migr_emi2 and demo_gind.",trendKicker:"Change over time",trendTitle:"Immigration, emigration and the balance",trendIntro:"The same balance can come from small or very large flows in opposite directions. Both sides therefore remain visible beside the result.",country:"Country",unit:"Unit",people:"People",trendSource:"Annual migration events. Gaps mean missing data, not zero.",
      protectionKicker:"Asylum and protection",protectionTitle:"Protection granted by legal status",protectionIntro:"People receiving a positive first-instance or final decision after appeal. These are decisions issued during the year, not the number of people currently living in the country with protection status.",protectionLatest:"Protection granted · latest year",protectionTrend:"Positive decisions over time",refugeeStatus:"Refugee status",subsidiaryStatus:"Subsidiary protection",humanitarianStatus:"Humanitarian status",protectionShare:"of protection granted",protectionSource:"Source: Eurostat migr_asydcfsta and migr_asydcfina. Positive first-instance and final decisions are combined; temporary protection is excluded.",openProtection:"Open data ↗",openProtectionFinal:"Final protection decisions ↗",
      rankingKicker:"Country comparison",rankingTitle:"Absolute numbers and per-capita rates",rankingIntro:"The switch separates the absolute number of people from intensity relative to population size.",rankingMeasure:"View",atlasKicker:"European atlas",atlasTitle:"All 33 countries in the selected year",atlasIntro:"The table follows the year selected on the map and keeps missing or flagged values visible.",netRate:"Balance / 1,000",quality:"Quality",methodKicker:"How to read it",methodTitle:"What the numbers measure",methodIntro:"One person can generate more than one migration event over a longer period. The migration-flow figures in the first part do not describe citizenship, reason for moving or legal status, so the protection module is kept separate.",
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
  const protectionRows = (code = state.country) => code === "EU27" ? state.data.eu27_protection || [] : country(code)?.protection_rows || [];
  const rowAt = (code, year) => rows(code).find((row) => row.year === year);
  const selectedName = () => state.country === "EU27" ? t("eu27") : countryName(country());

  function translate() {
    document.querySelectorAll("[data-migration-copy]").forEach((node) => {
      const value = t(node.dataset.migrationCopy);
      if (typeof value === "string") node.textContent = value;
    });
    document.title = lang() === "en" ? "European migration over time — Public Spending Data" : "Evropská migrace v čase — Public Spending Data";
    document.querySelector('meta[name="description"]').content = lang() === "en" ? "Immigration, emigration and protection-status decisions across 33 European countries, based on Eurostat." : "Přistěhování, vystěhování a rozhodnutí o statusu ochrany ve 33 evropských zemích podle Eurostatu.";
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

  function renderProtection() {
    const dataRows = protectionRows();
    const latest = [...dataRows].reverse().find((row) => Number.isFinite(row.total));
    if (!latest) {
      $("#protection-total").textContent = "—";
      $("#protection-types").innerHTML = `<p class="migration-empty">${esc(t("noData"))}</p>`;
      $("#migration-protection-chart").innerHTML = "";
      return;
    }
    $("#protection-total").textContent = number(latest.total);
    $("#protection-year").textContent = latest.year;
    $("#protection-country-name").textContent = selectedName();
    const types = [
      { key:"refugee", label:t("refugeeStatus") },
      { key:"subsidiary", label:t("subsidiaryStatus") },
      { key:"humanitarian", label:t("humanitarianStatus") },
    ];
    $("#protection-types").innerHTML = types.map(({ key, label }) => {
      const value = latest[key];
      const share = Number.isFinite(value) && latest.total ? value / latest.total * 100 : null;
      return `<article class="${key}"><span>${esc(label)}</span><strong>${number(value)}</strong><small>${share == null ? "—" : `${number(share,1)} % ${esc(t("protectionShare"))}`}</small></article>`;
    }).join("");

    const W = 1040, H = 390, left = 70, right = 20, top = 18, bottom = 48;
    const max = Math.max(1, ...dataRows.map((row) => row.total || 0));
    const plotHeight = H - top - bottom;
    const slot = (W - left - right) / dataRows.length;
    const barWidth = Math.min(34, slot * .68);
    const y = (value) => top + (max - value) / max * plotHeight;
    const grid = Array.from({ length:5 }, (_, index) => max * index / 4).map((tick) => `<line class="migration-grid-line" x1="${left}" x2="${W-right}" y1="${y(tick)}" y2="${y(tick)}"></line><text class="migration-axis-label" x="${left-10}" y="${y(tick)+4}" text-anchor="end">${esc(compact(tick))}</text>`).join("");
    const bars = dataRows.map((row, index) => {
      const x = left + slot * index + (slot - barWidth) / 2;
      let bottomY = H - bottom;
      const rects = types.map(({ key, label }) => {
        const value = Number.isFinite(row[key]) ? row[key] : 0;
        const height = value / max * plotHeight;
        bottomY -= height;
        return `<rect class="migration-protection-bar ${key}" x="${x}" y="${bottomY}" width="${barWidth}" height="${height}"><title>${row.year} · ${esc(label)}: ${number(value)}</title></rect>`;
      }).join("");
      const label = row.year === dataRows[0].year || row.year === dataRows.at(-1).year || row.year % 2 === 0 ? `<text class="migration-axis-label" x="${x+barWidth/2}" y="${H-18}" text-anchor="middle">${row.year}</text>` : "";
      return `${rects}${label}`;
    }).join("");
    $("#migration-protection-chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${selectedName()} — ${t("protectionTrend")}`)}">${grid}${bars}</svg>`;
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
    renderMap(); renderTrend(); renderProtection(); renderRanking(); renderTable();
  }

  function renderAll() { translate(); renderHero(); renderMap(); renderTrend(); renderProtection(); renderRanking(); renderTable(); }

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
    $("#source-protection-first").href=state.data.sources.protection_first_instance.browser_url;
    $("#source-protection-final").href=state.data.sources.protection_final.browser_url;
    $("#source-metadata").href=state.data.sources.metadata_url;
  }

  Promise.all([fetch(`${assetRoot}data/eu-migration.v1.json?v=20260902-protection-33`).then((response)=>{if(!response.ok)throw new Error(response.status);return response.json()}),fetch(`${assetRoot}data/world-map.v1.json`).then((response)=>{if(!response.ok)throw new Error(response.status);return response.json()})]).then(([data,geometry])=>{
    state.data=data;state.geometry=geometry;
    state.year=Math.max(data.scope.first_year,Math.min(data.scope.last_year,state.year));
    if(state.country!=="EU27"&&!country(state.country))state.country="EU27";
    bindControls();renderAll();
  }).catch((error)=>{console.error("migration deep dive",error);$("#migration-map").innerHTML=`<p class="migration-empty">${esc(t("loadError"))}</p>`});
  addEventListener("psdlanguagechange",()=>{if(!state.data)return;const select=$("#migration-country");select.querySelector('option[value="EU27"]').textContent=t("eu27");state.data.countries.forEach((item)=>{const option=select.querySelector(`option[value="${item.iso3}"]`);if(option)option.textContent=countryName(item)});renderAll()});
})();
