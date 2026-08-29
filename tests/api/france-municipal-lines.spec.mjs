import assert from "node:assert/strict";
import test from "node:test";

import { FranceMunicipalLinesStore, FRANCE_MUNICIPAL_LINES_SQL } from "../../server/france-municipal-lines.mjs";

const fields = ["dimension", "fiscal_year", "budget_stage", "budget_side", "reporting_scope", "code", "nomenclature", "amount_local", "source_ids"];

test("French municipal line query is partition-bounded and parameterized", () => {
  assert.match(FRANCE_MUNICIPAL_LINES_SQL, /fiscal_year BETWEEN @min_year AND @max_year/);
  assert.match(FRANCE_MUNICIPAL_LINES_SQL, /public_entity_id = @entity_id/);
  assert.doesNotMatch(FRANCE_MUNICIPAL_LINES_SQL, /55001/);
});

test("French municipal lines separate economic accounts from functional purpose", async () => {
  let requests = 0;
  let requestBody;
  const store = new FranceMunicipalLinesStore({
    tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      requests += 1;
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        schema: { fields: fields.map((name) => ({ name })) },
        rows: [
          { f: ["economic", "2025", "actual", "expenditure", "main_budget", "60612", "M57", "1250.50", "fr-dgfip-balances-fonction-2025"].map((v) => ({ v })) },
          { f: ["functional", "2025", "actual", "expenditure", "main_budget", "212", "M57", "1250.50", "fr-dgfip-balances-fonction-2025"].map((v) => ({ v })) },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await store.profile("55001");
  assert.equal(result.entity_code, "55001");
  assert.equal(result.economic[0].name_en, "Energy and electricity");
  assert.equal(result.functional[0].name_en, "Education and training");
  assert.equal(result.coverage.functional_purpose_detail, true);
  assert.deepEqual(requestBody.queryParameters.map((entry) => entry.parameterValue.value), ["FR:55001", "2024", "2026"]);

  await store.profile("55001");
  assert.equal(requests, 1, "the second read should use the bounded in-memory cache");
});

test("French municipality codes are validated before any warehouse request", async () => {
  const store = new FranceMunicipalLinesStore({
    tokenProvider: async () => { throw new Error("must not request a token"); },
  });
  await assert.rejects(() => store.profile("55001 OR TRUE"), (error) => error.code === "invalid_france_commune_code");
});

