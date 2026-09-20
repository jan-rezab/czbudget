import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const readiness = read("data/country-dashboard-readiness.v1.json");
const parity = read("data/country-parity.v1.json");

test("readiness manifest covers exactly the 17 full country profiles", () => {
  const expected = parity.countries
    .filter(country => country.profile_tier === "full")
    .map(country => country.country_code)
    .sort();
  assert.equal(readiness.country_count, 17);
  assert.deepEqual(Object.keys(readiness.countries).sort(), expected);
});

test("municipalities, public entities and providers are optional deferred modules", () => {
  assert.deepEqual(readiness.completeness_policy.optional_deferred_modules, [
    "municipalities",
    "public_entities",
    "providers",
  ]);
  for (const country of Object.values(readiness.countries)) {
    for (const module of readiness.completeness_policy.optional_deferred_modules) {
      assert.equal(country.optional_deferred[module].required_for_readiness, false);
    }
    assert.equal(country.core_blockers.some(blocker => readiness.completeness_policy.optional_deferred_modules.includes(blocker)), false);
  }
});

test("every country has revenue, spending, demography and unemployment data", () => {
  for (const [code, country] of Object.entries(readiness.countries)) {
    for (const module of ["revenue", "spending", "demography", "unemployment"]) {
      assert.equal(country.modules[module].status, "ready", `${code} ${module}`);
    }
    assert.equal(country.modules.revenue.tax_detail_categories, 7, `${code} revenue categories`);
    assert.equal(country.modules.spending.common_category_count, 12, `${code} common spending categories`);
    assert.equal(country.modules.demography.common_year_count, 21, `${code} demography years`);
    assert.equal(country.modules.unemployment.observation_count, 20, `${code} unemployment observations`);
  }
});

test("known required health gaps are explicit and block only affected countries", () => {
  assert.deepEqual(readiness.countries.UKR.modules.health.profile_gaps, ["health_financing_profile_absent"]);
  assert.ok(readiness.countries.BRA.modules.health.profile_gaps.includes("health_gdp_pct"));
  assert.deepEqual(readiness.countries.JPN.modules.health.profile_gaps, [
    "providers.hospitals",
    "providers.residential_ltc",
    "providers.ambulatory",
    "providers.retailers",
    "providers.other",
  ]);
  assert.ok(readiness.countries.NOR.modules.health.profile_gaps.includes("financing.out_of_pocket"));

  const healthBlocked = Object.entries(readiness.countries)
    .filter(([, country]) => country.core_blockers.includes("health"))
    .map(([code]) => code)
    .sort();
  assert.deepEqual(healthBlocked, ["BRA", "JPN", "NOR", "UKR"]);
});

test("known recency and functional-history caveats remain visible", () => {
  assert.deepEqual(readiness.countries.UKR.modules.unemployment.gaps, ["latest_actual_pre_2024"]);
  assert.equal(readiness.countries.BRA.modules.spending.functional_history.status, "blocked");
  for (const code of ["BRA", "ESP", "FIN", "GRC", "NLD", "NOR"]) {
    assert.ok(readiness.countries[code].modules.spending.gaps.includes("budget_pair_ends_in_2024"), code);
  }
});
