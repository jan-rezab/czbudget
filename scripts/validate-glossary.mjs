#!/usr/bin/env node
/**
 * The glossary — A5 and B5.
 *
 * Twenty-five definition blocks were scattered across published artifacts before this: half in
 * one language only, several defining the same word differently, and none reachable from the
 * page where the word appears. A definition written five times is five definitions.
 *
 * This checks the registry can carry that load. Three rules:
 *
 *   1. Every entry is complete in both languages. A half-translated glossary is worse than
 *      none, because the missing half is invisible until a reader hits it.
 *   2. No definition contains a figure. A definition that quotes a number goes stale the year
 *      the number does, and there is no build step that would catch it — the same reason
 *      translation keys may not carry digits.
 *   3. Every vocabulary the site actually uses is covered: budget stages, vintages, and the
 *      warehouse booleans. This is what stops the glossary drifting behind the data.
 *
 *   node scripts/validate-glossary.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const REGISTRY = "data/registry/glossary.v1.json";

const failures = [];
const fail = (rule, detail) => failures.push(`${rule}: ${detail}`);

const glossary = JSON.parse(await readFile(path.join(ROOT, REGISTRY), "utf8"));
const terms = glossary.terms || [];
const byId = new Map(terms.map((entry) => [entry.id, entry]));

if (byId.size !== terms.length) fail("each term has one entry", "duplicate id in the registry");
if (glossary.term_count !== terms.length) {
  fail("the declared count matches the entries", `declares ${glossary.term_count}, carries ${terms.length}`);
}

for (const entry of terms) {
  for (const lang of ["cs", "en"]) {
    const side = entry[lang];
    if (!side?.term || !side?.definition) {
      fail("every term is complete in both languages", `${entry.id} is missing ${lang}`);
      continue;
    }
    // A definition that quotes a figure goes stale silently. Years are allowed: "2026 prices"
    // is a definition of a method, not a measurement of one.
    const figures = side.definition.match(/\d[\d\s.,]*/g)?.filter((value) => !/^(19|20)\d\d$/.test(value.trim()));
    if (figures?.length) {
      fail("no definition carries a figure", `${entry.id}.${lang}: ${figures.slice(0, 3).join(", ")}`);
    }
    if (side.definition.length < 40) {
      fail("a definition says something", `${entry.id}.${lang} is ${side.definition.length} characters`);
    }
  }
}

/**
 * The vocabularies the site renders. A term the data uses and the glossary does not explain is
 * exactly the gap this registry exists to close, so it is a failure rather than a warning.
 */
const REQUIRED = {
  "budget stages": ["proposal", "enacted", "revised", "committed", "actual", "paid", "carried_over"],
  "reporting bases": ["accrual", "cash"],
  "warehouse flags": ["is_financing", "is_summary_row", "is_consolidation_item"],
};

const covered = new Set(terms.flatMap((entry) => entry.applies_to || []));
const coveredLeaf = new Set([...covered].map((value) => value.split(":").pop()));

for (const [vocabulary, values] of Object.entries(REQUIRED)) {
  const missing = values.filter((value) => !coveredLeaf.has(value) && !byId.has(value.replace(/_/g, "-")));
  if (missing.length) fail(`every ${vocabulary} value is explained`, missing.join(", "));
}

/**
 * A `data-term` span splits the text node it sits in. The Czech-keyed translation dictionary
 * matches whole text nodes, so marking a term inside a sentence that is itself a dictionary key
 * silently stops that sentence translating — the English page keeps the Czech. This caught one
 * on the first page it was applied to.
 */
const dictionary = await readFile(path.join(ROOT, "budget-i18n.js"), "utf8");
for (const file of ["cesky-rozpocet.html", "index.html", "methodology.html"]) {
  let markup;
  try {
    markup = await readFile(path.join(ROOT, file), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  for (const match of markup.matchAll(/<span data-term="([^"]+)">([^<]*)<\/span>/g)) {
    const [whole, id, text] = match;
    if (!byId.has(id)) fail("every marked term exists in the glossary", `${file}: "${id}"`);
    // Reconstruct the text node as it would read without the span, and ask whether that is a key.
    const start = markup.lastIndexOf(">", match.index) + 1;
    const end = markup.indexOf("<", match.index + whole.length);
    const rejoined = (markup.slice(start, match.index) + text + markup.slice(match.index + whole.length, end)).trim();
    if (rejoined && dictionary.includes(`"${rejoined}"`)) {
      fail("a marked term does not split a translated sentence",
        `${file}: "${id}" sits inside a dictionary key, so that sentence would stop translating`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`\nGlossary validation failed with ${failures.length} issue(s)`);
  process.exit(1);
}

console.log(`Glossary: ${terms.length} terms, complete in both languages, none carrying a figure.`);
console.log(`Covers ${Object.keys(REQUIRED).length} vocabularies the site renders.`);
