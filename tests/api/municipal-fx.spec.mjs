import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (relative) => JSON.parse(await readFile(new URL(`../../${relative}`, import.meta.url), "utf8"));

test("annual municipal FX rates cover every published municipal currency", async () => {
  const [fx, municipalities] = await Promise.all([
    readJson("data/municipal-fx-rates.v1.json"),
    readJson("data/international-municipalities.v1.json"),
  ]);

  assert.equal(fx.source.provider, "International Monetary Fund");
  assert.equal(fx.period.start_year, 2005);
  assert.equal(fx.period.end_year, 2024);
  assert.ok(Number(fx.eur_per_usd[2024]) > 0);

  for (const country of municipalities.countries) {
    if (["EUR", "USD"].includes(country.currency)) continue;
    const rate = fx.rates[country.code];
    assert.ok(rate, `${country.code}: missing annual FX series`);
    assert.equal(rate.currency, country.currency, `${country.code}: currency mismatch`);
    assert.ok(Number(rate.years[2024]?.local_per_usd) > 0, `${country.code}: missing latest completed-year rate`);
  }
});
