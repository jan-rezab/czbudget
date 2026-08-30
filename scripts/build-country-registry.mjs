#!/usr/bin/env node
/**
 * B2 — the country layer of the entity registry.
 *
 * One identity space that every artifact references. The country dimension is currently
 * spelled six different ways, and worse, the same key name means different things in
 * different files: `code` is a country in one artifact and a municipality in another,
 * `id` is a country in world-map and a category elsewhere.
 *
 * This builds a registry keyed on ISO alpha-3 (consolidated decision 3) that carries every
 * alias form actually in use, so migrating the other artifacts is mechanical rather than
 * manual — a codemod reads the alias table instead of a human reading 57 files.
 *
 *   node scripts/build-country-registry.mjs --report
 *   node scripts/build-country-registry.mjs --write
 *
 * The anchor set is sovereign-benchmark-slim, which already carries alpha-3, lowercase
 * alpha-2, both names and the currency for 195 sovereign states.
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const ANCHOR = "data/sovereign-benchmark-slim.v1.json";
const OUT = "data/registry/countries.v1.json";

const args = process.argv.slice(2);
const write = args.includes("--write");

/** Keys observed to carry a country dimension somewhere in the published set. */
const COUNTRY_KEYS = new Set(["country_code", "code", "iso3", "country", "id", "alpha2", "alpha3", "cc"]);

const anchor = JSON.parse(await readFile(path.join(ROOT, ANCHOR), "utf8"));

const byAlpha3 = new Map();
const alpha2ToAlpha3 = new Map();

for (const country of anchor.countries) {
  const alpha3 = String(country.country_code || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(alpha3)) continue;
  const alpha2 = String(country.iso2 || "").toUpperCase();
  byAlpha3.set(alpha3, {
    psd_id: `psd:country:${alpha3}`,
    canonical: alpha3,
    aliases: {
      alpha3,
      alpha2: alpha2 || null,
      alpha2_lower: alpha2 ? alpha2.toLowerCase() : null,
      weo: country.weo_country_code || null,
    },
    name: { cs: country.name_cs || null, en: country.name_en || null },
    currency: country.currency_code || null,
    observed_as: {},
  });
  if (alpha2) alpha2ToAlpha3.set(alpha2, alpha3);
}

/** Which alias form is this string, if any? */
function classify(value) {
  if (typeof value !== "string") return null;
  if (/^[A-Z]{3}$/.test(value) && byAlpha3.has(value)) return { alpha3: value, form: "alpha3" };
  if (/^[A-Z]{2}$/.test(value) && alpha2ToAlpha3.has(value)) return { alpha3: alpha2ToAlpha3.get(value), form: "alpha2" };
  if (/^[a-z]{2}$/.test(value) && alpha2ToAlpha3.has(value.toUpperCase())) {
    return { alpha3: alpha2ToAlpha3.get(value.toUpperCase()), form: "alpha2_lower" };
  }
  return null;
}

const usage = new Map();   // "file::key::form" -> count
const unresolved = new Map(); // "file::key" -> Set(values)

function walk(node, file, depth = 0) {
  if (depth > 6 || node === null) return;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 400)) walk(item, file, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (COUNTRY_KEYS.has(key) && typeof value === "string" && value.length >= 2 && value.length <= 3) {
      const hit = classify(value);
      if (hit) {
        const row = byAlpha3.get(hit.alpha3);
        row.observed_as[hit.form] = (row.observed_as[hit.form] || 0) + 1;
        const tag = `${file}::${key}::${hit.form}`;
        usage.set(tag, (usage.get(tag) || 0) + 1);
      } else if (/^[A-Za-z]{2,3}$/.test(value)) {
        // Letters-only and unmatched: a country spelling the registry cannot resolve.
        const tag = `${file}::${key}`;
        if (!unresolved.has(tag)) unresolved.set(tag, new Set());
        unresolved.get(tag).add(value);
      }
    }
    walk(value, file, depth + 1);
  }
}

// manifest.v1.json describes storage layers, not entities; its `id` field is a layer name.
const NOT_ENTITY_ARTIFACTS = new Set(["manifest.v1.json"]);

const files = (await readdir(path.join(ROOT, "data")))
  .filter((name) => name.endsWith(".v1.json") && !NOT_ENTITY_ARTIFACTS.has(name))
  .sort();

for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path.join(ROOT, "data", file), "utf8"));
  } catch {
    continue;
  }
  walk(parsed, file);
}

// ---------- report ----------

const formTotals = {};
for (const [tag, count] of usage) {
  const form = tag.split("::")[2];
  formTotals[form] = (formTotals[form] || 0) + count;
}

console.log(`anchor: ${byAlpha3.size} sovereign countries`);
console.log(`artifacts scanned: ${files.length}\n`);
console.log("country dimension, by alias form actually used:");
for (const [form, count] of Object.entries(formTotals).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${form.padEnd(14)} ${String(count).padStart(6)}`);
}

const perFile = new Map();
for (const [tag, count] of usage) {
  const [file, key, form] = tag.split("::");
  if (!perFile.has(file)) perFile.set(file, []);
  perFile.get(file).push({ key, form, count });
}

const needMigration = [...perFile].filter(([, uses]) => uses.some((u) => u.form !== "alpha3"));
console.log(`\nartifacts already canonical (alpha-3 only): ${perFile.size - needMigration.length}`);
console.log(`artifacts needing migration:                 ${needMigration.length}`);
for (const [file, uses] of needMigration.sort()) {
  const off = uses.filter((u) => u.form !== "alpha3").map((u) => `${u.key}=${u.form}(${u.count})`).join(", ");
  console.log(`  ${file.padEnd(46)} ${off}`);
}

if (unresolved.size) {
  console.log(`\nunresolved country-shaped values (${unresolved.size} site(s)):`);
  for (const [tag, values] of [...unresolved].sort().slice(0, 12)) {
    console.log(`  ${tag.padEnd(52)} ${[...values].sort().slice(0, 8).join(" ")}`);
  }
}

if (!write) {
  console.log("\nReport only. Pass --write to emit the registry.");
  process.exit(0);
}

await mkdir(path.join(ROOT, "data", "registry"), { recursive: true });
await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    registry: "countries",
    canonical_form: "iso_alpha3",
    generated_at: new Date().toISOString().slice(0, 10),
    anchor_artifact: ANCHOR,
    count: byAlpha3.size,
    scope: "sovereign states only",
    pending_migration: [
      "municipal-snapshot.v1.json",
    ],
    codemod_deferred: ["municipal-snapshot.v1.json"],
    codemod_deferred_note: "11.8 MB for 6,254 identifier values that nothing reads in alpha-2 form today. Rewriting it would add the exact pack weight this programme exists to stop, so its producer is fixed and the data canonicalises on its next regeneration. The ratchet keeps it visible until then.",
    pending_migration_note: "All producers now emit alpha-3 via pipeline/transforms/country_registry.py, and four artifacts were canonicalised in place. municipal-snapshot alone remains, deferred by size — see codemod_deferred. No JavaScript consumer compares country_code against an alpha-2 literal, so nothing on the site changed behaviour.",
    known_gaps: [...unresolved].map(([tag, values]) => ({
      site: tag,
      values: [...values].sort(),
      note: "Country-shaped codes the sovereign anchor does not cover. world-map carries non-sovereign territories (and two codes that are not ISO 3166-1 at all, `go` and `ju`); geometry keeps its own identity space and references this registry where a territory has a sovereign parent. No parent is guessed here.",
    })),
    countries: [...byAlpha3.values()].sort((a, b) => a.canonical.localeCompare(b.canonical)),
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT} — ${byAlpha3.size} countries.`);
