(() => {
  const params = new URLSearchParams(location.search);
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const locale = lang === "en" ? "en-GB" : "cs-CZ";
  const copy = {
    cs: {
      eyebrow:"Report / Digitální hodnota",titleLead:"Kdo si ponechá",titleEm:"digitální ekonomiku?",intro:"Deset ekonomik pod stejným scénářem. Pozorovaná data držíme odděleně od tří předpokladů, abychom ukázali rozsah problému bez předstírání falešně přesného odhadu.",heroLabel:"Srovnávací panel",heroNote:"10 zemí · 3 měřené vstupy · 3 otevřené předpoklady",
      modelNav:"Scénář",comparisonNav:"10 zemí",capacityNav:"Kapacita",sensitivityNav:"Citlivost",methodNav:"Metodika",modelKicker:"Tři otevřené předpoklady",modelTitle:"Stejný test pro každou ekonomiku",modelIntro:"HDP, úspory a výzkum pocházejí ze zdrojových řad. Velikost digitálního sektoru, podíl zahraničních platforem a multiplikátor mění čtenář.",lowerExposure:"Nižší expozice",baseline:"Výchozí scénář",higherExposure:"Vyšší expozice",digitalShare:"Digitální sektor",digitalShareHint:"Předpokládaný podíl digitálních aktivit na HDP.",foreignShare:"Zahraniční dominance",foreignShareHint:"Scénářový podíl digitálního trhu pod zahraniční kontrolou.",multiplier:"Investiční multiplikátor",multiplierHint:"Kolikrát se domácí reinvestice promítne do podporovaného výkonu.",scenarioLabel:"Scénář, ne prognóza.",scenarioWarning:"Změna ovladače nemění historická data; pouze přepočítá hypotetickou expozici.",
      comparisonKicker:"Hodnota doma a venku",comparisonTitle:"Co se stane se 100 dolary digitálního výkonu",comparisonIntro:"Stejná zahraniční dominance neznamená stejný výsledek. Výzkumná intenzita v modelu tlumí únik a hrubé úspory určují, kolik z ponechané hodnoty lze znovu investovat.",perHundred:"Ze 100 USD",economyScale:"Miliardy USD",kept:"Zůstává doma",leaked:"Modelovaný únik",comparisonSource:"Zdroje faktických vstupů: IMF WEO, World Bank WDI. Výsledek: scénářový výpočet PSD.",
      capacityKicker:"Pouze měřená data",capacityTitle:"Kapacita znovu investovat není stejná",capacityIntro:"Vodorovně jsou hrubé národní úspory, svisle výdaje na výzkum a vývoj. Velikost bodu odpovídá HDP; zde není žádný scénářový vstup.",capacitySource:"World Bank WDI · nejnovější dostupný rok podle země; nominální HDP IMF WEO 2024.",savingsAxis:"Hrubé úspory · % HDP",researchAxis:"Výzkum a vývoj · % HDP",
      sensitivityKicker:"Co mění výsledek",sensitivityTitle:"Jedna země, celé rozpětí dominance",sensitivityIntro:"Křivky ukazují, jak se při nezměněných faktických vstupech mění únik a výkon podpořený domácí reinvesticí.",countryLabel:"Země",sensitivitySource:"Scénářový model PSD · zahraniční podíl od 20 % do 90 %; ostatní ovladače odpovídají scénáři výše.",foreignAxis:"Zahraniční dominance · %",outputAxis:"% digitálního výkonu",supportedLine:"Podpořený výkon",leakageLine:"Únik",
      tableKicker:"Čísla za grafem",tableTitle:"Data a scénář v jednom pohledu",tableIntro:"Rok zůstává u každého měřeného vstupu. Modelované sloupce se přepočítávají podle ovladačů nahoře.",country:"Země",gdp:"HDP",saving:"Hrubé úspory",research:"Výzkum a vývoj",investment:"Tvorba kapitálu",digitalOutput:"Digitální výkon",leakage:"Únik",reinvestment:"Reinvestice",supported:"Podpořený výkon",
      methodKicker:"Auditovatelná hranice",methodTitle:"Co víme a co pouze testujeme",methodIntro:"Report záměrně nevydává zahraniční dominanci za pozorovanou hodnotu. Cílem je ukázat mechanismus a hodnotu dat, která ještě chybějí.",observedTag:"Pozorováno",observedTitle:"Tři vstupy ze zdrojů",observedCopy:"Nominální HDP, hrubé úspory a výdaje na výzkum a vývoj. Tvorba kapitálu slouží jako kontext, nikoli jako skrytý vstup.",assumedTag:"Předpoklad",assumedTitle:"Tři ovladače scénáře",assumedCopy:"Velikost digitálního sektoru, zahraniční dominance a investiční multiplikátor. Všem zemím dáváme stejnou hodnotu.",missingTag:"Chybí",missingTitle:"Data pro skutečný odhad",missingCopy:"Tržby platforem podle vlastníka, repatriace zisku, domácí nákupy a skutečné reinvestice digitálních firem.",proxyTitle:"Dvě transparentní proxy",proxyCopy:"Podpora politiky = výdaje na VaV dělené 3 %, nejvýše 100 %. Reinvestiční míra = hrubé úspory upravené touto podporou. Proxy nejsou měřením chování digitálních firem.",imfSource:"HDP · skutečnost 2024 ↗",wdiSource:"Úspory, VaV, investice ↗",inspiration:"Výchozí model",inspirationSource:"Logika scénáře ↗",footer:"Digital value capture · scénář, ne prognóza",dataError:"Data se nepodařilo načíst.",
      stays:"zůstává",leaves:"odchází",ofDigital:"digitálního výkonu",summary:(name,leak,supported)=>`${name}: při dnešním scénáři odchází ${leak} a domácí reinvestice podporuje výkon ${supported}.`,chartLabel:"Rozdělení digitálního výkonu mezi ponechanou hodnotu a modelovaný únik v deseti zemích",capacityLabel:"Hrubé úspory a výdaje na výzkum a vývoj v deseti zemích",sensitivityLabel:name=>`Citlivost modelu na zahraniční dominanci: ${name}`
    },
    en: {
      eyebrow:"Report / Digital value",titleLead:"Who keeps",titleEm:"the digital economy?",intro:"Ten economies under the same scenario. Observed data stay separate from three assumptions, showing the scale of the problem without pretending to have a falsely precise estimate.",heroLabel:"Comparison panel",heroNote:"10 countries · 3 measured inputs · 3 open assumptions",
      modelNav:"Scenario",comparisonNav:"10 countries",capacityNav:"Capacity",sensitivityNav:"Sensitivity",methodNav:"Method",modelKicker:"Three open assumptions",modelTitle:"The same test for every economy",modelIntro:"GDP, saving and research come from source series. The reader changes digital-sector size, foreign-platform share and the multiplier.",lowerExposure:"Lower exposure",baseline:"Baseline scenario",higherExposure:"Higher exposure",digitalShare:"Digital sector",digitalShareHint:"Assumed share of GDP generated by digital activity.",foreignShare:"Foreign dominance",foreignShareHint:"Scenario share of the digital market under foreign control.",multiplier:"Investment multiplier",multiplierHint:"How much supported output follows from domestic reinvestment.",scenarioLabel:"Scenario, not forecast.",scenarioWarning:"Changing a control does not alter historical data; it only recalculates hypothetical exposure.",
      comparisonKicker:"Value at home and abroad",comparisonTitle:"What happens to $100 of digital output",comparisonIntro:"The same foreign dominance does not produce the same result. Research intensity reduces leakage in the model, while gross saving determines how much retained value can be reinvested.",perHundred:"Per $100",economyScale:"USD billions",kept:"Retained at home",leaked:"Modelled leakage",comparisonSource:"Factual inputs: IMF WEO and World Bank WDI. Result: PSD scenario calculation.",
      capacityKicker:"Measured data only",capacityTitle:"Capacity to reinvest is not equal",capacityIntro:"Gross national saving is horizontal and R&D expenditure is vertical. Dot size represents GDP; this chart contains no scenario input.",capacitySource:"World Bank WDI · latest available year by country; nominal GDP from IMF WEO 2024.",savingsAxis:"Gross saving · % of GDP",researchAxis:"Research and development · % of GDP",
      sensitivityKicker:"What changes the result",sensitivityTitle:"One country, the full dominance range",sensitivityIntro:"The curves show how leakage and output supported by domestic reinvestment change while factual inputs remain fixed.",countryLabel:"Country",sensitivitySource:"PSD scenario model · foreign-platform share from 20% to 90%; other controls follow the scenario above.",foreignAxis:"Foreign dominance · %",outputAxis:"% of digital output",supportedLine:"Supported output",leakageLine:"Leakage",
      tableKicker:"Numbers behind the chart",tableTitle:"Data and scenario in one view",tableIntro:"The year stays attached to every measured input. Modelled columns recalculate with the controls above.",country:"Country",gdp:"GDP",saving:"Gross saving",research:"R&D",investment:"Capital formation",digitalOutput:"Digital output",leakage:"Leakage",reinvestment:"Reinvestment",supported:"Supported output",
      methodKicker:"Auditable boundary",methodTitle:"What we know and what we only test",methodIntro:"The report deliberately does not present foreign dominance as an observed value. It shows the mechanism and the value of the data still missing.",observedTag:"Observed",observedTitle:"Three sourced inputs",observedCopy:"Nominal GDP, gross saving and R&D expenditure. Capital formation is context, not a hidden model input.",assumedTag:"Assumption",assumedTitle:"Three scenario controls",assumedCopy:"Digital-sector size, foreign dominance and the investment multiplier. Every country receives the same value.",missingTag:"Missing",missingTitle:"Data needed for an estimate",missingCopy:"Platform revenue by owner, profit repatriation, domestic purchases and actual reinvestment by digital firms.",proxyTitle:"Two transparent proxies",proxyCopy:"Policy support equals R&D expenditure divided by 3%, capped at 100%. The reinvestment rate is gross saving adjusted by that support. Neither proxy measures digital-firm behaviour.",imfSource:"GDP · 2024 actual ↗",wdiSource:"Saving, R&D, investment ↗",inspiration:"Starting model",inspirationSource:"Scenario logic ↗",footer:"Digital value capture · scenario, not forecast",dataError:"The data could not be loaded.",
      stays:"stays",leaves:"leaves",ofDigital:"of digital output",summary:(name,leak,supported)=>`${name}: in the current scenario, ${leak} leaves and domestic reinvestment supports ${supported} of output.`,chartLabel:"Digital output split between retained value and modelled leakage across ten countries",capacityLabel:"Gross saving and research and development spending across ten countries",sensitivityLabel:name=>`Model sensitivity to foreign dominance: ${name}`
    }
  }[lang];

  const state = {
    digitalShare: clamp(Number(params.get("digital")) || 12, 5, 20),
    foreignShare: clamp(Number(params.get("foreign")) || 72, 20, 90),
    multiplier: clamp(Number(params.get("multiplier")) || 1.5, 1, 2.5),
    unit: params.get("unit") === "scale" ? "scale" : "share",
    selected: params.get("country") || "CZE",
    data: null,
  };
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
  const number = (value,digits=1) => new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const percent = value => `${number(value,1)} %`;
  const money = value => `${lang === "en" ? "$" : ""}${number(value,value < 100 ? 1 : 0)}${lang === "en" ? "bn" : " mld. USD"}`;
  const countryName = country => country[lang === "en" ? "name_en" : "name_cs"];
  const valueOf = metric => Number(metric?.value);

  function model(country, foreignOverride = state.foreignShare) {
    const gdp = valueOf(country.nominal_gdp_usd_bn);
    const saving = valueOf(country.gross_saving_pct_gdp) / 100;
    const research = valueOf(country.research_development_pct_gdp);
    const policyProxy = clamp(research / 3, 0, 1);
    const digitalOutput = gdp * state.digitalShare / 100;
    const leakageIntensity = .58 - policyProxy * .18;
    const leakage = digitalOutput * foreignOverride / 100 * leakageIntensity;
    const retained = Math.max(0, digitalOutput - leakage);
    const effectiveReinvestmentRate = saving * (.85 + policyProxy * .35);
    const reinvestment = retained * effectiveReinvestmentRate;
    const supported = reinvestment * state.multiplier;
    const incremental = reinvestment * Math.max(0,state.multiplier - 1);
    return {country,gdp,saving,research,policyProxy,digitalOutput,leakageIntensity,leakage,retained,effectiveReinvestmentRate,reinvestment,supported,incremental,leakageShare:leakage/digitalOutput*100,retainedShare:retained/digitalOutput*100,supportedShare:supported/digitalOutput*100};
  }

  function syncUrl(){
    const url = new URL(location.href);
    url.searchParams.set("lang",lang);url.searchParams.set("digital",String(state.digitalShare));url.searchParams.set("foreign",String(state.foreignShare));url.searchParams.set("multiplier",String(state.multiplier));url.searchParams.set("country",state.selected);url.searchParams.set("unit",state.unit);
    history.replaceState({},"",url);
  }

  function translate(){
    document.querySelectorAll("[data-digital-copy]").forEach(node=>{const value=copy[node.dataset.digitalCopy];if(typeof value==="string")node.textContent=value});
    document.title = lang === "en" ? "Digital value: what stays at home — Public Spending Data" : "Digitální hodnota: co zůstává doma — Public Spending Data";
  }

  function syncControls(){
    const digital=document.querySelector("#digital-share"),foreign=document.querySelector("#foreign-share"),multiplier=document.querySelector("#investment-multiplier");
    digital.value=state.digitalShare;foreign.value=state.foreignShare;multiplier.value=Math.round(state.multiplier*10);
    document.querySelector("#digital-share-output").textContent=`${state.digitalShare}%`;
    document.querySelector("#foreign-share-output").textContent=`${state.foreignShare}%`;
    document.querySelector("#multiplier-output").textContent=`${number(state.multiplier,1)}×`;
    document.querySelectorAll("[data-foreign-preset]").forEach(button=>button.setAttribute("aria-pressed",String(Number(button.dataset.foreignPreset)===state.foreignShare)));
    document.querySelectorAll("[data-chart-unit]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.chartUnit===state.unit)));
  }

  function renderBars(){
    const rows=state.data.countries.map(country=>model(country)).sort((a,b)=>state.unit==="scale"?b.leakage-a.leakage:b.leakageShare-a.leakageShare);
    const maxDigital=Math.max(...rows.map(row=>row.digitalOutput));
    const root=document.querySelector("#digital-country-bars");
    root.setAttribute("role","img");root.setAttribute("aria-label",copy.chartLabel);
    root.innerHTML=rows.map(row=>{
      const totalWidth=state.unit==="scale"?row.digitalOutput/maxDigital*100:100;
      const headline=state.unit==="scale"?money(row.leakage):`$${number(row.leakageShare,1)}`;
      const note=state.unit==="scale"?`${money(row.digitalOutput)} ${copy.ofDigital}`:`${number(row.retainedShare,1)} ${copy.stays}`;
      return `<button type="button" class="digital-country-row${row.country.code===state.selected?" is-selected":""}" data-country="${row.country.code}" aria-label="${esc(countryName(row.country))}: ${esc(headline)} ${esc(copy.leaves)}"><span class="digital-country-label"><img src="../../assets/flags/${esc(row.country.iso2)}.svg" alt=""><b>${row.country.code}</b><span>${esc(countryName(row.country))}</span></span><span class="digital-bar-rail"><span class="digital-bar-total" style="width:${totalWidth}%"><i class="digital-bar-kept" style="width:${row.retainedShare}%"></i><i class="digital-bar-leaked" style="width:${row.leakageShare}%"></i></span></span><span class="digital-country-value">${headline}<small>${note}</small></span></button>`;
    }).join("");
    root.querySelectorAll("[data-country]").forEach(button=>button.addEventListener("click",()=>selectCountry(button.dataset.country)));
  }

  function renderCapacity(){
    const rows=state.data.countries.map(country=>model(country));
    const labelOffsets={ITA:{side:"left",dy:20},ESP:{side:"right",dy:-10},CZE:{side:"right",dy:4},POL:{side:"right",dy:4}};
    const width=900,height=450,pad={l:68,r:46,t:34,b:62};
    const minX=Math.floor(Math.min(...rows.map(row=>row.saving*100))/5)*5-2,maxX=Math.ceil(Math.max(...rows.map(row=>row.saving*100))/5)*5+2;
    const maxY=Math.ceil((Math.max(...rows.map(row=>row.research))+.35)*2)/2;
    const x=v=>pad.l+(v-minX)/(maxX-minX)*(width-pad.l-pad.r),y=v=>height-pad.b-v/maxY*(height-pad.t-pad.b);
    const xTicks=Array.from({length:6},(_,i)=>minX+i*(maxX-minX)/5),yTicks=Array.from({length:5},(_,i)=>i*maxY/4);
    const maxGDP=Math.max(...rows.map(row=>row.gdp));
    const root=document.querySelector("#digital-capacity-chart");
    root.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.capacityLabel)}"><line class="axis" x1="${pad.l}" x2="${width-pad.r}" y1="${height-pad.b}" y2="${height-pad.b}"/><line class="axis" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${height-pad.b}"/>${yTicks.map(v=>`<line class="grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end">${number(v,1)}</text>`).join("")}${xTicks.map(v=>`<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${height-pad.b}"/><text x="${x(v)}" y="${height-pad.b+23}" text-anchor="middle">${number(v,0)}</text>`).join("")}<text class="axis-label" x="${(pad.l+width-pad.r)/2}" y="${height-16}" text-anchor="middle">${esc(copy.savingsAxis)}</text><text class="axis-label" transform="translate(18 ${(pad.t+height-pad.b)/2}) rotate(-90)" text-anchor="middle">${esc(copy.researchAxis)}</text>${rows.map(row=>{const cx=x(row.saving*100),cy=y(row.research),r=8+Math.sqrt(row.gdp/maxGDP)*18,offset=labelOffsets[row.country.code]||{side:"right",dy:4},labelX=offset.side==="left"?cx-r-5:cx+r+5,anchor=offset.side==="left"?"end":"start";return `<g class="capacity-country" data-country="${row.country.code}" tabindex="0" role="button" aria-label="${esc(countryName(row.country))}: ${percent(row.saving*100)}, ${percent(row.research)}"><title>${esc(countryName(row.country))} · ${copy.saving} ${percent(row.saving*100)} · ${copy.research} ${percent(row.research)}</title><circle class="country-dot${row.country.code===state.selected?" is-selected":""}" cx="${cx}" cy="${cy}" r="${r}"/><text class="country-code" x="${labelX}" y="${cy+offset.dy}" text-anchor="${anchor}">${row.country.code}</text></g>`}).join("")}</svg>`;
    root.querySelectorAll("[data-country]").forEach(node=>{node.addEventListener("click",()=>selectCountry(node.dataset.country));node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectCountry(node.dataset.country)}})});
  }

  function linePath(points,x,y){return points.map((point,index)=>`${index?"L":"M"}${x(point.x).toFixed(1)},${y(point.y).toFixed(1)}`).join(" ")}
  function renderSensitivity(){
    const country=state.data.countries.find(row=>row.code===state.selected)||state.data.countries[0];
    const points=Array.from({length:15},(_,index)=>20+index*5).map(foreign=>{const row=model(country,foreign);return {foreign,leakage:row.leakageShare,supported:row.supportedShare}});
    const width=900,height=430,pad={l:68,r:40,t:50,b:62};
    const yMax=Math.ceil(Math.max(...points.flatMap(point=>[point.leakage,point.supported]))/10)*10;
    const x=v=>pad.l+(v-20)/70*(width-pad.l-pad.r),y=v=>height-pad.b-v/yMax*(height-pad.t-pad.b);
    const xTicks=[20,35,50,65,80,90],yTicks=Array.from({length:6},(_,i)=>i*yMax/5);
    const leakPoints=points.map(point=>({x:point.foreign,y:point.leakage})),supportPoints=points.map(point=>({x:point.foreign,y:point.supported}));
    const current=model(country),currentX=x(state.foreignShare);
    const root=document.querySelector("#digital-sensitivity-chart");
    root.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.sensitivityLabel(countryName(country)))}"><line class="axis" x1="${pad.l}" x2="${width-pad.r}" y1="${height-pad.b}" y2="${height-pad.b}"/><line class="axis" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${height-pad.b}"/>${yTicks.map(v=>`<line class="grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end">${number(v,0)}</text>`).join("")}${xTicks.map(v=>`<text x="${x(v)}" y="${height-pad.b+23}" text-anchor="middle">${v}</text>`).join("")}<path class="leak-line" d="${linePath(leakPoints,x,y)}"/><path class="support-line" d="${linePath(supportPoints,x,y)}"/><line class="current-guide" x1="${currentX}" x2="${currentX}" y1="${pad.t}" y2="${height-pad.b}"/><circle class="current-dot leak" cx="${currentX}" cy="${y(current.leakageShare)}" r="6"/><circle class="current-dot support" cx="${currentX}" cy="${y(current.supportedShare)}" r="6"/><line class="leak-line" x1="${pad.l+6}" x2="${pad.l+35}" y1="20" y2="20"/><text x="${pad.l+42}" y="24">${esc(copy.leakageLine)}</text><line class="support-line" x1="${pad.l+160}" x2="${pad.l+189}" y1="20" y2="20"/><text x="${pad.l+196}" y="24">${esc(copy.supportedLine)}</text><text class="axis-label" x="${(pad.l+width-pad.r)/2}" y="${height-16}" text-anchor="middle">${esc(copy.foreignAxis)}</text><text class="axis-label" transform="translate(18 ${(pad.t+height-pad.b)/2}) rotate(-90)" text-anchor="middle">${esc(copy.outputAxis)}</text></svg>`;
    document.querySelector("#digital-selected-summary").textContent=copy.summary(countryName(country),money(current.leakage),money(current.supported));
  }

  function renderTable(){
    document.querySelector("#digital-table-body").innerHTML=state.data.countries.map(country=>{const row=model(country);return `<tr data-country="${country.code}"><td>${esc(countryName(country))} · ${country.code}</td><td>${money(row.gdp)}<small>${country.nominal_gdp_usd_bn.period}</small></td><td>${percent(valueOf(country.gross_saving_pct_gdp))}<small>${country.gross_saving_pct_gdp.period}</small></td><td>${percent(row.research)}<small>${country.research_development_pct_gdp.period}</small></td><td>${percent(valueOf(country.gross_fixed_capital_formation_pct_gdp))}<small>${country.gross_fixed_capital_formation_pct_gdp.period}</small></td><td class="scenario-cell">${money(row.digitalOutput)}</td><td class="scenario-cell leak-cell">${money(row.leakage)}<small>${percent(row.leakageShare)}</small></td><td class="scenario-cell">${money(row.reinvestment)}</td><td class="scenario-cell">${money(row.supported)}</td></tr>`}).join("");
  }

  function selectCountry(code){
    if(!state.data.countries.some(country=>country.code===code))return;
    state.selected=code;document.querySelector("#digital-country-select").value=code;renderBars();renderCapacity();renderSensitivity();syncUrl();
  }
  function render(){syncControls();renderBars();renderCapacity();renderSensitivity();renderTable();syncUrl()}
  function setup(){
    const select=document.querySelector("#digital-country-select");
    if(!state.data.countries.some(country=>country.code===state.selected))state.selected="CZE";
    select.innerHTML=state.data.countries.map(country=>`<option value="${country.code}">${esc(countryName(country))}</option>`).join("");select.value=state.selected;select.addEventListener("change",()=>selectCountry(select.value));
    document.querySelector("#digital-share").addEventListener("input",event=>{state.digitalShare=Number(event.target.value);render()});
    document.querySelector("#foreign-share").addEventListener("input",event=>{state.foreignShare=Number(event.target.value);render()});
    document.querySelector("#investment-multiplier").addEventListener("input",event=>{state.multiplier=Number(event.target.value)/10;render()});
    document.querySelectorAll("[data-foreign-preset]").forEach(button=>button.addEventListener("click",()=>{state.foreignShare=Number(button.dataset.foreignPreset);render()}));
    document.querySelectorAll("[data-chart-unit]").forEach(button=>button.addEventListener("click",()=>{state.unit=button.dataset.chartUnit;render()}));
    document.querySelector("#digital-country-count").textContent=state.data.countries.length;render();
  }

  translate();
  fetch("../../data/digital-spillover.v1.json").then(response=>{if(!response.ok)throw new Error(String(response.status));return response.json()}).then(payload=>{state.data=payload;setup()}).catch(error=>{console.error(error);document.querySelector("#digital-country-bars").innerHTML=`<p class="digital-scenario-warning">${esc(copy.dataError)}</p>`});
})();
