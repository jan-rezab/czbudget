#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import process from "node:process";
import { once } from "node:events";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = parseArgs(process.argv.slice(2));
const releaseId = args.releaseId || new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outputRoot = path.resolve(args.output || path.join(ROOT, ".public-serving", releaseId));
const releaseRoot = path.join(outputRoot, "releases", releaseId);
const stagingRoot = path.join(outputRoot, "staging");
const generatedAt = new Date().toISOString();

await assertFreshOutput(outputRoot);
await fs.mkdir(path.join(releaseRoot, "profiles"), { recursive: true });
await fs.mkdir(stagingRoot, { recursive: true });
await fs.writeFile(path.join(outputRoot, ".public-serving-output"), `${releaseId}\n`);

const itemizedCoverage = await readJSON(path.join(ROOT, "data", "municipal-itemized-coverage.v1.json"));
const warehouseCoverage = await readJSON(path.join(ROOT, "data", "international-itemized-warehouse.v1.json"));
const validatedFacts = validatedFactsByCountry(itemizedCoverage, warehouseCoverage);
const sources = await sourceFiles();
const routes = [];
const inventory = new Map();
const seenIds = new Set();
const seenPaths = new Set();
const profileStagePath = path.join(stagingRoot, "public_profile_snapshots.jsonl");
const profileStage = createWriteStream(profileStagePath, { encoding: "utf8", flags: "wx" });

let totalBytes = 0;
let totalNestedRecords = 0;
let count = 0;
let skippedNonProfileArtifacts = 0;
for (const source of sources) {
  const original = await readJSON(source.file);
  const normalized = await normalizeProfile(source, original);
  if (!normalized) {
    skippedNonProfileArtifacts += 1;
    continue;
  }
  validateProfile(normalized, source.file);

  if (seenIds.has(normalized.profile_id)) throw new Error(`Duplicate profile_id ${normalized.profile_id} (${source.file})`);
  if (seenPaths.has(normalized.canonical_path)) throw new Error(`Duplicate canonical_path ${normalized.canonical_path} (${source.file})`);
  seenIds.add(normalized.profile_id);
  seenPaths.add(normalized.canonical_path);

  const profileJson = JSON.stringify(normalized.profile_payload);
  const historyJson = normalized.history_payload === null ? "null" : JSON.stringify(normalized.history_payload);
  const payloadBytes = Buffer.byteLength(profileJson) + (historyJson === "null" ? 0 : Buffer.byteLength(historyJson));
  const payloadSha256 = sha256(`${profileJson}\n${historyJson}`);
  const nestedRecordCount = countNestedRecords(normalized.profile_payload) + countNestedRecords(normalized.history_payload);
  const objectKey = `releases/${releaseId}/profiles/${normalized.country_code.toLowerCase()}/${safeFileName(normalized.entity_code)}.json.gz`;
  const objectPath = path.join(outputRoot, objectKey);
  const wrapper = {
    schema_version: "1.0.0",
    release_id: releaseId,
    profile_id: normalized.profile_id,
    canonical_path: normalized.canonical_path,
    payload_sha256: payloadSha256,
    profile: normalized.profile_payload,
    history: normalized.history_payload,
  };
  await fs.mkdir(path.dirname(objectPath), { recursive: true });
  await fs.writeFile(objectPath, gzipSync(`${JSON.stringify(wrapper)}\n`, { level: 9 }));

  const row = {
    ...normalized,
    payload_sha256: payloadSha256,
    payload_bytes: payloadBytes,
    nested_record_count: nestedRecordCount,
    release_id: releaseId,
    generated_at: generatedAt,
  };
  await writeLine(profileStage, row);
  routes.push({
    path: normalized.canonical_path,
    profile_id: normalized.profile_id,
    country_code: normalized.country_code,
    entity_code: normalized.entity_code,
    entity_name: normalized.entity_name,
    object_key: objectKey,
    payload_sha256: payloadSha256,
  });
  addInventory(inventory, normalized, payloadBytes, nestedRecordCount);
  totalBytes += payloadBytes;
  totalNestedRecords += nestedRecordCount;
  count += 1;
  if (count % 5_000 === 0) process.stderr.write(`Prepared ${count.toLocaleString("en-US")} profiles\n`);
}
profileStage.end();
await once(profileStage, "finish");

routes.sort((a, b) => a.path.localeCompare(b.path));
const routesDocument = {
  schema_version: "1.0.0",
  release_id: releaseId,
  generated_at: generatedAt,
  routes,
};
const routesBody = `${JSON.stringify(routesDocument)}\n`;
const routesPath = path.join(releaseRoot, "routes.v1.json.gz");
await fs.writeFile(routesPath, gzipSync(routesBody, { level: 9 }));
const routeIndexSha256 = sha256(routesBody);

const inventoryRows = buildInventoryRows(inventory, validatedFacts, {
  releaseId,
  generatedAt,
  totalBytes,
  totalNestedRecords,
  profileCount: count,
  processedStructuredRows: args.processedStructuredRows,
});
const inventoryStagePath = path.join(stagingRoot, "public_dataset_inventory.jsonl");
await fs.writeFile(inventoryStagePath, inventoryRows.map((row) => JSON.stringify(row)).join("\n") + "\n", { flag: "wx" });

const metrics = coverageMetrics(inventoryRows, warehouseCoverage, itemizedCoverage, args.processedStructuredRows, generatedAt, releaseId);
await fs.writeFile(path.join(releaseRoot, "coverage-metrics.v1.json"), `${JSON.stringify(metrics, null, 2)}\n`);

const manifestCore = {
  schema_version: "1.0.0",
  release_id: releaseId,
  generated_at: generatedAt,
  profile_count: count,
  country_count: inventory.size,
  nested_record_count: totalNestedRecords,
  payload_bytes: totalBytes,
  skipped_non_profile_artifacts: skippedNonProfileArtifacts,
  route_index: `releases/${releaseId}/routes.v1.json.gz`,
  route_index_sha256: routeIndexSha256,
  coverage_metrics: `releases/${releaseId}/coverage-metrics.v1.json`,
};
const manifestSha256 = sha256(JSON.stringify(manifestCore));
const manifest = { ...manifestCore, manifest_sha256: manifestSha256 };
await fs.writeFile(path.join(releaseRoot, "manifest.v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, "current.json"), `${JSON.stringify({
  schema_version: "1.0.0",
  release_id: releaseId,
  manifest: `releases/${releaseId}/manifest.v1.json`,
  routes: manifest.route_index,
  coverage_metrics: manifest.coverage_metrics,
  published_at: generatedAt,
}, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  output_root: outputRoot,
  release_id: releaseId,
  profile_count: count,
  country_count: inventory.size,
  nested_record_count: totalNestedRecords,
  payload_bytes: totalBytes,
  route_index_sha256: routeIndexSha256,
  manifest_sha256: manifestSha256,
}, null, 2)}\n`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--output" && value) parsed.output = argv[++index];
    else if (arg === "--release-id" && value) parsed.releaseId = argv[++index];
    else if (arg === "--processed-structured-rows" && value) parsed.processedStructuredRows = positiveInteger(argv[++index], arg);
    else if (arg === "--help") {
      process.stdout.write("Usage: node scripts/prepare-public-serving-snapshots.mjs [--output DIR] [--release-id ID] [--processed-structured-rows N]\n");
      process.exit(0);
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (parsed.releaseId && !/^[A-Za-z0-9._-]{1,100}$/.test(parsed.releaseId)) throw new Error("--release-id contains unsupported characters");
  return parsed;
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${flag} must be a positive integer`);
  return number;
}

async function assertFreshOutput(directory) {
  try {
    const entries = await fs.readdir(directory);
    if (entries.length) throw new Error(`Output directory must be empty: ${directory}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/**
 * Where each country's municipal profiles come from. A country whose headline rules reproduce
 * every figure the site publishes is read from the warehouse build; the rest are read from the
 * committed fan-out until they do. The split is derived from the rules rather than listed by
 * hand, so a country cannot be switched over by editing a list without the check that earns it.
 */
async function municipalExpansionRoots() {
  const fanout = path.join(ROOT, "data", "municipal-expansion");
  const warehouse = path.join(ROOT, process.env.WAREHOUSE_PROFILE_ROOT || ".warehouse-profiles");
  const chosen = new Map();

  let rules = { countries: [] };
  try {
    rules = await readJSON(path.join(ROOT, "pipeline", "config", "municipal_headline_rules.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  // Two bases, kept distinct because they are not equally strong. A derived rule reproduces
  // every figure the site already publishes. An authored one has no such check — it is allowed
  // only where the site publishes no headline at all, so switching cannot regress one, and the
  // rule's own justification is recorded beside it.
  const reproduces = new Set(rules.countries
    .filter((entry) => (entry.revenue?.match_rate === 1 && entry.expenditure?.match_rate === 1)
      || (entry.authored === true && entry.authored_basis))
    .map((entry) => entry.country_code.toLowerCase()));

  for (const entry of await fs.readdir(fanout, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fromWarehouse = reproduces.has(entry.name)
      && await fs.access(path.join(warehouse, entry.name)).then(() => true, () => false);
    chosen.set(entry.name, fromWarehouse ? path.join(warehouse, entry.name) : path.join(fanout, entry.name));
  }
  return chosen;
}

async function sourceFiles() {
  const files = [];
  const municipal = await municipalExpansionRoots();
  const fromWarehouse = [];
  for (const [country, directory] of municipal) {
    if (directory.includes(".warehouse-profiles")) fromWarehouse.push(country);
    for (const file of await walkJSON(directory)) files.push({ file, kind: "municipal-expansion" });
  }
  process.stdout.write(fromWarehouse.length
    ? `municipal profiles from the warehouse: ${fromWarehouse.sort().join(", ")}\n`
    : "municipal profiles: all from the committed fan-out\n");

  const groups = [
    { directory: path.join(ROOT, "data", "municipal-benchmarks"), kind: "municipal-benchmark" },
    { directory: path.join(ROOT, "data", "entities"), kind: "czech-public-entity" },
  ];
  for (const group of groups) {
    for (const file of await walkJSON(group.directory)) files.push({ file, kind: group.kind });
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

async function walkJSON(directory) {
  const found = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walkJSON(target));
    else if (entry.isFile() && entry.name.endsWith(".json")) found.push(target);
  }
  return found;
}

async function normalizeProfile(source, payload) {
  if (source.kind === "czech-public-entity") {
    const entity = payload.entity || {};
    const municipalityPath = entity.seo?.municipality_path || entity.seo?.path;
    if (!municipalityPath || !String(municipalityPath).startsWith("/cz/municipalities/")) return null;
    const code = String(entity.national_id || path.basename(source.file, ".json"));
    const historyFile = path.join(ROOT, "data", "municipal-history", `${code}.json`);
    let history = null;
    try { history = await readJSON(historyFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
    const canonicalPath = canonicalizePath(municipalityPath);
    return metadata({
      countryCode: "CZE",
      entityCode: code,
      canonicalPath,
      entityName: entity.short_name || entity.name,
      currencyCode: entity.currency_code || "CZK",
      years: [payload.period?.fiscal_year, ...(history?.series || []).map((row) => row.year)],
      sourceKind: source.kind,
      sourceUrl: entity.source?.url || payload.source_url || null,
      profilePayload: payload,
      historyPayload: history,
    });
  }
  if (!payload.url || payload.code === undefined || payload.code === null) return null;
  const canonicalPath = canonicalizePath(payload.url);
  return metadata({
    countryCode: payload.country,
    entityCode: String(payload.code),
    canonicalPath,
    entityName: payload.name,
    currencyCode: payload.currency || null,
    years: payload.years || (payload.history || []).map((row) => row.year),
    sourceKind: source.kind,
    sourceUrl: payload.source_url || null,
    profilePayload: payload,
    historyPayload: null,
  });
}

function metadata({ countryCode, entityCode, canonicalPath, entityName, currencyCode, years, sourceKind, sourceUrl, profilePayload, historyPayload }) {
  const segments = canonicalPath.split("/").filter(Boolean);
  const profileSlug = segments.at(-1);
  const countrySlug = countryCode === "CZE" ? "czechia" : segments.at(-2);
  const validYears = years.map(Number).filter(Number.isFinite);
  return {
    profile_id: `${String(countryCode).toUpperCase()}:${entityCode}`,
    country_code: String(countryCode).toUpperCase(),
    entity_code: entityCode,
    country_slug: countrySlug,
    profile_slug: profileSlug,
    canonical_path: canonicalPath,
    entity_name: entityName,
    currency_code: currencyCode,
    first_year: validYears.length ? Math.min(...validYears) : null,
    latest_year: validYears.length ? Math.max(...validYears) : null,
    source_kind: sourceKind,
    source_url: sourceUrl,
    profile_payload: profilePayload,
    history_payload: historyPayload,
  };
}

function validateProfile(row, file) {
  for (const key of ["profile_id", "country_code", "entity_code", "country_slug", "profile_slug", "canonical_path", "entity_name", "source_kind"]) {
    if (!row[key]) throw new Error(`${file}: missing ${key}`);
  }
  if (!/^\/(?:municipalities\/[^/]+\/[^/]+|cz\/municipalities\/[^/]+)\/$/.test(row.canonical_path)) {
    throw new Error(`${file}: unsupported canonical municipality route ${row.canonical_path}`);
  }
}

function canonicalizePath(value) {
  const pathname = new URL(String(value || ""), "https://publicspendingdata.org").pathname;
  return `/${pathname.split("/").filter(Boolean).join("/")}/`;
}

function countNestedRecords(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.length + value.reduce((sum, child) => sum + countNestedRecords(child), 0);
  return Object.values(value).reduce((sum, child) => sum + countNestedRecords(child), 0);
}

function safeFileName(value) {
  const encoded = Buffer.from(String(value)).toString("base64url");
  if (!encoded) throw new Error("Cannot create object key for empty entity code");
  return encoded;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, "drain");
}

function addInventory(inventory, row, payloadBytes, nestedRecordCount) {
  const current = inventory.get(row.country_code) || { profile_count: 0, nested_record_count: 0, payload_bytes: 0, source_kinds: new Set() };
  current.profile_count += 1;
  current.nested_record_count += nestedRecordCount;
  current.payload_bytes += payloadBytes;
  current.source_kinds.add(row.source_kind);
  inventory.set(row.country_code, current);
}

/**
 * How many validated financial facts a country contributes.
 *
 * A country can be measured twice: once from the profiles published on the site, once from
 * the production warehouse. Those are two views of the SAME layer under different leaf
 * rules — the warehouse drops published totals, subtotals and derived residuals that the
 * file measurement counts — so they must not be added together, and neither should silently
 * replace the other.
 *
 * The warehouse used to override unconditionally. That was wrong in both directions: where
 * the warehouse holds fewer leaves than the published files (Brazil: 1,236,092 against
 * 1,551,136) recording a successful load made this public volume figure fall, and where it
 * holds more, the published measurement vanished with no note. Taking the larger keeps the
 * honest answer to "how many facts do we hold" without ever counting one fact twice.
 */
function validatedFactsByCountry(itemized, warehouse) {
  const result = new Map();
  const consider = (code, value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    result.set(code, Math.max(result.get(code) || 0, value));
  };
  for (const country of itemized.countries || []) consider(country.code, Number(country.line_item_count));
  for (const country of warehouse.countries || []) {
    consider(country.code, (Number(country.line_fact_count) || 0) + (Number(country.balance_fact_count) || 0));
  }
  return result;
}

function buildInventoryRows(inventory, validatedFacts, context) {
  const rows = [...inventory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([countryCode, totals]) => ({
    release_id: context.releaseId,
    dataset_id: `public-profiles-${countryCode.toLowerCase()}`,
    metric_scope: "country",
    country_code: countryCode,
    profile_count: totals.profile_count,
    nested_record_count: totals.nested_record_count,
    payload_bytes: totals.payload_bytes,
    validated_fact_count: validatedFacts.get(countryCode) ?? null,
    validation_status: validatedFacts.has(countryCode) ? "checked-in-warehouse-inventory" : "payload-validated",
    source_kind: [...totals.source_kinds].sort().join(","),
    generated_at: context.generatedAt,
    notes: "Generated from the exact public profile payloads in this immutable release.",
  }));
  rows.push({
    release_id: context.releaseId,
    dataset_id: "public-profiles-all",
    metric_scope: "global",
    country_code: null,
    profile_count: context.profileCount,
    nested_record_count: context.totalNestedRecords,
    payload_bytes: context.totalBytes,
    validated_fact_count: [...validatedFacts.values()].reduce((sum, value) => sum + value, 0),
    validation_status: "checked-in-warehouse-inventory",
    source_kind: "public-profile-release",
    generated_at: context.generatedAt,
    notes: "Current deduplicated public profile release; not a cumulative ingestion count.",
  });
  if (context.processedStructuredRows) rows.push({
    release_id: context.releaseId,
    dataset_id: "cumulative-structured-rows",
    metric_scope: "cumulative",
    country_code: null,
    profile_count: 0,
    nested_record_count: context.processedStructuredRows,
    payload_bytes: 0,
    validated_fact_count: null,
    validation_status: "workspace-line-audit",
    source_kind: "pipeline-archive",
    generated_at: context.generatedAt,
    notes: "Cumulative structured source and output lines processed; may include historical versions and is not a current-row count.",
  });
  return rows;
}

function coverageMetrics(rows, warehouse, itemized, processedStructuredRows, timestamp, currentReleaseId) {
  const global = rows.find((row) => row.metric_scope === "global");
  const warehouseFacts = (warehouse.countries || []).reduce((sum, row) => sum + (Number(row.line_fact_count) || 0) + (Number(row.balance_fact_count) || 0), 0);
  const publishedLineItems = (itemized.countries || []).reduce((sum, row) => sum + (Number(row.line_item_count) || 0), 0);
  return {
    schema_version: "1.0.0",
    generated_at: timestamp,
    release_id: currentReleaseId,
    metrics: {
      cumulative_structured_rows_processed: processedStructuredRows || null,
      current_validated_financial_facts: global.validated_fact_count,
      current_validated_warehouse_facts: warehouseFacts,
      current_published_line_items: publishedLineItems,
      current_public_profiles: global.profile_count,
      current_public_profile_nested_records: global.nested_record_count,
      current_public_profile_payload_bytes: global.payload_bytes,
    },
    definitions: {
      cumulative_structured_rows_processed: "Cumulative structured source and output lines audited across the workspace; historical versions can overlap.",
      current_validated_financial_facts: "Current deduplicated financial facts represented by the warehouse inventory and published itemized layers.",
      current_validated_warehouse_facts: "Current line and balance facts in the checked-in production warehouse inventory.",
      current_published_line_items: "Current itemized rows represented by published municipal profiles.",
      current_public_profiles: "Deduplicated municipality routes in this immutable release.",
    },
  };
}
