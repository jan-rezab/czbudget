import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "czbudget-cityvizor-test-"));
const releaseId = "cityvizor-test-release";
const profileKey = "cityvizor.cz/8";
const year = 2025;

function encodedAsset(relativePath, payload, rows) {
  const content = Buffer.from(JSON.stringify(payload));
  const compressed = gzipSync(content, { mtime: 0 });
  return {
    relativePath,
    content,
    compressed,
    descriptor: {
      path: relativePath,
      rows,
      bytes: compressed.length,
      uncompressed_bytes: content.length,
      sha256: sha256(compressed),
      content_sha256: sha256(content),
    },
  };
}

const shard = encodedAsset("profiles/cityvizor-cz/8/2025/payments-0001.json.gz", {
  schema_version: "1.0.0",
  kind: "payments",
  profile_key: profileKey,
  year,
  columns: ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"],
  rows: [
    ["positive-0", "2025-01-02", 0, 12345, "12345678", "Dodavatel", "Rozúčtování faktury", "6171", "5169", null, null],
    ["correction-0", "2025-01-03", 0, -500, "not-an-ico", "Oprava", "Dobropis", "6171", "5169", null, null],
  ],
}, 2);
const alternateShard = encodedAsset("profiles/cityvizor-cz/8/2025/pbo-payment-source-0001.json.gz", {
  schema_version: "1.0.0", kind: "pbo-payment-source", profile_key: profileKey, year,
  columns: ["row_id", "date", "income_cents", "expenditure_cents", "counterparty_id", "counterparty_name", "description", "paragraph", "item", "unit", "event"],
  rows: [["source-view-0", "2025-01-02", 12345, 0, "12345678", "Dodavatel", "Zdrojový pohled", null, "501", "001", null]],
}, 1);

const yearSummary = encodedAsset("profiles/cityvizor-cz/8/2025/summary.json.gz", {
    schema_version: "1.0.0",
    profile_key: profileKey,
    year,
    annual_finance: { recomputed_from_accounting: { income_actual_cents: 10000, expenditure_actual_cents: 11845 } },
    accounting: {}, events: {}, payments: {}, plans: {},
    assets: { accounting: [], events: [], payments: [shard.descriptor], plans: [] },
    alternate_pbo_payment_source_view: { rows: 1, assets: [alternateShard.descriptor] },
}, 2);

const profile = encodedAsset("profiles/cityvizor-cz/8/profile.json.gz", {
  schema_version: "1.0.0",
  profile: { key: profileKey, name: "Uherský Brod", ico: "00291463", type: "municipality" },
  contracts: { rows: 0, records: [] },
  noticeboard: { rows: 0, records: [] },
  years: [{ year, year_summary_asset: yearSummary.descriptor }],
}, 2);

const codelists = encodedAsset("codelists.json.gz", {
  schema_version: "1.0.0", codelists: { paragraphs: [{ id: "6171", name: "Činnost místní správy" }], items: [] },
}, 1);

const indexPayload = {
  schema_version: "1.0.0",
  dataset_id: "cityvizor-normalized-financial-records",
  complete: true,
  money_unit: "integer_cents",
  profile_count: 2,
  profiles_with_payments: 1,
  record_counts: { profile_years: 1, accounting: 0, events: 0, payments: 2, plans: 0, noticeboard: 0 },
  definitions: { payment_record: "A row from CityVizor's KDF/KOF invoice view, not a receipt or proof of bank settlement." },
  codelist_asset: { ...codelists.descriptor, file: codelists.relativePath },
  profiles: [{
    key: profileKey, name: "Uherský Brod", ico: "00291463", type: "municipality",
    available_years: [year], payment_years: [year], record_counts: { accounting: 0, events: 0, payments: 2, plans: 0 },
    profile_asset: profile.descriptor,
  }, {
    key: "cityvizor.cz/9", name: "Městská organizace", ico: "12345678", type: "pbo", parent_profile_key: profileKey,
    available_years: [year], payment_years: [], record_counts: { accounting: 0, events: 0, payments: 0, plans: 1 },
    profile_asset: profile.descriptor,
  }],
};
const index = encodedAsset("index.json.gz", indexPayload, 1);

for (const asset of [index, profile, yearSummary, shard, alternateShard, codelists]) {
  const target = path.join(root, "releases", releaseId, asset.relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, asset.compressed);
}
await fs.writeFile(path.join(root, "current.json"), JSON.stringify({
  schema_version: "1.0.0",
  release_id: releaseId,
  index: `releases/${releaseId}/${index.relativePath}`,
  index_sha256: index.descriptor.sha256,
  index_content_sha256: index.descriptor.content_sha256,
}));

process.env.CITYVIZOR_SNAPSHOT_RELEASE_ROOT = root;
process.env.NODE_ENV = "test";
const { CityVizorStore } = await import("../../server/cityvizor-store.mjs");
const { handler } = await import("../../server/index.mjs");

test.after(async () => fs.rm(root, { recursive: true, force: true }));

test("CityVizor store serves only indexed profile/year/layer assets", async () => {
  const store = new CityVizorStore({ localRoot: root });
  assert.equal((await store.index()).payload.profile_count, 2);
  assert.equal((await store.codelists()).payload.codelists.paragraphs[0].id, "6171");
  assert.equal((await store.profile(profileKey, year)).payload.years[0].year, year);
  const paymentRows = (await store.shard(profileKey, year, "payments", 1)).payload.rows;
  assert.equal(paymentRows.length, 2);
  assert.equal(paymentRows[1][3], -500, "negative corrections remain signed integer cents");
  assert.equal((await store.shard(profileKey, year, "pbo_payment_source_rows", 1)).payload.kind, "pbo-payment-source");
  const municipality = (await store.municipality("00291463")).payload;
  assert.equal(municipality.status, "available");
  assert.equal(municipality.municipality_profiles[0].key, profileKey);
  assert.equal(municipality.organizations[0].key, "cityvizor.cz/9");
  assert.equal("profile_asset" in municipality.municipality_profiles[0], false, "storage descriptors stay private");
  assert.equal((await store.municipality("00000000")).payload.status, "not_published");
  await assert.rejects(store.municipality("291463"), (error) => error.code === "invalid_cityvizor_municipality_ico");
  await assert.rejects(store.shard(profileKey, year, "payments", 2), (error) => error.code === "cityvizor_part_not_found");
  await assert.rejects(store.shard(profileKey, year, "../../secrets", 1), (error) => error.code === "invalid_cityvizor_layer");
  await assert.rejects(store.profile("../escape", year), (error) => error.code === "invalid_cityvizor_profile_key");
});

test("CityVizor public endpoints expose index, selected year and invoice-view rows", async () => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const indexResponse = await fetch(`${base}/public-data/cityvizor/index`);
    assert.equal(indexResponse.status, 200);
    assert.match(indexResponse.headers.get("etag"), /^[\"]?[a-f0-9]{64}/);
    assert.match((await indexResponse.json()).definitions.payment_record, /KDF\/KOF invoice view/);

    const codelistResponse = await fetch(`${base}/public-data/cityvizor/codelists`);
    assert.equal(codelistResponse.status, 200);
    assert.equal((await codelistResponse.json()).codelists.paragraphs[0].id, "6171");

    const profileResponse = await fetch(`${base}/public-data/cityvizor/profile?key=${encodeURIComponent(profileKey)}&year=${year}`);
    assert.equal(profileResponse.status, 200);
    assert.equal((await profileResponse.json()).years.length, 1);

    const shardResponse = await fetch(`${base}/public-data/cityvizor/shard?key=${encodeURIComponent(profileKey)}&year=${year}&layer=payments&part=1`);
    assert.equal(shardResponse.status, 200);
    assert.equal((await shardResponse.json()).rows[1][3], -500);

    const municipalityResponse = await fetch(`${base}/public-data/municipality-cityvizor?ico=00291463`);
    assert.equal(municipalityResponse.status, 200);
    const municipality = await municipalityResponse.json();
    assert.equal(municipality.matched, true);
    assert.equal(municipality.organizations.length, 1);

    const unbounded = await fetch(`${base}/public-data/cityvizor/profile?key=${encodeURIComponent(profileKey)}`);
    assert.equal(unbounded.status, 400);
    assert.equal((await unbounded.json()).error.code, "invalid_cityvizor_year");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
