import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const selected = [
  "data/benchmark.v1.json", "data/catalog.v1.json", "data/country-parity.v1.json", "data/contracts/country-parity.schema.json", "data/country-health.v1.json", "data/country-health-performance.v1.json", "data/country-provider-networks.v1.json", "data/country-functional-budgets.v1.json", "data/transport-budget-detail.v1.json", "data/transport-performance.v1.json", "data/country-cash-in.v1.json", "data/country-revenue.v1.json",
  "data/country-spending-2025-2026.v1.json", "data/country-spending-comparison.v1.json",
  "data/country-demography.v1.json", "data/public-entity-coverage.v1.json", "data/public-entity-aggregates.v1.json", "data/public-entity-directory/manifest.v1.json", "data/methodology-sources.v1.json", "data/coverage-source-research.v1.json", "data/data-quality-report.v1.json",
  "data/cz-public-entities-2024.json", "data/cz-public-entity-history.v1.json",
  "data/cz-spending-2026.v1.json", "data/cz-state-enterprises-2024.json", "data/state-owned-enterprises.v1.json",
  "data/czech-budget.v1.json", "data/demography-social.v1.json",
  "data/eu-capital-budgets.v1.json", "data/municipal-snapshot.v1.json", "data/municipal-history-directory.v1.json",
  "data/international-municipalities.v1.json", "data/international-itemized-warehouse.v1.json", "data/municipal-itemized-coverage.v1.json", "data/municipal-transparency.v1.json", "data/global-budget-transparency.v1.json", "data/world-map.v1.json",
  "lib/data/sovereign-benchmark.v1.json", "sitemap.xml",
];
try {
  await access(path.join(root, "data", "municipal-budget-codebook.v1.json"));
  selected.push("data/municipal-budget-codebook.v1.json");
} catch {}
for (const code of (await readdir(path.join(root, "data", "countries"))).sort()) {
  for (const name of (await readdir(path.join(root, "data", "countries", code))).filter((item) => item.endsWith(".json") && !/\s\d+\.json$/.test(item)).sort()) selected.push(`data/countries/${code}/${name}`);
}
for (const code of ["CZE","POL","DEU","GBR","FRA","USA","CHE","SWE","DNK","UKR"]) selected.push(`data/public-entity-directory/${code}.v1.json`);
const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const artifacts = [];
for (const relative of selected) {
  const content = await readFile(path.join(root, relative));
  artifacts.push({ path: relative, bytes: content.length, sha256: sha256(content) });
}
const entityHash = createHash("sha256");
let entityBytes = 0;
const entityFiles = (await readdir(path.join(root, "data", "entities"))).filter((name) => /^\d{8}\.json$/.test(name)).sort();
for (const name of entityFiles) {
  const content = await readFile(path.join(root, "data", "entities", name));
  entityHash.update(name).update("\0").update(content);
  entityBytes += content.length;
}
artifacts.push({ path: "data/entities/*.json", files: entityFiles.length, bytes: entityBytes, sha256: entityHash.digest("hex") });
const historyHash = createHash("sha256");
let historyBytes = 0;
const historyFiles = (await readdir(path.join(root, "data", "municipal-history"))).filter((name) => name === "index.json" || /^\d{8}\.json$/.test(name)).sort();
for (const name of historyFiles) {
  const content = await readFile(path.join(root, "data", "municipal-history", name));
  historyHash.update(name).update("\0").update(content);
  historyBytes += content.length;
}
artifacts.push({ path: "data/municipal-history/*.json", files: historyFiles.length, bytes: historyBytes, sha256: historyHash.digest("hex") });
for (const directory of [
  "data/municipal-expansion/bra", "data/municipal-expansion/dnk", "data/municipal-expansion/esp", "data/municipal-expansion/jpn",
  "data/municipal-benchmarks/nld", "data/municipal-benchmarks/nor", "data/municipal-benchmarks/fin",
]) {
  const digest = createHash("sha256");
  let bytes = 0;
  const names = (await readdir(path.join(root, directory))).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    const content = await readFile(path.join(root, directory, name));
    digest.update(name).update("\0").update(content);
    bytes += content.length;
  }
  artifacts.push({ path: `${directory}/*.json`, files: names.length, bytes, sha256: digest.digest("hex") });
}
let gitCommit = process.env.COMMIT_SHA || null;
let workingTreeDirty = null;
if (!gitCommit) {
  try { gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  try { workingTreeDirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()); } catch {}
} else {
  workingTreeDirty = false;
}
const snapshot = JSON.parse(await readFile(path.join(root, "data", "municipal-snapshot.v1.json"), "utf8"));
const sourceManifest = await readFile(path.join(root, "pipeline", "source-assets.manifest.json"));
const manifest = {
  schema_version: "1.0.0",
  git_commit: gitCommit,
  working_tree_dirty: workingTreeDirty,
  cloud_build_id: process.env.BUILD_ID || null,
  data_generated_at: snapshot.generated_at,
  municipal_ingestion_run_id: snapshot.provenance?.ingestion_run_id || "cz-finm-2025-all-municipalities-v1",
  source_assets_manifest_sha256: sha256(sourceManifest),
  artifacts,
};
await writeFile(path.join(root, "data", "release-manifest.v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest recorded ${artifacts.length} artifact groups`);
