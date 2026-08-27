#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const parity = JSON.parse(await readFile(new URL("data/country-parity.v1.json", root), "utf8"));
const sitemapUrl = new URL("sitemap.xml", root);
let sitemap = await readFile(sitemapUrl, "utf8");
const readable = {
  CZE:"czechia",DEU:"germany",DNK:"denmark",FIN:"finland",FRA:"france",GBR:"united-kingdom",
  POL:"poland",SWE:"sweden",CHE:"switzerland",UKR:"ukraine",USA:"united-states",BRA:"brazil",
  ESP:"spain",JPN:"japan",NLD:"netherlands",NOR:"norway",GRC:"greece",
};
const slug = (code) => readable[code] || code.toLowerCase();
const entries = parity.countries.map((country) => `  <url><loc>https://publicspendingdata.org/countries/${slug(country.country_code)}</loc><lastmod>2026-08-27</lastmod></url>`).join("\n");

sitemap = sitemap.replace(/\s*<url><loc>https:\/\/publicspendingdata\.org\/countries\/[^<]+<\/loc><lastmod>[^<]+<\/lastmod><\/url>/g, "");
const anchor = /(<url><loc>https:\/\/publicspendingdata\.org\/eu-capitals\.html<\/loc><lastmod>[^<]+<\/lastmod><\/url>)/;
if (!anchor.test(sitemap)) throw new Error("Sitemap country insertion anchor is missing");
sitemap = sitemap.replace(anchor, `$1\n${entries}`);
await writeFile(sitemapUrl, sitemap);
console.log(`Wrote ${parity.countries.length} country profile URLs to sitemap.xml`);
