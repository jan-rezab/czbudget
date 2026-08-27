#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const WORLD_BANK_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400";
const atlas = JSON.parse(await readFile(new URL("../data/global-budget-transparency.v1.json", import.meta.url), "utf8"));
const response = await fetch(WORLD_BANK_URL);
if (!response.ok) throw new Error(`World Bank country metadata ${response.status}`);
const [, records] = await response.json();
const byIso2 = new Map(records.filter((record) => record.iso2Code).map((record) => [record.iso2Code.toLowerCase(), record]));

const overrides = {
  cu: { iso3: "CUB", weo_code: null },
  kp: { iso3: "PRK", weo_code: null },
  mc: { iso3: "MCO", weo_code: null },
  ps: { iso3: "PSE", weo_code: "WBG" },
  va: { iso3: "VAT", weo_code: null },
};

const countries = atlas.countries.map((country) => {
  const worldBank = byIso2.get(country.iso2);
  const override = overrides[country.iso2] || {};
  const iso3 = override.iso3 || worldBank?.id || null;
  if (!iso3) throw new Error(`No ISO3 mapping for ${country.iso2} / ${country.name_en}`);
  return {
    iso2: country.iso2,
    iso3,
    weo_code: Object.hasOwn(override, "weo_code") ? override.weo_code : iso3,
    name_cs: country.name_cs,
    name_en: country.name_en,
  };
});

if (countries.length !== 195) throw new Error(`Expected 195 sovereign states, received ${countries.length}`);
if (new Set(countries.map((country) => country.iso3)).size !== countries.length) throw new Error("Duplicate ISO3 code in sovereign universe");

const payload = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  universe: "193 United Nations member states plus the Holy See and the State of Palestine",
  sources: [
    { title: "United Nations member states", url: "https://www.un.org/en/about-us/member-states" },
    { title: "World Bank country metadata", url: WORLD_BANK_URL },
  ],
  notes: {
    palestine: "The public ISO3 code is PSE; IMF WEO publishes the economy as WBG (West Bank and Gaza).",
    unavailable_in_weo: "Cuba, Monaco, North Korea and Vatican City do not have a country series in the April 2026 WEO workbook.",
  },
  countries,
};

await writeFile(new URL("../pipeline/config/sovereign_country_universe.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${countries.length} sovereign-state mappings`);
