(() => {
  const datasetUrl = "../../data/cz-public-employment.v1.json?v=1.4.0";
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const locale = lang === "en" ? "en-GB" : "cs-CZ";
  const copy = {
    cs: {
      eyebrow: "Report / Veřejná zaměstnanost",
      titleLead: "Kdo pracuje",
      titleEm: "pro český veřejný sektor",
      intro: "Ministerstva jsou jen začátek. Jedna hranice spojuje úřady, školy, nemocnice, samosprávy, infrastrukturu i veřejné podniky — bez dvojího započtení.",
      heroLabel: "Veřejný sektor celkem",
      heroUnit: "FTE · 2024 · oficiální kontrolní součet",
      heroShare: "všech pracovních míst v ekonomice",
      navHistory: "Vývoj",
      navGrowth: "Růst",
      navExplorer: "Celá mapa",
      navBoundary: "Hranice",
      navLayers: "Detail",
      navEntities: "Subjekty",
      navMethod: "Metodika",
      historyKicker: "Desetiletá řada",
      historyTitle: "O 121 744 veřejných FTE více než v roce 2015",
      historyIntro: "ČSÚ měří pracovní místa v přepočtených osobách. Řada je srovnatelná v čase a zahrnuje všechny institucionální jednotky kontrolované vládními institucemi.",
      chartTitle: "Pracovní místa podle institucionálního sektoru",
      publicSector: "Veřejný sektor",
      generalGovernment: "Vládní instituce",
      publicCorporations: "Veřejné korporace",
      year: "Rok",
      share: "Podíl",
      growthKicker: "Kam šel růst",
      growthTitle: "98,5 % nových veřejných FTE vzniklo uvnitř vládních institucí",
      growthIntro: "Mezi roky 2015 a 2024 přibylo 121 744 veřejných FTE. Vládní instituce vysvětlují 119 974; veřejné korporace pouze 1 770. To je přesný, plně srovnatelný rozklad.",
      growthSplitTitle: "Rozdělení přírůstku veřejného sektoru",
      growthAria: "Rozdělení růstu veřejné zaměstnanosti mezi vládní instituce a veřejné korporace",
      growthExact: "přesný přírůstek",
      growthReadingTitle: "Téměř celý čistý nárůst je vláda, ne firmy",
      growthReadingBody: "Vládní instituce přidaly {government} FTE, zatímco veřejné korporace skončily jen o {corporations} FTE výše. Korporace tedy nebyly motorem desetiletého růstu.",
      growthLimitTitle: "Zde končí přesný rozpad 121 744 FTE",
      growthLimitBody: "ČSÚ pod sektorem S.13 nezveřejňuje pro roky 2015–2024 sčitatelný počet FTE podle ministerstva, funkce ani zaměstnavatele. Následující panely jsou samostatné výkazy — nejsou dalšími větvemi tohoto součtu.",
      accountingKicker: "Samostatný výkaz 2015–2024",
      accountingTitle: "Ve vládou regulované sféře přibylo 64 633 zaměstnanců",
      accountingIntro: "Stejná tabulka Ministerstva financí za roky 2015 a 2024 rozděluje změnu beze zbytku. Ukazuje růst školství, bezpečnostních sborů a příspěvkových organizací i pokles civilních zaměstnanců státu.",
      accountingCaveat: "Tento rozpad se přesně sčítá uvnitř vládou regulované sféry. Není však úplným rozkladem sektoru S.13: jiné veřejné jednotky leží mimo tento rozpočtový výkaz.",
      stateRegulated: "Vládou regulovaná sféra",
      comparedTotal: "srovnávaný celek",
      growthChange: "Změna",
      ofComparedGrowth: "z přírůstku v tomto řezu",
      schoolKicker: "Širší desetiletý pohled",
      schoolTitle: "Regionální školství: +65 899 FTE",
      schoolIntro: "Samostatná řada MŠMT zahrnuje všechny zřizovatele: přibylo 56 743 pedagogických a 9 156 nepedagogických FTE.",
      schoolCaveat: "Řada zahrnuje veřejné, soukromé i církevní školy. Proto potvrzuje motor růstu, ale nelze ji odečíst od sektoru S.13.",
      professionKicker: "Uvnitř školství",
      professionTitle: "Které profese rostly v letech 2020–2024",
      professionIntro: "Novější tabulka MŠMT umožňuje rozdělit pedagogický přírůstek až na jednotlivé profese.",
      professionCaveat: "Školští logopedi byli v roce 2024 poprvé vykázáni samostatně; jejich 45,4 FTE proto není označeno jako čistý přírůstek.",
      newlyReported: "nově vykázáno",
      pedagogical: "Pedagogičtí pracovníci",
      nonpedagogical: "Nepedagogičtí zaměstnanci",
      schoolTotal: "Regionální školství celkem",
      costKicker: "Kolik to stálo",
      costTitle: "Průměrný náklad zaměstnavatele vzrostl na 68 194 Kč za FTE měsíčně",
      costIntro: "Kompenzace zaměstnanců D.1 zahrnuje hrubé mzdy a platy i sociální příspěvky zaměstnavatele. Není to čistá mzda zaměstnance.",
      costChartTitle: "Průměrná měsíční kompenzace na FTE",
      costAria: "Průměrná měsíční kompenzace zaměstnavatele na jeden FTE nominálně a v cenách roku 2015",
      nominal: "Nominálně",
      real2015: "V cenách roku 2015",
      costFunctionKicker: "Úplný nákladový rozpad",
      functionTitle: "Kam šlo dalších 377,9 mld. Kč",
      functionUnit: "kompenzace zaměstnanců podle funkce · 2015 → 2024",
      salaryTitle: "Hrubý měsíční plat ve státní sféře",
      salaryUnit: "2015 → 2024 · Kč",
      costCaveat: "Funkční rozpad měří růst mzdových nákladů, nikoli počtu lidí: kombinuje více FTE, vyšší platy a příspěvky. Po očištění spotřebitelskou inflací vzrostl průměrný náklad na FTE o 12,5 %.",
      totalCompensation: "Kompenzace celkem",
      monthlyEmployerCost: "Náklad na FTE / měsíc",
      realMonthlyCost: "Reálný náklad / měsíc",
      employerContributions: "Příspěvky zaměstnavatele",
      czkBn: "mld. Kč",
      czkM: "mil. Kč",
      versus2015: "proti 2015",
      in2015Prices: "v cenách 2015",
      ofCompensation: "kompenzace 2024",
      explorerKicker: "Úplná rekonciliace",
      explorerTitle: "Kam patří všech 1 112 290 veřejných FTE",
      explorerIntro: "Jediný kruh rozděluje celý kontrolní součet bez překryvu. Funkční členění vládních institucí je transparentní model podle oficiálních podílů nákladů; veřejné korporace a celkové součty zůstávají přesné.",
      mapExactFrame: "Jediný sčitatelný rámec",
      mapExactRule: "Tyto dvě části jsou vzájemně výlučné a dávají přesný veřejný sektor.",
      mapGrowth: "změna od 2015",
      mapSourceLenses: "Zdrojové čočky uvnitř rámce — překrývají se, nepřičítají se",
      mapLensRule: "Každý člověk je v kontrolním součtu jen jednou. Níže je znovu popsán podle dostupného výkazu; čísla mezi čočkami nelze sčítat ani odečítat.",
      mapStateLens: "Rozpočtová státní sféra",
      mapEducationLens: "Regionální školství — stejných 301 048 FTE ve dvou osách",
      mapLocalLens: "Místní a krajská administrativa — neúplné pokrytí",
      mapPortfolioLens: "38 strategických subjektů — portfolio, nikoli celý podnikový sektor",
      mapProfessionAxis: "Osa A · profese",
      mapSchoolAxis: "Osa B · typ školy",
      mapSamePeople: "Stejný celek — nepřičítat podruhé",
      mapObserved: "přímo pozorováno",
      mapUnallocated: "Nevysvětlený zbytek se nepočítá odčítáním",
      mapUnallocatedBody: "Bez jednotného IČO/FTE převodníku nelze přesně určit, které řádky čoček patří do vládních institucí a které do veřejných korporací. Proto zde nevzniká falešný reziduál.",
      mapCostLayer: "Nákladová vrstva · nikoli další lidé",
      mapCostRule: "Kompenzace podle funkce vysvětlují peníze, ne rozdělení osob.",
      mapEntities: "subjektů",
      explorerRule: "Vždy je aktivní právě jeden datový celek. Čísla z horního přepínače se navzájem nikdy nesčítají.",
      explorerDataset: "Datový celek",
      explorerSelectedDataset: "Vybraný datový celek",
      explorerDatasetTotal: "Celkem v tomto výkazu",
      explorerOnlyAdd: "Pouze položky níže se sčítají",
      explorerEquation: "Kontrola součtu",
      explorerRowsSum: "položek dává součet",
      explorerExact: "sedí přesně",
      explorerRounded: "sedí v mezích zaokrouhlení zdroje",
      explorerNoBreakdown: "Zdroj pod touto položkou nezveřejňuje další sčitatelný rozpad.",
      explorerBreakdown: "Rozpad",
      explorerOfScope: "z celku aktivního výkazu",
      explorerOpen: "Kliknutím rozbalit",
      explorerLeaf: "Nejnižší dostupný detail",
      explorerDetails: "Detail vybrané skupiny",
      explorerChange: "Změna",
      explorerPrevious: "Předchozí hodnota",
      explorerGrossPay: "Průměrná hrubá mzda / plat",
      explorerPriorPay: "Předchozí mzda / plat",
      explorerPersons: "Osob během roku",
      explorerWomen: "Ženy",
      explorerMen: "Muži",
      explorerPayroll: "Hrubé platy celkem",
      explorerLeaders: "S příplatkem za vedení",
      explorerTurnover: "Obrat",
      explorerAssets: "Aktiva",
      explorerResult: "Čistý výsledek",
      explorerOwnerTransfer: "Příjem vlastníka",
      explorerNonfinancial: "Nefinanční podniky",
      explorerFinancial: "Finanční instituce",
      explorerSource: "Otevřít oficiální zdroj",
      explorerRows: "Jediné sčitatelné položky pod",
      explorerCategory: "Skupina",
      explorerValue: "Počet",
      explorerStatus: "Stav",
      explorerDrill: "Otevřít",
      control_total: "kontrolní součet",
      portfolio: "portfolio",
      derived: "dopočet",
      working_classification: "pracovní klasifikace",
      persons_during_year: "osob během roku",
      boundaryKicker: "Účetní hranice",
      boundaryTitle: "947 878 uvnitř vlády. 164 412 ve veřejných korporacích.",
      boundaryIntro: "Veřejný sektor je širší než státní rozpočet. Tržní firmy kontrolované státem, krajem nebo obcí jsou mimo sektor vládních institucí, ale uvnitř veřejného sektoru.",
      derivedNote: "ČSÚ za rok 2024 publikuje celkový veřejný sektor a vládní instituce. Hodnota veřejných korporací je proto přesný reziduál těchto dvou oficiálních hodnot; samostatné nefinanční a finanční složky jsou naposledy zveřejněny za rok 2023.",
      layersKicker: "Zdrojové vrstvy",
      layersTitle: "Čtyři detailní pohledy. Ani jeden není další zaměstnanec.",
      layersIntro: "Každá karta řeže stejný veřejný sektor jinak. Školství se překrývá s příspěvkovými organizacemi, samosprávy jsou neúplné a podniky používají osoby místo FTE.",
      noSum: "Karty se nesčítají. Slouží k vysvětlení kontrolního součtu 1 112 290 FTE a každá si zachovává vlastní jednotku, rozsah a pokrytí.",
      entitiesKicker: "Od součtu k organizaci",
      entitiesTitle: "18 238 jmen. Zatím 38 přímých údajů o zaměstnanosti.",
      entitiesIntro: "Konsolidační registr dává IČO a úplný seznam veřejných jednotek, nikoli počet zaměstnanců. Další krok je spojovat resortní výkazy a výroční zprávy přes IČO a zbytek ponechat jako nepřiřazený — ne jako nulu.",
      download: "Stáhnout auditovatelný JSON ↓",
      methodKicker: "Metodika",
      methodTitle: "Jeden kontrolní součet. Mnoho nepřičitatelných důkazů.",
      methodIntro: "Přepočtené osoby, fyzické osoby, systemizovaná místa a rozpočtované pozice nejsou zaměnitelné. Datový kontrakt je proto uchovává odděleně.",
      ofEconomy: "ekonomiky",
      ofPublicSector: "veřejného sektoru",
      change: "Změna od 2015",
      control: "Kontrolní součet",
      official: "oficiální",
      partial: "částečné",
      persons: "osob",
      average_employees: "průměrných zaměstnanců",
      FTE: "FTE",
      coverage: "Pokrytí",
      notAdd: "nepřičítat",
      registered: "Subjektů v registru",
      observed: "S přímým headcountem",
      missing: "Bez zaměstnaneckého pole",
      join: "Spojovací klíč",
      methodCards: [
        ["01", "Kontrolní součet", "ČSÚ satelitní účet určuje celkový počet FTE a institucionální hranici."],
        ["02", "Jednotky zůstávají oddělené", "FTE, osoby a průměrný počet zaměstnanců se bez převodního údaje nemíchají."],
        ["03", "Reziduál je viditelný", "Nevysvětlená část zůstává nepřiřazená. Chybějící údaj nikdy není nula."],
      ],
      loadError: "Data veřejné zaměstnanosti se nepodařilo načíst.",
    },
    en: {
      eyebrow: "Report / Public employment",
      titleLead: "Who works",
      titleEm: "for the Czech public sector",
      intro: "Ministries are only the beginning. One boundary joins authorities, schools, hospitals, local government, infrastructure and public corporations—without double counting.",
      heroLabel: "Total public sector",
      heroUnit: "FTE · 2024 · official control total",
      heroShare: "of all jobs in the economy",
      navHistory: "History",
      navGrowth: "Growth",
      navExplorer: "Full map",
      navBoundary: "Boundary",
      navLayers: "Detail",
      navEntities: "Entities",
      navMethod: "Method",
      historyKicker: "Ten-year series",
      historyTitle: "121,744 more public-sector FTE than in 2015",
      historyIntro: "CZSO measures jobs in full-time equivalents. The series is comparable over time and includes every institutional unit controlled by government.",
      chartTitle: "Jobs by institutional sector",
      publicSector: "Public sector",
      generalGovernment: "General government",
      publicCorporations: "Public corporations",
      year: "Year",
      share: "Share",
      growthKicker: "Where the growth went",
      growthTitle: "98.5% of new public-sector FTE appeared inside general government",
      growthIntro: "Between 2015 and 2024, the public sector added 121,744 FTE. General government explains 119,974; public corporations just 1,770. This is the exact, like-for-like split.",
      growthSplitTitle: "Split of the public-sector increase",
      growthAria: "Public-employment growth split between general government and public corporations",
      growthExact: "exact increase",
      growthReadingTitle: "Almost all net growth is government, not corporations",
      growthReadingBody: "General government added {government} FTE while public corporations ended just {corporations} FTE higher. Corporations were not the engine of the decade's growth.",
      growthLimitTitle: "This is where the exact 121,744-FTE breakdown ends",
      growthLimitBody: "Below S.13, CZSO does not publish an additive 2015–2024 FTE split by ministry, function or employer. The panels that follow are independent returns—not further branches of this total.",
      accountingKicker: "Separate 2015–2024 return",
      accountingTitle: "The state-regulated sphere added 64,633 employees",
      accountingIntro: "The same Ministry of Finance table for 2015 and 2024 allocates the change completely. It shows growth in education, security forces and contributory organisations—and a decline in civil state employment.",
      accountingCaveat: "This breakdown adds exactly inside the state-regulated sphere. It is not a complete decomposition of ESA sector S.13: other public units sit outside this budget return.",
      stateRegulated: "State-regulated sphere",
      comparedTotal: "compared total",
      growthChange: "Change",
      ofComparedGrowth: "of growth in this view",
      schoolKicker: "Broader ten-year view",
      schoolTitle: "Regional education: +65,899 FTE",
      schoolIntro: "A separate Ministry of Education series covers every founder: schools added 56,743 pedagogical and 9,156 non-pedagogical FTE.",
      schoolCaveat: "The series includes public, private and church schools. It confirms the growth driver but cannot be subtracted from sector S.13.",
      professionKicker: "Inside education",
      professionTitle: "Which professions grew from 2020 to 2024",
      professionIntro: "The newer Ministry of Education table splits pedagogical growth into individual professions.",
      professionCaveat: "School speech therapists were first reported separately in 2024; their 45.4 FTE are therefore not labelled as a net increase.",
      newlyReported: "newly reported",
      pedagogical: "Pedagogical workers",
      nonpedagogical: "Non-pedagogical workers",
      schoolTotal: "Regional education total",
      costKicker: "What it cost",
      costTitle: "Average employer cost rose to CZK 68,194 per FTE per month",
      costIntro: "D.1 compensation of employees includes gross wages and salaries plus employers' social contributions. It is not an employee's take-home pay.",
      costChartTitle: "Average monthly compensation per FTE",
      costAria: "Average monthly employer compensation per FTE in nominal and 2015 prices",
      nominal: "Nominal",
      real2015: "In 2015 prices",
      costFunctionKicker: "Complete cost breakdown",
      functionTitle: "Where the additional CZK 377.9bn went",
      functionUnit: "employee compensation by function · 2015 → 2024",
      salaryTitle: "Gross monthly pay in the state sphere",
      salaryUnit: "2015 → 2024 · CZK",
      costCaveat: "The functional split measures growth in employment costs, not people: it combines more FTE, higher pay and contributions. After consumer-price inflation, average cost per FTE increased 12.5%.",
      totalCompensation: "Total compensation",
      monthlyEmployerCost: "Cost per FTE / month",
      realMonthlyCost: "Real cost / month",
      employerContributions: "Employer contributions",
      czkBn: "CZK bn",
      czkM: "CZK m",
      versus2015: "versus 2015",
      in2015Prices: "in 2015 prices",
      ofCompensation: "of 2024 compensation",
      explorerKicker: "Complete reconciliation",
      explorerTitle: "Where all 1,112,290 public-sector FTE belong",
      explorerIntro: "One circle allocates the entire control total without overlap. The functional split of general government is a transparent model based on official compensation shares; public corporations and the top-level totals remain exact.",
      mapExactFrame: "The only additive frame",
      mapExactRule: "These two parts are mutually exclusive and exactly equal the public sector.",
      mapGrowth: "change since 2015",
      mapSourceLenses: "Source lenses inside the frame — overlapping, never additive",
      mapLensRule: "Every worker is counted once in the control total. Below, the same workforce is described again through available returns; values across lenses cannot be added or subtracted.",
      mapStateLens: "State-budget workforce",
      mapEducationLens: "Regional education — the same 301,048 FTE on two axes",
      mapLocalLens: "Local and regional administration — partial coverage",
      mapPortfolioLens: "38 strategic entities — a portfolio, not the whole corporate sector",
      mapProfessionAxis: "Axis A · profession",
      mapSchoolAxis: "Axis B · school type",
      mapSamePeople: "Same total — do not count twice",
      mapObserved: "directly observed",
      mapUnallocated: "The unexplained remainder is not calculated by subtraction",
      mapUnallocatedBody: "Without a common entity-ID/FTE crosswalk, we cannot determine exactly which lens rows belong to general government and which belong to public corporations. No false residual is created here.",
      mapCostLayer: "Cost layer · not additional people",
      mapCostRule: "Compensation by function explains money, not the allocation of workers.",
      mapEntities: "entities",
      explorerRule: "Exactly one dataset is active at a time. The numbers in the selector are never added to one another.",
      explorerDataset: "Dataset",
      explorerSelectedDataset: "Selected dataset",
      explorerDatasetTotal: "Total in this return",
      explorerOnlyAdd: "Only the rows below are additive",
      explorerEquation: "Reconciliation check",
      explorerRowsSum: "rows sum to",
      explorerExact: "exact match",
      explorerRounded: "matches within source rounding",
      explorerNoBreakdown: "The source publishes no deeper additive breakdown below this item.",
      explorerBreakdown: "Breakdown",
      explorerOfScope: "of the active dataset total",
      explorerOpen: "Click to drill down",
      explorerLeaf: "Lowest available detail",
      explorerDetails: "Selected-group detail",
      explorerChange: "Change",
      explorerPrevious: "Previous value",
      explorerGrossPay: "Average gross monthly pay",
      explorerPriorPay: "Previous pay",
      explorerPersons: "People during the year",
      explorerWomen: "Women",
      explorerMen: "Men",
      explorerPayroll: "Total gross payroll",
      explorerLeaders: "Management allowance",
      explorerTurnover: "Turnover",
      explorerAssets: "Assets",
      explorerResult: "Net result",
      explorerOwnerTransfer: "Owner transfer",
      explorerNonfinancial: "Non-financial corporations",
      explorerFinancial: "Financial corporations",
      explorerSource: "Open official source",
      explorerRows: "Only additive rows under",
      explorerCategory: "Group",
      explorerValue: "Count",
      explorerStatus: "Status",
      explorerDrill: "Open",
      control_total: "control total",
      portfolio: "portfolio",
      derived: "derived",
      working_classification: "working classification",
      persons_during_year: "people during year",
      boundaryKicker: "Accounting boundary",
      boundaryTitle: "947,878 inside government. 164,412 in public corporations.",
      boundaryIntro: "The public sector is broader than the state budget. Market producers controlled by central, regional or local government sit outside general government but inside the public sector.",
      derivedNote: "For 2024 CZSO publishes total public sector and general government. Public corporations are therefore the exact residual of those two official values; separate non-financial and financial components were last published for 2023.",
      layersKicker: "Source layers",
      layersTitle: "Four detailed views. None is an extra employee.",
      layersIntro: "Each card slices the same public sector differently. Education overlaps contributory organisations, local reporting is incomplete, and companies report persons rather than FTE.",
      noSum: "Do not add the cards. They explain the 1,112,290 FTE control total while retaining their own unit, scope and coverage.",
      entitiesKicker: "From total to organisation",
      entitiesTitle: "18,238 names. So far, 38 direct employment observations.",
      entitiesIntro: "The consolidation register provides IDs and a complete public-unit roster, not employee counts. The next step is joining ministry returns and annual reports by ID and leaving the remainder unallocated—not zero.",
      download: "Download auditable JSON ↓",
      methodKicker: "Method",
      methodTitle: "One control total. Many non-additive pieces of evidence.",
      methodIntro: "Full-time equivalents, persons, established posts and budgeted positions are not interchangeable. The data contract keeps them separate.",
      ofEconomy: "of the economy",
      ofPublicSector: "of the public sector",
      change: "Change since 2015",
      control: "Control total",
      official: "official",
      partial: "partial",
      persons: "persons",
      average_employees: "average employees",
      FTE: "FTE",
      coverage: "Coverage",
      notAdd: "do not add",
      registered: "Entities in register",
      observed: "With direct headcount",
      missing: "No employee field",
      join: "Join key",
      methodCards: [
        ["01", "Control total", "The CZSO satellite account fixes the total FTE and institutional boundary."],
        ["02", "Units stay separate", "FTE, persons and average employees are not mixed without a conversion factor."],
        ["03", "The residual stays visible", "Unexplained employment remains unallocated. A missing value is never zero."],
      ],
      loadError: "Public-employment data could not be loaded.",
    },
  }[lang];

  document.querySelectorAll("[data-emp-copy]").forEach((node) => {
    if (copy[node.dataset.empCopy]) node.textContent = copy[node.dataset.empCopy];
  });
  window.psdLanguageReady?.();

  const $ = (selector) => document.querySelector(selector);
  const fmt = (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const pct = (value) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const bn = (value) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1000);
  const fmtCount = (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
  const signedCount = (value) => `${value > 0 ? "+" : ""}${fmtCount(value)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const sourceMap = (data) => Object.fromEntries(data.sources.map((source) => [source.id, source]));
  const reconciliationCopy = {
    cs: {
      corporations: "Veřejné korporace",
      corporationsExact: "přesný počet",
      educationModel: "Vzdělávání · model v S.13",
      educationDirect: "Přímý výkaz MŠMT: {value} FTE",
      missing: "Dříve nevysvětlený blok",
      missingNote: "devět funkcí mimo vzdělávání",
      pieTitle: "Všech {value} FTE — bez duplicit",
      pieUnit: "FTE · započteno jednou",
      function: "Funkce",
      model2015: "Model 2015",
      model2024: "Model 2024",
      change: "Změna",
      stackKicker: "Stohovatelný zoom",
      stackTitle: "Jak se složení posunulo od roku 2015",
      stackIntro: "Oba pruhy dávají přesný veřejný sektor. Korporace jsou přímo pozorované; funkce vlády jsou rozdělené podle podílu na kompenzacích zaměstnanců v daném roce.",
      selected: "Vybraná funkce",
      fte2015: "2015",
      fte2024: "2024",
      cost2024: "Náklad 2024",
      costChange: "Nárůst nákladu",
      directCheck: "Nejbližší přímý výkaz",
      methodTitle: "Co je přesné a co je model",
      methodBody: "ČSÚ publikuje přesný celkový počet FTE pro veřejný sektor a vládní instituce, ale nikoli FTE podle funkcí COFOG. Funkční řezy proto alokují přesný počet vládních FTE podle oficiálních podílů kompenzací zaměstnanců. Je to úplný, neduplicitní odhad — nikoli pozorovaný počet lidí v každé funkci.",
      exact: "přesně",
      modelled: "model",
      exactNote: "Přímo pozorovaná a srovnatelná řada ČSÚ.",
      modelNote: "Odhad FTE z podílu funkce na kompenzacích zaměstnanců.",
      noDirect: "Pro tuto funkci není zveřejněn srovnatelný sčitatelný výkaz FTE. Zobrazený vývoj je model podle nákladových podílů.",
      educationCheck: "MŠMT napříč všemi zřizovateli: {from} → {to} FTE, tedy {change}. Širší hranice zahrnuje veřejné, soukromé i církevní školy.",
      corporationsCheck: "ČSÚ: {from} → {to} FTE, tedy {change}. Jde o přesný, srovnatelný vývoj veřejných korporací.",
      securityCheck: "MF, užší překryv členů bezpečnostních sborů a vojáků: {from} → {to} průměrných zaměstnanců, tedy {change}.",
      source: "Zdroj",
    },
    en: {
      corporations: "Public corporations",
      corporationsExact: "exact count",
      educationModel: "Education · model inside S.13",
      educationDirect: "Direct MŠMT return: {value} FTE",
      missing: "Previously unexplained block",
      missingNote: "nine functions outside education",
      pieTitle: "All {value} FTE — no duplicates",
      pieUnit: "FTE · counted once",
      function: "Function",
      model2015: "Model 2015",
      model2024: "Model 2024",
      change: "Change",
      stackKicker: "Stackable zoom",
      stackTitle: "How the composition shifted from 2015",
      stackIntro: "Both bars equal the exact public-sector total. Corporations are observed directly; government functions are allocated using their share of employee compensation in each year.",
      selected: "Selected function",
      fte2015: "2015",
      fte2024: "2024",
      cost2024: "2024 cost",
      costChange: "Cost increase",
      directCheck: "Nearest direct return",
      methodTitle: "What is exact and what is modelled",
      methodBody: "CZSO publishes exact total FTE for the public sector and general government, but not FTE by COFOG function. The functional slices therefore allocate the exact government FTE using official employee-compensation shares. This is a complete, non-duplicated estimate—not an observed employee count for every function.",
      exact: "exact",
      modelled: "modelled",
      exactNote: "Directly observed, comparable CZSO series.",
      modelNote: "FTE estimate based on the function’s share of employee compensation.",
      noDirect: "No comparable additive FTE return is published for this function. The displayed change is modelled from compensation shares.",
      educationCheck: "MŠMT across all founders: {from} → {to} FTE, a change of {change}. Its broader boundary includes public, private and church schools.",
      corporationsCheck: "CZSO: {from} → {to} FTE, a change of {change}. This is the exact comparable public-corporation series.",
      securityCheck: "MF's narrower overlapping return for security-force members and soldiers: {from} → {to} average employees, a change of {change}.",
      source: "Source",
    },
  }[lang];

  function allocateByWeight(total, rows, weightKey) {
    const weightTotal = rows.reduce((sum, row) => sum + row[weightKey], 0);
    const allocated = rows.map((row) => {
      const raw = total * row[weightKey] / weightTotal;
      return { id: row.id, value: Math.floor(raw), remainder: raw - Math.floor(raw) };
    });
    let remaining = total - allocated.reduce((sum, row) => sum + row.value, 0);
    [...allocated].sort((a, b) => b.remainder - a.remainder).slice(0, remaining).forEach((row) => { row.value += 1; });
    return Object.fromEntries(allocated.map((row) => [row.id, row.value]));
  }

  function renderReconciledWorkforce(data) {
    const target = $("#employment-reconciliation");
    if (!target) return;
    const first = data.history[0];
    const latest = data.history.at(-1);
    const functions = data.compensation.change_by_function;
    const fte2015 = allocateByWeight(first.general_government_fte, functions, "compensation_2015_czk_m");
    const fte2024 = allocateByWeight(latest.general_government_fte, functions, "compensation_2024_czk_m");
    const label = (row) => row[lang === "en" ? "label_en" : "label_cs"];
    const toneOrder = ["education", "health", "public_corporations", "general_public_services", "public_order", "economic_affairs", "social_protection", "defence", "recreation_culture", "environment", "housing"];
    const items = functions.map((row) => ({
      ...row,
      name: label(row),
      fte2015: fte2015[row.id],
      fte2024: fte2024[row.id],
      exact: false,
    }));
    items.push({
      id: "public_corporations",
      name: reconciliationCopy.corporations,
      fte2015: first.public_corporations_combined_fte,
      fte2024: latest.public_corporations_combined_fte,
      compensation_2015_czk_m: null,
      compensation_2024_czk_m: null,
      change_czk_m: null,
      exact: true,
    });
    items.forEach((item) => {
      item.changeFte = item.fte2024 - item.fte2015;
      item.tone = toneOrder.indexOf(item.id);
    });
    const ordered = toneOrder.map((id) => items.find((item) => item.id === id));
    const ranked = [...items].sort((a, b) => b.fte2024 - a.fte2024);
    const education = items.find((item) => item.id === "education");
    const corporations = items.find((item) => item.id === "public_corporations");
    const missing = latest.public_sector_fte - education.fte2024 - corporations.fte2024;
    const maxFte = Math.max(...items.map((item) => item.fte2024));
    const radius = 154;
    const inner = 82;
    const cx = 190;
    const cy = 190;
    const polar = (angle, r) => [cx + Math.cos(angle - Math.PI / 2) * r, cy + Math.sin(angle - Math.PI / 2) * r];
    const arc = (start, end) => {
      const [x1, y1] = polar(start, radius);
      const [x2, y2] = polar(end, radius);
      const [ix2, iy2] = polar(end, inner);
      const [ix1, iy1] = polar(start, inner);
      return `M${x1},${y1}A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2},${y2}L${ix2},${iy2}A${inner},${inner} 0 ${end - start > Math.PI ? 1 : 0} 0 ${ix1},${iy1}Z`;
    };
    let angle = 0;
    const slices = ordered.map((item) => {
      const start = angle;
      angle += item.fte2024 / latest.public_sector_fte * Math.PI * 2;
      return `<path class="tone-recon-${item.tone}" data-recon-id="${item.id}" d="${arc(start, angle)}"><title>${esc(item.name)}: ${fmt(item.fte2024)} FTE · ${item.exact ? reconciliationCopy.exact : reconciliationCopy.modelled}</title></path>`;
    }).join("");
    const segment = (item, field, total) => `<i class="tone-recon-${item.tone}" data-recon-id="${item.id}" style="width:${item[field] / total * 100}%" title="${esc(item.name)}: ${fmt(item[field])} FTE"></i>`;
    const stack = (year, field, total) => `<div class="recon-stack-row"><b>${year}</b><div class="recon-stack-bar">${ordered.map((item) => segment(item, field, total)).join("")}</div><strong>${fmt(total)} FTE</strong></div>`;
    const rows = ranked.map((item) => `<button class="recon-row" type="button" data-recon-id="${item.id}" aria-pressed="false"><span class="recon-row-name"><span class="recon-row-label"><i class="recon-swatch tone-recon-${item.tone}"></i>${esc(item.name)}</span><span class="recon-track"><i class="tone-recon-${item.tone}" style="width:${item.fte2024 / maxFte * 100}%"></i></span></span><strong>${item.exact ? "" : "≈"}${fmt(item.fte2015)}</strong><strong>${item.exact ? "" : "≈"}${fmt(item.fte2024)}</strong><strong class="change ${item.changeFte < 0 ? "negative" : "positive"}">${item.exact ? "" : "≈"}${signedCount(item.changeFte)}</strong></button>`).join("");
    target.innerHTML = `
      <div class="recon-summary">
        <article><span>${reconciliationCopy.corporations} · ${reconciliationCopy.corporationsExact}</span><strong>${fmt(corporations.fte2024)} FTE</strong><small>${fmt(corporations.fte2015)} → ${fmt(corporations.fte2024)}</small></article>
        <article><span>${reconciliationCopy.educationModel}</span><strong>≈${fmt(education.fte2024)} FTE</strong><small>${reconciliationCopy.educationDirect.replace("{value}", fmt(data.growth.regional_education_evidence.total_fte_to))}</small></article>
        <article><span>${reconciliationCopy.missing}</span><strong>≈${fmt(missing)} FTE</strong><small>${reconciliationCopy.missingNote}</small></article>
      </div>
      <div class="recon-main">
        <article class="recon-pie-panel"><div class="recon-panel-head"><div><span>2024</span><h3>${reconciliationCopy.pieTitle.replace("{value}", fmt(latest.public_sector_fte))}</h3></div><b>100 %</b></div><svg class="recon-pie" viewBox="0 0 380 380" role="img" aria-label="${esc(reconciliationCopy.pieTitle.replace("{value}", fmt(latest.public_sector_fte)))}">${slices}<text class="total" x="${cx}" y="${cy - 2}">${fmt(latest.public_sector_fte)}</text><text class="unit" x="${cx}" y="${cy + 20}">${reconciliationCopy.pieUnit}</text></svg></article>
        <div class="recon-breakdown"><div class="recon-table-head"><span>${reconciliationCopy.function}</span><span>${reconciliationCopy.model2015}</span><span>${reconciliationCopy.model2024}</span><span>${reconciliationCopy.change}</span></div>${rows}</div>
      </div>
      <article class="recon-zoom"><header class="recon-stack-head"><div><span>${reconciliationCopy.stackKicker}</span><h3>${reconciliationCopy.stackTitle}</h3></div><p>${reconciliationCopy.stackIntro}</p></header><div class="recon-stacks">${stack(first.year, "fte2015", first.public_sector_fte)}${stack(latest.year, "fte2024", latest.public_sector_fte)}</div><div class="recon-selected" id="recon-selected"></div><div class="recon-direct-check"><strong>${reconciliationCopy.directCheck}</strong><p id="recon-direct-copy"></p></div></article>
      <aside class="recon-method"><strong>${reconciliationCopy.methodTitle}</strong><p>${reconciliationCopy.methodBody}</p></aside>`;

    const selected = target.querySelector("#recon-selected");
    const direct = target.querySelector("#recon-direct-copy");
    const regulated = data.growth.state_regulated_comparison;
    const security = regulated.components.find((row) => row.id === "uniformed_soldiers");
    const directCopy = (item) => {
      if (item.id === "education") return reconciliationCopy.educationCheck.replace("{from}", fmt(data.growth.regional_education_evidence.total_fte_from)).replace("{to}", fmt(data.growth.regional_education_evidence.total_fte_to)).replace("{change}", signedCount(data.growth.regional_education_evidence.change_fte));
      if (item.id === "public_corporations") return reconciliationCopy.corporationsCheck.replace("{from}", fmt(item.fte2015)).replace("{to}", fmt(item.fte2024)).replace("{change}", signedCount(item.changeFte));
      if ((item.id === "public_order" || item.id === "defence") && security) return reconciliationCopy.securityCheck.replace("{from}", fmt(security.employees_2015)).replace("{to}", fmt(security.employees_2024)).replace("{change}", signedCount(security.change_employees));
      return reconciliationCopy.noDirect;
    };
    const select = (item) => {
      target.querySelectorAll("[data-recon-id]").forEach((node) => node.classList.toggle("dimmed", node.dataset.reconId !== item.id));
      target.querySelectorAll(".recon-row").forEach((node) => node.setAttribute("aria-pressed", node.dataset.reconId === item.id ? "true" : "false"));
      selected.innerHTML = `<div><span>${reconciliationCopy.selected}</span><strong>${esc(item.name)} · ${item.exact ? reconciliationCopy.exact : reconciliationCopy.modelled}</strong><p>${item.exact ? reconciliationCopy.exactNote : reconciliationCopy.modelNote}</p></div><div><span>${reconciliationCopy.fte2015}</span><strong>${item.exact ? "" : "≈"}${fmt(item.fte2015)}</strong></div><div><span>${reconciliationCopy.fte2024}</span><strong>${item.exact ? "" : "≈"}${fmt(item.fte2024)}</strong></div><div><span>${reconciliationCopy.cost2024}</span><strong>${item.compensation_2024_czk_m ? `${bn(item.compensation_2024_czk_m)} ${copy.czkBn}` : "—"}</strong></div><div><span>${reconciliationCopy.costChange}</span><strong>${item.change_czk_m ? `+${bn(item.change_czk_m)} ${copy.czkBn}` : "—"}</strong></div>`;
      direct.textContent = directCopy(item);
    };
    target.querySelectorAll("[data-recon-id]").forEach((node) => {
      node.addEventListener("click", () => select(items.find((item) => item.id === node.dataset.reconId)));
      if (node.tagName !== "BUTTON") node.addEventListener("mouseenter", () => select(items.find((item) => item.id === node.dataset.reconId)));
    });
    select(education);
    target.querySelectorAll("[data-recon-id]").forEach((node) => node.classList.remove("dimmed"));
  }

  function binaryTreemap(items, x = 0, y = 0, width = 100, height = 100) {
    if (!items.length) return [];
    if (items.length === 1) return [{ item: items[0], x, y, width, height }];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let split = 1;
    let running = items[0].value;
    while (split < items.length - 1 && running + items[split].value <= total / 2) {
      running += items[split].value;
      split += 1;
    }
    const first = items.slice(0, split);
    const second = items.slice(split);
    const ratio = running / total;
    if (width >= height) {
      return [...binaryTreemap(first, x, y, width * ratio, height), ...binaryTreemap(second, x + width * ratio, y, width * (1 - ratio), height)];
    }
    return [...binaryTreemap(first, x, y, width, height * ratio), ...binaryTreemap(second, x, y + height * ratio, width, height * (1 - ratio))];
  }

  function renderEmploymentExplorer(data) {
    const explorer = data.employment_explorer;
    const sources = sourceMap(data);
    const scope = (id) => explorer.scopes.find((item) => item.id === id);
    const publicScope = scope("public_sector");
    const stateScope = scope("state_regulated");
    const professionScope = scope("education_professions");
    const schoolScope = scope("education_school_types");
    const localScope = scope("local_administration");
    const portfolioScope = scope("strategic_entities");
    const label = (node) => node[lang === "en" ? "label_en" : "label_cs"];
    const unit = (node) => copy[node.unit] || node.unit;
    const sourceLink = (sourceScope) => sourceScope.source_ids.map((id) => sources[id]).filter(Boolean).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.publisher)} · ${esc(source.period)} ↗</a>`).join("");
    const row = (node, extra = "") => `<div class="unified-row"><span>${esc(label(node))}</span><strong>${fmtCount(node.value)} <small>${esc(unit(node))}</small></strong>${extra ? `<em>${extra}</em>` : ""}</div>`;
    const growth = Object.fromEntries(data.growth.state_regulated_comparison.components.map((item) => [item.id, item]));
    const stateGrowthIds = {
      state_regional_education: "regional_education",
      state_uniformed: "uniformed_soldiers",
      state_other_contributory: "other_contributory",
      state_prosecutors: "prosecutors",
      state_labour_service: "labour_service",
    };
    const stateExtra = (node) => {
      const item = growth[stateGrowthIds[node.id]];
      const pay = node.details?.average_monthly_gross_czk;
      return [item ? `${signedCount(item.change_employees)} · 2015→24` : "", pay ? `${fmt(pay)} CZK/${lang === "en" ? "month" : "měsíc"}` : ""].filter(Boolean).join(" · ");
    };
    const stateGroups = stateScope.root.children.map((group) => `<section><header><span>${esc(label(group))}</span><strong>${fmtCount(group.value)}</strong><small>${esc(unit(group))}</small></header>${group.children.map((item) => row(item, stateExtra(item))).join("")}</section>`).join("");
    const professionRows = [...professionScope.root.children[0].children, professionScope.root.children[1]].map((item) => row(item, item.details?.average_monthly_gross_czk ? `${fmt(item.details.average_monthly_gross_czk)} CZK/${lang === "en" ? "month" : "měsíc"}` : "")).join("");
    const schoolRows = schoolScope.root.children.map((item) => `<div class="unified-school-row"><span>${esc(label(item))}</span><strong>${fmtCount(item.value)}</strong><small>${item.children.map((part) => `${esc(label(part))} ${fmtCount(part.value)}`).join(" · ")}</small></div>`).join("");
    const localRows = localScope.root.children.map((item) => row(item)).join("");
    const portfolioRows = portfolioScope.root.children.map((sector) => sector.children?.length
      ? `<section class="unified-sector"><header><span>${esc(label(sector))}</span><strong>${fmtCount(sector.value)}</strong></header><div>${sector.children.map((entity) => `<article><span>${esc(label(entity))}</span><strong>${fmtCount(entity.value)}</strong><small>${entity.details?.ico ? `IČO ${esc(entity.details.ico)}` : ""}</small></article>`).join("")}</div></section>`
      : row(sector)).join("");
    const functions = data.compensation.change_by_function;
    const costRows = functions.map((item) => `<div class="unified-cost-row"><span>${esc(label(item))}</span><i><b style="width:${item.share_of_total_change_pct}%"></b></i><strong>+${bn(item.change_czk_m)} ${copy.czkBn}</strong><small>${pct(item.share_of_total_change_pct)} %</small></div>`).join("");
    const government = publicScope.root.children.find((item) => item.id === "general_government");
    const corporations = publicScope.root.children.find((item) => item.id === "public_corporations");
    $("#employment-unified-map").innerHTML = `
      <div class="unified-map-head"><span>${copy.mapExactFrame}</span><p>${copy.mapExactRule}</p></div>
      <div class="unified-total"><div><span>${esc(label(publicScope.root))} · ${publicScope.year}</span><strong>${fmtCount(publicScope.root.value)} <small>${esc(unit(publicScope.root))}</small></strong></div><b>${fmtCount(publicScope.root.details.previous_value)} <i>→</i> ${fmtCount(publicScope.root.value)} <em>+${fmtCount(data.growth.public_sector_change_fte)} ${copy.mapGrowth}</em></b></div>
      <div class="unified-exact-split" role="img" aria-label="${esc(label(government))} ${fmtCount(government.value)} plus ${esc(label(corporations))} ${fmtCount(corporations.value)} equals ${fmtCount(publicScope.root.value)} FTE">
        <article class="government"><span>${esc(label(government))}</span><strong>${fmtCount(government.value)}</strong><small>${pct(government.value / publicScope.root.value * 100)} % · +${fmtCount(data.growth.general_government_change_fte)} ${copy.mapGrowth}</small></article>
        <article class="corporations"><span>${esc(label(corporations))}</span><strong>${fmtCount(corporations.value)}</strong><small>${pct(corporations.value / publicScope.root.value * 100)} % · +${fmtCount(data.growth.public_corporations_change_fte)} ${copy.mapGrowth}</small></article>
      </div>
      <div class="unified-lens-head"><span>${copy.mapSourceLenses}</span><p>${copy.mapLensRule}</p></div>
      <div class="unified-lenses">
        <div class="unified-lens-top">
          <article class="unified-lens state-lens"><header><div><span>MF · 2015→2024</span><h3>${copy.mapStateLens}</h3></div><strong>${fmtCount(stateScope.root.value)} <small>${esc(unit(stateScope.root))}</small></strong></header><div class="unified-growth-equation"><b>${fmtCount(data.growth.state_regulated_comparison.employees_from)}</b><i>→</i><b>${fmtCount(data.growth.state_regulated_comparison.employees_to)}</b><strong>+${fmtCount(data.growth.state_regulated_comparison.change_employees)}</strong></div><div class="unified-state-groups">${stateGroups}</div><footer>${sourceLink(stateScope)}</footer></article>
          <article class="unified-lens local-lens"><header><div><span>MV · 2024</span><h3>${copy.mapLocalLens}</h3></div><strong>${fmtCount(localScope.root.value)} <small>${esc(unit(localScope.root))}</small></strong></header><div class="unified-rows">${localRows}</div><p>${esc(localScope.root[lang === "en" ? "note_en" : "note_cs"])}</p><footer>${sourceLink(localScope)}</footer></article>
        </div>
        <article class="unified-lens education-lens"><header><div><span>MŠMT · 2024</span><h3>${copy.mapEducationLens}</h3></div><strong>${fmtCount(professionScope.root.value)} <small>${esc(unit(professionScope.root))}</small></strong></header><div class="unified-education-growth"><span>2015 → 2024</span><strong>+${fmtCount(data.growth.regional_education_evidence.change_fte)} FTE</strong><small>${copy.pedagogical} +${fmtCount(data.growth.regional_education_evidence.pedagogical_change_fte)} · ${copy.nonpedagogical} +${fmtCount(data.growth.regional_education_evidence.nonpedagogical_change_fte)}</small></div><div class="unified-education-axes"><section><h4>${copy.mapProfessionAxis}</h4>${professionRows}</section><b class="unified-same-people">↔<small>${copy.mapSamePeople}</small></b><section><h4>${copy.mapSchoolAxis}</h4>${schoolRows}</section></div><footer>${sourceLink(professionScope)}${sourceLink(schoolScope)}</footer></article>
        <article class="unified-lens portfolio-lens"><header><div><span>MF · 2024 · 38 ${copy.mapEntities}</span><h3>${copy.mapPortfolioLens}</h3></div><strong>${fmtCount(portfolioScope.root.value)} <small>${esc(unit(portfolioScope.root))}</small></strong></header><div class="unified-portfolio">${portfolioRows}</div><p>${esc(portfolioScope.root[lang === "en" ? "note_en" : "note_cs"])}</p><footer>${sourceLink(portfolioScope)}</footer></article>
      </div>
      <aside class="unified-no-residual"><strong>${copy.mapUnallocated}</strong><p>${copy.mapUnallocatedBody}</p></aside>
      <article class="unified-cost-lens"><header><div><span>ČSÚ · COFOG · 2015→2024</span><h3>${copy.mapCostLayer}</h3><p>${copy.mapCostRule}</p></div><strong>${bn(data.compensation.headline.compensation_2015_czk_m)} <i>→</i> ${bn(data.compensation.headline.compensation_2024_czk_m)} <small>${copy.czkBn}</small></strong></header><div class="unified-cost-summary"><b>+${bn(data.compensation.headline.change_czk_m)} ${copy.czkBn}</b><span>${fmt(data.compensation.headline.average_monthly_cost_2015_czk)} → ${fmt(data.compensation.headline.average_monthly_cost_2024_czk)} CZK / FTE / ${lang === "en" ? "month" : "měsíc"}</span></div><div class="unified-cost-rows">${costRows}</div></article>`;
  }

  function renderChart(history) {
    const width = 900;
    const height = 410;
    const left = 70;
    const right = 24;
    const top = 28;
    const bottom = 50;
    const min = 750000;
    const max = 1150000;
    const x = (index) => left + index * (width - left - right) / (history.length - 1);
    const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
    const path = (field) => history.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
    const grid = [800000, 900000, 1000000, 1100000].map((value) => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${fmt(value / 1000)}k</text>`).join("");
    const labels = history.map((row, index) => `<text x="${x(index)}" y="${height - 18}" text-anchor="middle">${row.year}</text>`).join("");
    $("#employment-history-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.chartTitle)}"><g class="emp-grid">${grid}${labels}</g><path class="emp-area" d="${path("public_sector_fte")} L${x(history.length - 1)},${y(history.at(-1).general_government_fte)} ${[...history].reverse().map((row, index) => `L${x(history.length - 1 - index)},${y(row.general_government_fte)}`).join(" ")} Z"/><path class="emp-line government" d="${path("general_government_fte")}"/><path class="emp-line total" d="${path("public_sector_fte")}"/>${history.map((row, index) => `<circle class="emp-point" cx="${x(index)}" cy="${y(row.public_sector_fte)}" r="4"><title>${row.year}: ${fmt(row.public_sector_fte)} FTE</title></circle>`).join("")}</svg>`;
  }

  function renderCostChart(history) {
    const width = 900;
    const height = 370;
    const left = 70;
    const right = 26;
    const top = 30;
    const bottom = 52;
    const min = 30000;
    const max = 75000;
    const x = (index) => left + index * (width - left - right) / (history.length - 1);
    const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
    const path = (field) => history.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
    const grid = [30000, 40000, 50000, 60000, 70000].map((value) => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${fmt(value / 1000)}k</text>`).join("");
    const labels = history.map((row, index) => `<text x="${x(index)}" y="${height - 18}" text-anchor="middle">${row.year}</text>`).join("");
    const nominal = "average_monthly_employer_compensation_per_fte_czk";
    const real = "average_monthly_employer_compensation_per_fte_2015_czk";
    $("#employment-cost-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.costAria)}"><g class="emp-grid">${grid}${labels}</g><path class="emp-cost-area" d="${path(nominal)} L${x(history.length - 1)},${y(min)} L${x(0)},${y(min)} Z"/><path class="emp-cost-line nominal" d="${path(nominal)}"/><path class="emp-cost-line real" d="${path(real)}"/>${history.map((row, index) => `<circle class="emp-cost-point nominal" cx="${x(index)}" cy="${y(row[nominal])}" r="4"><title>${row.year}: ${fmt(row[nominal])} CZK</title></circle><circle class="emp-cost-point real" cx="${x(index)}" cy="${y(row[real])}" r="3"><title>${row.year}: ${fmt(row[real])} CZK (${copy.real2015.toLowerCase()})</title></circle>`).join("")}</svg>`;
  }

  function renderGrowth(data) {
    const growth = data.growth;
    const school = growth.regional_education_evidence;
    const regulated = growth.state_regulated_comparison;
    const professions = growth.education_profession_comparison;
    const compensation = data.compensation;
    const cost = compensation.headline;
    const latestCost = compensation.history.at(-1);
    const itemLabel = (row) => row[lang === "en" ? "label_en" : "label_cs"];
    $("#employment-growth-split").innerHTML = `<div class="employment-growth-donut" style="--government-share:${growth.general_government_share_of_public_growth_pct}" role="img" aria-label="${esc(copy.growthAria)}"><div><strong>${pct(growth.general_government_share_of_public_growth_pct)} %</strong><span>${copy.generalGovernment}</span></div></div><div class="employment-growth-legend"><article><i class="government"></i><div><span>${copy.generalGovernment}</span><strong>+${fmt(growth.general_government_change_fte)}</strong><small>${pct(growth.general_government_share_of_public_growth_pct)} %</small></div></article><article><i class="corporations"></i><div><span>${copy.publicCorporations}</span><strong>+${fmt(growth.public_corporations_change_fte)}</strong><small>${pct(growth.public_corporations_share_of_public_growth_pct)} %</small></div></article></div>`;
    $("#employment-growth-reading").innerHTML = `<span>${copy.growthExact}</span><strong>+${fmt(growth.public_sector_change_fte)}</strong><small>FTE · ${growth.year_from} → ${growth.year_to}</small><h3>${copy.growthReadingTitle}</h3><p>${copy.growthReadingBody.replace("{government}", fmt(growth.general_government_change_fte)).replace("{corporations}", fmt(growth.public_corporations_change_fte))}</p>`;

    const regulatedMax = Math.max(...regulated.components.flatMap((row) => [row.employees_2015, row.employees_2024]));
    $("#employment-regulated-growth").innerHTML = `<div class="employment-accounting-total"><span>${copy.comparedTotal}</span><strong>${fmt(regulated.employees_from)} <i>→</i> ${fmt(regulated.employees_to)}</strong><b>+${fmt(regulated.change_employees)}</b><small>${copy.average_employees}</small></div><div class="employment-accounting-head"><span></span><b>${regulated.year_from}</b><b>${regulated.year_to}</b><b>${copy.growthChange}</b></div><div class="employment-accounting-rows">${regulated.components.map((row) => `<article class="employment-growth-row ${row.change_employees < 0 ? "negative" : "positive"}"><span>${esc(itemLabel(row))}</span><div class="employment-compare-bar"><i style="width:${row.employees_2015 / regulatedMax * 100}%"></i><b>${fmt(row.employees_2015)}</b></div><div class="employment-compare-bar current"><i style="width:${row.employees_2024 / regulatedMax * 100}%"></i><b>${fmt(row.employees_2024)}</b></div><strong>${signedCount(row.change_employees)}</strong></article>`).join("")}</div>`;

    const pedagogicalShare = school.pedagogical_change_fte / school.change_fte * 100;
    const nonpedagogicalShare = 100 - pedagogicalShare;
    $("#employment-school-growth").innerHTML = `<div class="employment-school-total"><span>${copy.schoolTotal}</span><strong>${fmt(school.total_fte_from)} <i>→</i> ${fmt(school.total_fte_to)}</strong><small>+${fmt(school.change_fte)} FTE</small></div><div class="employment-school-bar" aria-label="${esc(copy.schoolTitle)}"><i class="pedagogical" style="width:${pedagogicalShare}%"></i><i class="nonpedagogical" style="width:${nonpedagogicalShare}%"></i></div><div class="employment-school-legend"><article><i class="pedagogical"></i><span>${copy.pedagogical}</span><strong>+${fmt(school.pedagogical_change_fte)}</strong></article><article><i class="nonpedagogical"></i><span>${copy.nonpedagogical}</span><strong>+${fmt(school.nonpedagogical_change_fte)}</strong></article></div>`;

    const professionMax = Math.max(...professions.components.map((row) => row.change_fte || row.fte_2024));
    $("#employment-profession-growth").innerHTML = `<div class="employment-profession-total"><span>${copy.pedagogical}</span><strong>+${fmtCount(professions.pedagogical_change_fte)} FTE</strong><small>${professions.year_from} → ${professions.year_to}</small></div>${professions.components.map((row) => {
      const value = row.change_fte === null ? row.fte_2024 : row.change_fte;
      return `<article class="employment-profession-row ${row.comparison_status}"><div><span>${esc(itemLabel(row))}</span><strong>${row.change_fte === null ? fmtCount(row.fte_2024) : signedCount(row.change_fte)}</strong></div><div class="employment-profession-track"><i style="width:${value / professionMax * 100}%"></i></div><small>${row.change_fte === null ? copy.newlyReported : `${fmtCount(row.fte_2020)} → ${fmtCount(row.fte_2024)}`}</small></article>`;
    }).join("")}`;

    const contributionsShare = latestCost.employer_social_contributions_czk_m / latestCost.compensation_employees_czk_m * 100;
    $("#employment-cost-kpis").innerHTML = `<article class="primary"><span>${copy.totalCompensation}</span><strong>${bn(cost.compensation_2024_czk_m)} <i>${copy.czkBn}</i></strong><small>+${bn(cost.change_czk_m)} ${copy.czkBn} · +${pct(cost.change_pct)} %</small></article><article><span>${copy.monthlyEmployerCost}</span><strong>${fmt(cost.average_monthly_cost_2024_czk)} <i>CZK</i></strong><small>+${pct(cost.average_monthly_cost_change_pct)} % ${copy.versus2015}</small></article><article><span>${copy.realMonthlyCost}</span><strong>${fmt(cost.average_monthly_real_cost_2024_2015_czk)} <i>CZK</i></strong><small>+${pct(cost.average_monthly_real_cost_change_pct)} % · ${copy.in2015Prices}</small></article><article><span>${copy.employerContributions}</span><strong>${bn(latestCost.employer_social_contributions_czk_m)} <i>${copy.czkBn}</i></strong><small>${pct(contributionsShare)} % ${copy.ofCompensation}</small></article>`;
    renderCostChart(compensation.history);
    const functions = [...compensation.change_by_function].sort((a, b) => b.change_czk_m - a.change_czk_m);
    const total2015 = functions.reduce((sum, row) => sum + row.compensation_2015_czk_m, 0);
    const total2024 = functions.reduce((sum, row) => sum + row.compensation_2024_czk_m, 0);
    const functionMax = Math.max(...functions.flatMap((row) => [row.compensation_2015_czk_m, row.compensation_2024_czk_m]));
    const stack = (year, total) => `<div class="employment-cost-stack-row"><b>${year}</b><div>${functions.map((row, index) => `<i class="tone-${index}" style="width:${row[`compensation_${year}_czk_m`] / total * 100}%" title="${esc(itemLabel(row))}: ${bn(row[`compensation_${year}_czk_m`])} ${copy.czkBn}"></i>`).join("")}</div><strong>${bn(total)} ${copy.czkBn}</strong></div>`;
    $("#employment-function-growth").innerHTML = `<div class="employment-cost-stacks">${stack(2015, total2015)}${stack(2024, total2024)}</div><div class="employment-cost-function-head"><span></span><b>2015</b><b>2024</b><b>${copy.growthChange}</b></div><div class="employment-cost-function-rows">${functions.map((row, index) => `<article><span><i class="tone-${index}"></i>${esc(itemLabel(row))}</span><div class="employment-cost-pair"><i style="width:${row.compensation_2015_czk_m / functionMax * 100}%"></i><b>${bn(row.compensation_2015_czk_m)}</b></div><div class="employment-cost-pair current"><i style="width:${row.compensation_2024_czk_m / functionMax * 100}%"></i><b>${bn(row.compensation_2024_czk_m)}</b></div><strong>+${bn(row.change_czk_m)}</strong></article>`).join("")}</div>`;

    const salaryMax = Math.max(...regulated.salary_comparison.map((row) => row.gross_monthly_2024_czk));
    $("#employment-salary-comparison").innerHTML = regulated.salary_comparison.map((row) => `<article><div><span>${esc(itemLabel(row))}</span><strong>+${pct(row.change_pct)} %</strong></div><div class="employment-salary-bars"><i style="width:${row.gross_monthly_2015_czk / salaryMax * 100}%"><b>${fmt(row.gross_monthly_2015_czk)}</b></i><i class="current" style="width:${row.gross_monthly_2024_czk / salaryMax * 100}%"><b>${fmt(row.gross_monthly_2024_czk)}</b></i></div></article>`).join("");
  }

  function render(data) {
    const headline = data.headline;
    const sources = sourceMap(data);
    $("#employment-hero-total").textContent = fmt(headline.public_sector_fte);
    $("#employment-hero-share").textContent = `${pct(headline.public_sector_share_pct)} %`;
    $("#employment-kpis").innerHTML = `<article class="primary"><span>${copy.control}</span><strong>${fmt(headline.public_sector_fte)}</strong><small>FTE · ${headline.year}</small></article><article><span>${copy.share}</span><strong>${pct(headline.public_sector_share_pct)} %</strong><small>${copy.ofEconomy}</small></article><article><span>${copy.change}</span><strong>+${fmt(headline.change_since_first_fte)}</strong><small>+${pct(headline.change_since_first_pct)} %</small></article><article><span>${copy.generalGovernment}</span><strong>${fmt(headline.general_government_fte)}</strong><small>FTE · ${headline.year}</small></article>`;
    renderChart(data.history);
    $("#employment-history-body").innerHTML = [...data.history].reverse().map((row) => `<tr><th>${row.year}</th><td>${fmt(row.public_sector_fte)}</td><td>${fmt(row.general_government_fte)}</td><td>${fmt(row.public_corporations_combined_fte)}${row.public_corporations_combined_status === "derived_residual" ? "*" : ""}</td><td>${pct(row.public_sector_share_pct)} %</td></tr>`).join("");
    renderGrowth(data);
    renderReconciledWorkforce(data);
    const entities = data.entity_resolution;
    $("#employment-entity-status").innerHTML = `<article><span>${copy.registered}</span><strong>${fmt(entities.registered_entities)}</strong><small>${entities.public_entity_register_period}</small></article><article><span>${copy.observed}</span><strong>${fmt(entities.entities_with_employee_observation)}</strong><small>2024</small></article><article><span>${copy.missing}</span><strong>${fmt(entities.registered_entities - entities.entities_with_employee_observation)}</strong><small>${copy.coverage}</small></article><article><span>${copy.join}</span><strong>IČO</strong><small>${esc(entities.join_key)}</small></article>`;
    $("#employment-method-grid").innerHTML = copy.methodCards.map((row) => `<article><b>${row[0]}</b><h3>${row[1]}</h3><p>${row[2]}</p></article>`).join("");
    $("#employment-sources").innerHTML = data.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener"><span>${esc(source.publisher)}</span><strong>${esc(source[lang === "en" ? "title_en" : "title_cs"])} · ${esc(source.period)} ↗</strong></a>`).join("");
  }

  fetch(datasetUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(render)
    .catch((error) => {
      console.error("public employment", error);
      $("main").insertAdjacentHTML("afterbegin", `<p class="employment-load-error">${copy.loadError}</p>`);
    });
})();
