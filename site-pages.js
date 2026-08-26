(() => {
  const lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("psd-lang") || "cs";
  const copy = {
    cs: {
      methodEyebrow:"Metodika",methodTitle:"Jak data srovnáváme.",methodLead:"U každého čísla uvádíme definici, období a původní zdroj. Tady jsou pravidla, která používáme.",methodAside:"6 pravidel pro srovnání",
      m1:"Rozsah institucí",m1c:"Mezinárodní srovnání používá sektor vládních institucí: ústřední, regionální a místní vlády plus sociální fondy.",m2:"Jednotky",m2c:"Příjmy, výdaje, saldo a dluh vyjadřujeme jako podíl HDP. Nominální částky nepoužíváme jako žebříček velikosti státu.",m3:"Rok a fáze",m3c:"U každé hodnoty uvádíme rok, rozpočtovou fázi a datum zdroje. Plán a skutečnost zůstávají oddělené.",m4:"Přepočet měn",m4c:"Přepočty používají uvedený kurz ECB. Původní částka v místní měně zůstává dohledatelná.",m5:"Účetní hranice",m5c:"Obce, regiony, státní rozpočet a veřejné korporace nesčítáme, pokud nejsou konsolidované ve společné definici.",m6:"Původ dat",m6c:"Profily odkazují na primární publikaci a uchovávají zdrojový kód. Chybějící údaj není nula.",methodSource:"Hlavní srovnávací zdroj",methodSourceValue:"IMF World Economic Outlook · duben 2026",methodCta:"Otevřít srovnání →",healthEyebrow:"Kontrola vydání",healthTitle:"Co je úplné. Co chybí. Co prověřujeme.",healthLead:"Strojově čitelná kontrola každého vydání zpřístupňuje pokrytí, výslovně chybějící data a prověřované anomálie.",ledgerEyebrow:"Datová linie · 110 záznamů",ledgerTitle:"Úplná tabulka zdrojů",ledgerLead:"Každá země a každý modul: rozsah, období, artefakt, primární zdroj, přesné místo výběru, transformace a známé mezery.",ledgerJson:"Stáhnout JSON ↓",ledgerCsv:"Stáhnout CSV ↓",ledgerCountry:"Země",ledgerModule:"Modul",ledgerStatus:"Pokrytí",ledgerSearch:"Hledat",ledgerSearchPlaceholder:"zdroj, tabulka, soubor…",ledgerHave:"Co máme",ledgerPeriodScope:"Období · rozsah",ledgerSourceExact:"Zdroj · přesné místo",ledgerTransform:"Artefakt · transformace",ledgerLimits:"Mezery a hranice",ledgerAllCountries:"Všechny země",ledgerAllModules:"Všechny moduly",ledgerAllStatuses:"Všechny stavy",ledgerFull:"Plné",ledgerPartial:"Částečné",ledgerAggregate:"Agregát",ledgerRows:"záznamů z",
      atlasEyebrow:"Rozpočtová transparentnost · svět",atlasTitle:"Co vlády zveřejňují — stát i obce, bez zaměňování vrstev.",atlasLead:"Mapa pokrývá 195 států. Přepíná mezi transparentností státního rozpočtu, položkovým obecním životním cyklem a sedmi datovými schopnostmi portálu. Černá vždy znamená neprověřeno.",
      aboutEyebrow:"O projektu",aboutTitle:"O Public Spending Data",aboutLead:"Na jednom místě zveřejňujeme rozpočtová data, dlouhé časové řady a odkazy na původní zdroje.",aboutAside:"data · zdroje · metodika",aboutMission:"Co děláme",aboutMissionCopy:"Rozpočtová data jsou často rozdělená mezi portály, soubory a různé účetní definice. Převádíme je do čitelné podoby a zachováváme odkaz na jejich původ.",aboutPrinciples:"Naše pravidla",p1:"Oficiální zdroj u každé hodnoty",p2:"Jasně uvedený rozsah dat",p3:"Otevřená data a trvalé odkazy",p4:"Bez skrytého hodnocení a falešných žebříčků",releaseKicker:"Poznámky k vydání",releaseTitle:"Čtyři dny. Čtyři alpha vydání.",releaseLead:"Průběžný přehled toho, co přibylo během veřejného alpha vývoje.",releaseDate24:"24. srpna 2026",releaseTitle24:"Výsledky zdravotnictví a státní podniky",releaseCopy24:"Na hlavní stránce přibylo srovnání výkonu zdravotních systémů a nový hloubkový profil státních podniků.",releaseDate23:"23. srpna 2026",releaseTitle23:"Úplný registr veřejných subjektů",releaseCopy23:"Zveřejnili jsme registr 121 199 subjektů, sjednotili obsah profilů deseti zemí a rozšířili dopravní ukazatele.",releaseDate22:"22. srpna 2026",releaseTitle22:"Obce, města a nové hloubkové profily",releaseCopy22:"Přibylo mezinárodní centrum obcí, stránky jednotlivých zemí, nové rozpočtové a dopravní pohledy i sjednocená navigace.",releaseDate21:"21. srpna 2026",releaseTitle21:"Detailnější rozpočty a pevnější kontroly",releaseCopy21:"Obecní profily dostaly položkové členění, srovnání deseti zemí nové rozpočtové pohledy a produkční build přísnější kontroly integrity.",makerKicker:"Projekt připravuje",makerTitle:"Hlidac statu, z.u.",makerCopy:"Nezávislá česká nezisková organizace, která propojuje veřejná data a sleduje smlouvy, zakázky, dotace a další veřejné výdaje.",legal:"zapsaný ústav · nezisková organizace",official:"Oficiální web ↗",impact:"Výsledky a dopad ↗",support:"Podpořit Hlidac statu, z.u. ↗"
    },
    en: {
      methodEyebrow:"Methodology",methodTitle:"How we compare the data.",methodLead:"Every figure includes its definition, period and original source. These are the rules we use.",methodAside:"6 comparison rules",
      m1:"Institutional scope",m1c:"International comparisons use general government: central, regional and local government plus social-security funds.",m2:"Units",m2c:"Revenue, expenditure, balance and debt are expressed as a share of GDP. Nominal amounts are not used to rank government size.",m3:"Year and stage",m3c:"Each value states its year, budget stage and source date. Plans and actual accounts remain separate.",m4:"Currency conversion",m4c:"Conversions use the stated ECB rate. The original amount in local currency remains traceable.",m5:"Accounting boundaries",m5c:"Municipalities, regions, state budgets and public corporations are not added together unless a common definition consolidates them.",m6:"Data provenance",m6c:"Profiles link to the primary publication and retain source codes. A missing value is never treated as zero.",methodSource:"Main comparison source",methodSourceValue:"IMF World Economic Outlook · April 2026",methodCta:"Open comparison →",healthEyebrow:"Release health",healthTitle:"What is complete. What is missing. What we review.",healthLead:"A machine-readable check for every release exposes coverage, explicitly missing data and anomalies under review.",ledgerEyebrow:"Data lineage · 110 records",ledgerTitle:"Complete source table",ledgerLead:"Every country and every module: coverage, period, artifact, primary source, exact extraction point, transformation and known gaps.",ledgerJson:"Download JSON ↓",ledgerCsv:"Download CSV ↓",ledgerCountry:"Country",ledgerModule:"Module",ledgerStatus:"Coverage",ledgerSearch:"Search",ledgerSearchPlaceholder:"source, table, file…",ledgerHave:"What we have",ledgerPeriodScope:"Period · scope",ledgerSourceExact:"Source · exact location",ledgerTransform:"Artifact · transformation",ledgerLimits:"Gaps and boundaries",ledgerAllCountries:"All countries",ledgerAllModules:"All modules",ledgerAllStatuses:"All statuses",ledgerFull:"Full",ledgerPartial:"Partial",ledgerAggregate:"Aggregate",ledgerRows:"records of",
      atlasEyebrow:"Budget transparency · world",atlasTitle:"What governments publish — national and municipal, kept distinct.",atlasLead:"The map covers 195 states and switches between national-budget transparency, the municipal item-level lifecycle, and seven data capabilities needed by the portal. Black always means not researched.",
      aboutEyebrow:"About",aboutTitle:"About Public Spending Data",aboutLead:"We publish budget data, long time series and links to original sources in one place.",aboutAside:"data · sources · methods",aboutMission:"What we do",aboutMissionCopy:"Budget data is often split across portals, files and accounting definitions. We make it easier to read while preserving a clear link to the original source.",aboutPrinciples:"Our rules",p1:"An official source for every value",p2:"A clear scope for every dataset",p3:"Open data and permanent links",p4:"No hidden scoring or false league tables",releaseKicker:"Release notes",releaseTitle:"Four days. Four alpha releases.",releaseLead:"A running record of what changed during the public alpha.",releaseDate24:"24 August 2026",releaseTitle24:"Health outcomes and state-owned enterprises",releaseCopy24:"The homepage gained a health-system performance comparison, alongside a new state-owned enterprise deep dive.",releaseDate23:"23 August 2026",releaseTitle23:"Complete public entity register",releaseCopy23:"We published a register of 121,199 entities, aligned all ten country profiles and expanded transport performance data.",releaseDate22:"22 August 2026",releaseTitle22:"Municipalities, cities and new deep dives",releaseCopy22:"A new international municipality hub, country landing pages, budget and transport views, and unified navigation went live.",releaseDate21:"21 August 2026",releaseTitle21:"Deeper budgets and stronger checks",releaseCopy21:"Municipal profiles gained line-item detail, ten-country comparisons gained new budget views, and the production build gained stricter integrity checks.",makerKicker:"Created by",makerTitle:"Hlidac statu, z.u.",makerCopy:"An independent Czech nonprofit organisation that connects public data and monitors contracts, procurement, subsidies and other public spending.",legal:"registered institute · nonprofit organisation",official:"Official website ↗",impact:"Results and impact ↗",support:"Support Hlidac statu, z.u. ↗"
    }
  };
  Object.assign(copy.cs,{
    ledgerEyebrow:"Datová linie",
    releaseTitle:"Pět dní. Pět alpha vydání.",
    releaseDate26:"26. srpna 2026",
    releaseTitle26:"Položkové obecní rozpočty nasazeny",
    releaseCopy26:"Produkční datový sklad a metodika nyní zveřejňují ověřené položkové obecní rozpočty pro Polsko, Dánsko, Ukrajinu, Francii, Švédsko, Anglii a dílčí kolekce pro Německo, USA a Švýcarsko."
  });
  Object.assign(copy.en,{
    ledgerEyebrow:"Data lineage",
    releaseTitle:"Five days. Five alpha releases.",
    releaseDate26:"26 August 2026",
    releaseTitle26:"Itemized municipal budgets deployed",
    releaseCopy26:"The production warehouse and methodology now publish verified itemized municipal budgets for Poland, Denmark, Ukraine, France, Sweden and England, plus partial collections for Germany, the United States and Switzerland."
  });
  const statusCopy={
    cs:{pageTitle:"Stav dat",pageIntro:"Pokrytí podle země, období a primárního zdroje.",publishedData:"Publikovaných datových záznamů",releaseTitle:"Vydání",releaseNote:"Aktuální publikovaný rozsah",coverageTitle:"Pokrytí podle země",coverageHint:"Kliknutím na buňku zobrazíte zdroje",coverageContract:"Tabulka odděluje publikovaná data PSD od dat, která existují u oficiálního zdroje, ale ještě nejsou načtená. Stav „nenalezeno“ znamená pouze výsledek zdokumentovaného průzkumu, nikoli důkaz neexistence.",legendLoaded:"Načteno v PSD",legendAvailable:"Zdroj existuje · nenačteno",legendFragmented:"Existuje · roztříštěné / nesrovnatelné",legendNotFound:"V průzkumu nenalezeno",country:"Země",selectedSource:"Vybraný zdroj",selectionEmpty:"Vyberte buňku tabulky",clear:"Zrušit filtr",definitions:"Definice",defFiscal:"Fiskální historie země",defFiscalValue:"Harmonizované řady sektoru vládních institucí.",defMunicipal:"Obce",defMunicipalValue:"Počet jednotek v rozsahu obecního zdroje; agregát není vydáván za jednotlivé obce.",defItemized:"Položkové rozpočty obcí",defItemizedValue:"Počet obecních profilů s ekonomickými, funkčními nebo původními účetními položkami; souhrnné částky se nepočítají.",defTransport:"Doprava",defTransportValue:"Roky výkonových řad / roky funkčních výdajů COFOG 04.5.",defMissing:"Chybějící data",defMissingValue:"Pomlčka bez barevného stavu znamená, že vrstva není v PSD a dostupnost zdroje zatím nebyla ověřena; nejde o nulu.",defAvailability:"Dostupnost zdroje",defAvailabilityValue:"„Zdroj existuje“ není publikované pokrytí PSD. Kliknutí otevře důkaz, cestu k načtení a hranice srovnatelnosti.",ledgerTitle:"Registr zdrojů",ledgerJson:"JSON ↓",years:"let",year:"rok",entities:"jednotek",countries:"zemí",records:"záznamů",sourceRecords:"zdrojových záznamů",metrics:"ukazatelů",fields:"polí",stages:"fází",performance:"výkon",transportBudget:"rozpočet",full:"plné",partial:"částečné",aggregate:"agregát",missing:"chybí",notPublished:"nepublikováno",sourceExists:"Zdroj existuje",notLoaded:"nenačteno v PSD",fragmented:"Roztříštěné",fragmentedDetail:"vyžaduje harmonizaci",notFound:"Nenalezeno",notFoundDetail:"prověřeno · bez vhodného zdroje",ingestion:"Cesta k načtení",of:"z",openSource:"Otevřít zdroj",filtered:"Registr zdrojů níže je filtrován podle této buňky.",checksPassed:"Kontroly prošly",snapshot:"Datový snapshot",municipalScope:"Obecní jednotky v rozsahu",entityRows:"Řádky obecního adresáře",municipalCountryYears:"Obecní roky podle zemí",sources:"Registr zdrojů",sourceLinks:"zdrojů",entityLevel:"na úrovni jednotek",aggregateOnly:"pouze agregát",aggregateRows:"agregovaných",revenue:"příjmy",expenditure:"výdaje",balance:"saldo",cash:"hotovost",financing:"financování",enacted:"schválený",revised:"upravený",actual:"skutečnost"},
    en:{pageTitle:"Data status",pageIntro:"Coverage by country, period and primary source.",publishedData:"Published data entries",releaseTitle:"Release",releaseNote:"Current published scope",coverageTitle:"Coverage by country",coverageHint:"Select a cell to inspect its sources",coverageContract:"The table separates data published by PSD from data that exists at an official source but has not been loaded. “Not found” describes a documented search result, not proof that data does not exist.",legendLoaded:"Loaded in PSD",legendAvailable:"Source exists · not loaded",legendFragmented:"Exists · fragmented / non-comparable",legendNotFound:"Not found in review",country:"Country",selectedSource:"Selected source",selectionEmpty:"Select a table cell",clear:"Clear filter",definitions:"Definitions",defFiscal:"Country fiscal history",defFiscalValue:"Harmonised general-government series.",defMunicipal:"Municipalities",defMunicipalValue:"Entities in scope of the municipal source; aggregate means no entity-level financial extract.",defItemized:"Itemized municipal budgets",defItemizedValue:"Municipal profiles with economic, functional or native accounting line items; headline totals do not count.",defTransport:"Transport",defTransportValue:"Years of performance series / years of COFOG 04.5 functional expenditure.",defMissing:"Missing data",defMissingValue:"A dash without a coloured status means the layer is absent from PSD and source availability has not yet been verified; it is not zero.",defAvailability:"Source availability",defAvailabilityValue:"“Source exists” is not published PSD coverage. Select the cell for evidence, an ingestion route and comparability limits.",ledgerTitle:"Source registry",ledgerJson:"JSON ↓",years:"years",year:"year",entities:"entities",countries:"countries",records:"records",sourceRecords:"source records",metrics:"metrics",fields:"fields",stages:"stages",performance:"performance",transportBudget:"budget",full:"full",partial:"partial",aggregate:"aggregate",missing:"missing",notPublished:"not published",sourceExists:"Source exists",notLoaded:"not loaded in PSD",fragmented:"Fragmented",fragmentedDetail:"harmonisation required",notFound:"Not found",notFoundDetail:"reviewed · no suitable source",ingestion:"Ingestion route",of:"of",openSource:"Open source",filtered:"The source registry below is filtered to this cell.",checksPassed:"Checks passed",snapshot:"Data snapshot",municipalScope:"Municipal entities in scope",entityRows:"Municipal directory rows",municipalCountryYears:"Municipal country-years",sources:"Source registry",sourceLinks:"sources",entityLevel:"entity-level",aggregateOnly:"aggregate only",aggregateRows:"aggregate only",revenue:"revenue",expenditure:"expenditure",balance:"balance",cash:"cash",financing:"financing",enacted:"enacted",revised:"revised",actual:"actual"}
  };
  const coverageCategories=[
    {id:"fiscal",cs:"Fiskální historie země",en:"Country fiscal history",modules:["sovereign"]},
    {id:"health",cs:"Zdravotnictví",en:"Health",modules:["health"]},
    {id:"geo",cs:"Populace / geo",en:"Population / geo",modules:["demography"]},
    {id:"municipalities",cs:"Obecní jednotky",en:"Municipal entities",modules:["municipalities"],municipal:true},
    {id:"municipalHistory",cs:"Obecní historie",en:"Municipal history",modules:["municipalities"],municipal:true},
    {id:"transport",cs:"Doprava",en:"Transport",modules:["transport"],transport:true},
    {id:"budgetDetail",cs:"Položkové rozpočty obcí",en:"Itemized municipal budgets",modules:["municipal_itemized"],municipal:true}
  ];
  let current = lang === "en" ? "en" : "cs";
  let methodologyData=null,qualityData=null,releaseData=null,municipalityData=null,itemizedBudgetData=null,transportPerformanceData=null,transportBudgetData=null,coverageResearchData=null,activeCoverageNode=null;
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
  const integer=value=>new Intl.NumberFormat(current==="cs"?"cs-CZ":"en-GB").format(Number(value)||0);
  const methodRow=(code,module)=>methodologyData?.rows.find(row=>row.country_code===code&&row.module===module);
  const researchCell=(code,category)=>coverageResearchData?.countries?.[code]?.[category];
  function researchedGap(code,category){
    const sc=statusCopy[current],research=researchCell(code,category);
    if(!research)return {primary:"—",secondary:sc.missing,status:"missing"};
    if(research.status==="source_available")return {primary:sc.sourceExists,secondary:sc.notLoaded,status:"available"};
    if(research.status==="fragmented")return {primary:sc.fragmented,secondary:sc.fragmentedDetail,status:"fragmented"};
    return {primary:sc.notFound,secondary:sc.notFoundDetail,status:"not-found"};
  }
  const municipalCountry=code=>municipalityData?.countries.find(country=>country.code===code);
  const itemizedCountry=code=>itemizedBudgetData?.countries.find(country=>country.code===code);
  function statusCountries(){
    const countries=new Map();
    methodologyData?.countries.forEach(country=>countries.set(country.code,{code:country.code,cs:country.name_cs,en:country.name_en}));
    municipalityData?.countries.forEach(country=>countries.set(country.code,{code:country.code,cs:countries.get(country.code)?.cs||country.name_cs,en:countries.get(country.code)?.en||country.name_en}));
    return [...countries.values()];
  }
  const yearSpan=years=>{
    const values=[...new Set((years||[]).filter(Number.isFinite))].sort((a,b)=>a-b);
    return {values,count:values.length,label:values.length?values.length===1?String(values[0]):`${values[0]}–${values.at(-1)}`:"—"};
  };
  function periodStats(value){
    const years=String(value||"").match(/\b(?:19|20)\d{2}\b/g)?.map(Number)||[];
    if(years.length>=2&&/[–-]/.test(String(value)))return {label:`${years[0]}–${years[1]}`,count:Math.abs(years[1]-years[0])+1};
    return yearSpan(years);
  }
  const municipalHistoryStats=code=>methodRow(code,"municipalities")?.period?periodStats(methodRow(code,"municipalities").period):yearSpan(municipalCountry(code)?.years);
  function transportStats(code){
    const performance=transportPerformanceData?.countries?.[code]||{},observations=[];
    [performance.rail,performance.road].forEach(mode=>Object.values(mode||{}).forEach(value=>{if(Array.isArray(value))observations.push(...value);}));
    Object.values(performance.infrastructure_spending||{}).forEach(mode=>Object.values(mode||{}).forEach(value=>{if(Array.isArray(value))observations.push(...value);}));
    const performanceYears=yearSpan(observations.map(row=>Number(row.year)));
    const budget=transportBudgetData?.countries?.[code],budgetYears=yearSpan((budget?.records||[]).map(row=>Number(row.year)));
    const allYears=yearSpan([...performanceYears.values,...budgetYears.values]);
    return {performanceYears,budgetYears,allYears,observations:observations.length,budget};
  }
  function coverageCell(code,category){
    const sc=statusCopy[current],row=methodRow(code,category.modules[0]),municipal=municipalCountry(code);
    if(category.id==="fiscal"){
      const period=periodStats(row?.period),metrics=String(row?.coverage||"").match(/(\d+)\s+metrics/)?.[1];
      return row?{primary:period.label,secondary:`${period.count} ${sc.years}${metrics?` · ${metrics} ${sc.metrics}`:""}`,status:row.status}:researchedGap(code,category.id);
    }
    if(category.id==="health")return row?{primary:row.period||"—",secondary:sc[row.status]||row.status,status:row.status}:researchedGap(code,category.id);
    if(category.id==="geo"){
      const period=periodStats(row?.period);return row?{primary:period.label,secondary:`${period.count} ${sc.years}`,status:row.status}:researchedGap(code,category.id);
    }
    if(category.id==="municipalities"){
      const aggregate=municipal?.status==="aggregate_only";return {primary:municipal?integer(municipal.directory_count):"—",secondary:municipal?(aggregate?sc.aggregateOnly:sc.entityLevel):sc.missing,status:municipal?(aggregate?"aggregate":"full"):"missing"};
    }
    if(category.id==="municipalHistory"){
      const years=municipalHistoryStats(code);return {primary:years.label,secondary:municipal?`${years.count} ${years.count===1?sc.year:sc.years}`:sc.missing,status:municipal?.status==="aggregate_only"?"aggregate":municipal?"full":"missing"};
    }
    if(category.id==="transport"){
      const stats=transportStats(code),hasPerformance=stats.performanceYears.count>0,hasBudget=stats.budgetYears.count>0;
      return hasPerformance||hasBudget?{primary:stats.allYears.label,secondary:`${stats.performanceYears.count} ${sc.performance} · ${stats.budgetYears.count} ${sc.transportBudget}`,status:hasPerformance&&hasBudget?"full":"partial"}:researchedGap(code,category.id);
    }
    if(category.id==="budgetDetail"){
      const detail=itemizedCountry(code),count=Number(detail?.profile_count)||0,scope=Number(detail?.municipal_scope)||Number(municipal?.directory_count)||0;
      return count
        ? {primary:integer(count),secondary:`${sc.of} ${integer(scope)} · ${detail.period} · ${detail[current==="cs"?"detail_kind_cs":"detail_kind_en"]}`,status:count===scope?"full":"partial"}
        : {primary:"—",secondary:sc.notPublished,status:"missing"};
    }
    return {primary:"—",secondary:sc.missing,status:"missing"};
  }
  function nodeSources(code,category){
    const sources=new Map(),label=category[current];
    const add=source=>{if(!source?.url)return;const key=source.url;if(!sources.has(key))sources.set(key,{...source,modules:new Set()});sources.get(key).modules.add(label);};
    methodologyData.rows.filter(row=>row.country_code===code&&category.modules.includes(row.module)).forEach(row=>row.sources.forEach(add));
    if(category.municipal){
      const municipal=municipalCountry(code);if(municipal?.source)add({url:municipal.source,title:municipal.source_detail?.publisher&&municipal.source_detail?.dataset?`${municipal.source_detail.publisher} · ${municipal.source_detail.dataset}`:`${statusCountries().find(country=>country.code===code)?.[current]||code} · ${category[current]}`,location:municipal.source_detail?.location||municipal[current==="cs"?"coverage_cs":"coverage_en"]});
    }
    if(category.id==="budgetDetail"){
      const detail=itemizedCountry(code);if(detail?.source_url)add({url:detail.source_url,title:detail.source_title,location:detail.note});
    }
    if(category.transport){
      const stats=transportStats(code);
      if(stats.performanceYears.count)(transportPerformanceData?.sources||[]).forEach(add);
      if(stats.budgetYears.count)(transportBudgetData?.sources||[]).forEach(add);
    }
    (researchCell(code,category.id)?.sources||[]).forEach(item=>add({...item,location:item.location||""}));
    return [...sources.values()];
  }
  function renderCoverageMatrix(){
    if(!methodologyData||!municipalityData)return;
    const body=document.querySelector("#coverage-matrix-body");
    document.querySelectorAll("[data-coverage-category]").forEach(node=>{const category=coverageCategories.find(item=>item.id===node.dataset.coverageCategory);if(category)node.textContent=category[current];});
    if(body)body.innerHTML=statusCountries().map(country=>{
      const cells=coverageCategories.map(category=>{
        const cell=coverageCell(country.code,category),selected=activeCoverageNode?.country===country.code&&activeCoverageNode?.category===category.id;
        return `<td><button type="button" class="coverage-cell coverage-status-${esc(cell.status)}${selected?" selected":""}" data-coverage-country="${esc(country.code)}" data-coverage-node="${esc(category.id)}" aria-pressed="${selected}"><strong>${esc(cell.primary)}</strong><span>${esc(cell.secondary)}</span></button></td>`;
      }).join("");
      return `<tr><th scope="row"><b>${esc(country[current])}</b><small>${esc(country.code)}</small></th>${cells}</tr>`;
    }).join("");
    renderCoverageSelection();
  }
  function renderCoverageSelection(){
    const title=document.querySelector("#coverage-selection-title"),summary=document.querySelector("#coverage-selection-summary"),list=document.querySelector("#coverage-source-list"),clear=document.querySelector("#coverage-clear"),sc=statusCopy[current];
    if(!title||!summary||!list||!clear||!methodologyData)return;
    clear.hidden=!activeCoverageNode;
    if(!activeCoverageNode){title.textContent=sc.selectionEmpty;summary.textContent="";list.innerHTML="";return;}
    const country=statusCountries().find(item=>item.code===activeCoverageNode.country),category=coverageCategories.find(item=>item.id===activeCoverageNode.category),sources=nodeSources(country.code,category),research=researchCell(country.code,category.id),ledgerRows=methodologyData.rows.filter(row=>row.country_code===country.code&&category.modules.includes(row.module));
    title.textContent=`${country[current]} · ${category[current]}`;
    summary.textContent=research?`${research[`evidence_${current}`]} ${sc.ingestion}: ${research[`ingestion_${current}`]} · ${sources.length} ${sc.sourceLinks}.`: `${sources.length} ${sc.sourceLinks}.${ledgerRows.length?` ${sc.filtered}`:""}`;
    list.innerHTML=sources.length?sources.map(source=>`<article><span>${[...source.modules].map(esc).join(" · ")}</span><h4>${esc(source.title)}</h4>${source.location?`<p>${esc(source.location)}</p>`:""}<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(sc.openSource)} ↗</a></article>`).join(""):`<p class="coverage-no-source">${esc(sc.missing)}</p>`;
  }
  function renderMethodology(){
    if(!methodologyData)return;
    fillSelect("#method-country-filter",statusCountries().map(item=>({value:item.code,cs:item.cs,en:item.en})),copy[current].ledgerAllCountries,current);
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
    const root=document.querySelector("#data-health-root");if(!root||!qualityData||!methodologyData||!municipalityData)return;
    const sc=statusCopy[current],countries=municipalityData.countries||[],scope=countries.reduce((sum,country)=>sum+(Number(country.directory_count)||0),0),entityRows=municipalityData.entities?.length||0,aggregateRows=Math.max(0,scope-entityRows),historySpans=countries.map(country=>municipalHistoryStats(country.code)),countryYears=historySpans.reduce((sum,span)=>sum+span.count,0),municipalYears=yearSpan(historySpans.flatMap(span=>span.values));
    const generatedValues=[municipalityData.generated_at,itemizedBudgetData?.generated_at,methodologyData.generated_at,transportPerformanceData?.generated_at,transportBudgetData?.generated_at,releaseData?.data_generated_at].filter(Boolean).map(value=>new Date(value)).filter(value=>!Number.isNaN(value.getTime())),generated=generatedValues.length?new Date(Math.max(...generatedValues)):null;
    const generatedLabel=generated?new Intl.DateTimeFormat(current==="cs"?"cs-CZ":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(generated):"—";
    const cards=[
      [sc.municipalScope,scope,`${countries.length} ${sc.countries}`],
      [sc.entityRows,entityRows,aggregateRows?`${integer(aggregateRows)} ${sc.aggregateRows}`:sc.entityLevel],
      [sc.municipalCountryYears,countryYears,municipalYears.label],
      [sc.sources,methodologyData.row_count,sc.sourceRecords]
    ];
    root.innerHTML=`<div class="data-health-status"><span class="data-health-pass">● ${esc(sc.checksPassed)}</span><span>${esc(sc.snapshot)}: <b>${esc(generatedLabel)}</b></span></div><div class="data-health-kpis">${cards.map(([label,value,note])=>`<article><span>${esc(label)}</span><strong>${integer(value)}</strong><small>${esc(note)}</small></article>`).join("")}</div><div class="data-health-downloads"><a href="data/international-municipalities.v1.json" download>${current === "en" ? "Municipal" : "Obecní"} JSON ↓</a><a href="data/methodology-sources.v1.json" download>${esc(sc.ledgerJson)}</a><a href="data/coverage-source-research.v1.json" download>${current === "en" ? "Availability research" : "Průzkum dostupnosti"} JSON ↓</a><a href="data/data-quality-report.v1.json" download>QA JSON ↓</a></div>`;
    const publishedEntries=Number(qualityData?.counts?.published_data_entries)||0;
    const total=document.querySelector("#status-data-total");if(total)total.textContent=publishedEntries?integer(publishedEntries):"—";
  }
  function render() {
    document.documentElement.lang = current;
    document.querySelectorAll("[data-page-copy]").forEach(node => { const value=copy[current][node.dataset.pageCopy]; if(value)node.innerHTML=value; });
    document.querySelectorAll("[data-status-copy]").forEach(node => { const value=statusCopy[current][node.dataset.statusCopy]; if(value)node.textContent=value; });
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
    fetch("data/data-quality-report.v1.json?v=20260825-entry-count").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/release-manifest.v1.json").then(response=>response.ok?response.json():null),
    fetch("data/international-municipalities.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/municipal-itemized-coverage.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/transport-performance.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/transport-budget-detail.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();}),
    fetch("data/coverage-source-research.v1.json").then(response=>{if(!response.ok)throw new Error(response.status);return response.json();})
  ]).then(([methodology,quality,release,municipalities,itemizedBudgets,transportPerformance,transportBudget,coverageResearch])=>{methodologyData=methodology;qualityData=quality;releaseData=release;municipalityData=municipalities;itemizedBudgetData=itemizedBudgets;transportPerformanceData=transportPerformance;transportBudgetData=transportBudget;coverageResearchData=coverageResearch;renderMethodology();renderDataHealth();}).catch(error=>{const summary=document.querySelector("#method-ledger-summary");if(summary)summary.textContent=`Methodology data: ${error}`;const health=document.querySelector("#data-health-root");if(health)health.textContent=`Data health: ${error}`;});
})();
