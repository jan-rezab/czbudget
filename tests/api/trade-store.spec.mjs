import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCountryCode, TRADE_PROFILE_SQL, TradeError, TradeStore } from "../../server/trade-store.mjs";

test("trade country codes are strict ISO-3 values", () => {
  assert.equal(normalizeCountryCode(" cze "), "CZE");
  assert.throws(() => normalizeCountryCode("Czechia"), (error) => error instanceof TradeError && error.code === "invalid_trade_country");
});

test("trade query is partition-pruned and selects one product grain", () => {
  assert.match(TRADE_PROFILE_SQL, /period_start BETWEEN @min_date AND CURRENT_DATE\(\)/);
  assert.match(TRADE_PROFILE_SQL, /aggregation_level = MAX\(aggregation_level\)/);
  assert.match(TRADE_PROFILE_SQL, /partner_area_code = 0/);
  assert.match(TRADE_PROFILE_SQL, /partner_area_code != 0/);
  assert.doesNotMatch(TRADE_PROFILE_SQL, /SELECT \* FROM `czbudget-janrezab\.budget_detail\.trade_observations`/);
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
