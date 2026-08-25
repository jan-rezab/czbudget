import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "test";
process.env.AUTH_DISABLED_FOR_TESTS = "1";
process.env.API_IP_MINUTE_LIMIT = "100";
process.env.API_USER_MINUTE_LIMIT = "2";
process.env.API_USER_DAY_LIMIT = "100";
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

function api(pathname) {
  return fetch(`${baseURL}${pathname}`, { headers: { authorization: "Bearer test-token" } });
}

test("enforces the per-user API maximum and returns retry metadata", async () => {
  assert.equal((await api("/api/v1")).status, 200);
  const second = await api("/api/v1");
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("ratelimit-remaining"), "0");

  const blocked = await api("/api/v1");
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get("ratelimit-policy"), /api-user-minute/);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal((await blocked.json()).error.code, "rate_limit_exceeded");
});

test("rejects an oversized request URL before API processing", async () => {
  const response = await api(`/api/v1/municipalities?q=${"x".repeat(5_000)}`);
  assert.equal(response.status, 414);
  assert.equal((await response.json()).error.code, "request_uri_too_long");
});
