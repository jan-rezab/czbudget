import { readFile } from "node:fs/promises";

const [cloudbuild, cloudbuildVerify, buildPlanes] = await Promise.all([
  readFile("cloudbuild.yaml", "utf8"),
  readFile("cloudbuild.verify.yaml", "utf8"),
  readFile("BUILD_PLANES.md", "utf8"),
]);

if (
  !cloudbuild.includes("scripts/assert-single-production.sh") ||
  !cloudbuild.includes("scripts/deploy-immutable.sh") ||
  !cloudbuild.includes("- czbudget-public") ||
  cloudbuild.includes("${_SERVICE}") ||
  cloudbuild.includes("czbudget-web")
) {
  throw new Error("Cloud Build must be locked to the sole canonical production service");
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
  "npx playwright test",
]) {
  if (!cloudbuildVerify.includes(required)) {
    throw new Error(`Full verification is missing its published-release gate: ${required}`);
  }
}

if (
  !cloudbuild.includes("_CITYVIZOR_SNAPSHOT_BASE_URL") ||
  !cloudbuild.includes("CITYVIZOR_SNAPSHOT_BASE_URL") ||
  cloudbuild.includes("publish-cityvizor-snapshot")
) {
  throw new Error("Code deployment must consume, but never publish, the active CityVizor snapshot");
}

console.log("Build-plane boundary OK: code deploy, read-only verification, and data publication are isolated.");
