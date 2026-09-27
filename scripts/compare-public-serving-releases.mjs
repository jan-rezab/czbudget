#!/usr/bin/env node
// Prove that a prepared municipal serving release serves the same bytes as a baseline.
//
//   node scripts/compare-public-serving-releases.mjs --baseline <routes.v1.json.gz | release output dir>
//        --candidate <release output dir> [--countries CZE,NOR,NLD,FIN] [--allow-missing]
//
// Every profile's payload_sha256 is SHA-256 of its exact profile and history JSON, so equal
// hashes on the same canonical path mean the served bytes are identical. The data-plane
// snapshot build runs this against the active release before publication: moving an input
// out of Git must not change one published payload. Exit 1 lists the first differences.
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const args = {};
for (let index = 2; index < process.argv.length; index += 1) {
  const flag = process.argv[index];
  if (flag === "--allow-missing") args.allowMissing = true;
  else if (["--baseline", "--candidate", "--countries"].includes(flag) && process.argv[index + 1]) args[flag.slice(2)] = process.argv[++index];
  else throw new Error(`Unknown or incomplete argument: ${flag}`);
}
if (!args.baseline || !args.candidate) throw new Error("--baseline and --candidate are required");

function routes(location) {
  let file = location;
  if (fs.statSync(location).isDirectory()) {
    const current = JSON.parse(fs.readFileSync(path.join(location, "current.json"), "utf8"));
    file = path.join(location, current.routes);
  }
  const document = JSON.parse(gunzipSync(fs.readFileSync(file)).toString("utf8"));
  return { releaseId: document.release_id, routes: new Map(document.routes.map((route) => [route.profile_id, route])) };
}

const baseline = routes(args.baseline);
const candidate = routes(args.candidate);
const countries = args.countries ? new Set(args.countries.split(",").map((code) => code.trim().toUpperCase())) : null;
const selected = (map) => [...map.values()].filter((route) => !countries || countries.has(route.country_code));
const byCountry = {};
const problems = [];
const tally = (code, key) => {
  byCountry[code] ??= { identical: 0, changed: 0, missing_in_candidate: 0, added_in_candidate: 0 };
  byCountry[code][key] += 1;
};
for (const route of selected(baseline.routes)) {
  const other = candidate.routes.get(route.profile_id);
  if (!other) {
    tally(route.country_code, "missing_in_candidate");
    if (!args.allowMissing) problems.push(`${route.profile_id} is missing from the candidate`);
  } else if (other.payload_sha256 !== route.payload_sha256 || other.path !== route.path) {
    tally(route.country_code, "changed");
    problems.push(`${route.profile_id} changed (${route.payload_sha256.slice(0, 12)} -> ${other.payload_sha256.slice(0, 12)})`);
  } else tally(route.country_code, "identical");
}
for (const route of selected(candidate.routes)) {
  if (!baseline.routes.has(route.profile_id)) {
    tally(route.country_code, "added_in_candidate");
    problems.push(`${route.profile_id} is new in the candidate`);
  }
}
const summary = { baseline_release: baseline.releaseId, candidate_release: candidate.releaseId, countries: countries ? [...countries].sort() : "all", by_country: byCountry, identical: problems.length === 0 };
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (problems.length) {
  process.stderr.write(`${problems.slice(0, 20).join("\n")}\n${problems.length} payload difference(s)\n`);
  process.exit(1);
}
