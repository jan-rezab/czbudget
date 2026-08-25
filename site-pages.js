(() => {
  const lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("psd-lang") || "cs";
  const copy = {
    cs: {
      methodEyebrow:"Metodika",methodTitle:"Jak data srovnáváme.",methodLead:"U každého čísla uvádíme definici, období a původní zdroj. Tady jsou pravidla, která používáme.",methodAside:"6 pravidel pro srovnání",
      m1:"Rozsah institucí",m1c:"Mezinárodní srovnání používá sektor vládních institucí: ústřední, regionální a místní vlády plus sociální fondy.",m2:"Jednotky",m2c:"Příjmy, výdaje, saldo a dluh vyjadřujeme jako podíl HDP. Nominální částky nepoužíváme jako žebříček velikosti státu.",m3:"Rok a fáze",m3c:"U každé hodnoty uvádíme rok, rozpočtovou fázi a datum zdroje. Plán a skutečnost zůstávají oddělené.",m4:"Přepočet měn",m4c:"Přepočty používají uvedený kurz ECB. Původní částka v místní měně zůstává dohledatelná.",m5:"Účetní hranice",m5c:"Obce, regiony, státní rozpočet a veřejné korporace nesčítáme, pokud nejsou konsolidované ve společné definici.",m6:"Původ dat",m6c:"Profily odkazují na primární publikaci a uchovávají zdrojový kód. Chybějící údaj není nula.",methodSource:"Hlavní srovnávací zdroj",methodSourceValue:"IMF World Economic Outlook · duben 2026",methodCta:"Otevřít srovnání →",healthEyebrow:"Kontrola vydání",healthTitle:"Co je úplné. Co chybí. Co prověřujeme.",healthLead:"Strojově čitelná kontrola každého vydání zpřístupňuje pokrytí, výslovně chybějící data a prověřované anomálie.",ledgerEyebrow:"Datová linie · 110 záznamů",ledgerTitle:"Úplná tabulka zdrojů",ledgerLead:"Každá země a každý modul: rozsah, období, artefakt, primární zdroj, přesné místo výběru, transformace a známé mezery.",ledgerJson:"Stáhnout JSON ↓",ledgerCsv:"Stáhnout CSV ↓",ledgerCountry:"Země",ledgerModule:"Modul",ledgerStatus:"Pokrytí",ledgerSearch:"Hledat",ledgerSearchPlaceholder:"zdroj, tabulka, soubor…",ledgerHave:"Co máme",ledgerPeriodScope:"Období · rozsah",ledgerSourceExact:"Zdroj · přesné místo",ledgerTransform:"Artefakt · transformace",ledgerLimits:"Mezery a hranice",ledgerAllCountries:"Všechny země",ledgerAllModules:"Všechny moduly",ledgerAllStatuses:"Všechny stavy",ledgerFull:"Plné",ledgerPartial:"Částečné",ledgerAggregate:"Agregát",ledgerRows:"záznamů z",
      aboutEyebrow:"O projektu",aboutTitle:"O Public Spending Data",aboutLead:"Na jednom místě zveřejňujeme rozpočtová data, dlouhé časové řady a odkazy na původní zdroje.",aboutAside:"data · zdroje · metodika",aboutMission:"Co děláme",aboutMissionCopy:"Rozpočtová data jsou často rozdělená mezi portály, soubory a různé účetní definice. Převádíme je do čitelné podoby a zachováváme odkaz na jejich původ.",aboutPrinciples:"Naše pravidla",p1:"Oficiální zdroj u každé hodnoty",p2:"Jasně uvedený rozsah dat",p3:"Otevřená data a trvalé odkazy",p4:"Bez skrytého hodnocení a falešných žebříčků",releaseKicker:"Poznámky k vydání",releaseTitle:"Čtyři dny. Čtyři alpha vydání.",releaseLead:"Průběžný přehled toho, co přibylo během veřejného alpha vývoje.",releaseDate24:"24. srpna 2026",releaseTitle24:"Výsledky zdravotnictví a státní podniky",releaseCopy24:"Na hlavní stránce přibylo srovnání výkonu zdravotních systémů a nový hloubkový profil státních podniků.",releaseDate23:"23. srpna 2026",releaseTitle23:"Úplný registr veřejných subjektů",releaseCopy23:"Zveřejnili jsme registr 121 199 subjektů, sjednotili obsah profilů deseti zemí a rozšířili dopravní ukazatele.",releaseDate22:"22. srpna 2026",releaseTitle22:"Obce, města a nové hloubkové profily",releaseCopy22:"Přibylo mezinárodní centrum obcí, stránky jednotlivých zemí, nové rozpočtové a dopravní pohledy i sjednocená navigace.",releaseDate21:"21. srpna 2026",releaseTitle21:"Detailnější rozpočty a pevnější kontroly",releaseCopy21:"Obecní profily dostaly položkové členění, srovnání deseti zemí nové rozpočtové pohledy a produkční build přísnější kontroly integrity.",makerKicker:"Projekt připravuje",makerTitle:"Hlidac statu, z.u.",makerCopy:"Nezávislá česká nezisková organizace, která propojuje veřejná data a sleduje smlouvy, zakázky, dotace a další veřejné výdaje.",legal:"zapsaný ústav · nezisková organizace",office:"Velenovského 648, 251 64 Mnichovice",official:"Oficiální web ↗",impact:"Výsledky a dopad ↗",support:"Podpořit Hlidac statu, z.u. ↗"
    },
    en: {
      methodEyebrow:"Methodology",methodTitle:"How we compare the data.",methodLead:"Every figure includes its definition, period and original source. These are the rules we use.",methodAside:"6 comparison rules",
      m1:"Institutional scope",m1c:"International comparisons use general government: central, regional and local government plus social-security funds.",m2:"Units",m2c:"Revenue, expenditure, balance and debt are expressed as a share of GDP. Nominal amounts are not used to rank government size.",m3:"Year and stage",m3c:"Each value states its year, budget stage and source date. Plans and actual accounts remain separate.",m4:"Currency conversion",m4c:"Conversions use the stated ECB rate. The original amount in local currency remains traceable.",m5:"Accounting boundaries",m5c:"Municipalities, regions, state budgets and public corporations are not added together unless a common definition consolidates them.",m6:"Data provenance",m6c:"Profiles link to the primary publication and retain source codes. A missing value is never treated as zero.",methodSource:"Main comparison source",methodSourceValue:"IMF World Economic Outlook · April 2026",methodCta:"Open comparison →",healthEyebrow:"Release health",healthTitle:"What is complete. What is missing. What we review.",healthLead:"A machine-readable check for every release exposes coverage, explicitly missing data and anomalies under review.",ledgerEyebrow:"Data lineage · 110 records",ledgerTitle:"Complete source table",ledgerLead:"Every country and every module: coverage, period, artifact, primary source, exact extraction point, transformation and known gaps.",ledgerJson:"Download JSON ↓",ledgerCsv:"Download CSV ↓",ledgerCountry:"Country",ledgerModule:"Module",ledgerStatus:"Coverage",ledgerSearch:"Search",ledgerSearchPlaceholder:"source, table, file…",ledgerHave:"What we have",ledgerPeriodScope:"Period · scope",ledgerSourceExact:"Source · exact location",ledgerTransform:"Artifact · transformation",ledgerLimits:"Gaps and boundaries",ledgerAllCountries:"All countries",ledgerAllModules:"All modules",ledgerAllStatuses:"All statuses",ledgerFull:"Full",ledgerPartial:"Partial",ledgerAggregate:"Aggregate",ledgerRows:"records of",
      aboutEyebrow:"About",aboutTitle:"About Public Spending Data",aboutLead:"We publish budget data, long time series and links to original sources in one place.",aboutAside:"data · sources · methods",aboutMission:"What we do",aboutMissionCopy:"Budget data is often split across portals, files and accounting definitions. We make it easier to read while preserving a clear link to the original source.",aboutPrinciples:"Our rules",p1:"An official source for every value",p2:"A clear scope for every dataset",p3:"Open data and permanent links",p4:"No hidden scoring or false league tables",releaseKicker:"Release notes",releaseTitle:"Four days. Four alpha releases.",releaseLead:"A running record of what changed during the public alpha.",releaseDate24:"24 August 2026",releaseTitle24:"Health outcomes and state-owned enterprises",releaseCopy24:"The homepage gained a health-system performance comparison, alongside a new state-owned enterprise deep dive.",releaseDate23:"23 August 2026",releaseTitle23:"Complete public entity register",releaseCopy23:"We published a register of 121,199 entities, aligned all ten country profiles and expanded transport performance data.",releaseDate22:"22 August 2026",releaseTitle22:"Municipalities, cities and new deep dives",releaseCopy22:"A new international municipality hub, country landing pages, budget and transport views, and unified navigation went live.",releaseDate21:"21 August 2026",releaseTitle21:"Deeper budgets and stronger checks",releaseCopy21:"Municipal profiles gained line-item detail, ten-country comparisons gained new budget views, and the production build gained stricter integrity checks.",makerKicker:"Created by",makerTitle:"Hlidac statu, z.u.",makerCopy:"An independent Czech nonprofit organisation that connects public data and monitors contracts, procurement, subsidies and other public spending.",legal:"registered institute · nonprofit organisation",office:"Velenovského 648, 251 64 Mnichovice, Czechia",official:"Official website ↗",impact:"Results and impact ↗",support:"Support Hlidac statu, z.u. ↗"
    }
  };
  const coverageCopy={
    cs:{eyebrow:"Mapa datového pokrytí",title:"Kolik toho o každé zemi skutečně ukazujeme.",lead:"Orientační skóre shrnuje šíři zveřejněných vrstev. Zvolte libovolné pole a pod tabulkou se zobrazí přesné zdroje, ze kterých je složené.",country:"Země",less:"Méně pokryto",more:"Více pokryto",methodTitle:"Jak odhad počítáme",methodCopy:"Každá očekávaná datová vrstva má stejnou váhu. Plné pokrytí = 100 bodů, částečné = 60, pouze agregát = 35 a chybějící = 0. Procento je zaokrouhlený průměr vrstev v dané kategorii. Počet vrstev a zdrojů měří rozsah na tomto webu, nikoli kvalitu nebo otevřenost veřejných dat dané země.",selectionEyebrow:"Zdroje vybraného pole",selectionEmpty:"Klikněte na procento v tabulce.",selectionLead:"Výběr propojí souhrnné skóre s primárními zdroji a současně omezí úplnou tabulku zdrojů níže.",clear:"Zobrazit všech 110 záznamů",layers:"vrstev",sources:"zdrojů",sourceLinks:"unikátních zdrojů",filterNote:"Úplná tabulka níže nyní zobrazuje jen záznamy tohoto pole.",openSource:"Otevřít primární zdroj"},
    en:{eyebrow:"Data coverage map",title:"How much we actually show for each country.",lead:"This indicative score summarises the breadth of published layers. Select any cell to reveal the exact sources from which it is compiled.",country:"Country",less:"Less coverage",more:"More coverage",methodTitle:"How the estimate is calculated",methodCopy:"Each expected data layer has equal weight. Full coverage = 100 points, partial = 60, aggregate only = 35 and missing = 0. The percentage is the rounded mean of the layers in that category. Layer and source counts measure breadth on this website, not the quality or openness of a country’s public data.",selectionEyebrow:"Sources for selected cell",selectionEmpty:"Select a percentage in the table.",selectionLead:"The selection connects the summary score to its primary evidence and filters the complete source table below at the same time.",clear:"Show all 110 records",layers:"layers",sources:"sources",sourceLinks:"unique sources",filterNote:"The complete table below now shows only the records used by this cell.",openSource:"Open primary source"}
  };
  const coverageCategories=[
    {id:"country",cs:"Data o zemi",en:"Country data",modules:["sovereign","revenue","administrative_spending","common_spending","functional_spending","transport","public_entities"]},
    {id:"health",cs:"Zdravotní data",en:"Health data",modules:["health","providers"]},
    {id:"geo",cs:"Geo data",en:"Geo data",modules:["demography"]},
    {id:"municipalities",cs:"Data obcí",en:"Municipalities data",modules:["municipalities"]}
  ];
  const coverageStatusPoints={full:100,partial:60,aggregate:35};
  let current = lang === "en" ? "en" : "cs";
  let methodologyData=null,qualityData=null,releaseData=null,activeCoverageNode=null;
  const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const statusLabel=status=>copy[current][status==="full"?"ledgerFull":status==="partial"?"ledgerPartial":"ledgerAggregate"];
  function methodFilters(){return {country:document.querySelector("#method-country-filter")?.value||"",module:document.querySelector("#method-module-filter")?.value||"",status:document.querySelector("#method-status-filter")?.value||"",search:(document.querySelector("#method-source-search")?.value||"").trim().toLocaleLowerCase(current==="cs"?"cs":"en"),modules:activeCoverageNode?.modules||null};}
  function filteredMethodRows(){
    if(!methodologyData)return [];
    const filters=methodFilters();
    return methodologyData.rows.filter(row=>{
      if(filters.country&&row.country_code!==filters.country)return false;
      if(filters.module&&row.module!==filters.module)return false;
      if(filters.modules&&!filters.modules.includes(row.module))return false;
      if(filters.status&&row.status!==filters.status)return false;
      if(filters.search&&!JSON.stringify(row).toLocaleLowerCase(current==="cs"?"cs":"en").includes(filters.search))return false;
      return true;
    });
  }
  function fillSelect(selector,items,allLabel,label){
    const select=document.querySelector(selector); if(!select)return;
    const selected=select.value;
    select.innerHTML=`<option value="">${esc(allLabel)}</option>${items.map(item=>`<option value="${esc(item.value)}">${esc(item[label])}</option>`).join("")}`;
    if([...select.options].some(option=>option.value===selected))select.value=selected;
  }
  const uniqueSources=rows=>{
    const sources=new Map();
    rows.forEach(row=>row.sources.forEach(source=>{
      const key=source.url||source.title;
      if(!sources.has(key))sources.set(key,{...source,modules:new Set()});
      sources.get(key).modules.add(current==="cs"?row.module_label_cs:row.module_label_en);
    }));
    return [...sources.values()];
  };
  function coverageNode(countryCode,category){
    const rows=methodologyData.rows.filter(row=>row.country_code===countryCode&&category.modules.includes(row.module));
    const byModule=new Map(rows.map(row=>[row.module,row]));
    const score=Math.round(category.modules.reduce((sum,module)=>sum+(coverageStatusPoints[byModule.get(module)?.status]||0),0)/category.modules.length);
    return {rows,score,sources:uniqueSources(rows)};
  }
  const coverageTone=score=>score>=90?"high":score>=60?"medium":"low";
  function renderCoverageMatrix(){
    if(!methodologyData)return;
    const cc=coverageCopy[current],body=document.querySelector("#coverage-matrix-body");
    document.querySelectorAll("[data-coverage-copy]").forEach(node=>{const value=cc[node.dataset.coverageCopy];if(value)node.textContent=value;});
    document.querySelectorAll("[data-coverage-category]").forEach(node=>{const category=coverageCategories.find(item=>item.id===node.dataset.coverageCategory);if(category)node.innerHTML=`<span>${esc(category[current])}</span><small>${category.modules.length} ${esc(cc.layers)}</small>`;});
    if(body)body.innerHTML=methodologyData.countries.map(country=>{
      const cells=coverageCategories.map(category=>{
        const node=coverageNode(country.code,category),selected=activeCoverageNode?.country===country.code&&activeCoverageNode?.category===category.id;
        const label=`${country[current==="cs"?"name_cs":"name_en"]}, ${category[current]}, ${node.score}%, ${node.rows.length} ${cc.layers}, ${node.sources.length} ${cc.sources}`;
        return `<td><button type="button" class="coverage-cell coverage-cell-${coverageTone(node.score)}${selected?" selected":""}" data-coverage-country="${esc(country.code)}" data-coverage-node="${esc(category.id)}" aria-label="${esc(label)}" aria-pressed="${selected}"><strong>${node.score}<sup>%</sup></strong><span>${node.rows.length}/${category.modules.length} ${esc(cc.layers)} · ${node.sources.length} ${esc(cc.sources)}</span><i aria-hidden="true"><b style="width:${node.score}%"></b></i></button></td>`;
      }).join("");
      return `<tr><th scope="row"><b>${esc(current==="cs"?country.name_cs:country.name_en)}</b><small>${esc(country.code)}</small></th>${cells}</tr>`;
    }).join("");
    renderCoverageSelection();
  }
  function renderCoverageSelection(){
    const title=document.querySelector("#coverage-selection-title"),summary=document.querySelector("#coverage-selection-summary"),list=document.querySelector("#coverage-source-list"),clear=document.querySelector("#coverage-clear"),cc=coverageCopy[current];
    if(!title||!summary||!list||!clear||!methodologyData)return;
    clear.hidden=!activeCoverageNode;
    if(!activeCoverageNode){title.textContent=cc.selectionEmpty;summary.textContent=cc.selectionLead;list.innerHTML="";return;}
    const country=methodologyData.countries.find(item=>item.code===activeCoverageNode.country),category=coverageCategories.find(item=>item.id===activeCoverageNode.category),node=coverageNode(country.code,category);
    title.textContent=`${current==="cs"?country.name_cs:country.name_en} · ${category[current]} · ${node.score} %`;
    summary.textContent=`${node.rows.length}/${category.modules.length} ${cc.layers} · ${node.sources.length} ${cc.sourceLinks}. ${cc.filterNote}`;
    list.innerHTML=node.sources.map(source=>`<article><span>${[...source.modules].map(esc).join(" · ")}</span><h4>${esc(source.title)}</h4>${source.location?`<p>${esc(source.location)}</p>`:""}<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(cc.openSource)} ↗</a></article>`).join("");
  }
  function renderMethodology(){
    if(!methodologyData)return;
    fillSelect("#method-country-filter",methodologyData.countries.map(item=>({value:item.code,cs:item.name_cs,en:item.name_en})),copy[current].ledgerAllCountries,current);
    fillSelect("#method-module-filter",methodologyData.modules.map(item=>({value:item.id,cs:item.label_cs,en:item.label_en})),copy[current].ledgerAllModules,current);
    fillSelect("#method-status-filter",[{value:"full",cs:"Plné",en:"Full"},{value:"partial",cs:"Částečné",en:"Partial"},{value:"aggregate",cs:"Agregát",en:"Aggregate"}],copy[current].ledgerAllStatuses,current);
    const rows=filteredMethodRows(),body=document.querySelector("#method-source-rows");
    if(body)body.innerHTML=rows.map(row=>`<tr><td><b>${esc(current==="cs"?row.country_name_cs:row.country_name_en)}</b><small>${esc(row.country_code)}</small></td><td><b>${esc(current==="cs"?row.module_label_cs:row.module_label_en)}</b><code>${esc(row.module)}</code></td><td><span class="method-status method-status-${esc(row.status)}">${esc(statusLabel(row.status))}</span><p>${esc(row.coverage)}</p></td><td><b>${esc(row.period)}</b><p>${esc(row.scope)}</p></td><td>${row.sources.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)} ↗</a>`).join("")}<p>${esc(row.exact_extraction)}</p></td><td><code>${esc(row.artifact)}</code><p>${esc(row.transformation)}</p></td><td>${row.limitations?`<p>${esc(row.limitations)}</p>`:"—"}</td></tr>`).join("");
    const summary=document.querySelector("#method-ledger-summary"); if(summary)summary.textContent=`${rows.length} ${copy[current].ledgerRows} ${methodologyData.row_count}`;
    renderCoverageMatrix();
  }
  function downloadMethodCsv(){
    const headings=["country_code","country","module","status","coverage","period","scope","sources","exact_extraction","artifact","transformation","limitations"],quote=value=>`"${String(value??"").replaceAll('"','""')}"`;
    const lines=[headings.join(","),...filteredMethodRows().map(row=>[row.country_code,current==="cs"?row.country_name_cs:row.country_name_en,current==="cs"?row.module_label_cs:row.module_label_en,row.status,row.coverage,row.period,row.scope,row.sources.map(item=>`${item.title}: ${item.url}`).join(" | "),row.exact_extraction,row.artifact,row.transformation,row.limitations].map(quote).join(","))];
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}));link.download=`public-spending-data-methodology-${current}.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  function renderDataHealth(){
    const root=document.querySelector("#data-health-root");if(!root||!qualityData)return;
    const c=qualityData.counts||{},missing=qualityData.explicit_missing_data?.cash_balance_sheet_rows_missing||[],anomalies=qualityData.reviewed_anomalies||{};
    const anomalyCount=Object.values(anomalies).reduce((sum,rows)=>sum+(Array.isArray(rows)?rows.length:0),0);
    const completePct=c.municipalities?c.complete_municipal_histories/c.municipalities*100:0;
    const financePct=c.public_entity_registry?c.public_entity_financial_statements/c.public_entity_registry*100:0;
    const generated=releaseData?.data_generated_at?new Intl.DateTimeFormat(current==="cs"?"cs-CZ":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(releaseData.data_generated_at)):"—";
    const labels=current==="cs"?{
      passed:"Kontrola prošla",generated:"Data vytvořena",municipalities:"Obcí",history:"Historických záznamů",complete:"Úplné obecní historie",registry:"Veřejné subjekty",finance:"S dostupnou účetní závěrkou",missing:"Výslovně chybějící data",missingCopy:`Rozvaha a peněžní zůstatky chybí u ${missing.length} obcí. Hodnota zůstává prázdná, nikdy není nahrazena nulou.`,review:"Prověřované anomálie",reviewCopy:`${anomalyCount} extrémních nebo záporných hodnot je zachováno a označeno k revizi, nikoli automaticky smazáno.`,build:"Detailní rozpočtové členění obcí",buildCopy:"Souhrny a úplné položkové členění se slučují z BigQuery během produkčního buildu. Nulový počet v lokálním předprodukčním reportu proto není chybějící veřejný dataset.",downloads:"Strojově čitelné podklady",quality:"Kontrola kvality JSON ↓",manifest:"Manifest vydání JSON ↓",warning:"Známá mezera"}:{
      passed:"Checks passed",generated:"Data generated",municipalities:"Municipalities",history:"Historical records",complete:"Complete municipal histories",registry:"Public entities",finance:"With a comparable financial statement",missing:"Explicitly missing data",missingCopy:`Balance-sheet cash data are missing for ${missing.length} municipalities. The value remains null and is never replaced with zero.`,review:"Anomalies under review",reviewCopy:`${anomalyCount} extreme or negative observations are retained and flagged for review, not silently deleted.`,build:"Detailed municipal budget lines",buildCopy:"Headlines and complete line-item breakdowns are merged from BigQuery during the production build. A zero in the local pre-build report therefore does not mean the public dataset is missing.",downloads:"Machine-readable evidence",quality:"Quality report JSON ↓",manifest:"Release manifest JSON ↓",warning:"Known gap"};
    const cards=[[labels.municipalities,c.municipalities,"100 %"],[labels.history,c.municipal_history_records,`${completePct.toFixed(1)} % ${labels.complete.toLocaleLowerCase()}`],[labels.registry,c.public_entity_registry,`${financePct.toFixed(1)} % ${labels.finance.toLocaleLowerCase()}`],[current==="cs"?"Produkční JSON":"Production JSON",c.production_json_files,`${c.html_files||0} HTML`]];
    root.innerHTML=`<div class="data-health-status"><span class="data-health-pass">● ${labels.passed}</span><span>${labels.generated}: <b>${esc(generated)}</b></span></div><div class="data-health-kpis">${cards.map(([label,value,note])=>`<article><span>${esc(label)}</span><strong>${new Intl.NumberFormat(current==="cs"?"cs-CZ":"en-GB").format(value||0)}</strong><small>${esc(note)}</small></article>`).join("")}</div><div class="data-health-notes"><article><b>${labels.missing}</b><strong>${missing.length}</strong><p>${labels.missingCopy}</p><details><summary>${current==="cs"?"Zobrazit obce":"Show municipalities"}</summary><ul>${missing.map(item=>`<li>${esc(item.name)} <code>${esc(item.national_id)}</code></li>`).join("")}</ul></details></article><article><b>${labels.review}</b><strong>${anomalyCount}</strong><p>${labels.reviewCopy}</p><ul>${Object.entries(anomalies).map(([key,rows])=>`<li><code>${esc(key)}</code> · ${rows.length}</li>`).join("")}</ul></article><article><b>${labels.build}</b><strong>BigQuery → UI</strong><p>${labels.buildCopy}</p></article></div>${(qualityData.warnings||[]).map(warning=>`<p class="data-health-warning"><b>${labels.warning}:</b> ${esc(warning)}</p>`).join("")}<div class="data-health-downloads"><b>${labels.downloads}</b><a href="data/data-quality-report.v1.json" download>${labels.quality}</a><a href="data/release-manifest.v1.json" download>${labels.manifest}</a></div>`;
  }
  function render() {
    document.documentElement.lang = current;
    document.querySelectorAll("[data-page-copy]").forEach(node => { const value=copy[current][node.dataset.pageCopy]; if(value)node.innerHTML=value; });
    document.querySelectorAll("[data-lang]").forEach(button => { const active=button.dataset.lang===current; button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active)); });
    document.querySelectorAll("[data-language-link]").forEach(link => { const url=new URL(link.getAttribute("href"),location.href); url.searchParams.set("lang",current); link.href=url.pathname+url.search+url.hash; });
    document.querySelectorAll("[data-page-placeholder]").forEach(node=>{const value=copy[current][node.dataset.pagePlaceholder];if(value)node.placeholder=value;});
    renderMethodology();
    renderDataHealth();
    localStorage.setItem("psd-lang",current);
    history.replaceState(null,"",`${location.pathname}?lang=${current}${location.hash}`);
  }
  document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click",()=>{current=button.dataset.lang;render();}));
  ["#method-country-filter","#method-module-filter","#method-status-filter","#method-source-search"].forEach(selector=>document.querySelector(selector)?.addEventListener("input",()=>{activeCoverageNode=null;renderMethodology();}));
  document.querySelector("#coverage-matrix-body")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-coverage-node]");if(!button||!methodologyData)return;
    const category=coverageCategories.find(item=>item.id===button.dataset.coverageNode);if(!category)return;
    activeCoverageNode={country:button.dataset.coverageCountry,category:category.id,modules:category.modules};
    const countryFilter=document.querySelector("#method-country-filter"),moduleFilter=document.querySelector("#method-module-filter"),statusFilter=document.querySelector("#method-status-filter"),search=document.querySelector("#method-source-search");
    if(countryFilter)countryFilter.value=activeCoverageNode.country;if(moduleFilter)moduleFilter.value="";if(statusFilter)statusFilter.value="";if(search)search.value="";
    renderMethodology();document.querySelector(".coverage-selection")?.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  document.querySelector("#coverage-clear")?.addEventListener("click",()=>{
    activeCoverageNode=null;["#method-country-filter","#method-module-filter","#method-status-filter","#method-source-search"].forEach(selector=>{const control=document.querySelector(selector);if(control)control.value="";});renderMethodology();
  });
  document.querySelector("#method-download-csv")?.addEventListener("click",downloadMethodCsv);
  render();
  if(document.body.dataset.page==="methodology")Promise.all([
    fetch("data/methodology-sources.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/data-quality-report.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/release-manifest.v1.json").then(response=>response.ok?response.json():null)
  ]).then(([methodology,quality,release])=>{methodologyData=methodology;qualityData=quality;releaseData=release;renderMethodology();renderDataHealth();}).catch(error=>{const summary=document.querySelector("#method-ledger-summary");if(summary)summary.textContent=`Methodology data: ${error}`;const health=document.querySelector("#data-health-root");if(health)health.textContent=`Data health: ${error}`;});
})();
