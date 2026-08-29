(() => {
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const copy = {
    cs:{eyebrow:"Report / Obrana",titleLead:"Výdaje",titleEm:"na obranu",intro:"Mezinárodní srovnání na jedné ose a původní rozpočtové řádky v detailu každé země.",countryLabel:"Země",countryProfile:"Otevřít celý profil země",compareNav:"% HDP",detailNav:"Detail země",linesNav:"Rozpočtové řádky",methodNav:"Metodika",compareKicker:"Mezinárodní srovnání",compareTitle:"Výdaje na armádu vůči velikosti ekonomiky",compareIntro:"Nejnovější srovnatelný rok SIPRI. U členů NATO vyznačujeme závazek pro jádrové obranné výdaje do roku 2035.",latestComparable:"nejnovější společný rok",natoTarget:"jádrový cíl NATO do 2035",natoTotal:"celkem včetně širší bezpečnosti",detailKicker:"Detail země",detailTitle:"v čase a v rozpočtu",trendKicker:"Historie",trendTitle:"Vojenské výdaje jako % HDP",trendNote:"Změna v čase používá jednu harmonizovanou řadu. Mezery nejsou nuly.",linesKicker:"Původní rozpočet",linesTitle:"Rozpočtové řádky až do nejnižší dostupné úrovně",searchLabel:"Hledat v rozpočtu",shownLabel:"Zobrazeno",codeHeader:"Kód",parentHeader:"Program / kapitola",lineHeader:"Rozpočtový řádek",classHeader:"Klasifikace",amountHeader:"Částka",methodKicker:"Co lze srovnávat",methodTitle:"Harmonizované srovnání a národní detail",methodIntro:"Mezinárodní graf je harmonizovaný. Detailní tabulky zachovávají národní rozsah, rok, měnu i klasifikaci a proto se mezi zeměmi nesčítají řádek po řádku.",methodCompare:"Roční vojenské výdaje jako podíl HDP, licence CC BY 4.0.",methodNato:"Hagský závazek: 3,5 % HDP na jádrové obranné potřeby a až 1,5 % na širší bezpečnost do roku 2035.",nationalTitle:"Národní rozpočty",methodNational:"Nejjemnější legálně a veřejně dostupná strojově čitelná vrstva, kterou máme pro danou zemi staženou.",natoMembers:"Členové NATO",otherCountries:"Partneři a ostatní země",targetLabel:"NATO 3,5 %",chartNote:"SIPRI a NATO používají odlišné definice; čára je kontext, nikoli verdikt o plnění.",axisCapped:"Osa je kvůli čitelnosti zastropována na 6 %; hodnota Ukrajiny je vypsána celá.",gdpShare:"vojenské výdaje / HDP",budgetTotal:"součet zobrazených řádků",budgetLines:"rozpočtových řádků",budgetPeriod:"období rozpočtu",noLines:"Žádný řádek neodpovídá hledání.",loadError:"Data obranného profilu se nepodařilo načíst.",nato:"NATO",notNato:"mimo NATO"},
    en:{eyebrow:"Report / Defense",titleLead:"Defense",titleEm:"spending",intro:"International comparison on one scale, with each country’s original budget lines in the detail.",countryLabel:"Country",countryProfile:"Open full country profile",compareNav:"% of GDP",detailNav:"Country detail",linesNav:"Budget lines",methodNav:"Method",compareKicker:"International comparison",compareTitle:"Military spending relative to the economy",compareIntro:"The latest common SIPRI year. NATO members carry the core-defense commitment for 2035.",latestComparable:"latest common year",natoTarget:"NATO core target by 2035",natoTotal:"total incl. broader security",detailKicker:"Country detail",detailTitle:"over time and in the budget",trendKicker:"History",trendTitle:"Military expenditure as % of GDP",trendNote:"The time series uses one harmonised measure. Gaps are not zeroes.",linesKicker:"Native budget",linesTitle:"Budget lines down to the lowest available level",searchLabel:"Search the budget",shownLabel:"Showing",codeHeader:"Code",parentHeader:"Programme / chapter",lineHeader:"Budget line",classHeader:"Classification",amountHeader:"Amount",methodKicker:"What is comparable",methodTitle:"The harmonised comparison and the national detail",methodIntro:"The international chart is harmonised. Detail tables preserve national scope, year, currency and classification, so their rows should not be compared line by line across countries.",methodCompare:"Annual military expenditure as a share of GDP, licensed CC BY 4.0.",methodNato:"The Hague commitment: 3.5% of GDP for core defense and up to 1.5% for broader security by 2035.",nationalTitle:"National budgets",methodNational:"The finest legal, public and machine-readable layer currently downloaded for each country.",natoMembers:"NATO members",otherCountries:"Partners and other countries",targetLabel:"NATO 3.5%",chartNote:"SIPRI and NATO use different definitions; the marker is context, not a compliance ruling.",axisCapped:"The axis is capped at 6% for readability; Ukraine’s full value is printed.",gdpShare:"military expenditure / GDP",budgetTotal:"sum of displayed lines",budgetLines:"budget lines",budgetPeriod:"budget period",noLines:"No budget line matches the search.",loadError:"Defense profile data could not be loaded.",nato:"NATO",notNato:"non-NATO"}
  }[lang];
  document.querySelectorAll("[data-defense-copy]").forEach(node => { const value=copy[node.dataset.defenseCopy]; if(value)node.textContent=value; });
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const number = (value,digits=1) => new Intl.NumberFormat(lang==="en"?"en-US":"cs-CZ",{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
  const compact = value => new Intl.NumberFormat(lang==="en"?"en-US":"cs-CZ",{notation:"compact",maximumFractionDigits:1}).format(value);
  const flag = code => ({USA:"us",CZE:"cz",DEU:"de",DNK:"dk",FIN:"fi",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",BRA:"br",ESP:"es",JPN:"jp",NLD:"nl",NOR:"no",GRC:"gr"}[code]);
  let data, state={code:"USA",search:""};
  const country = code => data.countries.find(item=>item.code===code) || data.countries[0];
  const name = item => item[lang==="en"?"name_en":"name_cs"];
  const unitLabel = budget => budget.unit.startsWith("billion") ? (lang==="en"?`${budget.currency} bn`:`mld. ${budget.currency}`) : (lang==="en"?`${budget.currency} mn`:`mil. ${budget.currency}`);

  function groupChart(items,label,target=false){
    const max=6;
    const targetPosition=data.commitments.nato_core_pct_gdp_2035/max*100;
    const rows=items.map(item=>{const value=item.comparison.latest?.value;const width=Math.min(100,(value||0)/max*100);const tick=target?`<b class="defense-target-tick" style="left:${targetPosition}%"></b>`:"";return `<button class="defense-rank-row ${item.nato_member?"nato":""} ${item.code===state.code?"selected":""}" data-country="${item.code}" type="button"><span class="defense-rank-name"><img src="../../assets/flags/${flag(item.code)}.svg" alt=""><span>${esc(name(item))}</span><small>${item.code}</small></span><span class="defense-rank-track"><i style="width:${width}%"></i>${tick}</span><strong>${value==null?"—":number(value,1)+"%"}</strong></button>`}).join("");
    return `<section class="defense-rank-group"><header><span>${label}</span><span>${target?copy.targetLabel:"% GDP"}</span></header>${rows}</section>`;
  }
  function renderComparison(){
    const nato=data.countries.filter(item=>item.nato_member).sort((a,b)=>(a.code==="USA"?-1:b.code==="USA"?1:(b.comparison.latest?.value||0)-(a.comparison.latest?.value||0)));
    const others=data.countries.filter(item=>!item.nato_member).sort((a,b)=>(b.comparison.latest?.value||0)-(a.comparison.latest?.value||0));
    $("#comparison-year").textContent=Math.min(...data.countries.map(item=>item.comparison.latest?.year).filter(Boolean));
    $("#defense-comparison-chart").innerHTML=groupChart(nato,copy.natoMembers,true)+groupChart(others,copy.otherCountries,false);
    $("#comparison-note").textContent=`${copy.chartNote} ${copy.axisCapped}`;
    $("#defense-comparison-chart").querySelectorAll("[data-country]").forEach(button=>button.addEventListener("click",()=>selectCountry(button.dataset.country,true)));
  }
  function trendChart(series){
    const points=series.filter(([year,value])=>year>=2000&&Number.isFinite(value));if(points.length<2)return `<p class="defense-empty">—</p>`;
    const W=900,H=300,p={l:58,r:24,t:25,b:35},minY=0,maxY=Math.max(4,Math.ceil(Math.max(...points.map(row=>row[1]))));
    const x=year=>p.l+(year-points[0][0])/(points.at(-1)[0]-points[0][0])*(W-p.l-p.r),y=value=>p.t+(maxY-value)/maxY*(H-p.t-p.b);
    const line=points.map((row,i)=>`${i?"L":"M"}${x(row[0]).toFixed(1)},${y(row[1]).toFixed(1)}`).join(" ");
    const area=`${line} L${x(points.at(-1)[0])},${H-p.b} L${x(points[0][0])},${H-p.b} Z`;
    const grid=[0,.25,.5,.75,1].map(r=>{const v=maxY*r;return `<line class="grid" x1="${p.l}" x2="${W-p.r}" y1="${y(v)}" y2="${y(v)}"></line><text x="${p.l-9}" y="${y(v)+4}" text-anchor="end">${number(v,0)}%</text>`}).join("");
    const years=[points[0][0],2010,2020,points.at(-1)[0]].filter((v,i,a)=>v>=points[0][0]&&v<=points.at(-1)[0]&&a.indexOf(v)===i).map(v=>`<text x="${x(v)}" y="${H-10}" text-anchor="middle">${v}</text>`).join("");
    return `<svg class="defense-trend-svg" viewBox="0 0 ${W} ${H}" role="img"><path class="area" d="${area}"></path>${grid}<path class="line" d="${line}"></path>${years}</svg>`;
  }
  function renderLines(item){
    const q=state.search.trim().toLocaleLowerCase(lang==="cs"?"cs":"en");
    const rows=item.budget.items.filter(row=>!q||[row.id,row.parent,row.label_native,row.label_en,row.classification].some(value=>String(value||"").toLocaleLowerCase(lang==="cs"?"cs":"en").includes(q)));
    $("#line-count").textContent=`${rows.length} / ${item.budget.item_count}`;
    $("#defense-lines-body").innerHTML=rows.length?rows.map(row=>`<tr><td>${esc(row.id)}</td><td>${esc(row.parent)}</td><td>${esc((lang==="en"&&row.label_en)||row.label_native)}</td><td>${esc(row.classification||row.subfunction||"—")}</td><td>${number(row.amount,Math.abs(row.amount)<1?2:1)} ${esc(unitLabel(item.budget))}</td></tr>`).join(""):`<tr><td colspan="5" class="defense-empty">${copy.noLines}</td></tr>`;
  }
  function renderCountry(){
    const item=country(state.code),budget=item.budget,latest=item.comparison.latest;
    $("#detail-country-name").textContent=name(item);$("#detail-scope").textContent=budget[lang==="en"?"scope_en":"scope_cs"];
    $("#coverage-note").textContent=budget[lang==="en"?"coverage_note_en":"coverage_note_cs"];
    $("#defense-kpis").innerHTML=`<article><span>${copy.gdpShare}</span><strong>${latest?number(latest.value,2)+"%":"—"}</strong><small>${latest?.year||"—"} · ${item.nato_member?copy.nato:copy.notNato}</small></article><article><span>${copy.budgetTotal}</span><strong>${compact(budget.total_amount)}</strong><small>${unitLabel(budget)}</small></article><article><span>${copy.budgetLines}</span><strong>${budget.item_count}</strong><small>${esc(budget.granularity.replaceAll("_"," "))}</small></article><article><span>${copy.budgetPeriod}</span><strong>${esc(budget.period)}</strong><small>${esc(budget[lang==="en"?"status_en":"status_cs"])}</small></article>`;
    $("#trend-latest").textContent=latest?`${number(latest.value,2)}% · ${latest.year}`:"—";$("#defense-trend").innerHTML=trendChart(item.comparison.series);
    $("#national-sources").innerHTML=budget.sources.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>`).join("");
    renderLines(item);renderComparison();
  }
  function selectCountry(code,updateUrl=false){
    state.code=data.countries.some(item=>item.code===code)?code:"USA";state.search="";$("#defense-line-search").value="";
    const select=$("#deep-dive-country");if(select&&select.value!==state.code){select.value=state.code;select.dispatchEvent(new Event("change",{bubbles:true}))}else renderCountry();
    if(updateUrl){const url=new URL(location.href);url.searchParams.set("code",state.code);url.searchParams.set("lang",lang);history.replaceState({},"",url)}
  }
  fetch("../../data/defense-deep-dive.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json()}).then(payload=>{
    data=payload;const requested=new URLSearchParams(location.search).get("code")?.toUpperCase();state.code=data.countries.some(item=>item.code===requested)?requested:"USA";
    const select=$("#deep-dive-country");
    const syncSelector=()=>{if([...select.options].some(option=>option.value===state.code)){select.value=state.code;$("#deep-dive-country-code").textContent=state.code;$("#deep-dive-country-name").textContent=name(country(state.code));$("#deep-dive-country-profile").href=window.PSDCountryRoutes.href(state.code,lang);const sticky=$(".deep-sticky-filter select");if(sticky&&sticky.value!==state.code){sticky.value=state.code;sticky.dispatchEvent(new Event("change",{bubbles:true}))}}};
    syncSelector();select.dispatchEvent(new Event("change",{bubbles:true}));select.addEventListener("change",()=>{state.code=select.value;syncSelector();renderCountry()});
    $("#defense-line-search").addEventListener("input",event=>{state.search=event.target.value;renderLines(country(state.code))});
    $("#comparison-source").href=data.comparison_source.url;$("#nato-source").href=data.commitments.source_url;renderCountry();
  }).catch(error=>{console.error("defense deep dive",error);$("main").insertAdjacentHTML("afterbegin",`<p class="defense-load-error">${copy.loadError}</p>`)});
})();
