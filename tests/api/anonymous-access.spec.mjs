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

const anonymous = (pathname) => fetch(`${baseURL}${pathname}`);
const authenticated = (pathname) =>
  fetch(`${baseURL}${pathname}`, { headers: { authorization: "Bearer test-token" } });

test("read-only API routes answer without a token", async () => {
  for (const pathname of [
    "/api/v1",
    "/api/v1/datasets",
    "/api/v1/countries",
    "/api/v1/countries/CZE",
    "/api/v1/capital-cities",
    "/api/v1/municipalities?country=CZE&limit=1",
    "/api/v1/public-entities?country=CZE&limit=1",
  ]) {
    const response = await anonymous(pathname);
    assert.equal(response.status, 200, `${pathname} should answer anonymously`);
    const payload = await response.json();
    assert.ok(payload.data !== undefined || Array.isArray(payload.items), `${pathname} returned no data`);
  }
});

test("anonymous answers are shared-cacheable and carry no user identity", async () => {
  const response = await anonymous("/api/v1/countries");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.equal(response.headers.get("x-authenticated-user"), null);
});

test("a token still buys the higher quota and a private answer", async () => {
  const response = await authenticated("/api/v1/countries");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, max-age=60");
  assert.equal(response.headers.get("x-authenticated-user"), "test-user");
});

test("the OpenAPI contract and docs are public", async () => {
  const specification = await anonymous("/docs/openapi.json");
  assert.equal(specification.status, 200);
  assert.equal(specification.headers.get("cache-control"), "public, max-age=300");
  const payload = await specification.json();
  assert.equal(payload.openapi, "3.1.0");

  const docs = await anonymous("/docs");
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /Public Spending Data API/);
});

test("a presented but invalid token fails loudly instead of downgrading", async () => {
  process.env.AUTH_DISABLED_FOR_TESTS = "0";
  try {
    const response = await fetch(`${baseURL}/api/v1/countries`, {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error.code, "invalid_token");
  } finally {
    process.env.AUTH_DISABLED_FOR_TESTS = "1";
  }
});

test("an unknown API route still 404s anonymously rather than 401ing", async () => {
  const response = await anonymous("/api/v1/not-a-real-endpoint");
  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.error.code, "endpoint_not_found");
});
