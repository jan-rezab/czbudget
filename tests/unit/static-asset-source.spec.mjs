import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AssetError } from "../../server/static-assets.mjs";
import {
  CREDENTIALS_HELP, MissingCredentialsError, dataFileDigest, isPublishedDataPath, listDataFiles, localAccessToken,
  localAssetOptions, readDataJSON,
} from "../../scripts/lib/static-asset-source.mjs";

const published = {
  "/data/countries/cze/providers.v1.json": { rows: ["published"] },
  "/data/countries/deu/providers.v1.json": { rows: [] },
  "/data/municipal-snapshot.v1.json": { municipalities: [] },
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
function fakeStore() {
  const reads = [];
  return {
    reads,
    async readBuffer(url) { reads.push(url); if (!published[url]) throw new AssetError(404, "asset_not_found"); return Buffer.from(JSON.stringify(published[url])); },
    async entry(url) {
      if (!published[url]) return null;
      const raw = Buffer.from(JSON.stringify(published[url]));
      return { encoding: "gzip", size: 3, sha256: "0".repeat(64), raw_size: raw.length, raw_sha256: sha(raw) };
    },
    async list(prefix) { return Object.keys(published).filter((url) => url.startsWith(prefix)).sort(); },
  };
}

test("a checked-out file wins; an offloaded one is read from the lock; others stay ENOENT", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-source-"));
  try {
    await mkdir(join(root, "data/countries/cze"), { recursive: true });
    await writeFile(join(root, "data/countries/cze/providers.v1.json"), '{"rows":["checkout"]}');
    const store = fakeStore();
    assert.deepEqual(await readDataJSON("data/countries/cze/providers.v1.json", { root, store }), { rows: ["checkout"] });
    assert.deepEqual(store.reads, []);
    assert.deepEqual(await readDataJSON("data/municipal-snapshot.v1.json", { root, store }), { municipalities: [] });
    await assert.rejects(readDataJSON("data/not-offloaded.v1.json", { root, store }), { code: "ENOENT" });
    await assert.rejects(readDataJSON("data/countries/fra/providers.v1.json", { root, store }), { code: "ENOENT" });
    // A checked-out directory is listed from disk; an absent one from the lock.
    assert.deepEqual(await listDataFiles("data/countries", { root, store }), ["data/countries/cze/providers.v1.json"]);
    await rm(join(root, "data/countries"), { recursive: true });
    assert.deepEqual(await listDataFiles("data/countries", { root, store }), ["data/countries/cze/providers.v1.json", "data/countries/deu/providers.v1.json"]);
    assert.deepEqual(await listDataFiles("data/registry/municipal-entities", { root, store }), []);
    // Digests of absent files come from the lock's raw fields without downloading.
    const raw = Buffer.from(JSON.stringify(published["/data/municipal-snapshot.v1.json"]));
    const reads = store.reads.length;
    assert.deepEqual(await dataFileDigest("data/municipal-snapshot.v1.json", { root, store }), { bytes: raw.length, sha256: sha(raw) });
    assert.equal(store.reads.length, reads);
    assert.ok(isPublishedDataPath("data/countries/cze/providers.v1.json"));
    assert.ok(!isPublishedDataPath("data/registry/countries.v1.json"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("missing credentials explain how to log in instead of failing opaquely", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-source-"));
  try {
    const store = { async readBuffer() { throw new MissingCredentialsError(CREDENTIALS_HELP); } };
    await assert.rejects(readDataJSON("data/municipal-snapshot.v1.json", { root, store }), /gcloud auth login/);
    await assert.rejects(localAccessToken({ command: "psd-no-such-gcloud", fetchImpl: async () => { throw new Error("no metadata server"); } }), (error) =>
      error instanceof MissingCredentialsError && /gcloud auth login/.test(error.message) && /no metadata server/.test(error.message));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a hydrated lock is preferred; otherwise the live pointer is read", () => {
  assert.deepEqual({ ...localAssetOptions({ DATA_ASSET_LOCK: "/w/lock.json", DATA_ASSET_PACK_ROOT: "/w" }), tokenProvider: null },
    { tokenProvider: null, maxInFlightBytes: 256 * 1024 * 1024, lockPath: "/w/lock.json", localRoot: "/w" });
  const live = localAssetOptions({});
  assert.equal(live.lockPath, null);
  assert.equal(live.lockObject, "static-assets/current.json");
  assert.equal(live.localRoot, undefined);
});
