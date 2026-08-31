import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { columnsOf, findRows, toCSV, exportDataset } from "../../server/bulk-export.mjs";

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

test("a table keyed by country is found, not the sources block beside it", () => {
  // country-revenue's only top-level array is `sources`; its real table is a map keyed by
  // country code. Picking the largest array alone exported three source URLs as "revenue".
  const payload = {
    sources: [{ url: "a" }, { url: "b" }, { url: "c" }],
    countries: { CZE: { tax_mix: 1 }, DEU: { tax_mix: 2 }, DNK: { tax_mix: 3 }, ESP: { tax_mix: 4 } },
  };
  const { key, rows } = findRows(payload);
  assert.equal(key, "countries");
  assert.equal(rows.length, 4);
  assert.equal(rows[0].id, "CZE", "the map key is the row identity and must survive as a column");
});

test("columns are the union of every row's keys, not the first row's", () => {
  const rows = [{ a: 1 }, { a: 2, b: 3 }, { c: 4 }];
  assert.deepEqual(columnsOf(rows), ["a", "b", "c"]);
  const csv = toCSV(rows);
  assert.match(csv.split("\r\n")[0], /a,b,c$/);
  assert.equal(csv.split("\r\n")[1], "1,,");
});

test("CSV quoting survives commas, quotes and newlines", () => {
  const csv = toCSV([{ name: 'A "quoted", value', note: "line\nbreak", empty: null }]);
  const [, row] = csv.split("\r\n");
  assert.ok(row.includes('"A ""quoted"", value"'), "quotes double and the field is wrapped");
  assert.ok(row.includes('"line\nbreak"'), "an embedded newline stays inside a quoted field");
  assert.ok(row.endsWith(","), "null becomes empty, not the string null");
});

test("the export carries the source's vintage, not the moment it was rendered", () => {
  const exported = exportDataset({
    schema_version: "1.1.0",
    generated_at: "2026-08-28T18:19:47Z",
    countries: [{ code: "CZE" }],
  });
  assert.equal(exported.vintage, "2026-08-28T18:19:47Z");
  assert.equal(exported.schema_version, "1.1.0");
  assert.equal(exported.rows, 1);
  // Two renders of the same release must be byte-identical, or the checksum is meaningless.
  const again = exportDataset({
    schema_version: "1.1.0",
    generated_at: "2026-08-28T18:19:47Z",
    countries: [{ code: "CZE" }],
  });
  assert.equal(exported.sha256, again.sha256);
});

test("the bulk manifest lists every dataset with a checksum and a vintage", async () => {
  const response = await fetch(`${baseURL}/api/v1/bulk`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.dataset_count >= 15);
  for (const dataset of payload.datasets) {
    assert.ok(dataset.id, "every entry names its dataset");
    if (dataset.available === false) continue;
    assert.match(dataset.sha256, /^[0-9a-f]{64}$/, `${dataset.id} needs a checksum`);
    assert.ok(dataset.rows > 0, `${dataset.id} exported no rows — the table was not found`);
    assert.equal(dataset.csv, `/api/v1/bulk/${dataset.id}.csv`);
  }
});

test("a dataset downloads as CSV with its checksum as the ETag", async () => {
  const manifest = await (await fetch(`${baseURL}/api/v1/bulk`)).json();
  const fiscal = manifest.datasets.find((d) => d.id === "fiscal");

  const response = await fetch(`${baseURL}/api/v1/bulk/fiscal.csv`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/csv/);
  assert.match(response.headers.get("content-disposition"), /filename="fiscal\.csv"/);
  assert.equal(response.headers.get("x-dataset-rows"), String(fiscal.rows));
  assert.equal(response.headers.get("etag"), `"${fiscal.sha256.slice(0, 32)}"`);

  // The BOM must be checked on the bytes: fetch().text() strips it while decoding UTF-8, so
  // asserting on the decoded string would fail even though the download is correct.
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "a BOM so Excel reads UTF-8 rather than mojibake");
  const body = new TextDecoder("utf-8").decode(bytes);
  assert.equal(body.split("\r\n").filter(Boolean).length, fiscal.rows + 1, "one header plus one line per row");
});

test("bulk needs no token and is shared-cacheable", async () => {
  const response = await fetch(`${baseURL}/api/v1/bulk/spending.csv`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /public/);
  assert.equal(response.headers.get("x-authenticated-user"), null);
});

test("an unknown dataset is a 404, not an empty CSV", async () => {
  const response = await fetch(`${baseURL}/api/v1/bulk/not-a-dataset.csv`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "dataset_not_found");
});
