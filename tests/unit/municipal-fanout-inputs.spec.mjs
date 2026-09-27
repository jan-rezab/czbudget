import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { fanoutRoot, requireFanoutRoot } from "../../scripts/lib/municipal-fanout.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const fixture = (relative) => gunzipSync(readFileSync(path.join(root, "tests/fixtures", relative)));

// One copy of the per-entity inputs, laid out as the hydrator writes them, under BASE
// (entities under ENTITIES, which defaults to BASE/entities).
function inputs(base, entities = path.join(base, "entities")) {
  const write = (relative, body) => {
    mkdirSync(path.dirname(path.join(base, relative)), { recursive: true });
    writeFileSync(path.join(base, relative), body);
  };
  for (const id of ["44992785", "00254398"]) {
    mkdirSync(entities, { recursive: true });
    writeFileSync(path.join(entities, `${id}.json`), fixture(`municipal-profiles/CZE-${id}.json.gz`));
    write(`data/municipal-history/${id}.json`, fixture(`municipal-history/${id}.json.gz`));
  }
  for (const [country, id] of [["nor", "0301"], ["nld", "0363"], ["fin", "091"]]) {
    write(`data/municipal-benchmarks/${country}/${id}.json`, fixture(`municipal-profiles/${country.toUpperCase()}-${id}.json.gz`));
  }
  return {
    MUNICIPAL_ENTITY_ROOT: entities,
    MUNICIPAL_HISTORY_ROOT: path.join(base, "data/municipal-history"),
    MUNICIPAL_BENCHMARK_ROOT: path.join(base, "data/municipal-benchmarks"),
  };
}

function build(env, output) {
  execFileSync(process.execPath, ["scripts/prepare-public-serving-snapshots.mjs", "--output", output, "--release-id", "identity-test",
    "--generated-at", "2026-09-27T00:00:00.000Z", "--shards", "16"], { cwd: root, env: { ...process.env, ...env }, stdio: "pipe" });
}

function files(directory, prefix = "") {
  return readdirSync(directory).sort().flatMap((name) => {
    const target = path.join(directory, name);
    return statSync(target).isDirectory() ? files(target, `${prefix}${name}/`) : [[`${prefix}${name}`, readFileSync(target)]];
  });
}

test("the fan-out resolver prefers an explicit root, and refuses one that does not hold the input", () => {
  const base = mkdtempSync(path.join(tmpdir(), "psd-fanout-resolve-"));
  try {
    const env = inputs(path.join(base, ".municipal-fanout"));
    assert.equal(fanoutRoot("municipal-history", base, {}), env.MUNICIPAL_HISTORY_ROOT);
    assert.equal(fanoutRoot("municipal-benchmarks", base, {}), env.MUNICIPAL_BENCHMARK_ROOT);
    mkdirSync(path.join(base, "empty"));
    assert.throws(() => fanoutRoot("municipal-history", base, { MUNICIPAL_HISTORY_ROOT: "empty" }), /does not hold/);
    assert.equal(fanoutRoot("municipal-history", path.join(base, "empty"), {}), null);
    assert.throws(() => requireFanoutRoot("municipal-benchmarks", path.join(base, "empty"), {}), /hydrate-municipal-fanout/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the published release is byte-identical wherever the same inputs are hydrated", () => {
  const base = mkdtempSync(path.join(tmpdir(), "psd-fanout-identity-"));
  try {
    // The entity and benchmark roots sort in opposite orders in the two layouts, so a build
    // that ordered sources by where they were hydrated would write a different staging file.
    build(inputs(path.join(base, "aaa"), path.join(base, "aaa", "zzz-entities")), path.join(base, "release-a"));
    build(inputs(path.join(base, "zzz", "elsewhere"), path.join(base, "zzz", "000-entities")), path.join(base, "release-b"));
    const a = files(path.join(base, "release-a"));
    const b = files(path.join(base, "release-b"));
    assert.deepEqual(a.map(([name]) => name), b.map(([name]) => name));
    for (const [index, [name, body]] of a.entries()) assert.ok(body.equals(b[index][1]), `${name} differs`);
    const manifest = JSON.parse(readFileSync(path.join(base, "release-a/releases/identity-test/manifest.v1.json"), "utf8"));
    assert.equal(manifest.profile_count, 5);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the snapshot build fails rather than publish without its history input", () => {
  const base = mkdtempSync(path.join(tmpdir(), "psd-fanout-missing-"));
  try {
    const env = inputs(base);
    mkdirSync(path.join(base, "no-history"));
    const result = spawnSync(process.execPath, ["scripts/prepare-public-serving-snapshots.mjs", "--output", path.join(base, "out")],
      { cwd: root, env: { ...process.env, ...env, MUNICIPAL_HISTORY_ROOT: path.join(base, "no-history") }, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not hold the municipal-history fan-out/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
