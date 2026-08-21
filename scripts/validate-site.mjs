import { readFile, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
const capitals = JSON.parse(await readFile("data/eu-capital-budgets.v1.json", "utf8"));
const categoryComparison = JSON.parse(await readFile("data/country-spending-comparison.v1.json", "utf8"));
const sovereign = JSON.parse(await readFile("lib/data/sovereign-benchmark.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
const homepageScript = await readFile("homepage-v2.js", "utf8");
const countryPage = await readFile("country.html", "utf8");
const countryScript = await readFile("country.js", "utf8");
const czechBudgetPage = await readFile("cesky-rozpocet.html", "utf8");
const globalNav = await readFile("global-nav.js", "utf8");
const capitalsScript = await readFile("eu-capitals.js", "utf8");
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (snapshot.scope.combined_unique_entity_count !== 6267) throw new Error("Expected 6,267 unique municipal and regional entities");
if (history.cities.length !== 27 || history.cities.some((city) => city.series.length !== 20)) throw new Error("Expected 20 annual observations for 27 large cities");
const pragueHistory = history.cities.find((city) => city.entity_id === "CZ:00064581")?.series.slice(-10);
if (pragueHistory?.length !== 10 || pragueHistory[0].year !== 2016 || pragueHistory.at(-1).year !== 2025) throw new Error("Expected ten Prague actual-budget years from 2016 through 2025");
if (capitals.cities.length !== 28 || capitals.cities.filter((city) => city.eu_capital).length !== 27) throw new Error("Expected 27 EU capitals plus London");
if (capitals.cities.some((city) => !Number.isFinite(city.budget?.local_amount) || !Number.isFinite(city.budget?.eur_amount) || !city.benchmarks?.population || !city.benchmarks?.tourism)) throw new Error("Incomplete European capitals facts");
if (capitals.cities.some((city) => !city.fiscal_details?.expenditure || !city.fiscal_details?.balance_classification || !Array.isArray(city.fiscal_details?.components))) throw new Error("Incomplete European capital fiscal details");
if (capitals.cities.filter((city) => city.fiscal_details.balance).length < 20) throw new Error("Expected at least twenty sourced capital-city balances");
if (categoryComparison.countries.length !== 10 || categoryComparison.categories.length !== 12) throw new Error("Expected ten countries and twelve common spending categories");
for (const country of categoryComparison.countries) {
  if (country.groups.length !== categoryComparison.categories.length) throw new Error(`${country.code}: incomplete category groups`);
  for (const period of ["previous", "current"]) {
    const grouped = country.groups.reduce((sum, group) => sum + group.amounts[period], 0);
    if (Math.abs(grouped - country.totals[period]) > 0.01) throw new Error(`${country.code}: category comparison does not reconcile for ${period}`);
  }
}
const usaComparison = categoryComparison.countries.find((country) => country.code === "USA");
if (!usaComparison || usaComparison.totals.current < 7000 || usaComparison.totals.current > 8000) throw new Error("USA comparison amounts must be normalized from source millions to billions");
if (!homepage.includes('href="eu-capitals.html?lang=cs"') || !homepage.includes('data-i18n="capitalsCta"')) throw new Error("Homepage must expose the European capitals comparison");
if (!homepage.includes('id="category-comparison-root"') || !homepage.includes('homepage-category.js?v=20260821') || !homepage.includes('homepage-category.css?v=20260821')) throw new Error("Homepage must expose the country category comparison");
if (!globalNav.includes('class="capitals-nav-icon"') || !globalNav.includes('data-global-nav="capitals"')) throw new Error("Global navigation must expose the European capitals icon");
if (!capitalsScript.includes('data/large-city-history.v1.json') || !capitalsScript.includes('renderHistory(city)')) throw new Error("European capitals must surface the Prague ten-year history");
const fiscalFields = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp", "gross_debt_pct_gdp", "nominal_gdp_local_bn", "nominal_gdp_usd_bn", "inflation_pct"];
if (sovereign.series.some((country) => fiscalFields.some((field) => !country.metrics[field]?.values?.length))) throw new Error("Country profiles require complete nominal and inflation fiscal series");
if (sovereign.schema_version !== "1.1.0" || sovereign.fiscal_perimeters?.comparison_scope !== "general_government" || sovereign.fiscal_perimeters?.perimeters?.length !== 3) throw new Error("Sovereign benchmark must declare all three fiscal perimeters and the comparison scope");
if (sovereign.countries.some((country) => !country.fiscal_architecture?.national_budget_label_cs || !country.fiscal_architecture?.architecture_cs || !country.fiscal_architecture?.corporation_note_cs || country.fiscal_architecture?.sources?.length < 1)) throw new Error("Every tracked country must describe its national fiscal architecture and public-corporation treatment");
if (!countryPage.includes('data-chart-view="real"') || !countryPage.includes('country.js?v=20260821-fiscal-scope-health8') || !countryScript.includes("function fiscalAmount")) throw new Error("Country profiles must expose the dynamic inflation-adjusted chart view");
if (!countryPage.includes('id="scope-perimeter-grid"') || !countryScript.includes("function scopeProfile") || !countryScript.includes("fiscal_architecture")) throw new Error("Country profiles must visibly distinguish fiscal perimeters and country architecture");
if (!czechBudgetPage.includes('class="fiscal-perimeter-map"') || !czechBudgetPage.includes('class="fiscal-series-scope"') || !czechBudgetPage.includes('class="enterprise-nonadditivity-note"') || !czechBudgetPage.includes('class="benchmark-scope-contract"')) throw new Error("Czech budget must disclose the scope and non-additivity of every fiscal layer");
if (!czechBudgetPage.includes('styles.css?v=20260821-fiscal-scope') || !czechBudgetPage.includes('app.js?v=20260821-fiscal-scope') || !czechBudgetPage.includes('budget-i18n.js?v=20260821-fiscal-scope')) throw new Error("Czech budget scope assets must be cache-busted");
if (!homepageScript.includes("country.html?code=") || homepageScript.includes('code==="CZE"?')) throw new Error("Every country card must use the shared dynamic country profile");
if (!homepage.includes('href="cz/mesta/?lang=cs"') || !homepage.includes('data-i18n="citiesCta"') || !homepage.includes('data-i18n="cityHeroCta"')) throw new Error("Homepage must prominently expose Czech cities");
if (!homepage.includes('styles-v2.css?v=20260821-fiscal-scope') || !homepage.includes('homepage-v2.js?v=20260821-fiscal-scope') || !homepage.includes('global-nav.js?v=20260820-capitals-history')) throw new Error("Homepage assets must be cache-busted for the current fiscal-scope release");
if (!homepage.includes('class="compare-scope-readout"') || !homepage.includes("General government")) throw new Error("Homepage comparison must state its harmonised fiscal perimeter");
if (!homepage.includes('id="fiscal-architecture-body"') || !homepageScript.includes("function architectureTable")) throw new Error("Homepage must compare fiscal architecture across all tracked countries");
if (!countryPage.includes('country-spending.js?v=20260821') || !countryPage.includes('country-health.js?v=20260821-health8') || !countryScript.includes('countryprofilechange')) throw new Error("Fiscal profiles must preserve the spending and healthcare modules");
for (const required of ["index.html", "homepage-category.js", "homepage-category.css", "data/country-spending-comparison.v1.json", "eu-capitals.html", "eu-capitals.js", "eu-capitals.css", "country-spending.js", "country-health.js", "data/country-spending-2025-2026.v1.json", "data/country-health.v1.json", "cz/obce/index.html", "cz/mesta/index.html", "municipal-i18n.js", "sitemap.xml"]) await stat(required);
console.log("CZ Budget site validation passed");
