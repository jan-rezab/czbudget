#!/usr/bin/env node
/**
 * The municipal entity directory — the layer that lets the serving fan-out be retired.
 *
 * 28,559 profile files hold two very different things. The `detail` array is the fact table,
 * and every one of those rows is already in the warehouse — 29.4 million of them, queryable
 * by entity and year. What is *only* in these files is the entity's identity: its name, the
 * region it sits in, its population, the currency it reports in and the URL its page lives at.
 * The warehouse knows `CR:SIPP-ABANGARES` owes 4,510,590,000 CRC; it does not know that this
 * is Abangares.
 *
 * That is why the fan-out could not simply be deleted once the facts were loaded, and it is
 * the whole of what this extracts: the identity, without the facts that duplicate the
 * warehouse. Roughly 635 MB of profile files carry perhaps a few megabytes of identity, the
 * same ratio that turned a 580 MB label fan-out into a 76 KB registry.
 *
 *   node scripts/build-municipal-entity-directory.mjs --report
 *   node scripts/build-municipal-entity-directory.mjs --write
 */
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const SOURCE = "data/municipal-expansion";
const OUT_DIR = "data/registry/municipal-entities";

const write = process.argv.includes("--write");

/** Alpha-3 is the canonical country form; the fan-out directories are already alpha-3. */
const ISO3 = (dir) => dir.toUpperCase();

/**
 * Identity fields only. `detail` and `history` are deliberately not carried: detail is the
 * warehouse fact table verbatim, and history is an aggregate of it — copying either forward
 * would rebuild the duplication this is removing.
 */
function identityOf(profile) {
  const entity = {
    code: profile.code,
    name: profile.name,
    url: profile.url,
  };
  if (profile.region) entity.region = profile.region;
  if (Number.isFinite(profile.population)) entity.population = profile.population;
  // Currency and reporting basis are constant per country almost everywhere; they are hoisted
  // to the country header below and only repeated on an entity that disagrees.
  entity._currency = profile.currency || null;
  entity._basis = profile.reporting_basis || null;
  entity._years = Array.isArray(profile.years) ? profile.years : [];
  return entity;
}

const mode = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts) if (count > bestCount) { best = value; bestCount = count; }
  return best;
};

const countries = (await readdir(path.join(ROOT, SOURCE), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let totalEntities = 0;
let totalSourceBytes = 0;
let totalOutBytes = 0;
const summary = [];

for (const dir of countries) {
  const directory = path.join(ROOT, SOURCE, dir);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();

  const entities = [];
  let sourceBytes = 0;
  for (const file of files) {
    const full = path.join(directory, file);
    sourceBytes += (await stat(full)).size;
    let profile;
    try {
      profile = JSON.parse(await readFile(full, "utf8"));
    } catch {
      continue;
    }
    if (!profile || !profile.code) continue;
    entities.push(identityOf(profile));
  }
  if (!entities.length) continue;

  const currency = mode(entities.map((e) => e._currency).filter(Boolean));
  const basis = mode(entities.map((e) => e._basis).filter(Boolean));
  const years = [...new Set(entities.flatMap((e) => e._years))].sort((a, b) => a - b);

  const rows = entities.map((entity) => {
    const row = { code: entity.code, name: entity.name, url: entity.url };
    if (entity.region) row.region = entity.region;
    if (entity.population !== undefined) row.population = entity.population;
    // Only an entity that departs from the country default carries its own value.
    if (entity._currency && entity._currency !== currency) row.currency = entity._currency;
    if (entity._basis && entity._basis !== basis) row.reporting_basis = entity._basis;
    if (entity._years.length && (entity._years.length !== years.length)) row.years = entity._years;
    return row;
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const payload = {
    schema_version: "1.0.0",
    registry: "municipal-entities",
    country_code: ISO3(dir),
    generated_at: new Date().toISOString().slice(0, 10),
    note: "Entity identity only. Budget facts for these entities live in the warehouse and are "
        + "served by /public-data/municipality-lines; nothing here restates an amount.",
    currency_code: currency,
    reporting_basis: basis,
    years,
    entity_count: rows.length,
    entities: rows,
  };

  const body = `${JSON.stringify(payload, null, 2)}\n`;
  totalEntities += rows.length;
  totalSourceBytes += sourceBytes;
  totalOutBytes += Buffer.byteLength(body);
  summary.push({ country: ISO3(dir), entities: rows.length, sourceBytes, outBytes: Buffer.byteLength(body), body });
}

/**
 * A second source of identity. The fan-out covers the fifteen expansion countries; the
 * international directory covers eight more that already have facts in the warehouse but never
 * had a directory built — France, Czechia, Poland, Ukraine, Britain, Sweden, and the United
 * States and Germany whose facts are still thin. Same extraction, different origin: identity
 * only, no amounts, because the amounts are in the warehouse.
 */
async function fromInternationalDirectory(alreadyCovered) {
  const file = path.join(ROOT, "data/international-municipalities.v1.json");
  let payload;
  try {
    payload = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const byCountry = new Map();
  for (const entity of payload.entities || []) {
    const code = String(entity.country || "").toUpperCase();
    if (!code || alreadyCovered.has(code)) continue;
    if (!byCountry.has(code)) byCountry.set(code, []);
    byCountry.get(code).push(entity);
  }

  const built = [];
  for (const [country, entities] of [...byCountry].sort()) {
    const currency = mode(entities.map((e) => e.currency).filter(Boolean));
    const years = [...new Set(entities.flatMap((e) => e.years || []))].sort((a, b) => a - b);
    const rows = entities.map((entity) => {
      const row = { code: String(entity.code), name: entity.name };
      if (entity.url) row.url = entity.url;
      if (entity.region) row.region = entity.region;
      if (Number.isFinite(entity.population)) row.population = entity.population;
      if (entity.currency && entity.currency !== currency) row.currency = entity.currency;
      return row;
    }).sort((a, b) => String(a.code).localeCompare(String(b.code)));

    const body = `${JSON.stringify({
      schema_version: "1.0.0",
      registry: "municipal-entities",
      country_code: country,
      generated_at: new Date().toISOString().slice(0, 10),
      note: "Entity identity only, extracted from data/international-municipalities.v1.json. "
          + "Budget facts for these entities live in the warehouse; nothing here restates an amount.",
      currency_code: currency,
      reporting_basis: null,
      years,
      entity_count: rows.length,
      entities: rows,
    }, null, 2)}\n`;
    built.push({ country, entities: rows.length, sourceBytes: 0, outBytes: Buffer.byteLength(body), body });
  }
  return built;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

const extra = await fromInternationalDirectory(new Set(summary.map((row) => row.country)));
for (const row of extra) {
  totalEntities += row.entities;
  totalOutBytes += row.outBytes;
  summary.push(row);
}
if (extra.length) {
  console.log(`\nfrom the international directory (${extra.length} countries with warehouse facts but no directory):`);
  for (const row of extra) console.log(`  ${row.country}  ${row.entities.toLocaleString().padStart(7)} entities  ${kb(row.outBytes).padStart(8)}`);
  console.log();
}

console.log(`country  entities   fan-out      identity   ratio`);
for (const row of summary) {
  const ratio = (row.sourceBytes / row.outBytes).toFixed(0);
  console.log(`${row.country}      ${String(row.entities).padStart(6)}   ${mb(row.sourceBytes).padStart(9)}   ${kb(row.outBytes).padStart(8)}   ${ratio}×`);
}
const fanoutRows = summary.filter((row) => row.sourceBytes > 0);
const fanoutOut = fanoutRows.reduce((sum, row) => sum + row.outBytes, 0);
console.log(`\n${totalEntities.toLocaleString()} entities across ${summary.length} countries, ${mb(totalOutBytes)} of identity`);
console.log(`  from the fan-out:   ${fanoutRows.length} countries, ${mb(totalSourceBytes)} in, ${mb(fanoutOut)} out (${(totalSourceBytes / fanoutOut).toFixed(0)}x smaller)`);
console.log(`  from the directory: ${summary.length - fanoutRows.length} countries, ${mb(totalOutBytes - fanoutOut)} out`);
console.log("\nWhat the fan-out carried and this does not is the fact table, which the warehouse holds.");

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
for (const row of summary) {
  await writeFile(path.join(ROOT, OUT_DIR, `${row.country}.v1.json`), row.body, "utf8");
}
console.log(`\nWrote ${summary.length} file(s) to ${OUT_DIR}`);
