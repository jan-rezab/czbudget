(() => {
  const requested = new URLSearchParams(location.search).get("lang");
  const lang = requested === "en" || requested === "cs" ? requested : (document.documentElement.lang === "en" ? "en" : "cs");
  document.documentElement.lang = lang;

  const csToEn = {
    "Přehled":"Overview", "Pořadí":"Rankings", "Historie":"History", "Odvody":"Payments", "Metodika":"Methodology", "Obce":"Municipalities",
    "Česko · stát jako vlastník":"Czechia · the state as owner", "Zisk není":"Profit is not", "příjem rozpočtu.":"budget revenue.",
    "Účetní výsledek státní firmy a peníze, které skutečně odvede státu, jsou dvě různá čísla. Tady jsou poprvé vedle sebe.":"A state-owned company's accounting result and the money it actually pays to the state are two different figures. Here they are shown side by side.",
    "Otevřít žebříčky":"Open the rankings", "{n} strategických subjektů · skutečnost {n}":"{n} strategic entities · {n} actuals",
    "Čistý výsledek":"Net result", "Odvody státu":"Payments to the state", "Součet zisků a ztrát zůstává nejprve uvnitř jednotlivých podniků. Rozpočtovým příjmem je až dividenda nebo odvod do fondu zakladatele.":"Profit and loss initially remain inside each enterprise. Only a dividend or payment to the founder's fund becomes budget revenue.",
    "Sledované subjekty":"Tracked entities", "strategické firmy a organizace":"strategic companies and organisations", "mld. Kč · součet {n}":"CZK bn · {n} total", "mld. Kč · dividendy a odvody":"CZK bn · dividends and payments", "Zaměstnanci":"Employees", "osob na konci roku":"people at year-end",
    "{n} / Výsledek hospodaření":"{n} / Financial result", "Dva konce":"Two ends", "jednoho portfolia.":"of one portfolio.",
    "TOP {n} používá individuální údaje {n} strategických subjektů za rok {n}. Úplný registr firem, veřejných vysokých škol a nemocnic je pod zvýrazněnými žebříčky.":"The top {n} uses individual {n} figures for {n} strategic entities. The complete register of companies, public universities and hospitals appears below the highlighted rankings.",
    "Suma zisků":"Sum of profits", "Suma ztrát":"Sum of losses", "Výnosy / obrat":"Revenue / turnover", "mld. Kč · dostupné výkazy":"CZK bn · available statements", "Součty za všechny subjekty s dostupným výsledkem za rok {n}.":"Totals for all entities with an available {n} result.",
    "{n} nejziskovějších":"{n} most profitable", "{n} nejslabších":"{n} weakest", "{n} největších":"{n} largest", "Nejziskovější strategické subjekty":"Most profitable strategic entities", "Jak číst pořadí":"How to read the ranking",
    "ČEZ je uveden individuálně za mateřskou společnost. Správa železnic, ŘSD nebo Česká pošta plní veřejné služby; jejich výsledky proto nelze mechanicky porovnávat s čistě komerční firmou.":"ČEZ is reported for the parent company. Správa železnic, ŘSD and Česká pošta provide public services, so their results cannot be compared mechanically with a purely commercial company.",
    "Registr vybraných kategorií · {n}":"Register of selected categories · {n}", "Firmy, školy, nemocnice a zdravotní pojišťovny":"Companies, universities, hospitals and health insurers", "Hledat název nebo IČO":"Search name or national ID", "Veřejná úroveň / systém":"Public tier / system", "Všechny veřejné úrovně":"All public tiers", "Seřadit podle":"Sort by", "Výsledek":"Result", "Čistá marže":"Net margin", "Název":"Name", "Subjekt":"Entity", "Typ":"Type", "Data":"Data",
    "Top line znamená obrat u strategických firem a celkové výnosy u jednotek ČSÚIS. Chybějící výkaz není nula.":"Top line means turnover for strategic companies and total revenue for CSUIS entities. A missing statement is not zero.",
    "Vše":"All", "Firmy":"Companies", "Vysoké školy":"Universities", "Nemocnice":"Hospitals", "Zdravotní pojišťovny":"Health insurers",
    "{n} / Účetní řady {n}–{n}":"{n} / Financial series {n}–{n}", "Jeden subjekt.":"One entity.", "Celá dostupná řada.":"The full available series.", "Výnosy, náklady a účetní výsledek po jednotlivých letech. Pokrytí otevřeného výkazu zisku a ztráty se mění podle roku a kategorie; chybějící rok není nula.":"Revenue, costs and accounting result by year. Coverage of the open income statement varies by year and category; a missing year is not zero.", "Načítám historické účetní řady…":"Loading historical financial series…",
    "{n} / Peníze pro stát":"{n} / Money paid to the state", "Co skutečně":"What actually", "přiteklo státu.":"reached the state.", "Dividendy a odvody ze zisku v roce {n}. Teprve tato vrstva představuje výnos vlastníka nebo příjem veřejných rozpočtů — nikoli celý zisk firem.":"Dividends and profit payments in {n}. This layer—not total company profit—represents owner income or public-budget revenue.", "Odvod / dividenda":"Payment / dividend",
    "{n} / Kontext":"{n} / Context", "Jedno vlastnictví.":"One owner.", "Tři různé logiky.":"Three different logics.", "Portfolio státu není jednolitá skupina. Pro smysluplné srovnání budeme subjekty v dalších letech držet odděleně podle jejich veřejné a komerční role.":"The state portfolio is not a uniform group. Meaningful comparisons keep entities separate by their public and commercial roles.",
    "Komerční výnos":"Commercial return", "Energetika, letiště nebo pivovar lze posuzovat přes návratnost, dividendu a dlouhodobou hodnotu podílu.":"Energy, airports or a brewery can be assessed through return, dividends and the long-term value of the holding.", "Veřejná služba":"Public service", "Železnice, silnice a pošta poskytují službu, kterou stát zadává nebo reguluje. Zisk není jejich jediným cílem.":"Railways, roads and postal services deliver services commissioned or regulated by the state. Profit is not their only objective.", "Sanace a bezpečnost":"Remediation and security", "DIAMO, správci povodí či strategické zásoby nesou náklady, které mají charakter veřejné pojistky.":"DIAMO, river-basin managers and strategic reserves carry costs that function as public insurance.",
    "Rámec pro zahraniční srovnání:":"International comparison framework:", "každá firma má pracovní sektor, ekonomickou roli a konkrétní mezinárodní peer group. Porovnávat budeme ROA, marži, zadlužení vůči aktivům, investiční intenzitu, obrat na zaměstnance a výsledek na zaměstnance — vždy pouze uvnitř stejné ekonomické funkce.":"each company has a working sector, an economic role and a specific international peer group. ROA, margin, debt to assets, investment intensity, turnover per employee and result per employee are compared only within the same economic function.",
    "Datová mapa ČR":"Czech data map", "Státní firmy":"State-owned companies", "výsledky · dotace · odvody":"results · subsidies · payments", "Veřejné vysoké školy":"Public universities", "výnosy · náklady · transfery":"revenue · costs · transfers", "výsledek · úhrady · investiční transfery":"result · reimbursements · capital transfers", "Historická řada bude publikována po účetních jednotkách. Agregace nebudou sčítat vzájemné transfery dvakrát.":"Historical series are published by accounting entity. Aggregates do not count internal transfers twice.",
    "{n} / Data & metodika":"{n} / Data & methodology", "Bez dvojího":"No double", "započítání.":"counting.", "Účetní výsledek":"Accounting result", "Zisk nebo ztráta po zdanění za jednotlivý subjekt. Není automaticky příjmem státního rozpočtu.":"Profit or loss after tax for an individual entity. It is not automatically state-budget revenue.", "Odvod vlastníkovi":"Payment to the owner", "Dividenda nebo odvod do fondu zakladatele v daném roce. Načasování se může lišit od roku, kdy zisk vznikl.":"A dividend or payment to the founder's fund in a given year. Timing may differ from the year in which the profit arose.", "Veřejné transfery":"Public transfers", "Dotace a platby ze státních fondů vedeme odděleně, aby se při pohledu na celý stát nezapočítaly jako nový příjem.":"Subsidies and payments from state funds remain separate so they are not counted as new income in a whole-of-state view.", "Srovnatelný rozsah":"Comparable scope", "Firmy, vysoké školy a nemocnice budou mít vlastní kohorty; právní forma ani veřejné poslání nejsou zaměnitelné.":"Companies, universities and hospitals have their own cohorts; legal form and public mission are not interchangeable.",
    "Česko · stát jako vlastník":"Czechia · the state as owner", "Zdroj: Ministerstvo financí ČR · data za rok {n}":"Source: Czech Ministry of Finance · {n} data", "Nahoru ↑":"Back to top ↑", "Pro načtení žebříčků je potřeba zapnout JavaScript.":"JavaScript is required to load the rankings."
  };

  // A5 + B5 — figures are never part of a key. Where a string carries a number the key
  // holds a {n} placeholder, so the translation survives the data changing underneath it;
  // the value passes through, reformatted for English (2 427,8 becomes 2,427.8).
  const NUMBER = /\d+(?:[   ,.]\d+)*/g;

  function toEnglishNumber(token) {
    if (/^\d+$/.test(token)) return token; // a year or a plain count stays as written
    const czechDecimal = /,\d+$/.test(token);
    const normalised = czechDecimal
      ? token.replace(/[   ]/g, "").replace(",", ".")
      : token.replace(/[   ,]/g, "");
    const value = Number(normalised);
    if (!Number.isFinite(value)) return token;
    const decimals = (normalised.split(".")[1] || "").length;
    return value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function translate(trimmed) {
    if (csToEn[trimmed]) return csToEn[trimmed];
    const figures = trimmed.match(NUMBER);
    if (!figures) return null;
    const template = csToEn[trimmed.replace(NUMBER, "{n}")];
    if (!template) return null;
    let index = 0;
    return template.replace(/\{n\}/g, () => {
      const token = figures[index++];
      return token === undefined ? "" : toEnglishNumber(token);
    });
  }

  function translateTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue;
      const trimmed = text.trim();
      const rendered = trimmed && translate(trimmed);
      if (rendered) walker.currentNode.nodeValue = text.replace(trimmed, rendered);
    }
    root.querySelectorAll?.("[aria-label]").forEach((node) => {
      const value = node.getAttribute("aria-label");
      const rendered = value && translate(value);
      if (rendered) node.setAttribute("aria-label", rendered);
    });
    const search = root.querySelector?.("#entity-search");
    if (search) search.placeholder = "e.g. university, hospital, ČEZ";
  }

  document.querySelectorAll("[data-lang]").forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => {
      const url = new URL(location.href);
      url.searchParams.set("lang", button.dataset.lang);
      location.href = url;
    });
  });
  document.querySelector(".lang-switch")?.setAttribute("aria-label", lang === "en" ? "Language" : "Jazyk");
  if (lang === "en") translateTree(document.body);
  const structured = document.querySelector('script[type="application/ld+json"]');
  if (lang === "en" && structured) {
    try {
      const data = JSON.parse(structured.textContent);
      Object.assign(data, { name:"Czechia: the state as owner, 2024", description:"Financial results and payments to the state by 38 strategic state-controlled companies and organisations.", inLanguage:"en" });
      if (data.spatialCoverage) data.spatialCoverage.name = "Czechia";
      structured.textContent = JSON.stringify(data);
    } catch {}
  }
  // This runs on every load, so it must not persist: a merely defaulted value
  // written here would pin this route's default as the sitewide preference.
  dispatchEvent(new CustomEvent("psdlanguagechange", { detail: { lang } }));
  window.psdLanguageReady?.();
})();
