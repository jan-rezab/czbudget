import assert from "node:assert/strict";
import test from "node:test";

import { COUNTRIES, MunicipalLinesStore, resolveCountry } from "../../server/municipal-lines.mjs";
import { FRANCE_MUNICIPAL_LINES_SQL } from "../../server/france-municipal-lines.mjs";

const FIELDS = [
  "fiscal_year", "budget_stage", "budget_side", "reporting_scope",
  "code", "column_label", "amount_local", "source_ids",
];

const row = (values) => ({ f: values.map((v) => ({ v })) });

function storeReturning(rows, capture = {}) {
  return new MunicipalLinesStore({
    tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      capture.count = (capture.count || 0) + 1;
      capture.body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        schema: { fields: FIELDS.map((name) => ({ name })) },
        rows,
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
}

test("every configured country declares what the query needs", () => {
  for (const [code, country] of Object.entries(COUNTRIES)) {
    assert.match(code, /^[A-Z]{3}$/, `${code} should be ISO alpha-3`);
    assert.match(country.prefix, /^[A-Z]{2}$/, `${code} prefix should be the warehouse's alpha-2 namespace`);
    assert.ok(country.scopes.length > 0, `${code} needs at least one reporting scope`);
    assert.ok(country.years.length >= 1, `${code} needs a partition range`);
    assert.ok(country.currency && country.sourceUrl, `${code} needs a currency and a source`);
  }
});

test("an unwarehoused country is a clear 404, not an empty result", async () => {
  await assert.rejects(() => storeReturning([]).profile("ZZZ", "1234567"), (error) => {
    assert.equal(error.status, 404);
    assert.equal(error.code, "country_not_warehoused");
    return true;
  });
});

test("municipality codes are validated before any warehouse request", async () => {
  const capture = {};
  const store = storeReturning([], capture);
  await assert.rejects(() => store.profile("BRA", "123"), (error) => error.code === "invalid_municipality_code");
  await assert.rejects(() => store.profile("BRA", "5218300 OR TRUE"), (error) => error.code === "invalid_municipality_code");
  assert.equal(capture.count, undefined, "no query should be issued for an invalid code");
});

test("Brazilian lines resolve through the warehouse entity namespace", async () => {
  const capture = {};
  const store = storeReturning([
    row(["2025", "actual", "expenditure", "standalone_municipality", "DespesasCorrentes", "Até o Bimestre (c)", "1250.50", "br-siconfi-rreo-2025"]),
    row(["2025", "enacted", "revenue", "standalone_municipality", "ReceitasCorrentes", "PREVISÃO INICIAL", "980.25", "br-siconfi-rreo-2025"]),
  ], capture);

  const result = await store.profile("BRA", "5218300");
  assert.equal(result.country, "BRA");
  assert.equal(result.entity_code, "5218300");
  assert.equal(result.currency, "BRL");
  assert.deepEqual(result.years, [2025]);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].amount, 1250.5);
  assert.equal(result.lines[0].source_column, "Até o Bimestre (c)");
  assert.deepEqual(result.coverage.stages, ["actual", "enacted"]);
  assert.deepEqual(result.sources, ["br-siconfi-rreo-2025"]);

  // The warehouse keys entities alpha-2; the artifacts carry alpha-3. The store bridges
  // the two, which is the whole reason the entity registry exists.
  const [entityID, minYear, maxYear] = capture.body.queryParameters.map((p) => p.parameterValue.value);
  assert.equal(entityID, "BR:5218300");
  assert.equal(minYear, "2024");
  assert.equal(maxYear, "2025");
});

test("the query stays partition-bounded, parameterised and scope-filtered", async () => {
  const capture = {};
  await storeReturning([], capture).profile("BRA", "5218300");
  const sql = capture.body.query;
  assert.match(sql, /fiscal_year BETWEEN @min_year AND @max_year/);
  assert.match(sql, /public_entity_id = @entity_id/);
  assert.match(sql, /reporting_scope IN \('standalone_municipality'\)/);
  assert.match(sql, /NOT is_summary_row/, "published totals must not be served as leaf lines");
  assert.match(sql, /NOT is_consolidation_item/, "intra-budgetary transfers must not double-count");
  assert.doesNotMatch(sql, /5218300/, "the entity code must never be interpolated into SQL");
});

test("repeat reads are served from the bounded cache", async () => {
  const capture = {};
  const store = storeReturning([
    row(["2025", "actual", "expenditure", "standalone_municipality", "X", null, "1", "br-siconfi-rreo-2025"]),
  ], capture);
  await store.profile("BRA", "5218300");
  await store.profile("BRA", "5218300");
  assert.equal(capture.count, 1, "the second read should not hit the warehouse");
});

test("resolveCountry is case-insensitive and returns the warehouse prefix", () => {
  assert.equal(resolveCountry("bra").prefix, "BR");
  assert.equal(resolveCountry("BRA").code, "BRA");
});

test("France answers through the generic endpoint with its own structure intact", async () => {
  const capture = {};
  const store = new MunicipalLinesStore({
    tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      capture.body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        schema: {
          fields: ["dimension", "fiscal_year", "budget_stage", "budget_side", "reporting_scope",
            "code", "nomenclature", "amount_local", "source_ids"].map((name) => ({ name })),
        },
        rows: [
          { f: ["economic", "2025", "actual", "expenditure", "main_budget", "60612", "M57", "1250.50", "fr-dgfip-balances-fonction-2025"].map((v) => ({ v })) },
          { f: ["functional", "2025", "actual", "expenditure", "main_budget", "212", "M57", "980.25", "fr-dgfip-balances-fonction-2025"].map((v) => ({ v })) },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await store.profile("FRA", "55001");
  assert.equal(result.country, "FRA");
  assert.equal(result.currency, "EUR");

  // The two classifications survive generalisation rather than collapsing into one list.
  assert.deepEqual(result.coverage.dimensions, { economic: 1, functional: 1 });
  const economic = result.lines.find((line) => line.dimension === "economic");
  const functional = result.lines.find((line) => line.dimension === "functional");
  assert.equal(economic.name_en, "Energy and electricity");
  assert.equal(functional.name_en, "Education and training");
  assert.equal(economic.nomenclature, "M57");
  assert.ok(economic.name_native, "the French label is carried, not dropped");

  // France brings its own query and its own entity namespace.
  assert.equal(capture.body.query, FRANCE_MUNICIPAL_LINES_SQL);
  assert.equal(capture.body.queryParameters[0].parameterValue.value, "FR:55001");
});

test("a single-classification country carries no dimension or label fields", async () => {
  const capture = {};
  const store = storeReturning([
    row(["2025", "actual", "expenditure", "standalone_municipality", "X", "col", "1", "br-siconfi-rreo-2025"]),
  ], capture);
  const result = await store.profile("BRA", "5218300");
  assert.equal(result.lines[0].dimension, undefined, "no invented classification");
  assert.equal(result.lines[0].name_en, undefined, "no invented label");
  assert.equal(result.coverage.dimensions, undefined);
});

test("French commune codes keep their Corsican form", async () => {
  const store = storeReturning([]);
  await assert.doesNotReject(() => store.profile("FRA", "2A004"));
  await assert.rejects(() => store.profile("FRA", "5218300"), (e) => e.code === "invalid_municipality_code");
});

test("a within-year slice never collapses into the full-year figure", async () => {
  const capture = {};
  const store = new MunicipalLinesStore({
    tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      capture.body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        schema: {
          fields: ["fiscal_year", "fiscal_period", "budget_stage", "budget_side", "reporting_scope",
            "code", "column_label", "amount_local", "source_ids"].map((name) => ({ name })),
        },
        rows: [
          { f: ["2025", "FY", "actual", "revenue", "standalone_municipality", "X", "Até o Bimestre (c)", "1000", "br"].map((v) => ({ v })) },
          { f: ["2025", "B6", "actual", "revenue", "standalone_municipality", "X", "No Bimestre (b)", "200", "br"].map((v) => ({ v })) },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await store.profile("BRA", "5218300");
  // Same year, same stage, same code — but one is the year and one is a bimester inside it.
  // They must arrive as two facts, or a caller summing them reports 1200 for a year of 1000.
  assert.equal(result.lines.length, 2);
  assert.deepEqual(result.lines.map((line) => line.period).sort(), ["B6", "FY"]);
  assert.match(capture.body.query, /GROUP BY 1, 2, 3, 4, 5, 6, 7/);
  assert.match(capture.body.query, /fiscal_period/);
});

test("Brazil's execution phases are distinct stages, not one blurred actual", async () => {
  const brazil = COUNTRIES.BRA;
  assert.match(brazil.methodology, /do not add them together/i,
    "the contract must warn that committed, actual and paid describe the same money");
});

test("every configured country's code pattern accepts its real entity codes", async () => {
  // Each pattern was derived from the actual entity codes in the uniform layer, so a
  // representative code per country must validate — a pattern that rejects real data would
  // 400 every request for that country while looking correct in review.
  const REAL_CODES = {
    BOL: "3101", BRA: "5218300", CHL: "02101", COL: "210205002", CRI: "SIPP-ABANGARES",
    ESP: "44001AA000", FRA: "55001", GEO: "MOF-033", GTM: "12101612", ITA: "000105310",
    KOR: "4213000", MEX: "01001", PER: "300023", SLV: "8301", DNK: "306",
  };
  const store = storeReturning([]);
  for (const [code, entity] of Object.entries(REAL_CODES)) {
    assert.ok(COUNTRIES[code], `${code} should be configured`);
    await assert.doesNotReject(() => store.profile(code, entity), `${code}: ${entity} should validate`);
  }
  assert.equal(Object.keys(COUNTRIES).length, Object.keys(REAL_CODES).length,
    "every configured country needs a code in this test");
});

test("a code from the wrong country is rejected, not silently queried", async () => {
  const store = storeReturning([]);
  // Spain's ten-character code must not pass as a four-digit Bolivian one, and vice versa.
  await assert.rejects(() => store.profile("BOL", "44001AA000"), (e) => e.code === "invalid_municipality_code");
  await assert.rejects(() => store.profile("ESP", "3101"), (e) => e.code === "invalid_municipality_code");
  await assert.rejects(() => store.profile("ITA", "SIPP-ABANGARES"), (e) => e.code === "invalid_municipality_code");
});
