import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const writeReport = process.argv.includes("--write-report");
const urls = new Set();

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target));
    else if (entry.name.endsWith(".json")) output.push(target);
  }
  return output;
}

function collect(value, key = "") {
  if (key === "downloaded_from") return; // Historical provenance is immutable; it need not remain a live navigation target.
  if (typeof value === "string" && /^https?:\/\//.test(value) && /(?:url|uri|link|download|page|source)/i.test(key)) urls.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collect(item, key));
  else if (value && typeof value === "object") Object.entries(value).forEach(([childKey, item]) => collect(item, childKey));
}

for (const file of [...await filesBelow(path.join(root, "data")), ...await filesBelow(path.join(root, "lib", "data"))]) {
  collect(JSON.parse(await readFile(file, "utf8")));
}
for (const name of (await readdir(root)).filter((item) => item.endsWith(".html"))) {
  const content = await readFile(path.join(root, name), "utf8");
  for (const match of content.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"']+)/gi)) urls.add(match[1].replaceAll("&amp;", "&"));
}
for (const url of [...urls]) if (/^(?:https:\/\/schema\.org|https:\/\/czbudget-public-)/.test(url)) urls.delete(url);

async function check(url) {
  const options = { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "CZBudget-Link-Integrity/1.0" } };
  try {
    let response = await fetch(url, { ...options, method: "HEAD" });
    if ([400, 405, 501].includes(response.status)) response = await fetch(url, { ...options, headers: { ...options.headers, range: "bytes=0-0" } });
    const status = response.status;
    return { url, status, final_url: response.url, outcome: status === 404 || status === 410 ? "broken" : status >= 200 && status < 400 ? "ok" : [401, 403, 405, 429].includes(status) ? "protected" : "warning" };
  } catch (error) {
    return { url, status: null, final_url: null, outcome: "unverified", error: error.message };
  }
}

const queue = [...urls].sort();
const results = [];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) results.push(await check(queue.shift()));
});
await Promise.all(workers);
results.sort((a, b) => a.url.localeCompare(b.url));
const counts = Object.fromEntries(["ok", "protected", "warning", "broken", "unverified"].map((outcome) => [outcome, results.filter((item) => item.outcome === outcome).length]));
const report = { schema_version: "1.0.0", checked_at: new Date().toISOString(), url_count: results.length, counts, results };
if (writeReport) await writeFile("pipeline/external-link-audit.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(`External link audit: ${JSON.stringify(counts)}`);
for (const item of results.filter((result) => !["ok", "protected"].includes(result.outcome))) console.log(`${item.outcome}\t${item.status ?? "-"}\t${item.url}`);
if (counts.broken) process.exit(1);
