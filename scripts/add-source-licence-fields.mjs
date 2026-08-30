#!/usr/bin/env node
/**
 * G0 / B4 slice — add a licence block to every source in the international fiscal
 * source registry.
 *
 * The registry aggregates and republishes national sources. Until each source's terms
 * are read and recorded, the site cannot honestly grant an outbound licence on anything
 * derived from them. This script adds the field in an explicit `unverified` state so the
 * gap is visible and countable, and never fabricates terms.
 *
 * Idempotent: sources that already carry a licence block are left untouched.
 */
import { readFile, writeFile } from "node:fs/promises";

const REGISTRY = "pipeline/config/international_fiscal_source_registry.json";

const BLANK_LICENCE = {
  status: "unverified",
  spdx: null,
  terms_url: null,
  attribution_required: null,
  redistribution_permitted: null,
  checked_on: null,
  note: null,
};

const registry = JSON.parse(await readFile(REGISTRY, "utf8"));

let added = 0;
let existing = 0;
for (const country of registry.countries) {
  for (const source of country.sources ?? []) {
    if (source.licence) {
      existing += 1;
      continue;
    }
    source.licence = { ...BLANK_LICENCE };
    added += 1;
  }
}

if (added > 0) registry.registry_version = "1.1.0";

await writeFile(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

const total = added + existing;
console.log(`licence field: ${added} added, ${existing} already present, ${total} sources total`);
console.log(`registry_version: ${registry.registry_version}`);
if (added > 0) {
  console.log(`\n${added} sources now carry status "unverified".`);
  console.log("No outbound licence may be granted on derived work until these are read.");
}
