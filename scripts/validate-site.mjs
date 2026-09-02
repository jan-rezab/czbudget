import { readFile, readdir, stat } from "node:fs/promises";
import { loadExpectedCounts } from "./lib/expected-counts.mjs";

// Every published-volume total this validator asserts is measured or pinned in
// exactly one place. See scripts/lib/expected-counts.mjs for which are derived
// (and therefore only become real checks when reconciled against an independent
// artifact) and which are deliberate regression tripwires.
const counts = await loadExpectedCounts();
const pinned = counts.pinned;

// Cache-busting is the contract; the exact version token is not. Pinning the
// literal token means every asset edit must also edit this file, which is how
// these assertions go stale and start failing releases that are actually fine.
const cacheBusted = (page, asset) => new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=\\d{8}-[a-z0-9-]+`).test(page);

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
const oecdKeyMetrics = JSON.parse(await readFile("data/oecd-key-metrics.v1.json", "utf8"));
const countryHealth = JSON.parse(await readFile("data/country-health.v1.json", "utf8"));
const countryHealthPerformance = JSON.parse(await readFile("data/country-health-performance.v1.json", "utf8"));
const dataQuality = JSON.parse(await readFile("data/data-quality-report.v1.json", "utf8"));
const publicEntityHistory = JSON.parse(await readFile("data/cz-public-entity-history.v1.json", "utf8"));
const countryParity = JSON.parse(await readFile("data/country-parity.v1.json", "utf8"));
const countryDemography = JSON.parse(await readFile("data/country-demography.v1.json", "utf8"));
const publicEntityCoverage = JSON.parse(await readFile("data/public-entity-coverage.v1.json", "utf8"));
const publicEmployment = JSON.parse(await readFile("data/cz-public-employment.v1.json", "utf8"));
const publicEntityAggregates = JSON.parse(await readFile("data/public-entity-aggregates.v1.json", "utf8"));
const publicEntityDirectory = JSON.parse(await readFile("data/public-entity-directory/manifest.v1.json", "utf8"));
const methodologySources = JSON.parse(await readFile("data/methodology-sources.v1.json", "utf8"));
const coverageSourceResearch = JSON.parse(await readFile("data/coverage-source-research.v1.json", "utf8"));
const sovereign = JSON.parse(await readFile("lib/data/sovereign-benchmark.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
const comparisonPage = await readFile("comparison.html", "utf8");
const comparisonScript = await readFile("compare-contract.js", "utf8");
const methodologyPage = await readFile("methodology.html", "utf8");
const coverageAccountingScript = await readFile("coverage-accounting-boundaries.js", "utf8");
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
const publicEmploymentDeepDivePage = await readFile("deep-dives/public-employment/index.html", "utf8");
const capitalCitiesDeepDivePage = await readFile("deep-dives/capital-cities/index.html", "utf8");
const capitalCitiesDeepDiveScript = await readFile("capital-cities-deep-dive.js", "utf8");
const ageingDeepDivePage = await readFile("deep-dives/ageing/index.html", "utf8");
const ageingDeepDiveScript = await readFile("ageing-bill.js", "utf8");
const stateEnterpriseCatalogue = JSON.parse(await readFile("data/state-owned-enterprises.v1.json", "utf8"));
const revenueDeepDivePage = await readFile("deep-dives/revenue/index.html", "utf8");
const revenueDeepDiveScript = await readFile("revenue-deep-dive.js", "utf8");
const oecdOverlayScript = await readFile("oecd-overlay.js", "utf8");
const oecdChartsScript = await readFile("oecd-charts.js", "utf8");
const taxBurdenPage = await readFile("deep-dives/tax-burden/index.html", "utf8");
const redistributionPage = await readFile("deep-dives/redistribution/index.html", "utf8");
const migrationDeepDivePage = await readFile("deep-dives/migration/index.html", "utf8");
const migrationDeepDiveScript = await readFile("migration-deep-dive.js", "utf8");
const euMigration = JSON.parse(await readFile("data/eu-migration.v1.json", "utf8"));
const defenseDeepDivePage = await readFile("deep-dives/defense/index.html", "utf8");
const defenseDeepDiveScript = await readFile("defense-deep-dive.js", "utf8");
const defenseDeepDive = JSON.parse(await readFile("data/defense-deep-dive.v1.json", "utf8"));
const educationDeepDivePage = await readFile("deep-dives/education/index.html", "utf8");
const educationDeepDiveScript = await readFile("education-deep-dive.js", "utf8");
const educationDeepDive = JSON.parse(await readFile("data/education-deep-dive.v1.json", "utf8"));
const educationCapacityInternational = JSON.parse(await readFile("data/education-capacity-international.v1.json", "utf8"));
const tradeDeepDivePage = await readFile("deep-dives/trade/index.html", "utf8");
const tradeDeepDiveScript = await readFile("trade-deep-dive.js", "utf8");
const productMarketsPage = await readFile("deep-dives/product-markets/index.html", "utf8");
const tradeProductIntelligenceScript = await readFile("trade-product-intelligence.js", "utf8");
const tradeProductIntelligence = JSON.parse(await readFile("data/trade/product-intelligence.v1.json", "utf8"));
const dataFreshnessScript = await readFile("data-freshness.js", "utf8");
const dataFreshness = JSON.parse(await readFile("data/data-freshness.v1.json", "utf8"));
const czechBudgetPage = await readFile("cesky-rozpocet.html", "utf8");
const czechBudgetScript = await readFile("app.js", "utf8");
const demography = JSON.parse(await readFile("data/demography-social.v1.json", "utf8"));
const globalNav = await readFile("global-nav.js", "utf8");
{
  const latest = publicEmployment.history.at(-1);
  if (publicEmployment.history.length !== publicEmployment.period.years || publicEmployment.period.from !== publicEmployment.history[0].year || publicEmployment.period.to !== latest.year) throw new Error("Public-employment period must reconcile with its history");
  if (latest.public_sector_fte !== latest.general_government_fte + latest.public_corporations_combined_fte || publicEmployment.reconciliation.latest_identity_difference !== 0) throw new Error("Public-employment institutional sectors must reconcile to the control total");
  if (publicEmployment.evidence_layers.some((layer) => layer.additive_to_public_sector_total !== false)) throw new Error("Public-employment source layers must remain explicitly non-additive");
  if (publicEmployment.entity_resolution.registered_entities !== publicEntityCoverage.countries.CZE.registry_record_count) throw new Error("Public-employment entity coverage must reconcile to the public-entity register");
  const employmentBenchmark = publicEmployment.international_benchmark;
  const benchmarkCzechia = employmentBenchmark?.countries.find((row) => row.country_code === "CZE");
  if (employmentBenchmark?.country_count !== 29 || employmentBenchmark.czech_rank !== 14 || benchmarkCzechia?.latest_value_pct !== 17.78 || employmentBenchmark.oecd_average.latest_value_pct !== 18.41) throw new Error("Public-employment European benchmark must preserve its ranked OECD comparison");
  if (!publicEmploymentDeepDivePage.includes('id="employment-history-chart"') || !publicEmploymentDeepDivePage.includes('id="employment-benchmark"') || !publicEmploymentDeepDivePage.includes('id="employment-reconciliation"') || !publicEmploymentDeepDivePage.includes('../../data/cz-public-employment.v1.json')) throw new Error("Public-employment report must expose its history, European benchmark, reconciled workforce model and auditable download");
}
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
const hospitalOwnership = JSON.parse(await readFile("data/hospital-ownership.v1.json", "utf8"));
const careEnvelope = JSON.parse(await readFile("data/care-envelope.v1.json", "utf8"));
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
const municipalityCountrySlugs = ["germany", "poland", "denmark", "france", "sweden", "england", "ukraine", "norway", "netherlands", "finland", "brazil", "spain", "japan", "colombia", "georgia", "italy", "bolivia", "el-salvador", "mexico", "costa-rica", "guatemala", "peru", "south-korea", "chile"];
const municipalityCountryPages = await Promise.all(municipalityCountrySlugs.map((slug) => readFile(`municipalities/${slug}/index.html`, "utf8")));
const germanMunicipalProfilePage = await readFile("municipalities/germany/profile/index.html", "utf8");
const frenchMunicipalProfilePage = await readFile("municipalities/france/profile/index.html", "utf8");
const frenchParisProfile = JSON.parse(await readFile("data/france-municipal-profiles/75.v1.json", "utf8"));
const czechProfileSamples = await Promise.all([
  "cz/municipalities/brno/index.html",
  "cz/municipalities/arnoltice/index.html",
].map((path) => readFile(path, "utf8")));
const internationalProfileSamples = await Promise.all([
  "municipalities/denmark/aabenraa-580/index.html",
  "municipalities/brazil/sao-paulo-3550308/index.html",
  "municipalities/spain/ababuj-44001aa000/index.html",
  "municipalities/japan/municipality-242144/index.html",
  "municipalities/colombia/abejorral-210205002/index.html",
  "municipalities/georgia/municipality-mof-033/index.html",
  "municipalities/italy/abano-terme-000105310/index.html",
  "municipalities/bolivia/autonomia-del-territorio-indigena-originario-campesino-guarani-chaqueno-de-huacaya-3101/index.html",
  "municipalities/el-salvador/acajutla-8301/index.html",
  "municipalities/mexico/aguascalientes-01001/index.html",
  "municipalities/costa-rica/abangares-sipp-abangares/index.html",
  "municipalities/guatemala/cahabon-12101612/index.html",
  "municipalities/peru/aramango-300023/index.html",
  "municipalities/south-korea/municipality-4213000/index.html",
  "municipalities/chile/antofagasta-02101/index.html",
  "municipalities/norway/oslo-oslove-0301/index.html",
  "municipalities/netherlands/laarbeek-1659/index.html",
  "municipalities/finland/saarijarvi-729/index.html",
].map((path) => readFile(path, "utf8")));
if (snapshot.municipalities.length !== pinned.municipalities) throw new Error("Expected 6,254 municipalities");
if (internationalMunicipalities.countries.length !== pinned.municipalDirectoryCountries || internationalMunicipalities.entities.length !== pinned.municipalDirectoryEntries) throw new Error("Expected 27-country municipality directory with 105,416 entity rows");
// The heavy directory file is the authority for its own row count; the shared
// counts module reads that number out of data-freshness.v1.json so the browser
// suite can use it without parsing 21 MB. Reconcile the two here, where both are
// already in memory, so the cheap copy can never drift from the real artifact.
if (counts.municipalDirectoryEntries !== internationalMunicipalities.entities.length || counts.municipalDirectoryCountries !== internationalMunicipalities.countries.length) throw new Error("data-freshness municipality totals do not reconcile with the published municipality directory");
// Itemized municipal coverage: publication is now MEASURED from on-site
// artifacts, so a country PSD ingested but never published reports zero. Zero on
// its own is indistinguishable from "never researched", so every row must state
// which of the two honest publication states it is in, and warehouse-only rows
// must carry the warehouse figure they are withholding from the site.
const itemizedByCode = counts.itemizedCoverageByCode;
const requiredInternationalItemized = ["POL", "DNK", "UKR", "FRA", "SWE", "GBR", "DEU", "USA", "CHE"];
if (municipalItemizedCoverage.countries.length !== pinned.itemizedCoverageCountries) throw new Error("Expected itemized municipal coverage for twenty-eight countries, including warehouse-only Paraguay");
for (const country of municipalItemizedCoverage.countries) {
  if (!["published", "warehouse_only", "headline_only"].includes(country.publication_status)) throw new Error(`${country.code}: invalid itemized publication_status ${JSON.stringify(country.publication_status)}`);
  if (country.published_profile_count !== country.profile_count) throw new Error(`${country.code}: published itemized profile count must equal the measured profile count`);
  if (country.publication_status === "headline_only" && (country.profile_count !== 0 || !(country.distinct_classification_code_count < country.minimum_distinct_classification_codes))) throw new Error(`${country.code}: headline-only coverage must report zero itemized profiles and document the failed classification threshold`);
}
for (const code of requiredInternationalItemized) {
  const country = itemizedByCode.get(code);
  if (!country) throw new Error(`Missing itemized municipal coverage row for ${code}`);
  if (country.publication_status === "warehouse_only") {
    // Loaded into the production warehouse, deliberately not published on the
    // site. The site must be able to say exactly that instead of rendering the
    // country as unresearched.
    if (country.status !== "warehouse_only" || country.profile_count !== 0 || country.published_profile_count !== 0) throw new Error(`${code}: a warehouse-only country must report zero published itemized profiles`);
    if (!(Number(country.warehouse_profile_count) > 0) || Number(country.warehouse?.profile_count) !== Number(country.warehouse_profile_count)) throw new Error(`${code}: a warehouse-only country must preserve its positive warehouse profile count`);
    if (country.warehouse?.published_on_site !== false || !country.scope_limitations?.length) throw new Error(`${code}: a warehouse-only country must state that it is not published on site and why`);
  } else {
    if (!(country.profile_count > 0) || !country.measured_from || !country.period || !country.stages?.length) throw new Error(`${code}: a published country must expose measured itemized profiles with their source, period and stages`);
  }
}
// Published itemized coverage may grow as warehouse-only countries are promoted;
// it must never silently shrink back.
if (counts.itemizedPublishedProfiles < pinned.itemizedPublishedProfilesFloor) throw new Error(`Published itemized municipal profiles fell to ${counts.itemizedPublishedProfiles}, below the ${pinned.itemizedPublishedProfilesFloor} already shipped`);
if (counts.itemizedPublishedProfiles !== counts.itemizedPublishedProfileCountSum) throw new Error("Itemized coverage profile_count and published_profile_count do not reconcile");
if (counts.warehouseOnlyCountries + counts.headlineOnlyCountries + counts.publishedItemizedCountries !== pinned.itemizedCoverageCountries) throw new Error("Every itemized-coverage country must be published, warehouse-only or headline-only");
// Every country the warehouse artifact declares must agree with the acquisition audit's own
// verification block, rather than with a table retyped here. A hardcoded list silently
// leaves a newly loaded country UNPINNED — which is the failure mode, not the safe default.
{
  const verification = municipalItemizedAcquisitionAudit.production_load?.verification || {};
  for (const [code, recorded] of Object.entries(verification)) {
    const country = internationalItemizedWarehouse.countries.find((row) => row.code === code);
    if (!country) throw new Error(`${code}: verified in the acquisition audit but absent from the itemized-warehouse artifact`);
    // The audit names these entities / line_facts / balance_facts; the warehouse artifact
    // names them profile_count / line_fact_count / balance_fact_count. An absent
    // balance_facts means none were loaded, which the artifact records as zero.
    for (const [artifactField, auditValue] of [["profile_count", recorded.entities], ["line_fact_count", recorded.line_facts], ["balance_fact_count", recorded.balance_facts ?? 0]]) {
      if (auditValue === undefined) continue;
      if (Number(country[artifactField] ?? 0) !== Number(auditValue)) throw new Error(`${code}: ${artifactField} is ${country[artifactField]} in the warehouse artifact but ${auditValue} in the acquisition audit`);
    }
  }
  const load = municipalItemizedAcquisitionAudit.production_load;
  if (load?.status !== "loaded") throw new Error("Municipal itemized acquisition audit must record a completed production load");
  // A count that grows with every load must never be pinned by equality. It may only fail
  // by describing fewer bundles than it actually verified.
  if (Number(load.bundles_loaded) < Object.keys(verification).length) throw new Error(`Acquisition audit reports ${load.bundles_loaded} bundles loaded but verifies ${Object.keys(verification).length}`);
}
// The headline volume figure the coverage page prints. It is DERIVED from the
// four component artifacts, then reconciled against the independently written
// quality report, so a build that changes one component without regenerating the
// report fails here instead of shipping two different totals. Today: 362,612
// (121,199 registry + 100,021 history + 105,416 directory + 35,810 itemized).
if (dataQuality.counts.published_data_entries !== counts.publishedDataEntries) throw new Error(`Quality report publishes ${dataQuality.counts.published_data_entries} data entries; the artifacts measure ${counts.publishedDataEntries}`);
if (Object.values(dataQuality.published_entry_components||{}).reduce((sum, count) => sum + count, 0) !== counts.publishedDataEntries) throw new Error("Published entry components do not sum to the published data-entry total");
for (const [component, expected] of Object.entries(counts.publishedEntryComponents)) {
  if (dataQuality.published_entry_components?.[component] !== expected) throw new Error(`Quality report component ${component} is ${dataQuality.published_entry_components?.[component]}, measured ${expected}`);
}
if (counts.publishedDataEntries < pinned.publishedDataEntriesFloor) throw new Error(`Published data entries fell to ${counts.publishedDataEntries}, below the ${pinned.publishedDataEntriesFloor} already shipped`);
// Anchor countries. CZE is the complete Czech universe and DNK is a genuinely
// published collection: neither may be swept into the warehouse-only bucket.
for (const [code, expected] of Object.entries(pinned.itemizedAnchors)) {
  const country = itemizedByCode.get(code);
  if (country?.profile_count !== expected || country.publication_status !== "published") throw new Error(`${code}: expected ${expected} published itemized municipal profiles`);
}
// USA and DEU are the two countries whose warehouse scatter used to be reported
// as site coverage (4 profiles and a "partial" status for eleven German cities).
// Both must now report zero published profiles with the warehouse figure intact.
// The rule is "these must never be re-counted as published", so the profile figure is read
// from the warehouse artifact rather than retyped here — the two can no longer disagree.
for (const code of ["USA", "DEU"]) {
  const country = itemizedByCode.get(code);
  const warehoused = internationalItemizedWarehouse.countries.find((row) => row.code === code);
  if (country?.profile_count !== 0 || country.status !== "warehouse_only" || country.publication_status !== "warehouse_only") throw new Error(`${code}: expected zero published itemized profiles, held warehouse-only`);
  if (!warehoused || Number(country.warehouse_profile_count) !== Number(warehoused.profile_count)) throw new Error(`${code}: warehouse_profile_count disagrees with the itemized-warehouse artifact`);
}
if (benchmarkMunicipalities.reduce((sum, country) => sum + country.entities.length, 0) !== 1010) throw new Error("Expected 1,010 Nordic and Dutch municipal benchmark profiles");
// The full Czech budget profile is the canonical municipal template. It is deliberately
// server-rendered so the budget, history and methodology remain present in the document
// without waiting for a client-side shell. This guard prevents a bulk profile rewrite from
// silently replacing the production template with a loading placeholder again.
if (czechProfileSamples.some((page) =>
  !page.includes('class="cz-budget-page detail-page"') ||
  !page.includes('id="history-explorer"') ||
  !page.includes('id="rozpocet"') ||
  !page.includes('class="data-contract"') ||
  page.includes('municipal-profile-loading') ||
  page.includes('municipal-expanded-profile.js')
)) throw new Error("Czech municipal profiles must use the full server-rendered Czech budget template");
// International profiles use the Czech presentation hierarchy as a capability
// contract. The first response must contain meaningful finance and provenance
// content; JavaScript may enhance it, but must never be the only page renderer.
if (internationalProfileSamples.some((page) =>
  !page.includes("international-municipality-profile") ||
  !page.includes('class="detail-hero"') ||
  !page.includes('id="rozpocet"') ||
  !page.includes('id="native-detail"') ||
  !page.includes('class="detail-side-tabs"') ||
  !page.includes('id="profile-detail-visual"') ||
  !page.includes('class="raw-detail-audit"') ||
  !page.includes('class="data-contract" id="metodika"') ||
  !cacheBusted(page, "municipal-expanded-profile.js") ||
  page.includes("municipal-profile-loading")
)) throw new Error("International municipal profiles must ship a server-rendered Czech-style first view");
if (internationalProfileSamples[0].includes('<a href="#history-explorer">') || !internationalProfileSamples[0].includes("Překrývající se účetní skupiny")) throw new Error("Denmark must retain native detail without inventing headline history or totals");
if (germanMunicipalProfilePage.includes("municipal-profile-loading") || !germanMunicipalProfilePage.includes('id="overview"') || !germanMunicipalProfilePage.includes('id="metodika"') || !germanMunicipalProfilePage.includes("Položkový městský rozpočet z těchto souhrnů nedopočítáváme")) throw new Error("Germany's headline-only route must render an honest coverage-first profile shell");
for (const [code, expected, status] of [["DNK",98,"aggregate_only"],["ESP",6198,"complete"],["JPN",1741,"complete"]]) {
  const country = internationalMunicipalities.countries.find((item) => item.code === code);
  if (!country || country.status !== status || country.directory_count !== expected || internationalMunicipalities.entities.filter((item) => item.country === code && item.url).length !== expected) throw new Error(`${code}: incomplete municipality directory or profile routes`);
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
const parisOfgl = frenchParisProfile.profiles?.["75056"];
if (franceMunicipalities?.status !== "complete" || franceMunicipalities.directory_count !== 34875 || franceMunicipalities.latest_year_missing_count !== 97) throw new Error("Expected all 34,875 current French communes with an explicit 2025 provisional gap");
if (!Number.isFinite(parisOfgl?.history?.at(-1)?.revenue) || !Number.isFinite(parisOfgl?.history?.at(-1)?.debt) || !parisOfgl?.source_url?.includes("75056")) throw new Error("French profile shards must expose official OFGL aggregates and commune-specific source links");
if (!frenchMunicipalProfilePage.includes('data-profile-root="../../../data/france-municipal-profiles/"') || !frenchMunicipalProfilePage.includes("data.ofgl.fr") || !frenchMunicipalProfilePage.includes("Profil francouzské obce")) throw new Error("France must publish the generic OFGL-backed commune profile route");
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
if (dataQuality.status !== "passed" || dataQuality.failures.length || dataQuality.counts.municipalities !== pinned.municipalities || dataQuality.counts.sovereign_countries !== pinned.sovereignCountries) throw new Error("Expected a passing, machine-readable release quality report covering all 195 sovereign states");
// A `--data-only` integrity run skips every HTML, canonical, JSON-LD, sitemap
// and local-link check, yet still writes status "passed" -- and the public
// coverage page renders "● Checks passed" straight from that field. A partial
// report must never stand in for a full one, so require the report to say which
// scope it was produced under and refuse anything but a complete audit.
if (dataQuality.scope !== "full") throw new Error(`Release quality report was produced with scope ${JSON.stringify(dataQuality.scope)}; the published report must come from a full audit (node scripts/validate-integrity.mjs --write-report)`);
if (!dataQuality.checks || Object.values(dataQuality.checks).some((ran) => ran !== true) || (dataQuality.skipped_check_groups || []).length) throw new Error("Release quality report must record every check group as executed");
if (!(dataQuality.counts.html_files > 0) || !(dataQuality.counts.local_references > 0)) throw new Error("A full release quality report must count the HTML pages and local references it checked");
if (publicEntityHistory.summary.financial_rows !== 1043 || publicEntityHistory.entities.length < 100 || publicEntityHistory.entities.some((entity) => !entity.series.length)) throw new Error("Expected Czech public-entity financial history with all available annual statements");
if (!methodologyPage.includes('id="data-health-root"')) throw new Error("Methodology page must surface release health");
if (!countryPage.includes('id="health-performance"') || !countryPage.includes("country-health-performance.js") || !countryHealthPerformanceScript.includes("peerBars")) throw new Error("Country profiles must surface health capacity, utilisation and outcomes");
if (!czechHistoryScript.includes('view="overview"') || !czechHistoryScript.includes('view==="execution"') || !czechHistoryScript.includes('view==="structure"') || !czechHistoryScript.includes('expense_per_capita')) throw new Error("Municipal profiles must surface execution, structure and per-capita history views");
if (!czechEnterprisePage.includes('id="public-entity-history-root"') || !czechEnterpriseScript.includes("renderPublicHistory")) throw new Error("Czech public-entity profiles must surface annual financial histories");
if (norwayBenchmarkProfile.breakdown_kind !== "native_measures" || norwayBenchmarkProfile.breakdown.length < 70 || finlandBenchmarkProfile.breakdown_kind !== "native_measures" || finlandBenchmarkProfile.breakdown.length < 150 || netherlandsBenchmarkProfile.breakdown.length < 30) throw new Error("European benchmark profiles must expose complete latest native accounting detail");
if (countryParity.contract !== "country-parity.v1" || countryParity.countries.length !== 195) throw new Error("Expected all 195 sovereign-state profiles, including explicit WEO omissions");
const fullCountryCodes = new Set(["CZE","UKR","POL","DEU","GBR","FRA","USA","CHE","SWE","DNK","FIN","BRA","ESP","JPN","NLD","NOR","GRC"]);
if (countryParity.countries.filter((country) => fullCountryCodes.has(country.country_code)).some((country) => country.modules.sovereign.status !== "loaded" || country.modules.administrative_spending.status !== "loaded" || country.modules.common_spending.status !== "loaded" || country.modules.revenue.status !== "loaded" || country.modules.demography.status !== "loaded")) throw new Error("Every full national dashboard must load its core fiscal and demographic modules");
const explicitWEOOmissions = new Set(["CUB", "MCO", "PRK", "VAT"]);
if (countryParity.countries.some((country) => explicitWEOOmissions.has(country.country_code) ? country.modules.sovereign.status !== "unavailable" : country.modules.sovereign.status !== "loaded")) throw new Error("Every sovereign state must contain a loaded WEO series or an explicit WEO-unavailable status");
if (countryParity.countries.some((country) => country.coverage.total_modules !== 11)) throw new Error("Expected all eleven dashboard module slots for every country");
if (countryParity.countries.filter((country) => country.modules.municipalities.status === "loaded").length !== 27) throw new Error("Expected twenty-seven loaded municipal country layers");
if (administrativeSpending.countries.length !== 17 || administrativeSpending.countries.flatMap((country) => country.rows).length !== 448 || administrativeSpending.countries.some((country) => country.rows.some((row) => !row.label_native || !row.label_en))) throw new Error("Every national budget row must retain its native label and an English translation");
if (Object.keys(countryDemography.countries).length !== 17 || Object.values(countryDemography.countries).reduce((sum, country) => sum + country.detail_row_count, 0) !== 137865) throw new Error("Expected complete seventeen-country annual age-by-sex demographic projections");
if (Object.keys(publicEntityCoverage.countries).length !== 10 || publicEntityDirectory.total_record_count !== 121199 || publicEntityDirectory.countries.length !== 10 || publicEntityAggregates.observations.length < 350) throw new Error("Expected the complete ten-country public-entity registry, coverage contract and economic observations");
if (publicEntityDirectory.countries.some((country) => !country.file || !Number.isFinite(country.record_count)) || Object.values(publicEntityCoverage.countries).some((country) => !country.registry_file || !country.sources.length)) throw new Error("Every public-entity country must expose a registry file and source lineage");
if (methodologySources.row_count !== 2173 || methodologySources.countries.length !== 195 || methodologySources.modules.length !== 12 || methodologySources.rows.filter((row) => row.module === "municipal_itemized").length !== 28) throw new Error("Expected the complete 195-country sovereign, municipal and itemized-budget source ledger");
// The ledger carries two independent axes -- what PSD has loaded (`status`) and
// what exists upstream (`source_availability`) -- and the point of the check is
// that they stay independent without contradicting each other. Reconcile the two
// axes instead of pinning a row count that every coverage change rewrites.
if (methodologySources.rows.some((row) => row.status === "unavailable" || !["loaded", "source_available", "fragmented", "not_found", "not_researched"].includes(row.source_availability))) throw new Error("Methodology must distinguish PSD layers that are not loaded from independently researched source availability");
const ledgerLoadedRows = methodologySources.rows.filter((row) => row.source_availability === "loaded");
const ledgerNotLoadedRows = methodologySources.rows.filter((row) => row.status === "not_loaded");
if (ledgerLoadedRows.length + ledgerNotLoadedRows.length !== methodologySources.rows.length || ledgerLoadedRows.some((row) => row.status === "not_loaded")) throw new Error("Source-ledger status and source availability must agree on exactly which layers PSD has loaded");
if (ledgerLoadedRows.length < pinned.methodologyLoadedLedgerRowsFloor) throw new Error(`Source ledger reports ${ledgerLoadedRows.length} loaded layers, below the ${pinned.methodologyLoadedLedgerRowsFloor} already shipped`);
// The itemized ledger and the itemized coverage contract are built separately
// and must tell the same story: a country PSD publishes is "loaded", a country
// held in the warehouse is "not loaded" with an available upstream source.
const itemizedLedgerRows = methodologySources.rows.filter((row) => row.module === "municipal_itemized");
for (const row of itemizedLedgerRows) {
  const coverage = itemizedByCode.get(row.country_code);
  if (!coverage) throw new Error(`${row.country_code}: source ledger lists itemized municipal coverage the coverage contract does not describe`);
  if (["warehouse_only", "headline_only"].includes(coverage.publication_status)) {
    if (row.status !== "not_loaded" || row.source_availability !== "source_available") throw new Error(`${row.country_code}: a non-published itemized country must appear in the source ledger as not loaded by PSD with an available upstream source`);
  } else if (row.status === "not_loaded" || row.source_availability !== "loaded") throw new Error(`${row.country_code}: a published itemized country must appear in the source ledger as loaded`);
}
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
for (const [code, pipeline] of [["COL","headline_only"],["GEO","loaded"],["ITA","loaded"],["BOL","loaded"],["SLV","loaded_partial"],["MEX","loaded_partial"],["CRI","headline_only"],["GTM","loaded"],["PER","loaded"],["KOR","headline_only"],["CHL","loaded"]]) {
  if (municipalTransparency.countries.find((country) => country.iso3 === code)?.pipeline !== pipeline) throw new Error(`${code}: unexpected municipal transparency pipeline status`);
}
if (globalBudgetTransparency.countries.length !== 195 || globalBudgetTransparency.countries.filter((country) => country.national_budget.research_status === "assessed").length !== 125 || globalBudgetTransparency.countries.filter((country) => country.municipal_item_level.research_status === "researched").length !== 45) throw new Error("Expected a 195-state atlas with 125 national assessments and 45 municipal item-level reviews");
if (globalBudgetTransparency.countries.filter((country) => country.budget_transparency_index?.score !== null).length !== 125 || globalBudgetTransparency.countries.filter((country) => country.psd_coverage?.country_profile === "loaded").length !== 191 || globalBudgetTransparency.countries.filter((country) => country.psd_coverage?.ingestion_status === "discovery_crawl_started").length !== 0) throw new Error("Budget Transparency Index must distinguish indexed, IMF-profiled and unavailable countries");
// Both health-structure datasets state a number that can be checked against their own
// inputs, so check it. Ownership counts must account for every registered facility, and
// "unresolved" must mean exactly the facilities whose legal form does not name an owner —
// the whole value of that dataset is that it never guesses. The Norwegian care split must
// still add back up to the KOSTRA aggregate it was derived from; if it stops reconciling,
// the SHA grouping behind it has drifted from the source ledger.
for (const [code, entry] of Object.entries(hospitalOwnership.countries)) {
  if (!Number.isFinite(entry.facility_count)) continue;
  const counted = Object.values(entry.owner_class).reduce((total, n) => total + n, 0);
  if (counted !== entry.facility_count) throw new Error(`${code} hospital ownership counts ${counted} facilities against a register of ${entry.facility_count}`);
  const unresolved = entry.owner_class.unknown ?? 0;
  if (entry.resolved_count !== entry.facility_count - unresolved) throw new Error(`${code} hospital ownership resolved_count disagrees with its unresolved facilities`);
}
for (const [id, entity] of Object.entries(careEnvelope.entities)) {
  if (!entity.reconciliation) continue;
  if (entity.reconciliation.difference !== 0) throw new Error(`${id} care split no longer reconciles to ${entity.reconciliation.published_aggregate}`);
}
{
  const flow = careEnvelope.czech_flow_2023;
  for (const side of ["sources", "destinations"]) {
    const summed = Math.round(flow[side].reduce((total, row) => total + row.value_bn, 0) * 10) / 10;
    if (Math.abs(summed - Math.round(flow.total * 10) / 10) > 0.1) throw new Error(`Czech health flow ${side} sum to ${summed}bn against a published total of ${flow.total}bn`);
  }
}
if (globalBudgetTransparency.countries.find((country) => country.iso2 === "ge")?.budget_transparency_index?.score !== 100) throw new Error("Georgia's Budget Transparency Index must include its verified municipal lifecycle bonus");
// The index is an OBS score plus a municipal bonus, so it only exists where an OBS
// component exists. Scoring a country on its municipal capability alone mixed two
// incompatible 0-100 scales in one column: it ranked the Netherlands first in the
// world on municipal data with no central-government survey, and printed 0 for four
// countries the atlas had never surveyed.
for (const country of globalBudgetTransparency.countries) {
  const index = country.budget_transparency_index;
  if (index.evidence_status === "municipal_only" && index.score !== null) throw new Error(`${country.name_en} has no OBS component and must not carry a Budget Transparency Index score`);
  if (index.score === null) continue;
  if (!Number.isFinite(index.obs_component)) throw new Error(`${country.name_en} carries a Budget Transparency Index score without an OBS component`);
  const expected = Math.min(100, index.obs_component + (index.municipal_bonus ?? 0));
  if (index.score !== expected) throw new Error(`${country.name_en} scores ${index.score} where its own formula gives ${expected}`);
}
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
if (oecdKeyMetrics.dataset_id !== "OECD_KEY_METRICS_V1" || Object.keys(oecdKeyMetrics.countries).length !== 17 || Object.keys(oecdKeyMetrics.metrics).length < 19 || Object.keys(oecdKeyMetrics.sources).length < 11) throw new Error("Expected a seventeen-country OECD overlay with key metric and source contracts");
for (const [code, profile] of Object.entries(oecdKeyMetrics.countries)) {
  if (!profile.tax?.tax_to_gdp || !profile.comparison || Object.keys(profile.comparison).length < 5) throw new Error(`${code}: OECD overlay lacks the core tax or comparison layer`);
  for (const observation of Object.values(profile.comparison)) if (!Number.isFinite(observation.value) || !Number.isFinite(observation.year) || !observation.source_id) throw new Error(`${code}: invalid OECD comparison observation`);
}
if (!oecdKeyMetrics.countries.CZE.tax.labour.scenarios.some((scenario) => scenario.household_type === "S_C0" && scenario.principal_income === "AW100" && Number.isFinite(scenario.metrics.av_tw)) || !oecdKeyMetrics.countries.CZE.tax.corporate.statutory_combined || !oecdKeyMetrics.countries.CZE.tax.autonomy.local || !oecdKeyMetrics.countries.CZE.tax.carbon.net_effective_rate) throw new Error("Czech OECD tax layer must preserve household, corporate, autonomy and carbon-rate definitions");
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
// Cache-busting is asserted as a relationship — the asset is referenced and carries a
// version — using the shared helper, rather than as a pinned literal that has to be edited
// in the same commit as the asset. See scripts/validate-invariants.mjs.
if (!homepage.includes('id="category-comparison-root"') || !cacheBusted(homepage, "homepage-category.js") || !cacheBusted(homepage, "homepage-category.css")) throw new Error("Homepage must expose the compact country category comparison");
if (!homepage.includes('id="homepage-health-performance-root"') || !cacheBusted(homepage, "homepage-health-performance.js") || !cacheBusted(homepage, "homepage-health-performance.css")) throw new Error("Homepage must expose the compact health-performance comparison");
if (!homepageScript.includes("slice(0,20)") || !homepageScript.includes('type="search"') || !homepageScript.includes("macro-country-picker") || !homepageScript.includes("meta(code)?.iso2?.toLowerCase()") || !homepageScript.includes("v:populationMillions(c.country_code)") || !homepage.includes("chart-source-hover")) throw new Error("Homepage must use Top 20 views, searchable comparison countries, consistent SVG flags, population-ordered profile cards and hover-revealed sources");
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
if (!deepDivePage.includes('href="revenue/?code=CZE"') || !globalNav.includes('deep-dives/revenue/') || !revenueDeepDivePage.includes('id="hundred-flow"') || !revenueDeepDivePage.includes('id="revenue-tax-rates-root"') || !revenueDeepDivePage.includes('oecd-overlay.js?v=20260828-oecd-key-metrics') || !revenueDeepDivePage.includes('id="base-composition"') || !revenueDeepDivePage.includes('id="stability-chart"') || !revenueDeepDivePage.includes('id="transfer-path"') || !revenueDeepDiveScript.includes('environmentNote') || !oecdOverlayScript.includes('labour_tax_wedge_single')) throw new Error("Revenue deep dive must expose tax rates, sources, government levels, downturn stability and municipal transfers");
if (!deepDivePage.includes('href="tax-burden/?code=CZE"') || !deepDivePage.includes('href="redistribution/?code=CZE"') || !globalNav.includes('deep-dives/tax-burden/?code=CZE') || !globalNav.includes('deep-dives/redistribution/?code=CZE') || !taxBurdenPage.includes('data-oecd-chart="tax_wedge"') || !taxBurdenPage.includes('data-oecd-chart="tax_matrix"') || !taxBurdenPage.includes('data-oecd-chart="corporate_rates"') || !taxBurdenPage.includes('data-oecd-chart="carbon_autonomy"') || !redistributionPage.includes('data-oecd-chart="redistribution_bridge"') || !redistributionPage.includes('data-oecd-chart="socx_composition"') || !redistributionPage.includes('data-oecd-chart="pension_curve"') || !redistributionPage.includes('data-oecd-chart="outcomes_table"')) throw new Error("OECD tax-burden and redistribution reports must expose every promised chart and navigation path");
if (!comparisonPage.includes('id="oecd-scatter"') || !comparisonPage.includes('oecd-charts.css?v=20260829-oecd-reports') || !comparisonScript.includes('function renderOecdScatter()') || !comparisonScript.includes('data-scatter-axis')) throw new Error("Comparison must expose the reusable two-axis OECD scatterplot");
if (!countryPage.includes('data-oecd-chart="redistribution_bridge"') || !countryPage.includes('data-oecd-chart="socx_composition"') || !countryPage.includes('data-oecd-chart="pension_curve"') || !revenueDeepDivePage.includes('data-oecd-chart="tax_wedge"') || !oecdChartsScript.includes('autonomy_spectrum:renderAutonomy')) throw new Error("Country, revenue and municipality views must share the OECD chart renderer");
if (!czechMunicipalPage.includes('id="tax-autonomy"') || !czechMunicipalPage.includes('data-oecd-chart="autonomy_spectrum"') || municipalityCountryPages.some((page) => !page.includes('id="tax-autonomy"') || !page.includes('oecd-charts.js?v=20260829-oecd-reports'))) throw new Error("Every municipality-country page must include the source-backed OECD tax-autonomy spectrum contract");
if (!deepDivePage.includes('href="migration/"') || !globalNav.includes('deep-dives/migration/') || !migrationDeepDivePage.includes('id="migration-map"') || !migrationDeepDivePage.includes('id="migration-line-chart"') || !migrationDeepDivePage.includes('id="migration-protection-chart"') || !migrationDeepDivePage.includes('id="migration-ranking"') || !migrationDeepDivePage.includes('id="migration-table-body"') || !migrationDeepDivePage.includes('demo_gind') || !migrationDeepDiveScript.includes('`${metric}_per_1000`') || euMigration.contract !== "eu-migration.v1" || euMigration.countries.length !== 33 || euMigration.countries.some((country) => !country.rows.length || !country.protection_rows.length) || !euMigration.eu27_protection.length || euMigration.scope.latest_complete_aggregate_year !== 2024 || euMigration.scope.protection_last_year !== 2025) throw new Error("Migration deep dive must expose complete European flows, protection decisions, rates, history and source lineage");
if (!deepDivePage.includes('href="defense/?code=USA"') || !globalNav.includes('deep-dives/defense/?code=USA') || !defenseDeepDivePage.includes('id="defense-comparison-chart"') || !defenseDeepDivePage.includes('id="defense-lines-body"') || !defenseDeepDiveScript.includes('defense-target-tick') || defenseDeepDive.default_country !== "USA" || defenseDeepDive.countries.length !== 17 || defenseDeepDive.countries.some((country) => !country.comparison.series.length || !country.budget.items.length) || defenseDeepDive.commitments.nato_core_pct_gdp_2035 !== 3.5) throw new Error("Defense deep dive must default to the US and expose 17 sourced country histories, NATO target markers and native budget lines");
if (!deepDivePage.includes('href="education/"') || deepDivePage.indexOf('href="education/"') > deepDivePage.indexOf('href="transportation/?code=CZE"') || !globalNav.includes('deep-dives/education/') || !educationDeepDivePage.includes('id="education-flow"') || !educationDeepDivePage.includes('id="education-region-chart"') || !educationDeepDivePage.includes('id="capacity-benchmark-chart"') || !educationDeepDivePage.includes('id="capacity-country-body"') || !educationDeepDivePage.includes('id="coverage-body"') || !educationDeepDivePage.includes('education-deep-dive.js?v=20260902-country-load-2') || !educationDeepDiveScript.includes('education-deep-dive.v1.json?v=20260902-country-load-2') || !educationDeepDiveScript.includes('renderCapacityBenchmark') || !educationDeepDiveScript.includes('renderCapacityCountry') || Math.abs(educationDeepDive.headline.consolidated_education_czk_bn - 368.0638) > 0.001 || educationDeepDive.local.regions.length !== 14 || educationDeepDive.capacity.headline_enrolments !== 2226933 || educationDeepDive.capacity.categories.length !== 7 || educationDeepDive.capacity.benchmark.levels.length !== 5 || educationDeepDive.coverage.counts.ready !== 1 || educationDeepDive.coverage.counts.download !== 10 || educationDeepDive.coverage.counts.online !== 6) throw new Error("Education must reconcile Czech finance, capacity, school-type, regional and international benchmark layers");
if (educationCapacityInternational.period !== "2024" || educationCapacityInternational.country_count !== 6 || educationCapacityInternational.level_count !== 5 || educationCapacityInternational.countries.some((country) => country.levels.length !== 5 || country.levels.some((level) => !Number.isFinite(level.learners_headcount) || !Number.isFinite(level.learners_fte) || !Number.isFinite(level.teaching_fte) || level.schools_or_institutions !== null)) || educationCapacityInternational.countries.find((country) => country.code === "CHE")?.levels.some((level) => level.learners_per_teaching_fte !== null) || JSON.stringify(educationDeepDive.capacity.international.countries) !== JSON.stringify(educationCapacityInternational.countries)) throw new Error("Education capacity must load six core countries with complete comparable learner and teacher-FTE observations, explicit Swiss ratio gaps and pending national institution counts");
if (!deepDivePage.includes('href="trade/?code=DEU"') || !tradeDeepDivePage.includes('id="trade-kpis"') || !tradeDeepDivePage.includes('id="trade-chart"') || !tradeDeepDivePage.includes('id="trade-partners"') || !tradeDeepDivePage.includes('id="trade-products"') || !tradeDeepDiveScript.includes('/api/v1/trade?country=')) throw new Error("Trade deep dive must expose headline balances, a dynamic trend, and linked partner and product rankings");
if (!deepDivePage.includes('href="product-markets/"') || !globalNav.includes('deep-dives/product-markets/') || !productMarketsPage.includes('id="product-intelligence"') || !productMarketsPage.includes('id="product-flow"') || !productMarketsPage.includes('id="product-history"') || !cacheBusted(productMarketsPage, "trade-product-intelligence.js") || !cacheBusted(productMarketsPage, "trade-product-intelligence.css") || !tradeProductIntelligenceScript.includes("product-intelligence.v1.json")) throw new Error("Standalone product markets must expose EU aggregation, bilateral flows, history, and report navigation");
if (tradeDeepDivePage.includes('id="product-intelligence"') || cacheBusted(tradeDeepDivePage, "trade-product-intelligence.js") || !tradeDeepDivePage.includes('new URL("../product-markets/"')) throw new Error("Country trade must keep product markets separate and redirect legacy product links");
if (tradeProductIntelligence.contract !== "trade-product-intelligence.v1" || tradeProductIntelligence.business_areas.length !== 5 || !tradeProductIntelligence.scope.available_periods.length || !tradeProductIntelligence.scope.geography_rollups.includes("COUNTRY") || !tradeProductIntelligence.scope.geography_rollups.includes("EU27_AGGREGATED")) throw new Error("Product-intelligence snapshot must expose five annual business areas and both geography rollups");
for (const area of tradeProductIntelligence.business_areas) {
  if (!area.periods.length || !area.hs) throw new Error(`Product-intelligence area ${area.code} has no annual period or HS definition`);
  for (const period of area.periods) {
    if (!(period.primary_value_usd > 0) || !(period.observed_route_count > 0)) throw new Error(`Product-intelligence area ${area.code} ${period.period} has no observed value or routes`);
    for (const rollup of ["COUNTRY", "EU27_AGGREGATED"]) {
      const geography = period.geographies[rollup];
      if (!geography?.origins?.length || !geography?.markets?.length || !geography?.flows?.length || geography.flows.some((flow) => !(flow.primary_value_usd > 0))) throw new Error(`Product-intelligence area ${area.code} ${period.period} has an incomplete ${rollup} view`);
      const flowTotal = geography.flows.reduce((sum, flow) => sum + flow.primary_value_usd, 0);
      if (Math.abs(flowTotal - period.primary_value_usd) > Math.max(1, period.primary_value_usd * 1e-9)) throw new Error(`Product-intelligence flow total does not reconcile for ${area.code} ${period.period} ${rollup}`);
    }
  }
}
// itemized_municipal_profiles is reconciled against the coverage file rather
// than restated: the freshness build and the coverage build must measure the
// same 35,810 published profiles, and the coverage file is the one authority.
if (!methodologyPage.includes('id="data-freshness"') || !dataFreshnessScript.includes('data/data-freshness.v1.json') || dataFreshness.totals.countries !== pinned.sovereignCountries || dataFreshness.totals.modules !== 16 || dataFreshness.totals.records !== dataFreshness.records.length || dataFreshness.totals.municipal_country_coverage !== pinned.municipalDirectoryCountries || dataFreshness.totals.itemized_municipal_country_coverage !== pinned.itemizedCoverageCountries || dataFreshness.totals.itemized_municipal_profiles !== counts.itemizedPublishedProfiles || dataFreshness.totals.municipal_units !== pinned.municipalUnitsInScope || dataFreshness.records.filter((record) => record.module === "sovereign" && record.vintage_type === "estimate").length !== 19 || dataFreshness.records.some((record) => !record.country_code || !record.module || !record.artifact)) throw new Error("Methodology must expose complete cross-layer freshness, distinct municipal coverage levels and source estimate vintages");
if (!cloudbuild.includes("scripts/assert-single-production.sh") || !cloudbuild.includes("scripts/deploy-immutable.sh") || !cloudbuild.includes("- czbudget-public") || cloudbuild.includes("${_SERVICE}") || cloudbuild.includes("czbudget-web")) throw new Error("Cloud Build must be locked to the sole canonical production service");
if (!cloudbuild.includes("scripts/build_trade_product_intelligence.py")) throw new Error("Production builds must refresh the public trade product-intelligence snapshot from BigQuery");
if (!cloudbuild.includes("scripts/merge-municipal-breakdowns.mjs") || !municipalI18n.includes("renderBudgetBreakdown") || !municipalI18n.includes("municipal-budget-codebook.v1.json")) throw new Error("Municipal profiles must surface the detailed FIN 2-12 M breakdown");
if (!capitalsScript.includes('data/large-city-history.v1.json') || !capitalsScript.includes('renderHistory(city)')) throw new Error("European capitals must surface the Prague ten-year history");
const fiscalFields = ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp", "gross_debt_pct_gdp", "nominal_gdp_local_bn", "nominal_gdp_usd_bn", "inflation_pct"];
if (sovereign.series.some((country) => fiscalFields.some((field) => !country.metrics[field]?.values?.length))) throw new Error("Country profiles require complete nominal and inflation fiscal series");
for (const country of sovereign.countries) {
  if (!country.iso2) throw new Error(`${country.country_code} must declare an ISO-2 flag code`);
  await stat(`assets/flags/${country.iso2.toLowerCase()}.svg`);
}
if (sovereign.schema_version !== "1.1.0" || sovereign.fiscal_perimeters?.comparison_scope !== "general_government" || sovereign.fiscal_perimeters?.perimeters?.length !== 3) throw new Error("Sovereign benchmark must declare all three fiscal perimeters and the comparison scope");
if (sovereign.countries.some((country) => !country.fiscal_architecture?.national_budget_label_cs || !country.fiscal_architecture?.architecture_cs || !country.fiscal_architecture?.corporation_note_cs || country.fiscal_architecture?.sources?.length < 1)) throw new Error("Every tracked country must describe its national fiscal architecture and public-corporation treatment");
if (!countryPage.includes('data-chart-view="real"') || !cacheBusted(countryPage, "country.js") || !countryScript.includes("function fiscalAmount")) throw new Error("Country profiles must expose the dynamic inflation-adjusted chart view");
if (!countryPage.includes('id="scope-perimeter-grid"') || !countryScript.includes("function scopeProfile") || !countryScript.includes("fiscal_architecture")) throw new Error("Country profiles must visibly distinguish fiscal perimeters and country architecture");
if (!czechBudgetPage.includes('class="finance-structure-section"') || !czechBudgetPage.includes('id="revenue-pie-chart"') || !czechBudgetPage.includes('id="expenditure-pie-chart"') || !czechBudgetPage.includes('class="fiscal-series-scope"') || !czechBudgetPage.includes('class="enterprise-nonadditivity-note"') || !czechBudgetPage.includes('class="benchmark-scope-contract"')) throw new Error("Czech budget must lead with complete revenue and expenditure structure while disclosing the scope of every fiscal layer");
if (!cacheBusted(czechBudgetPage, "styles.css") || !cacheBusted(czechBudgetPage, "app.js") || !cacheBusted(czechBudgetPage, "budget-i18n.js")) throw new Error("Czech budget assets must all be cache-busted");
if (!czechBudgetPage.includes('id="model-system-cost"') || !czechBudgetPage.includes('id="model-system-cost-note"') || !czechBudgetPage.includes('id="system-cost-chart"')) throw new Error("Demographic model must expose absolute annual system costs and their baseline");
if (!czechBudgetScript.includes('d=>d.pension],["health","Zdravotnictví",d=>d.health],["care","Péče",d=>d.care]') || /pensionExtra|healthExtra|careExtra/.test(czechBudgetScript)) throw new Error("Annual system costs must use absolute modeled expenditure, not changes from 2025");
for (const key of ["pension_expense", "pension_income", "health_expense", "care_allowance"]) if (!Number.isFinite(demography.base_2025?.[key]) || demography.base_2025[key] <= 0) throw new Error(`Demographic base amount ${key} must be positive`);
if (!czechBudgetScript.includes("requiredBaseAmounts") || !czechBudgetScript.includes("pension_age_sensitive_share:pensionAgeShare")) throw new Error("Demographic calculations must validate base amounts and use declared model assumptions");
if (!homepageScript.includes("PSDCountryRoutes.href") || homepageScript.includes("country.html?code=") || homepageScript.includes('code==="CZE"?')) throw new Error("Every country card must use readable shared country routes");
// country.html is served for every /countries/<slug> route, so a <base> tag
// rewrites every relative URL on the page against the base instead of the
// current path -- which silently sent every in-page section-nav link ("#trend",
// "?code=…") back to the homepage. Assert the absence, not the presence: this is
// the check that would have caught it.
if (/<base\b/i.test(countryPage)) throw new Error("country.html must not declare a <base> tag: it rewrites every relative section-nav link on /countries/<slug> to the site root");
if (!countryPage.includes("country-routes.js") || !countryScript.includes("PSDCountryRoutes.codeFromLocation") || !countryScript.includes("PSDCountryRoutes.href") || !globalNav.includes("countrySlugs[code] || String(code).toLowerCase()") || !countryRoutes.includes('CHE: "switzerland"') || !countryRoutes.includes('BRA: "brazil"') || !countryRoutes.includes('JPN: "japan"') || !countryRoutes.includes('FIN: "finland"') || !countryRoutes.includes("normalizedCode.toLowerCase()")) throw new Error("Country profiles must use readable routes for the full profiles and ISO3 fallback routes globally");
if (!nginx.includes("location = /country.html") || !nginx.includes("return 301 $legacy_country_path") || !nginx.includes("/countries/switzerland") || !nginx.includes("try_files /country.html =404")) throw new Error("Nginx must redirect legacy country URLs and serve readable country routes");
if (!nginx.includes("global-nav.js?v=20260828-education") || nginx.includes("global-nav.js?v=20260827-germany-routes") || nginx.includes("global-nav.js?v=20260827-coverage-menu")) throw new Error("Nginx must publish the country-aware methodology navigation under a fresh cache key");
if (!nginx.includes("denmark|finland|france") || !nginx.includes("greece|[a-z][a-z][a-z])/$") || !nginx.includes("greece|[a-z][a-z][a-z])$") || nginx.includes("try_files /countries/$1/index.html =404")) throw new Error("All IMF-covered countries must use the shared national dashboard route");
if (!countryParityStyles.includes("background:#fff;color:#17241f") || !countryParityStyles.includes("color:#4f5a55")) throw new Error("Country data-layer cards must keep readable dark text on white backgrounds");
if (!czechMunicipalPage.includes('municipalities-czechia.js') || !internationalMunicipalScript.includes('CZE:"czechia"') || !internationalMunicipalScript.includes('DEU:"germany"') || !municipalityCountryScript.includes('profiles.DEU=') || !germanMunicipalProfilePage.includes('data/international-municipalities/DEU.v1.json')) throw new Error("Municipality hub must link to the Czechia and Germany detail routes");
if (!cacheBusted(homepage, "styles-v2.css") || !cacheBusted(homepage, "homepage-v2.js") || !cacheBusted(homepage, "global-nav.js") || !cacheBusted(homepage, "site-header.css")) throw new Error("Homepage assets must all be cache-busted");
if (homepage.includes('id="compare"') || homepage.includes('id="method"') || !comparisonPage.includes('id="benchmark-overview"') || !comparisonPage.includes('id="benchmark-country"') || !homepageScript.includes("function benchmark")) throw new Error("Comparison and methodology must be separated from the homepage");
if (globalNav.includes('code === "CZE"') || !globalNav.includes('assets/flags/${flag}.svg') || !countryScript.includes("czech-view-grid")) throw new Error("Country navigation must use shared profiles, SVG flags, and both Czech detail views");
// The perimeter used to be a hardcoded caption. It is now a control bound to
// data/compare-metrics.v1.json, so the guard checks the control, the registry entry
// behind it, and that every metric's contract actually resolves. A conditional metric
// without a group_by, or a refusal pointing at a metric that does not exist, would
// render as a silent fallback to the ranked table — the one failure the contract exists
// to prevent.
if (!comparisonPage.includes('id="compare-perimeters"') || !comparisonPage.includes('id="compare-perimeter-note"') || !comparisonPage.includes('id="compare-contract"') || !comparisonPage.includes('id="compare-result"') || !comparisonPage.includes("compare-contract.js?v=") || !comparisonPage.includes("compare-contract.css?v=")) throw new Error("Comparison page must expose the contract-driven perimeter control");
if (!comparisonPage.includes('id="comparison-view"') || !comparisonPage.includes('id="comparison-country"') || !comparisonPage.includes('id="comparison-selection"') || !comparisonPage.includes('id="compare-provenance"') || !comparisonPage.includes('id="comparison-coverage-count"') || !comparisonScript.includes("slice(0, 20)") || !comparisonScript.includes("selectedCountries") || !comparisonScript.includes("sourceFor(metric)") || !comparisonScript.includes("c.iso2.toLowerCase()")) throw new Error("Comparison page must expose a multi-country metric explorer with Top 20 views, provenance and SVG flags");
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
if (comparisonPage.includes('id="fiscal-architecture-body"') || !methodologyPage.includes('id="accounting-boundaries"') || !methodologyPage.includes('id="fiscal-architecture-body"') || !coverageAccountingScript.includes("fiscal_architecture")) throw new Error("Coverage, not comparison, must explain accounting depth across all tracked countries");
if (!methodologyPage.includes('class="status-header"') || !methodologyPage.includes('class="status-volume"') || !methodologyPage.includes('id="status-data-total"') || !methodologyPage.includes('id="coverage-matrix-body"') || !methodologyPage.includes('class="status-definitions"') || !methodologyPage.includes('class="method-ledger"') || !methodologyPage.includes('id="municipal-transparency"') || methodologyPage.indexOf('id="municipal-transparency"') < methodologyPage.indexOf('class="method-ledger"') || !aboutPage.includes("Hlidac statu, z.u.") || !aboutPage.includes("hlidac-statu-horizontal-inverted-bw.svg") || aboutPage.includes("Mnichovice") || !homepage.includes("data-global-footer") || !internationalMunicipalPage.includes("data-global-footer")) throw new Error("Technical data status, source ledger, bottom-of-page municipal atlas, and global project credits must be present");
if (!aboutPage.includes('class="about-story"') || !aboutPage.includes('data-page-copy="aboutMissionCopy"') || !aboutPage.includes('class="maker-showcase"')) throw new Error("About page must include the project description and publisher");
if (!cacheBusted(countryPage, "country-spending.js") || !cacheBusted(countryPage, "country-insights.js") || !cacheBusted(countryPage, "country-dashboard.js") || !cacheBusted(countryPage, "country-dashboard.css") || !countryPage.includes('country-public-entities.js?v=20260823-public-registry-2') || !countryPage.includes('country-public-entities.css?v=20260823-public-registry-2') || !countryPage.includes('country-health.js?v=20260822-czech-flow') || !countryPage.includes('country-providers.js?v=20260822-network') || !countryPage.includes('country-functions.js?v=20260822-transport-deep-dive') || !countryPage.includes('country-cash-in.js?v=20260824-loaded-layers') || !countryPage.includes('country-parity.js?v=20260822-parity-contract') || !countryPage.includes('oecd-overlay.js?v=20260828-oecd-key-metrics') || !countryPage.includes('id="data-parity"') || !countryPage.includes('id="cash-in"') || !countryPage.includes('id="oecd-benchmark"') || !countryPage.includes('id="budget-map"') || !countryPage.includes('id="public-entities"') || !countryPage.includes('id="demography"') || !countryPage.includes('id="provider-network"') || !countryPage.includes('id="social-system"') || !countryPage.includes('id="transportation"') || !countryPage.includes('id="recovery"') || !countryScript.includes('function recoveryStory') || !countryScript.includes('countryprofilechange') || !countryInsightsScript.includes("label_en") || !countryPublicEntitiesScript.includes("public-entity-coverage.v1.json") || countryInsightsScript.includes("country-public-entities.v1.json") || !countryDashboardScript.includes('index.id = "country-dashboard-index"') || !countryDashboardScript.includes('ids:["trend", "cash-in", "oecd-benchmark", "macro", "recovery"]') || !countryDashboardScript.includes('ids:["data-parity", "sources"]') || !countryCashInScript.includes('public-entity-directory/manifest.v1.json')) throw new Error("Fiscal profiles must preserve all shared insight modules and Czech-style dashboard composition");
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
  if ((page.match(/global-nav\.js\?v=(?:20260822-component|20260824-identity-outlines|20260824-logo-120|20260824-budget-stages|20260825-country-expansion|20260826-migration|20260828-education|20260829-oecd-reports|20260901-trade-menu|20260901-public-employment|20260902-product-markets|20260902-migration-protection)/g) || []).length !== 1) throw new Error(`${path}: expected exactly one shared header script`);
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
for (const required of ["oecd-overlay.js", "oecd-overlay.css", "data/oecd-key-metrics.v1.json", "scripts/build-oecd-key-metrics.py"]) await stat(required);
for (const required of ["oecd-charts.js", "oecd-charts.css", "deep-dives/tax-burden/index.html", "deep-dives/redistribution/index.html"]) await stat(required);
await stat("deep-dives/ageing/index.html");
await stat("ageing-bill.js");
await stat("ageing-bill.css");
for (const required of ["deep-dives/migration/index.html", "migration-deep-dive.js", "migration-deep-dive.css", "data/eu-migration.v1.json", "scripts/build-eu-migration.mjs"]) await stat(required);
for (const required of ["deep-dives/defense/index.html", "defense-deep-dive.js", "defense-deep-dive.css", "data/defense-deep-dive.v1.json", "scripts/build-defense-deep-dive.py"]) await stat(required);
for (const required of ["deep-dives/education/index.html", "education-deep-dive.js", "education-deep-dive.css", "data/education-deep-dive.v1.json", "data/education-capacity-international.v1.json", "scripts/build-education-deep-dive.py", "scripts/load-education-capacity.py"]) await stat(required);
for (const required of ["deep-dives/public-employment/index.html", "public-employment.js", "public-employment.css", "public-employment-benchmark.css", "data/cz-public-employment.v1.json", "pipeline/transforms/build_czech_public_employment.py", "pipeline/source_data/cze_public_employment_observations.csv", "pipeline/source_data/oecd_public_employment_europe_2025.csv"]) await stat(required);
for (const required of ["deep-dives/product-markets/index.html", "trade-product-intelligence.js", "trade-product-intelligence.css", "data/trade/product-intelligence.v1.json", "scripts/build_trade_product_intelligence.py"]) await stat(required);
const tradeProductSnapshotStat = await stat("data/trade/product-intelligence.v1.json");
if ((tradeProductSnapshotStat.mode & 0o044) !== 0o044) throw new Error("Product-intelligence snapshot must be world-readable by the production web server");
for (const required of ["data-freshness.js", "data-freshness.css", "data/data-freshness.v1.json", "scripts/build-data-freshness.mjs"]) await stat(required);
console.log("CZ Budget site validation passed");
