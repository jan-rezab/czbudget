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
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const OUT = "data/registry/source-provenance.v1.json";
const FISCAL_REGISTRY = "pipeline/config/international_fiscal_source_registry.json";

const write = process.argv.includes("--write");

/** A stable key for a source: its URL where there is one, else provider plus title. */
const sourceKey = (source) =>
  source.url || source.source_url || `${source.provider || source.title || source.name || "unnamed"}`;

function readSources(payload, artifact) {
  const found = [];

  // Form one: a single `source` object describing where the whole artifact came from.
  const single = payload?.source;
  if (single && typeof single === "object" && !Array.isArray(single)) {
    found.push({
      key: sourceKey(single),
      provider: single.provider || null,
      title: single.dataset || single.title || null,
      url: single.download_page || single.url || null,
      // The publication edition, not the build date. "World Economic Outlook, April 2026"
      // is a vintage; 2026-08-28 is when we happened to fetch it.
      edition: single.dataset || single.edition || null,
      extracted: (payload.generated_at || "").slice(0, 10) || null,
      artifact,
    });
  }

  // Form two: a `sources` array, which is what most artifacts carry.
  for (const entry of Array.isArray(payload?.sources) ? payload.sources : []) {
    if (!entry || typeof entry !== "object") continue;
    found.push({
      key: sourceKey(entry),
      provider: entry.provider || entry.publisher || null,
      title: entry.title || entry.label || entry.name || null,
      url: entry.url || entry.source_url || null,
      edition: entry.edition || entry.dataset || entry.vintage || null,
      extracted: entry.extracted || entry.retrieved || (payload.generated_at || "").slice(0, 10) || null,
      artifact,
    });
  }
  return found;
}

const artifacts = (await readdir(path.join(ROOT, "data")))
  .filter((name) => name.endsWith(".v1.json") && name !== "manifest.v1.json")
  .sort();

const sources = new Map();

for (const artifact of [...artifacts.map((a) => `data/${a}`), "lib/data/sovereign-benchmark.v1.json"]) {
  let payload;
  try {
    payload = JSON.parse(await readFile(path.join(ROOT, artifact), "utf8"));
  } catch {
    continue;
  }
  for (const entry of readSources(payload, artifact)) {
    const existing = sources.get(entry.key);
    if (!existing) {
      sources.set(entry.key, { ...entry, artifacts: [entry.artifact] });
      continue;
    }
    if (!existing.artifacts.includes(entry.artifact)) existing.artifacts.push(entry.artifact);
    // Keep the most specific answer any artifact gives for each field.
    for (const field of ["provider", "title", "url", "edition", "extracted"]) {
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

const rows = [...sources.values()].map((row) => ({
  ...row,
  artifact_count: (row.artifacts || []).length,
  licence_status: row.licence_status || "unrecorded",
}));

const withEdition = rows.filter((r) => r.edition).length;
const withExtracted = rows.filter((r) => r.extracted).length;
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
await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    registry: "source-provenance",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "One row per source the published artifacts declare. `edition` is the publication "
        + "vintage the source itself names — \"World Economic Outlook, April 2026\" — not the "
        + "date we fetched it. A null edition means no artifact records one, which is a gap to "
        + "close rather than a value to invent.",
    source_count: rows.length,
    coverage: {
      with_edition: withEdition,
      with_extraction_date: withExtracted,
      with_verified_licence: withLicence,
      licence_unverified: unverified,
    },
    sources: rows.sort((a, b) => String(a.key).localeCompare(String(b.key))),
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
