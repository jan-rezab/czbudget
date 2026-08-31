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

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

console.log(`country  entities   fan-out      identity   ratio`);
for (const row of summary) {
  const ratio = (row.sourceBytes / row.outBytes).toFixed(0);
  console.log(`${row.country}      ${String(row.entities).padStart(6)}   ${mb(row.sourceBytes).padStart(9)}   ${kb(row.outBytes).padStart(8)}   ${ratio}×`);
}
console.log(`\n${totalEntities} entities across ${summary.length} countries`);
console.log(`fan-out:  ${mb(totalSourceBytes)}`);
console.log(`identity: ${mb(totalOutBytes)}  (${(totalSourceBytes / totalOutBytes).toFixed(0)}× smaller)`);
console.log("\nThe difference is the fact table, which the warehouse already holds.");

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
for (const row of summary) {
  await writeFile(path.join(ROOT, OUT_DIR, `${row.country}.v1.json`), row.body, "utf8");
}
console.log(`\nWrote ${summary.length} file(s) to ${OUT_DIR}`);
