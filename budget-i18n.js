(() => {
  const csToEn = {
    "Domů":"Home","Rozpočet":"Budget","Firmy státu":"State firms","Struktura":"Structure","Na co":"Spending","Demografie":"Demography","Srovnání":"Comparison","Metodika":"Methodology","Přehled":"Overview","Veřejné subjekty":"Public entities","Země":"Countries","Příjmy / výdaje":"Revenue / expenditure","{n} účelů / {n} kapitol":"{n} purposes / {n} chapters","{n} organizací":"{n} organisations","{n} profilů":"{n} profiles","Zdroje":"Sources",
    "Státní rozpočet ČR · skutečnost, schválený plán a výhled":"Czech state budget · outturn, approved plan and outlook",
    "Státní rozpočet ČR · skutečnost, návrh a výhled":"Czech state budget · outturn, proposal and outlook",
    "Český rozpočet.":"The Czech budget.","Bez krátké paměti.":"With a long memory.",
    "Pětadvacet let příjmů a výdajů, návrh pro rok {n} a model toho, co s veřejnými financemi udělá stárnutí populace.":"Twenty-five years of revenue and expenditure, the {n} proposal and a model of how population ageing affects public finance.",
    "Pětadvacet let příjmů a výdajů, schválený rozpočet {n}, přesný účel peněz a model dopadu stárnutí populace.":"Twenty-five years of revenue and expenditure, the approved {n} budget, a precise spending breakdown and an ageing-impact model.",
    "Otevřít data":"Open data","Schválený {n}":"Approved {n}","Schválený schodek {n}":"{n} approved deficit","Příjmy":"Revenue","Výdaje":"Expenditure","Schodek":"Deficit","Skutečný schodek {n}":"{n} actual deficit","Změna populace {n}+":"Change in population {n}+",
    "Rozpočet počítá se schodkem, který odpovídá téměř celému čistému demografickému tlaku vybraných systémů v roce {n}.":"The budget assumes a deficit almost equal to the entire net demographic pressure from the selected systems in {n}.","{n} % výdajů":"{n}% of expenditure","Úplné příjmy a výdaje včetně EU/FM; saldo je totožné s variantou bez EU/FM.":"Complete revenue and expenditure including EU/FM; the balance is identical to the version excluding EU/FM.","{n}+ na {n} lidí {n}–{n}":"People aged {n}+ per {n} people aged {n}–{n}","střední varianta · {n}":"medium variant · {n}",
    "Příjmy a výdaje v čase":"Revenue and expenditure over time","Skutečné pokladní plnění {n}–{n} a schválený rozpočet {n}. Přepněte nominální koruny na ceny roku {n} a porovnejte období bez inflačního zkreslení.":"Actual cash outturn for {n}–{n} and the approved {n} budget. Switch nominal koruna values to {n} prices to compare periods without inflation distortion.","{n} · schválený":"{n} · approved","daně + pojistné + ostatní":"taxes + contributions + other","běžné + kapitálové":"current + capital","SOCIÁLNÍ DÁVKY":"SOCIAL BENEFITS","{n} % výdajů":"{n}% of expenditure","DANĚ · POJISTNÉ · OSTATNÍ":"TAXES · CONTRIBUTIONS · OTHER","daně · pojistné · ostatní":"taxes · contributions · other","Odkud peníze přicházejí":"Where the money comes from","Ostatní příjmy":"Other revenue","Složení příjmů státního rozpočtu":"Composition of state budget revenue","Výdaje níže financují tyto tři zdroje. Schválený rozpočet {n}.":"The expenditure below is financed by these three sources. Approved {n} budget.","Daně":"Taxes","DPFO":"PIT","DPPO":"CIT","Daň z příjmů fyzických osob":"Personal income tax","Daň z příjmů právnických osob":"Corporate income tax","DPH":"VAT","Spotřební a energetické daně":"Excise and energy taxes","Majetkové daně":"Property taxes","Ostatní daně a poplatky":"Other taxes and fees","Sociální pojistné":"Social contributions","Ostatní":"Other","DÁVKY · PROVOZ · INVESTICE":"BENEFITS · OPERATIONS · INVESTMENT","dávky · provoz · investice":"benefits · operations · investment","Sociální dávky":"Social benefits","Výdaje podle účelu a kapitoly":"Expenditure by purpose and chapter",". Částky jsou zaokrouhlené na {n} mld. Kč.":". Amounts are rounded to CZK {n}bn.","mld. Kč · dostupné výkazy":"CZK bn · available statements","Vše":"All",
    "{n} / Demografický model":"{n} / Demographic model","Model propojuje věkovou projekci ČSÚ s důchody, veřejným zdravotním pojištěním a příspěvkem na péči. Výchozí nastavení izoluje čistý vliv demografie.":"The model links the CZSO age projection with pensions, public health insurance and the care allowance. The default settings isolate the pure demographic effect.","z {n} mld. Kč v roce {n}":"from CZK {n}bn in {n}","mld. Kč · {n}":"CZK bn · {n}","Zdravotnictví":"Healthcare","Péče":"Care","Příjmová báze":"Revenue base","Jak číst model:":"How to read the model:",
    "{n} / Mezinárodní kontext":"{n} / International context","Český státní rozpočet doplňuje harmonizované srovnání sektoru vládních institucí podle IMF. Jde o jiný rozsah než národní státní rozpočet, proto data nemícháme.":"The Czech state budget is complemented by an IMF-harmonised general-government comparison. This has a different scope from the national state budget, so the data are kept separate.","Výdaje vládních institucí":"General-government expenditure","{n} zemí":"{n} countries","Německo":"Germany","Švédsko":"Sweden","Dánsko":"Denmark","Spojené království":"United Kingdom","Česko":"Czechia","Švýcarsko":"Switzerland","Vybraná země":"Selected country","{n} · General government / sektor vládních institucí":"{n} · General government","Hrubý dluh":"Gross debt","Česko · {n}":"Czechia · {n}",
    "{n} / Rozpočet v čase":"{n} / Budget over time","Příjmy a výdaje.":"Revenue and expenditure.","Na jedné ose.":"On one axis.","Zobrazení":"Display","Nominální Kč":"Nominal CZK","Ceny roku {n}":"{n} prices","Vybraný rok":"Selected year","Aktivní rok":"Active year","Příjmy × výdaje":"Revenue × expenditure","Návrh":"Proposal",
    "{n} / Detailní struktura":"{n} / Detailed structure","Co rozpočet živí.":"What funds the budget.","A co živí rozpočet.":"And what the budget funds.","Příjmová část":"Revenue structure","Výdajová část":"Expenditure structure","daně v detailu · pojistné · ostatní":"tax detail · contributions · other","podíl v %":"share in %",
    "{n} / Kam peníze jdou":"{n} / Where the money goes","Za co stát platí.":"What the state pays for.","A kdo peníze spravuje.":"And who manages it.","Na co stát vydává":"What the state spends on","Kdo peníze spravuje":"Who manages the money","{n} účelových oblastí":"{n} purpose areas","Výdaje celkem":"Total expenditure","včetně EU/FM":"including EU/FM","Důchody":"Pensions","Pět největších účelů":"Five largest purposes","podíl všech výdajů":"share of all expenditure","EU/FM a rozdíl rozsahu":"EU/FM and scope difference","proti kapitolám bez EU/FM":"vs chapters excluding EU/FM","Částka {n}":"{n} amount","Největší změna":"Largest change","Hledat ministerstvo nebo kapitolu":"Search a ministry or chapter",
    "Účel říká, jakou potřebu stát financuje. Kapitola říká, který úřad peníze spravuje. Jsou to dvě různé klasifikace téhož rozpočtu — proto je ukazujeme vedle sebe.":"Purpose shows which public need is funded. Chapter shows which authority manages the money. They are two classifications of the same budget, so we show them side by side.",
    "Pozor na rozsah:":"Scope matters:","účelová struktura pokrývá úplných {n} mld. Kč včetně peněz EU a finančních mechanismů. Kapitoly jsou v oficiálním srovnání MF uvedeny bez EU/FM, celkem {n} mld. Kč. Rozdíl není chybějící výdaj.":"the purpose breakdown covers the full CZK {n}bn including EU funds and financial mechanisms. The Ministry of Finance chapter comparison excludes EU/FM and totals CZK {n}bn. The difference is not missing expenditure.",
    "Zdroj:":"Source:","Částky jsou zaokrouhlené na {n} mld. Kč.":"Amounts are rounded to CZK {n}bn.","Hodnoty kapitol jsou bez EU/FM.":"Chapter values exclude EU/FM.","MF ČR — Státní rozpočet {n}, exekutivní shrnutí ↗":"Czech Ministry of Finance — {n} budget executive summary ↗","MF ČR — schválený rozpočet a všech {n} kapitol ↗":"Czech Ministry of Finance — approved budget and all {n} chapters ↗",
    "{n} / Stát jako vlastník":"{n} / The state as owner","{n} / Demografický model":"{n} / Demographic model","{n} / Mezinárodní kontext":"{n} / International context","{n} / Data & metodika":"{n} / Data & methodology","Výdaje {n}":"{n} expenditure",
    "{n} / Stát jako vlastník":"{n} / The state as owner","Zisk není":"Profit is not","příjem rozpočtu.":"budget revenue.","Suma zisků":"Sum of profits","Suma ztrát":"Sum of losses","Čistý výsledek":"Net result","Součet obratu":"Total turnover","Všech {n}":"All {n}","{n} nejziskovějších":"{n} most profitable","{n} nejslabších":"{n} weakest","{n} největších":"{n} largest","Otevřít úplný profil":"Open full profile",
    "{n} / Demografický model":"{n} / Demographic model","Stárnutí není graf.":"Ageing is not a chart.","Je to účet.":"It is a bill.","Varianta ČSÚ":"CZSO variant","Nízká":"Low","Střední":"Medium","Vysoká":"High","Efektivní důchodový věk":"Effective retirement age","Roční reálný růst mezd na plátce":"Annual real wage growth per contributor","Roční reálný růst nákladů na osobu":"Annual real cost growth per person","Populace {n}+":"Population {n}+","Roční náklady systémů · {n}":"Annual system costs · {n}","Roční výdaje systémů":"Annual system expenditure","úroveň v mld. Kč · ceny {n}":"level in CZK bn · {n} prices","Důchodové saldo":"Pension balance","Věková struktura":"Age structure","miliony obyvatel":"million people","Tlak podle systému":"Pressure by system","Důchodový účet: plátci proti příjemcům":"Pension account: contributors vs recipients","mld. Kč v cenách {n}":"CZK bn at {n} prices",
    "výchozí úroveň {n} se načítá…":"loading the {n} baseline…","Celkem":"Total","Výdaje na důchody začínají v roce {n} na {n} mld. Kč, nikoli na nule. „{n} %“ v ovladači je pouze nulový roční reálný růst nákladu na osobu; celkové výdaje se i tehdy mění s demografií. Důchodový věk se zavádí lineárně během deseti let. Váhy zdravotnictví a péče jsou scénářové předpoklady, nikoli prognóza ČSÚ.":"Pension expenditure starts at CZK {n}bn in {n}, not at zero. ‘{n}%’ in the control means zero annual real cost growth per person only; total expenditure still changes with demographics. The retirement age is phased in linearly over ten years. Healthcare and care weights are scenario assumptions, not a CZSO forecast.",
    "{n} / Mezinárodní kontext":"{n} / International context","Jedna metrika.":"One metric.","Deset realit.":"Ten realities.","Rok":"Year","Ukazatel":"Metric","Skupina":"Group","Všechny země":"All countries","Základní srovnání":"Core comparison","Fiskální benchmark":"Fiscal benchmark","skutečnost do {n}":"actual through {n}","Profil země":"Country profile","Saldo × dluh":"Balance × debt","Zdroj: IMF World Economic Outlook · duben {n}":"Source: IMF World Economic Outlook · April {n}",
    "{n} / Data & metodika":"{n} / Data & methodology","Důvěra začíná":"Trust begins","u definice.":"with the definition.","Český rozpočet":"Czech budget","Sociální systémy":"Social systems","Mezinárodní benchmark":"International benchmark","Nahoru ↑":"Back to top ↑","Český rozpočet v čase a souvislostech":"The Czech budget over time and in context","nominální mld. Kč":"nominal CZK bn","mld. Kč":"CZK bn","mld. Kč ročně · {n}":"CZK bn per year · {n}","změna proti {n}":"change vs {n}","let":"years","návrh":"proposal","skutečnost":"actual",
    "Rozsah dat / fiskální perimeter":"Data scope / fiscal perimeter","Tři účty.":"Three perimeters.","Žádné sčítání.":"Do not add them.","Stejný stát lze měřit třemi legitimními způsoby. Výsledek se může zásadně změnit podle toho, které instituce zahrneme a zda vnitřní transfery konsolidujeme.":"The same state can be measured using three legitimate boundaries. The result can change materially depending on which institutions are included and whether internal transfers are consolidated.",
    "{n} / Aktivní řada {n}–{n}":"{n} / Active series {n}–{n}","Státní rozpočet":"State budget","Právní a pokladní rozpočet ústřední vlády. Neobsahuje vlastní rozpočty obcí a krajů, veřejné zdravotní pojištění ani obrat veřejných podniků.":"The legal and cash budget of central government. It excludes municipal and regional budgets, public health insurance and public-enterprise turnover.","Zde: české příjmy, výdaje a saldo":"Here: Czech revenue, expenditure and balance",
    "{n} / Mezinárodní srovnání":"{n} / International comparison","Sektor vládních institucí":"General government","Ústřední a místní vláda plus fondy sociálního zabezpečení. Vzájemné transfery se konsolidují; tržní veřejné korporace zůstávají mimo.":"Central and local government plus social-security funds. Internal transfers are consolidated; market public corporations remain outside.","Zde: IMF benchmark v % HDP":"Here: IMF benchmark as % of GDP",
    "{n} / Vlastnická vrstva":"{n} / Ownership layer","Veřejné korporace":"Public corporations","Samostatné účetní jednotky s vlastním obratem, náklady, aktivy a dluhem. Do rozpočtu vstupují jen skutečné platby mezi firmou a státem.":"Separate accounting units with their own turnover, costs, assets and debt. Only actual payments between the company and the state enter the budget.","Zde: registr veřejných subjektů":"Here: public-entity registry",
    "Nesčítat:":"Do not add:","státní rozpočet + obecní rozpočty + obrat státních firem. Správný konsolidovaný součet eliminuje vnitřní transfery; obrat firmy není daň ani rozpočtový příjem.":"state budget + municipal budgets + state-company turnover. A proper consolidated total eliminates internal transfers; company turnover is neither a tax nor budget revenue.",
    "Rozsah této řady:":"Scope of this series:","státní rozpočet České republiky · národní pokladní metodika · bez rozpočtů obcí a krajů · bez hrubých výnosů veřejných korporací.":"State budget of the Czech Republic · national cash methodology · excludes municipal and regional budgets · excludes gross public-corporation revenue.",
    "Účetní hranice:":"Accounting boundary:","obrat ani zisk těchto subjektů nepřičítáme k příjmům státního rozpočtu. Rozpočtovým příjmem je pouze skutečně odvedená dividenda, podíl na zisku nebo jiná platba; dotace a kapitálové vklady naopak proudí z rozpočtu do subjektu.":"neither turnover nor profit of these entities is added to state-budget revenue. Only an actually remitted dividend, profit share or other payment is budget revenue; subsidies and capital injections flow in the opposite direction.",
    "General government":"General government","IMF WEO · konsolidováno":"IMF WEO · consolidated","Společná hranice:":"Common boundary:","všechny země zde používají sektor vládních institucí, nikoli jejich národní státní či federální rozpočet. Zahrnuté subsektory uvádíme v profilu každé země; tržní veřejné korporace jsou mimo tuto metriku.":"all countries here use general government, not their national state or federal budget. Each profile states the included subsectors; market public corporations are outside this metric.",
    "Fiskální perimeter":"Fiscal perimeter","Státní rozpočet, sektor vládních institucí a veřejný sektor jsou odlišné účetní hranice. U každé řady proto uvádíme, která je aktivní a co v ní chybí.":"The state budget, general government and public sector are distinct accounting boundaries. Every series therefore states which one is active and what it excludes.","Mezinárodní řady používají sektor vládních institucí: ústřední, regionální a místní vládu a fondy sociálního zabezpečení po konsolidaci. Tržní veřejné korporace zůstávají mimo.":"International series use general government: central, regional and local government plus social-security funds after consolidation. Market public corporations remain outside.",
    "Každá řada nese institucionální rozsah. Státní rozpočet, sektor vládních institucí a veřejné korporace jsou oddělené a nesčítatelné vrstvy.":"Every series states its institutional scope. The state budget, general government and public corporations are separate, non-additive layers.","Pokladní plnění státního rozpočtu {n}–{n} a schválený rozpočet {n}. Národní metodika, mld. Kč.":"State-budget cash outturn for {n}–{n} and the approved {n} budget. National methodology, CZK bn.","Účelová struktura zahrnuje EU/FM; všech {n} kapitol je srovnáno bez EU/FM. Rozsahy jsou viditelně oddělené.":"The purpose structure includes EU/FM; all {n} chapters are compared without EU/FM. The scopes are visibly separated.","IMF WEO, sektor vládních institucí, podíly na HDP. Transfery uvnitř sektoru jsou konsolidované; tržní veřejné korporace jsou mimo.":"IMF WEO, general government, shares of GDP. Intra-sector transfers are consolidated; market public corporations are excluded.",
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
    "Srovnání benchmarkových zemí": "Comparison of benchmark countries",
    "Benchmarkové země": "Benchmark countries",
    "Benchmarky": "Benchmarks",
    "Český státní rozpočet doplňuje harmonizované srovnání Česka s referenčními fiskálními zeměmi podle IMF. Jde o jiný rozsah než národní státní rozpočet, proto data nemícháme.": "The Czech state budget is complemented by an IMF-harmonised comparison of Czechia with its fiscal reference countries. This has a different scope from the national state budget, so the data are kept separate.",
    "{n} / Data a metodika":"{n} / Data and methodology",
    "Zdroje a definice": "Sources and definitions",
    "Registr vybraných kategorií pro rok {n} spojuje veřejně ovládané firmy, veřejné vysoké školy, nemocnice a sedm zdravotních pojišťoven. TOP {n} strategických subjektů je zvýraznění; pod ním je filtrovatelná tabulka evidovaných organizací.":"The {n} register combines publicly controlled companies, public universities, hospitals and seven health insurers. The strategic top {n} is highlighted above a filterable table of registered organisations.",
    "Registr vybraných kategorií · {n}":"Register of selected categories · {n}",
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
    "Top line znamená obrat u strategických firem a celkové výnosy u jednotek ČSÚIS. Chybějící výkaz není nula.": "Top line means turnover for strategic companies and total revenue for CSUIS entities. A missing statement is not zero.",
    "{n} / Celý rozpočet {n}": "{n} / The full {n} budget",
    "Příjmy a výdaje. Bez zkratek.": "Revenue and expenditure. The full picture.",
    "Každá koruna schváleného státního rozpočtu v jednom pohledu: {n} mld. Kč příjmů proti {n} mld. Kč výdajů. Klikněte na výseč a otevřete její úplný detail.": "Every koruna in the approved state budget, in one view: CZK {n}bn in revenue against CZK {n}bn in expenditure. Select a slice to open its complete detail.",
    "Schodek": "Deficit",
    "{n} mld. Kč · {n} % zdrojů": "CZK {n}bn · {n}% of sources",
    "mld. Kč · {n} % zdrojů": "CZK bn · {n}% of sources",
    "{n} % výdajů není kryto příjmy": "{n}% of expenditure is not covered by revenue",
    "{n} mld. Kč · {n} účelů": "CZK {n}bn · {n} purposes",
    "mld. Kč · {n} účelů": "CZK bn · {n} purposes",
    "A / Zdroje": "A / Sources",
    "B / Použití": "B / Uses",
    "Příjmová struktura": "Revenue structure",
    "Výdajová struktura": "Expenditure structure",
    "{n} úplných kategorií": "{n} complete categories",
    "{n} účelů v {n} skupinách": "{n} purposes in {n} groups",
    "Složení výdajů státního rozpočtu": "Composition of state-budget expenditure",
    "Co přesně sčítáme:": "What exactly is included:",
    "schválený státní rozpočet {n} včetně prostředků EU a finančních mechanismů. Příjmy i výdaje používají stejný celkový rozsah; jednotlivé výdajové účely jsou zaokrouhlené na {n} mld. Kč.": "the approved {n} state budget including EU funds and financial mechanisms. Revenue and expenditure use the same total scope; individual spending purposes are rounded to CZK {n}bn.",
    "Vývoj struktury": "Structure over time",
    "Jak se skladba rozpočtu měnila": "How the budget mix changed",
    "Stejná klasifikace v celé řadě ukazuje, které zdroje a typy výdajů rostly od roku {n}.": "A consistent classification across the series shows which revenue sources and expenditure types have grown since {n}.",
    "Tok peněz": "Money flow",
    "SALDO": "BALANCE",
    "Saldo": "Balance",
    "Mzdy státu": "Government wages",
    "Mzdy": "Wages",
    "Investice": "Investment",
    "{n} mld.": "CZK {n}bn",
    "{n} let": "{n} years",
    "schodek {n} · {n} mld.": "{n} deficit · CZK {n}bn",
    ". Hodnoty kapitol jsou bez EU/FM.": ". Chapter values exclude EU/FM."
  });
  const enToCs = Object.fromEntries(Object.entries(csToEn).map(([cs,en]) => [en,cs]));
  // language-bootstrap.js already resolved URL param → stored preference →
  // route default; re-reading storage here would only duplicate it unguarded.
  let lang = window.PSDLanguage?.current() || (document.documentElement.lang === "en" ? "en" : "cs");
  // The HTML shipped by this page is always Czech. language-bootstrap.js sets
  // <html lang> before this deferred script runs, so it cannot be used as a
  // proxy for the language currently rendered in the body.
  let renderedLang = "cs";
  let translating = false;
  // A5 + B5 — numbers are formatted at render, never baked into a translation key.
  //
  // These dictionaries key English strings off whole Czech strings. Where that string used
  // to carry a figure, the key was a second, uncontrolled copy of a number that also lives
  // in a data artifact: the moment the data moved, the key stopped matching and the English
  // page silently rendered Czech. Keys now carry a {n} placeholder instead, so any value
  // matches and the figure passes through — reformatted for the target locale, because
  // Czech writes 2 427,8 where English writes 2,427.8.
  const NUMBER = /\d+(?:[   ,.]\d+)*/g;

  function reformatNumber(token, toLang) {
    // A bare run of digits is a year or a plain count — 2026 must not become 2,026.
    if (/^\d+$/.test(token)) return token;
    const hasCzechDecimal = /,\d+$/.test(token);
    const normalised = hasCzechDecimal
      ? token.replace(/[   ]/g, "").replace(",", ".")
      : token.replace(/[   ,]/g, "");
    const value = Number(normalised);
    if (!Number.isFinite(value)) return token;
    const decimals = (normalised.split(".")[1] || "").length;
    return value.toLocaleString(toLang === "en" ? "en-GB" : "cs-CZ", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const replaceText = (text, dictionary, toLang) => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    const exact = dictionary[trimmed] || dictionary[trimmed.replace(/\s+/g, " ")];
    if (exact) return text.replace(trimmed, exact);

    // No literal match: try the same string with its figures reduced to placeholders.
    const figures = trimmed.match(NUMBER);
    if (!figures) return text;
    const pattern = trimmed.replace(NUMBER, "{n}");
    const template = dictionary[pattern] || dictionary[pattern.replace(/\s+/g, " ")];
    if (!template) return text;
    let index = 0;
    const rendered = template.replace(/\{n\}/g, () => {
      const token = figures[index++];
      return token === undefined ? "" : reformatNumber(token, toLang);
    });
    return text.replace(trimmed, rendered);
  };
  function translateTree(root, dictionary, toLang) {
    if (root.nodeType === Node.TEXT_NODE) { root.nodeValue = replaceText(root.nodeValue, dictionary, toLang); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.nodeValue = replaceText(walker.currentNode.nodeValue, dictionary, toLang);
  }
  // persist is true only for an explicit user toggle; the load-time call must
  // never write a merely defaulted language into the sitewide preference.
  function applyLanguage(next, persist = false) {
    if (translating) return; translating = true;
    const dictionary = next === "en" ? csToEn : enToCs;
    if (renderedLang !== next) {
      translateTree(document.body, dictionary, next);
      renderedLang = next;
    }
    lang = window.PSDLanguage?.set(next, { persist }) || next; document.documentElement.lang = lang;
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
  document.querySelectorAll("[data-budget-lang]").forEach(button => button.addEventListener("click", () => applyLanguage(button.dataset.budgetLang, true)));
  const observer = new MutationObserver(records => {
    if (translating || lang !== "en") return; translating = true;
    records.forEach(record => record.addedNodes.forEach(node => translateTree(node, csToEn, "en")));
    translating = false;
  });
  observer.observe(document.body,{subtree:true,childList:true});
  applyLanguage(lang);
})();
