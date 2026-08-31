import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { EMBEDDABLE, canonicalURL, embedHTML, embedURL, oembed, slugFromURL, titleOf } from "../../server/embed.mjs";

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

test("a chart URL resolves to its chart, by fragment or by embed parameter", () => {
  assert.equal(slugFromURL("https://publicspendingdata.org/index.html#home-gross-debt-gdp"), "home-gross-debt-gdp");
  assert.equal(slugFromURL("https://publicspendingdata.org/index.html?embed=home-gdp-per-capita"), "home-gdp-per-capita");
});

test("a bare page URL resolves to the chart at the top of it", () => {
  // oEmbed discovery is per document and a fragment never reaches the server, so a consumer
  // following the page's <link rel=alternate> sends no chart name at all.
  assert.equal(slugFromURL("https://publicspendingdata.org/index.html"), "home-government-expenditure-gdp");
  assert.equal(slugFromURL("https://publicspendingdata.org/"), "home-government-expenditure-gdp");
});

test("a page with no embeddable chart is refused rather than guessed at", () => {
  assert.throws(() => slugFromURL("https://publicspendingdata.org/methodology.html"), /names no chart/);
  assert.throws(() => slugFromURL("not a url"), /not a URL/);
});

test("an arbitrary slug cannot be framed under someone else's headline", () => {
  // The registry is the allow-list. Without it, /embed/<anything> would let any page of this
  // site be framed, which is a different thing from publishing five charts for reuse.
  assert.throws(() => slugFromURL("https://publicspendingdata.org/index.html#cesky-rozpocet"), /No embeddable chart/);
});

test("the snippet carries a crawlable link home as well as the frame", () => {
  const html = embedHTML("home-gross-debt-gdp", { origin: "https://publicspendingdata.org", lang: "en" });
  assert.match(html, /<iframe /);
  // A reader with frames blocked still learns where the figure came from, and the anchor is
  // the part that makes hosting the embed worth anything to this site.
  assert.match(html, /<a href="https:\/\/publicspendingdata\.org\/index\.html\?lang=en#home-gross-debt-gdp">/);
  assert.match(html, /loading="lazy"/);
});

test("the embed URL and the canonical URL are not the same page", () => {
  const embed = embedURL("home-gdp-per-capita", "https://publicspendingdata.org");
  const canonical = canonicalURL("home-gdp-per-capita", "https://publicspendingdata.org");
  assert.notEqual(embed, canonical);
  assert.match(embed, /embed=home-gdp-per-capita/);
  assert.match(canonical, /#home-gdp-per-capita$/);
});

test("titles are the chart's own name, in the language asked for", () => {
  assert.equal(titleOf("home-gross-debt-gdp", "en"), "General government gross debt, % of GDP");
  assert.equal(titleOf("home-gross-debt-gdp", "cs"), "Hrubý dluh sektoru vládních institucí, % HDP");
  assert.equal(titleOf("home-gross-debt-gdp", "de"), "General government gross debt, % of GDP", "an unknown language falls back rather than showing a slug");
});

test("maxwidth and maxheight are honoured within bounds", () => {
  const params = new URLSearchParams({ url: "https://publicspendingdata.org/index.html#home-gross-debt-gdp", maxwidth: "9999", maxheight: "10" });
  const payload = oembed(params);
  assert.equal(payload.width, 1600, "an unbounded width would let a host stretch the frame arbitrarily");
  assert.equal(payload.height, 200);
});

test("only the json format is served, and unsupported ones say so", () => {
  const params = new URLSearchParams({ url: "https://publicspendingdata.org/index.html", format: "xml" });
  assert.throws(() => oembed(params), /json format/);
});

test("the oEmbed endpoint answers publicly and cacheably", async () => {
  const target = encodeURIComponent("https://publicspendingdata.org/index.html#home-surplus-frequency");
  const response = await fetch(`${baseURL}/api/v1/oembed?url=${target}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /public/);
  const payload = await response.json();
  const data = payload.data || payload;
  assert.equal(data.version, "1.0");
  assert.equal(data.type, "rich");
  assert.equal(data.provider_name, "Public Spending Data");
  assert.ok(data.html.includes("home-surplus-frequency"));
});

test("an unembeddable chart is a 404, not an empty frame", async () => {
  const target = encodeURIComponent("https://publicspendingdata.org/index.html#not-a-chart");
  const response = await fetch(`${baseURL}/api/v1/oembed?url=${target}`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "chart_not_embeddable");
});

test("/embed/<slug> redirects to the form that works without this server in front", async () => {
  // The snippet points at the query form on purpose: the pages are static, and an embed that
  // only resolves when the API server is the front door would break on a plain static host.
  const response = await fetch(`${baseURL}/embed/home-gdp-per-capita-ppp`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/index.html?embed=home-gdp-per-capita-ppp");
});

test("/embed/ with an unknown slug is a 404", async () => {
  const response = await fetch(`${baseURL}/embed/nope`, { redirect: "manual" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "chart_not_embeddable");
});

test("every embeddable chart declares a title in both site languages", () => {
  for (const [slug, entry] of Object.entries(EMBEDDABLE)) {
    assert.ok(entry.title?.cs, `${slug} has no Czech title`);
    assert.ok(entry.title?.en, `${slug} has no English title`);
    assert.ok(entry.height > 0, `${slug} has no frame height, so every host would guess one`);
  }
});
