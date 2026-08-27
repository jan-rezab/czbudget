import { readFile, readdir, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
const capitals = JSON.parse(await readFile("data/eu-capital-budgets.v1.json", "utf8"));
const categoryComparison = JSON.parse(await readFile("data/country-spending-comparison.v1.json", "utf8"));
const administrativeSpending = JSON.parse(await readFile("data/country-spending-2025-2026.v1.json", "utf8"));
const functionalBudgets = JSON.parse(await readFile("data/country-functional-budgets.v1.json", "utf8"));
const compareMetrics = JSON.parse(await readFile("data/compare-metrics.v1.json", "utf8"));
const healthAssignments = JSON.parse(await readFile("data/health-system-assignments.v1.json", "utf8"));
const roadNetworks = JSON.parse(await readFile("data/road-network-history.v1.json", "utf8"));
const transportPerformance = JSON.parse(await readFile("data/transport-performance.v1.json", "utf8"));
const countryCashIn = JSON.parse(await readFile("data/country-cash-in.v1.json", "utf8"));
const countryRevenue = JSON.parse(await readFile("data/country-revenue.v1.json", "utf8"));
const countryHealth = JSON.parse(await readFile("data/country-health.v1.json", "utf8"));
const countryHealthPerformance = JSON.parse(await readFile("data/country-health-performance.v1.json", "utf8"));
const dataQuality = JSON.parse(await readFile("data/data-quality-report.v1.json", "utf8"));
const publicEntityHistory = JSON.parse(await readFile("data/cz-public-entity-history.v1.json", "utf8"));
const countryParity = JSON.parse(await readFile("data/country-parity.v1.json", "utf8"));
const countryDemography = JSON.parse(await readFile("data/country-demography.v1.json", "utf8"));
const publicEntityCoverage = JSON.parse(await readFile("data/public-entity-coverage.v1.json", "utf8"));
const publicEntityAggregates = JSON.parse(await readFile("data/public-entity-aggregates.v1.json", "utf8"));
const publicEntityDirectory = JSON.parse(await readFile("data/public-entity-directory/manifest.v1.json", "utf8"));
const methodologySources = JSON.parse(await readFile("data/methodology-sources.v1.json", "utf8"));
const coverageSourceResearch = JSON.parse(await readFile("data/coverage-source-research.v1.json", "utf8"));
const sovereign = JSON.parse(await readFile("lib/data/sovereign-benchmark.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
const comparisonPage = await readFile("comparison.html", "utf8");
const methodologyPage = await readFile("methodology.html", "utf8");
const municipalTransparencyScript = await readFile("municipal-transparency.js", "utf8");
const municipalTransparencyStyles = await readFile("municipal-transparency.css", "utf8");
const aboutPage = await readFile("about.html", "utf8");
const homepageScript = await readFile("homepage-v2.js", "utf8");
const countryPage = await readFile("country.html", "utf8");
const countryHealthPerformanceScript = await readFile("country-health-performance.js", "utf8");
const czechHistoryScript = await readFile("cz-history.js", "utf8");
const czechEnterprisePage = await readFile("cesko.html", "utf8");
const czechEnterpriseScript = await readFile("cz-firmy.js", "utf8");
const countryScript = await readFile("country.js", "utf8");
const countryFunctionsScript = await readFile("country-functions.js", "utf8");
const countryInsightsScript = await readFile("country-insights.js", "utf8");
const countryPublicEntitiesScript = await readFile("country-public-entities.js", "utf8");
const countryDashboardScript = await readFile("country-dashboard.js", "utf8");
const countryCashInScript = await readFile("country-cash-in.js", "utf8");
const deepDivePage = await readFile("deep-dives/index.html", "utf8");
const transportDeepDivePage = await readFile("deep-dives/transportation/index.html", "utf8");
const healthDeepDivePage = await readFile("deep-dives/health/index.html", "utf8");
const stateEnterpriseDeepDivePage = await readFile("deep-dives/state-owned-enterprises/index.html", "utf8");
const capitalCitiesDeepDivePage = await readFile("deep-dives/capital-cities/index.html", "utf8");
const capitalCitiesDeepDiveScript = await readFile("capital-cities-deep-dive.js", "utf8");
const ageingDeepDivePage = await readFile("deep-dives/ageing/index.html", "utf8");
const ageingDeepDiveScript = await readFile("ageing-bill.js", "utf8");
const stateEnterpriseCatalogue = JSON.parse(await readFile("data/state-owned-enterprises.v1.json", "utf8"));
const revenueDeepDivePage = await readFile("deep-dives/revenue/index.html", "utf8");
const revenueDeepDiveScript = await readFile("revenue-deep-dive.js", "utf8");
const migrationDeepDivePage = await readFile("deep-dives/migration/index.html", "utf8");
const migrationDeepDiveScript = await readFile("migration-deep-dive.js", "utf8");
const euMigration = JSON.parse(await readFile("data/eu-migration.v1.json", "utf8"));
const defenseDeepDivePage = await readFile("deep-dives/defense/index.html", "utf8");
const defenseDeepDiveScript = await readFile("defense-deep-dive.js", "utf8");
const defenseDeepDive = JSON.parse(await readFile("data/defense-deep-dive.v1.json", "utf8"));
const dataFreshnessScript = await readFile("data-freshness.js", "utf8");
const dataFreshness = JSON.parse(await readFile("data/data-freshness.v1.json", "utf8"));
const czechBudgetPage = await readFile("cesky-rozpocet.html", "utf8");
const czechBudgetScript = await readFile("app.js", "utf8");
const demography = JSON.parse(await readFile("data/demography-social.v1.json", "utf8"));
const globalNav = await readFile("global-nav.js", "utf8");
const globalFooter = await readFile("global-footer.js", "utf8");
const globalFooterStyles = await readFile("global-footer.css", "utf8");
const countryRoutes = await readFile("country-routes.js", "utf8");
const countryParityStyles = await readFile("country-parity.css", "utf8");
const nginx = await readFile("nginx.conf.template", "utf8");
const headerStyles = await readFile("site-header.css", "utf8");
const czechSiteGenerator = await readFile("pipeline/transforms/build_czech_site.py", "utf8");
const capitalsScript = await readFile("eu-capitals.js", "utf8");
const cloudbuild = await readFile("cloudbuild.yaml", "utf8");
const municipalI18n = await readFile("municipal-i18n.js", "utf8");
const languageBootstrap = await readFile("language-bootstrap.js", "utf8");
const internationalMunicipalities = JSON.parse(await readFile("data/international-municipalities.v1.json", "utf8"));
const municipalItemizedCoverage = JSON.parse(await readFile("data/municipal-itemized-coverage.v1.json", "utf8"));
const internationalItemizedWarehouse = JSON.parse(await readFile("data/international-itemized-warehouse.v1.json", "utf8"));
const municipalItemizedAcquisitionAudit = JSON.parse(await readFile("data/municipal-itemized-acquisition-audit.v1.json", "utf8"));
const municipalTransparency = JSON.parse(await readFile("data/municipal-transparency.v1.json", "utf8"));
const globalBudgetTransparency = JSON.parse(await readFile("data/global-budget-transparency.v1.json", "utf8"));
const benchmarkMunicipalities = await Promise.all(["nor", "nld", "fin"].map((code) => readFile(`data/municipal-benchmarks/${code}.json`, "utf8").then(JSON.parse)));
const norwayBenchmarkProfile = JSON.parse(await readFile("data/municipal-benchmarks/nor/0301.json", "utf8"));
const netherlandsBenchmarkProfile = JSON.parse(await readFile("data/municipal-benchmarks/nld/0363.json", "utf8"));
const finlandBenchmarkProfile = JSON.parse(await readFile("data/municipal-benchmarks/fin/091.json", "utf8"));
const denmarkExpansionProfile = JSON.parse(await readFile("data/municipal-expansion/dnk/101.json", "utf8"));
const spainExpansionProfile = JSON.parse(await readFile("data/municipal-expansion/esp/40001AA000.json", "utf8"));
const japanExpansionProfile = JSON.parse(await readFile("data/municipal-expansion/jpn/011002.json", "utf8"));
const brazilExpansionProfile = JSON.parse(await readFile("data/municipal-expansion/bra/5200555.json", "utf8"));
const internationalMunicipalPage = await readFile("municipalities/index.html", "utf8");
const czechMunicipalPage = await readFile("municipalities/czechia/index.html", "utf8");
const internationalMunicipalScript = await readFile("municipalities.js", "utf8");
const municipalityCountryScript = await readFile("municipalities-country.js", "utf8");
const municipalityCountrySlugs = ["poland", "denmark", "france", "sweden", "england", "ukraine", "norway", "netherlands", "finland", "brazil", "spain", "japan", "colombia", "georgia", "italy", "bolivia", "el-salvador", "mexico", "costa-rica", "guatemala", "peru", "south-korea", "chile"];
const municipalityCountryPages = await Promise.all(municipalityCountrySlugs.map((slug) => readFile(`municipalities/${slug}/index.html`, "utf8")));
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (internationalMunicipalities.countries.length !== 27 || internationalMunicipalities.entities.length !== 105582) throw new Error("Expected 27-country municipality directory with 105,582 entity rows");
const requiredInternationalItemized = ["POL", "DNK", "UKR", "FRA", "SWE", "GBR", "DEU", "USA", "CHE"];
if (municipalItemizedCoverage.countries.length !== 27) throw new Error("Expected itemized municipal coverage for twenty-seven countries");
for (const code of requiredInternationalItemized) {
  const country = municipalItemizedCoverage.countries.find((row) => row.code === code);
  if (!country || country.profile_count <= 0) throw new Error(`Expected deployed itemized municipal profiles for ${code}`);
}
for (const [code, entities, lineFacts, balanceFacts = 0] of [["GBR",374,552003],["DEU",11,1152009],["CHE",80,64185],["FRA",35042,10445528,14147797],["PRY",263,281957]]) {
  const country = internationalItemizedWarehouse.countries.find((row) => row.code === code);
  if (!country || country.profile_count !== entities || country.line_fact_count !== lineFacts || country.balance_fact_count !== balanceFacts) throw new Error(`${code}: production itemized-warehouse verification snapshot mismatch`);
}
if (municipalItemizedAcquisitionAudit.production_load?.status !== "loaded" || municipalItemizedAcquisitionAudit.production_load?.bundles_loaded !== 6) throw new Error("Municipal itemized acquisition audit must record the completed six-bundle production load");
if (dataQuality.counts.published_data_entries !== 402309 || Object.values(dataQuality.published_entry_components||{}).reduce((sum, count) => sum + count, 0) !== 402309) throw new Error("Expected 402,309 published registry, history, directory and itemized-profile entries");
if (municipalItemizedCoverage.countries.find((country) => country.code === "CZE")?.profile_count !== 6254 || municipalItemizedCoverage.countries.find((country) => country.code === "USA")?.profile_count !== 4 || municipalItemizedCoverage.countries.find((country) => country.code === "DEU")?.status !== "partial") throw new Error("Itemized municipal coverage must preserve full and partial profile-level detail honestly");
if (benchmarkMunicipalities.reduce((sum, country) => sum + country.entities.length, 0) !== 1010) throw new Error("Expected 1,010 Nordic and Dutch municipal benchmark profiles");
for (const [code, expected] of [["DNK",98],["ESP",6198],["JPN",1741]]) {
  const country = internationalMunicipalities.countries.find((item) => item.code === code);
  if (!country || country.status !== "complete" || country.directory_count !== expected || internationalMunicipalities.entities.filter((item) => item.country === code && item.url).length !== expected) throw new Error(`${code}: incomplete municipality directory or profile routes`);
}
for (const [code, expected, status] of [["COL",1102,"complete"],["GEO",69,"complete"],["ITA",7896,"complete"],["BOL",343,"complete"],["SLV",259,"partial"],["MEX",2380,"partial"],["CRI",84,"complete"],["GTM",340,"complete"],["PER",1891,"complete"],["KOR",243,"complete"],["CHL",345,"complete"]]) {
  const country = internationalMunicipalities.countries.find((item) => item.code === code);
  if (!country || country.status !== status || country.directory_count !== expected || internationalMunicipalities.entities.filter((item) => item.country === code && item.url).length !== expected) throw new Error(`${code}: unexpected municipality count, coverage status or profile routes`);
}
const brazilMunicipalities = internationalMunicipalities.countries.find((item) => item.code === "BRA");
if (!brazilMunicipalities || brazilMunicipalities.status !== "partial" || brazilMunicipalities.directory_count !== 5570 || brazilMunicipalities.rreo_2025_count !== 5513 || brazilMunicipalities.dca_2024_fallback_count !== 44 || brazilMunicipalities.missing_finance_count !== 13 || internationalMunicipalities.entities.filter((item) => item.country === "BRA" && item.url).length !== 5570) throw new Error("Brazil must expose all directory routes and the exact RREO/DCA/missing split");
if (denmarkExpansionProfile.detail.length < 5000 || !new Set(denmarkExpansionProfile.detail.map((row) => row.stage)).has("enacted") || !new Set(denmarkExpansionProfile.detail.map((row) => row.stage)).has("actual")) throw new Error("Denmark profile must preserve deep BUDK100 and REGK100 rows");
if (!spainExpansionProfile.history.some((row) => row.year === 2025 && Number.isFinite(row.revenue)) || !spainExpansionProfile.detail.some((row) => row.stage === "cash")) throw new Error("Spain profile must expose liquidation and cash stages");
if (!Number.isFinite(japanExpansionProfile.history[0]?.debt) || !japanExpansionProfile.detail.some((row) => ["63","94"].includes(row.table))) throw new Error("Japan profile must preserve JPY debt and ageing-related tables");
if (brazilExpansionProfile.reporting_basis !== "DCA fallback" || !Number.isFinite(brazilExpansionProfile.history[0]?.revenue) || !Number.isFinite(brazilExpansionProfile.history[0]?.expenditure) || !new Set(brazilExpansionProfile.detail.map((row) => row.side)).has("revenue") || !new Set(brazilExpansionProfile.detail.map((row) => row.side)).has("expenditure") || !new Set(brazilExpansionProfile.detail.map((row) => row.stage)).has("cash")) throw new Error("Brazil DCA fallback must reconcile paired revenue/expenditure annexes and preserve stages");
const franceMunicipalities = internationalMunicipalities.countries.find((country) => country.code === "FRA");
if (franceMunicipalities?.status !== "complete" || franceMunicipalities.directory_count < 34000) throw new Error("Expected complete French commune coverage");
if (!internationalMunicipalPage.includes('id="type-filter"') || !internationalMunicipalPage.includes('value="capital"') || !internationalMunicipalPage.includes('id="country-filter"') || !internationalMunicipalPage.includes('id="municipality-grid"') || !internationalMunicipalScript.includes("renderDirectory") || !internationalMunicipalScript.includes("city.eu_capital")) throw new Error("Municipality hub must expose country and EU-capital filters");
if (!czechMunicipalPage.includes('id="cz-insight-grid"') || !czechMunicipalPage.includes('data-destination="directory"') || !czechMunicipalPage.includes('data-destination="cities"')) throw new Error("Czechia municipality detail must expose insights and downstream municipal views");
if (!internationalMunicipalPage.includes('id="municipality-country-switch"') || !czechMunicipalPage.includes('id="municipality-country-switch"')) throw new Error("Municipality hub and Czechia detail must expose the country navigator");
if (municipalityCountryPages.some((page) => !page.includes('municipalities-country.js') || !page.includes('id="country-insight-grid"') || !page.includes('id="country-municipality-grid"')) || !municipalityCountryScript.includes("const profiles=") || !municipalityCountryScript.includes("renderDirectory")) throw new Error("Every covered country must have an insight-led municipality homepage and directory");
if (snapshot.scope.combined_unique_entity_count !== 6267) throw new Error("Expected 6,267 unique municipal and regional entities");
if (history.cities.length !== 27 || history.cities.some((city) => city.series.length !== 20)) throw new Error("Expected 20 annual observations for 27 large cities");
const pragueHistory = history.cities.find((city) => city.entity_id === "CZ:00064581")?.series.slice(-10);
if (pragueHistory?.length !== 10 || pragueHistory[0].year !== 2016 || pragueHistory.at(-1).year !== 2025) throw new Error("Expected ten Prague actual-budget years from 2016 through 2025");
if (capitals.cities.length !== 28 || capitals.cities.filter((city) => city.eu_capital).length !== 27) throw new Error("Expected 27 EU capitals plus London");
if (capitals.cities.some((city) => !Number.isFinite(city.budget?.local_amount) || !Number.isFinite(city.budget?.eur_amount) || !city.benchmarks?.population || !city.benchmarks?.tourism)) throw new Error("Incomplete European capitals facts");
if (capitals.cities.some((city) => !city.fiscal_details?.expenditure || !city.fiscal_details?.balance_classification || !Array.isArray(city.fiscal_details?.components))) throw new Error("Incomplete European capital fiscal details");
if (capitals.cities.filter((city) => city.fiscal_details.balance).length < 20) throw new Error("Expected at least twenty sourced capital-city balances");
if (categoryComparison.countries.length !== 17 || categoryComparison.categories.length !== 12) throw new Error("Expected seventeen countries and twelve common spending categories");
if (Object.keys(functionalBudgets.countries).length !== 16) throw new Error("Expected sixteen sourced functional-budget profiles");
if (Object.keys(countryHealth.countries).length !== 16 || !countryHealth.countries.FIN || !countryHealth.countries.JPN || !countryHealth.countries.GRC) throw new Error("Expected sixteen OECD health-system profiles including Greece, Finland and Japan");
if (Object.keys(countryHealthPerformance.countries).length !== 17 || !countryHealthPerformance.countries.UKR || !countryHealthPerformance.countries.GRC) throw new Error("Expected seventeen health-performance profiles including Greece and Ukraine");
for (const [code, country] of Object.entries(countryHealthPerformance.countries)) {
  for (const metric of [country.spending?.per_capita_ppp, country.workforce?.physicians_per_1000, country.workforce?.nurses_per_1000, country.capacity?.beds_per_1000, country.outcomes?.life_expectancy_years, country.outcomes?.premature_ncd_mortality_pct]) {
    if (!Number.isFinite(metric?.value) || !Number.isInteger(metric?.year)) throw new Error(`${code}: incomplete core health-performance metric`);
  }
}
if (Object.values(countryHealthPerformance.countries).filter((country) => Number.isFinite(country.outcomes?.treatable_mortality_per_100k?.value)).length !== 16) throw new Error("Expected sixteen-country OECD treatable-mortality coverage");
if (dataQuality.status !== "passed" || dataQuality.failures.length || dataQuality.counts.municipalities !== 6254 || dataQuality.counts.sovereign_countries !== 191) throw new Error("Expected a passing, machine-readable release quality report covering all 191 sovereign profiles");
if (publicEntityHistory.summary.financial_rows !== 1043 || publicEntityHistory.entities.length < 100 || publicEntityHistory.entities.some((entity) => !entity.series.length)) throw new Error("Expected Czech public-entity financial history with all available annual statements");
if (!methodologyPage.includes('id="data-health-root"')) throw new Error("Methodology page must surface release health");
if (!countryPage.includes('id="health-performance"') || !countryPage.includes("country-health-performance.js") || !countryHealthPerformanceScript.includes("peerBars")) throw new Error("Country profiles must surface health capacity, utilisation and outcomes");
if (!czechHistoryScript.includes('view="overview"') || !czechHistoryScript.includes('view==="execution"') || !czechHistoryScript.includes('view==="structure"') || !czechHistoryScript.includes('expense_per_capita')) throw new Error("Municipal profiles must surface execution, structure and per-capita history views");
if (!czechEnterprisePage.includes('id="public-entity-history-root"') || !czechEnterpriseScript.includes("renderPublicHistory")) throw new Error("Czech public-entity profiles must surface annual financial histories");
if (norwayBenchmarkProfile.breakdown_kind !== "native_measures" || norwayBenchmarkProfile.breakdown.length < 70 || finlandBenchmarkProfile.breakdown_kind !== "native_measures" || finlandBenchmarkProfile.breakdown.length < 150 || netherlandsBenchmarkProfile.breakdown.length < 30) throw new Error("European benchmark profiles must expose complete latest native accounting detail");
if (countryParity.contract !== "country-parity.v1" || countryParity.countries.length !== 191) throw new Error("Expected all 191 IMF-covered sovereign-state profiles");
const fullCountryCodes = new Set(["CZE","UKR","POL","DEU","GBR","FRA","USA","CHE","SWE","DNK","FIN","BRA","ESP","JPN","NLD","NOR","GRC"]);
if (countryParity.countries.filter((country) => fullCountryCodes.has(country.country_code)).some((country) => country.modules.sovereign.status !== "loaded" || country.modules.administrative_spending.status !== "loaded" || country.modules.common_spending.status !== "loaded" || country.modules.revenue.status !== "loaded" || country.modules.demography.status !== "loaded")) throw new Error("Every full national dashboard must load its core fiscal and demographic modules");
if (countryParity.countries.some((country) => country.modules.sovereign.status !== "loaded")) throw new Error("Every published country profile must contain an IMF sovereign series");
if (countryParity.countries.some((country) => country.coverage.total_modules !== 11)) throw new Error("Expected all eleven dashboard module slots for every country");
if (countryParity.countries.filter((country) => country.modules.municipalities.status === "loaded").length !== 27) throw new Error("Expected twenty-seven loaded municipal country layers");
if (administrativeSpending.countries.length !== 17 || administrativeSpending.countries.flatMap((country) => country.rows).length !== 448 || administrativeSpending.countries.some((country) => country.rows.some((row) => !row.label_native || !row.label_en))) throw new Error("Every national budget row must retain its native label and an English translation");
if (Object.keys(countryDemography.countries).length !== 17 || Object.values(countryDemography.countries).reduce((sum, country) => sum + country.detail_row_count, 0) !== 137865) throw new Error("Expected complete seventeen-country annual age-by-sex demographic projections");
if (Object.keys(publicEntityCoverage.countries).length !== 10 || publicEntityDirectory.total_record_count !== 121199 || publicEntityDirectory.countries.length !== 10 || publicEntityAggregates.observations.length < 350) throw new Error("Expected the complete ten-country public-entity registry, coverage contract and economic observations");
if (publicEntityDirectory.countries.some((country) => !country.file || !Number.isFinite(country.record_count)) || Object.values(publicEntityCoverage.countries).some((country) => !country.registry_file || !country.sources.length)) throw new Error("Every public-entity country must expose a registry file and source lineage");
if (methodologySources.row_count !== 2128 || methodologySources.countries.length !== 191 || methodologySources.modules.length !== 12 || methodologySources.rows.filter((row) => row.module === "municipal_itemized").length !== 27) throw new Error("Expected the complete global sovereign, municipal and itemized-budget source ledger");
if (methodologySources.rows.some((row) => row.status === "unavailable" || !["loaded", "source_available", "fragmented", "not_found", "not_researched"].includes(row.source_availability)) || methodologySources.rows.filter((row) => row.status === "not_loaded").length !== 1746) throw new Error("Methodology must distinguish PSD layers that are not loaded from independently researched source availability");
if (!methodologyPage.includes("obecní adresář a souhrnné finance od položkových rozpočtů") || !methodologyPage.includes("methodology-levels")) throw new Error("Methodology must visibly distinguish municipal directory/headline coverage from itemized-budget coverage");
if (coverageSourceResearch.contract !== "coverage-source-research.v1" || Object.keys(coverageSourceResearch.countries).length !== 6) throw new Error("Expected source-availability research for all six municipal-only country profiles");
for (const [code, modules] of Object.entries(coverageSourceResearch.countries)) {
  for (const module of ["fiscal", "health", "geo", "transport"]) {
    const record = modules[module];
    if (!record || !["source_available", "fragmented", "not_found"].includes(record.status) || !record.sources?.length || record.sources.some((source) => !source.url) || !record.evidence_en || !record.evidence_cs || !record.ingestion_en || !record.ingestion_cs) throw new Error(`${code}/${module}: incomplete source-availability research`);
  }
}
if (!methodologyPage.includes("coverage-source-availability") && !methodologyPage.includes("source-availability")) throw new Error("Methodology page must explain source availability separately from PSD coverage");
if (municipalTransparency.countries.length !== 45 || municipalTransparency.countries.find((country) => country.iso3 === "BRA")?.pipeline !== "loaded_partial") throw new Error("Expected the 45-country municipal transparency atlas with Brazil's exact partial-load status");
const georgiaTransparency = municipalTransparency.countries.find((country) => country.iso3 === "GEO");
if (georgiaTransparency?.category !== "full_lifecycle" || georgiaTransparency.pipeline !== "loaded" || Object.values(georgiaTransparency.features).some((value) => value !== true)) throw new Error("Expected Georgia's complete municipal lifecycle to be loaded");
for (const [code, pipeline] of [["COL","loaded"],["GEO","loaded"],["ITA","loaded"],["BOL","loaded"],["SLV","loaded_partial"],["MEX","loaded_partial"],["CRI","loaded"],["GTM","loaded"],["PER","loaded"],["KOR","loaded"],["CHL","loaded"]]) {
  if (municipalTransparency.countries.find((country) => country.iso3 === code)?.pipeline !== pipeline) throw new Error(`${code}: unexpected municipal transparency pipeline status`);
}
if (globalBudgetTransparency.countries.length !== 195 || globalBudgetTransparency.countries.filter((country) => country.national_budget.research_status === "assessed").length !== 125 || globalBudgetTransparency.countries.filter((country) => country.municipal_item_level.research_status === "researched").length !== 45) throw new Error("Expected a 195-state atlas with 125 national assessments and 45 municipal item-level reviews");
if (globalBudgetTransparency.countries.filter((country) => country.budget_transparency_index?.score !== null).length !== 135 || globalBudgetTransparency.countries.filter((country) => country.psd_coverage?.country_profile === "loaded").length !== 191 || globalBudgetTransparency.countries.filter((country) => country.psd_coverage?.ingestion_status === "discovery_crawl_started").length !== 0) throw new Error("Budget Transparency Index must distinguish indexed, IMF-profiled and unavailable countries");
if (globalBudgetTransparency.countries.find((country) => country.iso2 === "ge")?.budget_transparency_index?.score !== 100) throw new Error("Georgia's Budget Transparency Index must include its verified municipal lifecycle bonus");
for (const [iso2, expected] of [["cz",82],["es",69],["in",64],["vn",62]]) if (globalBudgetTransparency.countries.find((country) => country.iso2 === iso2)?.portal_readiness.score !== expected) throw new Error(`Unexpected PSD readiness score for ${iso2}`);
if (!municipalTransparencyScript.includes('id="atlas-mode"') || !municipalTransparencyScript.includes('class="atlas-tooltip"') || !municipalTransparencyScript.includes('class="atlas-sort"') || !municipalTransparencyStyles.includes(".atlas-not_researched") || !municipalTransparencyStyles.includes("fill: #3f433f") || !municipalTransparencyStyles.includes("fill: #d7c58e")) throw new Error("Global coverage atlas must expose layer controls, sortable evidence, score explanations, dark-gray unresearched countries and a non-white middle band");
for (const code of ["CZE", "FRA", "GBR", "USA"]) if (countryParity.countries.find((country) => country.country_code === code)?.modules.providers.status !== "loaded") throw new Error(`Expected loaded provider register for ${code}`);
if (roadNetworks.countries.length !== 10 || !roadNetworks.construction_history_status.includes("annual net stock change")) throw new Error("Expected ten-country road histories with an explicit construction proxy caveat");
for (const country of roadNetworks.countries) {
  if (!country.road_network?.series?.length || !country.motorways?.series?.length || country.motorways.series.some((point) => !Number.isFinite(point.km))) throw new Error(`${country.code}: incomplete road or motorway history`);
}
if (transportPerformance.schema_version !== "1.0.0" || Object.keys(transportPerformance.countries).length !== 17) throw new Error("Expected seventeen-country transport performance data");
if (transportPerformance.projects.length < 2 || transportPerformance.projects.some((project) => !project.source?.url || !Number.isFinite(project.cost_per_route_km_local_million))) throw new Error("Transport project costs require sourced, calculable records");
for (const [code, country] of Object.entries(transportPerformance.countries)) {
  if (!country.condition_and_repairs?.sources?.length) throw new Error(`${code}: transport condition/repair sources are missing`);
  if (!["CZE", "DEU", "DNK", "FRA", "GBR", "POL", "SWE", "CHE"].includes(code)) continue;
  if (!country.rail.network.length || !country.infrastructure_spending.road.investment_constant_eur.length) throw new Error(`${code}: expected official rail and road-investment series`);
}
if (Object.keys(countryCashIn.countries).length !== 17 || !countryCashIn.countries.CZE.layers?.municipalities?.revenue_local_bn || !countryCashIn.countries.CZE.layers?.companies?.turnover_local_bn) throw new Error("Expected consolidated revenue for seventeen countries and Czech territorial/company cash-in layers");
if (countryCashIn.countries.CZE.layers.municipalities.entity_count !== 6254 || countryCashIn.countries.CZE.layers.companies.entity_count !== 38) throw new Error("Unexpected Czech municipality or state-company cash-in coverage");
if (countryRevenue.contract !== "country-revenue.v1" || Object.keys(countryRevenue.countries).length !== 17 || countryRevenue.sources.length !== 3) throw new Error("Expected a seventeen-country revenue contract with three primary source pipelines");
for (const [code, profile] of Object.entries(countryRevenue.countries)) {
  const taxMixTotal = Object.values(profile.tax_mix).reduce((sum, value) => sum + value, 0);
  const governmentLevelTotal = Object.values(profile.government_levels).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  if (Math.abs(taxMixTotal - 100) > 0.1 || Math.abs(governmentLevelTotal - 100) > 0.1 || profile.timeline.length < 12) throw new Error(`${code}: revenue mix, recipient levels or stability timeline is incomplete`);
}
if (Object.values(countryRevenue.countries).filter((profile) => profile.environmental_taxes).length < 7 || Object.values(countryRevenue.countries).filter((profile) => profile.municipal_transfers).length < 8) throw new Error("Revenue profiles must preserve source-backed environmental-tax and municipal-transfer coverage");
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
if (!homepage.includes('id="category-comparison-root"') || !homepage.includes('homepage-category.js?v=20260821-benchmark-flags') || !homepage.includes('homepage-category.css?v=20260826-home-density')) throw new Error("Homepage must expose the country category comparison");
if (!homepage.includes('id="homepage-health-performance-root"') || !homepage.includes('homepage-health-performance.js?v=20260824-topline-compare') || !homepage.includes('homepage-health-performance.css?v=20260824-topline-compare')) throw new Error("Homepage must expose the fifteen-metric health-performance comparison");
if (!homepage.includes("language-bootstrap.js") || !languageBootstrap.includes("data-language-pending") || !languageBootstrap.includes("MutationObserver") || !languageBootstrap.includes("window.PSDLanguage") || !languageBootstrap.includes('defaultLanguage = isHomepage ? "en"')) throw new Error("English must be selected from the shared language contract before the first visible paint");
if (!globalNav.includes('href("municipalities/", lang)') || !globalNav.includes('class="country-menu municipality-menu"') || !globalNav.includes('class="country-menu-search"') || !globalNav.includes('municipalities/${slug}/?lang=${lang}') || globalNav.indexOf('data-global-nav="country"') > globalNav.indexOf('data-global-nav="cities"') || globalNav.includes('data-global-nav="capitals"')) throw new Error("Global navigation must place searchable Country and Municipality dropdowns first");
if (!globalFooter.includes("assets/logo-lockup-dark.svg") || !globalFooter.includes("assets/hlidac-statu-horizontal-inverted-bw.svg") || !globalFooter.includes('class="footer-formalities"') || !globalFooter.includes('class="footer-secondary"') || !globalFooter.includes('width="152"') || !globalFooter.includes("IČO 05965527") || !globalFooter.includes("info@hlidacstatu.cz") || globalFooter.includes("Velenovského") || globalFooter.includes('href="#top"') || !globalFooterStyles.includes("background: #171918")) throw new Error("Global footer must align the reduced Hlidac mark with project links, retain organisation details and email, omit the postal address, and omit the back-to-top link");
if (!globalNav.includes("window.PSDSharedComponents") || !globalNav.includes('footer:not([data-global-footer])') || !globalNav.includes('legacy.dataset.sharedComponentLegacy = "footer"') || !globalNav.includes('legacy.dataset.sharedComponentLegacy = "header"') || globalNav.includes("legacy.replaceWith(host)")) throw new Error("Shared components must initialize once and preserve legacy header/footer DOM instead of replacing it");
if (!globalFooter.includes("window.PSDSharedComponents") || !globalFooter.includes("psd:shared-footer-ready") || !globalNav.includes("psd:shared-header-ready")) throw new Error("Shared header and footer must expose an idempotent lifecycle contract");
if (!countryPage.includes("<footer data-global-footer></footer>") || countryPage.includes("footer-country") || countryScript.includes("footer-country")) throw new Error("Country pages must use the public shared-footer boundary without private legacy nodes");
if (!globalNav.includes('class="deep-dive-menu"') || !globalNav.includes('deep-dives/transportation/')) throw new Error("Global navigation must expose the dedicated deep-dive hierarchy");
if (!globalNav.includes("class PsdSiteHeader extends HTMLElement") || !globalNav.includes("customElements.define(HEADER_TAG, PsdSiteHeader)") || !globalNav.includes("site-header.css")) throw new Error("Global navigation must be implemented as the shared site-header component");
if (globalNav.includes('href("index.html"') || globalNav.includes("assetRoot}index.html") || !globalNav.includes('setAttribute("href", href("", lang))')) throw new Error("Header logos and shared navigation must use the canonical homepage URL without index.html");
if (!nginx.includes("map $request_uri $index_redirect_path") || !nginx.includes('return 301 $index_redirect_path$is_args$args;')) throw new Error("Explicit index.html requests must permanently redirect without catching internal index resolution");
if (!headerStyles.includes("psd-site-header") || !headerStyles.includes(".global-nav") || !headerStyles.includes(".country-menu-panel")) throw new Error("The shared header must own its complete visual contract");
if (!czechSiteGenerator.includes('<psd-site-header data-section=\\"cities\\"></psd-site-header>') || !czechSiteGenerator.includes("site-header.css?v=20260824-header-lockup") || !czechSiteGenerator.includes("global-nav.js?v=20260824-logo-120")) throw new Error("Generated municipal pages must use the shared header component");
if (!deepDivePage.includes('href="health/?code=CZE"') || !deepDivePage.includes('href="state-owned-enterprises/"') || !deepDivePage.includes('href="capital-cities/?city=prague-cz"') || !deepDivePage.includes('href="ageing/?code=CZE"') || !transportDeepDivePage.includes('id="deep-dive-country"') || !transportDeepDivePage.includes('id="country-function-transport"') || !healthDeepDivePage.includes('data-country-codes="CZE,DEU,DNK,FRA,GBR,POL,SWE,CHE,UKR,USA"') || !healthDeepDivePage.includes('id="country-function-health"') || !healthDeepDivePage.includes('id="healthcare-system"') || !healthDeepDivePage.includes('id="hospital-benchmark"') || !healthDeepDivePage.includes('id="health-performance"') || !healthDeepDivePage.includes('health-performance.js') || !stateEnterpriseDeepDivePage.includes('id="soe-body"') || !stateEnterpriseDeepDivePage.includes('id="soe-map"') || !capitalCitiesDeepDivePage.includes('id="capital-bubble-chart"') || !capitalCitiesDeepDivePage.includes('id="visitor-load"') || !capitalCitiesDeepDivePage.includes('id="budget-capacity"') || !capitalCitiesDeepDivePage.includes('id="balance"') || !capitalCitiesDeepDivePage.includes('id="cohorts"') || !capitalCitiesDeepDiveScript.includes("budgetPerResident") || !capitalCitiesDeepDiveScript.includes("guestLoad") || !ageingDeepDivePage.includes('id="ageing-bill-root"') || !ageingDeepDivePage.includes('https://publicspendingdata.org/deep-dives/ageing/') || !ageingDeepDiveScript.includes("This is not a forecast of employment, pensions, healthcare costs, taxes or public debt") || !ageingDeepDiveScript.includes("state.detail.rows.filter")) throw new Error("Deep dives must expose transportation, health-performance, state-enterprise, capital-city and projection-only ageing profiles");
if (stateEnterpriseCatalogue.records.length !== 30 || new Set(stateEnterpriseCatalogue.records.map(record => record.country_code)).size !== 10 || stateEnterpriseCatalogue.records.some(record => !Number.isFinite(record.source_revenue_m) || !stateEnterpriseCatalogue.fx.rates[record.currency] || !record.source_url)) throw new Error("State-enterprise catalogue must contain three sourced and convertible records for each tracked country");
if (!deepDivePage.includes('href="revenue/?code=CZE"') || !globalNav.includes('deep-dives/revenue/') || !revenueDeepDivePage.includes('id="hundred-flow"') || !revenueDeepDivePage.includes('id="base-composition"') || !revenueDeepDivePage.includes('id="stability-chart"') || !revenueDeepDivePage.includes('id="transfer-path"') || !revenueDeepDiveScript.includes('environmentNote')) throw new Error("Revenue deep dive must expose tax sources, government levels, downturn stability and municipal transfers");
if (!deepDivePage.includes('href="migration/"') || !globalNav.includes('deep-dives/migration/') || !migrationDeepDivePage.includes('id="migration-map"') || !migrationDeepDivePage.includes('id="migration-line-chart"') || !migrationDeepDivePage.includes('id="migration-ranking"') || !migrationDeepDivePage.includes('id="migration-table-body"') || !migrationDeepDivePage.includes('demo_gind') || !migrationDeepDiveScript.includes('`${metric}_per_1000`') || euMigration.contract !== "eu-migration.v1" || euMigration.countries.length !== 27 || euMigration.countries.some((country) => !country.rows.length) || euMigration.scope.latest_complete_aggregate_year !== 2024) throw new Error("Migration deep dive must expose complete EU-27 flows, rates, history and source lineage");
if (!deepDivePage.includes('href="defense/?code=USA"') || !globalNav.includes('deep-dives/defense/?code=USA') || !defenseDeepDivePage.includes('id="defense-comparison-chart"') || !defenseDeepDivePage.includes('id="defense-lines-body"') || !defenseDeepDiveScript.includes('defense-target-tick') || defenseDeepDive.default_country !== "USA" || defenseDeepDive.countries.length !== 17 || defenseDeepDive.countries.some((country) => !country.comparison.series.length || !country.budget.items.length) || defenseDeepDive.commitments.nato_core_pct_gdp_2035 !== 3.5) throw new Error("Defense deep dive must default to the US and expose 17 sourced country histories, NATO target markers and native budget lines");
if (!methodologyPage.includes('id="data-freshness"') || !dataFreshnessScript.includes('data/data-freshness.v1.json') || dataFreshness.totals.countries !== 191 || dataFreshness.totals.modules !== 15 || dataFreshness.totals.records !== dataFreshness.records.length || dataFreshness.totals.municipal_country_coverage !== 27 || dataFreshness.totals.itemized_municipal_country_coverage !== 27 || dataFreshness.totals.itemized_municipal_profiles !== 75507 || dataFreshness.records.filter((record) => record.module === "sovereign" && record.vintage_type === "estimate").length !== 20 || dataFreshness.records.some((record) => !record.country_code || !record.module || !record.artifact)) throw new Error("Methodology must expose complete cross-layer freshness, distinct municipal coverage levels and source estimate vintages");
if (!cloudbuild.includes("scripts/assert-single-production.sh") || !cloudbuild.includes("scripts/deploy-immutable.sh") || !cloudbuild.includes("- czbudget-public") || cloudbuild.includes("${_SERVICE}") || cloudbuild.includes("czbudget-web")) throw new Error("Cloud Build must be locked to the sole canonical production service");
if (!cloudbuild.includes("scripts/merge-municipal-breakdowns.mjs") || !municipalI18n.includes("renderBudgetBreakdown") || !municipalI18n.includes("municipal-budget-codebook.v1.json")) throw new Error("Municipal profiles must surface the detailed FIN 2-12 M breakdown");
if (!capitalsScript.includes('data/large-city-history.v1.json') || !capitalsScript.includes('renderHistory(city)')) throw new Error("European capitals must surface the Prague ten-year history");
const fiscalFields = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp", "gross_debt_pct_gdp", "nominal_gdp_local_bn", "nominal_gdp_usd_bn", "inflation_pct"];
if (sovereign.series.some((country) => fiscalFields.some((field) => !country.metrics[field]?.values?.length))) throw new Error("Country profiles require complete nominal and inflation fiscal series");
if (sovereign.schema_version !== "1.1.0" || sovereign.fiscal_perimeters?.comparison_scope !== "general_government" || sovereign.fiscal_perimeters?.perimeters?.length !== 3) throw new Error("Sovereign benchmark must declare all three fiscal perimeters and the comparison scope");
if (sovereign.countries.some((country) => !country.fiscal_architecture?.national_budget_label_cs || !country.fiscal_architecture?.architecture_cs || !country.fiscal_architecture?.corporation_note_cs || country.fiscal_architecture?.sources?.length < 1)) throw new Error("Every tracked country must describe its national fiscal architecture and public-corporation treatment");
if (!countryPage.includes('data-chart-view="real"') || !countryPage.includes('country.js?v=20260826-greece-recovery') || !countryScript.includes("function fiscalAmount")) throw new Error("Country profiles must expose the dynamic inflation-adjusted chart view");
if (!countryPage.includes('id="scope-perimeter-grid"') || !countryScript.includes("function scopeProfile") || !countryScript.includes("fiscal_architecture")) throw new Error("Country profiles must visibly distinguish fiscal perimeters and country architecture");
if (!czechBudgetPage.includes('class="fiscal-perimeter-map"') || !czechBudgetPage.includes('class="fiscal-series-scope"') || !czechBudgetPage.includes('class="enterprise-nonadditivity-note"') || !czechBudgetPage.includes('class="benchmark-scope-contract"')) throw new Error("Czech budget must disclose the scope and non-additivity of every fiscal layer");
if (!czechBudgetPage.includes('styles.css?v=20260821-fiscal-scope') || !czechBudgetPage.includes('app.js?v=20260821-annual-system-cost-baseline') || !czechBudgetPage.includes('budget-i18n.js?v=20260825-localization-audit')) throw new Error("Czech budget assets must be cache-busted");
if (!czechBudgetPage.includes('id="model-system-cost"') || !czechBudgetPage.includes('id="model-system-cost-note"') || !czechBudgetPage.includes('id="system-cost-chart"')) throw new Error("Demographic model must expose absolute annual system costs and their baseline");
if (!czechBudgetScript.includes('d=>d.pension],["health","Zdravotnictví",d=>d.health],["care","Péče",d=>d.care]') || /pensionExtra|healthExtra|careExtra/.test(czechBudgetScript)) throw new Error("Annual system costs must use absolute modeled expenditure, not changes from 2025");
for (const key of ["pension_expense", "pension_income", "health_expense", "care_allowance"]) if (!Number.isFinite(demography.base_2025?.[key]) || demography.base_2025[key] <= 0) throw new Error(`Demographic base amount ${key} must be positive`);
if (!czechBudgetScript.includes("requiredBaseAmounts") || !czechBudgetScript.includes("pension_age_sensitive_share:pensionAgeShare")) throw new Error("Demographic calculations must validate base amounts and use declared model assumptions");
if (!homepageScript.includes("PSDCountryRoutes.href") || homepageScript.includes("country.html?code=") || homepageScript.includes('code==="CZE"?')) throw new Error("Every country card must use readable shared country routes");
if (!countryPage.includes('<base href="/">') || !countryPage.includes("country-routes.js") || !countryScript.includes("PSDCountryRoutes.codeFromLocation") || !countryScript.includes("PSDCountryRoutes.href") || !globalNav.includes("countrySlugs[code] || String(code).toLowerCase()") || !countryRoutes.includes('CHE: "switzerland"') || !countryRoutes.includes('BRA: "brazil"') || !countryRoutes.includes('JPN: "japan"') || !countryRoutes.includes('FIN: "finland"') || !countryRoutes.includes("normalizedCode.toLowerCase()")) throw new Error("Country profiles must use readable routes for the full profiles and ISO3 fallback routes globally");
if (!nginx.includes("location = /country.html") || !nginx.includes("return 301 $legacy_country_path") || !nginx.includes("/countries/switzerland") || !nginx.includes("try_files /country.html =404")) throw new Error("Nginx must redirect legacy country URLs and serve readable country routes");
if (!nginx.includes("denmark|finland|france") || !nginx.includes("greece|[a-z][a-z][a-z])/$") || !nginx.includes("greece|[a-z][a-z][a-z])$") || nginx.includes("try_files /countries/$1/index.html =404")) throw new Error("All IMF-covered countries must use the shared national dashboard route");
if (!countryParityStyles.includes("background:#fff;color:#17241f") || !countryParityStyles.includes("color:#4f5a55")) throw new Error("Country data-layer cards must keep readable dark text on white backgrounds");
if (!czechMunicipalPage.includes('municipalities-czechia.js') || !internationalMunicipalScript.includes('CZE:"czechia"')) throw new Error("Municipality hub must link to the Czechia detail route");
if (!homepage.includes('styles-v2.css?v=20260826-home-density') || !homepage.includes('homepage-v2.js?v=20260822-separate-pages') || !homepage.includes('global-nav.js?v=20260824-logo-120') || !homepage.includes('site-header.css?v=20260824-header-lockup')) throw new Error("Homepage assets must be cache-busted for the shared-header release");
if (homepage.includes('id="compare"') || homepage.includes('id="method"') || !comparisonPage.includes('id="benchmark-overview"') || !comparisonPage.includes('id="benchmark-country"') || !homepageScript.includes("function benchmark")) throw new Error("Comparison and methodology must be separated from the homepage");
if (globalNav.includes('code === "CZE"') || !globalNav.includes('assets/flags/${flag}.svg') || !countryScript.includes("czech-view-grid")) throw new Error("Country navigation must use shared profiles, SVG flags, and both Czech detail views");
// The perimeter used to be a hardcoded caption. It is now a control bound to
// data/compare-metrics.v1.json, so the guard checks the control, the registry entry
// behind it, and that every metric's contract actually resolves. A conditional metric
// without a group_by, or a refusal pointing at a metric that does not exist, would
// render as a silent fallback to the ranked table — the one failure the contract exists
// to prevent.
if (!comparisonPage.includes('id="compare-perimeters"') || !comparisonPage.includes('id="compare-perimeter-note"') || !comparisonPage.includes('id="compare-contract"') || !comparisonPage.includes('id="compare-result"') || !comparisonPage.includes("compare-contract.js?v=") || !comparisonPage.includes("compare-contract.css?v=")) throw new Error("Comparison page must expose the contract-driven perimeter control");
if (!compareMetrics.perimeters.some((perimeter) => perimeter.id === "general_government" && perimeter.label_en === "General government" && perimeter.note_en && perimeter.note_cs)) throw new Error("Comparison page must state its harmonised fiscal perimeter");
{
  const metricCodes = new Set(compareMetrics.metrics.map((metric) => metric.metric_code));
  const perimeterIds = new Set(compareMetrics.perimeters.map((perimeter) => perimeter.id));
  const vehicleIds = new Set(healthAssignments.financing_vehicles.map((vehicle) => vehicle.id));
  for (const metric of compareMetrics.metrics) {
    if (!["full", "conditional", "national_only"].includes(metric.comparability)) throw new Error(`Metric ${metric.metric_code} must declare a known comparability`);
    if (!perimeterIds.has(metric.perimeter)) throw new Error(`Metric ${metric.metric_code} names a perimeter that does not exist`);
    if (!metric.label_cs || !metric.label_en || !metric.boundary_cs || !metric.boundary_en) throw new Error(`Metric ${metric.metric_code} must carry a bilingual label and boundary`);
    if (metric.comparability === "conditional" && (!metric.group_by || !metric.warn_cs || !metric.warn_en)) throw new Error(`Conditional metric ${metric.metric_code} must declare group_by and a bilingual warning`);
    if (metric.comparability === "national_only" && (!metric.refuse_cs || !metric.refuse_en)) throw new Error(`National-only metric ${metric.metric_code} must explain its refusal in both languages`);
    if (metric.substitute && !metricCodes.has(metric.substitute)) throw new Error(`Metric ${metric.metric_code} offers a substitute that does not exist`);
    if (metric.substitute && compareMetrics.metrics.find((candidate) => candidate.metric_code === metric.substitute).comparability !== "full") throw new Error(`Metric ${metric.metric_code} must substitute a fully comparable metric`);
  }
  for (const [code, assignment] of Object.entries(healthAssignments.countries)) {
    if (!vehicleIds.has(assignment.financing_vehicle)) throw new Error(`${code} names a financing vehicle that does not exist`);
    if (!["ledger", "register", "documented", "none"].includes(assignment.evidence)) throw new Error(`${code} must record how its assignment was evidenced`);
    if (assignment.chip_en && !assignment.chip_cs) throw new Error(`${code} must carry its structural chip in both languages`);
  }
}
if (!comparisonPage.includes('id="fiscal-architecture-body"') || !homepageScript.includes("function architectureTable")) throw new Error("Comparison page must compare fiscal architecture across all tracked countries");
if (!methodologyPage.includes('class="status-header"') || !methodologyPage.includes('class="status-volume"') || !methodologyPage.includes('id="status-data-total"') || !methodologyPage.includes('id="coverage-matrix-body"') || !methodologyPage.includes('class="status-definitions"') || !methodologyPage.includes('class="method-ledger"') || !methodologyPage.includes('id="municipal-transparency"') || methodologyPage.indexOf('id="municipal-transparency"') < methodologyPage.indexOf('class="method-ledger"') || !aboutPage.includes("Hlidac statu, z.u.") || !aboutPage.includes("hlidac-statu-horizontal-inverted-bw.svg") || aboutPage.includes("Mnichovice") || !homepage.includes("data-global-footer") || !internationalMunicipalPage.includes("data-global-footer")) throw new Error("Technical data status, source ledger, bottom-of-page municipal atlas, and global project credits must be present");
if (!aboutPage.includes('class="release-notes"') || (aboutPage.match(/class="release-badge"/g) || []).length !== 5 || !aboutPage.includes('datetime="2026-08-21"') || !aboutPage.includes('datetime="2026-08-26"')) throw new Error("About page must expose five dated alpha releases");
if (!countryPage.includes('country-spending.js?v=20260824-dashboard-sections') || !countryPage.includes('country-insights.js?v=20260824-dashboard-sections') || !countryPage.includes('country-dashboard.js?v=20260824-czech-parity') || !countryPage.includes('country-dashboard.css?v=20260826-greece-recovery') || !countryPage.includes('country-public-entities.js?v=20260823-public-registry-2') || !countryPage.includes('country-public-entities.css?v=20260823-public-registry-2') || !countryPage.includes('country-health.js?v=20260822-czech-flow') || !countryPage.includes('country-providers.js?v=20260822-network') || !countryPage.includes('country-functions.js?v=20260822-transport-deep-dive') || !countryPage.includes('country-cash-in.js?v=20260824-loaded-layers') || !countryPage.includes('country-parity.js?v=20260822-parity-contract') || !countryPage.includes('id="data-parity"') || !countryPage.includes('id="cash-in"') || !countryPage.includes('id="budget-map"') || !countryPage.includes('id="public-entities"') || !countryPage.includes('id="demography"') || !countryPage.includes('id="provider-network"') || !countryPage.includes('id="social-system"') || !countryPage.includes('id="transportation"') || !countryPage.includes('id="recovery"') || !countryScript.includes('function recoveryStory') || !countryScript.includes('countryprofilechange') || !countryInsightsScript.includes("label_en") || !countryPublicEntitiesScript.includes("public-entity-coverage.v1.json") || countryInsightsScript.includes("country-public-entities.v1.json") || !countryDashboardScript.includes('index.id = "country-dashboard-index"') || !countryDashboardScript.includes('ids:["trend", "cash-in", "macro", "recovery"]') || !countryDashboardScript.includes('ids:["data-parity", "sources"]') || !countryCashInScript.includes('public-entity-directory/manifest.v1.json')) throw new Error("Fiscal profiles must preserve all shared insight modules and Czech-style dashboard composition");
if (!countryFunctionsScript.includes("function renderTransport") || !countryFunctionsScript.includes("transport-comparison") || !countryFunctionsScript.includes("stockNotBuild") || !countryFunctionsScript.includes("function transportBudgetDetail") || !countryFunctionsScript.includes("function infrastructurePerformance")) throw new Error("Transportation must expose network, budget and infrastructure-performance deep dives with the net-stock caveat");
async function htmlFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => !/ \d+\.[^/]+$/.test(entry.name) && ![".git", "dist", "node_modules", "playwright-report", "server", "test-results"].includes(entry.name)).map((entry) => {
    const path = directory === "." ? entry.name : `${directory}/${entry.name}`;
    return entry.isDirectory() ? htmlFiles(path) : path.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}
async function javascriptFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => !/ \d+\.[^/]+$/.test(entry.name) && ![".git", "dist", "node_modules", "playwright-report", "data", "scripts", "server", "test-results", "tests"].includes(entry.name)).map((entry) => {
    const path = directory === "." ? entry.name : `${directory}/${entry.name}`;
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith(".js") ? [path] : [];
  }));
  return nested.flat();
}
const privateSharedComponentTokens = ["footer-country", "budget-home-link", "#home-link", ".site-header", ".global-nav", "data-global-footer", ".glorious-footer", ".footer-brand", ".footer-hlidac", ".footer-links"];
for (const path of await javascriptFiles()) {
  if (["global-nav.js", "global-footer.js"].includes(path)) continue;
  const source = await readFile(path, "utf8");
  const leakedToken = privateSharedComponentTokens.find((token) => source.includes(token));
  if (leakedToken) throw new Error(`${path}: reaches into private shared-component DOM via ${leakedToken}`);
}
const headerlessPages = new Set(["brand-preview.html", "cz-obce.html", "municipalities.html"]);
for (const path of await htmlFiles()) {
  if (headerlessPages.has(path)) continue;
  const page = await readFile(path, "utf8");
  if ((page.match(/<psd-site-header\b/g) || []).length !== 1) throw new Error(`${path}: expected exactly one shared site-header component`);
  if ((page.match(/global-nav\.js\?v=(?:20260822-component|20260824-identity-outlines|20260824-logo-120|20260824-budget-stages|20260825-country-expansion|20260826-migration)/g) || []).length !== 1) throw new Error(`${path}: expected exactly one shared header script`);
  if ((page.match(/site-header\.css\?v=(?:20260822-component|20260824-header-lockup)/g) || []).length !== 1 || !page.includes("data-psd-site-header")) throw new Error(`${path}: expected exactly one shared header stylesheet`);
  if (page.includes('<header class="site-header')) throw new Error(`${path}: contains a duplicated legacy header`);
}
for (const required of ["data/international-itemized-warehouse.v1.json"]) await stat(required);
for (const required of ["health-performance.js", "country-health-performance.js", "data/country-health-performance.v1.json", "data/cz-public-entity-history.v1.json", "municipal-benchmark-native.css", "scripts/build-country-health-performance.mjs"]) await stat(required);
for (const required of ["homepage-health-performance.js", "homepage-health-performance.css"]) await stat(required);
await stat("scripts/build-municipality-country-pages.mjs");
for (const required of ["municipalities/norway/index.html", "municipalities/netherlands/index.html", "municipalities/finland/index.html", "municipality-benchmark-country.js", "municipal-benchmark-profile.css", ...["no", "nl", "fi"].map((code) => `assets/flags/${code}.svg`)]) await stat(required);
await stat("data/transport-budget-detail.v1.json");
await stat("scripts/build-transport-budget-detail.mjs");
await stat("data/transport-performance.v1.json");
await stat("scripts/build-transport-performance.mjs");
await stat("deep-dives/capital-cities/index.html");
await stat("capital-cities-deep-dive.js");
await stat("capital-cities-deep-dive.css");
for (const required of ["deep-dives/revenue/index.html", "revenue-deep-dive.js", "revenue-deep-dive.css", "data/country-revenue.v1.json", "scripts/build-country-revenue.py"]) await stat(required);
await stat("deep-dives/ageing/index.html");
await stat("ageing-bill.js");
await stat("ageing-bill.css");
for (const required of ["deep-dives/migration/index.html", "migration-deep-dive.js", "migration-deep-dive.css", "data/eu-migration.v1.json", "scripts/build-eu-migration.mjs"]) await stat(required);
for (const required of ["deep-dives/defense/index.html", "defense-deep-dive.js", "defense-deep-dive.css", "data/defense-deep-dive.v1.json", "scripts/build-defense-deep-dive.py"]) await stat(required);
for (const required of ["data-freshness.js", "data-freshness.css", "data/data-freshness.v1.json", "scripts/build-data-freshness.mjs"]) await stat(required);
console.log("CZ Budget site validation passed");
