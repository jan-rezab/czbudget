import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "czbudget-public-snapshot-test-"));
const releaseId = "test-release";
const routePath = "/municipalities/testland/example-123/";
const profile = { country: "TST", code: "123", name: "Example", currency: "EUR", years: [2025], history: [], detail: [] };
const history = { series: [{ year: 2025, revenue_actual: 10, expense_actual: 8 }] };
const payloadHash = crypto.createHash("sha256").update(`${JSON.stringify(profile)}\n${JSON.stringify(history)}`).digest("hex");
const objectKey = `releases/${releaseId}/shards/000.jsonl.gz`;
const route = { path: routePath, profile_id: "TST:123", country_code: "TST", entity_code: "123", entity_name: "Example", shard_key: objectKey, payload_sha256: payloadHash };

await fs.mkdir(path.join(fixtureRoot, path.dirname(objectKey)), { recursive: true });
const shardBody = `${JSON.stringify({
  schema_version: "1.0.0", release_id: releaseId, profile_id: route.profile_id,
  canonical_path: routePath, payload_sha256: payloadHash, profile, history,
})}\n`;
await fs.writeFile(path.join(fixtureRoot, objectKey), gzipSync(shardBody));
await fs.writeFile(path.join(fixtureRoot, `releases/${releaseId}/routes.v1.json.gz`), gzipSync(JSON.stringify({
  schema_version: "2.0.0", release_id: releaseId, routes: [route],
  shards: { "000": { object_key: objectKey, profile_count: 1, body_sha256: crypto.createHash("sha256").update(shardBody).digest("hex") } },
})));
await fs.writeFile(path.join(fixtureRoot, "current.json"), JSON.stringify({ release_id: releaseId, routes: `releases/${releaseId}/routes.v1.json.gz` }));
process.env.PUBLIC_SNAPSHOT_RELEASE_ROOT = fixtureRoot;
process.env.NODE_ENV = "test";

const { handler } = await import("../../server/index.mjs");
const { SnapshotStore, canonicalMunicipalityPath } = await import("../../server/snapshot-store.mjs");
const { municipalityPage } = await import("../../server/municipality-page.mjs");

test.after(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

test("snapshot store resolves and verifies an immutable profile", async () => {
  const store = new SnapshotStore({ localRoot: fixtureRoot });
  const result = await store.profileForPath(routePath);
  assert.equal(result.release_id, releaseId);
  assert.deepEqual(result.profile, profile);
  assert.deepEqual(result.history, history);
  assert.equal((await store.status()).route_count, 1);
});

test("snapshot store remains compatible with the previous per-profile release during rollout", async () => {
  const legacyRoot = await fs.mkdtemp(path.join(os.tmpdir(), "czbudget-public-snapshot-legacy-"));
  const legacyKey = `releases/${releaseId}/profiles/tst/MTIz.json.gz`;
  const legacyRoute = { ...route, shard_key: undefined, object_key: legacyKey };
  try {
    await fs.mkdir(path.join(legacyRoot, path.dirname(legacyKey)), { recursive: true });
    await fs.writeFile(path.join(legacyRoot, legacyKey), gzipSync(JSON.stringify({
      schema_version: "1.0.0", release_id: releaseId, profile_id: route.profile_id,
      canonical_path: routePath, payload_sha256: payloadHash, profile, history,
    })));
    await fs.writeFile(path.join(legacyRoot, `releases/${releaseId}/routes.v1.json.gz`), gzipSync(JSON.stringify({ release_id: releaseId, routes: [legacyRoute] })));
    await fs.writeFile(path.join(legacyRoot, "current.json"), JSON.stringify({ release_id: releaseId, routes: `releases/${releaseId}/routes.v1.json.gz` }));
    const store = new SnapshotStore({ localRoot: legacyRoot });
    assert.deepEqual((await store.profileForPath(routePath)).profile, profile);
  } finally {
    await fs.rm(legacyRoot, { recursive: true, force: true });
  }
});

test("canonical municipality paths reject unrelated routes", () => {
  assert.equal(canonicalMunicipalityPath(`${routePath}?lang=en`), routePath);
  assert.throws(() => canonicalMunicipalityPath("/countries/testland/"), /canonical municipality profile path/);
});

test("every Czech snapshot page advertises its warehouse line-item target", () => {
  const page = municipalityPage({
    route: {
      path: "/cz/municipalities/plzen/", country_code: "CZE", entity_code: "00075370",
      entity_name: "Plzeň",
    },
    release_id: "test-release",
    history: { series: [] },
  });
  assert.match(page, /data-warehouse-country="CZE"/);
  assert.match(page, /data-warehouse-code="00075370"/);
  assert.match(page, /data-profile-url="\/public-data\/municipality-profile/);
});

test("public endpoints and dynamic HTML do not require API authentication", async () => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const profileResponse = await fetch(`http://127.0.0.1:${address.port}/public-data/municipality-profile?path=${encodeURIComponent(routePath)}`);
    assert.equal(profileResponse.status, 200);
    assert.deepEqual(await profileResponse.json(), profile);
    assert.match(profileResponse.headers.get("cache-control"), /public/);

    const pageResponse = await fetch(`http://127.0.0.1:${address.port}${routePath}`);
    assert.equal(pageResponse.status, 200);
    const page = await pageResponse.text();
    assert.match(page, /Example municipal finances/);
  assert.match(page, /public-data\/municipality-profile/);
    assert.doesNotMatch(page, /Loading the current audited profile/);
    assert.match(page, /<strong>€10<\/strong>/);
    assert.match(page, /Budget over time/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
