#!/usr/bin/env node
/**
 * The data-layer manifest — B1, pointed at the right input.
 *
 * Hashes the raw and uniform layers so they can leave the machine safely and be proved
 * identical afterwards, and records the serving layer so that dropping it from git is
 * reversible by regeneration rather than by refetching.
 *
 * The manifest is committed. That is the point: once the fan-out stops being committed, the
 * hash in git is what still proves which bytes a given build served.
 *
 *   node scripts/build-layer-manifest.mjs --report
 *   node scripts/build-layer-manifest.mjs --release 2026-08-30
 *   node scripts/build-layer-manifest.mjs --release <id> --layers raw,uniform
 *
 * Reads only. Never deletes, never uploads, never touches git.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = process.env.SITE_ROOT || process.cwd();
const PARENT = path.dirname(REPO);
const CONFIG = "pipeline/config/data_layers.json";
const OUT = "data/manifest.v1.json";

const args = process.argv.slice(2);
const reportOnly = args.includes("--report");
const releaseAt = args.indexOf("--release");
const releaseID = releaseAt >= 0 ? args[releaseAt + 1] : null;
const layersAt = args.indexOf("--layers");
const only = layersAt >= 0 ? new Set(args[layersAt + 1].split(",")) : null;

if (!reportOnly && !releaseID) {
  console.error("Pass --report to measure, or --release <id> to write the manifest.");
  process.exit(2);
}

const sha256File = (file) => new Promise((resolve, reject) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (c) => hash.update(c)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
});

async function walk(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // lock and rate-limit scratch files
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/** One row per group, so a country can be verified or re-fetched on its own. */
async function groupsFor(layer, base) {
  const groups = new Map();
  // A flat directory has no subdirectories to group by, so the whole layer is one group.
  if (layer.group_by === "flat") {
    return new Map([[path.basename(base), await walk(base)]]);
  }
  if (layer.group_by === "country-file") {
    for (const file of await walk(base)) {
      const key = path.basename(file).split("-shard-")[0].replace(/\.json$/, "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    }
    return groups;
  }
  let entries = [];
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return groups;
  }
  for (const entry of entries.filter((e) => e.isDirectory() && !e.name.startsWith("."))) {
    // Stored exactly as it appears on disk. Upper-casing it here and lower-casing it back
    // in the hydrate script put a different string into the path digest than the manifest
    // recorded, so every group hashed differently while its file count matched.
    groups.set(entry.name, await walk(path.join(base, entry.name)));
  }
  return groups;
}

/** Directory digest: hash of (relative path, file hash) pairs in a stable order. */
async function digestOf(files, base) {
  if (files.length === 1) return sha256File(files[0]);
  const rolling = createHash("sha256");
  for (const file of [...files].sort()) {
    rolling.update(path.relative(base, file));
    rolling.update(await sha256File(file));
  }
  return rolling.digest("hex");
}

const config = JSON.parse(await readFile(path.join(REPO, CONFIG), "utf8"));
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const layers = [];

for (const layer of config.layers) {
  if (only && !only.has(layer.id)) continue;
  const base = path.join(layer.root === "parent" ? PARENT : REPO, layer.path);
  try {
    await stat(base);
  } catch {
    console.warn(`  layer "${layer.id}" absent at ${base} — skipped`);
    continue;
  }

  const groups = await groupsFor(layer, base);
  const entries = [];
  let bytes = 0;
  let files = 0;

  for (const [key, groupFiles] of [...groups].sort()) {
    let groupBytes = 0;
    for (const file of groupFiles) groupBytes += (await stat(file)).size;
    entries.push({
      group: key,
      file_count: groupFiles.length,
      bytes: groupBytes,
      sha256: await digestOf(groupFiles, base),
    });
    bytes += groupBytes;
    files += groupFiles.length;
  }

  layers.push({
    id: layer.id,
    path: layer.path,
    root: layer.root,
    // The hydrate script reads this back to know how to find each group on disk. Omitting it
    // made every layer look flat-or-subdirectory, so country-file layers verified against a
    // path that does not exist.
    group_by: layer.group_by,
    durability: layer.durability,
    committed: layer.committed,
    file_count: files,
    bytes,
    entries,
  });

  console.log(`\n${layer.id.padEnd(8)} ${String(files).padStart(7)} files  ${mb(bytes).padStart(10)}  ${layer.durability}`);
  for (const entry of entries) {
    console.log(`  ${entry.group.padEnd(6)} ${String(entry.file_count).padStart(7)} ${mb(entry.bytes).padStart(10)}  ${entry.sha256.slice(0, 16)}`);
  }
}

const totalBytes = layers.reduce((sum, l) => sum + l.bytes, 0);
const totalFiles = layers.reduce((sum, l) => sum + l.file_count, 0);
console.log(`\ntotal    ${String(totalFiles).padStart(7)} files  ${mb(totalBytes).padStart(10)}`);

for (const gap of config.known_gaps || []) console.log(`\n  gap (${gap.layer}): ${gap.detail}`);

if (reportOnly) {
  console.log("\nReport only. Nothing written.");
  process.exit(0);
}

await writeFile(
  path.join(REPO, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    release_id: releaseID,
    generated_at: new Date().toISOString(),
    total_bytes: totalBytes,
    total_file_count: totalFiles,
    layers,
    known_gaps: config.known_gaps || [],
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT} for release ${releaseID}.`);
