#!/usr/bin/env node
/**
 * The source provenance registry — B4.
 *
 * A chart is citable when a reader can answer three questions about the number under it:
 * who published it, which edition of their data it came from, and when it was taken. The
 * site answers the first almost everywhere and the second almost nowhere — provenance stops
 * at file level, so "what did the 2023 Czech deficit look like as published in April 2025?"
 * is currently unanswerable.
 *
 * This collects every source the published artifacts declare and records what each one
 * actually states. The point is not to invent the missing fields; it is to make the gap
 * countable, the same way the licence field made an unrecorded licence countable rather than
 * absent. A vintage nobody recorded should read as unrecorded, not as today's date.
 *
 *   node scripts/build-source-provenance.mjs --report
 *   node scripts/build-source-provenance.mjs --write
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { readSources, reconcileSourceDeclarations, mergeSourceDeclaration } from "./lib/source-provenance.mjs";

const ROOT = process.env.SITE_ROOT || process.cwd();
const OUT = "data/registry/source-provenance.v1.json";
const FISCAL_REGISTRY = "pipeline/config/international_fiscal_source_registry.json";

const write = process.argv.includes("--write");

/** A stable key for a source: its URL where there is one, else provider plus title. */
const sourceKey = (source) =>
  source.url || source.source_url || `${source.provider || source.title || source.name || "unnamed"}`;

async function artifactFiles(directory) {
  const result=[];
  for(const entry of await readdir(path.join(ROOT,directory),{withFileTypes:true})) {
    const relative=path.posix.join(directory,entry.name);
    if(relative === "data/registry") continue;
    if(entry.isDirectory()) result.push(...await artifactFiles(relative));
    else if(entry.isFile()&&entry.name.endsWith(".json")) result.push(relative);
  }
  return result.sort();
}
const artifacts=await artifactFiles("data");

const sources = new Map();

for (const artifact of [...artifacts, "lib/data/sovereign-benchmark.v1.json"]) {
  let payload;
  try {
    payload = JSON.parse(await readFile(path.join(ROOT, artifact), "utf8"));
  } catch {
    continue;
  }
  for (const entry of readSources(payload, artifact)) {
    const existing = sources.get(entry.key);
    if (!existing) {
      const created={...entry,artifacts:[entry.artifact],declarations:[]};
      mergeSourceDeclaration(created,entry);sources.set(entry.key,created);
      continue;
    }
    mergeSourceDeclaration(existing,entry);
    if (!existing.artifacts.includes(entry.artifact)) existing.artifacts.push(entry.artifact);
    // Keep the most specific answer any artifact gives for each field.
    for (const field of ["provider", "title", "url", "edition", "extracted", "retrieved_at", "published_at", "reviewed_at"]) {
      if (!existing[field] && entry[field]) existing[field] = entry[field];
    }
  }
}

// The fiscal source registry is the one place licence terms are recorded, so it joins here.
let licensed = 0;
let unverified = 0;
try {
  const registry = JSON.parse(await readFile(path.join(ROOT, FISCAL_REGISTRY), "utf8"));
  for (const country of registry.countries || []) {
    for (const source of country.sources || []) {
      const key = sourceKey(source);
      const licence = source.licence || {};
      if (licence.status === "unverified") unverified += 1;
      else if (licence.status) licensed += 1;
      const existing = sources.get(key);
      const row = existing || { key, artifacts: [], provider: null, title: null, url: source.url || null, edition: null, extracted: null };
      row.provider = row.provider || country.name_en || null;
      row.title = row.title || source.name || null;
      row.licence_status = licence.status || "unrecorded";
      row.licence_spdx = licence.spdx || null;
      row.country = country.country_code;
      sources.set(key, row);
    }
  }
} catch { /* the registry is optional to this report */ }

const rows = [...sources.values()].map(reconcileSourceDeclarations).map((row) => ({
  ...row,
  artifact_count: (row.artifacts || []).length,
  licence_status: row.licence_status || "unrecorded",
}));

const withEdition = rows.filter((r) => r.edition || r.metadata_variants?.edition?.length).length;
const withExtracted = rows.filter((r) => r.extracted || r.metadata_variants?.extracted?.length).length;
const withLicence = rows.filter((r) => r.licence_status && r.licence_status !== "unrecorded" && r.licence_status !== "unverified").length;

console.log(`sources declared across published artifacts: ${rows.length}`);
console.log(`  with a publication edition (vintage): ${withEdition}`);
console.log(`  with an extraction date:              ${withExtracted}`);
console.log(`  with verified licence terms:          ${withLicence}`);
console.log(`  licence recorded but unverified:      ${unverified}`);
console.log("\nA vintage answers \"as published when?\". Without it, a chart can be reproduced");
console.log("only against whatever the source says today, which is not the same number.");

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, "data", "registry"), { recursive: true });
const orderedRows=rows.sort((a,b)=>String(a.key).localeCompare(String(b.key)));
const shardDirectory="data/registry/source-provenance";
await mkdir(path.join(ROOT,shardDirectory),{recursive:true});
const shards=[];
for(let start=0;start<orderedRows.length;start+=5000){
  const records=orderedRows.slice(start,start+5000);
  const body=gzipSync(Buffer.from(`${JSON.stringify({schema_version:"1.0.0",records})}\n`),{level:9,mtime:0});
  const name=`sources-${String(start/5000+1).padStart(3,"0")}.json.gz`;
  await writeFile(path.join(ROOT,shardDirectory,name),body);
  shards.push({path:`/${shardDirectory}/${name}`,records:records.length,bytes:body.length,sha256:createHash("sha256").update(body).digest("hex")});
}
await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.1.0",
    registry: "source-provenance",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "One row per source the published artifacts declare. `edition` is the publication "
        + "vintage the source itself names — \"World Economic Outlook, April 2026\" — not the "
        + "date we fetched it. A null edition without metadata_variants.edition means no artifact records one, a gap to "
        + "close rather than a value to invent. For reused URLs, conflicting metadata values "
        + "are retained in metadata_variants and declarations; the corresponding top-level "
        + "field is null rather than a synthesized mixed vintage. Coverage counts any recorded edition/date.",
    source_count: rows.length,
    coverage: {
      with_edition: withEdition,
      with_extraction_date: withExtracted,
      with_verified_licence: withLicence,
      licence_unverified: unverified,
    },
    storage: "gzip-compressed JSON shards; each record retains compacted declaration variants, artifact references and representative locations",
    shards,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
