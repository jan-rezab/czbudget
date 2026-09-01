(() => {
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs:{eyebrow:"Report / Ekonomika",titleLead:"Ekonomika za",titleEm:"rozpočtem",intro:"Dlouhé roční řady pro strukturu, čtvrtletí pro cyklus a měsíce pro body obratu. Každý údaj zůstává spojen se zdrojem, jednotkou a transformací.",globalPanel:"Globální datová vrstva",countries:"zemí a ekonomik",definitions:"definic",enoughNav:"Kolik historie stačí?",cycleNav:"Hospodářský cyklus",explorerNav:"Průzkumník řad",coverageNav:"Pokrytí",methodNav:"Datová struktura",enoughKicker:"Hloubka vzorku",enoughTitle:"Kolik historie která analýza potřebuje",enoughIntro:"Dvacet ročních bodů popíše jednu generaci veřejných financí, ale obvykle jen dva až tři velké šoky. Pro strukturální vztahy potřebujeme více režimů.",sample20Title:"Popisný základ",sample20Copy:"Vhodné pro trend a účetní srovnání. Slabé pro stabilní regresní závěry.",sample30Title:"Praktické minimum",sample30Copy:"Tři dekády obvykle zachytí více cyklů a změn politiky.",sample60Title:"Strukturální analýza",sample60Copy:"Lepší pro režimy, zpoždění a kontroly robustnosti—pokud jsou definice srovnatelné.",sampleQTitle:"Cyklická analýza",sampleQCopy:"Stejných dvacet let znamená přibližně 80 čtvrtletí nebo 240 měsíců.",ruleLabel:"Pravidlo pro reporty",ruleCopy:"Používat 1995–2025 pro roční srovnání, 2000–2025 pro čtvrtletní cyklus a nejdelší konzistentní řadu pro strukturální testy. Délka sama neopraví změny metodiky ani endogenitu.",cycleKicker:"Cyklus a rozpočet",cycleTitle:"Růst, inflace, nezaměstnanost, saldo a dluh",cycleIntro:"Růst, inflace a nezaměstnanost popisují cyklus, saldo a dluh fiskální stopu. Kauzalitu z jednoho grafu přímo vyčíst nelze.",countryLabel:"Země",explorerKicker:"Zdrojové řady",explorerTitle:"Více měření téhož ukazatele",explorerIntro:"Filtr zachovává frekvenci, transformaci a sezónní očištění. Právě tyto rozdíly musí budoucí report uvádět.",indicatorLabel:"Ukazatel",seriesLabel:"Varianta řady",coverageKicker:"Pokrytí dat",coverageTitle:"Kolik pozorování za kterou zemi máme",coverageIntro:"Tabulka počítá skutečné body a první/poslední období pro vybranou zemi. Nula znamená chybějící řadu, nikoli ekonomickou hodnotu nula.",topicLabel:"Oblast",availableLabel:"Dostupné řady",historyLabel:"Nejdelší historie",pointsLabel:"Pozorování",methodKicker:"Datový kontrakt",methodTitle:"Jedna faktová tabulka pro všechny reporty",methodIntro:"Každý bod nese zemi, ukazatel, plný klíč zdrojové řady, frekvenci, období, jednotku, sezónní očištění, transformaci, vintage a URL zdroje.",rawTitle:"Raw snapshot",rawCopy:"Datované soubory OECD, BIS, World Bank a IMF s kontrolním součtem.",factTitle:"Observation fact",factCopy:"1,4+ milionu řádků v jednotném dlouhém formátu bez imputace.",reportTitle:"Report marts",reportCopy:"Kompaktní výřezy pro grafy, coverage a nejnovější hodnoty.",causalLabel:"Důležitá hranice",causalCopy:"Více pozorování zvyšuje přesnost popisu, ale nevytváří kauzální identifikaci. Závěry o dopadu politiky vyžadují samostatný design: přirozený experiment, instrument, difference-in-differences nebo jinou obhajitelnou strategii.",footer:"Economy deep dive · IMF, OECD, World Bank and BIS",noData:"Řada není pro tuto zemi dostupná",latest:"Nejnovější",seriesCount:"řad",observationCount:"bodů",annualSpan:"let roční historie",monthly:"měsíčně",quarterly:"čtvrtletně",annual:"ročně"},
    en:{eyebrow:"Report / Economy",titleLead:"The economy behind",titleEm:"the budget",intro:"Long annual histories for structure, quarters for the cycle and months for turning points. Every observation remains tied to its source, unit and transformation.",globalPanel:"Global data layer",countries:"countries and economies",definitions:"definitions",enoughNav:"How much history?",cycleNav:"Economic cycle",explorerNav:"Series explorer",coverageNav:"Coverage",methodNav:"Data structure",enoughKicker:"Sample depth",enoughTitle:"How much history each analysis needs",enoughIntro:"Twenty annual points describe one generation of public finance, but usually only two or three large shocks. Structural relationships need more regimes.",sample20Title:"Descriptive base",sample20Copy:"Useful for trends and accounting comparisons. Weak for stable regression conclusions.",sample30Title:"Practical minimum",sample30Copy:"Three decades usually capture more cycles and policy changes.",sample60Title:"Structural analysis",sample60Copy:"Better for regimes, lags and robustness checks—if definitions remain comparable.",sampleQTitle:"Cycle analysis",sampleQCopy:"The same twenty years yield roughly 80 quarters or 240 months.",ruleLabel:"Reporting rule",ruleCopy:"Use 1995–2025 for annual comparisons, 2000–2025 for the quarterly cycle and the longest consistent series for structural tests. Length alone does not repair methodology breaks or endogeneity.",cycleKicker:"Cycle and budget",cycleTitle:"Growth, inflation, unemployment, balance and debt",cycleIntro:"Growth, inflation and unemployment describe the cycle; balance and debt show the fiscal footprint. Causality cannot be read straight off the chart.",countryLabel:"Country",explorerKicker:"Source series",explorerTitle:"Several measurements of the same concept",explorerIntro:"The filter preserves frequency, transformation and seasonal adjustment. Future reports must disclose these distinctions.",indicatorLabel:"Indicator",seriesLabel:"Series variant",coverageKicker:"Data coverage",coverageTitle:"How many observations each country has",coverageIntro:"The table counts actual points and first/last periods for the selected country. Zero means a missing series, not an economic value of zero.",topicLabel:"Topic",availableLabel:"Available series",historyLabel:"Longest history",pointsLabel:"Observations",methodKicker:"Data contract",methodTitle:"One fact table behind every report",methodIntro:"Every point carries country, indicator, full source-series key, frequency, period, unit, seasonal adjustment, transformation, vintage and source URL.",rawTitle:"Raw snapshot",rawCopy:"Dated OECD, BIS, World Bank and IMF files with checksums.",factTitle:"Observation fact",factCopy:"1.4+ million rows in one long format, without imputation.",reportTitle:"Report marts",reportCopy:"Compact extracts for charts, coverage and latest values.",causalLabel:"Important boundary",causalCopy:"More observations improve description but do not create causal identification. Policy-impact claims require a separate design: natural experiment, instrument, difference-in-differences or another defensible strategy.",footer:"Economy deep dive · IMF, OECD, World Bank and BIS",noData:"This series is unavailable for the selected country",latest:"Latest",seriesCount:"series",observationCount:"points",annualSpan:"years of annual history",monthly:"monthly",quarterly:"quarterly",annual:"annual"}
  }[lang];
  document.querySelectorAll("[data-econ-copy]").forEach(node => { const value=copy[node.dataset.econCopy]; if(value) node.textContent=value; });
  window.psdLanguageReady?.();

  const topicNames={output:["Výkon","Output"],labour:["Trh práce","Labour"],demand:["Poptávka","Demand"],external:["Vnější vztahy","External"],prices_finance:["Ceny a sazby","Prices & rates"],credit:["Úvěry","Credit"],housing:["Bydlení","Housing"],households:["Domácnosti","Households"],distribution:["Rozdělení příjmů","Distribution"],demography:["Demografie","Demography"],productivity:["Produktivita","Productivity"],supply:["Nabídka","Supply"],sentiment:["Důvěra","Sentiment"],fiscal:["Veřejné finance","Public finance"],macro:["Makro","Macro"]};
  const sourceNames={world_bank:"World Bank WDI",oecd_kei:"OECD KEI",bis:"BIS",imf_weo:"IMF WEO"};
  const cycleDefs=[
    ["real_gdp_growth_pct","Růst reálného HDP","Real GDP growth","%",false],
    ["inflation_pct","Inflace","Inflation","%",false],
    ["unemployment_pct","Nezaměstnanost","Unemployment","%",false],
    ["balance_pct_gdp","Saldo vlády","Government balance","% HDP",true],
    ["gross_debt_pct_gdp","Hrubý dluh","Gross debt","% HDP",true]
  ];
  let data;
  const number = value => new Intl.NumberFormat(lang==="en"?"en-GB":"cs-CZ",{maximumFractionDigits:1}).format(value);
  const esc = value => String(value ?? "").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
  const compact = value => new Intl.NumberFormat(lang==="en"?"en-GB":"cs-CZ",{notation:"compact",maximumFractionDigits:1}).format(value);
  const labelFor = definition => definition?.[lang==="en"?"label_en":"label_cs"] || definition?.indicator_code || "—";
  const frequencyLabel = value => value==="M"?copy.monthly:value==="Q"?copy.quarterly:copy.annual;

  function lineChart(values,{warning=false,height=220,label=""}={}){
    const clean=values.filter(item=>Number.isFinite(item[1]));
    if(clean.length<2)return `<div class="economy-empty">${copy.noData}</div>`;
    const width=760,pad={l:48,r:18,t:18,b:28};
    let min=Math.min(...clean.map(item=>item[1])),max=Math.max(...clean.map(item=>item[1]));
    if(min===max){min-=1;max+=1}else{const extra=(max-min)*.08;min-=extra;max+=extra}
    const x=i=>pad.l+i*(width-pad.l-pad.r)/Math.max(1,clean.length-1);
    const y=v=>pad.t+(max-v)*(height-pad.t-pad.b)/(max-min);
    const ticks=[0,.25,.5,.75,1].map(t=>max-(max-min)*t);
    const grid=ticks.map(v=>`<line class="grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l-7}" y="${y(v)+4}" text-anchor="end">${number(v)}</text>`).join("");
    const zero=min<0&&max>0?`<line class="zero" x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}"/>`:"";
    const path=clean.map((item,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(item[1]).toFixed(1)}`).join(" ");
    const years=[0,Math.floor((clean.length-1)/2),clean.length-1].map(i=>`<text x="${x(i)}" y="${height-6}" text-anchor="middle">${clean[i][0]}</text>`).join("");
    return `<svg class="economy-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${grid}${zero}<path class="line${warning?" warning":""}" d="${path}"/>${years}</svg>`;
  }

  function seriesFor(country,indicator){return data.series.filter(row=>row.country_code===country&&row.indicator_code===indicator)}
  function definitionFor(series){return data.definitions.find(item=>item.indicator_code===series.indicator_code&&item.source_id===series.source_id)||data.definitions.find(item=>item.indicator_code===series.indicator_code)}

  function renderCycle(country){
    const grid=document.querySelector("#cycle-grid");
    grid.innerHTML=cycleDefs.map(([code,cs,en,unit,warning])=>{
      const series=seriesFor(country,code).find(row=>row.frequency==="A");
      const values=series?.values||[]; const latest=values.at(-1);
      return `<article class="cycle-card"><header><div><h3>${lang==="en"?en:cs}</h3><span>IMF WEO · ${unit}</span></div><strong>${latest?`${number(latest[1])} ${unit}`:"—"}</strong></header>${lineChart(values,{warning,height:code==="real_gdp_growth_pct"?250:210,label:lang==="en"?en:cs})}</article>`;
    }).join("");
  }

  function renderExplorer(country){
    const indicator=document.querySelector("#economy-indicator"),seriesSelect=document.querySelector("#economy-series");
    const available=[...new Set(data.series.filter(row=>row.country_code===country).map(row=>row.indicator_code))];
    const prior=indicator.value;
    indicator.innerHTML=available.map(code=>{const d=data.definitions.find(item=>item.indicator_code===code);return `<option value="${code}">${labelFor(d)}</option>`}).sort().join("");
    indicator.value=available.includes(prior)?prior:(available.includes("oecd_kei_b1gq_q")?"oecd_kei_b1gq_q":available[0]);
    const updateVariants=()=>{
      const options=seriesFor(country,indicator.value);
      const priorSeries=seriesSelect.value;
      seriesSelect.innerHTML=options.map((row,index)=>`<option value="${index}">${sourceNames[row.source_id]} · ${frequencyLabel(row.frequency)} · ${row.unit}${row.transformation&&row.transformation!=="_Z"?` · ${row.transformation}`:""}</option>`).join("");
      if([...seriesSelect.options].some(option=>option.value===priorSeries))seriesSelect.value=priorSeries;
      const draw=()=>{
        const row=options[Number(seriesSelect.value)||0]; if(!row)return;
        const d=definitionFor(row),latest=row.values.at(-1);
        document.querySelector("#explorer-title").textContent=labelFor(d);
        document.querySelector("#explorer-unit").textContent=`${sourceNames[row.source_id]} · ${frequencyLabel(row.frequency)} · ${row.unit}`;
        document.querySelector("#explorer-latest").textContent=latest?`${number(latest[1])} · ${latest[0]}`:"—";
        document.querySelector("#explorer-chart").innerHTML=lineChart(row.values,{height:300,label:labelFor(d)});
        document.querySelector("#series-meta").innerHTML=[
          `<span>${row.frequency}</span>`,`<span>${row.unit}</span>`,
          row.seasonal_adjustment?`<span>SA: ${row.seasonal_adjustment}</span>`:"",
          row.transformation?`<span>Δ: ${row.transformation}</span>`:"",
          `<span>n = ${row.values.length}</span>`,`<span>${row.values[0]?.[0]||"—"} → ${latest?.[0]||"—"}</span>`,
          `<a href="${row.source_url}" target="_blank" rel="noopener">${sourceNames[row.source_id]} ↗</a>`
        ].join("");
      };
      seriesSelect.onchange=draw; draw();
    };
    indicator.onchange=updateVariants; updateVariants();
  }

  function renderCoverage(country){
    const rows=data.coverage.filter(row=>row.country_code===country);
    const byTopic=new Map();
    rows.forEach(row=>{const d=data.definitions.find(item=>item.indicator_code===row.indicator_code&&item.source_id===row.source_id);const topic=d?.topic||"macro";if(!byTopic.has(topic))byTopic.set(topic,[]);byTopic.get(topic).push(row)});
    const annual=rows.filter(row=>row.frequency==="A");
    const years=annual.map(row=>Number(row.last_period.slice(0,4))-Number(row.first_period.slice(0,4))+1).filter(Number.isFinite);
    document.querySelector("#coverage-summary").innerHTML=`<article><strong>${new Set(rows.map(row=>row.indicator_code)).size}</strong><span>${copy.seriesCount}</span></article><article><strong>${compact(rows.reduce((sum,row)=>sum+row.observation_count,0))}</strong><span>${copy.observationCount}</span></article><article><strong>${years.length?Math.max(...years):0}</strong><span>${copy.annualSpan}</span></article><article><strong>${new Set(rows.map(row=>row.source_id)).size}/4</strong><span>${lang==="en"?"primary sources":"primární zdroje"}</span></article>`;
    const maxPoints=Math.max(1,...[...byTopic.values()].map(items=>items.reduce((sum,row)=>sum+row.observation_count,0)));
    document.querySelector("#coverage-body").innerHTML=[...byTopic.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([topic,items])=>{
      const first=items.map(row=>row.first_period).sort()[0],last=items.map(row=>row.last_period).sort().at(-1),points=items.reduce((sum,row)=>sum+row.observation_count,0);
      return `<tr><td><b>${topicNames[topic]?.[lang==="en"?1:0]||topic}</b></td><td>${new Set(items.map(row=>`${row.indicator_code}|${row.source_id}|${row.frequency}`)).size}</td><td>${first} → ${last}</td><td>${compact(points)}<div class="coverage-bar"><i style="width:${points/maxPoints*100}%"></i></div></td></tr>`;
    }).join("");
  }

  function renderSources(){
    const summary=data.global_summary.source_counts;
    const links={world_bank:"https://api.worldbank.org/",oecd_kei:"https://sdmx.oecd.org/public/rest/v1/",bis:"https://data.bis.org/bulkdownload",imf_weo:"https://www.imf.org/en/Publications/WEO/weo-database/2026/April"};
    document.querySelector("#source-register").innerHTML=Object.keys(links).map(source=>`<a href="${links[source]}" target="_blank" rel="noopener"><strong>${sourceNames[source]}</strong><span>${compact(summary[source]||0)} ${copy.observationCount} ↗</span></a>`).join("");
  }

  function renderCountry(country){
    const item=data.countries.find(row=>row.code===country)||data.countries[0];
    document.querySelector("#economy-country-name").textContent=item[lang==="en"?"name_en":"name_cs"];
    document.querySelector("#economy-country-code").textContent=item.code;
    renderCycle(item.code);renderExplorer(item.code);renderCoverage(item.code);
    const url=new URL(location.href);url.searchParams.set("code",item.code);url.searchParams.set("lang",lang);history.replaceState({},"",url);
  }

  fetch("../../data/economy/economy-deep-dive.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json()}).then(payload=>{
    data=payload;const summary=data.global_summary;
    document.querySelector("#global-observation-count").textContent=compact(summary.observation_count);
    document.querySelector("#global-country-count").textContent=summary.country_count;
    document.querySelector("#global-indicator-count").textContent=summary.indicator_definition_count;
    const select=document.querySelector("#economy-country");
    select.innerHTML=data.countries.map(row=>`<option value="${row.code}">${row[lang==="en"?"name_en":"name_cs"]}</option>`).join("");
    const requested=new URLSearchParams(location.search).get("code");select.value=data.countries.some(row=>row.code===requested)?requested:"CZE";
    select.addEventListener("change",()=>renderCountry(select.value));
    renderSources();renderCountry(select.value);
  }).catch(error=>{document.querySelector("#cycle-grid").innerHTML=`<div class="economy-empty">Data error: ${error.message}</div>`});
})();
