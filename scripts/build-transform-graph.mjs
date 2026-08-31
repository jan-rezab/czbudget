#!/usr/bin/env node
/**
 * The build DAG — B7.
 *
 * "What must rebuild when Eurostat updates?" is currently answered from memory. 96 transforms
 * split across Node and Python declare no dependencies on each other, and 49 of them are not
 * referenced by any npm script, so there is no entry point that says what they are for or
 * what they touch.
 *
 * This reads each transform and records the artifacts it opens for reading and the ones it
 * writes, then joins them into a graph: an artifact's producer, its consumers, and what
 * transitively goes stale when a source changes.
 *
 * It is deliberately static. Running 96 transforms to find out what they touch is not
 * something a validator can do, and a graph derived from what the code actually references
 * is the thing that catches a generator quietly deleting an artifact it never declared.
 *
 *   node scripts/build-transform-graph.mjs --report
 *   node scripts/build-transform-graph.mjs --write
 *   node scripts/build-transform-graph.mjs --impact data/municipal-snapshot.v1.json
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const OUT = "data/registry/transform-graph.v1.json";

const args = process.argv.slice(2);
const write = args.includes("--write");
const impactAt = args.indexOf("--impact");
const impactTarget = impactAt >= 0 ? args[impactAt + 1] : null;

const DIRS = ["scripts", "pipeline/transforms"];
// Paths are written every way a relative path can be: "data/x.json", "../data/x.json",
// "./lib/data/x.json". Matching only the first form saw 43 of 95 transforms and reported the
// other 52 as touching nothing at all.
const ARTIFACT = /["'`]((?:\.{1,2}\/)*(?:data|lib\/data|pipeline\/config)\/[A-Za-z0-9._/-]+\.(?:json|csv|xml|gz))["'`]/g;
const normalise = (value) => value.replace(/^(?:\.{1,2}\/)+/, "");

/** Python and JS ways of saying "I read this" and "I write this". */
const READ_HINTS = [/read_text/, /json\.load\s*\(/, /readFile/, /read_json/, /loads\(/, /open\(/];
const WRITE_HINTS = [/write_text/, /json\.dump/, /writeFile/, /to_csv/, /to_json/, /\.write\(/];

/**
 * Resolve `NAME = ROOT / "data/x.json"` so a later `NAME.read_text()` is attributable.
 * Without this, the handful of transforms that hoist their paths into constants — which
 * tends to be the larger ones — look like they touch nothing at all.
 */
function constantPaths(source) {
  const map = new Map();
  const pattern = /^([A-Z][A-Z0-9_]*)\s*=\s*(?:[A-Za-z_]+\s*\/\s*)*["'`]((?:\.{1,2}\/)*[A-Za-z0-9._/-]+\.(?:json|csv|xml|gz))["'`]/gm;
  for (const match of source.matchAll(pattern)) map.set(match[1], normalise(match[2]));
  return map;
}

function classify(source, artifact, constants) {
  // Match on the bare name so "../data/x.json" and "data/x.json" both count.
  const names = [artifact, artifact.split("/").pop()];
  for (const [name, value] of constants) if (value === artifact) names.push(name);

  let reads = false;
  let writes = false;
  for (const line of source.split("\n")) {
    const mentions = names.some((name) => line.includes(name));
    if (!mentions) continue;
    if (WRITE_HINTS.some((hint) => hint.test(line))) writes = true;
    else if (READ_HINTS.some((hint) => hint.test(line))) reads = true;
  }
  return { reads, writes };
}

async function transformFiles() {
  const found = [];
  for (const dir of DIRS) {
    let entries;
    try {
      entries = await readdir(path.join(ROOT, dir));
    } catch {
      continue;
    }
    for (const name of entries) {
      if (/\.(mjs|py)$/.test(name) && !name.startsWith("validate-")) found.push(`${dir}/${name}`);
    }
  }
  return found.sort();
}

// npm scripts are the only declared entry points; a transform absent from all of them has
// no documented way to be run.
const packageScripts = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).scripts || {};
const referenced = new Set();
for (const command of Object.values(packageScripts)) {
  for (const match of command.matchAll(/(?:scripts|pipeline\/transforms)\/[\w.-]+\.(?:mjs|py)/g)) referenced.add(match[0]);
}

const transforms = [];
const producedBy = new Map();
const consumedBy = new Map();

for (const file of await transformFiles()) {
  let source;
  try {
    source = await readFile(path.join(ROOT, file), "utf8");
  } catch {
    continue;
  }
  const constants = constantPaths(source);
  const artifacts = new Set([...source.matchAll(ARTIFACT)].map((m) => normalise(m[1])));
  for (const value of constants.values()) if (/^(data|lib\/data|pipeline\/config)\//.test(value)) artifacts.add(value);

  const inputs = [];
  const outputs = [];
  for (const artifact of [...artifacts].sort()) {
    const { reads, writes } = classify(source, artifact, constants);
    if (writes) outputs.push(artifact);
    else if (reads) inputs.push(artifact);
  }

  for (const artifact of outputs) {
    if (!producedBy.has(artifact)) producedBy.set(artifact, []);
    producedBy.get(artifact).push(file);
  }
  for (const artifact of inputs) {
    if (!consumedBy.has(artifact)) consumedBy.set(artifact, []);
    consumedBy.get(artifact).push(file);
  }

  transforms.push({ transform: file, npm_entry_point: referenced.has(file), inputs, outputs });
}

/** What goes stale, transitively, if this artifact changes. */
function impactOf(artifact) {
  const seen = new Set();
  const order = [];
  const queue = [artifact];
  while (queue.length) {
    const current = queue.shift();
    for (const transform of consumedBy.get(current) || []) {
      const entry = transforms.find((t) => t.transform === transform);
      for (const output of entry?.outputs || []) {
        if (seen.has(output)) continue;
        seen.add(output);
        order.push({ artifact: output, rebuilt_by: transform });
        queue.push(output);
      }
    }
  }
  return order;
}

if (impactTarget) {
  const chain = impactOf(impactTarget);
  console.log(`Changing ${impactTarget} invalidates ${chain.length} artifact(s):\n`);
  for (const step of chain) console.log(`  ${step.artifact.padEnd(52)} <- ${step.rebuilt_by}`);
  if (!chain.length) console.log("  nothing — no transform declares it as an input");
  process.exit(0);
}

const orphaned = transforms.filter((t) => !t.npm_entry_point);
const unproduced = [...consumedBy.keys()].filter((a) => !producedBy.has(a)).sort();
const contested = [...producedBy].filter(([, list]) => new Set(list).size > 1);

console.log(`transforms:            ${transforms.length}`);
console.log(`  with an npm entry:   ${transforms.length - orphaned.length}`);
console.log(`  no declared entry:   ${orphaned.length}`);
console.log(`artifacts produced:    ${producedBy.size}`);
console.log(`artifacts consumed:    ${consumedBy.size}`);
console.log(`  consumed but never produced here: ${unproduced.length} (external inputs, or produced out of repo)`);
console.log(`  written by more than one transform: ${contested.length}`);
for (const [artifact, list] of contested.slice(0, 8)) {
  console.log(`    ${artifact} <- ${[...new Set(list)].join(", ")}`);
}

if (!write) {
  console.log("\nReport only. Pass --write to emit the graph, or --impact <artifact>.");
  process.exit(0);
}

await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    registry: "transform-graph",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "Statically derived: each transform's inputs and outputs are read from the artifact "
        + "paths it references, not from running it. A transform with no npm entry point has no "
        + "documented way to be run; an artifact written by more than one transform has no single "
        + "owner. Both are recorded rather than resolved here.",
    transform_count: transforms.length,
    without_entry_point: orphaned.map((t) => t.transform),
    contested_outputs: contested.map(([artifact, list]) => ({ artifact, written_by: [...new Set(list)] })),
    external_inputs: unproduced,
    transforms,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
