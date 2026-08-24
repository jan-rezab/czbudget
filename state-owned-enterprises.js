(() => {
  const requested = new URLSearchParams(location.search).get("lang");
  const lang = ["cs", "en"].includes(requested) ? requested : document.documentElement.lang === "en" ? "en" : "cs";
  document.documentElement.lang = lang;

  const copy = {
    cs: {
      eyebrow:"Hloubkový profil / Státní podniky", title:"Stát jako vlastník.", intro:"Katalog největších celostátně ovládaných podniků v deseti zemích. Výnosy za rok 2024 převádíme na eura jedním kurzem a necháváme viditelnou původní hodnotu i zdroj.", largestLabel:"Největší podnik v katalogu", heroNote:"30 podniků · 10 zemí · výnosy 2024 · EUR podle průměrného ročního kurzu",
      map:"Mapa portfolia", mapKicker:"30 podniků / společná plocha", mapTitle:"Kdo zabírá největší kus?", mapIntro:"Plocha každého obdélníku odpovídá výnosům podniku. Přepněte na vlastnický podíl státu, seskupte podniky podle země či odvětví a vyberte dlaždici pro detail.", mapSizeBy:"Velikost dlaždice", mapRevenue:"Vykázané výnosy", mapWeighted:"Podíl podle vlastnictví", mapGroupBy:"Seskupit podle", mapGroupCountry:"Země", mapGroupSector:"Odvětví", mapCompanyKey:"Podnik", mapSelectedKey:"Vybraný podnik", mapRevenueLabel:"Výnosy", mapOwnershipLabel:"Podíl státu", mapWeightedLabel:"Vlastnický podíl výnosů", mapTotalRevenue:"Součet vykázaných výnosů", mapTotalWeighted:"Součet podle podílu státu", mapMethodRevenue:"Výnosy převedené průměrným kurzem roku 2024.", mapMethodWeighted:"Výnosy × vlastnický podíl státu; analytický podíl, nikoli ocenění podniku.",
      catalogue:"Katalog", countries:"Země", method:"Metodika", sources:"Zdroje", catalogueKicker:"30 podniků / seřazeno podle výnosů", catalogueTitle:"Jedna účetní řádka. Jedna měna.", catalogueIntro:"Pořadí měří velikost provozu, nikoli hodnotu firmy, ziskovost nebo přínos veřejným rozpočtům. U každé položky uvádíme typ veřejné kontroly a případnou odchylku v účetním rozsahu.",
      search:"Hledat", searchPlaceholder:"Podnik nebo odvětví", countryFilter:"Země", sectorFilter:"Odvětví", sort:"Řazení", sortRevenue:"Výnosy: nejvyšší", sortCountry:"Země A–Z", displayed:"zobrazených podniků", reset:"Zrušit filtry", rank:"#", company:"Podnik", ownership:"Veřejná kontrola", reported:"Vykázané výnosy", eur:"Výnosy v EUR", source:"Zdroj", empty:"Tomuto filtru neodpovídá žádný podnik.", allCountries:"Všechny země", allSectors:"Všechna odvětví", openSource:"Otevřít zdroj", detail:"Rozsah a poznámka", convertedAt:"Přepočteno kurzem", perEuro:"za 1 EUR",
      countryKicker:"První tři v každé zemi", countryTitle:"Kde sídlí největší státní hráči?", countryIntro:"Součet je pouze součtem tří položek v tomto katalogu. Není to velikost celého státního portfolia a mezi zeměmi se nesmí zaměňovat za fiskální expozici státu.", leader:"Největší", topThree:"Součet prvních tří", openCountry:"Filtrovat katalog",
      methodKicker:"Jak katalog číst", methodTitle:"Srovnatelný žebříček, přiznané výjimky.", methodIntro:"Výnosy jsou nejdostupnější společný ukazatel rozsahu. Ani ten však není ekonomicky totožný mezi energetikou, železnicí, poštou a veřejnoprávní televizí.",
      sourceKicker:"Primární dokumenty", sourceTitle:"Zdroj za každým číslem.", sourceIntro:"Odkazy vedou na výroční zprávy, auditované účetní závěrky, výsledkové zprávy a oficiální dokumenty vlastníka. Přepočet používá průměrné kurzy za rok 2024.", fxTitle:"Kurzy a přepočet", fxNote:"Místních jednotek za 1 EUR; průměr roku 2024.", footer:"Státní podniky · oficiální firemní a vládní zdroje",
      sectors:{energy:"Energetika",transport:"Doprava",postal:"Pošta a logistika",retail:"Maloobchod",mining:"Těžba",telecom:"Telekomunikace",media:"Média"},
      methods:[
        ["01","Výběr","Tři podniky s nejvyššími dostupnými výnosy v každé z deseti sledovaných zemí. Zahrnujeme celostátní přímou či nepřímou veřejnou kontrolu; vynecháváme obce, regiony, centrální banky a finanční instituce, jejichž horní řádka není s výnosy nefinančních podniků rozumně srovnatelná."],
        ["02","Kontrola","Základ je více než 50 % kapitálu nebo hlasů, zákonná veřejná kontrola či federální korporace. ORLEN je označená výjimka: stát má 49,9 %, ale je kontrolujícím akcionářem. La Poste je veřejně kontrolována zčásti nepřímo."],
        ["03","Účetní rozsah","Preferujeme konsolidované skupinové výnosy za rok 2024. Odlišný finanční rok, ukončované činnosti, samostatná závěrka nebo zahrnutí dotace jsou označeny přímo u řádku."],
        ["04","Přepočet","Místní měnu dělíme počtem jejích jednotek za 1 EUR. Používáme průměrný kurz 2024, ne kurz ke konci roku. U UAH je to aritmetický průměr dvanácti měsíčních průměrů NBU."],
        ["05","Co pořadí neříká","Výnos není hodnota podniku, zisk, veřejná dotace ani fiskální riziko. Součet prvních tří není úplná konsolidace státního portfolia a může obsahovat vnitroskupinové či mezifiremní obchody."],
        ["06","Aktualizace","Katalog je roční snímek. Vlastnictví, restrukturalizace i prodeje mohou po účetním období změnit hranice skupiny; datum poslední redakční kontroly je 24. srpna 2026."]
      ]
    },
    en: {
      eyebrow:"Deep dive / State-owned enterprises", title:"The state as owner.", intro:"A catalogue of the largest nationally controlled enterprises in ten countries. We convert 2024 revenue to euros using one exchange-rate basis while keeping the original value and source visible.", largestLabel:"Largest enterprise in the catalogue", heroNote:"30 enterprises · 10 countries · 2024 revenue · EUR at annual-average rates",
      map:"Portfolio map", mapKicker:"30 enterprises / one shared area", mapTitle:"Who occupies the largest piece?", mapIntro:"Each rectangle is sized by enterprise revenue. Switch to the state's ownership-weighted share, group by country or sector, and select a tile for the underlying detail.", mapSizeBy:"Size tiles by", mapRevenue:"Reported revenue", mapWeighted:"State-weighted share", mapGroupBy:"Group tiles by", mapGroupCountry:"Country", mapGroupSector:"Sector", mapCompanyKey:"Enterprise", mapSelectedKey:"Selected enterprise", mapRevenueLabel:"Revenue", mapOwnershipLabel:"State ownership", mapWeightedLabel:"State-weighted revenue", mapTotalRevenue:"Reported revenue total", mapTotalWeighted:"State-weighted total", mapMethodRevenue:"Revenue converted at 2024 annual-average exchange rates.", mapMethodWeighted:"Revenue × state ownership percentage; an analytical share, not an enterprise valuation.",
      catalogue:"Catalogue", countries:"Countries", method:"Method", sources:"Sources", catalogueKicker:"30 enterprises / ranked by revenue", catalogueTitle:"One top line. One currency.", catalogueIntro:"The ranking measures operating scale, not enterprise value, profitability or benefit to public budgets. Each entry shows the type of public control and any accounting-scope exception.",
      search:"Search", searchPlaceholder:"Company or sector", countryFilter:"Country", sectorFilter:"Sector", sort:"Sort", sortRevenue:"Revenue: highest", sortCountry:"Country A–Z", displayed:"enterprises shown", reset:"Reset filters", rank:"#", company:"Enterprise", ownership:"Public control", reported:"Reported revenue", eur:"Revenue in EUR", source:"Source", empty:"No enterprise matches these filters.", allCountries:"All countries", allSectors:"All sectors", openSource:"Open source", detail:"Scope and note", convertedAt:"Converted at", perEuro:"per EUR",
      countryKicker:"Top three in each country", countryTitle:"Where are the largest state players?", countryIntro:"The sum is only the three entries in this catalogue. It is not the size of the entire state portfolio and must not be read as the state's fiscal exposure.", leader:"Largest", topThree:"Top-three total", openCountry:"Filter catalogue",
      methodKicker:"How to read the catalogue", methodTitle:"A comparable ranking, with exceptions disclosed.", methodIntro:"Revenue is the most available common measure of scale. Even so, it is not economically identical across energy, rail, postal services and public broadcasting.",
      sourceKicker:"Primary documents", sourceTitle:"A source behind every number.", sourceIntro:"Links lead to annual reports, audited financial statements, results releases and official owner documents. Conversion uses 2024 annual-average exchange rates.", fxTitle:"Rates and conversion", fxNote:"Local-currency units per EUR; 2024 annual average.", footer:"State-owned enterprises · official company and government sources",
      sectors:{energy:"Energy",transport:"Transport",postal:"Postal & logistics",retail:"Retail",mining:"Mining",telecom:"Telecommunications",media:"Media"},
      methods:[
        ["01","Selection","The three enterprises with the highest available revenue in each of the ten tracked countries. We include national direct or indirect public control; municipalities, regions, central banks and financial institutions whose top lines are not reasonably comparable with non-financial-company revenue are excluded."],
        ["02","Control","The baseline is more than 50% of capital or votes, statutory public control, or federal-corporation status. ORLEN is a disclosed exception: the state holds 49.9% but is the controlling shareholder. La Poste is partly under indirect public control."],
        ["03","Accounting scope","We prefer consolidated group revenue for calendar 2024. A different fiscal year, discontinued operations, separate-company accounts or included subsidy is marked directly on the row."],
        ["04","Conversion","Local currency is divided by its units per EUR. We use the 2024 average, not the year-end rate. For UAH, this is the arithmetic mean of twelve NBU monthly averages."],
        ["05","What the rank does not say","Revenue is not enterprise value, profit, public subsidy or fiscal risk. The top-three sum is not a full state-portfolio consolidation and may include trade between companies."],
        ["06","Updates","The catalogue is an annual snapshot. Ownership, restructuring and disposals after the reporting period may change group boundaries; the latest editorial check was 24 August 2026."]
      ]
    }
  };
  const t = copy[lang];
  const flag = {CZE:"cz",DEU:"de",DNK:"dk",FRA:"fr",GBR:"gb",POL:"pl",SWE:"se",CHE:"ch",UKR:"ua",USA:"us"};
  const number = new Intl.NumberFormat(lang === "en" ? "en-GB" : "cs-CZ", {maximumFractionDigits:1});
  const euro = new Intl.NumberFormat(lang === "en" ? "en-GB" : "cs-CZ", {style:"currency",currency:"EUR",maximumFractionDigits:1});
  const escape = value => String(value ?? "").replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
  const countryName = record => record[lang === "en" ? "country_en" : "country_cs"];
  const localRevenue = record => `${number.format(record.source_revenue_m)} mil. ${record.currency}`;
  const eurBn = record => record.source_revenue_m / record.fx_rate / 1000;
  const formatEur = value => `${euro.format(value)} ${lang === "en" ? "bn" : "mld."}`;
  const ownershipWeightedBn = record => eurBn(record) * record.ownership_pct / 100;
  const formatOwnership = value => `${number.format(value)} %`;
  const svgNs = "http://www.w3.org/2000/svg";

  let dataset;
  let records = [];
  const state = {country:"all", sector:"all", query:"", sort:"revenue", mapValue:"revenue", mapGroup:"country", selectedId:null};
  let mapWidth = 0;

  function translate() {
    document.querySelectorAll("[data-copy]").forEach(node => { const value = t[node.dataset.copy]; if (typeof value === "string") node.textContent = value; });
    document.querySelectorAll("[data-soe-lang],[data-lang]").forEach(button => button.classList.toggle("active", (button.dataset.soeLang || button.dataset.lang) === lang));
    const search = document.querySelector("#soe-search"); if (search) search.placeholder = t.searchPlaceholder;
    document.title = lang === "en" ? "Largest state-owned enterprises — Public Spending Data" : "Největší státní podniky — Public Spending Data";
  }

  function setupFilters() {
    const country = document.querySelector("#soe-country");
    const mapCountry = document.querySelector("#soe-map-country");
    const sector = document.querySelector("#soe-sector");
    const countries = [...new Map(records.map(record => [record.country_code, countryName(record)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],lang));
    country.innerHTML = `<option value="all">${t.allCountries}</option>${countries.map(([code,name])=>`<option value="${code}">${escape(name)}</option>`).join("")}`;
    mapCountry.innerHTML = country.innerHTML;
    const sectors = [...new Set(records.map(record => record.sector))].sort((a,b)=>t.sectors[a].localeCompare(t.sectors[b],lang));
    sector.innerHTML = `<option value="all">${t.allSectors}</option>${sectors.map(value=>`<option value="${value}">${escape(t.sectors[value])}</option>`).join("")}`;
  }

  function filteredRecords() {
    const query = state.query.trim().toLocaleLowerCase(lang);
    return records.filter(record => state.country === "all" || record.country_code === state.country)
      .filter(record => state.sector === "all" || record.sector === state.sector)
      .filter(record => !query || [record.company,countryName(record),t.sectors[record.sector],record[lang === "en" ? "ownership_en" : "ownership_cs"]].join(" ").toLocaleLowerCase(lang).includes(query))
      .sort((a,b) => state.sort === "country" ? countryName(a).localeCompare(countryName(b),lang) || eurBn(b)-eurBn(a) : eurBn(b)-eurBn(a));
  }

  function mapRecordValue(record) {
    return state.mapValue === "weighted" ? ownershipWeightedBn(record) : eurBn(record);
  }

  function layoutBinary(items, x, y, width, height) {
    if (!items.length || width <= 0 || height <= 0) return [];
    if (items.length === 1) return [{...items[0], x, y, width, height}];
    const ordered = items.slice().sort((a,b)=>b.value-a.value);
    const total = ordered.reduce((sum,item)=>sum+item.value,0);
    let split = 1;
    let running = ordered[0].value;
    let best = Math.abs(total / 2 - running);
    for (let index = 1; index < ordered.length; index += 1) {
      running += ordered[index].value;
      const distance = Math.abs(total / 2 - running);
      if (distance > best) break;
      best = distance;
      split = index + 1;
    }
    const first = ordered.slice(0, split);
    const second = ordered.slice(split);
    const firstTotal = first.reduce((sum,item)=>sum+item.value,0);
    const gap = 2;
    if (width >= height) {
      const firstWidth = Math.max(0, (width - gap) * firstTotal / total);
      return [...layoutBinary(first,x,y,firstWidth,height),...layoutBinary(second,x+firstWidth+gap,y,Math.max(0,width-firstWidth-gap),height)];
    }
    const firstHeight = Math.max(0, (height - gap) * firstTotal / total);
    return [...layoutBinary(first,x,y,width,firstHeight),...layoutBinary(second,x,y+firstHeight+gap,width,Math.max(0,height-firstHeight-gap))];
  }

  function svgElement(name, attributes = {}) {
    const node = document.createElementNS(svgNs, name);
    Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
    return node;
  }

  function companyLabelLines(name, width, height) {
    const maxChars = Math.max(7, Math.floor((width - 14) / 7));
    const maxLines = Math.max(1, Math.min(3, Math.floor((height - 26) / 15)));
    const words = name.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(word=>{
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines.slice(0,maxLines);
  }

  function updateMapDetail(record) {
    state.selectedId = record.id;
    document.querySelector("#soe-map-detail-context").textContent = `${countryName(record)} · ${t.sectors[record.sector]} · ${record.period}`;
    document.querySelector("#soe-map-detail-name").textContent = record.company;
    document.querySelector("#soe-map-detail-note").textContent = record[lang === "en" ? "note_en" : "note_cs"];
    document.querySelector("#soe-map-detail-revenue").textContent = formatEur(eurBn(record));
    document.querySelector("#soe-map-detail-ownership").textContent = formatOwnership(record.ownership_pct);
    document.querySelector("#soe-map-detail-weighted").textContent = formatEur(ownershipWeightedBn(record));
    const source = document.querySelector("#soe-map-detail-source");
    source.href = record.source_url;
    source.setAttribute("aria-label",`${t.openSource}: ${record.source_title}`);
    document.querySelectorAll(".map-company-link").forEach(link=>link.classList.toggle("is-selected",link.dataset.id===record.id));
  }

  function renderPortfolioMap() {
    const svg = document.querySelector("#soe-map");
    const stage = document.querySelector(".soe-map-stage");
    if (!svg || !stage || !records.length) return;
    const width = Math.max(300, Math.round(stage.getBoundingClientRect().width));
    const height = Math.max(420, Math.round(stage.getBoundingClientRect().height));
    mapWidth = width;
    svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
    svg.querySelectorAll("g.map-chart").forEach(node=>node.remove());
    const chart = svgElement("g",{class:"map-chart"});
    svg.append(chart);
    const shown = records.filter(record=>state.country==="all"||record.country_code===state.country);
    const groupMap = new Map();
    shown.forEach(record=>{
      const key = state.mapGroup === "country" ? record.country_code : record.sector;
      if (!groupMap.has(key)) groupMap.set(key,[]);
      groupMap.get(key).push(record);
    });
    const groups = [...groupMap.entries()].map(([key,items])=>({
      key,
      name:state.mapGroup === "country" ? countryName(items[0]) : t.sectors[key],
      items,
      value:items.reduce((sum,item)=>sum+mapRecordValue(item),0)
    }));
    const groupRects = layoutBinary(groups,0,0,width,height);
    const visibleIds = new Set(shown.map(record=>record.id));
    let selected = records.find(record=>record.id===state.selectedId&&visibleIds.has(record.id));
    if (!selected) selected = shown.slice().sort((a,b)=>mapRecordValue(b)-mapRecordValue(a))[0];

    groupRects.forEach(groupRect=>{
      const frame = svgElement("rect",{class:"map-group-frame",x:groupRect.x+.5,y:groupRect.y+.5,width:Math.max(0,groupRect.width-1),height:Math.max(0,groupRect.height-1)});
      chart.append(frame);
      const headerHeight = groupRect.height > 48 && groupRect.width > 52 ? 29 : 0;
      if (headerHeight) {
        chart.append(svgElement("rect",{class:"map-group-strip",x:groupRect.x+2,y:groupRect.y+2,width:Math.max(0,groupRect.width-4),height:3}));
        const title = svgElement("text",{class:"map-group-title",x:groupRect.x+8,y:groupRect.y+19});
        const fullFits = groupRect.width > groupRect.name.length * 7 + 78;
        const label = fullFits ? groupRect.name : groupRect.width > 78 ? (state.mapGroup === "country" ? groupRect.key : groupRect.name.split(" ")[0]) : "";
        title.textContent = label;
        chart.append(title);
        if (groupRect.width > 148) {
          const value = svgElement("text",{class:"map-group-value",x:groupRect.x+groupRect.width-8,y:groupRect.y+19,"text-anchor":"end"});
          value.textContent = formatEur(groupRect.value);
          chart.append(value);
        }
      }
      const companyRects = layoutBinary(groupRect.items.map(record=>({record,value:mapRecordValue(record)})),groupRect.x+2,groupRect.y+headerHeight+2,Math.max(0,groupRect.width-4),Math.max(0,groupRect.height-headerHeight-4));
      companyRects.forEach(companyRect=>{
        const record = companyRect.record;
        const link = svgElement("a",{class:`map-company-link${record.id===selected.id?" is-selected":""}`,href:"#soe-map-detail","data-id":record.id,"aria-label":`${record.company}, ${countryName(record)}, ${formatEur(mapRecordValue(record))}`});
        const title = svgElement("title");
        title.textContent = `${record.company} · ${countryName(record)} · ${t.sectors[record.sector]} · ${formatEur(mapRecordValue(record))}`;
        link.append(title);
        link.append(svgElement("rect",{class:"map-company-cell",x:companyRect.x,y:companyRect.y,width:Math.max(0,companyRect.width),height:Math.max(0,companyRect.height)}));
        if (companyRect.width > 58 && companyRect.height > 40) {
          const lines = companyLabelLines(record.company,companyRect.width,companyRect.height);
          const name = svgElement("text",{class:"map-company-name",x:companyRect.x+8,y:companyRect.y+18});
          lines.forEach((line,index)=>{
            const span = svgElement("tspan",{x:companyRect.x+8,dy:index?15:0});
            span.textContent = line;
            name.append(span);
          });
          link.append(name);
          const metaY = companyRect.y + 20 + lines.length * 15;
          if (companyRect.height > metaY - companyRect.y + 14 && companyRect.width > 76) {
            const meta = svgElement("text",{class:"map-company-meta",x:companyRect.x+8,y:metaY});
            meta.textContent = `${formatEur(mapRecordValue(record))} · ${state.mapGroup === "country" ? t.sectors[record.sector] : record.country_code}`;
            link.append(meta);
          }
        }
        link.addEventListener("click",event=>{event.preventDefault();updateMapDetail(record);});
        chart.append(link);
      });
    });
    const total = shown.reduce((sum,record)=>sum+mapRecordValue(record),0);
    document.querySelector("#soe-map-total").textContent = formatEur(total);
    document.querySelector("#soe-map-total-label").textContent = state.mapValue === "weighted" ? t.mapTotalWeighted : t.mapTotalRevenue;
    document.querySelector("#soe-map-method").textContent = state.mapValue === "weighted" ? t.mapMethodWeighted : t.mapMethodRevenue;
    svg.querySelector("title").textContent = lang === "en" ? "Revenue of selected state-owned enterprises" : "Výnosy vybraných státních podniků";
    svg.querySelector("desc").textContent = lang === "en" ? "Each rectangle represents one enterprise and its area is proportional to the selected revenue measure." : "Každý obdélník představuje jeden podnik a jeho plocha odpovídá zvolenému ukazateli výnosů.";
    updateMapDetail(selected);
  }

  function renderTable() {
    const shown = filteredRecords();
    document.querySelector("#soe-count").textContent = shown.length;
    document.querySelector("#soe-empty").hidden = shown.length > 0;
    document.querySelector("#soe-body").innerHTML = shown.map((record,index) => {
      const rank = records.slice().sort((a,b)=>eurBn(b)-eurBn(a)).findIndex(item=>item.id===record.id)+1;
      const note = record[lang === "en" ? "note_en" : "note_cs"];
      const metric = record[lang === "en" ? "metric_en" : "metric_cs"];
      return `<tr data-country="${record.country_code}"><td class="soe-rank">${state.sort === "revenue" ? index+1 : rank}</td><td class="soe-company"><div><img src="../../assets/flags/${flag[record.country_code]}.svg" alt=""><span><strong>${escape(record.company)}</strong><small>${escape(countryName(record))} · ${escape(t.sectors[record.sector])} · ${escape(record.period)}</small></span></div><details><summary>${t.detail}</summary><p>${escape(note)}</p></details></td><td><strong>${escape(record[lang === "en" ? "ownership_en" : "ownership_cs"])}</strong></td><td><strong>${escape(localRevenue(record))}</strong><small>${escape(metric)}</small></td><td class="soe-eur"><strong>${formatEur(eurBn(record))}</strong><small>${t.convertedAt} ${number.format(record.fx_rate)} ${record.currency} ${t.perEuro}</small></td><td><a class="soe-source-link" href="${escape(record.source_url)}" target="_blank" rel="noopener"><span>${t.openSource}</span> ↗</a></td></tr>`;
    }).join("");
  }

  function renderCountries() {
    const grouped = [...new Set(records.map(record=>record.country_code))].map(code => {
      const items = records.filter(record=>record.country_code===code).sort((a,b)=>eurBn(b)-eurBn(a));
      return {code, name:countryName(items[0]), items, total:items.reduce((sum,item)=>sum+eurBn(item),0)};
    }).sort((a,b)=>b.items[0] && eurBn(b.items[0])-eurBn(a.items[0]));
    document.querySelector("#soe-country-grid").innerHTML = grouped.map((group,index)=>`<article class="soe-country-card"><header><span>${String(index+1).padStart(2,"0")}</span><img src="../../assets/flags/${flag[group.code]}.svg" alt=""><h3>${escape(group.name)}</h3></header><dl><div><dt>${t.leader}</dt><dd><b>${escape(group.items[0].company)}</b><strong>${formatEur(eurBn(group.items[0]))}</strong></dd></div><div><dt>${t.topThree}</dt><dd><strong>${formatEur(group.total)}</strong></dd></div></dl><button type="button" data-country-pick="${group.code}">${t.openCountry} →</button></article>`).join("");
    document.querySelectorAll("[data-country-pick]").forEach(button=>button.addEventListener("click",()=>{setCountry(button.dataset.countryPick);document.querySelector("#catalogue").scrollIntoView({behavior:"smooth"});}));
  }

  function renderMethods() {
    document.querySelector("#soe-method-grid").innerHTML = t.methods.map(([index,title,body])=>`<article><span>${index}</span><h3>${escape(title)}</h3><p>${escape(body)}</p></article>`).join("");
  }

  function renderSources() {
    const byCountry = [...new Set(records.map(record=>record.country_code))].map(code=>({code, name:countryName(records.find(record=>record.country_code===code)), records:records.filter(record=>record.country_code===code)})).sort((a,b)=>a.name.localeCompare(b.name,lang));
    const companies = byCountry.map(group=>`<article><header><img src="../../assets/flags/${flag[group.code]}.svg" alt=""><h3>${escape(group.name)}</h3></header>${group.records.map(record=>`<a href="${escape(record.source_url)}" target="_blank" rel="noopener"><span>${escape(record.company)}</span><small>${escape(record.source_title)}</small><b>↗</b></a>`).join("")}</article>`).join("");
    const rates = Object.entries(dataset.fx.rates).map(([currency,rate])=>`<span><b>${currency}</b>${number.format(rate)}</span>`).join("");
    const fxSources = dataset.fx.sources.map(source=>`<a href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.label)} ↗</a>`).join("");
    document.querySelector("#soe-source-list").innerHTML = `<article class="soe-fx-source"><header><h3>${t.fxTitle}</h3></header><p>${t.fxNote}</p><div>${rates}</div>${fxSources}</article>${companies}`;
  }

  function setCountry(value) {
    state.country = value;
    document.querySelector("#soe-country").value = value;
    document.querySelector("#soe-map-country").value = value;
    dispatchEvent(new Event("deepfilterchange"));
    renderTable();
    renderPortfolioMap();
  }

  function wireControls() {
    document.querySelector("#soe-search").addEventListener("input",event=>{state.query=event.target.value;renderTable();});
    document.querySelector("#soe-country").addEventListener("change",event=>setCountry(event.target.value));
    document.querySelector("#soe-map-country").addEventListener("change",event=>setCountry(event.target.value));
    document.querySelector("#soe-sector").addEventListener("change",event=>{state.sector=event.target.value;renderTable();});
    document.querySelector("#soe-sort").addEventListener("change",event=>{state.sort=event.target.value;renderTable();});
    document.querySelector("#soe-reset").addEventListener("click",()=>{Object.assign(state,{country:"all",sector:"all",query:"",sort:"revenue"});document.querySelector("#soe-search").value="";document.querySelector("#soe-country").value="all";document.querySelector("#soe-map-country").value="all";document.querySelector("#soe-sector").value="all";document.querySelector("#soe-sort").value="revenue";dispatchEvent(new Event("deepfilterchange"));renderTable();renderPortfolioMap();});
    document.querySelectorAll("[data-map-value]").forEach(button=>button.addEventListener("click",()=>{
      state.mapValue = button.dataset.mapValue;
      document.querySelectorAll("[data-map-value]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));});
      renderPortfolioMap();
    }));
    document.querySelectorAll("[data-map-group]").forEach(button=>button.addEventListener("click",()=>{
      state.mapGroup = button.dataset.mapGroup;
      document.querySelectorAll("[data-map-group]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));});
      renderPortfolioMap();
    }));
    document.querySelectorAll("[data-soe-lang],[data-lang]").forEach(button=>button.addEventListener("click",()=>{const url=new URL(location.href);url.searchParams.set("lang",button.dataset.soeLang || button.dataset.lang);location.href=url.href;}));
  }

  async function init() {
    translate();
    const response = await fetch("../../data/state-owned-enterprises.v1.json");
    if (!response.ok) throw new Error(`State-enterprise dataset failed: ${response.status}`);
    dataset = await response.json();
    records = dataset.records.map(record=>({...record,fx_rate:dataset.fx.rates[record.currency]}));
    if (records.length !== 30 || records.some(record=>!Number.isFinite(record.fx_rate)||!record.source_url)) throw new Error("State-enterprise catalogue is incomplete");
    const largest = records.slice().sort((a,b)=>eurBn(b)-eurBn(a))[0];
    state.selectedId = largest.id;
    document.querySelector("#largest-value").textContent = formatEur(eurBn(largest));
    document.querySelector("#largest-name").textContent = largest.company;
    setupFilters(); renderPortfolioMap(); renderTable(); renderCountries(); renderMethods(); renderSources(); wireControls();
    new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(Math.abs(width-mapWidth)>2)renderPortfolioMap();}).observe(document.querySelector(".soe-map-stage"));
  }
  addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error(error);document.querySelector("#soe-empty").hidden=false;}));
})();
