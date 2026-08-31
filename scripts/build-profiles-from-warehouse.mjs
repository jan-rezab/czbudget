#!/usr/bin/env node
/**
 * Municipality profiles, built from the warehouse.
 *
 * This is what the 580 MB fan-out was standing in for. Each profile is assembled from three
 * things that already exist: the facts in BigQuery, the entity directory that knows a code's
 * name and page, and the headline rules that say which of those facts a municipality leads
 * with. Nothing here is a new copy of a number.
 *
 * It emits to a directory of its own rather than over the fan-out. The two disagree by design
 * — the files predate the budget_side repair and use a stage vocabulary the warehouse
 * replaced — so a diff between them is the point, not a failure. `--verify` checks the part
 * that must not move: the published headline.
 *
 *   node scripts/build-profiles-from-warehouse.mjs --country CRI --verify
 *   node scripts/build-profiles-from-warehouse.mjs --country CRI --out .warehouse-profiles
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.env.SITE_ROOT || process.cwd();
const TABLE = "`czbudget-janrezab.budget_detail.municipal_budget_line_facts`";

// Another session on this machine switches the active gcloud account, and `bq` picks up
// whichever is current at the moment it runs — so the same query succeeds or fails by timing.
// The account is pinned per invocation rather than by changing the shared config, which would
// break that other session in exactly the way this is guarding against.
const BQ_ENV = { ...process.env, CLOUDSDK_CORE_ACCOUNT: process.env.BQ_ACCOUNT || "jan@ravineo.com" };


const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const country = String(flag("--country", "CRI")).toUpperCase();
const allReady = args.includes("--all-ready");
const outDir = flag("--out", null);
const verify = args.includes("--verify");

const ALPHA2 = {
  BOL: "BO", BRA: "BR", CHL: "CL", COL: "CO", CRI: "CR", DNK: "DK", ESP: "ES",
  GEO: "GE", GTM: "GT", ITA: "IT", JPN: "JP", KOR: "KR", MEX: "MX", PER: "PE", SLV: "SV",
  // Countries loaded by their own national pipelines, now given directories and rules.
  CHE: "CH", CZE: "CZ", DEU: "DE", FIN: "FI", FRA: "FR", GBR: "GB", NLD: "NL",
  NOR: "NO", POL: "PL", PRY: "PY", SWE: "SE", UKR: "UA", USA: "US",
};

// `--all-ready` re-runs this script once per country whose rules reproduce every published
// headline. Countries that do not are left on the fan-out rather than half-built, and the
// snapshot builder makes the same judgement from the same file.
if (allReady) {
  const readJSONFile = async (file) => JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
  const config = await readJSONFile("pipeline/config/municipal_headline_rules.json");
  const ready = config.countries
    .filter((entry) => (entry.revenue?.match_rate === 1 && entry.expenditure?.match_rate === 1)
      || (entry.authored === true && entry.authored_basis))
    .map((entry) => entry.country_code);
  console.log(`${ready.length} countries reproduce every published headline: ${ready.join(", ")}\n`);
  for (const each of ready) {
    console.log(`--- ${each} ---`);
    await run(process.execPath, [
      new URL(import.meta.url).pathname, "--country", each,
      ...(outDir ? ["--out", outDir] : []), ...(verify ? ["--verify"] : []),
    ], { maxBuffer: 256 * 1024 * 1024 }).then(
      ({ stdout }) => process.stdout.write(stdout),
      (error) => process.stdout.write(`${error.stdout || ""}${error.stderr || ""}`),
    );
  }
  process.exit(0);
}

const alpha2 = ALPHA2[country];
if (!alpha2) {
  console.error(`No alpha-2 mapping for ${country}.`);
  process.exit(1);
}

const readJSON = async (file) => JSON.parse(await readFile(path.join(ROOT, file), "utf8"));

// `bq --format=json` returns every column as a string, booleans included. Comparing one
// against `true` is quietly always false, which silently disables any filter built on it.
const isTrue = (value) => value === true || value === "true";

const directory = await readJSON(`data/registry/municipal-entities/${country}.v1.json`);
const rules = await readJSON("pipeline/config/municipal_headline_rules.json");
const labelRegistry = await readJSON("data/registry/municipal-item-labels.v1.json");
const labels = labelRegistry.countries[country] || {};

const rule = rules.countries.find((entry) => entry.country_code === country);
if (!rule || rule.status) {
  console.error(`${country} has no headline rule (${rule?.status || "absent"}). Derive one first.`);
  process.exit(1);
}

console.log(`${country}: ${directory.entity_count} entities, ${Object.keys(labels).length} item labels`);

const facts = JSON.parse((await run("bq", [
  "query", "--use_legacy_sql=false", "--format=json", "--max_rows=5000000",
  `SELECT public_entity_id, fiscal_year, fiscal_period, budget_stage, budget_side,`
  + ` economic_item_code, is_financing, SUM(CAST(amount_local AS FLOAT64)) amount`
  + ` FROM ${TABLE} WHERE fiscal_year BETWEEN 2000 AND 2030 AND NOT is_consolidation_item`
  + ` AND STARTS_WITH(public_entity_id, "${alpha2}:")`
  + ` GROUP BY 1,2,3,4,5,6,7`,
], { maxBuffer: 2 * 1024 * 1024 * 1024, env: BQ_ENV })).stdout || "[]");

console.log(`warehouse: ${facts.length.toLocaleString()} fact rows`);

/** Facts grouped by entity, so each profile is assembled from one bucket. */
const byEntity = new Map();
for (const fact of facts) {
  const code = fact.public_entity_id.split(":").slice(1).join(":");
  if (!byEntity.has(code)) byEntity.set(code, []);
  byEntity.get(code).push(fact);
}

/**
 * Apply one year's headline rule. A rule names a stage, a period and either a single item
 * code, one depth of a nested numeric code, or the sum of every row — and it may be net of a
 * second stage, which is how Brazil's "despesas liquidadas" excludes restos a pagar.
 */
function headline(rows, spec, side) {
  if (!spec || spec.status) return null;
  // Filtering by side is not optional: several sources use one code for both, so Costa Rica's
  // `TOTAL` row exists once as revenue and once as expenditure and an unfiltered sum reports
  // each of them as the sum of the two.
  const matches = (fact, stage) => fact.budget_side === side
    && fact.budget_stage === stage
    // Interest, loan repayments and borrowing fund a budget rather than being it. Denmark's
    // account plan balances by construction, so leaving them in makes every municipality
    // report revenue exactly equal to expenditure and a result of zero.
    && (!spec.exclude_financing || !isTrue(fact.is_financing))
    && fact.fiscal_period === spec.fiscal_period
    && (spec.code ? fact.economic_item_code === spec.code
      : spec.code_length ? /^\d{1,6}$/.test(fact.economic_item_code) && fact.economic_item_code.length === spec.code_length
        : true);

  const total = (stage) => rows
    .filter((fact) => matches(fact, stage))
    .reduce((sum, fact) => sum + Number(fact.amount), 0);

  const present = rows.some((fact) => matches(fact, spec.stage));
  if (!present) return null;
  // An absent subtrahend is zero: an entity that carries nothing forward still follows the
  // same rule as one that does.
  return total(spec.stage) - (spec.net_of_stage ? total(spec.net_of_stage) : 0);
}

const profiles = [];
let withHeadline = 0;

for (const entity of directory.entities) {
  const rows = byEntity.get(entity.code) || [];
  const years = [...new Set(rows.map((fact) => Number(fact.fiscal_year)))].sort((a, b) => a - b);

  const history = years.map((year) => {
    const yearRows = rows.filter((fact) => Number(fact.fiscal_year) === year);
    // An authored rule states one shape for the country rather than one per year, because
    // there is no published series whose years it has to match. Derived rules stay per-year.
    const spec = rule.years[String(year)] || rule.default_year_rule || {};
    let revenue = headline(yearRows, spec.revenue, "revenue");
    let expenditure = headline(yearRows, spec.expenditure, "expenditure");
    // A source that books revenue as a credit hands back a negative total. The sign is kept
    // in the facts, because that is what the filing says, and resolved here where a reader
    // is being shown a headline rather than a ledger entry.
    if (spec.revenue?.sign === "credit" && revenue !== null) revenue = Math.abs(revenue);
    if (spec.expenditure?.sign === "credit" && expenditure !== null) expenditure = Math.abs(expenditure);
    const entry = { year };
    if (revenue !== null) entry.revenue = Number(revenue.toFixed(2));
    if (expenditure !== null) entry.expenditure = Number(expenditure.toFixed(2));
    if (revenue !== null && expenditure !== null) entry.balance = Number((revenue - expenditure).toFixed(2));
    return entry;
  });
  if (history.some((entry) => entry.revenue !== undefined)) withHeadline += 1;

  const detail = rows.map((fact) => ({
    year: Number(fact.fiscal_year),
    stage: fact.budget_stage,
    side: fact.budget_side,
    code: fact.economic_item_code,
    // The source's own account name, from the label registry. Not translated: a translated
    // label would not appear in the original filing, so it could not be checked against it.
    name: labels[fact.economic_item_code] || fact.economic_item_code,
    amount: Number(fact.amount),
    ...(isTrue(fact.is_financing) ? { financing: true } : {}),
  })).sort((a, b) => a.year - b.year || a.side.localeCompare(b.side) || a.code.localeCompare(b.code));

  profiles.push({
    code: entity.code,
    name: entity.name,
    region: entity.region ?? null,
    ...(entity.population !== undefined ? { population: entity.population } : {}),
    country,
    currency: entity.currency || directory.currency_code,
    ...(directory.reporting_basis ? { reporting_basis: entity.reporting_basis || directory.reporting_basis } : {}),
    years,
    history,
    detail,
    url: entity.url,
  });
}

console.log(`built ${profiles.length} profiles, ${withHeadline} with a headline`);

if (verify) {
  let checked = 0;
  let agreed = 0;
  const drift = [];
  for (const profile of profiles) {
    let published;
    try {
      published = JSON.parse(await readFile(path.join(ROOT, "data/municipal-expansion", country.toLowerCase(), `${profile.code}.json`), "utf8"));
    } catch {
      continue;
    }
    for (const entry of published.history || []) {
      for (const side of ["revenue", "expenditure"]) {
        if (!Number.isFinite(entry[side])) continue;
        checked += 1;
        const built = profile.history.find((row) => row.year === entry.year)?.[side];
        if (built !== undefined && Math.abs(built - entry[side]) <= Math.max(0.01, Math.abs(entry[side]) * 1e-9)) agreed += 1;
        else if (drift.length < 5) drift.push(`${profile.code} ${entry.year} ${side}: published ${entry[side]}, built ${built ?? "none"}`);
      }
    }
  }
  console.log(`\nheadline check: ${agreed}/${checked} agree with what the site publishes today`);
  for (const line of drift) console.log(`  ${line}`);
  // Detail is expected to differ: the fan-out predates the budget_side repair and uses a
  // stage vocabulary the warehouse replaced. Only the headline must hold.
  if (agreed !== checked) process.exitCode = 1;
}

if (outDir) {
  const target = path.join(ROOT, outDir, country.toLowerCase());
  await mkdir(target, { recursive: true });
  for (const profile of profiles) {
    await writeFile(path.join(target, `${profile.code}.json`), `${JSON.stringify(profile)}\n`, "utf8");
  }
  console.log(`\nWrote ${profiles.length} profiles to ${outDir}/${country.toLowerCase()}`);
}
