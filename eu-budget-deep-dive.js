(() => {
  const assetRoot = new URL(".", document.currentScript.src).href;
  const params = new URLSearchParams(location.search);
  const state = {data:null, country:params.get("code") || "CZE", year:Number(params.get("year")) || 2024, sort:"net", direction:-1};
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const copy = {
    cs:{eyebrow:"Report / rozpočet EU",titleLead:"Toky",titleTail:"↔ EU",intro:"Kolik výdajů Evropské unie je přiřazeno zemi, kolik země odvádí a kde se tyto toky potkávají se státním rozpočtem.",country:"Země",year:"Rok",ledger:"Účetní pohled",moneyIn:"Výdaje EU přiřazené zemi",moneyOut:"Národní příspěvek do EU",difference:"Rozdíl",differenceNote:"Přiřazené výdaje minus národní příspěvek",navFlow:"Tok peněz",navState:"Státní rozpočet",navHistory:"Vývoj",navBreakdown:"Kam peníze míří",navComparison:"EU-27",navMethod:"Metodika",inLabel:"DOVNITŘ",inDefinition:"Výdaje rozpočtu EU přiřazené zemi, včetně samostatně vykázaného NextGenerationEU.",outLabel:"VEN",outDefinition:"Příspěvek založený na DPH, HND a nerecyklovaných plastech, včetně vyrovnání.",customsLabel:"CELNÍ ZDROJE",customsDefinition:"Rozdíl mezi celkovými vlastními zdroji a národním příspěvkem; není součástí našeho hlavního „ven“.",stateKicker:"Kde to je ve státním rozpočtu?",stateTitle:"Není to jeden příjmový a jeden výdajový řádek",stateIntro:"Rozpočet EU a národní státní rozpočet jsou dva různé účetní celky. Část toků státní pokladnou projde, část jde přímo jiným veřejným nebo soukromým příjemcům.",euBudget:"Rozpočet Evropské unie",euBudgetNote:"vlastní příjmy a výdajové programy",pathContribution:"Národní příspěvek",pathContributionCopy:"V národním rozpočtu je výdajem; v rozpočtu EU příjmem.",pathManaged:"Sdílené řízení",pathManagedCopy:"Kohezní a zemědělské fondy administrují národní orgány a mohou procházet veřejnými rozpočty.",pathDirect:"Přímí příjemci",pathDirectCopy:"Univerzita, firma nebo obec může dostat platbu přímo z programu EU; ve státním rozpočtu ji proto neuvidíte.",pathCustoms:"Cla",pathCustomsCopy:"Celní správa je vybírá jako tradiční vlastní zdroj EU. Vedeme je odděleně od národního příspěvku.",nationalBudgets:"Národní a další rozpočty",nationalBudgetsNote:"stát · fondy · kraje · obce · přímí příjemci",shortAnswer:"Krátká odpověď",shortAnswerCopy:"Na stránce státního rozpočtu hledáte jen tu část, kterou skutečně účtuje stát. Číslo „výdaje EU přiřazené zemi“ je širší a nesmí se do státního rozpočtu přičítat jako další příjem.",historyKicker:"2000–2024",historyTitle:"Dvě strany toku v čase",historyIntro:"Před vstupem země do EU může zdroj vykazovat předvstupní výdaje. Graf členského vztahu proto začíná rokem vstupu.",moneyInShort:"Přiřazené výdaje",moneyOutShort:"Národní příspěvek",breakdownKicker:"Výdajové okruhy",breakdownTitle:"Kam přiřazené výdaje míří",breakdownIntro:"Hlavní okruhy dlouhodobého rozpočtu. Částky kombinují standardní výdaje a samostatně zveřejněnou složku NextGenerationEU.",ngeu:"z toho NextGenerationEU",ngeuNote:"Dočasný nástroj obnovy je ve zdroji vykázán odděleně. Na této stránce jej zahrnujeme do „peněz dovnitř“.",comparisonKicker:"Všech 27 členů",comparisonTitle:"Kdo dostává a kdo přispívá",comparisonIntro:"Absolutní částky ukazují velikost toku, ne ekonomický přínos členství. Tabulku lze seřadit kliknutím na záhlaví.",ownResources:"Vlastní zdroje celkem",methodKicker:"Jak čísla číst",methodTitle:"Účetní mapa, ne účet členství",methodIntro:"Rozdíl na této stránce je průhledný výpočet přiřazené výdaje minus národní příspěvek. Není to oficiální provozní rozpočtové saldo ani ocenění jednotného trhu.",methodAllocatedTitle:"Přiřazení",methodAllocated:"Komise přiřazuje výdaje zemi příjemce, kde je to možné. Přeshraniční přínosy tím zachytit nelze.",methodOutTitle:"Co znamená „ven“",methodOut:"Používáme národní příspěvek. Cla zobrazujeme zvlášť, protože jsou tradičním vlastním zdrojem EU.",methodPriceTitle:"Běžné ceny",methodPrice:"Částky jsou nominální miliony eur daného roku. Historie není očištěna o inflaci.",methodTimingTitle:"Časování",methodTiming:"Výdaje a příspěvky jsou skutečnost za kalendářní rozpočtový rok, nikoli plán nebo přislíbená alokace.",primarySource:"Primární zdroj",sourceName:"EU spending and revenue — Data 2000–2024",openSource:"Otevřít zdroj a XLSX ↗",footer:"Toky rozpočtu EU · Evropská komise",positiveCountries:"zemí s kladným rozdílem",negativeCountries:"zemí se záporným rozdílem",allocatedTotal:"přiřazené výdaje EU-27",memberSince:"členem od",currentPrices:"běžné ceny · mil. EUR",loadError:"Data toků rozpočtu EU se nepodařilo načíst."},
    en:{eyebrow:"Report / EU budget",titleLead:"Flows",titleTail:"↔ EU",intro:"How much European Union spending is attributed to a country, how much the country contributes, and where those flows meet the national budget.",country:"Country",year:"Year",ledger:"Accounting view",moneyIn:"EU spending attributed to country",moneyOut:"National contribution to the EU",difference:"Difference",differenceNote:"Attributed spending minus national contribution",navFlow:"Money flow",navState:"National budget",navHistory:"History",navBreakdown:"Where it goes",navComparison:"EU-27",navMethod:"Method",inLabel:"IN",inDefinition:"EU budget expenditure attributed to the country, including separately reported NextGenerationEU.",outLabel:"OUT",outDefinition:"VAT-, GNI- and non-recycled-plastics-based contribution, including adjustments.",customsLabel:"CUSTOMS RESOURCES",customsDefinition:"The difference between total own resources and the national contribution; excluded from our headline “out”.",stateKicker:"Where is it in the national budget?",stateTitle:"It is not one revenue line and one spending line",stateIntro:"The EU budget and a national state budget are different accounting entities. Some flows pass through the treasury; others go directly to public or private beneficiaries.",euBudget:"European Union budget",euBudgetNote:"own revenue and spending programmes",pathContribution:"National contribution",pathContributionCopy:"It is expenditure in the national budget and revenue in the EU budget.",pathManaged:"Shared management",pathManagedCopy:"National authorities administer cohesion and agricultural funds, which may pass through public budgets.",pathDirect:"Direct beneficiaries",pathDirectCopy:"A university, company or municipality may receive a programme payment directly; it therefore does not appear in the state budget.",pathCustoms:"Customs",pathCustomsCopy:"Customs authorities collect these as a traditional EU own resource. We keep them separate from the national contribution.",nationalBudgets:"National and other budgets",nationalBudgetsNote:"state · funds · regions · municipalities · direct beneficiaries",shortAnswer:"Short answer",shortAnswerCopy:"The national-budget page contains only the part actually recorded by the state. “EU spending attributed to the country” is broader and must not be added to national-budget revenue.",historyKicker:"2000–2024",historyTitle:"Both sides of the flow over time",historyIntro:"The source may record pre-accession spending before a country joined the EU. The membership chart therefore starts with the accession year.",moneyInShort:"Attributed spending",moneyOutShort:"National contribution",breakdownKicker:"Spending headings",breakdownTitle:"Where attributed spending goes",breakdownIntro:"The main headings of the long-term budget. Amounts combine standard expenditure and the separately published NextGenerationEU component.",ngeu:"of which NextGenerationEU",ngeuNote:"The temporary recovery instrument is reported separately in the source. This page includes it in money “in”.",comparisonKicker:"All 27 members",comparisonTitle:"Who receives and who contributes",comparisonIntro:"Absolute amounts show the size of the flow, not the economic benefit of membership. Click a heading to sort the table.",ownResources:"Total own resources",methodKicker:"How to read the data",methodTitle:"An accounting map, not a membership bill",methodIntro:"The difference on this page is the transparent calculation attributed spending minus national contribution. It is not the official operating budgetary balance or a valuation of the single market.",methodAllocatedTitle:"Attribution",methodAllocated:"The Commission attributes spending to the beneficiary country where possible. Cross-border benefits cannot be captured this way.",methodOutTitle:"What “out” means",methodOut:"We use the national contribution. Customs is separate because it is a traditional EU own resource.",methodPriceTitle:"Current prices",methodPrice:"Amounts are nominal millions of euros for each year. The history is not adjusted for inflation.",methodTimingTitle:"Timing",methodTiming:"Spending and contributions are actuals for the calendar budget year, not plans or promised allocations.",primarySource:"Primary source",sourceName:"EU spending and revenue — Data 2000–2024",openSource:"Open source and XLSX ↗",footer:"EU budget flows · European Commission",positiveCountries:"countries with a positive difference",negativeCountries:"countries with a negative difference",allocatedTotal:"EU-27 attributed spending",memberSince:"member since",currentPrices:"current prices · EUR million",loadError:"The EU budget-flow data could not be loaded."}
  };
  Object.assign(copy.cs, {
    breakdownIntro: "Rozklikněte okruh na fondy a programy. U každého vidíte běžné výdaje a NextGenerationEU zvlášť; jejich součet tvoří částku okruhu.",
    programme: "Fond / program", regular: "Běžné výdaje EU", total: "Celkem", share: "Podíl v okruhu",
    detailHint: "Fondy a programy", detailUnits: "Částky v mil. EUR, běžné ceny", detailUnavailable: "Podrobný rozpad podle současných výdajových okruhů je dostupný pro roky 2021–2024. Vyberte rok nahoře.",
    detailSource: "Zdroj: Evropská komise · DG Budget", downloadDetail: "Stáhnout programy CSV", workbook: "Zdrojový Excel ↗",
    detailMethod: "Součty obsahují pouze nejnižší vykázané položky, bez opětovného přičtení mezisoučtů. Jde o výdaje přiřazené zemi, nikoli seznam projektů nebo příjemců.",
    sourceCells: "Buňky ve zdroji", noProgrammes: "Zdroj zde neuvádí podrobnější rozpad."
  });
  Object.assign(copy.en, {
    breakdownIntro: "Expand a heading to see funds and programmes. Regular EU spending and NextGenerationEU are shown separately; together they add up to the heading total.",
    programme: "Fund / programme", regular: "Regular EU spending", total: "Total", share: "Share of heading",
    detailHint: "Funds and programmes", detailUnits: "EUR million, current prices", detailUnavailable: "The detailed breakdown using current spending headings is available for 2021–2024. Select a year above.",
    detailSource: "Source: European Commission · DG Budget", downloadDetail: "Download programmes CSV", workbook: "Source workbook ↗",
    detailMethod: "Totals use only the lowest reported rows, without adding intermediate subtotals again. These are country-attributed expenditures, not a list of projects or beneficiaries.",
    sourceCells: "Source cells", noProgrammes: "The source provides no further breakdown here."
  });
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const t = (key) => copy[lang()][key];
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const money = (million, signed=false) => {
    if (!Number.isFinite(million)) return "—";
    const value = million / 1000;
    const formatted = new Intl.NumberFormat(locale(), {minimumFractionDigits:Math.abs(value)<10?2:1, maximumFractionDigits:Math.abs(value)<10?2:1}).format(Math.abs(value));
    const sign = million < 0 ? "−" : signed && million > 0 ? "+" : "";
    return lang()==="en" ? `${sign}€${formatted}bn` : `${sign}${formatted} mld. €`;
  };
  const countryName = (country) => country[`name_${lang()}`];
  const country = () => state.data.countries.find((item) => item.iso3 === state.country) || state.data.countries[0];
  const rowFor = (item, year=state.year) => item.series.find((row) => row.year === year);
  const selectedRow = () => rowFor(country());
  const updateUrl = () => {const url=new URL(location.href);url.searchParams.set("code",state.country);url.searchParams.set("year",state.year);url.searchParams.set("lang",lang());history.replaceState({},"",url)};

  function translate(){
    document.querySelectorAll("[data-eu-copy]").forEach((node)=>{const value=t(node.dataset.euCopy);if(value)node.textContent=value});
    document.title = lang()==="en" ? "Money between countries and the EU — Public Spending Data" : "Peníze mezi zeměmi a EU — Public Spending Data";
  }

  function renderSelectors(){
    const selected=country();
    $("#eu-country").innerHTML=state.data.countries.slice().sort((a,b)=>countryName(a).localeCompare(countryName(b),locale())).map((item)=>`<option value="${item.iso3}" ${item.iso3===selected.iso3?"selected":""}>${esc(countryName(item))}</option>`).join("");
    const years=selected.series.filter((row)=>row.year>=Math.max(2021,selected.member_since)).map((row)=>row.year).sort((a,b)=>b-a);
    if(!years.includes(state.year))state.year=years[0];
    $("#eu-year").innerHTML=years.map((year)=>`<option value="${year}" ${year===state.year?"selected":""}>${year}</option>`).join("");
  }

  function renderHero(){
    const item=country(),row=selectedRow();
    $("#hero-country-name").textContent=countryName(item);$("#hero-year").textContent=state.year;$("#boundary-country-code").textContent=item.eu_code;
    $("#hero-in").textContent=money(row?.allocated_spending_m_eur);$("#hero-out").textContent=money(row?.national_contribution_m_eur);$("#hero-net").textContent=money(row?.accounting_difference_m_eur,true);
    $("#hero-net").className=(row?.accounting_difference_m_eur||0)>=0?"positive":"negative";
    $("#definition-in").textContent=money(row?.allocated_spending_m_eur);$("#definition-out").textContent=money(row?.national_contribution_m_eur);
    $("#definition-customs").textContent=money(row?.traditional_own_resources_m_eur);
  }

  function positionTooltip(clientX,clientY){
    const tooltip=$("#eu-chart-tooltip");if(!tooltip)return;
    const gap=15,pad=12,rect=tooltip.getBoundingClientRect();let left=clientX+gap,top=clientY+gap;
    if(left+rect.width>innerWidth-pad)left=clientX-rect.width-gap;
    if(top+rect.height>innerHeight-pad)top=clientY-rect.height-gap;
    tooltip.style.left=`${Math.max(pad,left)}px`;tooltip.style.top=`${Math.max(pad,top)}px`;
  }
  function showTooltip(title,rows,clientX,clientY){
    const tooltip=$("#eu-chart-tooltip");if(!tooltip)return;
    tooltip.innerHTML=`<strong>${esc(title)}</strong>${rows.map(([label,value,tone])=>`<div><span>${esc(label)}</span><b class="${tone||""}">${esc(value)}</b></div>`).join("")}`;
    tooltip.hidden=false;positionTooltip(clientX,clientY);
  }
  function hideTooltip(){const tooltip=$("#eu-chart-tooltip");if(tooltip)tooltip.hidden=true;document.querySelectorAll(".eu-history-point-group.is-hovered").forEach((node)=>node.classList.remove("is-hovered"));}
  function showHistoryTooltip(year,clientX,clientY){
    const item=country(),row=rowFor(item,year);if(!row)return;
    document.querySelectorAll(".eu-history-point-group").forEach((node)=>node.classList.toggle("is-hovered",Number(node.dataset.euPointYear)===year));
    showTooltip(`${countryName(item)} · ${year}`,[[t("moneyInShort"),money(row.allocated_spending_m_eur)],[t("moneyOutShort"),money(row.national_contribution_m_eur)],[t("difference"),money(row.accounting_difference_m_eur,true),row.accounting_difference_m_eur>=0?"positive":"negative"],[t("ownResources"),money(row.total_own_resources_m_eur)]],clientX,clientY);
  }
  function showBreakdownTooltip(code,clientX,clientY){
    const row=selectedRow(),item=row?.spending_breakdown?.find((entry)=>entry.code===code);if(!item)return;
    const share=row?.allocated_spending_m_eur?new Intl.NumberFormat(locale(),{style:"percent",maximumFractionDigits:1}).format(item.amount_m_eur/row.allocated_spending_m_eur):"—";
    showTooltip(`${item[`label_${lang()}`]} · ${state.year}`,[[t("regular"),money(item.mff_spending_m_eur)],["NextGenerationEU",money(item.ngeu_spending_m_eur)],[t("total"),money(item.amount_m_eur)],[t("share"),share]],clientX,clientY);
  }

  const pathFor=(rows,key,x,y)=>rows.map((row,index)=>`${index?"L":"M"}${x(row.year).toFixed(1)},${y(row[key]).toFixed(1)}`).join(" ");
  function renderHistory(){
    const item=country(),rows=item.series.filter((row)=>row.year>=item.member_since&&Number.isFinite(row.national_contribution_m_eur));
    const W=1100,H=390,m={l:72,r:24,t:24,b:45};
    const values=rows.flatMap((row)=>[row.allocated_spending_m_eur,row.national_contribution_m_eur,row.accounting_difference_m_eur]).filter(Number.isFinite);
    let min=Math.min(0,...values),max=Math.max(0,...values);if(min===max)max=min+1;const pad=(max-min)*.08;min-=pad;max+=pad;
    const x=(year)=>m.l+(year-rows[0].year)/(rows.at(-1).year-rows[0].year||1)*(W-m.l-m.r);const y=(value)=>m.t+(max-value)/(max-min)*(H-m.t-m.b);
    const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4).reverse();
    const years=[rows[0].year,...rows.filter((_,i)=>i>0&&i<rows.length-1&&i%5===0).map((r)=>r.year),rows.at(-1).year];
    const grid=ticks.map((value)=>`<line class="chart-grid" x1="${m.l}" x2="${W-m.r}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis" x="${m.l-10}" y="${y(value)+4}" text-anchor="end">${(value/1000).toFixed(value<1000?1:0)}</text>`).join("");
    const labels=years.map((year)=>`<text class="chart-axis" x="${x(year)}" y="${H-14}" text-anchor="middle">${year}</text>`).join("");
    const last=rows.at(-1),band=(W-m.l-m.r)/Math.max(rows.length,1);
    const dots=rows.map((row)=>`<g class="eu-history-point-group${row===last?" is-last":""}" data-eu-point-year="${row.year}">${[["allocated_spending_m_eur","var(--eu-mint)"],["national_contribution_m_eur","var(--eu-red)"],["accounting_difference_m_eur","var(--eu-blue)"]].filter(([key])=>Number.isFinite(row[key])).map(([key,fill])=>`<circle class="chart-point" cx="${x(row.year)}" cy="${y(row[key])}" r="5" fill="${fill}"/>`).join("")}</g>`).join("");
    const hits=rows.map((row)=>`<rect class="eu-history-hit" data-eu-history-year="${row.year}" tabindex="0" role="img" aria-label="${esc(countryName(item))} ${row.year}" x="${x(row.year)-band/2}" y="${m.t}" width="${band}" height="${H-m.t-m.b}"/>`).join("");
    $("#eu-history-chart").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("historyTitle"))}">${grid}<line class="chart-zero" x1="${m.l}" x2="${W-m.r}" y1="${y(0)}" y2="${y(0)}"/><path class="chart-line-in" d="${pathFor(rows,"allocated_spending_m_eur",x,y)}"/><path class="chart-line-out" d="${pathFor(rows,"national_contribution_m_eur",x,y)}"/><path class="chart-line-net" d="${pathFor(rows,"accounting_difference_m_eur",x,y)}"/>${dots}${hits}${labels}<text class="chart-axis" x="8" y="15">€ bn</text></svg>`;
    $("#history-caption").textContent=`${countryName(item)} · ${t("memberSince")} ${item.member_since} · ${t("currentPrices")}`;
  }

  function renderBreakdown(){
    const row=selectedRow(),items=row?.spending_breakdown||[];const max=Math.max(...items.map((item)=>item.amount_m_eur),1);
    const number=(value)=>new Intl.NumberFormat(locale(),{maximumFractionDigits:3}).format(value);
    const openCodes=new Set([...document.querySelectorAll(".eu-programme-group[open]")].map((node)=>node.dataset.heading));
    $("#eu-breakdown-bars").innerHTML=items.length?items.map((item)=>{
      const programmes=item.programmes||[];
      const heading=`<span>${esc(item[`label_${lang()}`])}<small>${esc(programmes.length?t("detailHint"):t("noProgrammes"))}${programmes.length?` · ${programmes.length}`:""}</small></span><div class="breakdown-track" aria-hidden="true"><div class="breakdown-fill" style="width:${Math.max(0,item.amount_m_eur/max*100)}%"></div></div><strong>${money(item.amount_m_eur)}</strong>`;
      if(!programmes.length)return `<div class="breakdown-row" data-eu-breakdown-code="${esc(item.code)}" tabindex="0">${heading}</div>`;
      return `<details class="eu-programme-group" data-heading="${esc(item.code)}"${openCodes.has(item.code)?" open":""}><summary class="breakdown-row" data-eu-breakdown-code="${esc(item.code)}">${heading}</summary><div class="eu-programme-content"><p>${esc(t("detailUnits"))} · ${esc(countryName(country()))} · ${state.year}</p><div class="eu-programme-scroll" tabindex="0" role="region" aria-label="${esc(item[`label_${lang()}`])}"><table><caption class="eu-programme-caption">${esc(item[`label_${lang()}`])}</caption><thead><tr><th scope="col">${esc(t("programme"))}</th><th scope="col">${esc(t("regular"))}</th><th scope="col">NextGenerationEU</th><th scope="col">${esc(t("total"))}</th><th scope="col">${esc(t("share"))}</th></tr></thead><tbody>${programmes.map((p)=>`<tr><th scope="row">${esc(p[`label_${lang()}`])}<small>${esc(p.code)} · ${esc(t("sourceCells"))}: ${esc(Object.values(p.source_cells||{}).join(" + "))}</small></th><td>${number(p.mff_spending_m_eur)}</td><td>${number(p.ngeu_spending_m_eur)}</td><td><strong>${number(p.amount_m_eur)}</strong></td><td>${item.amount_m_eur?new Intl.NumberFormat(locale(),{style:"percent",maximumFractionDigits:1}).format(p.amount_m_eur/item.amount_m_eur):"—"}</td></tr>`).join("")}</tbody><tfoot><tr><th scope="row">${esc(t("total"))}</th><td>${number(item.mff_spending_m_eur)}</td><td>${number(item.ngeu_spending_m_eur)}</td><td>${number(item.amount_m_eur)}</td><td>100 %</td></tr></tfoot></table></div></div></details>`;
    }).join(""):`<p>${esc(t("detailUnavailable"))}</p>`;
    $("#ngeu-value").textContent=money(row?.ngeu_spending_m_eur);
    $("#eu-programme-source").href=state.data.sources.download_url;
    $("#eu-programme-provenance").textContent=`${t("detailSource")} · ${state.year} · ${t("detailUnits")}`;
    $("#eu-programme-download").hidden=!items.some((item)=>item.programmes?.length);
  }

  function downloadProgrammes(){
    const fields=["country","year","heading_code","programme_code","programme","regular_m_eur","ngeu_m_eur","total_m_eur","source_cells","source_url"];
    const rows=(selectedRow()?.spending_breakdown||[]).flatMap((h)=>(h.programmes||[]).map((p)=>[state.country,state.year,h.code,p.code,p[`label_${lang()}`],p.mff_spending_m_eur,p.ngeu_spending_m_eur,p.amount_m_eur,Object.values(p.source_cells).join(" + "),state.data.sources.download_url]));
    const csv=[fields,...rows].map((row)=>row.map((cell)=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`eu-programmes-${state.country}-${state.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function comparisonRows(){return state.data.countries.map((item)=>({item,row:rowFor(item)})).filter(({row,item})=>row&&state.year>=item.member_since)}
  function renderComparison(){
    const rows=comparisonRows(),positive=rows.filter(({row})=>row.accounting_difference_m_eur>=0).length,negative=rows.length-positive,total=rows.reduce((sum,{row})=>sum+row.allocated_spending_m_eur,0);
    $("#comparison-summary").innerHTML=`<article><span>${esc(t("positiveCountries"))}</span><strong>${positive}</strong></article><article><span>${esc(t("negativeCountries"))}</span><strong>${negative}</strong></article><article><span>${esc(t("allocatedTotal"))}</span><strong>${money(total)}</strong></article>`;
    const value=({item,row})=>state.sort==="name"?countryName(item):state.sort==="in"?row.allocated_spending_m_eur:state.sort==="out"?row.national_contribution_m_eur:state.sort==="own"?row.total_own_resources_m_eur:row.accounting_difference_m_eur;
    rows.sort((a,b)=>state.sort==="name"?value(a).localeCompare(value(b),locale())*state.direction:((value(a)??-Infinity)-(value(b)??-Infinity))*state.direction);
    $("#eu-comparison-body").innerHTML=rows.map(({item,row})=>`<tr><td><span class="country-cell"><img src="${assetRoot}assets/flags/${item.eu_code==="EL"?"gr":item.eu_code.toLowerCase()}.svg" alt="" loading="lazy" decoding="async"><span><b>${esc(countryName(item))}</b><small>${item.iso3}</small></span></span></td><td>${money(row.allocated_spending_m_eur)}</td><td>${money(row.national_contribution_m_eur)}</td><td class="${row.accounting_difference_m_eur>=0?"positive":"negative"}"><b>${money(row.accounting_difference_m_eur,true)}</b></td><td>${money(row.total_own_resources_m_eur)}</td></tr>`).join("");
  }

  function render(){translate();renderSelectors();renderHero();renderHistory();renderBreakdown();renderComparison();updateUrl()}
  $("#eu-programme-download").addEventListener("click",downloadProgrammes);
  $("#eu-country").addEventListener("change",(event)=>{state.country=event.target.value;const item=country();state.year=Math.min(state.data.period.last,Math.max(item.member_since,state.year));render()});
  $("#eu-year").addEventListener("change",(event)=>{state.year=Number(event.target.value);render()});
  $("#eu-comparison-table").querySelectorAll("th[data-sort]").forEach((th)=>th.addEventListener("click",()=>{const next=th.dataset.sort;if(state.sort===next)state.direction*=-1;else{state.sort=next;state.direction=next==="name"?1:-1}renderComparison()}));
  $("#eu-history-chart").addEventListener("pointermove",(event)=>{const hit=event.target.closest("[data-eu-history-year]");if(hit)showHistoryTooltip(Number(hit.dataset.euHistoryYear),event.clientX,event.clientY);else hideTooltip()});
  $("#eu-history-chart").addEventListener("pointerleave",hideTooltip);
  $("#eu-history-chart").addEventListener("focusin",(event)=>{const hit=event.target.closest("[data-eu-history-year]");if(!hit)return;const rect=hit.getBoundingClientRect();showHistoryTooltip(Number(hit.dataset.euHistoryYear),Math.min(innerWidth-24,rect.right),rect.top)});
  $("#eu-history-chart").addEventListener("focusout",hideTooltip);
  $("#eu-breakdown-bars").addEventListener("pointermove",(event)=>{const row=event.target.closest("[data-eu-breakdown-code]");if(row)showBreakdownTooltip(row.dataset.euBreakdownCode,event.clientX,event.clientY);else hideTooltip()});
  $("#eu-breakdown-bars").addEventListener("pointerleave",hideTooltip);
  $("#eu-breakdown-bars").addEventListener("focusin",(event)=>{const row=event.target.closest("[data-eu-breakdown-code]");if(!row)return;const rect=row.getBoundingClientRect();showBreakdownTooltip(row.dataset.euBreakdownCode,Math.min(innerWidth-24,rect.right),rect.top)});
  $("#eu-breakdown-bars").addEventListener("focusout",hideTooltip);
  addEventListener("psdlanguagechange",()=>{if(state.data)render()});
  fetch(`${assetRoot}data/eu-budget-flows.v1.json`).then((response)=>{if(!response.ok)throw new Error(response.status);return response.json()}).then((data)=>{state.data=data;if(!data.countries.some((item)=>item.iso3===state.country))state.country="CZE";state.year=Math.min(state.year,data.period.last);$("#eu-source-link").href=data.sources.page_url;render()}).catch((error)=>{console.error("EU budget flows",error);document.querySelector("main").insertAdjacentHTML("afterbegin",`<p class="eu-load-error">${esc(t("loadError"))}</p>`)});
})();
