#!/usr/bin/env node

import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const destination = resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Usage: node scripts/prepare-ui-build-context.mjs DESTINATION");
if (destination === root || !destination.startsWith(resolve(process.env.TMPDIR || "/tmp"))) {
  throw new Error("The UI build context must be a dedicated temporary directory");
}

await assertEmpty(destination);
await mkdir(destination, { recursive: true });

const files = [
  "scripts/verification-plan.mjs",
  "scripts/chart-registry.mjs",
  "scripts/validate-ui-environment.mjs",
  "scripts/validate-release-contract.mjs",
  "scripts/build-chart-coverage.mjs",
  "scripts/stage-runtime.py",
  "chart-components.json",
  "chart-legacy-inventory.json",
  "chart-coverage.json",
  "ui-environment.json",
  "chart-runtime.js",
  "scripts/run-component-gate.mjs",
  "tests/unit/chart-renderer.spec.mjs",
  "tests/unit/verification-plan.spec.mjs",
  "tests/unit/chart-registry.spec.mjs",
  "tests/unit/release-contract.spec.mjs",
  "tests/release/image.spec.mjs",
  "tests/browser/shared-charts.spec.mjs",
  "tests/browser/shared-navigation.spec.mjs",
  "lib/chart-renderer.js",
  "shared-charts.css",
  "psd-chart.js",
  "psd-chart.css",
  "municipalities-czechia.js",
  "municipal-expanded-profile.js",
  "municipal-expanded-profile.css",
  "cz-history.js",
  "tests/browser/stories.spec.mjs",
  "deep-dives/energy-trade/index.html",
  "energy-trade-deep-dive.js",
  "energy-trade-deep-dive.css",
  "tests/browser/energy-trade.spec.mjs",
  "nginx.conf.template",
  "portal-ui.js",
  "portal-ui.css",
  "ux-refinements.css",
  "reports-menu.css",
  "data-report.js",
  "data-report.css",
  "data-loader.js",
  "comparison.html",
  "compare-contract.js",
  "compare-contract.css",
  "homepage-v2.js",
  "demographic-pressure.js",
  "demographic-pressure.css",
  "oecd-charts.css",
  "education-deep-dive.js",
  "education-deep-dive.css",
  "deep-dives/education/index.html",
  "deep-dives.css",
  "chart-system.css",
  "psd-chart.js",
  "psd-chart.css",
  "tests/browser/compare-contract.spec.mjs",
  "tests/browser/education-capacity.spec.mjs",
  "tests/browser/loading-recovery.spec.mjs",
  "data/compare-metrics.v1.json",
  "data/health-system-assignments.v1.json",
  "lib/data/sovereign-benchmark.v1.json",
  "data/country-health.v1.json",
  "data/hospital-ownership.v1.json",
  "data/country-provider-networks.v1.json",
  "data/oecd-key-metrics.v1.json",
  "data/fx-eur-annual.v1.json",
  "data/europe-demographic-pressure.v1.json",
  "data/education-deep-dive.v1.json",
  "data/education-capacity-international.v1.json",
  "data/education-regional-learners.v1.json",
  "data/cze-school-funding-2026-summary.v1.json",

  "package.json",
  "package-lock.json",
  "cloudbuild.ui.yaml",
  "cloudbuild.verify.yaml",
  "cloudbuild.yaml",
  "playwright.ui.config.mjs",
  "map.html",
  "methodology.html",
  "language-bootstrap.js",
  "country-routes.js",
  "global-footer.js",
  "global-nav.js",
  "map-view.js",
  "coverage-accounting-boundaries.js",
  "coverage-map.js",
  "data-freshness.js",
  "municipal-transparency.js",
  "site-pages.js",
  "run-log.js",
  "global-footer.css",
  "map-view.css",
  "site-header.css",
  "styles-v2.css",
  "styles.css",
  "coverage-map.css",
  "data-freshness.css",
  "municipal-transparency.css",
  "site-pages.css",
  "run-log.css",
  "scripts/ui-test-server.mjs",
  "tests/browser/map-view.spec.mjs",
  "tests/browser/process-log.spec.mjs",
  "data/world-map.v1.json",
  "data/global-budget-transparency.v1.json",
  "data/country-spending-comparison.v1.json",
  "data/country-functional-budgets.v1.json",
  "data/sovereign-benchmark-slim.v1.json",
  "data/country-parity.v1.json",
  "data/methodology-sources.v1.json",
  "data/data-quality-report.v1.json",
  "data/release-manifest.v1.json",
  "data/international-municipalities/index.v1.json",
  "data/municipal-itemized-coverage.v1.json",
  "data/transport-performance.v1.json",
  "data/transport-budget-detail.v1.json",
  "data/coverage-source-research.v1.json",
  "data/coverage-metrics.v1.json",
  "data/data-freshness.v1.json",
  "data/registry/run-log.v1.json",
];
const directories = ["assets", "process", "stories", "tests/fixtures/charts"];

for (const relative of files) {
  const target = join(destination, relative);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, relative), target);
}
for (const relative of directories) {
  await cp(join(root, relative), join(destination, relative), { recursive: true });
}

const inventory = [];
await walk(destination, inventory);
const totalBytes = inventory.reduce((sum, item) => sum + item.bytes, 0);
await writeFile(join(destination, "ui-build-context.json"), `${JSON.stringify({
  schema_version: "1.0.0",
  purpose: "code-only UI verification",
  file_count: inventory.length,
  bytes: totalBytes,
  excluded_planes: ["data-ingestion", "data-transformation", "data-publication", "deployment"],
}, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({ destination, file_count: inventory.length + 1, bytes: totalBytes })}\n`);

async function assertEmpty(target) {
  try {
    const details = await stat(target);
    if (!details.isDirectory()) throw new Error(`${target} is not a directory`);
    if ((await readdir(target)).length) throw new Error(`${target} is not empty`);
    await rm(target, { recursive: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function walk(directory, inventory, relative = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryRelative = join(relative, entry.name);
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) await walk(entryPath, inventory, entryRelative);
    else if (entry.isFile()) inventory.push({ path: entryRelative, bytes: (await stat(entryPath)).size });
    else throw new Error(`Unsupported build-context entry: ${basename(entryPath)}`);
  }
}
