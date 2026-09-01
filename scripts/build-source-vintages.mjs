#!/usr/bin/env node
/**
 * Source vintages — the half of B4 that can be measured rather than asked for.
 *
 * A vintage answers "as published when?". Without it a chart can only be checked against
 * whatever the source says today, which is a different number. When the provenance registry
 * was first built, 2 of 81 declared sources named an edition, and the honest thing was to
 * record 79 as unknown rather than invent them.
 *
 * Since then the municipal warehouse has become the place most of those figures live, and it
 * carries the answer already. Every fact names its `source_id` — `br-siconfi-rreo-2025`,
 * `jpn-estat-municipal-settlement-2024`, `dk-statbank-regk100` — and the fiscal years that
 * source covers are in the rows themselves. That is a vintage: the publisher, the series, the
 * edition, and the period it reports on.
 *
 * This reads them out and writes a registry. It states what the warehouse knows and nothing
 * more: a source_id that does not encode an edition is recorded without one rather than given
 * the year its rows happen to cover, because those are different claims.
 *
 *   node scripts/build-source-vintages.mjs --report
 *   node scripts/build-source-vintages.mjs --write
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.env.SITE_ROOT || process.cwd();
const TABLE = "`czbudget-janrezab.budget_detail.municipal_budget_line_facts`";
const OUT = "data/registry/source-vintages.v1.json";
const BQ_ENV = {
  ...process.env,
  CLOUDSDK_ACTIVE_CONFIG_NAME: process.env.CZBUDGET_GCLOUD_CONFIG || "czbudget",
};

const write = process.argv.includes("--write");

/**
 * A source_id is `<country>-<publisher>-<series>-<edition>`, and the edition is a year or a
 * year-and-period where the publisher versions its release that way. Reading it out of the
 * identifier is a statement about what the loader was told; the fiscal years the rows cover
 * are a different fact and are recorded separately.
 */
function editionOf(sourceId) {
  // A month or quarter suffix is part of the edition, not decoration: cz-monitor-finm-2025-12
  // is the December 2025 release, and recording it as "2025" throws away the distinction a
  // vintage exists to make.
  const match = sourceId.match(/-((?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2])|q[1-4]|p\d+)?)(?:-|$)/i);
  return match ? match[1] : null;
}

function publisherOf(sourceId) {
  const parts = sourceId.split("-");
  return parts.length > 1 ? parts[1] : null;
}

const { stdout } = await run("bq", [
  "query", "--use_legacy_sql=false", "--format=json", "--max_rows=1000",
  `SELECT source_id, SPLIT(public_entity_id,":")[OFFSET(0)] country,`
  + ` MIN(fiscal_year) first_year, MAX(fiscal_year) last_year,`
  + ` COUNT(*) facts, COUNT(DISTINCT public_entity_id) entities,`
  + ` FORMAT_TIMESTAMP("%Y-%m-%d", MAX(loaded_at)) loaded`
  + ` FROM ${TABLE} WHERE fiscal_year BETWEEN 2000 AND 2030 GROUP BY 1,2 ORDER BY 1,2`,
], { maxBuffer: 64 * 1024 * 1024, env: BQ_ENV });

const rows = JSON.parse(stdout || "[]").map((row) => ({
  source_id: row.source_id,
  country: row.country,
  publisher: publisherOf(row.source_id),
  edition: editionOf(row.source_id),
  covers: Number(row.first_year) === Number(row.last_year)
    ? String(row.first_year)
    : `${row.first_year}–${row.last_year}`,
  facts: Number(row.facts),
  entities: Number(row.entities),
  loaded: row.loaded,
}));

const withEdition = rows.filter((row) => row.edition).length;
const countries = new Set(rows.map((row) => row.country)).size;

console.log(`${rows.length} loaded source editions across ${countries} countries`);
console.log(`  naming an edition in the source id: ${withEdition}`);
console.log(`  not naming one:                     ${rows.length - withEdition}`);

// What the provenance registry knew before this, for comparison rather than for replacement.
try {
  const provenance = JSON.parse(await readFile(path.join(ROOT, "data/registry/source-provenance.v1.json"), "utf8"));
  console.log(`\nthe declared-source registry names an edition for ${provenance.coverage?.with_edition} of ${provenance.source_count};`);
  console.log("these are the loaded municipal sources, which is a different and overlapping set.");
} catch { /* the comparison is optional */ }

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, "data", "registry"), { recursive: true });
await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    registry: "source-vintages",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "One row per loaded source edition in the municipal warehouse. `edition` is what the "
        + "source id names — the publisher's own release, where it versions releases that way — "
        + "and is null where it names none. `covers` is the fiscal years the rows actually hold, "
        + "which is a different claim and is never used to fill in a missing edition. `loaded` is "
        + "when this warehouse last took the data, not when the publisher issued it.",
    source_count: rows.length,
    coverage: { with_edition: withEdition, without_edition: rows.length - withEdition },
    sources: rows,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
