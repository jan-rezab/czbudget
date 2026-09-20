import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"));
const readText = async (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("country parity separates universal fiscal baselines from native detail", async () => {
  const parity = await read("data/country-parity.v1.json");
  const omissions = new Set(["CUB", "MCO", "PRK", "VAT"]);
  const weo = parity.countries.filter((country) => !omissions.has(country.country_code));

  assert.equal(parity.countries.length, 195);
  assert.equal(weo.length, 191);
  assert.ok(weo.every((country) => country.modules.baseline_revenue.status === "loaded"));
  assert.ok(weo.every((country) => country.modules.baseline_spending.status === "loaded"));
  assert.equal(parity.countries.filter((country) => country.modules.baseline_unemployment.status === "loaded").length, 183);
  assert.equal(parity.countries.filter((country) => country.modules.baseline_unemployment.fallback_used).length, 71);
  assert.equal(parity.countries.filter((country) => country.modules.revenue.status === "loaded").length, 17);
  assert.equal(parity.countries.filter((country) => country.modules.administrative_spending.status === "loaded").length, 17);
  assert.equal(parity.countries.filter((country) => country.modules.health_baseline.status === "loaded").length, 194);
  assert.ok(parity.countries.every((country) => country.coverage.total_modules === 15));
});

test("core gap manifest reconciles exactly to the sovereign universe", async () => {
  const gaps = await read("data/country-core-gaps.v1.json");
  for (const module of Object.values(gaps.modules)) {
    assert.equal(module.loaded_count + module.missing_count, gaps.country_count);
    assert.equal(module.loaded_countries.length, module.loaded_count);
    assert.equal(module.missing_countries.length, module.missing_count);
    assert.equal(new Set([...module.loaded_countries, ...module.missing_countries]).size, gaps.country_count);
  }
  assert.deepEqual(
    [gaps.modules.demography.loaded_count, gaps.modules.health_financing.loaded_count, gaps.modules.health_baseline.loaded_count, gaps.modules.health_performance.loaded_count],
    [17, 15, 194, 17],
  );
});

test("universal source contract pins exact unemployment, demography and health series", async () => {
  const contract = await read("data/contracts/universal-country-core.v1.json");
  assert.equal(contract.modules.baseline_unemployment.primary_metric, "LUR");
  assert.equal(contract.modules.baseline_unemployment.fallback_metric, "SL.UEM.TOTL.ZS");
  assert.equal(contract.modules.demography.source_asset, "WPP2024_PopulationBySingleAgeSex_Medium_2024-2100.csv.gz");
  assert.equal(Object.keys(contract.modules.health_baseline.series).length, 11);
});

test("the universal country page loads the global unemployment fallback", async () => {
  const script = await readText("country.js");
  assert.match(script, /fetch\("\/data\/global-unemployment\.v1\.json"\)/);
  assert.match(script, /key==="unemployment_pct"\?state\.unemployment/);
});
