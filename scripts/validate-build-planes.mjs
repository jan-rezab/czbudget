import { readFile } from "node:fs/promises";

const [cloudbuild, cloudbuildVerify, cloudbuildUi, cloudbuildServingAssets, buildPlanes, submitUi] = await Promise.all([
  readFile("cloudbuild.yaml", "utf8"),
  readFile("cloudbuild.verify.yaml", "utf8"),
  readFile("cloudbuild.ui.yaml", "utf8"),
  readFile("cloudbuild.serving-assets.yaml", "utf8"),
  readFile("BUILD_PLANES.md", "utf8"),
  readFile("scripts/submit-ui-verification.sh", "utf8"),
]);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

if (
  !cloudbuild.includes("scripts/assert-single-production.sh") ||
  !cloudbuild.includes("scripts/deploy-immutable.sh") ||
  !cloudbuild.includes("- czbudget-public") ||
  cloudbuild.includes("${_SERVICE}") ||
  cloudbuild.includes("czbudget-web")
) {
  throw new Error("Cloud Build must be locked to the sole canonical production service");
}

if (!cloudbuild.includes("timeout: 600s")) {
  throw new Error("Production code deployment must fail closed at ten minutes");
}

for (const forbidden of [
  "bq query",
  "scripts/build_trade_product_intelligence.py",
  "scripts/merge-municipal-breakdowns.mjs",
  "publish-public-snapshot",
  "--publish",
]) {
  if (cloudbuild.includes(forbidden)) {
    throw new Error(`Production Cloud Build must remain code-only; found ${forbidden}`);
  }
}

if (
  !cloudbuild.includes("read-active-data-release") ||
  !cloudbuild.includes("_STATIC_ASSET_BASE_URL") ||
  !buildPlanes.includes("static-asset releases through published")
) {
  throw new Error("Production must read validated data releases through published pointers");
}

for (const forbidden of [
  "deploy-immutable.sh",
  "publish-public-snapshot",
  "bq query",
  "docker push",
  "gcloud storage cp /workspace",
]) {
  if (cloudbuildVerify.includes(forbidden)) {
    throw new Error(`Full verification must remain read-only; found ${forbidden}`);
  }
}

for (const required of [
  "hydrate-published-releases",
  "validate-public-serving-snapshot.mjs",
  "validate-cityvizor-cloud-release.mjs",
  "verify-runtime-assets-cloud.py",
  "preflight-components",
  "browser-contrast-a",
  "browser-contrast-b",
  "npx playwright test",
  "scripts/run-bounded.mjs",
  "--global-timeout=420000",
  "timeout: 1200s",
]) {
  if (!cloudbuildVerify.includes(required)) {
    throw new Error(`Full verification is missing its published-release gate: ${required}`);
  }
}

if (
  !cloudbuildUi.includes("timeout: 600s") ||
  !cloudbuildUi.includes("machineType: E2_MEDIUM") ||
  !cloudbuildUi.includes("mcr.microsoft.com/playwright:v1.62.1-noble@sha256:") ||
  cloudbuildUi.includes("playwright install") ||
  !cloudbuildUi.includes("plane-verification") ||
  !cloudbuildUi.includes("scripts/run-component-gate.mjs")
) {
  throw new Error("Fast UI verification must remain bounded and cover the public hotfix surfaces");
}
for (const forbidden of ["deploy-immutable.sh", "bq query", "docker push", "gcloud storage cp"]) {
  if (cloudbuildUi.includes(forbidden)) throw new Error(`Fast UI verification must remain read-only; found ${forbidden}`);
}
if (
  !cloudbuildServingAssets.includes("plane-data") ||
  !cloudbuildServingAssets.includes("data-publication") ||
  !cloudbuildServingAssets.includes("publish-serving-asset-pack.py") ||
  cloudbuildServingAssets.includes("deploy-immutable.sh") ||
  cloudbuildServingAssets.includes("gcloud run deploy")
) {
  throw new Error("Serving contracts must publish only through the data plane");
}
if (
  packageJson.scripts["test:browser:ui"]?.includes("playwright.ui.config.mjs") !== true ||
  !buildPlanes.includes("prepare-ui-build-context.mjs") ||
  !buildPlanes.includes("Never run `gcloud builds submit .`") ||
  !submitUi.includes("psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com") ||
  !submitUi.includes("prepare-ui-build-context.mjs") ||
  submitUi.includes("builds submit .")
) {
  throw new Error("The fast UI gate must use the explicit lean source context");
}

if (
  !cloudbuild.includes("_CITYVIZOR_SNAPSHOT_BASE_URL") ||
  !cloudbuild.includes("CITYVIZOR_SNAPSHOT_BASE_URL") ||
  cloudbuild.includes("publish-cityvizor-snapshot")
) {
  throw new Error("Code deployment must consume, but never publish, the active CityVizor snapshot");
}

console.log("Build-plane boundary OK: code deploy, read-only verification, and data publication are isolated.");
