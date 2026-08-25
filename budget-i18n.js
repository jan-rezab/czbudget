(() => {
  const csToEn = {
    "Domů":"Home","Rozpočet":"Budget","Firmy státu":"State firms","Struktura":"Structure","Na co":"Spending","Demografie":"Demography","Srovnání":"Comparison","Metodika":"Methodology","Přehled":"Overview","Veřejné subjekty":"Public entities","Země":"Countries","Příjmy / výdaje":"Revenue / expenditure","30 účelů / 47 kapitol":"30 purposes / 47 chapters","637 organizací":"637 organisations","10 profilů":"10 profiles","Zdroje":"Sources",
    "Státní rozpočet ČR · skutečnost, schválený plán a výhled":"Czech state budget · outturn, approved plan and outlook",
    "Státní rozpočet ČR · skutečnost, návrh a výhled":"Czech state budget · outturn, proposal and outlook",
    "Český rozpočet.":"The Czech budget.","Bez krátké paměti.":"With a long memory.",
    "Pětadvacet let příjmů a výdajů, návrh pro rok 2026 a model toho, co s veřejnými financemi udělá stárnutí populace.":"Twenty-five years of revenue and expenditure, the 2026 proposal and a model of how population ageing affects public finance.",
    "Pětadvacet let příjmů a výdajů, schválený rozpočet 2026, přesný účel peněz a model dopadu stárnutí populace.":"Twenty-five years of revenue and expenditure, the approved 2026 budget, a precise spending breakdown and an ageing-impact model.",
    "Otevřít data":"Open data","Schválený 2026":"Approved 2026","Schválený schodek 2026":"2026 approved deficit","Příjmy":"Revenue","Výdaje":"Expenditure","Schodek":"Deficit","Skutečný schodek 2025":"2025 actual deficit","Změna populace 80+":"Change in population 80+",
    "Rozpočet počítá se schodkem, který odpovídá téměř celému čistému demografickému tlaku vybraných systémů v roce 2045.":"The budget assumes a deficit almost equal to the entire net demographic pressure from the selected systems in 2045.","12,8 % výdajů":"12.8% of expenditure","Úplné příjmy a výdaje včetně EU/FM; saldo je totožné s variantou bez EU/FM.":"Complete revenue and expenditure including EU/FM; the balance is identical to the version excluding EU/FM.","65+ na 100 lidí 20–64":"People aged 65+ per 100 people aged 20–64","střední varianta · 2045":"medium variant · 2045",
    "Příjmy a výdaje v čase":"Revenue and expenditure over time","Skutečné pokladní plnění 2001–2025 a schválený rozpočet 2026. Přepněte nominální koruny na ceny roku 2025 a porovnejte období bez inflačního zkreslení.":"Actual cash outturn for 2001–2025 and the approved 2026 budget. Switch nominal koruna values to 2025 prices to compare periods without inflation distortion.","2026 · schválený":"2026 · approved","daně + pojistné + ostatní":"taxes + contributions + other","běžné + kapitálové":"current + capital","SOCIÁLNÍ DÁVKY":"SOCIAL BENEFITS","39,1 % výdajů":"39.1% of expenditure","DANĚ · POJISTNÉ · OSTATNÍ":"TAXES · CONTRIBUTIONS · OTHER","daně · pojistné · ostatní":"taxes · contributions · other","Daně":"Taxes","Sociální pojistné":"Social contributions","Ostatní":"Other","DÁVKY · PROVOZ · INVESTICE":"BENEFITS · OPERATIONS · INVESTMENT","dávky · provoz · investice":"benefits · operations · investment","Sociální dávky":"Social benefits","Výdaje podle účelu a kapitoly":"Expenditure by purpose and chapter",". Částky jsou zaokrouhlené na 0,1 mld. Kč.":". Amounts are rounded to CZK 0.1bn.","mld. Kč · dostupné výkazy":"CZK bn · available statements","Vše":"All",
    "07 / Demografický model":"07 / Demographic model","Model propojuje věkovou projekci ČSÚ s důchody, veřejným zdravotním pojištěním a příspěvkem na péči. Výchozí nastavení izoluje čistý vliv demografie.":"The model links the CZSO age projection with pensions, public health insurance and the care allowance. The default settings isolate the pure demographic effect.","z 1 283 mld. Kč v roce 2025":"from CZK 1,283bn in 2025","mld. Kč · 2045":"CZK bn · 2045","Zdravotnictví":"Healthcare","Péče":"Care","Příjmová báze":"Revenue base","Jak číst model:":"How to read the model:",
    "08 / Mezinárodní kontext":"08 / International context","Český státní rozpočet doplňuje harmonizované srovnání sektoru vládních institucí podle IMF. Jde o jiný rozsah než národní státní rozpočet, proto data nemícháme.":"The Czech state budget is complemented by an IMF-harmonised general-government comparison. This has a different scope from the national state budget, so the data are kept separate.","Výdaje vládních institucí":"General-government expenditure","10 zemí":"10 countries","Německo":"Germany","Švédsko":"Sweden","Dánsko":"Denmark","Spojené království":"United Kingdom","Česko":"Czechia","Švýcarsko":"Switzerland","Vybraná země":"Selected country","2024 · General government / sektor vládních institucí":"2024 · General government","Hrubý dluh":"Gross debt","Česko · 2024":"Czechia · 2024",
    "01 / Rozpočet v čase":"01 / Budget over time","Příjmy a výdaje.":"Revenue and expenditure.","Na jedné ose.":"On one axis.","Zobrazení":"Display","Nominální Kč":"Nominal CZK","Ceny roku 2025":"2025 prices","Vybraný rok":"Selected year","Aktivní rok":"Active year","Příjmy × výdaje":"Revenue × expenditure","Návrh":"Proposal",
    "02 / Detailní struktura":"02 / Detailed structure","Co rozpočet živí.":"What funds the budget.","A co živí rozpočet.":"And what the budget funds.","Příjmová část":"Revenue structure","Výdajová část":"Expenditure structure","podíl v %":"share in %",
    "03 / Kam peníze jdou":"03 / Where the money goes","Za co stát platí.":"What the state pays for.","A kdo peníze spravuje.":"And who manages it.","Na co stát vydává":"What the state spends on","Kdo peníze spravuje":"Who manages the money","30 účelových oblastí":"30 purpose areas","Výdaje celkem":"Total expenditure","včetně EU/FM":"including EU/FM","Důchody":"Pensions","Pět největších účelů":"Five largest purposes","podíl všech výdajů":"share of all expenditure","EU/FM a rozdíl rozsahu":"EU/FM and scope difference","proti kapitolám bez EU/FM":"vs chapters excluding EU/FM","Částka 2026":"2026 amount","Největší změna":"Largest change","Hledat ministerstvo nebo kapitolu":"Search a ministry or chapter",
    "Účel říká, jakou potřebu stát financuje. Kapitola říká, který úřad peníze spravuje. Jsou to dvě různé klasifikace téhož rozpočtu — proto je ukazujeme vedle sebe.":"Purpose shows which public need is funded. Chapter shows which authority manages the money. They are two classifications of the same budget, so we show them side by side.",
    "Pozor na rozsah:":"Scope matters:","účelová struktura pokrývá úplných 2 427,8 mld. Kč včetně peněz EU a finančních mechanismů. Kapitoly jsou v oficiálním srovnání MF uvedeny bez EU/FM, celkem 2 287,6 mld. Kč. Rozdíl není chybějící výdaj.":"the purpose breakdown covers the full CZK 2,427.8bn including EU funds and financial mechanisms. The Ministry of Finance chapter comparison excludes EU/FM and totals CZK 2,287.6bn. The difference is not missing expenditure.",
    "Zdroj:":"Source:","Částky jsou zaokrouhlené na 0,1 mld. Kč.":"Amounts are rounded to CZK 0.1bn.","Hodnoty kapitol jsou bez EU/FM.":"Chapter values exclude EU/FM.","MF ČR — Státní rozpočet 2026, exekutivní shrnutí ↗":"Czech Ministry of Finance — 2026 budget executive summary ↗","MF ČR — schválený rozpočet a všech 47 kapitol ↗":"Czech Ministry of Finance — approved budget and all 47 chapters ↗",
    "04 / Stát jako vlastník":"04 / The state as owner","05 / Demografický model":"05 / Demographic model","06 / Mezinárodní kontext":"06 / International context","07 / Data & metodika":"07 / Data & methodology","Výdaje 2026":"2026 expenditure",
    "03 / Stát jako vlastník":"03 / The state as owner","Zisk není":"Profit is not","příjem rozpočtu.":"budget revenue.","Suma zisků":"Sum of profits","Suma ztrát":"Sum of losses","Čistý výsledek":"Net result","Součet obratu":"Total turnover","Všech 38":"All 38","20 nejziskovějších":"20 most profitable","20 nejslabších":"20 weakest","20 největších":"20 largest","Otevřít úplný profil":"Open full profile",
    "04 / Demografický model":"04 / Demographic model","Stárnutí není graf.":"Ageing is not a chart.","Je to účet.":"It is a bill.","Varianta ČSÚ":"CZSO variant","Nízká":"Low","Střední":"Medium","Vysoká":"High","Efektivní důchodový věk":"Effective retirement age","Roční reálný růst mezd na plátce":"Annual real wage growth per contributor","Roční reálný růst nákladů na osobu":"Annual real cost growth per person","Populace 80+":"Population 80+","Roční náklady systémů · 2045":"Annual system costs · 2045","Roční výdaje systémů":"Annual system expenditure","úroveň v mld. Kč · ceny 2025":"level in CZK bn · 2025 prices","Důchodové saldo":"Pension balance","Věková struktura":"Age structure","miliony obyvatel":"million people","Tlak podle systému":"Pressure by system","Důchodový účet: plátci proti příjemcům":"Pension account: contributors vs recipients","mld. Kč v cenách 2025":"CZK bn at 2025 prices",
    "výchozí úroveň 2025 se načítá…":"loading the 2025 baseline…","Celkem":"Total","Výdaje na důchody začínají v roce 2025 na 700,1 mld. Kč, nikoli na nule. „0 %“ v ovladači je pouze nulový roční reálný růst nákladu na osobu; celkové výdaje se i tehdy mění s demografií. Důchodový věk se zavádí lineárně během deseti let. Váhy zdravotnictví a péče jsou scénářové předpoklady, nikoli prognóza ČSÚ.":"Pension expenditure starts at CZK 700.1bn in 2025, not at zero. ‘0%’ in the control means zero annual real cost growth per person only; total expenditure still changes with demographics. The retirement age is phased in linearly over ten years. Healthcare and care weights are scenario assumptions, not a CZSO forecast.",
    "05 / Mezinárodní kontext":"05 / International context","Jedna metrika.":"One metric.","Deset realit.":"Ten realities.","Rok":"Year","Ukazatel":"Metric","Skupina":"Group","Všechny země":"All countries","Základní srovnání":"Core comparison","Fiskální benchmark":"Fiscal benchmark","skutečnost do 2024":"actual through 2024","Profil země":"Country profile","Saldo × dluh":"Balance × debt","Zdroj: IMF World Economic Outlook · duben 2026":"Source: IMF World Economic Outlook · April 2026",
    "06 / Data & metodika":"06 / Data & methodology","Důvěra začíná":"Trust begins","u definice.":"with the definition.","Český rozpočet":"Czech budget","Sociální systémy":"Social systems","Mezinárodní benchmark":"International benchmark","Nahoru ↑":"Back to top ↑","Český rozpočet v čase a souvislostech":"The Czech budget over time and in context","nominální mld. Kč":"nominal CZK bn","mld. Kč":"CZK bn","mld. Kč ročně · 2045":"CZK bn per year · 2045","změna proti 2025":"change vs 2025","let":"years","návrh":"proposal","skutečnost":"actual",
    "Rozsah dat / fiskální perimeter":"Data scope / fiscal perimeter","Tři účty.":"Three perimeters.","Žádné sčítání.":"Do not add them.","Stejný stát lze měřit třemi legitimními způsoby. Výsledek se může zásadně změnit podle toho, které instituce zahrneme a zda vnitřní transfery konsolidujeme.":"The same state can be measured using three legitimate boundaries. The result can change materially depending on which institutions are included and whether internal transfers are consolidated.",
    "01 / Aktivní řada 2001–2026":"01 / Active series 2001–2026","Státní rozpočet":"State budget","Právní a pokladní rozpočet ústřední vlády. Neobsahuje vlastní rozpočty obcí a krajů, veřejné zdravotní pojištění ani obrat veřejných podniků.":"The legal and cash budget of central government. It excludes municipal and regional budgets, public health insurance and public-enterprise turnover.","Zde: české příjmy, výdaje a saldo":"Here: Czech revenue, expenditure and balance",
    "02 / Mezinárodní srovnání":"02 / International comparison","Sektor vládních institucí":"General government","Ústřední a místní vláda plus fondy sociálního zabezpečení. Vzájemné transfery se konsolidují; tržní veřejné korporace zůstávají mimo.":"Central and local government plus social-security funds. Internal transfers are consolidated; market public corporations remain outside.","Zde: IMF benchmark v % HDP":"Here: IMF benchmark as % of GDP",
    "03 / Vlastnická vrstva":"03 / Ownership layer","Veřejné korporace":"Public corporations","Samostatné účetní jednotky s vlastním obratem, náklady, aktivy a dluhem. Do rozpočtu vstupují jen skutečné platby mezi firmou a státem.":"Separate accounting units with their own turnover, costs, assets and debt. Only actual payments between the company and the state enter the budget.","Zde: registr veřejných subjektů":"Here: public-entity registry",
    "Nesčítat:":"Do not add:","státní rozpočet + obecní rozpočty + obrat státních firem. Správný konsolidovaný součet eliminuje vnitřní transfery; obrat firmy není daň ani rozpočtový příjem.":"state budget + municipal budgets + state-company turnover. A proper consolidated total eliminates internal transfers; company turnover is neither a tax nor budget revenue.",
    "Rozsah této řady:":"Scope of this series:","státní rozpočet České republiky · národní pokladní metodika · bez rozpočtů obcí a krajů · bez hrubých výnosů veřejných korporací.":"State budget of the Czech Republic · national cash methodology · excludes municipal and regional budgets · excludes gross public-corporation revenue.",
    "Účetní hranice:":"Accounting boundary:","obrat ani zisk těchto subjektů nepřičítáme k příjmům státního rozpočtu. Rozpočtovým příjmem je pouze skutečně odvedená dividenda, podíl na zisku nebo jiná platba; dotace a kapitálové vklady naopak proudí z rozpočtu do subjektu.":"neither turnover nor profit of these entities is added to state-budget revenue. Only an actually remitted dividend, profit share or other payment is budget revenue; subsidies and capital injections flow in the opposite direction.",
    "General government":"General government","IMF WEO · konsolidováno":"IMF WEO · consolidated","Společná hranice:":"Common boundary:","všechny země zde používají sektor vládních institucí, nikoli jejich národní státní či federální rozpočet. Zahrnuté subsektory uvádíme v profilu každé země; tržní veřejné korporace jsou mimo tuto metriku.":"all countries here use general government, not their national state or federal budget. Each profile states the included subsectors; market public corporations are outside this metric.",
    "Fiskální perimeter":"Fiscal perimeter","Státní rozpočet, sektor vládních institucí a veřejný sektor jsou odlišné účetní hranice. U každé řady proto uvádíme, která je aktivní a co v ní chybí.":"The state budget, general government and public sector are distinct accounting boundaries. Every series therefore states which one is active and what it excludes.","Mezinárodní řady používají sektor vládních institucí: ústřední, regionální a místní vládu a fondy sociálního zabezpečení po konsolidaci. Tržní veřejné korporace zůstávají mimo.":"International series use general government: central, regional and local government plus social-security funds after consolidation. Market public corporations remain outside.",
    "Každá řada nese institucionální rozsah. Státní rozpočet, sektor vládních institucí a veřejné korporace jsou oddělené a nesčítatelné vrstvy.":"Every series states its institutional scope. The state budget, general government and public corporations are separate, non-additive layers.","Pokladní plnění státního rozpočtu 2001–2025 a schválený rozpočet 2026. Národní metodika, mld. Kč.":"State-budget cash outturn for 2001–2025 and the approved 2026 budget. National methodology, CZK bn.","Účelová struktura zahrnuje EU/FM; všech 47 kapitol je srovnáno bez EU/FM. Rozsahy jsou viditelně oddělené.":"The purpose structure includes EU/FM; all 47 chapters are compared without EU/FM. The scopes are visibly separated.","IMF WEO, sektor vládních institucí, podíly na HDP. Transfery uvnitř sektoru jsou konsolidované; tržní veřejné korporace jsou mimo.":"IMF WEO, general government, shares of GDP. Intra-sector transfers are consolidated; market public corporations are excluded.",
    "Každý rok má stejnou klasifikaci. „Ostatní příjmy“ jsou reziduální příjmová kategorie uvnitř státního rozpočtu — zejména nedaňové a kapitálové příjmy a přijaté transfery. Nejde o příjmy dalšího veřejného sektoru.":"Every year uses the same classification. ‘Other revenue’ is a residual category inside the state budget—mainly non-tax and capital revenue and transfers received. It is not revenue of another public-sector perimeter.","Harmonizovaný rozsah IMF zahrnuje ústřední, regionální a místní vládu i fondy sociálního zabezpečení po konsolidaci. Tržní veřejné korporace jsou mimo; řada není totožná s národním státním či federálním rozpočtem.":"The harmonised IMF scope includes central, regional and local government plus social-security funds after consolidation. Market public corporations are excluded; the series is not the national state or federal budget."
  };
  Object.assign(csToEn, {
    "Český státní rozpočet": "Czech state budget",
    "Rozsah dat": "Data scope",
    "Tři účetní hranice": "Three accounting boundaries",
    "Příjmy a výdaje podle kategorií": "Revenue and expenditure by category",
    "Veřejné firmy a rozpočet": "Public companies and the state budget",
    "Výhled důchodů, zdraví a péče": "Pensions, health and care outlook",
    "Srovnání deseti zemí": "Comparison of ten countries",
    "09 / Data a metodika": "09 / Data and methodology",
    "Zdroje a definice": "Sources and definitions",
    "Registr vybraných kategorií pro rok 2024 spojuje veřejně ovládané firmy, veřejné vysoké školy, nemocnice a sedm zdravotních pojišťoven. TOP 20 strategických subjektů je zvýraznění; pod ním je filtrovatelná tabulka evidovaných organizací.": "The 2024 register combines publicly controlled companies, public universities, hospitals and seven health insurers. The strategic top 20 is highlighted above a filterable table of registered organisations.",
    "Registr vybraných kategorií · 2024": "Register of selected categories · 2024",
    "Firmy, školy, nemocnice a zdravotní pojišťovny": "Companies, universities, hospitals and health insurers",
    "Hledat název nebo IČO": "Search name or national ID",
    "např. univerzita, nemocnice, ČEZ": "e.g. university, hospital, ČEZ",
    "Veřejná úroveň / systém": "Public tier / system",
    "Všechny veřejné úrovně": "All public tiers",
    "Seřadit podle": "Sort by",
    "Výnosy / obrat": "Revenue / turnover",
    "Výsledek": "Result",
    "Čistá marže": "Net margin",
    "Název": "Name",
    "Subjekt": "Entity",
    "Typ": "Type",
    "Firmy": "Companies",
    "Vysoké školy": "Universities",
    "Nemocnice": "Hospitals",
    "Zdravotní pojišťovny": "Health insurers",
    "Top line znamená obrat u strategických firem a celkové výnosy u jednotek ČSÚIS. Chybějící výkaz není nula.": "Top line means turnover for strategic companies and total revenue for CSUIS entities. A missing statement is not zero."
  });
  const enToCs = Object.fromEntries(Object.entries(csToEn).map(([cs,en]) => [en,cs]));
  let lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("psd-lang") || "cs";
  // The HTML shipped by this page is always Czech. language-bootstrap.js sets
  // <html lang> before this deferred script runs, so it cannot be used as a
  // proxy for the language currently rendered in the body.
  let renderedLang = "cs";
  let translating = false;
  const replaceText = (text, dictionary) => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    const replacement = dictionary[trimmed] || dictionary[trimmed.replace(/\s+/g, " ")];
    return replacement ? text.replace(trimmed, replacement) : text;
  };
  function translateTree(root, dictionary) {
    if (root.nodeType === Node.TEXT_NODE) { root.nodeValue = replaceText(root.nodeValue, dictionary); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.nodeValue = replaceText(walker.currentNode.nodeValue, dictionary);
  }
  function applyLanguage(next) {
    if (translating) return; translating = true;
    const dictionary = next === "en" ? csToEn : enToCs;
    if (renderedLang !== next) {
      translateTree(document.body, dictionary);
      renderedLang = next;
    }
    lang = next; document.documentElement.lang = lang; localStorage.setItem("psd-lang", lang);
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(node => {
      for (const attribute of ["placeholder","aria-label","title"]) {
        const value=node.getAttribute(attribute); if(value&&dictionary[value])node.setAttribute(attribute,dictionary[value]);
      }
    });
    document.querySelectorAll("[data-budget-lang]").forEach(button => button.classList.toggle("active", button.dataset.budgetLang === lang));
    document.title = lang === "en" ? "Public Spending Data — Czech budget over time" : "Public Spending Data — český rozpočet v čase";
    const url = new URL(location.href); url.searchParams.set("lang", lang); history.replaceState(null,"",url);
    translating = false;
    dispatchEvent(new CustomEvent("budgetlanguagechange", { detail: { lang } }));
  }
  document.querySelectorAll("[data-budget-lang]").forEach(button => button.addEventListener("click", () => applyLanguage(button.dataset.budgetLang)));
  const observer = new MutationObserver(records => {
    if (translating || lang !== "en") return; translating = true;
    records.forEach(record => record.addedNodes.forEach(node => translateTree(node, csToEn)));
    translating = false;
  });
  observer.observe(document.body,{subtree:true,childList:true});
  applyLanguage(lang);
})();
