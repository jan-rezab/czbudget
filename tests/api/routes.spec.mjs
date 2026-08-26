import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "test";
process.env.AUTH_DISABLED_FOR_TESTS = "1";
process.env.SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { handler } = await import("../../server/index.mjs");
let server;
let baseURL;

before(async () => {
  server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(pathname) {
  return fetch(`${baseURL}${pathname}`, { headers: { authorization: "Bearer test-token" } });
}

test("serves the authenticated docs and OpenAPI contract", async () => {
  const docs = await get("/docs");
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /Public Spending Data API/);

  const specification = await get("/docs/openapi.json");
  assert.equal(specification.status, 200);
  const payload = await specification.json();
  assert.equal(payload.openapi, "3.1.0");
  assert.ok(Object.keys(payload.paths).length >= 25);
});

test("serves country modules from the production artifacts", async () => {
  for (const module of ["fiscal", "spending", "spending/comparison", "spending/functions", "revenue", "health", "health/performance", "demography", "transport"]) {
    const response = await get(`/api/v1/countries/CZE/${module}`);
    assert.equal(response.status, 200, module);
    assert.match(response.headers.get("content-type"), /application\/json/);
  }
});

test("serves every published country through the API", async () => {
  const response = await get("/api/v1/countries");
  const payload = await response.json();
  const codes = payload.data.map((country) => country.country_code);
  assert.equal(response.status, 200);
  assert.deepEqual(codes, ["CZE", "UKR", "POL", "DEU", "GBR", "FRA", "USA", "CHE", "SWE", "DNK", "FIN", "BRA", "ESP", "JPN", "NLD", "NOR", "GRC"]);

  for (const country of ["FIN", "BRA", "ESP", "JPN", "NLD", "NOR", "GRC"]) {
    const profile = await get(`/api/v1/countries/${country}`);
    assert.equal(profile.status, 200, `${country} profile`);
    assert.equal((await profile.json()).data.country_code, country);

    const fiscal = await get(`/api/v1/countries/${country}/fiscal`);
    assert.equal(fiscal.status, 200, `${country} fiscal`);
    assert.equal((await fiscal.json()).data.country.country_code, country);
  }
});

test("paginates municipality and public-entity searches", async () => {
  const municipalities = await get("/api/v1/municipalities?country=CZE&limit=2");
  const municipalityPage = await municipalities.json();
  assert.equal(municipalities.status, 200);
  assert.equal(municipalityPage.data.length, 2);
  assert.ok(municipalityPage.meta.next_cursor);

  const entities = await get("/api/v1/public-entities?country=CZE&q=Lesn%C3%AD&limit=2");
  const entityPage = await entities.json();
  assert.equal(entities.status, 200);
  assert.ok(entityPage.data.length > 0);
  assert.match(entityPage.data[0].name, /Lesn/i);
});

test("rejects abusive pagination and search parameters", async () => {
  for (const pathname of [
    "/api/v1/municipalities?limit=0",
    "/api/v1/municipalities?limit=201",
    "/api/v1/municipalities?limit=1.5",
    "/api/v1/municipalities?limit=1&limit=2",
    "/api/v1/municipalities?cursor=not-a-valid-cursor",
    "/api/v1/municipalities?country=CZECHIA",
    `/api/v1/municipalities?q=${"x".repeat(101)}`,
    "/api/v1/public-entities?country=CZE&q=one&q=two",
  ]) {
    const response = await get(pathname);
    assert.equal(response.status, 400, pathname);
    assert.match((await response.json()).error.code, /invalid_|query_too_long|duplicate_parameter/);
  }
});

test("serves Czech municipal current and historical detail", async () => {
  const current = await get("/api/v1/municipalities/CZE/00064581/budget");
  assert.equal(current.status, 200);
  assert.equal((await current.json()).data.entity.national_id, "00064581");

  const history = await get("/api/v1/municipalities/CZE/00064581/history");
  assert.equal(history.status, 200);
  assert.equal((await history.json()).data.municipality.national_id, "00064581");
});

test("returns stable JSON errors", async () => {
  const response = await get("/api/v1/countries/XXX");
  const payload = await response.json();
  assert.equal(response.status, 404);
  assert.equal(payload.error.code, "country_not_found");
  assert.ok(payload.error.request_id);
});
