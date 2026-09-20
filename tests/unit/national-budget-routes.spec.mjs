import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NATIONAL_BUDGET_ROUTES, nationalBudgetPath } from "../../scripts/lib/national-budget-routes.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"));

test("parallel national-budget manifest contains exactly the 17 full dashboards", async () => {
  const manifest = await readJson("data/national-budget-routes.v1.json");
  const parity = await readJson("data/country-parity.v1.json");
  const expected = parity.countries.filter((country) => country.profile_tier === "full").map((country) => country.country_code).sort();
  assert.equal(manifest.country_count, 17);
  assert.deepEqual(manifest.countries.map((country) => country.country_code).sort(), expected);
  assert.deepEqual(Object.keys(NATIONAL_BUDGET_ROUTES).sort(), expected);
  for (const country of manifest.countries) {
    assert.equal(country.path, nationalBudgetPath(country.country_code));
    assert.match(country.path, /^\/national-budgets\/[a-z-]+$/);
    assert.equal(country.modules.sovereign, "loaded");
    assert.equal(country.modules.revenue, "loaded");
    assert.equal(country.modules.spending, "loaded");
    assert.equal(country.modules.demography, "loaded");
  }
});

test("every parallel dashboard has the universal revenue, spending, demography, macro and global-health inputs", async () => {
  const [manifest, sovereign, revenue, spending, demography, globalHealth] = await Promise.all([
    readJson("data/national-budget-routes.v1.json"),
    readJson("data/sovereign-benchmark-slim.v1.json"),
    readJson("data/country-revenue.v1.json"),
    readJson("data/country-spending-2025-2026.v1.json"),
    readJson("data/country-demography.v1.json"),
    readJson("data/global-health-baseline.v1.json"),
  ]);
  for (const route of manifest.countries) {
    const code = route.country_code;
    const macro = sovereign.series.find((country) => country.country_code === code);
    assert.ok(macro, `${code} macro series`);
    assert.equal(macro.metrics.unemployment_pct.values.length, 20, `${code} unemployment history`);
    assert.ok(revenue.countries[code]?.tax_detail, `${code} revenue detail`);
    assert.ok(spending.countries.find((country) => country.code === code)?.rows.length, `${code} spending rows`);
    assert.ok(demography.countries[code]?.years.length, `${code} demography projection`);
    assert.ok(globalHealth.countries[code]?.financing?.health_gdp_pct, `${code} health spending`);
    assert.ok(globalHealth.countries[code]?.financing?.out_of_pocket_pct, `${code} household health spending`);
  }
});
