const $ = (selector) => document.querySelector(selector);
const DATA_URL = "data/eu-capital-budgets.v1.json";
const requestedLanguage = new URLSearchParams(location.search).get("lang");
const state = {
  // language-bootstrap.js already resolved URL param → stored preference →
  // route default into <html lang>; do not re-read storage here.
  lang: ["cs", "en"].includes(requestedLanguage) ? requestedLanguage : (document.documentElement.lang === "en" ? "en" : "cs"),
  currency: "eur", sort: "city", coverage: "all", query: "", selected: null, data: null, history: null
};

const I = {
  cs: {
    eyebrow: "27 hlavních měst EU + Londýn", hero1: "Města v číslech.", hero2: "Rozpočet i kontext.", heroCopy: "Nejnovější oficiální rozpočty evropských metropolí, přepínatelné mezi eurem a místní měnou. Vedle nich počet obyvatel a turistická přenocování.", heroCta: "Otevřít atlas měst",
    ledgerTitle: "Datový výřez", statCities: "Města", statCurrencies: "Měny", statEu: "Členské státy EU", statTourism: "Turistika", ledgerNote: "Rozpočtové období je 2026, s označenými výjimkami pro Vallettu a Londýn.",
    warningLabel: "Čtěte rozsah.", warningCopy: "Městské struktury a účetní definice se liší. Částky zachovávají nejširší oficiální výdajový údaj každého města; nejsou bez dalšího vhodné jako žebříček.",
    atlasKicker: "01 / Městský atlas", atlasTitle: "Jedno místo. Čtyři měřítka.", atlasCopy: "Rozpočet, obyvatelé, turistická přenocování a intenzita cestovního ruchu. Kliknutím na řádek otevřete přesný rozsah a původ hodnoty.",
    searchLabel: "Hledat město nebo zemi", searchPlaceholder: "Praha, France…", currencyLabel: "Zobrazená měna", currencyEur: "EUR", currencyLocal: "Místní měna", sortLabel: "Seřadit podle", sortCity: "Města A–Z", sortBudget: "Výdajů", sortBalance: "Salda", sortPopulation: "Počtu obyvatel", sortNights: "Přenocování", sortIntensity: "Přenocování / obyv.", coverageLabel: "Výběr", coverageAll: "EU + Londýn", coverageEu: "Pouze EU", resultNote: "Hodnoty rozpočtu jsou nominální.",
    thCity: "Město", thBudget: "Výdaje", thBalance: "Saldo", thPopulation: "Obyvatelé", thNights: "Přenocování", thIntensity: "Noci / obyv.", thDetail: "Detail", emptyTitle: "Nic jsme nenašli.", emptyCopy: "Zkuste jiné město nebo zemi.",
    detailKicker: "02 / Fiskální profil", detailInitial: "Vyberte město v tabulce.", officialSource: "Stránka zdroje ↗", budgetDocument: "Rozpočtový dokument ↗", revenueLabel: "Příjmy", expenditureLabel: "Výdaje", balanceLabel: "Plánované saldo", perResidentLabel: "Výdaje / obyv.", populationLabel: "Obyvatelé", nightsLabel: "Přenocování", foreignShareLabel: "Podíl zahraničních nocí", exactScope: "Přesný rozsah", lineage: "Zdroj a původ", period: "období", referenceYear: "referenční rok", extraLondon: "Londýn / srovnávací město mimo EU", euCapital: "Hlavní město členského státu EU", broaderSource: "širší místní turistický zdroj", stalePopulation: "starší populační údaj", unavailable: "neuvedeno", balanceUnavailable: "Saldo není dostupné", surplus: "Přebytek", deficit: "Schodek", balanced: "Vyrovnaný rozpočet", fiscalOverview: "Příjmy, výdaje a výsledek", spendingStructure: "Struktura rozpočtu", cityContext: "Městský kontext", noBreakdown: "Ve zdroji zatím není standardizovaný rozpad položek.", sourceCoverage: "Úplnost detailu", completenessDetailed: "detailní", completenessPartial: "částečná", completenessHeadline: "pouze hlavní údaj", marginLabel: "saldo / příjmy", ofDisplayedTotal: "zobrazeného celku", historyKicker: "10 let skutečnosti", historyTitle: "Praha: příjmy, výdaje a výsledek", historyCopy: "Skutečné konsolidované výsledky účetní jednotky Praha (IČO 00064581), 2016–2025. Městské části hospodaří samostatně, proto řada není přímo srovnatelná s konsolidovaným plánem 2026 pro všech 58 rozpočtů.", historyRevenueGrowth: "Růst příjmů", historyExpenseGrowth: "Růst výdajů", historySurplusYears: "Roky s přebytkem", historyActual: "skutečnost", historyNominal: "nominální CZK", historyYear: "Rok", historyBalance: "Skutečné saldo", historySource: "Monitor státní pokladny · skutečné příjmy a výdaje po konsolidaci",
    methodKicker: "03 / Jak data číst", methodTitle: "Srovnání s přiznanými hranicemi.", methodCopy: "Každá hodnota si nese rok, územní vymezení a primární zdroj. To umožní později stavět městské profily bez ztráty původního významu.", methodBudgetTitle: "Rozpočty", methodBudgetCopy: "Nejširší oficiální výdajová částka dostupná k 20. srpnu 2026. Přesná definice a rozsah jsou v detailu města.", methodFxTitle: "Přepočet měn", methodFxCopy: "EUR hodnoty používají referenční kurzy ECB z 20. srpna 2026. Místní částka zůstává uložená beze změny.", methodPopulationTitle: "Obyvatelé", methodPopulationCopy: "Nejnovější dostupný údaj Eurostatu. Rok a případné širší území „greater city“ zobrazujeme přímo u hodnoty.", methodTourismTitle: "Cestovní ruch", methodTourismCopy: "Přenocování za rok 2024. Dublin a Londýn používají širší místní zdroje, proto jsou v detailu zvlášť označené.", footerScope: "Evropská města", footerSource: "Zdroje: rozpočty měst · Eurostat · ECB", backTop: "Nahoru ↑", citiesCount: (n) => `${n} ${n === 1 ? "město" : n < 5 ? "města" : "měst"}`
  },
  en: {
    eyebrow: "27 EU capitals + London", hero1: "Cities in numbers.", hero2: "Budget in context.", heroCopy: "The latest official budgets of European capitals, switchable between euros and local currency. Alongside them: population and tourist nights.", heroCta: "Open the city atlas",
    ledgerTitle: "Data snapshot", statCities: "Cities", statCurrencies: "Currencies", statEu: "EU member states", statTourism: "Tourism", ledgerNote: "The budget period is 2026, with flagged exceptions for Valletta and London.",
    warningLabel: "Read the scope.", warningCopy: "Municipal structures and accounting definitions differ. The figures retain each city's broadest official expenditure measure; they are not a league table without further adjustment.",
    atlasKicker: "01 / City atlas", atlasTitle: "One place. Four measures.", atlasCopy: "Budget, population, tourist nights and tourism intensity. Select a row to see the exact scope and source behind the value.",
    searchLabel: "Search city or country", searchPlaceholder: "Prague, France…", currencyLabel: "Display currency", currencyEur: "EUR", currencyLocal: "Local currency", sortLabel: "Sort by", sortCity: "City A–Z", sortBudget: "Expenditure", sortBalance: "Balance", sortPopulation: "Population", sortNights: "Tourist nights", sortIntensity: "Nights / resident", coverageLabel: "Coverage", coverageAll: "EU + London", coverageEu: "EU only", resultNote: "Budget values are nominal.",
    thCity: "City", thBudget: "Expenditure", thBalance: "Balance", thPopulation: "Population", thNights: "Tourist nights", thIntensity: "Nights / resident", thDetail: "Detail", emptyTitle: "No results.", emptyCopy: "Try another city or country.",
    detailKicker: "02 / Fiscal profile", detailInitial: "Select a city in the table.", officialSource: "Source page ↗", budgetDocument: "Budget document ↗", revenueLabel: "Revenue", expenditureLabel: "Expenditure", balanceLabel: "Planned balance", perResidentLabel: "Spend / resident", populationLabel: "Population", nightsLabel: "Tourist nights", foreignShareLabel: "Non-resident share", exactScope: "Exact scope", lineage: "Source and lineage", period: "period", referenceYear: "reference year", extraLondon: "London / non-EU comparator", euCapital: "Capital of an EU member state", broaderSource: "broader local tourism source", stalePopulation: "older population observation", unavailable: "not available", balanceUnavailable: "Balance unavailable", surplus: "Surplus", deficit: "Deficit", balanced: "Balanced budget", fiscalOverview: "Revenue, expenditure and result", spendingStructure: "Budget structure", cityContext: "City context", noBreakdown: "The source does not yet have a standardized component breakdown.", sourceCoverage: "Detail completeness", completenessDetailed: "detailed", completenessPartial: "partial", completenessHeadline: "headline only", marginLabel: "balance / revenue", ofDisplayedTotal: "of displayed total", historyKicker: "10-year actuals", historyTitle: "Prague: revenue, expenditure and result", historyCopy: "Actual consolidated results for the Prague reporting entity (national ID 00064581), 2016–2025. Municipal districts report separately, so this series is not directly comparable with the 2026 consolidated plan covering all 58 budgets.", historyRevenueGrowth: "Revenue growth", historyExpenseGrowth: "Spending growth", historySurplusYears: "Surplus years", historyActual: "actual", historyNominal: "nominal CZK", historyYear: "Year", historyBalance: "Actual balance", historySource: "Czech Treasury Monitor · actual revenue and expenditure after consolidation",
    methodKicker: "03 / How to read the data", methodTitle: "Comparison with visible boundaries.", methodCopy: "Every value retains its year, geographic definition and primary source. Future city profiles can build on it without losing the original meaning.", methodBudgetTitle: "Budgets", methodBudgetCopy: "The broadest official expenditure figure available on 20 August 2026. The exact definition and scope appear in each city detail.", methodFxTitle: "Currency conversion", methodFxCopy: "EUR values use ECB reference rates from 20 August 2026. The original local-currency amount remains stored unchanged.", methodPopulationTitle: "Population", methodPopulationCopy: "Latest available Eurostat observation. The year and any wider ‘greater city’ boundary are shown alongside the value.", methodTourismTitle: "Tourism", methodTourismCopy: "Tourist nights for 2024. Dublin and London use broader local sources and are explicitly flagged in the city detail.", footerScope: "European cities", footerSource: "Sources: city budgets · Eurostat · ECB", backTop: "Back to top ↑", citiesCount: (n) => `${n} ${n === 1 ? "city" : "cities"}`
  }
};
Object.assign(I.cs,{consolidationKicker:"00 / Rozsah měst",consolidationTitle:"Konsolidace je vidět hned.",consolidationCopy:"Barva rozlišuje konsolidovaný městský celek, město se statutem regionu a samostatnou obec bez podřízených rozpočtů.",scopeConsolidated:"Konsolidovaný celek",scopeCityState:"Město + region",scopeMunicipality:"Samostatná obec",spendingKicker:"02 / Kam města utrácejí",spendingTitle:"Všechny dostupné dílčí rozpočty.",spendingCopy:"Každý řádek zachovává původní kategorii, přesný rozpočtový rok a podíl na zveřejněném celku. Hlavičky tabulky řadí data; chybějící profily jsou přiznané.",spendingCategory:"Kategorie výdajů",spendingAmount:"Částka",spendingShare:"Podíl",spendingCoverage:"Úplnost",spendingYear:"Rok",functionalProfile:"funkční členění",componentProfile:"dílčí členění",missingProfile:"profil výdajů chybí"});
Object.assign(I.en,{consolidationKicker:"00 / City scope",consolidationTitle:"Consolidation is visible first.",consolidationCopy:"Colour separates a consolidated city group, a city with regional status, and a standalone municipality without subordinate budgets.",scopeConsolidated:"Consolidated group",scopeCityState:"City + region",scopeMunicipality:"Standalone municipality",spendingKicker:"02 / Where cities spend",spendingTitle:"Every available sub-budget.",spendingCopy:"Each row retains its source category, exact budget year and share of the published total. Sort from any table heading; missing profiles remain explicit.",spendingCategory:"Spending category",spendingAmount:"Amount",spendingShare:"Share",spendingCoverage:"Completeness",spendingYear:"Year",functionalProfile:"functional breakdown",componentProfile:"component breakdown",missingProfile:"spending profile missing"});
Object.assign(I.cs,{
  hero2:"Plány v kontextu.",heroCopy:"Nejnovější oficiální rozpočtové plány evropských metropolí, oddělené od skutečných výsledků a doplněné datovanou populací a turistickými přenocováními.",ledgerNote:"Fiskální vrstvu tvoří převážně plány 2026; odlišný rok nebo stav je uveden u města.",
  warningLabel:"Plán není skutečnost.",warningCopy:"Všechny fiskální částky v meziměstském atlasu jsou oficiální rozpočtové plány, nikoli skutečné plnění. Městské struktury a účetní definice se navíc liší.",atlasTitle:"Plány odděleně od pozorovaného kontextu.",atlasCopy:"Tabulka porovnává rozpočtové plány. Populace a turistika mají vlastní referenční roky; skutečné fiskální výsledky se zobrazují samostatně.",
  sortBudget:"Plánovaných výdajů",sortBalance:"Plánovaného salda",resultNote:"Fiskální hodnoty jsou nominální plány, nikoli skutečné plnění.",thBudget:"Plánované výdaje",thBalance:"Plánované saldo",detailKicker:"02 / Rozpočtový plán",fiscalOverview:"Rozpočtový plán: příjmy, výdaje a financování",spendingStructure:"Struktura plánovaných výdajů",cityContext:"Datovaný městský kontext",methodCopy:"Rozpočtové plány, skutečné výsledky a datovaný městský kontext držíme jako oddělené vrstvy.",methodBudgetTitle:"Rozpočtové plány",methodBudgetCopy:"Nejširší oficiální plán výdajů dostupný k 20. srpnu 2026. Nejde o skutečné plnění; rok, stav a rozsah jsou v detailu města.",footerSource:"Zdroje: rozpočtové plány měst · Eurostat · ECB",
  planBadge:"ROZPOČTOVÝ PLÁN",actualBadge:"SKUTEČNOST",stageTitle:"Plán a skutečnost jsou oddělené.",stagePlanTitle:"Oficiální rozpočtové plány",stagePlanCopy:"Atlas používá plány pro srovnání zamýšlené kapacity. U každého města zobrazuje rok, stav a přesný rozsah.",stageActualTitle:"Skutečné fiskální výsledky",stageActualCopy:"Skutečné příjmy a výdaje zobrazujeme v samostatné historické vrstvě pouze tam, kde je k dispozici kompatibilní řada.",
  plannedRevenueLabel:"Plánované příjmy",plannedExpenditureLabel:"Plánované výdaje",plannedBalanceLabel:"Plánované saldo",plannedGapLabel:"Plánovaný rozdíl před financováním",plannedPerResidentLabel:"Plánované výdaje / obyv.",plannedMarginLabel:"plánované saldo / příjmy",plannedGapMarginLabel:"plánovaný rozdíl před financováním / příjmy",observedContext:"POZOROVANÝ KONTEXT",
  adoptedPlan:"Schválený plán",interimPlan:"Oficiální průběžný výpočet",initialPlan:"Schválený počáteční plán",latestCompletePlan:"Nejnovější úplný oficiální plán"
});
Object.assign(I.en,{
  hero2:"Plans in context.",heroCopy:"The latest official budget plans of European capitals, separated from actual outcomes and paired with dated population and tourist-night observations.",ledgerNote:"The fiscal layer is mostly 2026 plans; a different year or status is shown for the city.",
  warningLabel:"Plan is not actual.",warningCopy:"Every cross-city fiscal amount in this atlas is an official budget plan, not actual execution. Municipal structures and accounting definitions also differ.",atlasTitle:"Plans separated from observed context.",atlasCopy:"The table compares budget plans. Population and tourism retain their own reference years; actual fiscal outcomes appear in a separate layer.",
  sortBudget:"Planned expenditure",sortBalance:"Planned balance",resultNote:"Fiscal values are nominal plans, not actual outturns.",thBudget:"Plan expenditure",thBalance:"Plan balance",detailKicker:"02 / Budget plan",fiscalOverview:"Budget plan: revenue, expenditure and financing",spendingStructure:"Planned spending structure",cityContext:"Dated city context",methodCopy:"Budget plans, actual outcomes and dated city context remain separate data layers.",methodBudgetTitle:"Budget plans",methodBudgetCopy:"The broadest official expenditure plan available on 20 August 2026. It is not actual execution; each city detail shows year, status and perimeter.",footerSource:"Sources: city budget plans · Eurostat · ECB",
  planBadge:"BUDGET PLAN",actualBadge:"ACTUAL",stageTitle:"Plan and actual are separate.",stagePlanTitle:"Official budget plans",stagePlanCopy:"The atlas uses plans to compare intended capacity. Every city retains its year, status and exact perimeter.",stageActualTitle:"Actual fiscal outcomes",stageActualCopy:"Actual revenue and expenditure appear in a separate historical layer only where a compatible series is available.",
  plannedRevenueLabel:"Planned revenue",plannedExpenditureLabel:"Planned expenditure",plannedBalanceLabel:"Planned balance",plannedGapLabel:"Planned gap before financing",plannedPerResidentLabel:"Planned expenditure / resident",plannedMarginLabel:"planned balance / revenue",plannedGapMarginLabel:"planned gap before financing / revenue",observedContext:"OBSERVED CONTEXT",
  adoptedPlan:"Adopted plan",interimPlan:"Official interim calculation",initialPlan:"Adopted initial plan",latestCompletePlan:"Latest complete official plan"
});

const CZECH_CITY_NAMES = {
  "amsterdam-nl":"Amsterdam","athens-gr":"Athény","berlin-de":"Berlín","bratislava-sk":"Bratislava","brussels-be":"Brusel","bucharest-ro":"Bukurešť","budapest-hu":"Budapešť","copenhagen-dk":"Kodaň","dublin-ie":"Dublin","helsinki-fi":"Helsinky","lisbon-pt":"Lisabon","ljubljana-si":"Lublaň","luxembourg-lu":"Lucemburk","madrid-es":"Madrid","nicosia-cy":"Nikósie","paris-fr":"Paříž","prague-cz":"Praha","riga-lv":"Riga","rome-it":"Řím","sofia-bg":"Sofie","stockholm-se":"Stockholm","tallinn-ee":"Tallinn","valletta-mt":"Valletta","vienna-at":"Vídeň","vilnius-lt":"Vilnius","warsaw-pl":"Varšava","zagreb-hr":"Záhřeb","london-gb":"Londýn"
};

const COMPONENT_LABELS = {
  accrual_expenditure:["Akruální náklady","Accrual expenditure"], administration_expenditure:["Administrativa","Administration"], agriculture_expenditure:["Zemědělství","Agriculture"], budgetary_subset:["Rozpočtové výdaje","Budgetary subset"], capital:["Kapitálové výdaje","Capital"], capital_expenditure:["Kapitálové výdaje","Capital expenditure"], capital_revenue:["Kapitálové příjmy","Capital revenue"], commercial_rates:["Komerční sazby","Commercial rates"], costs_total:["Provozní náklady","Operating costs"], credit_balance_funding:["Použití zůstatků","Credit balances"], current_expenditure:["Běžné výdaje","Current expenditure"], depreciation_expenditure:["Odpisy","Depreciation"], development_expenditure:["Územní rozvoj","Development"], environment_expenditure:["Životní prostředí","Environment"], expenditure_excluding_financing:["Výdaje bez financování","Expenditure excluding financing"], expenditure_excluding_reserves:["Výdaje bez rezerv","Expenditure excluding reserves"], extraordinary_expenditure:["Mimořádné výdaje","Extraordinary expenditure"], extraordinary_revenue:["Mimořádné příjmy","Extraordinary revenue"], financial_transactions:["Finanční transakce","Financial transactions"], financing_expenditure:["Výdaje financování","Financing outflows"], financing_outflows:["Výdaje financování","Financing outflows"], financing_revenue:["Příjmy financování","Financing inflows"], fixed_asset_acquisition_and_renovation:["Pořízení a obnova majetku","Fixed assets and renovation"], gross_budget_expenditure:["Hrubé rozpočtové výdaje","Gross budget expenditure"], gross_budget_revenue:["Hrubé rozpočtové příjmy","Gross budget revenue"], housing_expenditure:["Bydlení a výstavba","Housing and building"], investing_outflows:["Investiční výdaje","Investing outflows"], investment_excluding_debt_repayment:["Investice bez splátek dluhu","Investment excluding debt repayment"], investment_expenditure:["Investiční výdaje","Investment expenditure"], investment_outlays:["Investiční výdaje","Investment outlays"], investment_revenue:["Investiční příjmy","Investment revenue"], miscellaneous_expenditure:["Ostatní služby","Miscellaneous services"], non_financial_expenditure:["Nefinanční výdaje","Non-financial expenditure"], operating_costs:["Provozní náklady","Operating costs"], operating_expenditure:["Běžné výdaje","Operating expenditure"], operating_outflows:["Provozní výdaje","Operating outflows"], operating_revenue:["Běžné příjmy","Operating revenue"], operations_and_maintenance_expenditure:["Provoz a údržba","Operations and maintenance"], ordinary_expenditure:["Běžné výdaje","Ordinary expenditure"], ordinary_revenue:["Běžné příjmy","Ordinary revenue"], personnel_expenditure:["Osobní náklady","Personnel"], property_tax_and_general_grant:["Majetková daň a obecný grant","Property tax and general grant"], real_investment_expenditure_including_debt_repayment:["Investice včetně splátek dluhu","Investment including debt repayment"], real_operating_expenditure:["Reálné provozní výdaje","Real operating expenditure"], recreation_expenditure:["Rekreace a volný čas","Recreation and amenities"], service:["Veřejné služby","Public services"], service_income:["Příjmy služeb","Service income"], transfers:["Transfery","Transfers"], transport_expenditure:["Doprava a bezpečnost","Transport and safety"], unallocated_future_amendment:["Budoucí nerozdělená změna","Unallocated future amendment"], water_expenditure:["Vodní hospodářství","Water services"]
};
Object.assign(COMPONENT_LABELS, {
  tax_revenue:["Daňové příjmy","Tax revenue"], non_tax_revenue:["Nedaňové příjmy","Non-tax revenue"], transfer_revenue:["Přijaté transfery","Transfers received"], functional_community_development:["Rozvoj obce","Community development"], functional_infrastructure:["Městská infrastruktura","Municipal infrastructure"], functional_transport:["Doprava","Transport"], functional_education_sport:["Školství, mládež a sport","Education, youth and sport"], functional_health_social:["Zdravotnictví a sociální oblast","Health and social affairs"], functional_culture_tourism:["Kultura a cestovní ruch","Culture and tourism"], functional_safety:["Bezpečnost","Public safety"], functional_economy:["Hospodářství","Economy"], functional_internal_administration:["Vnitřní správa","Internal administration"], functional_treasury:["Pokladní správa","Treasury management"]
});

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
const cityName = (city) => state.lang === "cs" ? (CZECH_CITY_NAMES[city.city_id] || city.city) : city.city;
const countryName = (city) => new Intl.DisplayNames([locale()], {type:"region"}).of(city.country_code) || city.country;
const compactNumber = (value, digits = 1) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {notation:"compact", maximumFractionDigits:digits}).format(value) : "—";
const decimal = (value, digits = 1) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {maximumFractionDigits:digits, minimumFractionDigits:digits}).format(value) : "—";
const moneyValues = (amount, currency, signed = false) => {
  if (!Number.isFinite(amount)) return "—";
  const formatted = new Intl.NumberFormat(locale(), {style:"currency", currency, notation:"compact", maximumFractionDigits:Math.abs(amount) < 10000000 ? 1 : 2}).format(amount);
  return signed && amount > 0 ? `+${formatted}` : formatted;
};
const moneyPayload = (payload, signed = false) => {
  if (!payload) return "—";
  const amount = state.currency === "eur" ? payload.eur_amount : payload.local_amount;
  const currency = state.currency === "eur" ? "EUR" : payload.local_currency;
  return moneyValues(amount, currency, signed);
};
const money = (city) => moneyPayload(city.budget);
const moneyPerResident = (city) => {
  const population = city.benchmarks.population.value;
  const amount = state.currency === "eur" ? city.fiscal_details.expenditure.eur_amount : city.fiscal_details.expenditure.local_amount;
  const currency = state.currency === "eur" ? "EUR" : city.currency_code;
  return Number.isFinite(population) && population > 0 ? moneyValues(amount / population, currency) : "—";
};
const componentLabel = (code) => COMPONENT_LABELS[code]?.[state.lang === "en" ? 1 : 0] || code.replaceAll("_", " ");
const balanceLabel = (classification) => I[state.lang][classification] || I[state.lang].balanceUnavailable;
const planStatus = (city) => ({adopted:I[state.lang].adoptedPlan,official_interim_calculation:I[state.lang].interimPlan,adopted_initial:I[state.lang].initialPlan,latest_complete_official_budget:I[state.lang].latestCompletePlan})[city.status] || String(city.status).replaceAll("_", " ");
const isBeforeFinancingBalance = (city) => /before_financing|excluding_financing|revenue_expenditure_gap/.test(city.fiscal_details.balance_basis);
const plannedBalanceLabel = (city) => I[state.lang][isBeforeFinancingBalance(city) ? "plannedGapLabel" : "plannedBalanceLabel"];
const plannedMarginLabel = (city) => I[state.lang][isBeforeFinancingBalance(city) ? "plannedGapMarginLabel" : "plannedMarginLabel"];
const visibleComponents = (city) => {
  const components = city.fiscal_details.components;
  const codes = new Set(components.map((item) => item.component_code));
  return components.filter((item) => {
    if (item.component_code === "expenditure_excluding_financing" && codes.has("operating_expenditure") && codes.has("capital_expenditure")) return false;
    if (item.component_code === "investment_excluding_debt_repayment" && codes.has("real_investment_expenditure_including_debt_repayment")) return false;
    return true;
  });
};
const componentMoney = (component) => {
  const amount = state.currency === "eur" ? component.eur_amount : component.local_amount;
  const currency = state.currency === "eur" ? "EUR" : component.local_currency;
  return Number.isFinite(amount) ? new Intl.NumberFormat(locale(), {style:"currency", currency, notation:"compact", maximumFractionDigits:amount < 10000000 ? 1 : 2}).format(amount) : "—";
};
const historyMoney = (value) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {style:"currency", currency:"CZK", notation:"compact", maximumFractionDigits:2}).format(value) : "—";
const historyPercent = (value) => Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${decimal(value)} %` : "—";
const CITY_HISTORY_ENTITY = {"prague-cz":"CZ:00064581"};
const isStalePopulation = (city) => city.benchmarks.population.reference_year < 2022 || city.benchmarks.population.quality_flags?.length > 0;
const tourismIsLocal = (city) => !String(city.benchmarks.tourism.comparability_group).startsWith("eurostat");
const consolidationKind = (city) => {
  const scope = String(city.scope).toLowerCase();
  if (/consolidat|including districts|organizational units|all 58/.test(scope)) return "consolidated";
  if (/city-state|city and state|commune and department/.test(scope)) return "city-state";
  return "municipality";
};
const spendingProfile = (city) => {
  const components = visibleComponents(city).filter((item) => item.component_kind !== "revenue");
  if (components.some((item) => item.component_kind === "functional")) return "functional";
  return components.length ? "component" : "missing";
};

function translate() {
  document.documentElement.lang = state.lang;
  document.title = state.lang === "en" ? "European capitals — budgets, population and tourism" : "Evropská hlavní města — rozpočty, obyvatelé a cestovní ruch";
  document.querySelectorAll("[data-i18n]").forEach((node) => { const value = I[state.lang][node.dataset.i18n]; if (typeof value === "string") node.textContent = value; });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => node.placeholder = I[state.lang][node.dataset.i18nPlaceholder]);
  document.querySelectorAll("[data-lang]").forEach((button) => { const active = button.dataset.lang === state.lang; button.classList.toggle("active", active); button.setAttribute("aria-pressed", active ? "true" : "false"); });
  document.querySelector(".brand").href = `index.html?lang=${state.lang}`;
}

function filteredCities() {
  const query = state.query.trim().toLocaleLowerCase(locale());
  const cities = state.data.cities.filter((city) => {
    if (state.coverage === "eu" && !city.eu_capital) return false;
    if (!query) return true;
    return [city.city, cityName(city), city.country, countryName(city), city.country_code].some((value) => value.toLocaleLowerCase(locale()).includes(query));
  });
  const extractors = {budget:(city)=>city.budget.eur_amount,balance:(city)=>city.fiscal_details.balance?.eur_amount,population:(city)=>city.benchmarks.population.value,nights:(city)=>city.benchmarks.tourism.nights_total,intensity:(city)=>city.benchmarks.tourism.nights_per_resident};
  return cities.sort((a,b) => state.sort === "city" ? cityName(a).localeCompare(cityName(b), locale()) : (extractors[state.sort](b) ?? -Infinity) - (extractors[state.sort](a) ?? -Infinity));
}

function renderTable() {
  const cities = filteredCities();
  $("#capital-count").textContent = I[state.lang].citiesCount(cities.length);
  $("#capital-empty").hidden = cities.length > 0;
  $(".capital-table-wrap").hidden = cities.length === 0;
  $("#capital-table-body").innerHTML = cities.map((city) => {
    const population = city.benchmarks.population, tourism = city.benchmarks.tourism, fiscal = city.fiscal_details, selected = city.city_id === state.selected;
    const balanceClass = fiscal.balance_classification === "surplus" ? "positive" : fiscal.balance_classification === "deficit" ? "negative" : "";
    const scopeKind = consolidationKind(city);
    return `<tr data-city-id="${esc(city.city_id)}" class="scope-${scopeKind} ${selected ? "active" : ""}" tabindex="0" aria-selected="${selected}">
      <td class="capital-city-cell"><div class="capital-city"><span class="capital-city-code">${esc(city.country_code)}</span><strong>${esc(cityName(city))}</strong><small>${esc(countryName(city))}${city.extra_city ? " · UK" : ""} · ${esc(I[state.lang][scopeKind === "city-state" ? "scopeCityState" : scopeKind === "consolidated" ? "scopeConsolidated" : "scopeMunicipality"])}</small></div></td>
      <td><strong class="capital-value">${esc(money(city))}</strong><small class="capital-period">${esc(I[state.lang].planBadge)} · ${esc(city.period)}</small></td>
      <td><strong class="capital-value ${balanceClass}">${esc(moneyPayload(fiscal.balance, true))}</strong><small class="capital-period">${esc(I[state.lang].planBadge)} · ${esc(balanceLabel(fiscal.balance_classification))}</small></td>
      <td><strong class="capital-value">${esc(compactNumber(population.value))}</strong><small class="capital-period ${isStalePopulation(city) ? "data-warning" : ""}">${esc(population.reference_year)}${isStalePopulation(city) ? " · !" : ""}</small></td>
      <td><strong class="capital-value">${esc(compactNumber(tourism.nights_total))}</strong><small class="capital-period ${tourismIsLocal(city) ? "data-warning" : ""}">${esc(tourism.reference_year)}${tourismIsLocal(city) ? " · *" : ""}</small></td>
      <td><strong class="capital-value">${esc(decimal(tourism.nights_per_resident))}</strong><small class="capital-period">${esc(tourism.geography_name)}</small></td><td class="row-arrow" aria-hidden="true">→</td></tr>`;
  }).join("");
  $("#capital-table-body").querySelectorAll("tr").forEach((row) => {
    const select = () => selectCity(row.dataset.cityId, true);
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(); } });
  });
  renderSpendingTable();
}

function renderSpendingTable() {
  const t = I[state.lang], rows = [];
  filteredCities().forEach((city) => {
    const profile = spendingProfile(city);
    const items = visibleComponents(city).filter((item) => item.component_kind !== "revenue");
    if (!items.length) {
      rows.push(`<tr class="scope-${consolidationKind(city)}"><td class="capital-city-cell"><strong>${esc(cityName(city))}</strong><small>${esc(city.country_code)}</small></td><td>—</td><td>—</td><td>—</td><td>${esc(t.missingProfile)}</td><td data-sort-value="${esc(city.period)}">${esc(city.period)}</td></tr>`);
      return;
    }
    items.forEach((item) => {
      const amount = state.currency === "eur" ? item.eur_amount : item.local_amount;
      rows.push(`<tr class="scope-${consolidationKind(city)}"><td class="capital-city-cell"><strong>${esc(cityName(city))}</strong><small>${esc(city.country_code)} · ${esc(I[state.lang][consolidationKind(city) === "city-state" ? "scopeCityState" : consolidationKind(city) === "consolidated" ? "scopeConsolidated" : "scopeMunicipality"])}</small></td><td><strong>${esc(componentLabel(item.component_code))}</strong><small>${esc(item.component_kind)}</small></td><td data-sort-value="${amount}">${esc(componentMoney(item))}</td><td data-sort-value="${item.share_of_headline_pct}">${esc(decimal(item.share_of_headline_pct))} %</td><td>${esc(t[profile === "functional" ? "functionalProfile" : "componentProfile"])}</td><td data-sort-value="${esc(city.period)}">${esc(city.period)}</td></tr>`);
    });
  });
  $("#capital-spending-body").innerHTML = rows.join("");
}

function renderConsolidationOverview() {
  const t = I[state.lang], definitions = [["consolidated","scopeConsolidated"],["city-state","scopeCityState"],["municipality","scopeMunicipality"]];
  $("#consolidation-cards").innerHTML = definitions.map(([kind,label]) => `<article class="scope-${kind}"><span>${esc(t[label])}</span><strong>${state.data.cities.filter((city) => consolidationKind(city) === kind).length}</strong><small>${esc(I[state.lang].citiesCount(state.data.cities.filter((city) => consolidationKind(city) === kind).length))}</small></article>`).join("");
}

function selectCity(cityId, scroll = false) {
  const city = state.data.cities.find((item) => item.city_id === cityId);
  if (!city) return;
  state.selected = cityId; renderTable(); renderDetail(city);
  const url = new URL(location.href); url.searchParams.set("city", cityId); history.replaceState(null, "", `${url.pathname}?${url.searchParams}${url.hash}`);
  if (scroll) $("#city-detail").scrollIntoView({behavior:"smooth", block:"start"});
}

function renderHistory(city) {
  const entityId = CITY_HISTORY_ENTITY[city.city_id];
  const entity = state.history?.cities?.find((item) => item.entity_id === entityId);
  if (!entity) return "";
  const t = I[state.lang], series = entity.series.slice(-10);
  if (series.length !== 10) return "";
  const first = series[0], last = series.at(-1), max = Math.max(...series.flatMap((item) => [item.revenue_actual, item.expense_actual]));
  const revenueGrowth = (last.revenue_actual / first.revenue_actual - 1) * 100;
  const expenseGrowth = (last.expense_actual / first.expense_actual - 1) * 100;
  const surplusYears = series.filter((item) => item.budget_balance > 0).length;
  const width = 960, height = 278, left = 54, right = 18, top = 18, bottom = 38, innerWidth = width - left - right, innerHeight = height - top - bottom, band = innerWidth / series.length, barWidth = Math.min(22, band * .27);
  const y = (value) => top + innerHeight - (value / max) * innerHeight;
  const grid = [0, .5, 1].map((share) => { const value = max * share, yy = y(value); return `<g><line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"/><text x="${left-9}" y="${yy+3}" text-anchor="end">${esc(compactNumber(value))}</text></g>`; }).join("");
  const bars = series.map((item, index) => { const center = left + band * (index + .5), revenueY = y(item.revenue_actual), expenseY = y(item.expense_actual); return `<g><rect class="history-revenue" x="${center-barWidth-2}" y="${revenueY}" width="${barWidth}" height="${top+innerHeight-revenueY}"><title>${item.year} · ${t.revenueLabel}: ${historyMoney(item.revenue_actual)}</title></rect><rect class="history-expense" x="${center+2}" y="${expenseY}" width="${barWidth}" height="${top+innerHeight-expenseY}"><title>${item.year} · ${t.expenditureLabel}: ${historyMoney(item.expense_actual)}</title></rect><text class="history-year" x="${center}" y="${height-13}" text-anchor="middle">${item.year}</text></g>`; }).join("");
  const rows = series.map((item) => `<tr><th scope="row">${item.year}</th><td>${esc(historyMoney(item.revenue_actual))}</td><td>${esc(historyMoney(item.expense_actual))}</td><td class="${item.budget_balance >= 0 ? "positive" : "negative"}">${esc(moneyValues(item.budget_balance,"CZK",true))}</td></tr>`).join("");
  return `<section class="capital-history" aria-labelledby="capital-history-title"><div class="capital-detail-label stage-actual"><span id="capital-history-title"><b class="capital-data-stage actual">${esc(t.actualBadge)}</b>${esc(t.historyTitle)}</span><small>${esc(t.historyKicker)} · 2016–2025</small></div><p class="capital-history-copy">${esc(t.historyCopy)}</p><div class="capital-history-stats"><article><span>${esc(t.historyRevenueGrowth)}</span><strong>${esc(historyPercent(revenueGrowth))}</strong><small>2016 → 2025</small></article><article><span>${esc(t.historyExpenseGrowth)}</span><strong>${esc(historyPercent(expenseGrowth))}</strong><small>2016 → 2025</small></article><article><span>${esc(t.historySurplusYears)}</span><strong>${surplusYears} / ${series.length}</strong><small>${esc(t.historyActual)}</small></article></div><div class="capital-history-legend"><span class="revenue">${esc(t.revenueLabel)}</span><span class="expense">${esc(t.expenditureLabel)}</span><small>${esc(t.historyNominal)}</small></div><div class="capital-history-chart" tabindex="0"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t.historyTitle)} 2016–2025">${grid}${bars}</svg></div><div class="capital-history-table-wrap" tabindex="0"><table class="capital-history-table"><thead><tr><th>${esc(t.historyYear)}</th><th>${esc(t.revenueLabel)}</th><th>${esc(t.expenditureLabel)}</th><th>${esc(t.historyBalance)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="capital-history-source">${esc(t.historySource)}</p></section>`;
}

function renderDetail(city) {
  const t = I[state.lang], population = city.benchmarks.population, tourism = city.benchmarks.tourism, fiscal = city.fiscal_details;
  const flags = [city.eu_capital ? t.euCapital : t.extraLondon];
  if (isStalePopulation(city)) flags.push(t.stalePopulation);
  if (tourismIsLocal(city)) flags.push(t.broaderSource);
  const foreignShare = Number.isFinite(tourism.nights_nonresident_share_pct) ? `${decimal(tourism.nights_nonresident_share_pct)} %` : t.unavailable;
  const balanceClass = fiscal.balance_classification === "surplus" ? "positive" : fiscal.balance_classification === "deficit" ? "negative" : "";
  const balanceNote = state.lang === "en" ? fiscal.balance_note_en : fiscal.balance_note_cs;
  const completeness = fiscal.data_completeness === "detailed" ? t.completenessDetailed : fiscal.data_completeness === "partial" ? t.completenessPartial : t.completenessHeadline;
  const components = visibleComponents(city), allExpenseComponents = components.filter((item) => item.component_kind !== "revenue"), functionalComponents = allExpenseComponents.filter((item) => item.component_kind === "functional"), expenseComponents = functionalComponents.length ? functionalComponents : allExpenseComponents, revenueComponents = components.filter((item) => item.component_kind === "revenue");
  const mix = (title, items) => {
    if (!items.length) return `<article class="capital-mix-panel empty-mix"><h4>${esc(title)}</h4><p>${esc(t.noBreakdown)}</p></article>`;
    const max = Math.max(...items.map((item) => state.currency === "eur" ? item.eur_amount : item.local_amount));
    return `<article class="capital-mix-panel"><h4>${esc(title)} · ${esc(city.period)}</h4><div class="capital-mix-list">${items.map((item) => { const value = state.currency === "eur" ? item.eur_amount : item.local_amount; return `<div class="capital-mix-row" data-kind="${esc(item.component_kind)}"><div><span>${esc(componentLabel(item.component_code))}</span><strong>${esc(componentMoney(item))}</strong></div><i><b style="width:${Math.max(2, value / max * 100)}%"></b></i><small>${esc(decimal(item.share_of_headline_pct))} % ${esc(t.ofDisplayedTotal)} · ${esc(city.period)}</small></div>`; }).join("")}</div></article>`;
  };
  const margin = Number.isFinite(fiscal.balance_margin_pct) ? `${fiscal.balance_margin_pct > 0 ? "+" : ""}${decimal(fiscal.balance_margin_pct)} % ${plannedMarginLabel(city)}` : balanceLabel(fiscal.balance_classification);
  $("#city-detail").innerHTML = `<div class="capital-detail-head"><div><span class="kicker">${esc(t.detailKicker)} · ${esc(city.country_code)}</span><h2>${esc(cityName(city))}</h2><p>${esc(countryName(city))} · ${esc(flags.join(" · "))}</p></div><div class="capital-detail-actions"><a href="${esc(city.landing_page_url)}" target="_blank" rel="noopener">${esc(t.officialSource)}</a><a href="${esc(city.download_url)}" target="_blank" rel="noopener">${esc(t.budgetDocument)}</a></div></div>
    <div class="capital-detail-label stage-plan"><span><b class="capital-data-stage plan">${esc(t.planBadge)}</b>${esc(t.fiscalOverview)}</span><small>${esc(city.period)} · ${esc(planStatus(city))}</small></div>
    <div class="capital-detail-grid fiscal-kpis"><article><span>${esc(t.plannedRevenueLabel)} · ${esc(city.period)}</span><strong>${esc(moneyPayload(fiscal.revenue))}</strong><small>${fiscal.revenue ? esc(t.planBadge + " · " + city.period) : esc(t.unavailable)}</small></article><article><span>${esc(t.plannedExpenditureLabel)} · ${esc(city.period)}</span><strong>${esc(moneyPayload(fiscal.expenditure))}</strong><small>${esc(componentLabel(city.measure))} · ${esc(t.planBadge)}</small></article><article><span>${esc(plannedBalanceLabel(city))} · ${esc(city.period)}</span><strong class="${balanceClass}">${esc(moneyPayload(fiscal.balance, true))}</strong><small>${esc(margin)} · ${esc(city.period)}</small></article><article><span>${esc(t.plannedPerResidentLabel)} · ${esc(city.period)}</span><strong>${esc(moneyPerResident(city))}</strong><small>${esc(t.planBadge)} ${esc(city.period)} / ${esc(t.referenceYear)} ${esc(population.reference_year)}</small></article></div>
    <div class="capital-balance-story ${balanceClass || "unavailable"}"><span>${esc(balanceLabel(fiscal.balance_classification))}</span><p>${esc(balanceNote)}</p></div>
    ${renderHistory(city)}
    <div class="capital-detail-label stage-plan"><span><b class="capital-data-stage plan">${esc(t.planBadge)}</b>${esc(t.spendingStructure)}</span><small>${esc(t.sourceCoverage)} · ${esc(completeness)}</small></div>
    <div class="capital-mix-grid">${mix(t.plannedExpenditureLabel, expenseComponents)}${mix(t.plannedRevenueLabel, revenueComponents)}</div>
    <div class="capital-detail-label stage-context"><span><b class="capital-data-stage context">${esc(t.observedContext)}</b>${esc(t.cityContext)}</span><small>${esc(t.referenceYear)} ${esc(tourism.reference_year)}</small></div>
    <div class="capital-detail-grid context-kpis"><article><span>${esc(t.populationLabel)}</span><strong>${esc(compactNumber(population.value))}</strong><small>${esc(t.referenceYear)} ${esc(population.reference_year)} · ${esc(population.geography_name)}</small></article><article><span>${esc(t.nightsLabel)}</span><strong>${esc(compactNumber(tourism.nights_total))}</strong><small>${esc(t.referenceYear)} ${esc(tourism.reference_year)} · ${esc(tourism.geography_name)}</small></article><article><span>${esc(t.thIntensity)}</span><strong>${esc(decimal(tourism.nights_per_resident))}</strong><small>${esc(tourism.geography_name)}</small></article><article><span>${esc(t.foreignShareLabel)}</span><strong>${esc(foreignShare)}</strong><small>${esc(tourism.geography_scope.replaceAll("_", " "))}</small></article></div>
    <div class="capital-lineage"><div><h3>${esc(t.exactScope)}</h3></div><div><p>${esc(city.scope)}</p><hr><p>${esc(city.notes)}</p></div><div><h3>${esc(t.lineage)}</h3></div><div><p><strong>${esc(city.source_name)}</strong><br><code>${esc(city.measure)} · ${esc(city.amount_precision)} · ${esc(fiscal.balance_basis)}</code></p></div></div>`;
}

function render() {
  translate(); if (!state.data) return;
  $("#stat-cities").textContent = state.data.coverage.city_count;
  $("#stat-currencies").textContent = new Set(state.data.cities.map((city) => city.currency_code)).size;
  renderConsolidationOverview(); renderTable(); if (state.selected) renderDetail(state.data.cities.find((city) => city.city_id === state.selected));
}

function bindControls() {
  $("#capital-search").addEventListener("input", (event) => { state.query = event.target.value; renderTable(); });
  $("#capital-sort").addEventListener("change", (event) => { state.sort = event.target.value; renderTable(); });
  $("#capital-coverage").addEventListener("change", (event) => { state.coverage = event.target.value; renderTable(); });
  document.querySelectorAll("[data-currency]").forEach((button) => button.addEventListener("click", () => { state.currency = button.dataset.currency; document.querySelectorAll("[data-currency]").forEach((item) => item.classList.toggle("active", item === button)); renderTable(); if (state.selected) renderDetail(state.data.cities.find((city) => city.city_id === state.selected)); }));
  document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => { state.lang = window.PSDLanguage?.set(button.dataset.lang, { persist: true }) || button.dataset.lang; const url = new URL(location.href); url.searchParams.set("lang", state.lang); history.replaceState(null, "", `${url.pathname}?${url.searchParams}${url.hash}`); render(); }));
}

Promise.all([
  fetch(DATA_URL).then((response) => { if (!response.ok) throw new Error(`Capital data HTTP ${response.status}`); return response.json(); }),
  fetch("data/large-city-history.v1.json").then((response) => { if (!response.ok) throw new Error(`History data HTTP ${response.status}`); return response.json(); })
]).then(([data, history]) => { state.data = data; state.history = history; bindControls(); render(); const requestedCity = new URLSearchParams(location.search).get("city"); selectCity(data.cities.some((city) => city.city_id === requestedCity) ? requestedCity : "prague-cz"); }).catch((error) => { console.error(error); $("#capital-table-body").innerHTML = `<tr><td colspan="7">Data could not be loaded.</td></tr>`; });
