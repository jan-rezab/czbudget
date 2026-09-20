import { readFile, writeFile } from "node:fs/promises";
import { NATIONAL_BUDGET_ROUTES, nationalBudgetPath } from "./lib/national-budget-routes.mjs";

const root = new URL("../", import.meta.url);
const parity = JSON.parse(await readFile(new URL("data/country-parity.v1.json", root), "utf8"));
const countriesByCode = new Map(parity.countries.map((country) => [country.country_code, country]));

const countries = Object.keys(NATIONAL_BUDGET_ROUTES).map((countryCode) => {
  const country = countriesByCode.get(countryCode);
  if (!country) throw new Error(`Country parity is missing ${countryCode}`);
  if (country.profile_tier !== "full") throw new Error(`${countryCode} is not a full country profile`);
  return {
    country_code: countryCode,
    iso2: country.iso2,
    slug: NATIONAL_BUDGET_ROUTES[countryCode],
    path: nationalBudgetPath(countryCode),
    name_cs: country.name_cs,
    name_en: country.name_en,
    currency_code: country.currency_code,
    modules: {
      sovereign: country.modules.sovereign.status,
      revenue: country.modules.revenue.status,
      spending: country.modules.administrative_spending.status,
      health: country.modules.health.status,
      health_performance: "loaded",
      demography: country.modules.demography.status,
    },
  };
});

const output = {
  schema_version: "1.0.0",
  contract: "national-budget-route-manifest",
  generated_from: "data/country-parity.v1.json",
  route_template: "/national-budgets/{slug}",
  country_count: countries.length,
  countries,
};

await writeFile(new URL("data/national-budget-routes.v1.json", root), `${JSON.stringify(output, null, 2)}\n`);
