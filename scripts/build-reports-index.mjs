#!/usr/bin/env node
// Renders the report catalogue from deep-dives/reports.json into the three
// places that used to be maintained by hand and had already drifted apart:
// the cards on deep-dives/index.html, the bilingual card copy in
// deep-dives.js, and the reports menu in global-nav.js.
//
//   node scripts/build-reports-index.mjs           rewrite the generated blocks
//   node scripts/build-reports-index.mjs --check   fail if a block is stale
//
// The generated regions are delimited by BEGIN/END markers. Edit the registry,
// never the region.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const registry = JSON.parse(await readFile(path.join(root, "deep-dives/reports.json"), "utf8"));

const LANGS = ["cs", "en"];
const cap = (value) => value.slice(0, 1).toUpperCase() + value.slice(1);
const escapeHtml = (value) => String(value).replace(/&(?![a-zA-Z#0-9]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeJs = (value) => JSON.stringify(String(value));
const problems = [];

// ---------------------------------------------------------------- copy keys
// One key per string the pages translate at runtime. Report titles and blurbs
// keep their historical key names so report pages that reuse them keep working.
const copy = { cs: {}, en: {} };
const put = (key, pair) => { for (const lang of LANGS) copy[lang][key] = pair[lang]; };

for (const [key, pair] of Object.entries(registry.chrome)) put(key, pair);
for (const shelf of registry.shelves) {
  put(`shelf${cap(shelf.id)}Kicker`, shelf.kicker);
  put(`shelf${cap(shelf.id)}Title`, shelf.title);
  put(`shelf${cap(shelf.id)}Intro`, shelf.intro);
  for (const cluster of shelf.clusters) {
    if (cluster.title) put(`cluster${cap(cluster.id)}Title`, cluster.title);
    if (cluster.intro) put(`cluster${cap(cluster.id)}Intro`, cluster.intro);
  }
}
for (const report of registry.reports) {
  put(report.key, report.title);
  put(`${report.key}Copy`, report.card);
  put(`source${cap(report.key)}`, report.source);
  if (report.place) put(`place${cap(report.key)}`, report.place);
}

// ------------------------------------------------------------- registry sanity
const seen = new Set();
for (const report of registry.reports) {
  if (seen.has(report.slug)) problems.push(`Duplicate report slug: ${report.slug}`);
  seen.add(report.slug);
  const shelf = registry.shelves.find((entry) => entry.id === report.shelf);
  if (!shelf) problems.push(`${report.slug}: unknown shelf ${report.shelf}`);
  else if (!shelf.clusters.some((entry) => entry.id === report.cluster)) problems.push(`${report.slug}: unknown cluster ${report.cluster}`);
  const page = path.join(root, "deep-dives", report.href.split("?")[0], "index.html");
  if (!existsSync(page)) problems.push(`${report.slug}: no page at ${path.relative(root, page)}`);
  if (!report.navPath.startsWith("deep-dives/")) problems.push(`${report.slug}: navPath must start with deep-dives/`);
}
// Every published page must be in the catalogue, so a new report cannot ship orphaned.
const pages = [];
const walk = async (dir) => {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const next = `${dir}/${entry.name}`;
    if (existsSync(path.join(root, next, "index.html"))) pages.push(next.replace(/^deep-dives\//, ""));
    await walk(next);
  }
};
await walk("deep-dives");
const registered = new Set(registry.reports.map((report) => report.href.split("?")[0].replace(/\/$/, "")));
for (const page of pages) if (!registered.has(page)) problems.push(`Page deep-dives/${page}/ is not in reports.json`);

// ------------------------------------------------------------------ index.html
const card = (report) => {
  const place = report.place ? `<em class="deep-card-place" data-deep-copy="place${cap(report.key)}">${escapeHtml(report.place.cs)}</em>` : "";
  return `<a class="deep-card available" id="${report.slug}" data-deep-link href="${report.href}">`
    + `<header><span data-deep-copy="source${cap(report.key)}">${escapeHtml(report.source.cs)}</span><b>${escapeHtml(report.badge)}</b></header>`
    + `${place}<h3 data-deep-copy="${report.key}">${escapeHtml(report.title.cs)}</h3>`
    + `<p data-deep-copy="${report.key}Copy">${escapeHtml(report.card.cs)}</p>`
    + `<strong data-deep-copy="open">${escapeHtml(registry.chrome.open.cs)}</strong></a>`;
};

const contractSection = () => {
  const steps = ["topic", "country", "history", "comparison", "method"];
  return `<section class="deep-contract">`
    + `<div class="deep-section-heading"><div><span class="kicker" data-deep-copy="contract">${escapeHtml(registry.chrome.contract.cs)}</span>`
    + `<h2 data-deep-copy="contractTitle">${escapeHtml(registry.chrome.contractTitle.cs)}</h2></div>`
    + `<p data-deep-copy="contractCopy">${escapeHtml(registry.chrome.contractCopy.cs)}</p></div>`
    + `<div class="deep-contract-grid">`
    + steps.map((step, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><h3 data-deep-copy="${step}">${escapeHtml(registry.chrome[step].cs)}</h3></article>`).join("")
    + `</div></section>`;
};

const shelfSection = (shelf) => {
  const clusters = shelf.clusters.map((cluster) => {
    const cards = registry.reports.filter((report) => report.shelf === shelf.id && report.cluster === cluster.id);
    if (!cards.length) return "";
    const heading = cluster.title
      ? `<div class="deep-cluster-heading"><h3 data-deep-copy="cluster${cap(cluster.id)}Title">${escapeHtml(cluster.title.cs)}</h3>`
        + (cluster.intro ? `<p data-deep-copy="cluster${cap(cluster.id)}Intro">${escapeHtml(cluster.intro.cs)}</p>` : "")
        + `</div>`
      : "";
    return `<div class="deep-cluster">${heading}<div class="deep-card-grid">${cards.map(card).join("")}</div></div>`;
  }).join("");
  return `<section class="deep-index deep-shelf" id="${shelf.id}">`
    + `<div class="deep-section-heading"><div><span class="kicker" data-deep-copy="shelf${cap(shelf.id)}Kicker">${escapeHtml(shelf.kicker.cs)}</span>`
    + `<h2 data-deep-copy="shelf${cap(shelf.id)}Title">${escapeHtml(shelf.title.cs)}</h2></div>`
    + `<p data-deep-copy="shelf${cap(shelf.id)}Intro">${escapeHtml(shelf.intro.cs)}</p></div>`
    + clusters + `</section>`;
};

// The comparison contract only describes the cross-country shelf, so it sits
// between the two shelves rather than at the end of the page.
const indexBlock = registry.shelves
  .map((shelf) => shelfSection(shelf) + (shelf.id === "compare" ? contractSection() : ""))
  .join("\n    ");

// ---------------------------------------------------------------- deep-dives.js
const copyBlock = LANGS.map((lang) => {
  const entries = Object.keys(copy[lang]).map((key) => `${key}:${escapeJs(copy[lang][key])}`).join(",");
  return `  Object.assign(copy.${lang},{${entries}});`;
}).join("\n");

// ---------------------------------------------------------------- global-nav.js
const menuGroups = [];
for (const shelf of registry.shelves) {
  for (const cluster of shelf.clusters) {
    const items = registry.reports.filter((report) => report.shelf === shelf.id && report.cluster === cluster.id);
    if (!items.length) continue;
    // A single-cluster shelf (the regional one) is labelled by the shelf itself.
    const label = cluster.title ?? shelf.title;
    menuGroups.push({ label, items });
  }
}
const navBlock = "  const REPORT_MENU_GROUPS = [\n" + menuGroups.map((group) => {
  const items = group.items.map((report) => `      { path:${escapeJs(report.navPath)}, title:{cs:${escapeJs(report.title.cs)},en:${escapeJs(report.title.en)}}, note:{cs:${escapeJs(report.menu.cs)},en:${escapeJs(report.menu.en)}} },`).join("\n");
  return `    { label:{cs:${escapeJs(group.label.cs)},en:${escapeJs(group.label.en)}}, items: [\n${items}\n    ] },`;
}).join("\n") + "\n  ];";

// ------------------------------------------------------------------- rewriting
const targets = [
  { file: "deep-dives/index.html", begin: "<!-- BEGIN GENERATED REPORTS -->", end: "<!-- END GENERATED REPORTS -->", body: indexBlock },
  { file: "deep-dives.js", begin: "/* BEGIN GENERATED REPORT COPY */", end: "/* END GENERATED REPORT COPY */", body: copyBlock },
  { file: "global-nav.js", begin: "/* BEGIN GENERATED REPORT MENU */", end: "/* END GENERATED REPORT MENU */", body: navBlock },
];

let stale = 0;
for (const target of targets) {
  const file = path.join(root, target.file);
  const current = await readFile(file, "utf8");
  const start = current.indexOf(target.begin);
  const finish = current.indexOf(target.end);
  if (start < 0 || finish < 0) { problems.push(`${target.file}: generated markers are missing`); continue; }
  const next = current.slice(0, start + target.begin.length) + "\n" + target.body + "\n" + current.slice(finish);
  if (next === current) continue;
  stale += 1;
  if (check) problems.push(`${target.file}: generated block is stale, run npm run build:reports-index`);
  else { await writeFile(file, next); console.log(`rewrote ${target.file}`); }
}

// ------------------------------------------- every translated key must resolve
// deep-dives.js is a browser IIFE, so the copy tables are lifted out and
// evaluated on their own rather than imported.
const script = await readFile(path.join(root, "deep-dives.js"), "utf8");
const from = script.indexOf("const copy={");
const to = script.indexOf("const t=copy[lang];");
if (from < 0 || to < 0) problems.push("deep-dives.js: could not locate the copy tables");
else {
  const tables = new Function("document", `${script.slice(from, to)} return copy;`)({ querySelector: () => null });
  const used = new Set();
  for (const page of ["deep-dives/index.html", ...pages.map((page) => `deep-dives/${page}/index.html`)]) {
    const markup = await readFile(path.join(root, page), "utf8");
    for (const match of markup.matchAll(/data-deep-copy="([^"]+)"/g)) used.add(match[1]);
  }
  for (const key of [...used].sort()) {
    for (const lang of LANGS) if (!tables[lang]?.[key]) problems.push(`deep-dives.js: copy key "${key}" has no ${lang} translation`);
  }
  console.log(`${used.size} translated keys checked across ${pages.length + 1} pages`);
}

if (problems.length) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(`\nreports index: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(check
  ? `reports index: ${registry.reports.length} reports in sync`
  : `reports index: ${registry.reports.length} reports, ${stale} block(s) rewritten`);
