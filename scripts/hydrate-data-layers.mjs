#!/usr/bin/env node
/**
 * Hydrate the uncommitted data layers — the other half of B1.
 *
 * Once a layer stops being committed, every consumer that used to get it from the git
 * checkout needs it from somewhere. The Dockerfile copies the working tree into the image,
 * so a build without this step would ship municipal pages whose data fetches all 404.
 *
 *   node scripts/hydrate-data-layers.mjs --layer serving        # what the build needs
 *   node scripts/hydrate-data-layers.mjs --layer serving --verify
 *   node scripts/hydrate-data-layers.mjs --all
 *
 * Verification compares what landed against data/manifest.v1.json, which stays committed
 * precisely so a build can prove it hydrated the bytes the release recorded.
 */
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const REPO = process.env.SITE_ROOT || process.cwd();
const MANIFEST = "data/manifest.v1.json";
const BUCKET = process.env.DATA_LAYER_BUCKET || "gs://czbudget-janrezab-data-layers";

const args = process.argv.slice(2);
const verify = args.includes("--verify");
const all = args.includes("--all");
const layerAt = args.indexOf("--layer");
const requested = layerAt >= 0 ? args[layerAt + 1] : null;

if (!all && !requested) {
  console.error("Pass --layer <id> or --all.");
  process.exit(2);
}

const manifest = JSON.parse(await readFile(path.join(REPO, MANIFEST), "utf8"));
const release = manifest.release_id;
const layers = manifest.layers.filter((l) => all || l.id === requested);

if (!layers.length) {
  console.error(`No layer matched. Known: ${manifest.layers.map((l) => l.id).join(", ")}`);
  process.exit(2);
}

const sha256File = (file) => new Promise((resolve, reject) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (c) => hash.update(c))
    .on("end", () => resolve(hash.digest("hex"))).on("error", reject);
});

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function digestOf(files, base) {
  if (files.length === 1) return sha256File(files[0]);
  const rolling = createHash("sha256");
  for (const file of [...files].sort()) {
    rolling.update(path.relative(base, file));
    rolling.update(await sha256File(file));
  }
  return rolling.digest("hex");
}

let failures = 0;

for (const layer of layers) {
  // Layers recorded relative to the parent workspace live outside the repo.
  const localBase = path.join(layer.root === "parent" ? path.dirname(REPO) : REPO, layer.path);
  const remote = `${BUCKET}/${release}/${layer.id}/${path.basename(layer.path)}`;

  console.log(`\n${layer.id}: ${remote}\n  -> ${localBase}`);

  if (!verify) {
    try {
      await run("gcloud", ["storage", "rsync", "-r", "--exclude=(^|.*/)\\..*", remote, localBase],
        { maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      console.error(`  download failed: ${error.message.split("\n")[0]}`);
      failures += 1;
      continue;
    }
  }

  // Compare what is on disk against the manifest, group by group.
  let checked = 0;
  for (const entry of layer.entries) {
    let files;
    if (layer.group_by === "flat") {
      // No subdirectories to group by: the whole layer is a single group.
      files = await walk(localBase);
    } else if (layer.group_by === "country-file") {
      files = (await walk(localBase)).filter((f) => {
        const name = path.basename(f).split("-shard-")[0].replace(/\.json$/, "");
        return name === entry.group;
      });
    } else {
      files = await walk(path.join(localBase, entry.group));
    }
    if (!files.length) {
      console.error(`  ✗ ${entry.group}: absent`);
      failures += 1;
      continue;
    }
    const digest = await digestOf(files, localBase);
    if (digest !== entry.sha256) {
      console.error(`  ✗ ${entry.group}: hash mismatch (${files.length} file(s) present, expected ${entry.file_count})`);
      failures += 1;
    } else {
      checked += 1;
    }
  }
  console.log(`  ${checked}/${layer.entries.length} group(s) match the manifest`);
}

if (failures) {
  console.error(`\n${failures} problem(s). The build must not proceed on unverified data.`);
  process.exit(1);
}
console.log(`\nHydrated and verified against release ${release}.`);
