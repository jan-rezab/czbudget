import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const websiteRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(process.env.CZBUDGET_WORKSPACE_ROOT || path.join(websiteRoot, ".."));
const manifestPath = path.join(websiteRoot, "pipeline", "source-assets.manifest.json");
const verify = process.argv.includes("--verify");
const selfCheck = process.argv.includes("--self-check");

// Raw inputs live outside the published repo and are far too numerous to list one
// row per file: the two roots below hold ~16,000 files / ~3.5 GiB, dominated by
// three country-partitioned crawl trees. Entries are therefore per-file down to
// GROUP_DEPTH levels below a root; every directory at exactly GROUP_DEPTH is
// folded into a single tree digest ("<dir>/**"). That keeps the manifest at a
// couple of hundred reviewable rows while still making any byte change anywhere
// under the roots flip a hash. It mirrors the tree-digest rows that
// scripts/create-release-manifest.mjs already uses for data/entities/*.json.
const roots = ["data/source_cache", "data/sources"];

/**
 * A directory being actively written cannot be described by a manifest, and demanding that it
 * hold still means one session's download blocks another session's push. A crawl adding three
 * files every thirty seconds moved this hash on every regeneration; the gate rehashes after
 * running the test suite, so the window was never small enough to win.
 *
 * A writer therefore declares itself: `touch data/sources/<group>/.in-flight` before it starts,
 * and removes the file when the batch is complete. A group holding that marker is recorded as
 * in flight rather than hashed, and verification passes over it — loudly. Nothing is silently
 * unverified: the marker's own age is reported, so a forgotten one is visible rather than
 * quietly eroding what the manifest claims.
 */
const IN_FLIGHT_MARKER = ".in-flight";
const GROUP_DEPTH = 2;
const HASH_CONCURRENCY = 8;

// Crawler scratch that sits next to real downloads. Hashing it guarantees the
// manifest rots on the next pipeline run, so it is deliberately out of scope:
//   .*           dotfiles, incl. the .request-rate.{lock,timestamp} rate limiter state
//   *.part       partial downloads from Context.download()
//   "name 2.ext" macOS duplicate-on-copy artefacts
//   *.sqlite3-wal, -shm, -journal
//                SQLite sidecars. A write-ahead log is rewritten whenever the database is
//                opened, so hashing one records a value that is wrong by the next read — the
//                opposite of what a manifest is for.
//   *.sqlite3    only while a -wal sits beside it. A database with a live write-ahead log is
//                mid-transaction, not an artifact at rest: a crawl running in another session
//                moved this hash three times in five minutes and no regeneration could land.
//                Once the crawl ends and its log is checkpointed away, the database is hashed
//                again like any other file. What the crawler *produces* is never excluded.
const ignoredName = (name, siblings) => name.startsWith(".")
  || (/\.(?:sqlite3?|db)$/.test(name) && siblings?.has(`${name}-wal`))
  || name.endsWith(".part")
  || /\.(?:sqlite3?|db)-(?:wal|shm|journal)$/.test(name)
  || / \d+(\.[^./]+)?$/.test(name);

const relative = (target) => path.relative(workspaceRoot, target).split(path.sep).join("/");

function fileDigest(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

async function mapPool(items, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(HASH_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

async function filesBelow(directory) {
  const output = [];
  const listing = await readdir(directory, { withFileTypes: true });
  const siblings = new Set(listing.map((entry) => entry.name));
  for (const entry of listing) {
    if (ignoredName(entry.name, siblings)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

async function fileEntry(file) {
  const metadata = await stat(file);
  return { path: relative(file), bytes: metadata.size, sha256: await fileDigest(file) };
}

// Tree digest = sha256 over sorted "<path relative to the tree>\0<file sha256>\n"
// lines, so it is reproducible without depending on read order or file sizes.
async function treeEntry(directory) {
  const files = (await filesBelow(directory)).sort();
  const hashed = await mapPool(files, async (file) => ({
    name: path.relative(directory, file).split(path.sep).join("/"),
    bytes: (await stat(file)).size,
    sha256: await fileDigest(file),
  }));
  const digest = createHash("sha256");
  for (const item of hashed) digest.update(item.name).update("\0").update(item.sha256).update("\n");
  return {
    path: `${relative(directory)}/**`,
    files: hashed.length,
    bytes: hashed.reduce((sum, item) => sum + item.bytes, 0),
    sha256: digest.digest("hex"),
  };
}

/** Whether this directory has declared itself mid-write. */
async function inFlightSince(directory) {
  try {
    const info = await stat(path.join(directory, IN_FLIGHT_MARKER));
    return info.mtime.toISOString();
  } catch {
    return null;
  }
}

async function collect(directory, level) {
  const listing = await readdir(directory, { withFileTypes: true });
  const siblings = new Set(listing.map((entry) => entry.name));
  const children = listing
    .filter((entry) => !ignoredName(entry.name, siblings) && (entry.isFile() || entry.isDirectory()))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const entries = [];
  for (const child of children) {
    const target = path.join(directory, child.name);
    if (child.isFile()) { entries.push(await fileEntry(target)); continue; }
    // A directory that has declared itself mid-write is recorded, not hashed. Hashing it would
    // produce a value that is wrong before the command that wrote it returns.
    const since = await inFlightSince(target);
    if (since) {
      entries.push({ path: `${relative(target)}/**`, in_flight_since: since });
      continue;
    }
    if (level < GROUP_DEPTH) entries.push(...await collect(target, level + 1));
    else entries.push(await treeEntry(target));
  }
  return entries;
}

function summarise(assets) {
  return {
    schema_version: "2.0.0",
    algorithm: "sha256",
    grouping: {
      roots,
      per_file_depth: GROUP_DEPTH,
      aggregate_suffix: "/**",
      tree_digest: "sha256 over sorted \"<path relative to the tree>\\0<file sha256>\\n\" lines",
      ignored: [".*", "*.part", "*.sqlite3-{wal,shm,journal}",
                "*.sqlite3 while a -wal sits beside it", "* <n>.<ext> (macOS duplicates)"],
    },
    entry_count: assets.length,
    asset_count: assets.reduce((sum, item) => sum + (item.files ?? 1), 0),
    total_bytes: assets.reduce((sum, item) => sum + (item.bytes ?? 0), 0),
    in_flight: assets.filter((item) => item.in_flight_since)
      .map((item) => ({ path: item.path, since: item.in_flight_since })),
    assets,
  };
}

function report(expected, actual) {
  const expectedByPath = new Map(expected.assets.map((item) => [item.path, item]));
  const actualByPath = new Map(actual.assets.map((item) => [item.path, item]));
  const lines = [];
  for (const [key, item] of actualByPath) {
    const previous = expectedByPath.get(key);
    if (!previous) lines.push(`  + ${key} (${item.bytes} bytes)`);
    else if (previous.sha256 !== item.sha256 || previous.bytes !== item.bytes || previous.files !== item.files) lines.push(`  ~ ${key} (${previous.sha256.slice(0, 12)} -> ${item.sha256.slice(0, 12)})`);
  }
  for (const key of expectedByPath.keys()) if (!actualByPath.has(key)) lines.push(`  - ${key}`);
  return lines;
}

async function build() {
  for (const root of roots) {
    const target = path.join(workspaceRoot, root);
    try {
      if (!(await stat(target)).isDirectory()) throw new Error("not a directory");
    } catch {
      console.error(`Source root missing: ${target}`);
      console.error("Raw inputs are kept outside the repo. Set CZBUDGET_WORKSPACE_ROOT to the workspace that holds data/source_cache and data/sources.");
      process.exit(2);
    }
  }
  const assets = (await Promise.all(roots.map((root) => collect(path.join(workspaceRoot, root), 1)))).flat();
  return summarise(assets);
}

// --self-check validates the committed manifest on its own terms and needs no raw
// inputs, so CI (which never has the 3.5 GiB source roots) can still gate on it.
if (selfCheck) {
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));
  const problems = [];
  if (expected.schema_version !== "2.0.0") problems.push(`Unexpected schema_version ${expected.schema_version}`);
  if (expected.algorithm !== "sha256") problems.push(`Unexpected algorithm ${expected.algorithm}`);
  if (!Array.isArray(expected.assets) || !expected.assets.length) problems.push("Manifest records no assets");
  const paths = new Set();
  let bytes = 0;
  let files = 0;
  for (const item of expected.assets ?? []) {
    if (paths.has(item.path)) problems.push(`Duplicate manifest entry ${item.path}`);
    paths.add(item.path);
    if (!roots.some((root) => item.path === root || item.path.startsWith(`${root}/`))) problems.push(`Entry outside the declared source roots: ${item.path}`);
    if (!/^[0-9a-f]{64}$/.test(item.sha256 ?? "")) problems.push(`Malformed sha256 for ${item.path}`);
    if (!Number.isInteger(item.bytes) || item.bytes < 0) problems.push(`Malformed byte count for ${item.path}`);
    if (item.path.endsWith("/**") && !Number.isInteger(item.files)) problems.push(`Tree entry without a file count: ${item.path}`);
    bytes += item.bytes ?? 0;
    files += item.files ?? 1;
  }
  if (bytes !== expected.total_bytes) problems.push(`total_bytes ${expected.total_bytes} does not match the sum of entries ${bytes}`);
  if (files !== expected.asset_count) problems.push(`asset_count ${expected.asset_count} does not match the sum of entries ${files}`);
  if (expected.assets?.length !== expected.entry_count) problems.push(`entry_count ${expected.entry_count} does not match ${expected.assets?.length} entries`);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`Source asset manifest self-check failed with ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`Source asset manifest self-check passed: ${expected.entry_count} entries covering ${expected.asset_count} files (${expected.total_bytes} bytes)`);
} else if (verify) {
  const manifest = await build();
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));

  // A group that is mid-write on either side is compared on identity, not on bytes: it is
  // in flight, so there are no settled bytes to compare. Everything else is compared exactly.
  const inFlight = new Set([
    ...(manifest.in_flight || []).map((item) => item.path),
    ...(expected.in_flight || []).map((item) => item.path),
  ]);
  const settled = (payload) => ({
    ...payload,
    in_flight: undefined,
    assets: (payload.assets || []).filter((item) => !inFlight.has(item.path)),
    entry_count: undefined,
    asset_count: undefined,
    total_bytes: undefined,
  });

  if (JSON.stringify(settled(expected)) !== JSON.stringify(settled(manifest))) {
    console.error("Source assets differ from pipeline/source-assets.manifest.json");
    console.error(report(expected, manifest).filter((line) => ![...inFlight].some((p) => line.includes(p)))
      .slice(0, 50).join("\n") || "  (metadata differs; regenerate the manifest)");
    console.error("Regenerate with: node pipeline/create-source-manifest.mjs");
    process.exit(1);
  }

  const settledAssets = manifest.assets.filter((item) => !item.in_flight_since);
  console.log(`Verified ${settledAssets.length} settled entries covering `
    + `${settledAssets.reduce((sum, item) => sum + (item.files ?? 1), 0)} source files`);
  for (const item of manifest.in_flight || []) {
    const age = Math.round((Date.now() - Date.parse(item.since)) / 60000);
    console.log(`  in flight, not verified: ${item.path} (declared ${age} min ago)`);
  }
  if ((manifest.in_flight || []).some((item) => Date.now() - Date.parse(item.since) > 12 * 3600 * 1000)) {
    console.log("  a marker older than twelve hours is probably a forgotten one — remove it to "
      + "bring that group back under verification.");
  }
} else {
  const manifest = await build();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Recorded ${manifest.entry_count} entries covering ${manifest.asset_count} source files (${manifest.total_bytes} bytes)`);
}
