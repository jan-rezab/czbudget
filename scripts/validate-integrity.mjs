import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataOnly = process.argv.includes("--data-only");
const writeReport = process.argv.includes("--write-report");
const failures = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const close = (a, b, tolerance = 0.011) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const json = async (file) => JSON.parse(await readFile(file, "utf8"));

async function filesBelow(directory, predicate = () => true) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "dist", "node_modules", "test-results", "playwright-report"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target, predicate));
    else if (predicate(target)) output.push(target);
  }
  return output;
}

function inspectFinite(value, location) {
  if (typeof value === "number" && !Number.isFinite(value)) failures.push(`Non-finite number at ${location}`);
  else if (Array.isArray(value)) value.forEach((item, index) => inspectFinite(item, `${location}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => inspectFinite(item, `${location}.${key}`));
}

const canonicalProductionJson = (file) => {
  if (!file.endsWith(".json")) return false;
  const parent = path.basename(path.dirname(file));
  if (parent === "entities") return /^\d{8}\.json$/.test(path.basename(file));
  if (parent === "municipal-history") return path.basename(file) === "index.json" || /^\d{8}\.json$/.test(path.basename(file));
  return true;
};
const productionJson = [
  ...await filesBelow(path.join(root, "data"), canonicalProductionJson),
  ...await filesBelow(path.join(root, "lib", "data"), (file) => file.endsWith(".json")),
];
for (const file of productionJson) {
  try { inspectFinite(await json(file), path.relative(root, file)); }
  catch (error) { failures.push(`Invalid JSON ${path.relative(root, file)}: ${error.message}`); }
}

try {
  const release = await json("data/release-manifest.v1.json");
  for (const artifact of release.artifacts) {
    if (["data/entities/*.json", "data/municipal-history/*.json"].includes(artifact.path)) {
      const digest = createHash("sha256");
      let bytes = 0;
      const directory = artifact.path.slice(0, -"/*.json".length);
      const names = (await readdir(path.join(root, directory))).filter((name) => directory.endsWith("entities") ? /^\d{8}\.json$/.test(name) : name === "index.json" || /^\d{8}\.json$/.test(name)).sort();
      for (const name of names) {
        const content = await readFile(path.join(root, directory, name));
        digest.update(name).update("\0").update(content);
        bytes += content.length;
      }
      assert(names.length === artifact.files && bytes === artifact.bytes && digest.digest("hex") === artifact.sha256, `Release manifest tree digest mismatch for ${artifact.path}`);
    } else {
      const content = await readFile(path.join(root, artifact.path));
      assert(content.length === artifact.bytes && createHash("sha256").update(content).digest("hex") === artifact.sha256, `Release manifest mismatch for ${artifact.path}`);
    }
  }
} catch (error) {
  failures.push(`Release manifest validation failed: ${error.message}`);
}

const snapshot = await json("data/municipal-snapshot.v1.json");
const municipalities = snapshot.municipalities;
const benchmarkMunicipalityIndexes = await Promise.all(["nor", "nld", "fin"].map((code) => json(`data/municipal-benchmarks/${code}.json`)));
const benchmarkMunicipalities = benchmarkMunicipalityIndexes.flatMap((country) => country.entities);
const municipalityById = new Map(municipalities.map((item) => [item.national_id, item]));
assert(municipalities.length === 6254, `Expected 6,254 municipalities, received ${municipalities.length}`);
assert(municipalityById.size === municipalities.length, "Duplicate municipal national IDs");
assert(new Set(municipalities.map((item) => item.seo.slug)).size === municipalities.length, "Duplicate municipal slugs");

const municipalHistoryIndex = await json("data/municipal-history/index.json");
const municipalDirectoryHistory = await json("data/municipal-history-directory.v1.json");
const municipalHistoryFiles = (await readdir(path.join(root, "data", "municipal-history"))).filter((name) => /^\d{8}\.json$/.test(name));
assert(municipalHistoryIndex.period.from === 2010 && municipalHistoryIndex.period.to === 2025, "Municipal history period must be 2010–2025");
assert(municipalHistoryIndex.municipality_count === municipalities.length, "Municipal history index count mismatch");
assert(municipalHistoryFiles.length === municipalities.length, `Expected ${municipalities.length} municipal history files, received ${municipalHistoryFiles.length}`);
assert(JSON.stringify(municipalDirectoryHistory.columns) === JSON.stringify(["national_id", "year", "revenue_actual", "expense_actual", "budget_balance", "cash_current", "population_mid_year"]), "Municipal directory-history columns mismatch");
assert(municipalDirectoryHistory.rows.length === municipalHistoryIndex.annual_record_count, "Municipal directory-history row count mismatch");
const directoryHistoryRows = new Map();
for (const row of municipalDirectoryHistory.rows) {
  const [ico, year, revenue, expense, balance, cash, population] = row;
  assert(municipalityById.has(ico) && year >= 2010 && year <= 2025, `Municipal directory-history identity/year mismatch for ${ico}/${year}`);
  assert(close(revenue - expense, balance), `Municipal directory-history balance mismatch for ${ico}/${year}`);
  const key = `${ico}/${year}`;
  assert(!directoryHistoryRows.has(key), `Duplicate municipal directory-history row for ${key}`);
  assert(population === null || (Number.isInteger(population) && population >= 0), `Municipal population is invalid for ${ico}/${year}`);
  directoryHistoryRows.set(key, { revenue_actual: revenue, expense_actual: expense, budget_balance: balance, cash_current: cash, population_mid_year: population });
}
let municipalHistoryRows = 0;
let completeMunicipalHistories = 0;
const municipalHistoryCoverage = new Map(Array.from({ length: 16 }, (_, index) => [2010 + index, { budget: 0, cash: 0, population: 0 }]));
for (const entity of municipalities) {
  const history = await json(`data/municipal-history/${entity.national_id}.json`);
  assert(history.municipality?.national_id === entity.national_id, `Municipal history ID mismatch for ${entity.national_id}`);
  const years = history.series.map((row) => row.year);
  assert(years.length > 0 && years.every((year, index) => year >= 2010 && year <= 2025 && (!index || year > years[index - 1])), `Municipal history years are invalid for ${entity.national_id}`);
  assert(years.includes(2025), `Municipal history is missing 2025 for ${entity.national_id}`);
  municipalHistoryRows += history.series.length;
  if (history.series.length === 16) completeMunicipalHistories += 1;
  for (const row of history.series) {
    assert(close(row.revenue_actual - row.expense_actual, row.budget_balance), `Historical budget balance mismatch for ${entity.national_id}/${row.year}`);
    assert(close(row.tax_revenue + row.nontax_revenue + row.capital_revenue + row.transfer_revenue, row.revenue_actual, 0.051), `Historical revenue components mismatch for ${entity.national_id}/${row.year}`);
    assert(close(row.current_expense + row.capital_expense, row.expense_actual, 0.051), `Historical expenditure components mismatch for ${entity.national_id}/${row.year}`);
    const coverage = municipalHistoryCoverage.get(row.year);
    coverage.budget += 1;
    if (Number.isFinite(row.cash_current) && Number.isFinite(row.cash_previous)) coverage.cash += 1;
    else assert(row.cash_current === null && row.cash_previous === null, `Historical cash availability is ambiguous for ${entity.national_id}/${row.year}`);
    if (Number.isInteger(row.population_mid_year) && row.population_mid_year >= 0) coverage.population += 1;
    else assert(row.population_mid_year === null, `Historical population availability is ambiguous for ${entity.national_id}/${row.year}`);
    assert(row.population_mid_year > 0 ? close(row.expense_actual / row.population_mid_year, row.expense_per_capita, 0.011) : row.expense_per_capita === null, `Historical per-capita expenditure mismatch for ${entity.national_id}/${row.year}`);
    const directoryRow = directoryHistoryRows.get(`${entity.national_id}/${row.year}`);
    assert(directoryRow && ["revenue_actual", "expense_actual", "budget_balance", "cash_current", "population_mid_year"].every((key) => directoryRow[key] === row[key]), `Directory/profile history mismatch for ${entity.national_id}/${row.year}`);
  }
  const latest = history.series.find((row) => row.year === 2025);
  for (const key of ["revenue_approved", "revenue_adjusted", "revenue_actual", "expense_approved", "expense_adjusted", "expense_actual", "tax_revenue", "nontax_revenue", "capital_revenue", "transfer_revenue", "current_expense", "capital_expense", "budget_balance", "cash_current", "cash_previous"]) {
    assert(latest[key] === entity.amounts[key], `Historical 2025 snapshot mismatch for ${entity.national_id}/${key}`);
  }
}
assert(municipalHistoryRows === municipalHistoryIndex.annual_record_count, "Municipal history annual-record count mismatch");
assert(completeMunicipalHistories === municipalHistoryIndex.complete_series_count, "Municipal complete-history count mismatch");
assert(JSON.stringify(municipalHistoryIndex.coverage_by_year) === JSON.stringify([...municipalHistoryCoverage].map(([year, counts]) => ({ year, ...counts }))), "Municipal history annual coverage mismatch");
for (const row of municipalDirectoryHistory.annual) {
  const yearRows = [...directoryHistoryRows.entries()].filter(([key]) => key.endsWith(`/${row.year}`)).map(([, value]) => value);
  assert(yearRows.length === row.entity_count, `Municipal directory annual entity count mismatch for ${row.year}`);
  for (const key of ["revenue_actual", "expense_actual", "budget_balance", "cash_current"]) {
    const total = yearRows.reduce((sum, value) => sum + (Number.isFinite(value[key]) ? value[key] : 0), 0);
    assert(close(total, row[key], 1), `Municipal directory annual ${key} mismatch for ${row.year}`);
  }
  const populationRows = yearRows.filter((value) => Number.isInteger(value.population_mid_year));
  const populationTotal = populationRows.reduce((sum, value) => sum + value.population_mid_year, 0);
  assert(populationRows.length === row.population_entity_count && populationTotal === row.population_total, `Municipal directory annual population mismatch for ${row.year}`);
  assert(close(row.expense_actual / populationTotal, row.expense_per_capita, 0.011), `Municipal directory annual per-capita expenditure mismatch for ${row.year}`);
}

const entityFiles = await filesBelow(path.join(root, "data", "entities"), (file) => /^\d{8}\.json$/.test(path.basename(file)));
const entityById = new Map();
for (const file of entityFiles) {
  const payload = await json(file);
  const entity = payload.entity;
  entityById.set(entity.national_id, entity);
  assert(path.basename(file, ".json") === entity.national_id, `Entity filename/ID mismatch: ${file}`);
}
assert(entityById.size === 6267, `Expected 6,267 entity files, received ${entityById.size}`);

const cashMissing = [];
let mergedHeadlineProfiles = 0;
let mergedBreakdownProfiles = 0;
const anomalies = { revenue_execution_over_200pct: [], cash_yoy_abs_over_1000pct: [], negative_current_expenditure: [] };
for (const entity of municipalities) {
  const stored = entityById.get(entity.national_id);
  const storedSnapshotFields = stored && Object.fromEntries(Object.keys(entity).map((key) => [key, stored[key]]));
  assert(stored && JSON.stringify(storedSnapshotFields) === JSON.stringify(entity), `Snapshot/entity mismatch for ${entity.national_id}`);
  if (stored?.budget_stages) {
    mergedHeadlineProfiles += 1;
    const expectedKeys = { enacted: ["revenue_approved", "expense_approved"], revised: ["revenue_adjusted", "expense_adjusted"], actual: ["revenue_actual", "expense_actual"] };
    assert(stored.budget_stages.length === 3, `Merged budget-stage count mismatch for ${entity.national_id}`);
    for (const stage of stored.budget_stages) {
      const keys = expectedKeys[stage.stage];
      assert(keys && close(stage.revenue_czk, entity.amounts[keys[0]]) && close(stage.expenditure_czk, entity.amounts[keys[1]]), `Merged budget headline mismatch for ${entity.national_id}/${stage.stage}`);
      assert(close(stage.revenue_czk - stage.expenditure_czk, stage.balance_czk), `Merged budget balance mismatch for ${entity.national_id}/${stage.stage}`);
    }
  }
  if (stored?.budget_breakdown) {
    mergedBreakdownProfiles += 1;
    for (const stageName of ["enacted", "revised", "actual"]) {
      const stage = stored.budget_breakdown.stages?.[stageName];
      const headline = stored.budget_stages?.find((item) => item.stage === stageName);
      assert(stage && headline, `Merged budget breakdown is incomplete for ${entity.national_id}/${stageName}`);
      if (stage && headline) {
        assert(close(stage.purpose_expenditure_total_czk, headline.expenditure_czk) && close(stage.economic_expenditure_total_czk, headline.expenditure_czk), `Purpose/economic expenditure mismatch for ${entity.national_id}/${stageName}`);
        assert(close(stage.economic_revenue_total_czk, headline.revenue_czk) && close(stage.economic_financing_total_czk, headline.financing_czk), `Revenue/financing breakdown mismatch for ${entity.national_id}/${stageName}`);
      }
    }
  }
  const amounts = entity.amounts;
  assert(close(amounts.revenue_actual - amounts.expense_actual, amounts.budget_balance), `Budget balance mismatch for ${entity.national_id}`);
  assert(close(amounts.tax_revenue + amounts.nontax_revenue + amounts.capital_revenue + amounts.transfer_revenue, amounts.revenue_actual, 0.051), `Revenue components mismatch for ${entity.national_id}`);
  assert(close(amounts.current_expense + amounts.capital_expense, amounts.expense_actual, 0.051), `Expenditure components mismatch for ${entity.national_id}`);
  assert(entity.territory.region_name, `Missing region for ${entity.national_id}`);
  assert(entity.territory.municipality_code, `Missing municipality code for ${entity.national_id}`);
  const missing = entity.quality?.flags?.includes("cash_balance_sheet_rows_missing");
  if (missing) {
    cashMissing.push({ national_id: entity.national_id, name: entity.name });
    assert(amounts.cash_current === null && amounts.cash_previous === null, `Missing cash must be null for ${entity.national_id}`);
    assert(entity.ratios.cash_to_expense === null && entity.ratios.cash_yoy === null, `Missing cash ratios must be null for ${entity.national_id}`);
  } else {
    assert(Number.isFinite(amounts.cash_current) && Number.isFinite(amounts.cash_previous), `Cash availability is not explicit for ${entity.national_id}`);
  }
  if (entity.ratios.revenue_execution > 2) anomalies.revenue_execution_over_200pct.push({ national_id: entity.national_id, name: entity.name, ratio: entity.ratios.revenue_execution });
  if (Number.isFinite(entity.ratios.cash_yoy) && Math.abs(entity.ratios.cash_yoy) > 10) anomalies.cash_yoy_abs_over_1000pct.push({ national_id: entity.national_id, name: entity.name, ratio: entity.ratios.cash_yoy });
  if (amounts.current_expense < 0) anomalies.negative_current_expenditure.push({ national_id: entity.national_id, name: entity.name, amount_czk: amounts.current_expense });
}
assert(cashMissing.length === 7, `Expected seven explicitly missing municipal cash records, received ${cashMissing.length}`);
assert([0, municipalities.length].includes(mergedHeadlineProfiles), `BigQuery headlines are only present for ${mergedHeadlineProfiles} municipal profiles`);
assert([0, municipalities.length].includes(mergedBreakdownProfiles), `BigQuery breakdowns are only present for ${mergedBreakdownProfiles} municipal profiles`);

const capitals = await json("data/eu-capital-budgets.v1.json");
assert(capitals.cities.length === 28, "Expected 28 European capital records");
for (const city of capitals.cities) {
  const budget = city.budget;
  assert(close(budget.local_amount / budget.eur_conversion_rate, budget.eur_amount, Math.max(1, Math.abs(budget.eur_amount) * 1e-8)), `FX conversion mismatch for ${city.city_id}`);
}

const sovereign = await json("lib/data/sovereign-benchmark.v1.json");
assert(sovereign.series.length === 10, "Expected ten sovereign series");
for (const country of sovereign.series) {
  const metrics = country.metrics;
  for (const key of ["revenue_pct_gdp", "expenditure_pct_gdp", "balance_pct_gdp"]) {
    const years = metrics[key].values.map((point) => point.year);
    assert(JSON.stringify(years) === JSON.stringify(Array.from({ length: 20 }, (_, index) => 2005 + index)), `${country.country_code}/${key} year coverage mismatch`);
  }
  const values = (key) => new Map(metrics[key].values.map((point) => [point.year, point.value]));
  const revenue = values("revenue_pct_gdp"), expenditure = values("expenditure_pct_gdp"), balance = values("balance_pct_gdp");
  for (const year of revenue.keys()) assert(Math.abs((revenue.get(year) - expenditure.get(year)) - balance.get(year)) <= 0.25, `${country.country_code}/${year} fiscal identity mismatch`);
}

const comparison = await json("data/country-spending-comparison.v1.json");
for (const country of comparison.countries) {
  for (const period of ["previous", "current"]) {
    const grouped = country.groups.reduce((sum, group) => sum + group.amounts[period], 0);
    assert(close(grouped, country.totals[period], 0.011), `${country.code}/${period} spending groups do not reconcile`);
  }
}

const publicEntities = await json("data/cz-public-entities-2024.json");
assert(publicEntities.entities.length === publicEntities.summary.entity_count, "Public-entity summary count mismatch");
assert(new Set(publicEntities.entities.map((item) => item.ico)).size === publicEntities.entities.length, "Duplicate public-entity ICOs");
const publicFinancial = publicEntities.entities.filter((item) => Number.isFinite(item.revenue_mczk) && Number.isFinite(item.net_result_mczk));
assert(publicFinancial.length === publicEntities.summary.financial_result_count, "Public-entity financial coverage count mismatch");
assert(close(publicFinancial.reduce((sum, item) => sum + item.revenue_mczk, 0), publicEntities.summary.revenue_sum_mczk, 0.011), "Public-entity revenue summary mismatch");
assert(close(publicFinancial.reduce((sum, item) => sum + item.net_result_mczk, 0), publicEntities.summary.net_result_sum_mczk, 0.011), "Public-entity result summary mismatch");
warnings.push(`${publicEntities.entities.length - publicFinancial.length} of ${publicEntities.entities.length} public entities have no comparable 2024 financial statement; values remain null, not zero.`);

const publicEntityCoverage = await json("data/public-entity-coverage.v1.json");
const publicEntityAggregates = await json("data/public-entity-aggregates.v1.json");
const publicEntityDirectory = await json("data/public-entity-directory/manifest.v1.json");
const expectedPublicEntityCounts = {CZE:18238,POL:406,DEU:124,GBR:2267,FRA:87,USA:96984,CHE:22,SWE:38,DNK:24,UKR:3009};
assert(publicEntityCoverage.contract === "public-entity-coverage.v1", "Unexpected public-entity coverage contract");
assert(publicEntityAggregates.contract === "public-entity-aggregates.v1" && publicEntityAggregates.observations.length === 355, "Unexpected public-entity aggregate contract");
assert(publicEntityDirectory.contract === "public-entity-directory-manifest.v1" && publicEntityDirectory.total_record_count === 121199, "Unexpected public-entity directory total");
for (const [code, expected] of Object.entries(expectedPublicEntityCounts)) {
  const country = publicEntityDirectory.countries.find((item) => item.country_code === code);
  const coverage = publicEntityCoverage.countries[code];
  assert(country?.record_count === expected && coverage?.registry_record_count === expected, `${code}: public-entity registry count mismatch`);
  const shard = await json(`data/public-entity-directory/${code}.v1.json`);
  assert(shard.country_code === code && shard.records.length === expected && shard.fields.length === 27, `${code}: invalid browser directory shard`);
  const idIndex = shard.fields.indexOf("record_id"), nameIndex = shard.fields.indexOf("name");
  assert(new Set(shard.records.map((row) => row[idIndex])).size === expected, `${code}: duplicate source-scoped record IDs`);
  assert(shard.records.every((row) => row.length === shard.fields.length && row[nameIndex] && !/^\d+$/.test(row[nameIndex])), `${code}: malformed, unnamed or numeric-heading registry row`);
  for (const field of shard.dictionary_fields) {
    const index = shard.fields.indexOf(field), dictionary = shard.dictionaries[field];
    assert(index >= 0 && Array.isArray(dictionary) && shard.records.every((row) => Number.isInteger(row[index]) && row[index] >= 0 && row[index] < dictionary.length), `${code}/${field}: invalid dictionary reference`);
  }
}
assert(publicEntityCoverage.countries.POL.broad_entity_count === 112145, "Polish broad public-sector count mismatch");
assert(publicEntityCoverage.countries.DEU.broad_entity_count === 20658, "German all-level public-enterprise count mismatch");
assert(publicEntityCoverage.countries.CHE.broad_entity_count === 5152, "Swiss all-level public-sector count mismatch");
assert(publicEntityCoverage.countries.SWE.broad_entity_count === 3204, "Swedish all-level public-enterprise count mismatch");
warnings.push("Cross-country public-entity counts remain perimeter-sensitive and are not an efficiency ranking.");

const enterprises = await json("data/cz-state-enterprises-2024.json");
assert(enterprises.entities.length === enterprises.summary.entity_count, "State-enterprise summary count mismatch");
assert(new Set(enterprises.entities.map((item) => item.ico)).size === enterprises.entities.length, "Duplicate state-enterprise ICOs");
const metricSum = (key) => enterprises.entities.reduce((sum, item) => sum + item.metrics[key], 0);
assert(metricSum("net_result") === enterprises.summary.net_result_ranked_entities_sum, "State-enterprise result summary mismatch");
assert(metricSum("turnover") === enterprises.summary.turnover_ranked_entities_sum, "State-enterprise turnover summary mismatch");
assert(metricSum("total_assets") === enterprises.summary.assets_ranked_entities_sum, "State-enterprise asset summary mismatch");
assert(enterprises.budget_transfers.reduce((sum, item) => sum + item.value, 0) === enterprises.summary.budget_transfers_total, "State-enterprise transfers summary mismatch");

const czechBudget = await json("data/czech-budget.v1.json");
assert(czechBudget.rows.length === 26 && czechBudget.rows.every((row, index) => row.length === czechBudget.columns.length && row[0] === 2001 + index), "Czech budget annual series coverage mismatch");

const spending = await json("data/cz-spending-2026.v1.json");
assert(spending.chapters.length === 47 && new Set(spending.chapters.map((item) => item.code)).size === 47, "Expected 47 unique Czech budget chapters");
assert(spending.chapters.reduce((sum, item) => sum + item.amount_2026_czk, 0) === spending.chapter_total_excluding_eu_fm_czk, "Czech chapter expenditure total mismatch");
assert(close(spending.functional.reduce((sum, item) => sum + item.amount_czk_bn, 0), spending.total_expenditure_including_eu_fm_czk / 1e9, 0.11), "Czech functional expenditure total mismatch");
const groupIds = new Set(spending.functional_groups.map((item) => item.id));
assert(spending.functional.every((item) => groupIds.has(item.group)), "Czech functional item references an unknown group");

const demography = await json("data/demography-social.v1.json");
assert(JSON.stringify(demography.years) === JSON.stringify([2025, 2030, 2035, 2040, 2045]), "Demographic projection year coverage mismatch");
for (const [variant, rows] of Object.entries(demography.variants)) {
  assert(rows.length === demography.years.length, `${variant} demographic variant length mismatch`);
  for (const [index, row] of rows.entries()) {
    assert(row.length === demography.columns.length && row[0] === demography.years[index], `${variant}/${demography.years[index]} demographic row mismatch`);
    assert(row[4] + row[3] === row[5], `${variant}/${row[0]} age 65+ identity mismatch`);
    assert(row[5] >= row[6] && row[6] >= row[7] && row[7] >= row[8], `${variant}/${row[0]} pension-age cohorts are not nested`);
  }
}

const health = await json("data/cz-health-budget.v1.json");
const componentTotal = (items) => items.reduce((sum, item) => sum + item.value_bn, 0);
assert(close(componentTotal(health.system_2023.sources), health.system_2023.total_bn, 0.001), "Health-system source total mismatch");
assert(close(componentTotal(health.system_2023.destinations), health.system_2023.total_bn, 0.001), "Health-system destination total mismatch");

const knownDead = [
  "dublincity.ie/council/council-spending-revenue/budgets",
  "madrid.es/portales/munimadrid/es/Informacion-financiera/",
  "statskontoret.se/english/outcome-of-the-central-government-budget/",
  "whitehouse.gov/wp-content/uploads/2024/03/ap_17_coverage_fy2025.pdf",
  "Prijmy_a_vydaje_na_socialni_zabezpeceni_12_2025",
];
for (const file of productionJson) {
  const content = await readFile(file, "utf8");
  for (const dead of knownDead) assert(!content.includes(dead), `Known-dead source remains in ${path.relative(root, file)}: ${dead}`);
}

const nginx = await readFile("nginx.conf.template", "utf8");
for (const header of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"]) {
  assert(nginx.includes(`add_header ${header}`), `Nginx is missing ${header}`);
}
assert(nginx.includes("return 308 https://publicspendingdata.org$request_uri;"), "Nginx must redirect www to the canonical apex domain");
const dockerfile = await readFile("Dockerfile", "utf8");
assert(/^FROM\s+\S+@sha256:[a-f0-9]{64}$/m.test(dockerfile), "Docker base image is not pinned by digest");
const cloudbuild = await readFile("cloudbuild.yaml", "utf8");
for (const match of cloudbuild.matchAll(/^\s+name:\s+(\S+)/gm)) assert(match[1].includes("@sha256:"), `Cloud Build image is not pinned by digest: ${match[1]}`);
assert(cloudbuild.includes("scripts/deploy-immutable.sh"), "Cloud Build does not deploy the pushed image by immutable digest");

let htmlCount = 0;
let localReferenceCount = 0;
if (!dataOnly) {
  const htmlFiles = await filesBelow(root, (file) => file.endsWith(".html"));
  htmlCount = htmlFiles.length;
  for (const file of htmlFiles) {
    const content = await readFile(file, "utf8");
    const relative = path.relative(root, file);
    const ids = [...content.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert(new Set(ids).size === ids.length, `Duplicate HTML IDs in ${relative}`);
    const canonical = content.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
    assert(Boolean(canonical), `Missing canonical URL in ${relative}`);
    if (canonical) assert(canonical.startsWith("https://publicspendingdata.org"), `Non-canonical host in ${relative}`);
    for (const match of content.matchAll(/<(?:a|link|script|img)\b[^>]*(?:href|src)=["']([^"']+)["']/gi)) {
      const reference = match[1];
      if (!reference || /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/.test(reference)) continue;
      localReferenceCount += 1;
      const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
      if (!clean) continue;
      const target = clean.startsWith("/")
        ? path.resolve(root, clean.slice(1))
        : path.resolve(path.dirname(file), clean);
      const candidates = [target, `${target}.html`, path.join(target, "index.html")];
      let exists = false;
      for (const candidate of candidates) { try { if ((await stat(candidate)).isFile()) { exists = true; break; } } catch {} }
      assert(exists, `Broken local reference ${relative} -> ${reference}`);
    }
    for (const script of content.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(script[1]); } catch (error) { failures.push(`Invalid JSON-LD in ${relative}: ${error.message}`); }
    }
  }

  const sitemap = await readFile("sitemap.xml", "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const municipalityCountryPaths = ["/municipalities/czechia/", "/municipalities/poland/", "/municipalities/denmark/", "/municipalities/france/", "/municipalities/sweden/", "/municipalities/england/", "/municipalities/ukraine/", "/municipalities/norway/", "/municipalities/netherlands/", "/municipalities/finland/"];
  const expectedSitemapUrls = municipalities.length + 14 + 9 + 6 + 5 + benchmarkMunicipalities.length + 3;
  assert(locations.length === expectedSitemapUrls, `Expected ${expectedSitemapUrls.toLocaleString("en-US")} sitemap URLs, received ${locations.length}`);
  assert(new Set(locations).size === locations.length, "Duplicate sitemap URLs");
  for (const publicPath of ["/", "/cesko.html", "/cesky-rozpocet.html", "/eu-capitals.html", "/municipalities/", ...municipalityCountryPaths, "/deep-dives/", "/deep-dives/transportation/", "/deep-dives/health/", "/deep-dives/state-owned-enterprises/", "/deep-dives/capital-cities/", "/cz/municipalities/", "/cz/mesta/", "/cz/kraje/"]) {
    assert(locations.includes(`https://publicspendingdata.org${publicPath}`), `Sitemap missing ${publicPath}`);
  }
  for (const entity of municipalities) assert(locations.some((url) => url.endsWith(entity.seo.path)), `Sitemap missing ${entity.seo.path}`);
  for (const entity of benchmarkMunicipalities) assert(locations.some((url) => url.endsWith(entity.url)), `Sitemap missing ${entity.url}`);
}

const report = {
  schema_version: "1.0.0",
  dataset: "CZ Budget public release",
  status: failures.length ? "failed" : "passed",
  counts: {
    production_json_files: productionJson.length,
    html_files: htmlCount,
    local_references: localReferenceCount,
    municipalities: municipalities.length,
    municipal_history_files: municipalHistoryFiles.length,
    municipal_history_records: municipalHistoryRows,
    complete_municipal_histories: completeMunicipalHistories,
    public_entities: entityById.size,
    european_capitals: capitals.cities.length,
    sovereign_countries: sovereign.series.length,
    public_entity_registry: publicEntityDirectory.total_record_count,
    public_entity_financial_statements: publicFinancial.length,
    state_enterprises: enterprises.entities.length,
    state_budget_chapters: spending.chapters.length,
    municipal_profiles_with_bigquery_headlines: mergedHeadlineProfiles,
    municipal_profiles_with_bigquery_breakdowns: mergedBreakdownProfiles,
  },
  explicit_missing_data: { cash_balance_sheet_rows_missing: cashMissing },
  reviewed_anomalies: anomalies,
  failures,
  warnings,
};

if (writeReport) await writeFile("data/data-quality-report.v1.json", `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.slice(0, 100).join("\n"));
  console.error(`Integrity validation failed with ${failures.length} issue(s)`);
  process.exit(1);
}
const fingerprint = createHash("sha256").update(JSON.stringify(report.counts)).digest("hex").slice(0, 16);
console.log(`Integrity validation passed: ${JSON.stringify(report.counts)} fingerprint=${fingerprint}`);
