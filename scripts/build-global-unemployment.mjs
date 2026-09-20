#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import { buildGlobalUnemployment, parseCsvLine, WORLD_BANK_INDICATOR } from "./lib/global-unemployment.mjs";

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const root = process.cwd();
const sovereignPath = path.resolve(root, options.get("--sovereign") || "lib/data/sovereign-benchmark.v1.json");
const observationsPath = path.resolve(root, options.get("--observations") || "data/economy/economic-observations.v1.csv.gz");
const manifestPath = path.resolve(root, options.get("--economy-manifest") || "data/economy/manifest.v1.json");
const outputPath = path.resolve(root, options.get("--output") || "data/global-unemployment.v1.json");

async function readWorldBankRows(file) {
  const input = createReadStream(file).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  let fields = null;
  const rows = [];
  for await (const line of lines) {
    const values = parseCsvLine(line);
    if (!fields) { fields = values; continue; }
    const indicatorIndex = fields.indexOf("indicator_code");
    if (values[indicatorIndex] !== WORLD_BANK_INDICATOR) continue;
    rows.push(Object.fromEntries(fields.map((field, index) => [field, values[index] || ""])));
  }
  return rows;
}

const sovereign = JSON.parse(await readFile(sovereignPath, "utf8"));
const economyManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const worldBankRows = await readWorldBankRows(observationsPath);
const generatedAt = options.get("--generated-at") || [sovereign.generated_at, economyManifest.generated_at].filter(Boolean).sort().at(-1);
const artifact = buildGlobalUnemployment({ sovereign, worldBankRows, generatedAt });
const temporary = `${outputPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`);
await rename(temporary, outputPath);
console.log(JSON.stringify({ output: outputPath, ...artifact.coverage }));
