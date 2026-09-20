import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ENERGY_FLOWS_SQL, ENERGY_PERIODS_SQL, normalizeCountryCode, normalizeEnergyFrequency, normalizeEnergyPeriod, normalizeEnergyProduct, normalizeProductCode, TRADE_PRODUCT_PARTNERS_SQL, TRADE_PROFILE_SQL, TradeError, TradeStore } from "../../server/trade-store.mjs";

test("trade country codes are strict ISO-3 values", () => {
  assert.equal(normalizeCountryCode(" cze "), "CZE");
  assert.throws(() => normalizeCountryCode("Czechia"), (error) => error instanceof TradeError && error.code === "invalid_trade_country");
});

test("trade product codes are strict two-digit HS chapters", () => {
  assert.equal(normalizeProductCode("87"), "87");
  assert.throws(() => normalizeProductCode("8703"), (error) => error instanceof TradeError && error.code === "invalid_trade_product");
});

test("trade query is partition-pruned and selects one product grain", () => {
  assert.match(TRADE_PROFILE_SQL, /period_start BETWEEN @min_date AND CURRENT_DATE\(\)/);
  assert.match(TRADE_PROFILE_SQL, /aggregation_level = MAX\(aggregation_level\)/);
  assert.match(TRADE_PROFILE_SQL, /partner_area_code = 0/);
  assert.match(TRADE_PROFILE_SQL, /partner_area_code != 0/);
  assert.doesNotMatch(TRADE_PROFILE_SQL, /SELECT \* FROM `czbudget-janrezab\.budget_detail\.trade_observations`/);
  assert.doesNotMatch(TRADE_PROFILE_SQL.slice(TRADE_PROFILE_SQL.indexOf("product_rows AS")), /DENSE_RANK\(\)/);
});

test("product-partner query is partition-pruned and constrained to a chapter", () => {
  assert.match(TRADE_PRODUCT_PARTNERS_SQL, /period_start BETWEEN @min_date AND CURRENT_DATE\(\)/);
  assert.match(TRADE_PRODUCT_PARTNERS_SQL, /STARTS_WITH\(product_code, @product_code\)/);
  assert.match(TRADE_PRODUCT_PARTNERS_SQL, /WHERE is_partner AND NOT is_group/);
  assert.doesNotMatch(TRADE_PRODUCT_PARTNERS_SQL, /SELECT \* FROM `czbudget-janrezab\.budget_detail\.trade_observations`/);
});

test("energy filters default to petroleum and reject ambiguous inputs", () => {
  assert.deepEqual(normalizeEnergyProduct(), { id: "petroleum", code: "270900", name: "Crude petroleum" });
  assert.equal(normalizeEnergyProduct("lng").code, "271111");
  assert.equal(normalizeEnergyFrequency("m"), "M");
  assert.equal(normalizeEnergyPeriod("2025", "A"), "2025");
  assert.equal(normalizeEnergyPeriod("202607", "M"), "202607");
  assert.throws(() => normalizeEnergyProduct("petroleum-products"), (error) => error instanceof TradeError && error.code === "invalid_energy_product");
  assert.throws(() => normalizeEnergyPeriod("202613", "M"), (error) => error instanceof TradeError && error.code === "invalid_energy_period");
});

test("energy queries are partition-pruned, importer-reported and exclude geographic groups", () => {
  for (const sql of [ENERGY_PERIODS_SQL, ENERGY_FLOWS_SQL]) {
    assert.match(sql, /period_start/);
    assert.match(sql, /flow_code = 'M'/);
    assert.match(sql, /is_original_classification/);
    assert.match(sql, /NOT is_group/);
  }
  assert.match(ENERGY_FLOWS_SQL, /product_code = @product_code/);
});

test("energy flow responses preserve direction and physical-data flags", async () => {
  const store = new TradeStore({ tokenProvider: async () => "unused" });
  store.query = async () => [{
    period: "2025", frequency: "A", origin_iso3: "NOR", origin_iso2: "NO", origin_name: "Norway",
    market_iso3: "DEU", market_iso2: "DE", market_name: "Germany", value_usd: "125", net_weight_kg: "50",
    net_weight_is_estimated: "true", source_last_released: "2026-05-01", retrieved_at: "2026-09-20",
  }];
  const result = await store.energyFlows("petroleum", "A", "2025");
  assert.equal(result.product.code, "270900");
  assert.equal(result.routes[0].origin.code, "NOR");
  assert.equal(result.routes[0].market.code, "DEU");
  assert.equal(result.routes[0].net_weight_is_estimated, true);
  assert.equal(result.totals.observed_value_usd, 125);
});

test("product partners expose both directions without filling missing values", async () => {
  const store = new TradeStore({ tokenProvider: async () => "unused" });
  store.query = async () => [
    { ref_year: "2025", flow_code: "X", partner_area_code: "276", partner_iso3: "DEU", partner_name: "Germany", value_usd: "40" },
    { ref_year: "2025", flow_code: "M", partner_area_code: "156", partner_iso3: "CHN", partner_name: "China", value_usd: "50" },
  ];
  const result = await store.productPartners("CZE", "87");
  assert.equal(result.product_code, "87");
  assert.deepEqual(result.partners.map((row) => row.flow), ["export", "import"]);
  assert.deepEqual(result.partners.map((row) => row.value_usd), [40, 50]);
});

test("trade profile separates totals, partners, and products without inventing zeroes", async () => {
  const store = new TradeStore({ tokenProvider: async () => "unused" });
  store.query = async () => [
    { row_kind: "total", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: "52", frequency: "A", flow_code: "M", value_usd: "100", source_last_released: "2026-01-01", retrieved_at: "2026-02-01" },
    { row_kind: "total", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: "52", frequency: "A", flow_code: "X", value_usd: "125", source_last_released: "2026-01-01", retrieved_at: "2026-02-01" },
    { row_kind: "partner", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: null, frequency: "A", flow_code: "X", partner_iso3: "DEU", partner_name: "Germany", partner_area_code: "276", value_usd: "40" },
    { row_kind: "product", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: null, frequency: "A", flow_code: "M", product_code: "85", product_name: null, value_usd: "30" },
  ];
  const profile = await store.profile("CZE");
  assert.equal(profile.totals.length, 2);
  assert.deepEqual(profile.totals.map((row) => row.value_usd), [100, 125]);
  assert.equal(profile.partners[0].code, "DEU");
  assert.equal(profile.products[0].name, "HS 85");
  assert.equal(profile.valuation.imports, "CIF");
  assert.ok(!profile.totals.some((row) => row.value_usd === 0));
});

test("the 2024 public seed reads its structured period as a year", async () => {
  const seedPath = fileURLToPath(new URL("../../data/trade/annual-hs2-2024.v1.json", import.meta.url));
  const store = new TradeStore({ tokenProvider: async () => "unused", seedPath });
  store.query = async () => [
    { row_kind: "total", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: "52", frequency: "A", flow_code: "M", value_usd: "100" },
    { row_kind: "total", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: "52", frequency: "A", flow_code: "X", value_usd: "125" },
  ];
  const profile = await store.profile("DEU");
  assert.deepEqual([...new Set(profile.totals.map((row) => row.period))], ["2024", "2025"]);
  assert.ok(profile.totals.filter((row) => row.year === 2024).every((row) => row.period_start === "2024-01-01"));
});
