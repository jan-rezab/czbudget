#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const parity = await read("data/country-parity.v1.json");
const healthPerformance = await read("data/country-health-performance.v1.json");

const codes = parity.countries.map((country) => country.country_code);
const moduleGap = (module) => {
  const loaded = parity.countries.filter((country) => country.modules[module]?.status === "loaded").map((country) => country.country_code);
  return { loaded_count: loaded.length, missing_count: codes.length - loaded.length, loaded_countries: loaded, missing_countries: codes.filter((code) => !loaded.includes(code)) };
};

const healthLoaded = Object.keys(healthPerformance.countries || {});
const payload = {
  schema_version: "1.0.0",
  contract: "country-core-gaps.v1",
  generated_at: parity.generated_at,
  country_count: codes.length,
  source_contract: "data/contracts/universal-country-core.v1.json",
  modules: {
    baseline_revenue: moduleGap("baseline_revenue"),
    baseline_spending: moduleGap("baseline_spending"),
    baseline_unemployment: moduleGap("baseline_unemployment"),
    demography: moduleGap("demography"),
    health_financing: moduleGap("health"),
    health_baseline: moduleGap("health_baseline"),
    health_performance: {
      loaded_count: healthLoaded.length,
      missing_count: codes.length - healthLoaded.length,
      loaded_countries: healthLoaded,
      missing_countries: codes.filter((code) => !healthLoaded.includes(code)),
      note: "World Bank baseline indicators are loaded only for the current seventeen dashboard countries; OECD-only utilisation and avoidable-mortality fields remain optional enrichments."
    }
  }
};

await writeFile(new URL("../data/country-core-gaps.v1.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
console.log("Wrote data/country-core-gaps.v1.json");
