import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { fanoutRoot } from "./lib/municipal-fanout.mjs";

const root = process.cwd();
const selected = [
  "data/benchmark.v1.json", "data/catalog.v1.json", "data/country-parity.v1.json", "data/contracts/country-parity.schema.json", "data/country-health.v1.json", "data/country-health-performance.v1.json", "data/country-provider-networks.v1.json", "data/country-functional-budgets.v1.json", "data/transport-budget-detail.v1.json", "data/transport-performance.v1.json", "data/country-cash-in.v1.json", "data/country-revenue.v1.json", "data/oecd-key-metrics.v1.json",
  "data/country-spending-2025-2026.v1.json", "data/country-spending-comparison.v1.json", "data/defense-deep-dive.v1.json", "data/defense-comparison.v1.json", "data/data-freshness.v1.json", "data/municipal-fx-rates.v1.json",
  "data/country-demography.v1.json", "data/public-entity-coverage.v1.json", "data/public-entity-aggregates.v1.json", "data/public-entity-directory/manifest.v1.json", "data/methodology-sources.v1.json", "data/coverage-source-research.v1.json", "data/coverage-metrics.v1.json", "data/data-quality-report.v1.json",
  "data/trade/product-intelligence.v1.json",
  "data/cz-public-entities-2024.json", "data/cz-public-entity-history.v1.json", "data/cz-public-employment.v1.json",
  "data/cz-spending-2026.v1.json", "data/cz-state-enterprises-2024.json", "data/cz-state-enterprise-balance-sheets-2024.v1.json", "data/state-owned-enterprises.v1.json",
  "data/money-flow-detail-2026.v1.json", "data/czech-budget.v1.json", "data/demography-social.v1.json", "data/digital-spillover.v1.json",
  "data/eu-capital-budgets.v1.json", "data/eu-migration.v1.json", "data/municipal-snapshot.v1.json", "data/municipal-history-directory.v1.json",
  "data/international-municipalities.v1.json", "data/international-itemized-warehouse.v1.json", "data/municipal-itemized-coverage.v1.json", "data/municipal-itemized-acquisition-audit.v1.json", "data/municipal-transparency.v1.json", "data/global-budget-transparency.v1.json", "data/world-map.v1.json",
  "lib/data/sovereign-benchmark.v1.json", "data/sovereign-benchmark-slim.v1.json",
  "data/municipal-directory-counts.v1.json", "data/international-municipalities/index.v1.json", "sitemap.xml",
  "czech-sources.html", "czech-sources.js", "czech-sources.css",
  "cityvizor/index.html", "cityvizor.js", "cityvizor.css",
  "data/cityvizor-catalogue.v1.json", "data/cityvizor-explorer-release.v1.json", "data/cityvizor-current.v1.json", "data/contracts/official-registry/manifest.v1.json", "data/contracts/official-registry/lineage.v1.json",
  "data/contracts/00075370.plzen-projects.v1.json", "data/money-reports/cze-arad-native.v1.json", "data/money-reports/cze.v1.json",
  "data/industry/CZE.json.gz", "data/registry/source-provenance.v1.json", "data/registry/run-log.v1.json",
];
for (const name of (await readdir(path.join(root, "data"))).sort()) {
  if (/^(?:cze-|czech-|cez-issuer-|mv-administration-grants).*\.json$/.test(name) && !selected.includes(`data/${name}`)) selected.push(`data/${name}`);
}
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
// Trees that are not in Git (cloud-hydrated layers and the pinned per-entity fan-out) are
// digested where they have been restored. Where they have not, the previous manifest's
// entry is carried forward unchanged: its content is pinned elsewhere and verified on
// hydration, and regenerating the manifest for a sitemap edit must not need 400 MB of it.
const previousTrees = new Map();
try {
  for (const artifact of JSON.parse(await readFile(path.join(root, "data", "release-manifest.v1.json"), "utf8")).artifacts) previousTrees.set(artifact.path, artifact);
} catch {}
const historyFanout = fanoutRoot("municipal-history", root);
const benchmarkFanout = fanoutRoot("municipal-benchmarks", root);
const treeSource = (directory) => {
  if (directory === "data/municipal-history") return historyFanout;
  const benchmark = /^data\/municipal-benchmarks\/([a-z]{3})$/.exec(directory);
  if (benchmark) return benchmarkFanout && path.join(benchmarkFanout, benchmark[1]);
  const local = path.join(root, directory);
  return existsSync(local) ? local : null;
};
async function pushTree(directory, include) {
  const source = treeSource(directory);
  const key = `${directory}/*.json`;
  if (!source) {
    if (!previousTrees.has(key)) throw new Error(`${directory} is not in this checkout and the previous release manifest has no entry to carry forward`);
    artifacts.push(previousTrees.get(key));
    return;
  }
  const digest = createHash("sha256");
  let bytes = 0;
  const names = (await readdir(source)).filter(include).sort();
  for (const name of names) {
    const content = await readFile(path.join(source, name));
    digest.update(name).update("\0").update(content);
    bytes += content.length;
  }
  artifacts.push({ path: key, files: names.length, bytes, sha256: digest.digest("hex") });
}
await pushTree("data/entities", (name) => /^\d{8}\.json$/.test(name));
await pushTree("data/municipal-history", (name) => name === "index.json" || /^\d{8}\.json$/.test(name));
for (const directory of [
  "data/municipal-expansion/bol", "data/municipal-expansion/bra", "data/municipal-expansion/chl", "data/municipal-expansion/col", "data/municipal-expansion/cri", "data/municipal-expansion/dnk", "data/municipal-expansion/esp", "data/municipal-expansion/geo", "data/municipal-expansion/gtm", "data/municipal-expansion/ita", "data/municipal-expansion/jpn", "data/municipal-expansion/kor", "data/municipal-expansion/mex", "data/municipal-expansion/per", "data/municipal-expansion/slv",
  "data/municipal-benchmarks/nld", "data/municipal-benchmarks/nor", "data/municipal-benchmarks/fin",
  "data/international-municipalities",
]) {
  await pushTree(directory, (name) => name.endsWith(".json"));
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
