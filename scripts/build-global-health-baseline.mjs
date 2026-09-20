#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { HEALTH_INDICATORS, buildGlobalHealth, sourceUrl } from "./lib/global-health-baseline.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const root = process.cwd();
const registryPath = path.resolve(root, args.get("--registry") || "pipeline/config/sovereign_country_universe.json");
const rawDir = path.resolve(root, args.get("--raw-dir") || "data/sources/global-health");
const outputPath = path.resolve(root, args.get("--output") || "data/global-health-baseline.v1.json");
const coveragePath = path.resolve(root, args.get("--coverage-output") || "data/global-health-coverage.v1.json");
const startYear = Number(args.get("--start-year") || 2000);
const endYear = Number(args.get("--end-year") || new Date().getUTCFullYear());
const generatedAt = args.get("--generated-at") || new Date().toISOString();
const fetchMode = args.has("--fetch");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const atomicJson = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
};

async function fetchIndicator(sourceCode) {
  const records = [];
  let page = 1;
  let pages = 1;
  do {
    const url = sourceUrl(sourceCode, startYear, endYear, page);
    const response = await fetch(url, { headers: { "user-agent": "PublicSpendingData/1.0" } });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const payload = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) throw new Error(`Invalid World Bank response for ${sourceCode}, page ${page}`);
    pages = Number(payload[0]?.pages || 1);
    records.push(...payload[1]);
    page += 1;
  } while (page <= pages);
  return { source_code: sourceCode, retrieved_at: generatedAt, pages, records };
}

await mkdir(rawDir, { recursive: true });
const payloads = {};
for (const definition of Object.values(HEALTH_INDICATORS)) {
  const file = path.join(rawDir, `${definition.source_code}.json`);
  if (fetchMode) await atomicJson(file, await fetchIndicator(definition.source_code));
  payloads[definition.source_code] = await readJson(file);
}
const registry = await readJson(registryPath);
const { artifact, coverage } = buildGlobalHealth({ registry, payloads, generatedAt, startYear, endYear });
await atomicJson(outputPath, artifact);
await atomicJson(coveragePath, coverage);
console.log(JSON.stringify({ output: outputPath, coverage: coveragePath, countries: artifact.country_count, countries_with_any_metric: coverage.countries_with_any_metric }));
