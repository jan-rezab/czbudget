#!/usr/bin/env node
// Splits data/international-municipalities.v1.json (21 MB, 105k entities, 27 countries)
// into one shard per country plus a small index, so a country hub downloads only its
// own directory instead of every country on earth. The monolith stays authoritative and
// untouched: it remains the published download and the input to the other build steps.
//
//   data/international-municipalities/index.v1.json   country metadata only (~25 kB)
//   data/international-municipalities/<CODE>.v1.json  entities for one country
//   data/municipal-directory-counts.v1.json           precomputed counts for KPI tiles
//
// Shards drop everything derivable from the country: the ISO code, the currency, the
// shared year list, the id prefix and the URL prefix live once in "defaults" and the
// client rehydrates each entity to the exact shape the monolith carried.

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = "data/international-municipalities.v1.json";
const shardDirectory = "data/international-municipalities/";
const countsArtifact = "data/municipal-directory-counts.v1.json";

const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
// Shards follow the monolith and stay compact; the index and the counts file are small
// enough to keep readable in review.
const write = async (path, payload, pretty = false) => { const text = pretty ? `${JSON.stringify(payload, null, 2)}\n` : JSON.stringify(payload); await writeFile(new URL(path, root), text); return Buffer.byteLength(text); };
// The most frequent "/segment/segment/" head of a country's profile URLs. Czech
// municipalities live under /cz/municipalities/, everyone else under /municipalities/<slug>/.
const urlPrefix = (entities) => {
  const counts = new Map();
  for (const entity of entities) { const match = entity.url?.match(/^(\/[^/]+\/[^/]+\/)/); if (match) counts.set(match[1], (counts.get(match[1]) || 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sourceUrlPrefix = (entities) => {
  const first = entities.find((entity) => entity.source_url?.endsWith(String(entity.code)));
  if (!first) return null;
  const prefix = first.source_url.slice(0, -String(first.code).length);
  return entities.every((entity) => !entity.source_url || entity.source_url === `${prefix}${entity.code}`) ? prefix : null;
};

const data = await read(source);
const grouped = new Map(data.countries.map((country) => [country.code, []]));
for (const entity of data.entities) { if (!grouped.has(entity.country)) grouped.set(entity.country, []); grouped.get(entity.country).push(entity); }

await rm(new URL(shardDirectory, root), { recursive: true, force: true });
await mkdir(new URL(shardDirectory, root), { recursive: true });

const meta = new Map(data.countries.map((country) => [country.code, country]));
const index = [], counts = [], report = [];

// Preserve the source file's country order. The nav menu and the municipalities hub both
// render this list, and the browser suite asserts the two agree; re-sorting by ISO code here
// silently reordered one of them.
for (const [code, entities] of grouped) {
  const country = meta.get(code) ?? { code, directory_count: entities.length };
  const prefix = urlPrefix(entities);
  const idPrefix = entities[0]?.id?.includes(":") ? entities[0].id.split(":")[0] : code;
  const sourcePrefix = country.entity_source_url_prefix || sourceUrlPrefix(entities);
  const defaults = { id_prefix: idPrefix, currency: country.currency ?? null, years: country.years ?? [], url_prefix: prefix };
  if (sourcePrefix) defaults.source_url_prefix = sourcePrefix;
  const rows = entities.map((entity) => {
    const row = { code: entity.code, name: entity.name };
    if (entity.region) row.region = entity.region;
    for (const key of ["revenue", "expenditure", "balance", "population"]) if (entity[key] !== null && entity[key] !== undefined) row[key] = entity[key];
    if (entity.source_url && entity.source_url !== `${sourcePrefix}${entity.code}`) row.source_url = entity.source_url;
    if (!same(entity.years, defaults.years)) row.years = entity.years;
    if (entity.currency && entity.currency !== defaults.currency) row.currency = entity.currency;
    if (entity.id && entity.id !== `${idPrefix}:${entity.code}`) row.id = entity.id;
    if (entity.url) { if (prefix && entity.url.startsWith(prefix)) row.slug = entity.url.slice(prefix.length).replace(/\/$/, ""); else row.url = entity.url; }
    return row;
  });
  const entry = { ...country, entity_count: entities.length, shard: `${shardDirectory}${code}.v1.json` };
  const bytes = await write(`${shardDirectory}${code}.v1.json`, { schema_version: data.schema_version, generated_at: data.generated_at, scope: data.scope, source_artifact: source, country: entry, defaults, entities: rows });
  index.push(entry);
  counts.push({ code, name_cs: country.name_cs ?? code, name_en: country.name_en ?? code, status: country.status ?? null, directory_count: Number(country.directory_count) || 0, entity_count: entities.length });
  report.push([code, entities.length, bytes]);
}

const directoryTotal = counts.reduce((sum, row) => sum + row.directory_count, 0);
const entityTotal = counts.reduce((sum, row) => sum + row.entity_count, 0);

const indexBytes = await write(`${shardDirectory}index.v1.json`, {
  schema_version: data.schema_version, generated_at: data.generated_at, scope: data.scope, source_artifact: source, notes: data.notes,
  totals: { country_count: index.length, directory_count: directoryTotal, entity_count: entityTotal, aggregate_row_count: Math.max(0, directoryTotal - entityTotal) },
  countries: index
}, true);
// Consumed by the coverage/methodology KPI tiles, which previously summed four numbers
// out of the whole 21 MB payload.
const countsBytes = await write(countsArtifact, {
  schema_version: data.schema_version, generated_at: data.generated_at, scope: data.scope, source_artifact: source,
  totals: { country_count: counts.length, directory_count: directoryTotal, entity_count: entityTotal, aggregate_row_count: Math.max(0, directoryTotal - entityTotal) },
  countries: counts
}, true);

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
report.sort((a, b) => b[2] - a[2]);
console.log(`source ${source} · ${mb((await readFile(new URL(source, root))).byteLength)} · ${data.countries.length} countries · ${data.entities.length} entities`);
console.log(`index ${shardDirectory}index.v1.json · ${(indexBytes / 1024).toFixed(1)} kB`);
console.log(`counts ${countsArtifact} · ${(countsBytes / 1024).toFixed(1)} kB`);
for (const [code, entities, bytes] of report) console.log(`  ${code} ${String(entities).padStart(6)} entities · ${mb(bytes)}`);
console.log(`shards total ${mb(report.reduce((sum, row) => sum + row[2], 0))}`);
