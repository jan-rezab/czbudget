(() => {
  const csToEn = {
    "Domů":"Home","Rozpočet":"Budget","Firmy státu":"State firms","Struktura":"Structure","Na co":"Spending","Demografie":"Demography","Srovnání":"Comparison","Metodika":"Methodology","Přehled":"Overview","Veřejné subjekty":"Public entities","Země":"Countries","Příjmy / výdaje":"Revenue / expenditure","30 účelů / 47 kapitol":"30 purposes / 47 chapters","630 organizací":"630 organisations","10 profilů":"10 profiles","Zdroje":"Sources",
    "Státní rozpočet ČR · skutečnost, schválený plán a výhled":"Czech state budget · outturn, approved plan and outlook",
    "Státní rozpočet ČR · skutečnost, návrh a výhled":"Czech state budget · outturn, proposal and outlook",
    "Český rozpočet.":"The Czech budget.","Bez krátké paměti.":"With a long memory.",
    "Pětadvacet let příjmů a výdajů, návrh pro rok 2026 a model toho, co s veřejnými financemi udělá stárnutí populace.":"Twenty-five years of revenue and expenditure, the 2026 proposal and a model of how population ageing affects public finance.",
    "Pětadvacet let příjmů a výdajů, schválený rozpočet 2026, přesný účel peněz a model dopadu stárnutí populace.":"Twenty-five years of revenue and expenditure, the approved 2026 budget, a precise spending breakdown and an ageing-impact model.",
    "Otevřít data":"Open data","Schválený 2026":"Approved 2026","Schválený schodek 2026":"2026 approved deficit","Příjmy":"Revenue","Výdaje":"Expenditure","Schodek":"Deficit","Skutečný schodek 2025":"2025 actual deficit","Změna populace 80+":"Change in population 80+",
    "01 / Rozpočet v čase":"01 / Budget over time","Příjmy a výdaje.":"Revenue and expenditure.","Na jedné ose.":"On one axis.","Zobrazení":"Display","Nominální Kč":"Nominal CZK","Ceny roku 2025":"2025 prices","Vybraný rok":"Selected year","Aktivní rok":"Active year","Příjmy × výdaje":"Revenue × expenditure","Návrh":"Proposal",
    "02 / Detailní struktura":"02 / Detailed structure","Co rozpočet živí.":"What funds the budget.","A co živí rozpočet.":"And what the budget funds.","Příjmová část":"Revenue structure","Výdajová část":"Expenditure structure","podíl v %":"share in %",
    "03 / Kam peníze jdou":"03 / Where the money goes","Za co stát platí.":"What the state pays for.","A kdo peníze spravuje.":"And who manages it.","Na co stát vydává":"What the state spends on","Kdo peníze spravuje":"Who manages the money","30 účelových oblastí":"30 purpose areas","Výdaje celkem":"Total expenditure","včetně EU/FM":"including EU/FM","Důchody":"Pensions","Pět největších účelů":"Five largest purposes","podíl všech výdajů":"share of all expenditure","EU/FM a rozdíl rozsahu":"EU/FM and scope difference","proti kapitolám bez EU/FM":"vs chapters excluding EU/FM","Částka 2026":"2026 amount","Největší změna":"Largest change","Hledat ministerstvo nebo kapitolu":"Search a ministry or chapter",
    "Účel říká, jakou potřebu stát financuje. Kapitola říká, který úřad peníze spravuje. Jsou to dvě různé klasifikace téhož rozpočtu — proto je ukazujeme vedle sebe.":"Purpose shows which public need is funded. Chapter shows which authority manages the money. They are two classifications of the same budget, so we show them side by side.",
    "Pozor na rozsah:":"Scope matters:","účelová struktura pokrývá úplných 2 427,8 mld. Kč včetně peněz EU a finančních mechanismů. Kapitoly jsou v oficiálním srovnání MF uvedeny bez EU/FM, celkem 2 287,6 mld. Kč. Rozdíl není chybějící výdaj.":"the purpose breakdown covers the full CZK 2,427.8bn including EU funds and financial mechanisms. The Ministry of Finance chapter comparison excludes EU/FM and totals CZK 2,287.6bn. The difference is not missing expenditure.",
    "Zdroj:":"Source:","Částky jsou zaokrouhlené na 0,1 mld. Kč.":"Amounts are rounded to CZK 0.1bn.","Hodnoty kapitol jsou bez EU/FM.":"Chapter values exclude EU/FM.","MF ČR — Státní rozpočet 2026, exekutivní shrnutí ↗":"Czech Ministry of Finance — 2026 budget executive summary ↗","MF ČR — schválený rozpočet a všech 47 kapitol ↗":"Czech Ministry of Finance — approved budget and all 47 chapters ↗",
    "04 / Stát jako vlastník":"04 / The state as owner","05 / Demografický model":"05 / Demographic model","06 / Mezinárodní kontext":"06 / International context","07 / Data & metodika":"07 / Data & methodology","Výdaje 2026":"2026 expenditure",
    "03 / Stát jako vlastník":"03 / The state as owner","Zisk není":"Profit is not","příjem rozpočtu.":"budget revenue.","Suma zisků":"Sum of profits","Suma ztrát":"Sum of losses","Čistý výsledek":"Net result","Součet obratu":"Total turnover","Všech 38":"All 38","20 nejziskovějších":"20 most profitable","20 nejslabších":"20 weakest","20 největších":"20 largest","Otevřít úplný profil":"Open full profile",
    "04 / Demografický model":"04 / Demographic model","Stárnutí není graf.":"Ageing is not a chart.","Je to účet.":"It is a bill.","Varianta ČSÚ":"CZSO variant","Nízká":"Low","Střední":"Medium","Vysoká":"High","Efektivní důchodový věk":"Effective retirement age","Reálný růst mezd":"Real wage growth","Reálný růst nákladů":"Real cost growth","Populace 80+":"Population 80+","Dodatečný tlak":"Additional pressure","Důchodové saldo":"Pension balance","Věková struktura":"Age structure","miliony obyvatel":"million people","Tlak podle systému":"Pressure by system","Nový každoroční účet":"New annual cost","proti 2025 · mld. Kč":"vs 2025 · CZK bn","Důchodový účet: plátci proti příjemcům":"Pension account: contributors vs recipients","mld. Kč v cenách 2025":"CZK bn at 2025 prices",
    "05 / Mezinárodní kontext":"05 / International context","Jedna metrika.":"One metric.","Deset realit.":"Ten realities.","Rok":"Year","Ukazatel":"Metric","Skupina":"Group","Všechny země":"All countries","Základní srovnání":"Core comparison","Fiskální benchmark":"Fiscal benchmark","skutečnost do 2024":"actual through 2024","Profil země":"Country profile","Saldo × dluh":"Balance × debt","Zdroj: IMF World Economic Outlook · duben 2026":"Source: IMF World Economic Outlook · April 2026",
    "06 / Data & metodika":"06 / Data & methodology","Důvěra začíná":"Trust begins","u definice.":"with the definition.","Český rozpočet":"Czech budget","Sociální systémy":"Social systems","Mezinárodní benchmark":"International benchmark","Nahoru ↑":"Back to top ↑","Český rozpočet v čase a souvislostech":"The Czech budget over time and in context","nominální mld. Kč":"nominal CZK bn","mld. Kč":"CZK bn","mld. Kč ročně · 2045":"CZK bn per year · 2045","změna proti 2025":"change vs 2025","let":"years","návrh":"proposal","skutečnost":"actual"
  };
  const enToCs = Object.fromEntries(Object.entries(csToEn).map(([cs,en]) => [en,cs]));
  let lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("psd-lang") || "cs";
  let translating = false;
  const replaceText = (text, dictionary) => {
    const trimmed = text.trim();
    if (!trimmed || !dictionary[trimmed]) return text;
    return text.replace(trimmed, dictionary[trimmed]);
  };
  function translateTree(root, dictionary) {
    if (root.nodeType === Node.TEXT_NODE) { root.nodeValue = replaceText(root.nodeValue, dictionary); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.nodeValue = replaceText(walker.currentNode.nodeValue, dictionary);
  }
  function applyLanguage(next) {
    if (translating) return; translating = true;
    const previous = document.documentElement.lang === "en" ? "en" : "cs";
    if (previous !== next) translateTree(document.body, next === "en" ? csToEn : enToCs);
    lang = next; document.documentElement.lang = lang; localStorage.setItem("psd-lang", lang);
    document.querySelectorAll("[data-budget-lang]").forEach(button => button.classList.toggle("active", button.dataset.budgetLang === lang));
    const home = document.getElementById("budget-home-link"); if (home) home.href = `index.html?lang=${lang}`;
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
