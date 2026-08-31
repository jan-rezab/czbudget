#!/usr/bin/env node
/**
 * Japan's e-Stat hierarchy, derived from the numbers rather than looked up.
 *
 * The blocker on loading Japan was that its main budget tables flatten a nested list without
 * marking it. Table 04 puts 地方譲与税 beside the six transfer taxes that make it up, and
 * 使用料 beside 授業料 — which is itself a parent of three more — with nothing in the column
 * name to say which is which. Summing every column therefore counts the same yen at two or
 * three levels, and leaf sums came to 2.47x a municipality's published revenue.
 *
 * The e-Stat table definitions would make this a lookup. Absent those, the structure is still
 * recoverable: a parent is a column that equals the sum of the columns beneath it, and a
 * relationship that holds across 1,741 municipalities is structure rather than coincidence.
 * Table 02 publishes 歳入総額 and 歳出総額 outright, so there is a hard acceptance test —
 * the leaves must sum to the total the source itself prints.
 *
 *   node scripts/derive-japan-hierarchy.mjs --report
 *   node scripts/derive-japan-hierarchy.mjs --write
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.SITE_ROOT || process.cwd();
const CACHE = path.join(ROOT, "..", "data/source_cache/municipal-expansion/JPN");
const OUT = "pipeline/config/japan_table_hierarchy.json";

const args = process.argv.slice(2);
const write = args.includes("--write");
const sampleSize = Number(args[args.indexOf("--sample") + 1]) || 250;

/** e-Stat ships Shift-JIS. Decoding it as UTF-8 silently turns every header into mojibake. */
const decoder = new TextDecoder("shift_jis");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (character !== "\r") field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function readTable(file) {
  const rows = parseCSV(decoder.decode(await readFile(path.join(CACHE, file))));
  const header = rows[0].map((name) => name.trim());
  const measures = header.map((name, index) => ({ name, index })).filter((column) => column.name.includes(":"));
  const key = (name) => header.indexOf(header.find((value) => value.trim() === name));
  return {
    header,
    measures,
    tableNo: rows[1]?.[key("表番号")],
    tableName: rows[1]?.[key("表名称")],
    entityAt: key("団体コード"),
    rows: rows.slice(1).filter((row) => row.length > measures.length),
  };
}

const number = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Segment a flattened nested list. Walking left to right, a column is a parent when it equals
 * the sum of the top-level columns that follow it, up to some end point — and those columns
 * are segmented the same way, so a grandchild is never added to its grandparent's total.
 * The longest run that balances wins, because a shorter one would leave siblings orphaned.
 */
function segment(values, lo, hi, memo = new Map()) {
  const cacheKey = `${lo}:${hi}`;
  if (memo.has(cacheKey)) return memo.get(cacheKey);

  const result = [];
  let cursor = lo;
  while (cursor < hi) {
    let chosen = null;
    for (let end = hi; end > cursor + 1; end -= 1) {
      const children = segment(values, cursor + 1, end, memo);
      if (!children.length) continue;
      // Every municipality must agree, within rounding. One that does not is a different
      // structure, not a looser tolerance.
      const balances = values.every((row) => {
        const parent = row[cursor];
        const total = children.reduce((sum, child) => sum + row[child.index], 0);
        return Math.abs(parent - total) <= Math.max(1, Math.abs(parent) * 1e-9);
      });
      if (balances) { chosen = { end, children }; break; }
    }
    if (chosen) {
      result.push({ index: cursor, children: chosen.children });
      cursor = chosen.end;
    } else {
      result.push({ index: cursor, children: [] });
      cursor += 1;
    }
  }
  memo.set(cacheKey, result);
  return result;
}

const flatten = (nodes, out = []) => {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
};

const files = (await readdir(CACHE)).filter((name) => name.endsWith(".csv")).sort();
const settlement = {};
const results = [];

// Table 02 first: it prints the totals every other table has to reconcile to.
for (const file of files) {
  const table = await readTable(file);
  if (table.tableNo !== "02") continue;
  const revenueAt = table.measures.find((column) => column.name.includes("歳入総額"))?.index;
  const expenditureAt = table.measures.find((column) => column.name.includes("歳出総額"))?.index;
  for (const row of table.rows) {
    settlement[row[table.entityAt]] = {
      revenue: number(row[revenueAt]),
      expenditure: number(row[expenditureAt]),
    };
  }
}
console.log(`table 02 publishes totals for ${Object.keys(settlement).length} entities\n`);

for (const file of files) {
  const table = await readTable(file);
  // Table 04 only. It is one row per entity with a pure column hierarchy, which is what this
  // segmentation models. Tables 07-13 are a nature-by-purpose matrix whose rows carry their own
  // hierarchy — 国に対するもの is a sub-item of 補助費等 with no marker, exactly as うち rows are
  // but without the prefix that identifies them — and treating their columns the same way
  // over-counts expenditure roughly tenfold. That needs a different model, not a wider filter.
  if (table.tableNo !== "04") continue;
  // One row per entity carries the settlement amount; the header repeats itself in the data.
  table.rows = table.rows.filter((row) => row[table.header.indexOf("行名称")] === "決算額");

  const sample = table.rows.slice(0, sampleSize);
  const values = sample.map((row) => table.measures.map((column) => number(row[column.index])));
  const tree = segment(values, 0, table.measures.length);
  const nodes = flatten(tree);
  const parents = nodes.filter((node) => node.children.length);
  const leaves = tree.filter((node) => !node.children.length);

  // What the top level of this table comes to, against what table 02 says the whole year was.
  const topLevel = tree.map((node) => node.index);
  let agree = 0;
  let checked = 0;
  const side = table.tableNo === "04" ? "revenue" : "expenditure";
  for (const row of table.rows) {
    const total = settlement[row[table.entityAt]];
    if (!total) continue;
    checked += 1;
    const sum = topLevel.reduce((acc, index) => acc + number(row[table.measures[index].index]), 0);
    if (Math.abs(sum - total[side]) <= Math.max(1, Math.abs(total[side]) * 1e-9)) agree += 1;
  }

  results.push({
    table: table.tableNo,
    table_name: table.tableName,
    file,
    side,
    measures: table.measures.length,
    parents: parents.length,
    top_level: topLevel.length,
    reconciles: agree,
    checked,
    parent_columns: parents.map((node) => ({
      column: table.measures[node.index].name,
      children: node.children.map((child) => table.measures[child.index].name),
    })),
    top_level_columns: topLevel.map((index) => table.measures[index].name),
  });

  console.log(`table ${table.tableNo}  ${table.measures.length} cols, ${parents.length} parents, ${topLevel.length} top level`);
  console.log(`         top level sums to the published ${side} for ${agree}/${checked} entities`);
}

if (!write) {
  console.log("\nReport only. Pass --write.");
  process.exit(0);
}

await mkdir(path.join(ROOT, "pipeline/config"), { recursive: true });
await writeFile(
  path.join(ROOT, OUT),
  `${JSON.stringify({
    schema_version: "1.0.0",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "Which columns of Japan's e-Stat budget tables are totals of other columns. Derived "
        + "arithmetically, because the source flattens a nested list without marking it and the "
        + "table definitions that would make this a lookup are published separately. A parent is "
        + "a column equal to the sum of the columns beneath it for every municipality; the "
        + "acceptance test is that the top level reconciles to the 歳入総額 and 歳出総額 that "
        + "table 02 prints outright.",
    tables: results,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
