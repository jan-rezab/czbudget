import { readFile, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
const capitals = JSON.parse(await readFile("data/eu-capital-budgets.v1.json", "utf8"));
const categoryComparison = JSON.parse(await readFile("data/country-spending-comparison.v1.json", "utf8"));
const functionalBudgets = JSON.parse(await readFile("data/country-functional-budgets.v1.json", "utf8"));
const roadNetworks = JSON.parse(await readFile("data/road-network-history.v1.json", "utf8"));
const countryCashIn = JSON.parse(await readFile("data/country-cash-in.v1.json", "utf8"));
const countryHealth = JSON.parse(await readFile("data/country-health.v1.json", "utf8"));
const countryParity = JSON.parse(await readFile("data/country-parity.v1.json", "utf8"));
const sovereign = JSON.parse(await readFile("lib/data/sovereign-benchmark.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
const comparisonPage = await readFile("comparison.html", "utf8");
const methodologyPage = await readFile("methodology.html", "utf8");
const aboutPage = await readFile("about.html", "utf8");
const homepageScript = await readFile("homepage-v2.js", "utf8");
const countryPage = await readFile("country.html", "utf8");
const countryScript = await readFile("country.js", "utf8");
const countryFunctionsScript = await readFile("country-functions.js", "utf8");
const deepDivePage = await readFile("deep-dives/index.html", "utf8");
const transportDeepDivePage = await readFile("deep-dives/transportation/index.html", "utf8");
const healthDeepDivePage = await readFile("deep-dives/health/index.html", "utf8");
const czechBudgetPage = await readFile("cesky-rozpocet.html", "utf8");
const czechBudgetScript = await readFile("app.js", "utf8");
const demography = JSON.parse(await readFile("data/demography-social.v1.json", "utf8"));
const globalNav = await readFile("global-nav.js", "utf8");
const capitalsScript = await readFile("eu-capitals.js", "utf8");
const cloudbuild = await readFile("cloudbuild.yaml", "utf8");
const municipalI18n = await readFile("municipal-i18n.js", "utf8");
const languageBootstrap = await readFile("language-bootstrap.js", "utf8");
const internationalMunicipalities = JSON.parse(await readFile("data/international-municipalities.v1.json", "utf8"));
const internationalMunicipalPage = await readFile("municipalities/index.html", "utf8");
const czechMunicipalPage = await readFile("municipalities/czechia/index.html", "utf8");
const internationalMunicipalScript = await readFile("municipalities.js", "utf8");
const municipalityCountryScript = await readFile("municipalities-country.js", "utf8");
const municipalityCountrySlugs = ["poland", "denmark", "france", "sweden", "england", "ukraine"];
const municipalityCountryPages = await Promise.all(municipalityCountrySlugs.map((slug) => readFile(`municipalities/${slug}/index.html`, "utf8")));
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (internationalMunicipalities.countries.length !== 7 || internationalMunicipalities.entities.length < 14000) throw new Error("Expected seven-country municipality directory with at least 14,000 entities");
const franceMunicipalities = internationalMunicipalities.countries.find((country) => country.code === "FRA");
if (franceMunicipalities?.status !== "complete" || franceMunicipalities.directory_count < 34000) throw new Error("Expected complete French commune coverage");
if (!internationalMunicipalPage.includes('id="type-filter"') || !internationalMunicipalPage.includes('value="capital"') || !internationalMunicipalPage.includes('id="country-filter"') || !internationalMunicipalPage.includes('id="municipality-grid"') || !internationalMunicipalScript.includes("renderDirectory") || !internationalMunicipalScript.includes("city.eu_capital")) throw new Error("Municipality hub must expose country and EU-capital filters");
if (!czechMunicipalPage.includes('id="cz-insight-grid"') || !czechMunicipalPage.includes('data-destination="directory"') || !czechMunicipalPage.includes('data-destination="cities"')) throw new Error("Czechia municipality detail must expose insights and downstream municipal views");
if (!internationalMunicipalPage.includes('id="municipality-country-switch"') || !czechMunicipalPage.includes('id="municipality-country-switch"')) throw new Error("Municipality hub and Czechia detail must expose the seven-country navigator");
if (municipalityCountryPages.some((page) => !page.includes('municipalities-country.js') || !page.includes('id="country-insight-grid"') || !page.includes('id="country-municipality-grid"')) || !municipalityCountryScript.includes("const profiles=") || !municipalityCountryScript.includes("renderDirectory")) throw new Error("Every covered country must have an insight-led municipality homepage and directory");
if (snapshot.scope.combined_unique_entity_count !== 6267) throw new Error("Expected 6,267 unique municipal and regional entities");
if (history.cities.length !== 27 || history.cities.some((city) => city.series.length !== 20)) throw new Error("Expected 20 annual observations for 27 large cities");
const pragueHistory = history.cities.find((city) => city.entity_id === "CZ:00064581")?.series.slice(-10);
if (pragueHistory?.length !== 10 || pragueHistory[0].year !== 2016 || pragueHistory.at(-1).year !== 2025) throw new Error("Expected ten Prague actual-budget years from 2016 through 2025");
if (capitals.cities.length !== 28 || capitals.cities.filter((city) => city.eu_capital).length !== 27) throw new Error("Expected 27 EU capitals plus London");
if (capitals.cities.some((city) => !Number.isFinite(city.budget?.local_amount) || !Number.isFinite(city.budget?.eur_amount) || !city.benchmarks?.population || !city.benchmarks?.tourism)) throw new Error("Incomplete European capitals facts");
if (capitals.cities.some((city) => !city.fiscal_details?.expenditure || !city.fiscal_details?.balance_classification || !Array.isArray(city.fiscal_details?.components))) throw new Error("Incomplete European capital fiscal details");
if (capitals.cities.filter((city) => city.fiscal_details.balance).length < 20) throw new Error("Expected at least twenty sourced capital-city balances");
if (categoryComparison.countries.length !== 10 || categoryComparison.categories.length !== 12) throw new Error("Expected ten countries and twelve common spending categories");
if (Object.keys(functionalBudgets.countries).length !== 10) throw new Error("Expected functional budgets for all ten countries");
if (Object.keys(countryHealth.countries).length !== 9 || countryHealth.countries.UKR) throw new Error("Expected nine harmonised health-system profiles with Ukraine excluded");
if (countryParity.contract !== "country-parity.v1" || countryParity.countries.length !== 10) throw new Error("Expected the ten-country parity contract");
if (countryParity.countries.some((country) => country.modules.sovereign.status !== "loaded" || country.modules.administrative_spending.status !== "loaded" || country.modules.functional_spending.status !== "loaded" || country.modules.transport.status !== "loaded")) throw new Error("Every country must load the shared national fiscal modules");
if (countryParity.countries.filter((country) => country.modules.municipalities.status === "loaded").length !== 7) throw new Error("Expected seven loaded municipal censuses");
for (const code of ["CZE", "FRA", "GBR", "USA"]) if (countryParity.countries.find((country) => country.country_code === code)?.modules.providers.status !== "loaded") throw new Error(`Expected loaded provider register for ${code}`);
if (roadNetworks.countries.length !== 10 || !roadNetworks.construction_history_status.includes("annual net stock change")) throw new Error("Expected ten-country road histories with an explicit construction proxy caveat");
for (const country of roadNetworks.countries) {
  if (!country.road_network?.series?.length || !country.motorways?.series?.length || country.motorways.series.some((point) => !Number.isFinite(point.km))) throw new Error(`${country.code}: incomplete road or motorway history`);
}
if (Object.keys(countryCashIn.countries).length !== 10 || !countryCashIn.countries.CZE.layers?.municipalities?.revenue_local_bn || !countryCashIn.countries.CZE.layers?.companies?.turnover_local_bn) throw new Error("Expected consolidated revenue for ten countries and Czech territorial/company cash-in layers");
if (countryCashIn.countries.CZE.layers.municipalities.entity_count !== 6254 || countryCashIn.countries.CZE.layers.companies.entity_count !== 38) throw new Error("Unexpected Czech municipality or state-company cash-in coverage");
for (const [code, country] of Object.entries(functionalBudgets.countries)) {
  for (const category of ["health", "social", "transport"]) {
    const series = country.categories[category];
    if (series.length !== 10 || series[0].year !== 2015 || series.at(-1).year !== 2024 || series.some((point) => !Number.isFinite(point.pct_gdp))) throw new Error(`${code}: incomplete 2015–2024 ${category} series`);
  }
}
for (const country of categoryComparison.countries) {
  if (country.groups.length !== categoryComparison.categories.length) throw new Error(`${country.code}: incomplete category groups`);
  for (const period of ["previous", "current"]) {
    const grouped = country.groups.reduce((sum, group) => sum + group.amounts[period], 0);
    if (Math.abs(grouped - country.totals[period]) > 0.01) throw new Error(`${country.code}: category comparison does not reconcile for ${period}`);
  }
}
const usaComparison = categoryComparison.countries.find((country) => country.code === "USA");
if (!usaComparison || usaComparison.totals.current < 7000 || usaComparison.totals.current > 8000) throw new Error("USA comparison amounts must be normalized from source millions to billions");
if (homepage.includes('data-i18n="capitalsCta"') || homepage.includes('data-i18n="citiesCta"') || homepage.includes('data-i18n="intlMunicipalCta"')) throw new Error("Municipality destinations must live on the municipality hub, not the homepage");
if (!homepage.includes('id="category-comparison-root"') || !homepage.includes('homepage-category.js?v=20260821-benchmark-flags') || !homepage.includes('homepage-category.css?v=20260821-benchmark-flags')) throw new Error("Homepage must expose the country category comparison");
if (!homepage.includes("language-bootstrap.js") || !languageBootstrap.includes("data-language-pending") || !languageBootstrap.includes("MutationObserver")) throw new Error("English must be selected before the first visible paint");
if (!globalNav.includes('municipalities/?lang=${lang}') || globalNav.includes('data-global-nav="capitals"')) throw new Error("Global navigation must expose one consolidated municipality destination");
if (!globalNav.includes('class="deep-dive-menu"') || !globalNav.includes('deep-dives/transportation/')) throw new Error("Global navigation must expose the dedicated deep-dive hierarchy");
if (!deepDivePage.includes('href="health/?code=CZE"') || !transportDeepDivePage.includes('id="deep-dive-country"') || !transportDeepDivePage.includes('id="country-function-transport"') || !healthDeepDivePage.includes('data-country-codes="CZE,DEU,DNK,FRA,GBR,POL,SWE,CHE,USA"') || !healthDeepDivePage.includes('id="country-function-health"') || !healthDeepDivePage.includes('id="healthcare-system"') || !healthDeepDivePage.includes('id="hospital-benchmark"')) throw new Error("Deep dives must expose dedicated transportation and nine-country health profiles");
if (!cloudbuild.includes("scripts/assert-single-production.sh") || !cloudbuild.includes("scripts/deploy-immutable.sh") || !cloudbuild.includes("- czbudget-public") || cloudbuild.includes("${_SERVICE}") || cloudbuild.includes("czbudget-web")) throw new Error("Cloud Build must be locked to the sole canonical production service");
if (!cloudbuild.includes("scripts/merge-municipal-breakdowns.mjs") || !municipalI18n.includes("renderBudgetBreakdown") || !municipalI18n.includes("municipal-budget-codebook.v1.json")) throw new Error("Municipal profiles must surface the detailed FIN 2-12 M breakdown");
if (!capitalsScript.includes('data/large-city-history.v1.json') || !capitalsScript.includes('renderHistory(city)')) throw new Error("European capitals must surface the Prague ten-year history");
const fiscalFields = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp", "gross_debt_pct_gdp", "nominal_gdp_local_bn", "nominal_gdp_usd_bn", "inflation_pct"];
if (sovereign.series.some((country) => fiscalFields.some((field) => !country.metrics[field]?.values?.length))) throw new Error("Country profiles require complete nominal and inflation fiscal series");
if (sovereign.schema_version !== "1.1.0" || sovereign.fiscal_perimeters?.comparison_scope !== "general_government" || sovereign.fiscal_perimeters?.perimeters?.length !== 3) throw new Error("Sovereign benchmark must declare all three fiscal perimeters and the comparison scope");
if (sovereign.countries.some((country) => !country.fiscal_architecture?.national_budget_label_cs || !country.fiscal_architecture?.architecture_cs || !country.fiscal_architecture?.corporation_note_cs || country.fiscal_architecture?.sources?.length < 1)) throw new Error("Every tracked country must describe its national fiscal architecture and public-corporation treatment");
if (!countryPage.includes('data-chart-view="real"') || !countryPage.includes('country.js?v=20260821-benchmark-flags') || !countryScript.includes("function fiscalAmount")) throw new Error("Country profiles must expose the dynamic inflation-adjusted chart view");
if (!countryPage.includes('id="scope-perimeter-grid"') || !countryScript.includes("function scopeProfile") || !countryScript.includes("fiscal_architecture")) throw new Error("Country profiles must visibly distinguish fiscal perimeters and country architecture");
if (!czechBudgetPage.includes('class="fiscal-perimeter-map"') || !czechBudgetPage.includes('class="fiscal-series-scope"') || !czechBudgetPage.includes('class="enterprise-nonadditivity-note"') || !czechBudgetPage.includes('class="benchmark-scope-contract"')) throw new Error("Czech budget must disclose the scope and non-additivity of every fiscal layer");
if (!czechBudgetPage.includes('styles.css?v=20260821-fiscal-scope') || !czechBudgetPage.includes('app.js?v=20260821-annual-system-cost-baseline') || !czechBudgetPage.includes('budget-i18n.js?v=20260821-annual-system-cost-baseline')) throw new Error("Czech budget assets must be cache-busted");
if (!czechBudgetPage.includes('id="model-system-cost"') || !czechBudgetPage.includes('id="model-system-cost-note"') || !czechBudgetPage.includes('id="system-cost-chart"')) throw new Error("Demographic model must expose absolute annual system costs and their baseline");
if (!czechBudgetScript.includes('d=>d.pension],["health","Zdravotnictví",d=>d.health],["care","Péče",d=>d.care]') || /pensionExtra|healthExtra|careExtra/.test(czechBudgetScript)) throw new Error("Annual system costs must use absolute modeled expenditure, not changes from 2025");
for (const key of ["pension_expense", "pension_income", "health_expense", "care_allowance"]) if (!Number.isFinite(demography.base_2025?.[key]) || demography.base_2025[key] <= 0) throw new Error(`Demographic base amount ${key} must be positive`);
if (!czechBudgetScript.includes("requiredBaseAmounts") || !czechBudgetScript.includes("pension_age_sensitive_share:pensionAgeShare")) throw new Error("Demographic calculations must validate base amounts and use declared model assumptions");
if (!homepageScript.includes("country.html?code=") || homepageScript.includes('code==="CZE"?')) throw new Error("Every country card must use the shared dynamic country profile");
if (!czechMunicipalPage.includes('municipalities-czechia.js') || !internationalMunicipalScript.includes('CZE:"czechia"')) throw new Error("Municipality hub must link to the Czechia detail route");
if (!homepage.includes('styles-v2.css?v=20260822-brand') || !homepage.includes('homepage-v2.js?v=20260822-separate-pages') || !homepage.includes('global-nav.js?v=20260822-separate-pages')) throw new Error("Homepage assets must be cache-busted for the current information architecture release");
if (homepage.includes('id="compare"') || homepage.includes('id="method"') || !comparisonPage.includes('id="benchmark-overview"') || !comparisonPage.includes('id="benchmark-country"') || !homepageScript.includes("function benchmark")) throw new Error("Comparison and methodology must be separated from the homepage");
if (globalNav.includes('code === "CZE"') || !globalNav.includes('assets/flags/${flags[code]}.svg') || !countryScript.includes("czech-view-grid")) throw new Error("Country navigation must use shared profiles, SVG flags, and both Czech detail views");
if (!comparisonPage.includes('class="compare-scope-readout"') || !comparisonPage.includes("General government")) throw new Error("Comparison page must state its harmonised fiscal perimeter");
if (!comparisonPage.includes('id="fiscal-architecture-body"') || !homepageScript.includes("function architectureTable")) throw new Error("Comparison page must compare fiscal architecture across all tracked countries");
if (!methodologyPage.includes('class="method-grid-expanded"') || !aboutPage.includes("Hlídač státu, z.ú.") || !homepage.includes("data-global-footer") || !internationalMunicipalPage.includes("data-global-footer")) throw new Error("Dedicated methodology, About, and global project credits must be present");
if (!countryPage.includes('country-spending.js?v=20260821') || !countryPage.includes('country-health.js?v=20260822-czech-flow') || !countryPage.includes('country-providers.js?v=20260822-network') || !countryPage.includes('country-functions.js?v=20260822-transport-deep-dive') || !countryPage.includes('country-cash-in.js?v=20260822-cash-in') || !countryPage.includes('country-parity.js?v=20260822-parity-contract') || !countryPage.includes('id="data-parity"') || !countryPage.includes('id="cash-in"') || !countryPage.includes('id="provider-network"') || !countryPage.includes('id="social-system"') || !countryPage.includes('id="transportation"') || !countryScript.includes('countryprofilechange')) throw new Error("Fiscal profiles must preserve parity, cash-in, spending, healthcare, provider, social and transport modules");
if (!countryFunctionsScript.includes("function renderTransport") || !countryFunctionsScript.includes("transport-comparison") || !countryFunctionsScript.includes("stockNotBuild") || !countryFunctionsScript.includes("function transportBudgetDetail")) throw new Error("Transportation must expose the network and detailed-budget deep dive with the net-stock caveat");
for (const required of ["index.html", "comparison.html", "methodology.html", "about.html", "site-pages.js", "site-pages.css", "global-footer.js", "global-footer.css", "homepage-category.js", "homepage-category.css", "deep-dives/index.html", "deep-dives/transportation/index.html", "deep-dives.js", "deep-dives.css", "data/country-parity.v1.json", "data/contracts/country-parity.schema.json", "data/country-spending-comparison.v1.json", "data/country-functional-budgets.v1.json", "data/road-network-history.v1.json", "data/country-cash-in.v1.json", "data/country-provider-networks.v1.json", "data/international-municipalities.v1.json", "data/municipal-size-benchmark.v1.json", "municipalities.html", "municipalities/index.html", "municipalities/czechia/index.html", "municipalities.js", "municipalities-czechia.js", "municipalities.css", "municipalities-navigator.css", "eu-capitals.html", "eu-capitals.js", "eu-capitals.css", "country-parity.js", "country-parity.css", "country-spending.js", "country-health.js", "country-providers.js", "country-functions.js", "country-functions.css", "country-cash-in.js", "country-cash-in.css", "data/country-spending-2025-2026.v1.json", "data/country-health.v1.json", "cz/obce/index.html", "cz/mesta/index.html", "municipal-i18n.js", "scripts/build-country-parity.mjs", "scripts/build-country-functional-budgets.mjs", "pipeline/transforms/prepare_road_network_history.py", "scripts/build-country-cash-in.mjs", "scripts/build-country-provider-networks.mjs", "scripts/export-municipal-breakdowns.sql", "scripts/export-municipal-budget-codebook.sql", "scripts/merge-municipal-breakdowns.mjs", "sitemap.xml", ...["cz","de","dk","fr","gb","pl","se","ch","ua","us"].map((code)=>`assets/flags/${code}.svg`)]) await stat(required);
await stat("scripts/build-municipality-country-pages.mjs");
await stat("data/transport-budget-detail.v1.json");
await stat("scripts/build-transport-budget-detail.mjs");
console.log("CZ Budget site validation passed");
