import test from "node:test";
import assert from "node:assert/strict";
import { HEALTH_INDICATORS, buildGlobalHealth } from "../../scripts/lib/global-health-baseline.mjs";

const registry = { countries: [{ iso3: "AAA" }, { iso3: "BBB" }, { iso3: "CCC" }] };
const record = (countryiso3code, date, value) => ({ countryiso3code, date: String(date), value });
const payloads = Object.fromEntries(Object.values(HEALTH_INDICATORS).map(({ source_code }) => [source_code, { source_code, records: [] }]));
payloads["SH.XPD.CHEX.GD.ZS"].records = [record("AAA", 2020, 4), record("AAA", 2022, 5), record("BBB", 2021, null), record("ZZZ", 2022, 9)];
payloads["SH.XPD.CHEX.PP.CD"].records = [record("AAA", 2021, 1000)];
payloads["SH.XPD.GHED.CH.ZS"].records = [record("AAA", 2021, 70)];
payloads["SH.XPD.OOPC.CH.ZS"].records = [record("AAA", 2021, 20)];
payloads["SP.DYN.LE00.IN"].records = [record("AAA", 2022, 80), record("BBB", 2022, 71)];

test("global health transform is deterministic, registry-bound and preserves missingness", () => {
  const options = { registry, payloads, generatedAt: "2026-09-20T00:00:00Z", startYear: 2000, endYear: 2026 };
  const first = buildGlobalHealth(options);
  const second = buildGlobalHealth(options);
  assert.deepEqual(first, second);
  assert.equal(first.artifact.country_count, 3);
  assert.deepEqual(Object.keys(first.artifact.countries), ["AAA", "BBB", "CCC"]);
  assert.deepEqual(first.artifact.countries.AAA.financing.health_gdp_pct.series, [{ year: 2020, value: 4 }, { year: 2022, value: 5 }]);
  assert.equal(first.artifact.countries.AAA.financing.health_gdp_pct.year, 2022);
  assert.equal(first.artifact.countries.BBB.financing.health_gdp_pct, null);
  assert.equal(first.artifact.countries.CCC.status, "not_loaded");
  assert.equal(first.coverage.countries_with_any_metric, 2);
  assert.equal(first.coverage.countries_with_complete_financing, 1);
  assert.deepEqual(first.coverage.metrics.health_gdp_pct.missing_countries, ["BBB", "CCC"]);
});

test("invalid and out-of-period observations are not fabricated into coverage", () => {
  const altered = structuredClone(payloads);
  altered["SH.MED.BEDS.ZS"].records = [record("BBB", 1999, 2), record("BBB", 2020, "not-a-number")];
  const { artifact, coverage } = buildGlobalHealth({ registry, payloads: altered, generatedAt: "2026-09-20T00:00:00Z", startYear: 2000, endYear: 2026 });
  assert.equal(artifact.countries.BBB.capacity.beds_per_1000, null);
  assert.equal(coverage.metrics.beds_per_1000.loaded_count, 0);
});
