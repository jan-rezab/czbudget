import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGlobalUnemployment, parseCsvLine } from "../../scripts/lib/global-unemployment.mjs";

const sovereign = {
  generated_at: "2026-08-28T00:00:00Z",
  source: { provider: "IMF", dataset: "WEO", download_page: "https://example.test/weo" },
  countries: [{ country_code: "AAA" }, { country_code: "BBB" }, { country_code: "CCC" }],
  series: [
    { country_code: "AAA", metrics: { unemployment_pct: { values: [{ year: 2020, value: 5, status: "actual" }] } } },
    { country_code: "BBB", metrics: { unemployment_pct: { values: [{ year: 2020, value: null, status: "estimate" }] } } },
    { country_code: "CCC", metrics: { unemployment_pct: { values: [] } } },
  ],
};
const worldBankRows = [
  { country_code: "AAA", indicator_code: "unemployment_rate_annual", source_series: "SL.UEM.TOTL.ZS", period: "2021", value: "4", observation_status: "WB", source_vintage: "2026-08-26", quality_flags: "" },
  { country_code: "BBB", indicator_code: "unemployment_rate_annual", source_series: "SL.UEM.TOTL.ZS", period: "2021", value: "8", observation_status: "WB", source_vintage: "2026-08-26", quality_flags: "modelled" },
];

test("IMF series wins at country level and World Bank fills only empty IMF countries", () => {
  const artifact = buildGlobalUnemployment({ sovereign, worldBankRows, generatedAt: "2026-08-28T00:00:00Z" });
  assert.equal(artifact.countries.AAA.preferred_source, "imf_weo");
  assert.equal(artifact.countries.AAA.latest.year, 2020);
  assert.equal(artifact.countries.AAA.fallback_used, false);
  assert.equal(artifact.countries.BBB.preferred_source, "world_bank_wdi");
  assert.equal(artifact.countries.BBB.latest.observation_status, "WB");
  assert.equal(artifact.countries.BBB.latest.quality_flags, "modelled");
  assert.equal(artifact.countries.CCC.status, "unavailable");
  assert.deepEqual(artifact.coverage.source_counts, { imf_weo: 1, world_bank_fallback: 1, unavailable: 1 });
});

test("CSV parsing retains quoted lineage fields", () => {
  assert.deepEqual(parseCsvLine('AAA,unemployment_rate_annual,"source, labelled",2025'), ["AAA", "unemployment_rate_annual", "source, labelled", "2025"]);
});

test("published unemployment artifact has exact source coverage and residual gaps", async () => {
  const artifact = JSON.parse(await readFile(new URL("../../data/global-unemployment.v1.json", import.meta.url), "utf8"));
  assert.equal(artifact.country_count, 195);
  assert.deepEqual(artifact.coverage.source_counts, { imf_weo: 112, world_bank_fallback: 71, unavailable: 12 });
  assert.deepEqual(artifact.coverage.missing_countries, ["ATG", "DMA", "FSM", "GRD", "KIR", "MHL", "MCO", "NRU", "PLW", "KNA", "TUV", "VAT"]);
});
