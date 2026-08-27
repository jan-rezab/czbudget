// Single source of truth for the published-volume counts that both
// scripts/validate-site.mjs and tests/browser/site.spec.mjs assert.
//
// Why this file exists: the same totals used to be typed out in three places --
// the validator, the Playwright suite and the data itself. They drifted, and the
// browser suite spent releases failing against a stale "387,346" while the tree
// published a different number. Nothing here may be typed twice.
//
// Two kinds of number live here, and the distinction is load-bearing:
//
//   * DERIVED  -- measured from the published artifacts at read time. These are
//                 not assertions on their own; they become real checks when a
//                 consumer reconciles them against an INDEPENDENT artifact (the
//                 quality report, the freshness file, the rendered page). A
//                 constant that the same commit rewrites checks nothing.
//   * PINNED   -- deliberate regression tripwires that a routine data refresh
//                 must never move. Each one carries the reason it is pinned.
//
// Import paths are resolved from this file, not from process.cwd(), so the
// module behaves identically under `node scripts/validate-site.mjs` and under
// Playwright.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = async (relative) => JSON.parse(await readFile(path.join(repoRoot, relative), "utf8"));

/**
 * PINNED regression tripwires.
 *
 * These describe externally fixed universes or hard floors. A data refresh that
 * moves one of them is an ingestion bug, not new coverage, so the failure is the
 * point. Anything that legitimately grows release to release must NOT be pinned
 * to an exact value here -- pin a floor instead.
 */
export const pinnedCounts = Object.freeze({
  // The Czech municipal universe is a fixed, externally defined set of reporting
  // entities. It does not move between releases.
  municipalities: 6254,
  // IMF World Economic Outlook sovereign coverage: fixed by the source release.
  sovereignCountries: 191,
  // Countries in the municipal directory and in the itemized-coverage contract.
  // Both files must describe the same 27 countries; a mismatch means one of the
  // two builds ran against a different country set.
  municipalDirectoryCountries: 27,
  itemizedCoverageCountries: 27,
  // Component volumes of `published_data_entries`. Each is separately meaningful
  // and separately stable, which is what makes the derived total below a real
  // reconciliation rather than a restatement.
  publicEntityRegistryRecords: 121199,
  municipalHistoryRecords: 100021,
  municipalDirectoryEntries: 105582,
  // Municipal entities in scope across all 27 directory countries (directory
  // rows plus aggregate-only units).
  municipalUnitsInScope: 107703,
  // RATCHET, not an equality pin. Published itemized coverage is expected to
  // grow as warehouse-only countries are promoted to the site; it must never
  // silently shrink. Raise this floor deliberately when coverage grows.
  // Value at the time of writing: 35,810 profiles across 19 of 27 countries,
  // measured from on-site artifacts (was an asserted 75,507 that counted
  // warehouse-only rows the site never published).
  itemizedPublishedProfilesFloor: 35810,
  // Same ratchet for the headline volume figure the coverage page prints.
  publishedDataEntriesFloor: 362612,
  // RATCHET. Rows in data/methodology-sources.v1.json that PSD has actually
  // loaded (as opposed to rows that only record an available upstream source).
  // Promoting a warehouse-only country to the site raises this; nothing else may
  // lower it. Value at the time of writing: 374 of 2,128 ledger rows.
  methodologyLoadedLedgerRowsFloor: 374,
  // Anchor countries whose published itemized coverage is complete and known.
  // CZE is the full Czech universe; DNK is a genuinely published 98-municipality
  // collection that must not be swept up in the warehouse-only reclassification.
  itemizedAnchors: Object.freeze({ CZE: 6254, DNK: 98 }),
});

/** The two honest publication states an itemized-coverage row may declare. */
export const PUBLICATION_STATES = Object.freeze(["published", "warehouse_only"]);

/** Format a count the way the English rendering of the site prints it. */
export const formatCount = (value) => Number(value).toLocaleString("en-US");

/**
 * Measure the published counts from the artifacts the site actually serves.
 *
 * Only small artifacts are read here so that the Playwright suite can import the
 * module cheaply. The 21 MB municipality directory is deliberately NOT parsed:
 * its row count is taken from data-freshness.v1.json, and validate-site.mjs --
 * which already holds the full file in memory -- reconciles the two.
 */
export async function loadExpectedCounts() {
  const [itemizedCoverage, dataFreshness, publicEntityDirectory, municipalHistoryIndex] = await Promise.all([
    readJson("data/municipal-itemized-coverage.v1.json"),
    readJson("data/data-freshness.v1.json"),
    readJson("data/public-entity-directory/manifest.v1.json"),
    readJson("data/municipal-history/index.json"),
  ]);

  const publishedItemizedCountryCodes = [];
  const warehouseOnlyCountryCodes = [];
  let itemizedPublishedProfiles = 0;
  let itemizedPublishedProfileCountSum = 0;
  let itemizedWarehouseOnlyProfiles = 0;
  for (const country of itemizedCoverage.countries) {
    // `profile_count` is the field the coverage matrix and the KPI tile sum, so
    // the expectation is derived from it; `published_profile_count` is summed in
    // parallel and reconciled by the caller.
    const profiles = Number(country.profile_count) || 0;
    itemizedPublishedProfiles += profiles;
    itemizedPublishedProfileCountSum += Number(country.published_profile_count) || 0;
    if (country.publication_status === "warehouse_only") {
      warehouseOnlyCountryCodes.push(country.code);
      itemizedWarehouseOnlyProfiles += Number(country.warehouse_profile_count) || 0;
    } else if (profiles > 0) {
      publishedItemizedCountryCodes.push(country.code);
    }
  }

  const publishedEntryComponents = {
    public_entity_registry: Number(publicEntityDirectory.total_record_count) || 0,
    municipal_history_records: Number(municipalHistoryIndex.annual_record_count) || 0,
    municipal_directory_entries: Number(dataFreshness.totals?.municipality_rows) || 0,
    itemized_municipal_profiles: itemizedPublishedProfiles,
  };
  const publishedDataEntries = Object.values(publishedEntryComponents).reduce((sum, count) => sum + count, 0);

  return {
    pinned: pinnedCounts,
    // Derived from data/municipal-itemized-coverage.v1.json.
    itemizedPublishedProfiles,
    itemizedPublishedProfileCountSum,
    itemizedWarehouseOnlyProfiles,
    itemizedCoverageCountries: itemizedCoverage.countries.length,
    publishedItemizedCountryCodes: publishedItemizedCountryCodes.sort(),
    warehouseOnlyCountryCodes: warehouseOnlyCountryCodes.sort(),
    publishedItemizedCountries: publishedItemizedCountryCodes.length,
    warehouseOnlyCountries: warehouseOnlyCountryCodes.length,
    // Derived component volumes and the headline total the coverage page prints.
    publishedEntryComponents,
    publishedDataEntries,
    // Derived from data/data-freshness.v1.json.
    municipalUnitsInScope: Number(dataFreshness.totals?.municipal_units) || 0,
    municipalDirectoryEntries: Number(dataFreshness.totals?.municipality_rows) || 0,
    municipalDirectoryCountries: Number(dataFreshness.totals?.municipal_country_coverage) || 0,
    freshnessItemizedProfiles: Number(dataFreshness.totals?.itemized_municipal_profiles) || 0,
    freshnessItemizedCountryCoverage: Number(dataFreshness.totals?.itemized_municipal_country_coverage) || 0,
    // Raw rows, so callers can assert the per-country publication contract
    // without re-reading and re-parsing the coverage file.
    itemizedCoverageByCode: new Map(itemizedCoverage.countries.map((country) => [country.code, country])),
  };
}
