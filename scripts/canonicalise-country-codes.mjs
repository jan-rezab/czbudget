#!/usr/bin/env node
/**
 * B2 codemod — rewrite the country dimension to the canonical form, driven by the registry.
 *
 * The producers now emit alpha-3 (see pipeline/transforms/country_registry.py). This brings
 * the already-published artifacts into line without a full pipeline run, so data and
 * generator agree in the same commit rather than drifting until the next regeneration —
 * which is the failure mode that left 29,597 generated pages behind their template.
 *
 * Only keys whose NAME implies the canonical form are touched. A field called `alpha2` or
 * `iso2` legitimately holds alpha-2 and is left alone.
 *
 *   node scripts/canonicalise-country-codes.mjs --dry-run
 *   node scripts/canonicalise-country-codes.mjs --write
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const REGISTRY = "data/registry/countries.v1.json";
const write = process.argv.includes("--write");

const CANONICAL_KEYS = new Set(["country_code", "iso3", "alpha3", "cc"]);

const registry = JSON.parse(await readFile(path.join(ROOT, REGISTRY), "utf8"));
const canonical = new Set(registry.countries.map((c) => c.canonical));
const alias = new Map();
for (const country of registry.countries) {
  for (const value of Object.values(country.aliases)) {
    if (value) alias.set(String(value).toUpperCase(), country.canonical);
  }
}

// Files whose producer is fixed but whose data waits for a natural regeneration, because
// rewriting them costs more pack weight than the canonicalisation currently buys.
const deferred = new Set(registry.codemod_deferred || []);
const declared = (registry.pending_migration || []).filter((f) => !deferred.has(f));
for (const file of deferred) console.log(`  ${file.padEnd(42)} deferred to next regeneration`);

// A directory named in the registry expands to every .json inside it. data/entities is a
// verbatim per-entity fan-out of municipal-snapshot, so the two must move together or the
// fan-out silently disagrees with its own source.
const { readdir } = await import("node:fs/promises");
const targets = [];
for (const entry of declared) {
  if (entry.endsWith("/")) {
    const dir = entry.replace(/\/$/, "");
    const names = await readdir(path.join(ROOT, "data", dir));
    targets.push(...names.filter((n) => n.endsWith(".json")).map((n) => `${dir}/${n}`));
  } else {
    targets.push(entry);
  }
}
let filesChanged = 0;
let valuesChanged = 0;

for (const file of targets) {
  const full = path.join(ROOT, "data", file);
  let text;
  try {
    text = await readFile(full, "utf8");
  } catch {
    console.warn(`  (absent) ${file}`);
    continue;
  }

  /**
   * Text-level rewrite, deliberately. Parsing and re-serialising this JSON changes number
   * representation — `12663424180.0` comes back as `12663424180` — which produced a
   * 936-line diff for 99 value changes and would break byte-comparability against a
   * regenerated artifact. Only the matched substrings move; every other byte is preserved.
   */
  let changed = 0;
  const unresolved = new Set();
  const keyPattern = [...CANONICAL_KEYS].join("|");
  const pattern = new RegExp(`("(?:${keyPattern})"\\s*:\\s*")([A-Za-z]{2,3})(")`, "g");

  const rewritten = text.replace(pattern, (whole, head, value, tail) => {
    if (canonical.has(value)) return whole;
    const resolved = alias.get(value.toUpperCase());
    if (!resolved) {
      unresolved.add(value);
      return whole;
    }
    changed += 1;
    return `${head}${resolved}${tail}`;
  });

  // Verify the text rewrite did exactly what an in-memory rewrite would have done, and
  // nothing else: apply the same change to the parsed original and require deep equality
  // with the parsed result. Catches a regex that matched somewhere it should not have.
  if (changed) {
    const expected = JSON.parse(text);
    const applyLogically = (node) => {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) applyLogically(item);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (CANONICAL_KEYS.has(key) && typeof value === "string" && /^[A-Za-z]{2,3}$/.test(value)
            && !canonical.has(value) && alias.has(value.toUpperCase())) {
          node[key] = alias.get(value.toUpperCase());
        } else {
          applyLogically(value);
        }
      }
    };
    applyLogically(expected);
    if (JSON.stringify(expected) !== JSON.stringify(JSON.parse(rewritten))) {
      throw new Error(`${file}: text rewrite does not match the intended change — aborting`);
    }
  }

  if (unresolved.size) {
    console.error(`  ! ${file}: cannot resolve ${[...unresolved].sort().join(", ")} — left untouched`);
  }
  if (!changed) {
    console.log(`  ${file.padEnd(42)} already canonical`);
    continue;
  }

  console.log(`  ${file.padEnd(42)} ${String(changed).padStart(5)} value(s) -> alpha-3`);
  valuesChanged += changed;
  filesChanged += 1;

  if (write) await writeFile(full, rewritten, "utf8");
}

console.log(`\n${filesChanged} file(s), ${valuesChanged} value(s)${write ? " rewritten." : " would change. Pass --write."}`);
