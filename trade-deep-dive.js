(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") === "en" || document.documentElement.lang === "en" ? "en" : "cs";
  document.documentElement.lang = lang;
  const copy = {
    cs: {eyebrow:"Report / Zahraniční obchod",titleLead:"Co země",titleEm:"prodává světu",intro:"Dovoz, vývoz a obchodní bilance v čase. Z grafu se prokliknete k partnerům a kapitolám zboží, které změnu vytvářejí.",countryLabel:"Země",pulseNav:"Bilance",trendNav:"Vývoj",compositionNav:"Partneři a zboží",methodNav:"Metodika",pulseKicker:"Vybrané období",pulseTitle:"Obchodní bilance na první pohled",pulseIntro:"Vývoz minus dovoz. Červená znamená deficit, zelená přebytek.",trendKicker:"Vývoj v čase",trendTitle:"Dovoz a vývoz jako burzovní graf",trendIntro:"Přejeďte po grafu nebo klikněte na bod. Vybrané období se propíše do horních metrik i detailu pod grafem.",annual:"Ročně",monthly:"Měsíčně",exports:"Vývoz",imports:"Dovoz",chartNote:"Hodnoty jsou v běžných USD. Mezery v řadě jsou chybějící data, nikoli nuly.",compositionKicker:"Struktura posledního ročního období",compositionTitle:"Kdo obchoduje a co se převáží",compositionIntro:"Přepněte dovoz nebo vývoz a klikněte na řádek. Délka pruhu ukazuje hodnotu, detail pod ním podíl a protisměrný tok.",partnersTitle:"Největší obchodní partneři",productsTitle:"Největší kapitoly zboží",methodKicker:"Jak číst data",methodTitle:"Jedna bilance, dvě oceňovací báze",methodIntro:"UN Comtrade obvykle oceňuje dovoz včetně pojištění a dopravy (CIF), zatímco vývoz na hranici vývozce (FOB). Bilance je proto orientační analytický rozdíl, ne národní účet.",sourceCopy:"Zdrojové hlášení země, bez zrcadlového doplňování chybějících hodnot.",grainTitle:"Zachované dimenze",grainCopy:"Období, reportér, tok, partner a šestimístný HS kód. Grafy sčítají pouze jednu nejjemnější dostupnou úroveň.",coverageTitle:"Pokrytí není nula",coverageCopy:"Nezveřejněný měsíc nebo partner se nezobrazuje jako nulový obchod. Dostupnost se vede odděleně od faktů.",sourceLabel:"Zdroj",balance:"Bilance",surplus:"Přebytek",deficit:"Deficit",turnover:"Obrat",ratio:"Krytí dovozu vývozem",period:"Období",share:"Podíl na vybraném toku",opposite:"Protisměrný tok",value:"Hodnota",noData:"Pro tuto frekvenci zatím nejsou načtena data.",noRanking:"Pro tento řez zatím nejsou načtena detailní data.",loading:"Načítám UN Comtrade…",loadError:"Obchodní data se teď nepodařilo načíst. Zkuste stránku obnovit.",currentUsd:"běžné USD"},
    en: {eyebrow:"Report / Foreign trade",titleLead:"What a country",titleEm:"sells to the world",intro:"Imports, exports and the trade balance over time. Click through from the chart to the partners and goods chapters driving the change.",countryLabel:"Country",pulseNav:"Balance",trendNav:"Trend",compositionNav:"Partners and goods",methodNav:"Method",pulseKicker:"Selected period",pulseTitle:"The trade balance at a glance",pulseIntro:"Exports minus imports. Red means a deficit; green a surplus.",trendKicker:"Change over time",trendTitle:"Imports and exports as a market chart",trendIntro:"Hover over the chart or click a point. The selected period updates the headline metrics and detail below the chart.",annual:"Annual",monthly:"Monthly",exports:"Exports",imports:"Imports",chartNote:"Values are current USD. Gaps are missing data, not zeroes.",compositionKicker:"Latest annual composition",compositionTitle:"Who trades and what moves",compositionIntro:"Switch imports or exports and click a row. Bar length shows value; the detail below shows its share and opposite flow.",partnersTitle:"Largest trade partners",productsTitle:"Largest goods chapters",methodKicker:"How to read the data",methodTitle:"One balance, two valuation bases",methodIntro:"UN Comtrade generally values imports including insurance and freight (CIF), while exports are valued at the exporter’s border (FOB). The balance is therefore an analytical difference, not a national account.",sourceCopy:"The reporter country’s own submission, without mirror-filling missing values.",grainTitle:"Dimensions retained",grainCopy:"Period, reporter, flow, partner and six-digit HS code. Charts sum one finest available level only.",coverageTitle:"Coverage is not zero",coverageCopy:"An unpublished month or partner is not shown as zero trade. Availability is tracked separately from facts.",sourceLabel:"Source",balance:"Balance",surplus:"Surplus",deficit:"Deficit",turnover:"Turnover",ratio:"Exports/imports cover",period:"Period",share:"Share of selected flow",opposite:"Opposite flow",value:"Value",noData:"No loaded data are available for this frequency yet.",noRanking:"No detailed data are loaded for this cut yet.",loading:"Loading UN Comtrade…",loadError:"Trade data could not be loaded. Please refresh the page.",currentUsd:"current USD"},
  }[lang];
  document.querySelectorAll("[data-trade-copy]").forEach((node) => { const value = copy[node.dataset.tradeCopy]; if (value) node.textContent = value; });

  const $ = (selector) => document.querySelector(selector);
  const state = { country: (params.get("code") || "DEU").toUpperCase(), frequency: params.get("freq") === "M" ? "M" : "A", flow: params.get("flow") === "import" ? "import" : "export", period: params.get("period") || null, selectedKind: null, selectedCode: null, profile: null };
  const money = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" });
  const percent = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "percent", maximumFractionDigits: 1 });
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[character]));
  const fmt = (value) => Number.isFinite(value) ? money.format(value) : "—";
  const signed = (value) => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${money.format(value)}` : "—";
  const periodLabel = (period) => period?.length === 6 ? `${period.slice(0,4)}–${period.slice(4)}` : period || "—";
  const pairRows = (rows) => {
    const map = new Map();
    rows.forEach((row) => { const entry = map.get(row.period) || { period: row.period, period_start: row.period_start, import: null, export: null }; entry[row.flow] = row.value_usd; map.set(row.period, entry); });
    return [...map.values()].sort((a,b) => String(a.period).localeCompare(String(b.period)));
  };
  const updateURL = () => {
    const url = new URL(location.href); url.searchParams.set("code", state.country); url.searchParams.set("freq", state.frequency); url.searchParams.set("flow", state.flow);
    state.period ? url.searchParams.set("period", state.period) : url.searchParams.delete("period");
    url.searchParams.set("lang", lang); history.replaceState(null, "", url);
  };

  async function init() {
    $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`;
    try {
      const catalogResponse = await fetch("/api/v1/trade/countries");
      if (!catalogResponse.ok) throw new Error("catalog");
      const catalog = (await catalogResponse.json()).data;
      const countries = catalog.countries || [];
      if (!countries.some((country) => country.code === state.country) && countries[0]) state.country = countries[0].code;
      $("#trade-country").innerHTML = countries.map((country) => `<option value="${escapeHTML(country.code)}">${escapeHTML(country.name)} (${escapeHTML(country.code)})</option>`).join("");
      $("#trade-country").value = state.country;
      $("#trade-country").addEventListener("change", () => { state.country = $("#trade-country").value; state.period = null; state.selectedKind = null; state.selectedCode = null; loadProfile(); });
      document.querySelectorAll("#trade-frequency button").forEach((button) => button.addEventListener("click", () => { state.frequency = button.dataset.frequency; state.period = null; render(); }));
      document.querySelectorAll("#trade-flow-tabs button").forEach((button) => button.addEventListener("click", () => { state.flow = button.dataset.flow; state.selectedKind = null; state.selectedCode = null; renderComposition(); updateURL(); }));
      await loadProfile();
    } catch (error) { showError(error); }
  }

  async function loadProfile() {
    $("#trade-status").hidden = true;
    $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loading)}</div>`;
    try {
      const response = await fetch(`/api/v1/trade?country=${encodeURIComponent(state.country)}`);
      if (!response.ok) throw new Error(`profile ${response.status}`);
      state.profile = (await response.json()).data;
      const selected = $("#trade-country").selectedOptions[0];
      $("#trade-country-code").textContent = state.country;
      $("#trade-country-name").textContent = selected?.textContent.replace(/\s\([A-Z]{3}\)$/, "") || state.country;
      $("#trade-data-vintage").textContent = `UN Comtrade · ${String(state.profile.source.retrieved_at || "—").slice(0,10)}`;
      render();
    } catch (error) { showError(error); }
  }

  function showError(error) {
    console.error(error);
    $("#trade-status").hidden = false; $("#trade-status").textContent = copy.loadError;
    $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.loadError)}</div>`;
    $("#trade-kpis").innerHTML = ""; $("#trade-selected-period").innerHTML = ""; $("#trade-partners").innerHTML = ""; $("#trade-products").innerHTML = "";
  }

  function render() {
    document.querySelectorAll("#trade-frequency button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.frequency === state.frequency)));
    const periods = pairRows(state.profile.totals.filter((row) => row.frequency === state.frequency));
    if (!periods.length) {
      $("#trade-chart").innerHTML = `<div class="trade-loading">${escapeHTML(copy.noData)}</div>`;
      const fallback = pairRows(state.profile.totals.filter((row) => row.frequency === "A")).at(-1);
      renderKPIs(fallback); renderSelected(fallback); renderComposition(); updateURL(); return;
    }
    if (!state.period || !periods.some((row) => row.period === state.period)) state.period = periods.at(-1).period;
    const selected = periods.find((row) => row.period === state.period) || periods.at(-1);
    renderKPIs(selected); renderChart(periods); renderSelected(selected); renderComposition(); updateURL();
  }

  function renderKPIs(row) {
    const imports = row?.import; const exports = row?.export; const balance = Number.isFinite(exports) && Number.isFinite(imports) ? exports - imports : null; const turnover = Number.isFinite(exports) && Number.isFinite(imports) ? exports + imports : null; const ratio = imports > 0 && Number.isFinite(exports) ? exports / imports : null;
    $("#trade-period-context").textContent = `${copy.period}: ${periodLabel(row?.period)} · ${copy.pulseIntro}`;
    $("#trade-kpis").innerHTML = [
      [copy.imports,fmt(imports),"CIF", ""], [copy.exports,fmt(exports),"FOB", ""],
      [balance >= 0 ? copy.surplus : copy.deficit,signed(balance),copy.balance,`balance ${balance >= 0 ? "surplus" : "deficit"}`],
      [copy.ratio,ratio === null ? "—" : percent.format(ratio),`${copy.turnover}: ${fmt(turnover)}`, ""],
    ].map(([label,value,note,className]) => `<article class="${className}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`).join("");
  }

  function renderSelected(row) {
    const balance = Number.isFinite(row?.export) && Number.isFinite(row?.import) ? row.export - row.import : null;
    $("#trade-selected-period").innerHTML = `<b>${escapeHTML(copy.period)} · ${escapeHTML(periodLabel(row?.period))}</b><span>${escapeHTML(copy.exports)}<strong>${escapeHTML(fmt(row?.export))}</strong></span><span>${escapeHTML(copy.imports)}<strong>${escapeHTML(fmt(row?.import))}</strong></span><span>${escapeHTML(copy.balance)}<strong class="${balance >= 0 ? "positive" : "negative"}">${escapeHTML(signed(balance))}</strong></span>`;
  }

  function renderChart(periods) {
    const host = $("#trade-chart"); const width = Math.max(620, host.clientWidth || 900); const height = matchMedia("(max-width:700px)").matches ? 330 : 420; const margin = {top:25,right:28,bottom:36,left:78}; const plotW = width-margin.left-margin.right; const plotH = height-margin.top-margin.bottom;
    const values = periods.flatMap((row) => [row.import,row.export]).filter(Number.isFinite); const max = Math.max(...values,1); const yMax = max*1.08; const x = (index) => margin.left + (periods.length === 1 ? plotW/2 : index/(periods.length-1)*plotW); const y = (value) => margin.top + plotH - (value/yMax)*plotH;
    const path = (flow) => { let started=false; return periods.map((row,index) => { if(!Number.isFinite(row[flow])){started=false;return "";} const command=started?"L":"M";started=true;return `${command}${x(index).toFixed(1)},${y(row[flow]).toFixed(1)}`; }).filter(Boolean).join(" "); };
    const grid = Array.from({length:5},(_,i) => { const value=yMax*(1-i/4); const yy=margin.top+plotH*i/4; return `<line class="grid" x1="${margin.left}" y1="${yy}" x2="${width-margin.right}" y2="${yy}"/><text class="axis-label" x="${margin.left-10}" y="${yy+4}" text-anchor="end">${escapeHTML(money.format(value))}</text>`; }).join("");
    const labelEvery = Math.max(1,Math.ceil(periods.length/6)); const labels=periods.map((row,index) => index%labelEvery===0 || index===periods.length-1 ? `<text class="axis-label" x="${x(index)}" y="${height-11}" text-anchor="middle">${escapeHTML(periodLabel(row.period))}</text>` : "").join("");
    const points = ["export","import"].flatMap((flow) => periods.map((row,index) => Number.isFinite(row[flow]) ? `<circle class="point ${flow} ${row.period===state.period ? "selected" : ""}" data-period="${escapeHTML(row.period)}" cx="${x(index)}" cy="${y(row[flow])}" r="${row.period===state.period ? 7 : 4}" tabindex="0"><title>${escapeHTML(`${periodLabel(row.period)} · ${flow === "export" ? copy.exports : copy.imports}: ${fmt(row[flow])}`)}</title></circle>` : "")).join("");
    host.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(`${copy.imports}, ${copy.exports}`)}">${grid}<path class="series export" d="${path("export")}"/><path class="series import" d="${path("import")}"/>${points}${labels}<line class="crosshair" hidden y1="${margin.top}" y2="${margin.top+plotH}"/></svg><div class="trade-chart-tooltip" hidden></div>`;
    const tooltip = host.querySelector(".trade-chart-tooltip"); const crosshair=host.querySelector(".crosshair");
    const pick = (event, commit=false) => { const rect=host.querySelector("svg").getBoundingClientRect(); const svgX=(event.clientX-rect.left)/rect.width*width; const index=Math.max(0,Math.min(periods.length-1,Math.round((svgX-margin.left)/plotW*(periods.length-1)))); const row=periods[index]; crosshair.hidden=false; crosshair.setAttribute("x1",x(index));crosshair.setAttribute("x2",x(index)); tooltip.hidden=false; tooltip.innerHTML=`<b>${escapeHTML(periodLabel(row.period))}</b>${escapeHTML(copy.exports)}: ${escapeHTML(fmt(row.export))}<br>${escapeHTML(copy.imports)}: ${escapeHTML(fmt(row.import))}`; tooltip.style.left=`${Math.min(host.clientWidth-185,Math.max(8,event.clientX-host.getBoundingClientRect().left+12))}px`;tooltip.style.top=`${Math.max(8,event.clientY-host.getBoundingClientRect().top-70)}px`; if(commit){state.period=row.period;render();} };
    host.querySelector("svg").addEventListener("pointermove",(event)=>pick(event)); host.querySelector("svg").addEventListener("click",(event)=>pick(event,true)); host.querySelector("svg").addEventListener("pointerleave",()=>{tooltip.hidden=true;crosshair.hidden=true;});
    host.querySelectorAll(".point").forEach((point)=>point.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();state.period=point.dataset.period;render();}}));
  }

  function renderComposition() {
    document.querySelectorAll("#trade-flow-tabs button").forEach((button) => button.setAttribute("aria-pressed",String(button.dataset.flow===state.flow)));
    renderRanking("partner", state.profile.partners || [], $("#trade-partners")); renderRanking("product", state.profile.products || [], $("#trade-products")); renderDetail();
  }

  function renderRanking(kind, allRows, host) {
    const rows = allRows.filter((row)=>row.flow===state.flow).slice(0,12); const max=Math.max(...rows.map((row)=>row.value_usd),1);
    if(!rows.length){host.innerHTML=`<p class="empty">${escapeHTML(copy.noRanking)}</p>`;return;}
    host.innerHTML=rows.map((row)=>`<button type="button" data-kind="${kind}" data-code="${escapeHTML(row.code)}" class="${state.selectedKind===kind&&state.selectedCode===row.code?"selected":""}"><b title="${escapeHTML(row.name)}">${escapeHTML(row.name)}</b><i><span style="width:${Math.max(2,row.value_usd/max*100).toFixed(1)}%"></span></i><strong>${escapeHTML(fmt(row.value_usd))}</strong></button>`).join("");
    host.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{state.selectedKind=button.dataset.kind;state.selectedCode=button.dataset.code;renderComposition();}));
  }

  function renderDetail() {
    if(!state.selectedKind||!state.selectedCode){$("#trade-detail").innerHTML="";$("#trade-detail").hidden=true;return;}
    const rows=state.selectedKind==="partner"?state.profile.partners:state.profile.products; const selected=rows.find((row)=>row.code===state.selectedCode&&row.flow===state.flow); if(!selected)return;
    const oppositeFlow=state.flow==="export"?"import":"export"; const opposite=rows.find((row)=>row.code===state.selectedCode&&row.flow===oppositeFlow); const total=state.profile.totals.find((row)=>row.frequency==="A"&&row.year===selected.year&&row.flow===state.flow); const share=total?.value_usd?selected.value_usd/total.value_usd:null;
    $("#trade-detail").hidden=false; $("#trade-detail").innerHTML=`<div><span>${escapeHTML(state.selectedKind==="partner"?copy.partnersTitle:copy.productsTitle)}</span><strong>${escapeHTML(selected.name)}</strong></div><div><span>${escapeHTML(copy.value)}</span><strong>${escapeHTML(fmt(selected.value_usd))}</strong></div><div><span>${escapeHTML(copy.share)}</span><strong>${share===null?"—":escapeHTML(percent.format(share))}</strong></div><div><span>${escapeHTML(copy.opposite)}</span><strong>${escapeHTML(fmt(opposite?.value_usd))}</strong></div>`;
  }

  init();
})();
