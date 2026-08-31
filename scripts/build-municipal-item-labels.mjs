#!/usr/bin/env node
/**
 * The label registry for municipal line items.
 *
 * The warehouse holds facts keyed by economic_item_code; it does not hold the human name of
 * each code, because a name is a property of the classification, not of the 29 million rows
 * that reference it. Repeating it per row is exactly what made the per-municipality fan-out
 * 580 MB: the same few hundred labels written into 28,559 files.
 *
 * Extracted once per country, the whole thing is about 73 KB for 1,201 codes — small enough
 * to stay committed, and enough to render every municipal profile from warehouse facts
 * without the fan-out.
 *
 *   node scripts/build-municipal-item-labels.mjs --report
 *   node scripts/build-municipal-item-labels.mjs --write
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const UNIFORM = path.join(path.dirname(ROOT), "outputs", "municipal-expansion");
const OUT = "data/registry/municipal-item-labels.v1.json";

// Denmark and Japan are not served from this layer: Denmark's warehouse rows come from
// StatBank with their own labels, and Japan is not loaded.
const SKIP = new Set(["DNK", "JPN"]);

const write = process.argv.includes("--write");

const files = (await readdir(UNIFORM))
  .filter((name) => name.endsWith(".json") && !name.includes("-shard-"))
  .sort();

const countries = {};
let totalCodes = 0;

for (const file of files) {
  const alpha3 = file.replace(/\.json$/, "");
  if (SKIP.has(alpha3)) continue;

  const payload = JSON.parse(await readFile(path.join(UNIFORM, file), "utf8"));
  const labels = new Map();

  for (const entity of payload.entities || []) {
    for (const row of entity.detail || []) {
      // Mirrors the loader: an item with no code is keyed by its own name.
      const code = String(row.code || "").trim() || String(row.name || "").trim();
      if (!code || labels.has(code)) continue;
      const name = String(row.name || "").trim();
      if (name) labels.set(code, name);
    }
  }

  if (!labels.size) continue;
  countries[alpha3] = Object.fromEntries([...labels].sort(([a], [b]) => a.localeCompare(b)));
  totalCodes += labels.size;
}

const payload = {
  schema_version: "1.0.0",
  registry: "municipal-item-labels",
  generated_at: new Date().toISOString().slice(0, 10),
  note: "Native-language labels for municipal line-item codes, as published by each national "
      + "source. Names are not translated: a source's own account name is the auditable "
      + "identifier, and a translated label would not appear in the original filing.",
  country_count: Object.keys(countries).length,
  code_count: totalCodes,
  countries,
};

const bytes = Buffer.byteLength(`${JSON.stringify(payload, null, 2)}\n`);
console.log(`${Object.keys(countries).length} countries, ${totalCodes.toLocaleString("en-US")} codes, ${(bytes / 1024).toFixed(1)} KB`);
for (const [code, labels] of Object.entries(countries)) {
  console.log(`  ${code}  ${String(Object.keys(labels).length).padStart(5)} code(s)`);
}

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, "data", "registry"), { recursive: true });
await writeFile(path.join(ROOT, OUT), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`\nWrote ${OUT}`);
