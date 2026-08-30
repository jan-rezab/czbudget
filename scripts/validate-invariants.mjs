#!/usr/bin/env node
/**
 * Invariants — B6 of the consolidated plan.
 *
 * This file holds relationships that must hold by construction. It deliberately contains
 * NO bare count literals: a rule here says "these two sets agree", never "there are N of
 * them". Counts belong to the artifacts they describe, not to a validator that has to be
 * edited in the same commit as the data.
 *
 * First invariant (seam S6): the chart slug rule from A1. A slug is a permanent public
 * identifier — an embed and a citation both resolve through it — so the build refuses a
 * chart that has none, and refuses two charts that share one.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const failures = [];
const fail = (rule, detail) => failures.push({ rule, detail });

async function handAuthoredFiles() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:js|html)$/.test(entry.name))
    .map((entry) => entry.name);
}

/**
 * Slugs declared in markup: <div class="chart-with-source" data-psd-chart="slug">.
 * A leading "[" means the same text is a CSS selector looking the attribute up, not a
 * declaration minting it — those are references and must not count as a second claim.
 */
function declaredInMarkup(source) {
  return [...source.matchAll(/(.?)data-psd-chart="([^"]*)"/g)]
    .filter((match) => match[1] !== "[")
    .map((match) => match[2]);
}

/**
 * A file that calls PSDChart.register mints slugs. They appear either as `slug: "x"` or,
 * where charts are registered from a table, as a bare literal in that table — so every
 * slug-shaped literal in a registering file counts as a registration.
 */
function registeredInCode(source) {
  if (!source.includes("PSDChart.register")) return [];
  return [...source.matchAll(/["']([a-z0-9]+(?:-[a-z0-9]+)+)["']/g)].map((match) => match[1]);
}

/**
 * Slugs a chart file explicitly claims via `slug: "x"` — the strict direction. Only files
 * that actually register charts are read; `slug` is an ordinary property name elsewhere.
 */
function claimedExplicitly(source) {
  if (!source.includes("PSDChart.register")) return [];
  return [...source.matchAll(/\bslug:\s*["']([^"']*)["']/g)].map((match) => match[1]);
}

/** Chart wrappers that carry no slug attribute at all. */
function unslugged(source) {
  return [...source.matchAll(/class="[^"]*chart-with-source[^"]*"[^>]*>/g)]
    .filter((match) => !/data-psd-chart=/.test(match[0])).length;
}

const files = await handAuthoredFiles();
const markup = new Map();
const code = new Map();
const claimed = new Map();

for (const file of files) {
  const source = await readFile(path.join(ROOT, file), "utf8");

  for (const slug of declaredInMarkup(source)) {
    if (!markup.has(slug)) markup.set(slug, []);
    markup.get(slug).push(file);
  }
  for (const slug of new Set(registeredInCode(source))) {
    if (!code.has(slug)) code.set(slug, []);
    code.get(slug).push(file);
  }
  for (const slug of claimedExplicitly(source)) {
    if (!claimed.has(slug)) claimed.set(slug, []);
    claimed.get(slug).push(file);
  }

  const missing = unslugged(source);
  if (missing > 0) {
    fail("every chart wrapper carries a slug", `${file}: ${missing} chart-with-source block(s) without data-psd-chart`);
  }
}

// 1. Every slug that is minted, in markup or by an explicit claim, is well formed.
for (const [slug, sources] of [...markup, ...claimed]) {
  if (!SLUG_PATTERN.test(slug)) {
    fail("slugs are lowercase words joined by hyphens", `"${slug}" in ${sources.join(", ")}`);
  }
}

// 2. No slug is minted twice. A duplicate silently steals another chart's citations.
for (const [slug, sources] of markup) {
  if (sources.length > 1) fail("a slug is minted once in markup", `"${slug}" in ${sources.join(", ")}`);
}

// 3. The two sides agree. Markup without a registration renders a chart with no rail;
//    an explicit claim with no markup points at nothing.
for (const slug of markup.keys()) {
  if (!code.has(slug)) fail("every slug in markup is registered in code", `"${slug}" declared in ${markup.get(slug).join(", ")}`);
}
for (const slug of claimed.keys()) {
  if (!markup.has(slug)) fail("every registered slug exists in markup", `"${slug}" registered in ${claimed.get(slug).join(", ")}`);
}

/**
 * Second invariant (B2): every country-shaped value in a published artifact resolves to the
 * entity registry, in the canonical form. This is what makes one BigQuery table possible —
 * the six spellings of the country dimension are why the file-based countries cannot load
 * alongside the warehouse ones today. Declared gaps are allowed and must stay declared.
 */
// Fields whose name implies the canonical form — these must carry alpha-3.
const CANONICAL_KEYS = new Set(["country_code", "iso3", "country", "alpha3", "cc"]);
// Fields whose name declares a non-canonical form — these must merely resolve.
const ALIAS_KEYS = new Set(["alpha2", "iso2"]);
const COUNTRY_KEYS = new Set([...CANONICAL_KEYS, ...ALIAS_KEYS]);
let registry = null;
try {
  registry = JSON.parse(await readFile(path.join(ROOT, "data/registry/countries.v1.json"), "utf8"));
} catch {
  fail("the entity registry exists", "data/registry/countries.v1.json is missing — run npm run build:country-registry");
}

if (registry) {
  const canonical = new Set(registry.countries.map((c) => c.canonical));
  const declaredGap = new Set((registry.known_gaps || []).flatMap((g) => g.values));
  const resolvable = new Set([
    ...canonical,
    ...registry.countries.flatMap((c) => Object.values(c.aliases).filter(Boolean)),
  ]);
  const offenders = new Map();

  // No depth cap and no array cap. This began as a sampler — depth > 6 and slice(0, 400) —
  // which made "56 of 57 artifacts canonical" a claim about the first 400 entries of shallow
  // top-level files, not about the data. A check that silently stops looking is worse than
  // no check, because it reports success.
  const inspect = (node, file) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) inspect(item, file);
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (COUNTRY_KEYS.has(key) && typeof value === "string" && /^[A-Za-z]{2,3}$/.test(value)) {
        const required = CANONICAL_KEYS.has(key) ? canonical : resolvable;
        if (!required.has(value) && !declaredGap.has(value)) {
          if (!offenders.has(file)) offenders.set(file, new Set());
          offenders.get(file).add(`${key}="${value}"`);
        }
      }
      inspect(value, file);
    }
  };

  // Recursive, and every .json — not just top-level *.v1.json. The old filter meant
  // data/entities/*.json (6,267 files, all carrying the same alpha-2 code) and the two
  // cz-*-2024.json files were invisible to a rule that claimed to cover the data directory.
  // The regenerable layers are skipped because they are hydrated, not authored here.
  const SKIP_DIRS = new Set(["municipal-expansion", "municipal-history", "public-entity-directory"]);

  async function jsonFiles(dir, prefix = "") {
    const found = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        found.push(...await jsonFiles(path.join(dir, entry.name), rel));
      } else if (entry.name.endsWith(".json") && rel !== "manifest.v1.json") {
        found.push(rel);
      }
    }
    return found;
  }

  const artifacts = (await jsonFiles(path.join(ROOT, "data"))).sort();

  for (const artifact of artifacts) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path.join(ROOT, "data", artifact), "utf8"));
    } catch {
      continue;
    }
    inspect(parsed, artifact);
  }

  /**
   * Ratchet, not a cliff. The artifacts below are known to emit alpha-2 in a field whose
   * name implies alpha-3; each is a producer fix, not a data edit, and they are listed in
   * the registry so the debt is visible and countable. They warn. Anything NOT on the list
   * fails the build, so no new drift can enter while the migration is scheduled.
   */
  const pending = new Set(registry.pending_migration || []);
  let warned = 0;

  for (const [file, values] of [...offenders].sort()) {
    const shown = [...values].sort().slice(0, 6).join(", ");
    const more = values.size > 6 ? ` (+${values.size - 6} more)` : "";
    if (pending.has(file)) {
      console.warn(`  ! pending B2 migration — ${file}: ${shown}${more}`);
      warned += 1;
    } else {
      fail("every country value resolves to the registry in canonical form", `${file}: ${shown}${more}`);
    }
  }

  const clean = artifacts.length - offenders.size;
  console.log(`Country dimension: ${clean} of ${artifacts.length} artifacts canonical, ${warned} pending migration (${canonical.size} countries registered).`);
  for (const stale of [...pending].filter((f) => !offenders.has(f)).sort()) {
    fail("the pending-migration list holds only artifacts that are still failing", `${stale} is listed but now resolves — remove it from the registry`);
  }
}

/**
 * Third invariant (A5 + B5): no translation key carries a digit. Not a ceiling — zero.
 *
 * These dictionaries key English strings off whole Czech strings. A number inside such a key
 * is an uncontrolled second copy of a figure that also lives in a data artifact: the moment
 * the data moved, the key stopped matching and the English page silently rendered Czech —
 * no error, no failing test, no way to notice but by reading the page.
 *
 * Keys now carry a {n} placeholder and the figure is formatted at render for the target
 * locale. Any value matches, so the translation cannot rot when the data changes.
 */
const I18N_FILES = ["budget-i18n.js", "cesko-i18n.js"];
const DIGIT_KEY_CEILING = 0;

let digitKeys = 0;
const digitSamples = [];
for (const file of I18N_FILES) {
  let source;
  try {
    source = await readFile(path.join(ROOT, file), "utf8");
  } catch {
    continue;
  }
  for (const match of source.matchAll(/"((?:[^"\\]|\\.){3,})"\s*:\s*"(?:[^"\\]|\\.)*"/g)) {
    if (/\d/.test(match[1])) {
      digitKeys += 1;
      if (digitSamples.length < 3) digitSamples.push(`${file}: "${match[1].slice(0, 54)}"`);
    }
  }
}

if (digitKeys > DIGIT_KEY_CEILING) {
  fail(
    "no translation key carries a digit",
    `${digitKeys} key(s) contain a digit. Use a {n} placeholder so the figure is formatted ` +
    `at render instead of frozen into the key. e.g. ${digitSamples[0]}`,
  );
} else {
  console.log(`Translation keys: none carry a digit; figures render through {n} placeholders.`);
}

if (failures.length > 0) {
  console.error("Invariant violations:\n");
  for (const { rule, detail } of failures) console.error(`  ✗ ${rule}\n      ${detail}`);
  console.error(`\n${failures.length} violation(s).`);
  process.exit(1);
}

console.log(`Invariants hold. ${markup.size} chart slug(s) agree between markup and code.`);
