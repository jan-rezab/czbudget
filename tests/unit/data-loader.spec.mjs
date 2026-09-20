import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../../data-loader.js", import.meta.url), "utf8");
function loader(fetch) {
  const window = {};
  vm.runInNewContext(source, { window, fetch, AbortController, URL, setTimeout, clearTimeout, location: { href: "https://example.org/" } });
  return window.PSDData;
}

test("body timeouts abort both attempts instead of leaving the page loading forever", async () => {
  let calls = 0;
  const data = loader(async (_, { signal }) => {
    calls++;
    return { ok: true, json: () => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))) };
  });
  await assert.rejects(data.loadJson("/slow", { timeoutMs: 5 }), /aborted/);
  assert.equal(calls, 2);
});

test("concurrent consumers share a request and a later retry can fetch again", async () => {
  let calls = 0;
  const data = loader(async () => { calls++; return { ok: true, json: async () => ({ ready: true }) }; });
  const first = data.loadJson("/data.json");
  assert.equal(first, data.loadJson("https://example.org/data.json"));
  await first;
  await data.loadJson("/data.json");
  assert.equal(calls, 2);
});

test("a permanent missing file fails once", async () => {
  let calls = 0;
  const data = loader(async () => { calls++; return { ok: false, status: 404 }; });
  await assert.rejects(data.loadJson("/missing"), /404/);
  assert.equal(calls, 1);
});
