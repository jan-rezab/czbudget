#!/usr/bin/env node
/**
 * The process log — the public record of how data reached this site and production.
 *
 * The ingestion spine records one run per fetch: what arrived, what the checks found, what a
 * second derivation said, and who let it through. None of that exists yet for any source. What
 * does exist is the evidence three registries already hold — when a warehouse source edition was
 * loaded, when an artifact's sources were retrieved, and which transforms write which artifacts.
 *
 * This builds the log out of that evidence and labels every row `backfilled`, because a row
 * reconstructed from a load date is a weaker claim than a row written by a run that happened.
 * When the spine lands, its runs enter the same file as `spine` rows and the page stops being
 * mostly grey. The point is that the surface exists and states its own coverage, the same way
 * the provenance registry made a missing vintage countable rather than absent.
 *
 * Sections are derived, not declared: an artifact is walked back to the HTML routes that load it,
 * directly or through a script the page includes. A run therefore says where on the site its data
 * actually landed, and a reader can go look.
 *
 *   node scripts/build-run-log.mjs           # report
 *   node scripts/build-run-log.mjs --write   # write data/registry/run-log.v1.json
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const OUT = "data/registry/run-log.v1.json";
const write = process.argv.includes("--write");

const readJSON = async (p) => JSON.parse(await readFile(path.join(ROOT, p), "utf8"));
const tryJSON = async (p) => { try { return await readJSON(p); } catch { return null; } };

/* ---------------------------------------------------------------- sections */
/* An artifact is reachable from a page either directly or via a script the page includes. Only
   routes a reader can open count: an HTML file becomes its directory route. */

const SKIP_DIRS = new Set(["node_modules", "dist", "test-results", "tests", "scripts", "pipeline", "archives", "studio"]);
const DATA_REF = /["'`/]data\/([A-Za-z0-9_./-]+\.json)/g;
/* Many payloads are fetched from a path built at runtime -- `data/czech-project-geography/${id}/
   manifest.json`. A literal scan never sees those, so a directory reference claims every artifact
   beneath it. That over-claims where one page reads one file of a large directory, which is the
   right way to be wrong here: a section link that is too broad is checkable, a missing one is not. */
const DATA_DIR_REF = /["'`/]data\/([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)\//g;
/* Every script tag on this site carries a cache-busting query -- `country.js?v=20260901-a`. The
   suffix has to be optional in the pattern or the include graph never leaves the HTML file. */
const SCRIPT_SRC = /<script[^>]+src=["']\/?([A-Za-z0-9_./-]+\.m?js)(?:\?[^"']*)?["']/g;
const IMPORT_REF = /(?:from|import)\s*["'](\.{1,2}\/[A-Za-z0-9_./-]+\.m?js)(?:\?[^"']*)?["']/g;

async function sourceFiles(dir = ".") {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const rel = path.posix.join(dir === "." ? "" : dir, entry.name);
    if (entry.isDirectory()) out.push(...await sourceFiles(rel));
    else if (/\.(html|js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** `cz/mesta/index.html` -> `/cz/mesta/`; `country.html` -> `/country.html`. */
const routeOf = (file) =>
  file.endsWith("/index.html") ? "/" + file.slice(0, -"index.html".length)
  : file === "index.html" ? "/"
  : "/" + file;

async function buildSectionIndex() {
  const files = await sourceFiles();
  const dataRefs = new Map();   // file -> Set(artifact)
  const dirRefs = new Map();    // file -> Set("data/dir")
  const scriptRefs = new Map(); // file -> Set(js file it pulls in)
  for (const file of files) {
    const text = await readFile(path.join(ROOT, file), "utf8").catch(() => "");
    const arts = new Set();
    for (const m of text.matchAll(DATA_REF)) arts.add("data/" + m[1]);
    if (arts.size) dataRefs.set(file, arts);
    const dirs = new Set();
    for (const m of text.matchAll(DATA_DIR_REF)) dirs.add("data/" + m[1]);
    if (dirs.size) dirRefs.set(file, dirs);
    const scripts = new Set();
    if (file.endsWith(".html")) for (const m of text.matchAll(SCRIPT_SRC)) scripts.add(m[1].replace(/^\//, ""));
    for (const m of text.matchAll(IMPORT_REF)) {
      scripts.add(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
    }
    if (scripts.size) scriptRefs.set(file, scripts);
  }
  /* A page reaches an artifact through however many modules it takes. Walk the include graph to a
     fixed point rather than one hop, or every page that splits its loader into a module loses its
     sections. */
  const reach = (file, seen = new Set()) => {
    if (seen.has(file)) return { arts: new Set(), dirs: new Set() };
    seen.add(file);
    const arts = new Set(dataRefs.get(file) || []);
    const dirs = new Set(dirRefs.get(file) || []);
    for (const next of scriptRefs.get(file) || []) {
      const deeper = reach(next, seen);
      for (const a of deeper.arts) arts.add(a);
      for (const d of deeper.dirs) dirs.add(d);
    }
    return { arts, dirs };
  };
  // artifact -> routes
  const index = new Map();
  const add = (artifact, route) => {
    if (!index.has(artifact)) index.set(artifact, new Set());
    index.get(artifact).add(route);
  };
  const prefixes = new Map(); // "data/dir" -> Set(route)
  for (const file of files) {
    if (!file.endsWith(".html")) continue;
    const route = routeOf(file);
    const { arts, dirs } = reach(file);
    for (const a of arts) add(a, route);
    for (const d of dirs) {
      if (!prefixes.has(d)) prefixes.set(d, new Set());
      prefixes.get(d).add(route);
    }
  }
  return { index, prefixes };
}

/* A warehouse source edition names no artifact, but it does name a country, and the generated
   country pages declare which country they are. That is the honest link between the two. */
async function countryRoutes() {
  const routes = new Map();
  const dirs = await readdir(path.join(ROOT, "municipalities"), { withFileTypes: true }).catch(() => []);
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const html = await readFile(path.join(ROOT, "municipalities", dir.name, "index.html"), "utf8").catch(() => "");
    const code = html.match(/data-country-code="([A-Z]{3})"/)?.[1];
    if (code) routes.set(code, `/municipalities/${dir.name}/`);
  }
  return routes;
}

/* -------------------------------------------------------------- provenance */

async function provenanceByArtifact() {
  const registry = await tryJSON("data/registry/source-provenance.v1.json");
  const byArtifact = new Map();
  if (!registry) return byArtifact;
  for (const shard of registry.shards || []) {
    const raw = await readFile(path.join(ROOT, shard.path.replace(/^\//, ""))).catch(() => null);
    if (!raw) continue;
    for (const record of JSON.parse(gunzipSync(raw).toString("utf8")).records || []) {
      const when = record.retrieved_at || record.extracted;
      if (!when) continue;
      for (const artifact of record.artifacts || []) {
        if (!byArtifact.has(artifact)) byArtifact.set(artifact, []);
        byArtifact.get(artifact).push({
          when, url: record.url || null,
          provider: record.provider || record.title || null,
          checksum: Boolean(record.checksum),
        });
      }
    }
  }
  return byArtifact;
}

const day = (value) => String(value).slice(0, 10);

/** The country an artifact is about, where it says so. */
async function countryOf(artifact) {
  const payload = await tryJSON(artifact);
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.country_code === "string") return payload.country_code;
  const m = artifact.match(/^data\/countries\/([A-Z]{3})\b/);
  return m ? m[1] : null;
}

/* --------------------------------------------------------------------- run */

const runs = [];
const { index: sections, prefixes } = await buildSectionIndex();
/** The routes that read this artifact, by name or by the directory it sits in. */
const routesFor = (artifacts) => {
  const out = new Set();
  for (const a of artifacts) {
    for (const r of sections.get(a) || []) out.add(r);
    for (const [dir, routes] of prefixes) {
      if (a.startsWith(dir + "/")) for (const r of routes) out.add(r);
    }
  }
  return [...out].sort();
};

// 1. Warehouse source editions. These carry a country and a load date.
const vintages = await tryJSON("data/registry/source-vintages.v1.json");
const byCountry = await countryRoutes();
for (const source of vintages?.sources || []) {
  const route = byCountry.get(source.country_code);
  runs.push({
    run_id: `${source.source_id}@${source.loaded}`,
    event_type: "ingestion",
    record_kind: "backfilled",
    evidence: "warehouse load record",
    date: source.loaded,
    source_id: source.source_id,
    publisher: source.publisher || null,
    country_codes: [source.country_code],
    edition: source.edition,
    covers: source.covers,
    volume: { facts: source.facts, entities: source.entities },
    artifacts: [],
    sections: route ? [route] : [],
    outcome: "published",
    approver: null,
  });
}

// 2. Dated source retrievals. Grouped by publisher and day, not by artifact and day: a harvest
//    that writes one file per project is one run, and listing it as 600 identical rows buries
//    every run that matters. The key is the dataset, not the declared provider: a lot of declared
//    titles are per-file catalogue entries ("Vycet konsolidovanych jednotek statu 2016 (3 995,50
//    kB)") which would split one publication into a row per year. The provider is kept as a label
//    where every record in the group agrees on one.
const byArtifact = await provenanceByArtifact();
const countryCache = new Map();

/** `data/czech-project-geography/rsd-network-16/manifest.json` -> `czech-project-geography`. */
const datasetOf = (artifact) => {
  const rest = artifact.replace(/^data\//, "");
  return rest.includes("/") ? rest.split("/")[0] : path.basename(rest, ".json").replace(/\.v1$/, "");
};

const grouped = new Map();
for (const [artifact, records] of byArtifact) {
  if (!countryCache.has(artifact)) countryCache.set(artifact, await countryOf(artifact));
  for (const record of records) {
    const date = day(record.when);
    const dataset = datasetOf(artifact);
    const key = `${dataset}@${date}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        date, dataset, providers: new Set(),
        artifacts: new Set(), countries: new Set(), sourceUrls: new Set(), objects: 0, checksums: 0,
      });
    }
    const group = grouped.get(key);
    if (record.provider) group.providers.add(record.provider);
    if (record.url) group.sourceUrls.add(record.url);
    group.artifacts.add(artifact);
    group.objects += 1;
    if (record.checksum) group.checksums += 1;
    const country = countryCache.get(artifact);
    if (country) group.countries.add(country);
  }
}

for (const [key, group] of grouped) {
  const artifacts = [...group.artifacts].sort();
  const publisher = group.providers.size === 1 ? [...group.providers][0] : null;
  runs.push({
    run_id: key,
    event_type: "ingestion",
    record_kind: "backfilled",
    evidence: "declared source retrieval",
    date: group.date,
    source_id: group.dataset,
    publisher,
    publisher_count: group.providers.size,
    source_urls: [...group.sourceUrls].sort().slice(0, 12),
    country_codes: [...group.countries].sort(),
    edition: null,
    covers: null,
    volume: { objects: group.objects, with_checksum: group.checksums, artifacts: artifacts.length },
    artifacts: artifacts.slice(0, 12),
    artifact_count: artifacts.length,
    sections: routesFor(artifacts),
    outcome: "published",
    approver: null,
  });
}

// A release manifest is the boundary between generated data and an application image. Older
// manifests can predate this ledger, so absent build metadata stays null instead of being guessed.
const committedRelease = await tryJSON("data/release-manifest.v1.json");
const release = process.env.COMMIT_SHA && process.env.BUILD_ID
  ? { ...committedRelease, git_commit: process.env.COMMIT_SHA, cloud_build_id: process.env.BUILD_ID, data_generated_at: new Date().toISOString(), working_tree_dirty: false }
  : committedRelease;
if (release?.git_commit && release?.data_generated_at) {
  const releaseId = release.cloud_build_id
    ? `${release.git_commit}-${release.cloud_build_id}`
    : `manifest-${release.git_commit.slice(0, 12)}-${day(release.data_generated_at)}`;
  runs.push({
    run_id: `data-release:${releaseId}`,
    event_type: "data_release",
    record_kind: release.cloud_build_id ? "native" : "backfilled",
    evidence: "release manifest",
    date: day(release.data_generated_at),
    timestamp: release.data_generated_at,
    source_id: "site-data-release",
    publisher: "Public Spending Data",
    country_codes: [],
    edition: releaseId,
    covers: null,
    volume: { artifacts: release.artifacts?.length || 0 },
    artifacts: ["data/release-manifest.v1.json"],
    artifact_count: release.artifacts?.length || 0,
    sections: ["/methodology.html", "/process/log/"],
    outcome: "published",
    approver: null,
    data_release_ids: [releaseId, release.municipal_ingestion_run_id].filter(Boolean),
    git_sha: release.git_commit,
    cloud_build_id: release.cloud_build_id || null,
    working_tree_dirty: Boolean(release.working_tree_dirty),
  });
}

// These three states are deliberately independent. A retrieval is received;
// an artifact or warehouse fact proves processing; only a linked public route
// proves publication. The former `outcome: published` field is retained for
// schema compatibility but must not be used to imply that every retrieval is
// visible on the website.
for (const run of runs) {
  const processedVolume = Object.entries(run.volume || {})
    .some(([key, value]) => key !== "with_checksum" && Number(value) > 0);
  run.lifecycle = {
    received: run.event_type === "ingestion" ? true : null,
    processed: run.event_type === "ingestion" ? processedVolume : true,
    published: run.sections?.length > 0,
  };
}

runs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.run_id < b.run_id ? -1 : 1));

/* ------------------------------------------------------------------ facets */

const tally = (key) => {
  const counts = new Map();
  for (const run of runs) for (const value of [].concat(run[key] ?? [])) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([value, runs]) => ({ value, runs }));
};

const payload = {
  schema_version: "2.0.0",
  registry: "run-log",
  generated_at: new Date().toISOString(),
  note:
    "Ingestion and data-release events reconstructed from committed evidence. Deployment events " +
    "are append-only Cloud Build receipts returned by the live API. Missing checker, approver, PR " +
    "or build metadata is shown as not recorded and is never inferred.",
  coverage: {
    events: runs.length,
    ingestion_events: runs.filter((r) => r.event_type === "ingestion").length,
    data_release_events: runs.filter((r) => r.event_type === "data_release").length,
    deployment_events: 0,
    spine_runs: runs.filter((r) => r.record_kind === "spine").length,
    backfilled_runs: runs.filter((r) => r.record_kind === "backfilled").length,
    with_country: runs.filter((r) => r.country_codes.length).length,
    with_sections: runs.filter((r) => r.sections.length).length,
    with_checker_verdict: 0,
    with_challenger_verdict: 0,
    with_human_approver: 0,
    earliest: runs.at(-1)?.date ?? null,
    latest: runs[0]?.date ?? null,
  },
  facets: { countries: tally("country_codes"), sources: tally("source_id").slice(0, 60) },
  runs,
};
payload.content_hash = createHash("sha256").update(JSON.stringify(payload.runs)).digest("hex");

if (write) {
  await writeFile(path.join(ROOT, OUT), JSON.stringify(payload, null, 1) + "\n");
  console.log(`wrote ${OUT}`);
}
const c = payload.coverage;
console.log(`events ${c.events} · ingestion ${c.ingestion_events} · releases ${c.data_release_events} · ${c.earliest} to ${c.latest}`);
console.log(`spine runs ${c.spine_runs} · backfilled ${c.backfilled_runs}`);
