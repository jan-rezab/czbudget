import { readFile, readdir, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
const capitals = JSON.parse(await readFile("data/eu-capital-budgets.v1.json", "utf8"));
const categoryComparison = JSON.parse(await readFile("data/country-spending-comparison.v1.json", "utf8"));
const administrativeSpending = JSON.parse(await readFile("data/country-spending-2025-2026.v1.json", "utf8"));
const functionalBudgets = JSON.parse(await readFile("data/country-functional-budgets.v1.json", "utf8"));
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
const sovereign = JSON.parse(await readFile("lib/data/sovereign-benchmark.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
const comparisonPage = await readFile("comparison.html", "utf8");
const methodologyPage = await readFile("methodology.html", "utf8");
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
const municipalTransparency = JSON.parse(await readFile("data/municipal-transparency.v1.json", "utf8"));
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
const municipalityCountrySlugs = ["poland", "denmark", "france", "sweden", "england", "ukraine", "norway", "netherlands", "finland", "brazil", "spain", "japan"];
const municipalityCountryPages = await Promise.all(municipalityCountrySlugs.map((slug) => readFile(`municipalities/${slug}/index.html`, "utf8")));
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (internationalMunicipalities.countries.length !== 16 || internationalMunicipalities.entities.length !== 90630) throw new Error("Expected sixteen-country municipality directory with 90,630 entity rows");
if (municipalItemizedCoverage.countries.length !== 16 || municipalItemizedCoverage.countries.reduce((sum, country) => sum + country.profile_count, 0) !== 20858) throw new Error("Expected 20,858 itemized municipal profiles across sixteen countries");
if (municipalItemizedCoverage.countries.find((country) => country.code === "CZE")?.profile_count !== 6254 || municipalItemizedCoverage.countries.find((country) => country.code === "USA")?.profile_count !== 0) throw new Error("Itemized municipal coverage must distinguish profile-level detail from directory-only coverage");
if (benchmarkMunicipalities.reduce((sum, country) => sum + country.entities.length, 0) !== 1010) throw new Error("Expected 1,010 Nordic and Dutch municipal benchmark profiles");
for (const [code, expected] of [["DNK",98],["ESP",6198],["JPN",1741]]) {
  const country = internationalMunicipalities.countries.find((item) => item.code === code);
  if (!country || country.status !== "complete" || country.directory_count !== expected || internationalMunicipalities.entities.filter((item) => item.country === code && item.url).length !== expected) throw new Error(`${code}: incomplete municipality directory or profile routes`);
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
if (categoryComparison.countries.length !== 10 || categoryComparison.categories.length !== 12) throw new Error("Expected ten countries and twelve common spending categories");
if (Object.keys(functionalBudgets.countries).length !== 10) throw new Error("Expected functional budgets for all ten countries");
if (Object.keys(countryHealth.countries).length !== 10 || !countryHealth.countries.UKR) throw new Error("Expected ten health-system profiles including Ukraine's latest available GHED row");
if (Object.keys(countryHealthPerformance.countries).length !== 10 || !countryHealthPerformance.countries.UKR) throw new Error("Expected ten health-performance profiles including Ukraine");
for (const [code, country] of Object.entries(countryHealthPerformance.countries)) {
  for (const metric of [country.spending?.per_capita_ppp, country.workforce?.physicians_per_1000, country.workforce?.nurses_per_1000, country.capacity?.beds_per_1000, country.outcomes?.life_expectancy_years, country.outcomes?.premature_ncd_mortality_pct]) {
    if (!Number.isFinite(metric?.value) || !Number.isInteger(metric?.year)) throw new Error(`${code}: incomplete core health-performance metric`);
  }
}
if (Object.values(countryHealthPerformance.countries).filter((country) => Number.isFinite(country.outcomes?.treatable_mortality_per_100k?.value)).length !== 9) throw new Error("Expected nine-country OECD treatable-mortality coverage");
if (dataQuality.status !== "passed" || dataQuality.failures.length || dataQuality.counts.municipalities !== 6254) throw new Error("Expected a passing, machine-readable release quality report");
if (publicEntityHistory.summary.financial_rows !== 1043 || publicEntityHistory.entities.length < 100 || publicEntityHistory.entities.some((entity) => !entity.series.length)) throw new Error("Expected Czech public-entity financial history with all available annual statements");
if (!methodologyPage.includes('id="data-health-root"')) throw new Error("Methodology page must surface release health");
if (!countryPage.includes('id="health-performance"') || !countryPage.includes("country-health-performance.js") || !countryHealthPerformanceScript.includes("peerBars")) throw new Error("Country profiles must surface health capacity, utilisation and outcomes");
if (!czechHistoryScript.includes('view="overview"') || !czechHistoryScript.includes('view==="execution"') || !czechHistoryScript.includes('view==="structure"') || !czechHistoryScript.includes('expense_per_capita')) throw new Error("Municipal profiles must surface execution, structure and per-capita history views");
if (!czechEnterprisePage.includes('id="public-entity-history-root"') || !czechEnterpriseScript.includes("renderPublicHistory")) throw new Error("Czech public-entity profiles must surface annual financial histories");
if (norwayBenchmarkProfile.breakdown_kind !== "native_measures" || norwayBenchmarkProfile.breakdown.length < 70 || finlandBenchmarkProfile.breakdown_kind !== "native_measures" || finlandBenchmarkProfile.breakdown.length < 150 || netherlandsBenchmarkProfile.breakdown.length < 30) throw new Error("European benchmark profiles must expose complete latest native accounting detail");
if (countryParity.contract !== "country-parity.v1" || countryParity.countries.length !== 10) throw new Error("Expected the ten-country parity contract");
if (countryParity.countries.some((country) => country.modules.sovereign.status !== "loaded" || country.modules.administrative_spending.status !== "loaded" || country.modules.functional_spending.status !== "loaded" || country.modules.transport.status !== "loaded")) throw new Error("Every country must load the shared national fiscal modules");
if (countryParity.countries.some((country) => country.coverage.loaded_modules !== 11 || country.coverage.total_modules !== 11 || country.coverage.missing_dimensions.length)) throw new Error("Expected all eleven dashboard modules for every country");
if (countryParity.countries.filter((country) => country.modules.municipalities.status === "loaded").length !== 10) throw new Error("Expected ten loaded municipal censuses");
if (administrativeSpending.countries.length !== 10 || administrativeSpending.countries.flatMap((country) => country.rows).length !== 369 || administrativeSpending.countries.some((country) => country.rows.some((row) => !row.label_native || !row.label_en))) throw new Error("Every national budget row must retain its native label and an English translation");
if (Object.keys(countryDemography.countries).length !== 10 || Object.values(countryDemography.countries).reduce((sum, country) => sum + country.detail_row_count, 0) !== 82416) throw new Error("Expected complete ten-country annual age-by-sex demographic projections");
if (Object.keys(publicEntityCoverage.countries).length !== 10 || publicEntityDirectory.total_record_count !== 121199 || publicEntityDirectory.countries.length !== 10 || publicEntityAggregates.observations.length < 350) throw new Error("Expected the complete ten-country public-entity registry, coverage contract and economic observations");
if (publicEntityDirectory.countries.some((country) => !country.file || !Number.isFinite(country.record_count)) || Object.values(publicEntityCoverage.countries).some((country) => !country.registry_file || !country.sources.length)) throw new Error("Every public-entity country must expose a registry file and source lineage");
if (methodologySources.row_count !== 116 || methodologySources.countries.length !== 16 || methodologySources.modules.length !== 11) throw new Error("Expected the complete sovereign ledger plus all sixteen municipal source rows");
if (municipalTransparency.countries.length !== 23 || municipalTransparency.countries.find((country) => country.iso3 === "BRA")?.pipeline !== "loaded_partial") throw new Error("Expected the 23-country municipal transparency atlas with Brazil's exact partial-load status");
for (const code of ["CZE", "FRA", "GBR", "USA"]) if (countryParity.countries.find((country) => country.country_code === code)?.modules.providers.status !== "loaded") throw new Error(`Expected loaded provider register for ${code}`);
if (roadNetworks.countries.length !== 10 || !roadNetworks.construction_history_status.includes("annual net stock change")) throw new Error("Expected ten-country road histories with an explicit construction proxy caveat");
for (const country of roadNetworks.countries) {
  if (!country.road_network?.series?.length || !country.motorways?.series?.length || country.motorways.series.some((point) => !Number.isFinite(point.km))) throw new Error(`${country.code}: incomplete road or motorway history`);
}
if (transportPerformance.schema_version !== "1.0.0" || Object.keys(transportPerformance.countries).length !== 10) throw new Error("Expected ten-country transport performance data");
if (transportPerformance.projects.length < 2 || transportPerformance.projects.some((project) => !project.source?.url || !Number.isFinite(project.cost_per_route_km_local_million))) throw new Error("Transport project costs require sourced, calculable records");
for (const [code, country] of Object.entries(transportPerformance.countries)) {
  if (!country.condition_and_repairs?.sources?.length) throw new Error(`${code}: transport condition/repair sources are missing`);
  if (!["CZE", "DEU", "DNK", "FRA", "GBR", "POL", "SWE", "CHE"].includes(code)) continue;
  if (!country.rail.network.length || !country.infrastructure_spending.road.investment_constant_eur.length) throw new Error(`${code}: expected official rail and road-investment series`);
}
if (Object.keys(countryCashIn.countries).length !== 10 || !countryCashIn.countries.CZE.layers?.municipalities?.revenue_local_bn || !countryCashIn.countries.CZE.layers?.companies?.turnover_local_bn) throw new Error("Expected consolidated revenue for ten countries and Czech territorial/company cash-in layers");
if (countryCashIn.countries.CZE.layers.municipalities.entity_count !== 6254 || countryCashIn.countries.CZE.layers.companies.entity_count !== 38) throw new Error("Unexpected Czech municipality or state-company cash-in coverage");
if (countryRevenue.contract !== "country-revenue.v1" || Object.keys(countryRevenue.countries).length !== 10 || countryRevenue.sources.length !== 3) throw new Error("Expected a ten-country revenue contract with three primary source pipelines");
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
if (!homepage.includes('id="category-comparison-root"') || !homepage.includes('homepage-category.js?v=20260821-benchmark-flags') || !homepage.includes('homepage-category.css?v=20260821-benchmark-flags')) throw new Error("Homepage must expose the country category comparison");
if (!homepage.includes('id="homepage-health-performance-root"') || !homepage.includes('homepage-health-performance.js?v=20260824-topline-compare') || !homepage.includes('homepage-health-performance.css?v=20260824-topline-compare')) throw new Error("Homepage must expose the fifteen-metric health-performance comparison");
if (!homepage.includes("language-bootstrap.js") || !languageBootstrap.includes("data-language-pending") || !languageBootstrap.includes("MutationObserver") || !languageBootstrap.includes("window.PSDLanguage") || !languageBootstrap.includes('defaultLanguage = isHomepage ? "en"')) throw new Error("English must be selected from the shared language contract before the first visible paint");
if (!globalNav.includes('href("municipalities/", lang)') || !globalNav.includes('class="country-menu municipality-menu"') || !globalNav.includes('municipalities/${slug}/?lang=${lang}') || globalNav.indexOf('data-global-nav="country"') > globalNav.indexOf('data-global-nav="cities"') || globalNav.includes('data-global-nav="capitals"')) throw new Error("Global navigation must place the Country and Municipality dropdowns first");
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
if (!cloudbuild.includes("scripts/assert-single-production.sh") || !cloudbuild.includes("scripts/deploy-immutable.sh") || !cloudbuild.includes("- czbudget-public") || cloudbuild.includes("${_SERVICE}") || cloudbuild.includes("czbudget-web")) throw new Error("Cloud Build must be locked to the sole canonical production service");
if (!cloudbuild.includes("scripts/merge-municipal-breakdowns.mjs") || !municipalI18n.includes("renderBudgetBreakdown") || !municipalI18n.includes("municipal-budget-codebook.v1.json")) throw new Error("Municipal profiles must surface the detailed FIN 2-12 M breakdown");
if (!capitalsScript.includes('data/large-city-history.v1.json') || !capitalsScript.includes('renderHistory(city)')) throw new Error("European capitals must surface the Prague ten-year history");
const fiscalFields = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp", "gross_debt_pct_gdp", "nominal_gdp_local_bn", "nominal_gdp_usd_bn", "inflation_pct"];
if (sovereign.series.some((country) => fiscalFields.some((field) => !country.metrics[field]?.values?.length))) throw new Error("Country profiles require complete nominal and inflation fiscal series");
if (sovereign.schema_version !== "1.1.0" || sovereign.fiscal_perimeters?.comparison_scope !== "general_government" || sovereign.fiscal_perimeters?.perimeters?.length !== 3) throw new Error("Sovereign benchmark must declare all three fiscal perimeters and the comparison scope");
if (sovereign.countries.some((country) => !country.fiscal_architecture?.national_budget_label_cs || !country.fiscal_architecture?.architecture_cs || !country.fiscal_architecture?.corporation_note_cs || country.fiscal_architecture?.sources?.length < 1)) throw new Error("Every tracked country must describe its national fiscal architecture and public-corporation treatment");
if (!countryPage.includes('data-chart-view="real"') || !countryPage.includes('country.js?v=20260825-country-first-load') || !countryScript.includes("function fiscalAmount")) throw new Error("Country profiles must expose the dynamic inflation-adjusted chart view");
if (!countryPage.includes('id="scope-perimeter-grid"') || !countryScript.includes("function scopeProfile") || !countryScript.includes("fiscal_architecture")) throw new Error("Country profiles must visibly distinguish fiscal perimeters and country architecture");
if (!czechBudgetPage.includes('class="fiscal-perimeter-map"') || !czechBudgetPage.includes('class="fiscal-series-scope"') || !czechBudgetPage.includes('class="enterprise-nonadditivity-note"') || !czechBudgetPage.includes('class="benchmark-scope-contract"')) throw new Error("Czech budget must disclose the scope and non-additivity of every fiscal layer");
if (!czechBudgetPage.includes('styles.css?v=20260821-fiscal-scope') || !czechBudgetPage.includes('app.js?v=20260821-annual-system-cost-baseline') || !czechBudgetPage.includes('budget-i18n.js?v=20260823-initial-language')) throw new Error("Czech budget assets must be cache-busted");
if (!czechBudgetPage.includes('id="model-system-cost"') || !czechBudgetPage.includes('id="model-system-cost-note"') || !czechBudgetPage.includes('id="system-cost-chart"')) throw new Error("Demographic model must expose absolute annual system costs and their baseline");
if (!czechBudgetScript.includes('d=>d.pension],["health","Zdravotnictví",d=>d.health],["care","Péče",d=>d.care]') || /pensionExtra|healthExtra|careExtra/.test(czechBudgetScript)) throw new Error("Annual system costs must use absolute modeled expenditure, not changes from 2025");
for (const key of ["pension_expense", "pension_income", "health_expense", "care_allowance"]) if (!Number.isFinite(demography.base_2025?.[key]) || demography.base_2025[key] <= 0) throw new Error(`Demographic base amount ${key} must be positive`);
if (!czechBudgetScript.includes("requiredBaseAmounts") || !czechBudgetScript.includes("pension_age_sensitive_share:pensionAgeShare")) throw new Error("Demographic calculations must validate base amounts and use declared model assumptions");
if (!homepageScript.includes("PSDCountryRoutes.href") || homepageScript.includes("country.html?code=") || homepageScript.includes('code==="CZE"?')) throw new Error("Every country card must use readable shared country routes");
if (!countryPage.includes('<base href="/">') || !countryPage.includes("country-routes.js") || !countryScript.includes("PSDCountryRoutes.codeFromLocation") || !countryScript.includes("PSDCountryRoutes.href") || !globalNav.includes("/countries/${countrySlugs[code]}") || !countryRoutes.includes('CHE: "switzerland"')) throw new Error("Country profiles must use readable slug routes throughout the site");
if (!nginx.includes("location = /country.html") || !nginx.includes("return 301 $legacy_country_path") || !nginx.includes("/countries/switzerland") || !nginx.includes("try_files /country.html =404")) throw new Error("Nginx must redirect legacy country URLs and serve readable country routes");
if (!countryParityStyles.includes("background:#fff;color:#17241f") || !countryParityStyles.includes("color:#4f5a55")) throw new Error("Country data-layer cards must keep readable dark text on white backgrounds");
if (!czechMunicipalPage.includes('municipalities-czechia.js') || !internationalMunicipalScript.includes('CZE:"czechia"')) throw new Error("Municipality hub must link to the Czechia detail route");
if (!homepage.includes('styles-v2.css?v=20260822-brand') || !homepage.includes('homepage-v2.js?v=20260822-separate-pages') || !homepage.includes('global-nav.js?v=20260824-logo-120') || !homepage.includes('site-header.css?v=20260824-header-lockup')) throw new Error("Homepage assets must be cache-busted for the shared-header release");
if (homepage.includes('id="compare"') || homepage.includes('id="method"') || !comparisonPage.includes('id="benchmark-overview"') || !comparisonPage.includes('id="benchmark-country"') || !homepageScript.includes("function benchmark")) throw new Error("Comparison and methodology must be separated from the homepage");
if (globalNav.includes('code === "CZE"') || !globalNav.includes('assets/flags/${flag}.svg') || !countryScript.includes("czech-view-grid")) throw new Error("Country navigation must use shared profiles, SVG flags, and both Czech detail views");
if (!comparisonPage.includes('class="compare-scope-readout"') || !comparisonPage.includes("General government")) throw new Error("Comparison page must state its harmonised fiscal perimeter");
if (!comparisonPage.includes('id="fiscal-architecture-body"') || !homepageScript.includes("function architectureTable")) throw new Error("Comparison page must compare fiscal architecture across all tracked countries");
if (!methodologyPage.includes('class="status-header"') || !methodologyPage.includes('class="status-volume"') || !methodologyPage.includes('id="status-data-total"') || !methodologyPage.includes('id="coverage-matrix-body"') || !methodologyPage.includes('class="status-definitions"') || !methodologyPage.includes('class="method-ledger"') || !methodologyPage.includes('id="municipal-transparency"') || methodologyPage.indexOf('id="municipal-transparency"') < methodologyPage.indexOf('class="method-ledger"') || !aboutPage.includes("Hlidac statu, z.u.") || !aboutPage.includes("hlidac-statu-horizontal-inverted-bw.svg") || aboutPage.includes("Mnichovice") || !homepage.includes("data-global-footer") || !internationalMunicipalPage.includes("data-global-footer")) throw new Error("Technical data status, source ledger, bottom-of-page municipal atlas, and global project credits must be present");
if (!aboutPage.includes('class="release-notes"') || (aboutPage.match(/class="release-badge"/g) || []).length !== 4 || !aboutPage.includes('datetime="2026-08-21"') || !aboutPage.includes('datetime="2026-08-24"')) throw new Error("About page must expose four dated alpha releases");
if (!countryPage.includes('country-spending.js?v=20260824-dashboard-sections') || !countryPage.includes('country-insights.js?v=20260824-dashboard-sections') || !countryPage.includes('country-dashboard.js?v=20260824-czech-parity') || !countryPage.includes('country-dashboard.css?v=20260824-czech-parity') || !countryPage.includes('country-public-entities.js?v=20260823-public-registry-2') || !countryPage.includes('country-public-entities.css?v=20260823-public-registry-2') || !countryPage.includes('country-health.js?v=20260822-czech-flow') || !countryPage.includes('country-providers.js?v=20260822-network') || !countryPage.includes('country-functions.js?v=20260822-transport-deep-dive') || !countryPage.includes('country-cash-in.js?v=20260824-loaded-layers') || !countryPage.includes('country-parity.js?v=20260822-parity-contract') || !countryPage.includes('id="data-parity"') || !countryPage.includes('id="cash-in"') || !countryPage.includes('id="budget-map"') || !countryPage.includes('id="public-entities"') || !countryPage.includes('id="demography"') || !countryPage.includes('id="provider-network"') || !countryPage.includes('id="social-system"') || !countryPage.includes('id="transportation"') || !countryScript.includes('countryprofilechange') || !countryInsightsScript.includes("label_en") || !countryPublicEntitiesScript.includes("public-entity-coverage.v1.json") || countryInsightsScript.includes("country-public-entities.v1.json") || !countryDashboardScript.includes('index.id = "country-dashboard-index"') || !countryDashboardScript.includes('ids:["data-parity", "sources"]') || !countryCashInScript.includes('public-entity-directory/manifest.v1.json')) throw new Error("Fiscal profiles must preserve all shared insight modules and Czech-style dashboard composition");
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
  if ((page.match(/global-nav\.js\?v=(?:20260822-component|20260824-identity-outlines|20260824-logo-120|20260824-budget-stages)/g) || []).length !== 1) throw new Error(`${path}: expected exactly one shared header script`);
  if ((page.match(/site-header\.css\?v=(?:20260822-component|20260824-header-lockup)/g) || []).length !== 1 || !page.includes("data-psd-site-header")) throw new Error(`${path}: expected exactly one shared header stylesheet`);
  if (page.includes('<header class="site-header')) throw new Error(`${path}: contains a duplicated legacy header`);
}
for (const required of ["index.html", "comparison.html", "methodology.html", "about.html", "site-header.css", "site-pages.js", "site-pages.css", "global-footer.js", "global-footer.css", "country-routes.js", "homepage-category.js", "homepage-category.css", "deep-dives/index.html", "deep-dives/transportation/index.html", "deep-dives.js", "deep-dives.css", "data/country-parity.v1.json", "data/contracts/country-parity.schema.json", "data/country-spending-comparison.v1.json", "data/country-functional-budgets.v1.json", "data/country-demography.v1.json", "data/public-entity-coverage.v1.json", "data/public-entity-aggregates.v1.json", "data/public-entity-directory/manifest.v1.json", "data/methodology-sources.v1.json", "data/road-network-history.v1.json", "data/country-cash-in.v1.json", "data/country-provider-networks.v1.json", "data/international-municipalities.v1.json", "data/municipal-itemized-coverage.v1.json", "data/municipal-size-benchmark.v1.json", "municipalities.html", "municipalities/index.html", "municipalities/czechia/index.html", "municipalities.js", "municipalities-czechia.js", "municipalities.css", "municipalities-navigator.css", "eu-capitals.html", "eu-capitals.js", "eu-capitals.css", "country-parity.js", "country-parity.css", "country-insights.js", "country-insights.css", "country-public-entities.js", "country-public-entities.css", "country-spending.js", "country-health.js", "country-providers.js", "country-functions.js", "country-functions.css", "country-cash-in.js", "country-cash-in.css", "data/country-spending-2025-2026.v1.json", "data/country-health.v1.json", "cz/municipalities/index.html", "cz/mesta/index.html", "municipal-i18n.js", "scripts/build-country-parity.mjs", "scripts/build-country-demography.py", "scripts/build-methodology-sources.mjs", "scripts/build-municipal-itemized-coverage.mjs", "scripts/build-country-functional-budgets.mjs", "pipeline/transforms/prepare_road_network_history.py", "pipeline/transforms/prepare_public_entity_registry.py", "pipeline/transforms/build_public_entity_frontend.py", "scripts/build-country-cash-in.mjs", "scripts/build-country-provider-networks.mjs", "scripts/export-municipal-breakdowns.sql", "scripts/export-municipal-budget-codebook.sql", "scripts/merge-municipal-breakdowns.mjs", "sitemap.xml", ...["CZE","POL","DEU","GBR","FRA","USA","CHE","SWE","DNK","UKR"].flatMap((code)=>[`data/public-entities/${code}.v1.csv.gz`,`data/public-entity-directory/${code}.v1.json`]), ...["cz","de","dk","fr","gb","pl","se","ch","ua","us"].map((code)=>`assets/flags/${code}.svg`)]) await stat(required);
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
console.log("CZ Budget site validation passed");
