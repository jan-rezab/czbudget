#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const origin = "https://publicspendingdata.org";
const municipalities = path.join(root, "municipalities");
let updated = 0;

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(target);
      continue;
    }
    if (entry.name !== "index.html") continue;
    const html = await readFile(target, "utf8");
    if (!html.includes("data/municipal-benchmarks/") || html.includes('rel="canonical"')) continue;
    const relative = path.relative(root, target).split(path.sep).join("/").replace(/index\.html$/, "");
    const canonical = `${origin}/${relative}`;
    const metadata = `<link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="en" href="${canonical}?lang=en"><link rel="alternate" hreflang="x-default" href="${canonical}">`;
    const output = html.replace('<link rel="stylesheet"', `${metadata}<link rel="stylesheet"`);
    if (output === html) throw new Error(`Could not insert canonical metadata in ${relative}`);
    await writeFile(target, output);
    updated += 1;
  }
}

await visit(municipalities);
console.log(`Backfilled canonical metadata in ${updated} benchmark municipality pages`);
