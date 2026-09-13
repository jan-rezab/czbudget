import assert from "node:assert/strict";
import test from "node:test";
import { FranceMunicipalLinesStore } from "../../server/france-municipal-lines.mjs";
import { MunicipalLinesStore } from "../../server/municipal-lines.mjs";
import { TradeStore } from "../../server/trade-store.mjs";

const cases = [
  { name: "French detail", Store: FranceMunicipalLinesStore, ttl: 3_600_000,
    call: (s) => s.profile("2a004"), same: (s) => s.profile("2A004"), other: (s) => s.profile("55001"), rows: [] },
  { name: "municipal detail", Store: MunicipalLinesStore, ttl: 600_000,
    call: (s) => s.profile("cze", "00064581"), same: (s) => s.profile("CZE", "00064581"), other: (s) => s.profile("CZE", "00075370"), rows: [] },
  { name: "trade countries", Store: TradeStore, ttl: 900_000,
    call: (s) => s.countries(), same: (s) => s.countries(), rows: [] },
  { name: "trade profile", Store: TradeStore, ttl: 900_000,
    call: (s) => s.profile("cze"), same: (s) => s.profile(" CZE "), other: (s) => s.profile("DEU"),
    rows: [{ row_kind: "total", period: "2025", period_start: "2025-01-01", ref_year: "2025", ref_month: "52", frequency: "A", flow_code: "M", value_usd: "123.45" }] },
  { name: "trade partners", Store: TradeStore, ttl: 900_000,
    call: (s) => s.productPartners("cze", "85"), same: (s) => s.productPartners("CZE", " 85 "), other: (s) => s.productPartners("CZE", "87"),
    rows: [{ ref_year: "2025", flow_code: "M", partner_area_code: "276", partner_iso3: "DEU", partner_name: "Germany", value_usd: "123.45" }] },
];

for (const entry of cases) {
  test(`${entry.name}: concurrent normalized requests share one query and retain the original cache lifetime`, async () => {
    let now = 0;
    const store = new entry.Store({ now: () => now, seedPath: "/nonexistent-test-seed.json" });
    let release;
    let count = 0;
    const gate = new Promise((resolve) => { release = resolve; });
    store.query = async () => { count += 1; await gate; return entry.rows; };
    const requests = [entry.call(store), ...Array.from({ length: 19 }, () => entry.same(store))];
    await Promise.resolve();
    assert.equal(count, 1);
    release();
    const results = await Promise.all(requests);
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.equal(store.pending.size, 0);
    now = entry.ttl - 1;
    assert.deepEqual(await entry.call(store), results[0]);
    assert.equal(count, 1);
    now = entry.ttl;
    assert.deepEqual(await entry.call(store), results[0]);
    assert.equal(count, 2, "expiry must trigger a fresh query at the original TTL");
  });

  test(`${entry.name}: a shared failure is cleared and the next request retries`, async () => {
    const store = new entry.Store({ seedPath: "/nonexistent-test-seed.json" });
    let count = 0;
    const failure = new Error("temporary warehouse failure");
    store.query = async () => { count += 1; throw failure; };
    const results = await Promise.allSettled([entry.call(store), entry.same(store)]);
    assert.equal(count, 1);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      assert.equal(result.reason, failure);
    }
    assert.equal(store.pending.size, 0);
    store.query = async () => { count += 1; return entry.rows; };
    await entry.call(store);
    assert.equal(count, 2);
  });

  if (entry.other) test(`${entry.name}: different requests are never coalesced`, async () => {
    const store = new entry.Store({ seedPath: "/nonexistent-test-seed.json" });
    let count = 0;
    store.query = async () => { count += 1; return entry.rows; };
    await Promise.all([entry.call(store), entry.other(store)]);
    assert.equal(count, 2);
  });
}
