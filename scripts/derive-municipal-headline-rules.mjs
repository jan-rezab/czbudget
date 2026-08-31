#!/usr/bin/env node
/**
 * Headline rules — the last thing standing between the warehouse and a regenerated profile.
 *
 * A municipality page leads with two numbers: total revenue and total expenditure for the
 * year. The warehouse holds every line that goes into them, but which line *is* the headline
 * differs by country, because each national source totals its own way. Brazil publishes a
 * `TotalReceitas` row at the `actual` stage; Costa Rica publishes a single `TOTAL`; Spain
 * publishes no total at all and the headline is the sum of its parts.
 *
 * Rather than transcribe those rules from the importer by hand — where a misreading would
 * silently move a published figure — each is derived: for a sample of entities per country,
 * every candidate (stage, code) pair is scored against the headline those entities already
 * publish, and the pair that reproduces the most of them wins. A rule that cannot reproduce
 * the existing figures is reported as such rather than written.
 *
 *   node scripts/derive-municipal-headline-rules.mjs --countries CRI,GEO --sample 30
 *   node scripts/derive-municipal-headline-rules.mjs --all --write
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.env.SITE_ROOT || process.cwd();
const TABLE = "`czbudget-janrezab.budget_detail.municipal_budget_line_facts`";
const OUT = "pipeline/config/municipal_headline_rules.json";

// Another session on this machine switches the active gcloud account, and `bq` picks up
// whichever is current at the moment it runs — so the same query succeeds or fails by timing.
// The account is pinned per invocation rather than by changing the shared config, which would
// break that other session in exactly the way this is guarding against.
const BQ_ENV = { ...process.env, CLOUDSDK_CORE_ACCOUNT: process.env.BQ_ACCOUNT || "jan@ravineo.com" };


const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const write = args.includes("--write");
const sampleSize = Number(flag("--sample", 40));

/** The fan-out directory is alpha-3; entity ids in the warehouse are keyed by alpha-2. */
const ALPHA2 = {
  BOL: "BO", BRA: "BR", CHL: "CL", COL: "CO", CRI: "CR", DNK: "DK", ESP: "ES",
  GEO: "GE", GTM: "GT", ITA: "IT", JPN: "JP", KOR: "KR", MEX: "MX", PER: "PE", SLV: "SV",
};

const requested = args.includes("--all")
  ? Object.keys(ALPHA2).filter((code) => code !== "JPN")
  : String(flag("--countries", "CRI")).split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);

async function query(sql) {
  const { stdout } = await run("bq", ["query", "--use_legacy_sql=false", "--format=json", "--max_rows=200000", sql], {
    maxBuffer: 512 * 1024 * 1024, env: BQ_ENV,
  });
  return JSON.parse(stdout || "[]");
}

/** The headline each entity already publishes, read from the profile the site serves today. */
async function publishedHeadlines(country, limit) {
  const directory = path.join(ROOT, "data/municipal-expansion", country.toLowerCase());
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  // An even spread rather than the first N: the files are sorted by code, and the first few of
  // any country tend to share a region, a size band and often a single reporting quirk.
  const step = Math.max(1, Math.floor(files.length / limit));
  const spread = files.filter((_, index) => index % step === 0).slice(0, limit);

  // Then top up per year. Rules are derived per year, and a year used by a small minority is
  // invisible to an even spread: 44 of Brazil's 5,570 municipalities report 2024 rather than
  // 2025, so a 40-entity sample saw none of them and no 2024 rule was derived at all.
  const seenYears = new Map();
  const chosen = new Set(spread);
  for (const file of spread) {
    const profile = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    for (const entry of profile.history || []) seenYears.set(entry.year, (seenYears.get(entry.year) || 0) + 1);
  }
  const perYear = Math.max(8, Math.floor(limit / 4));
  for (const file of files) {
    if (chosen.has(file)) continue;
    if ([...seenYears.values()].every((count) => count >= perYear) && seenYears.size > 1) break;
    const profile = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    const years = (profile.history || [])
      .filter((entry) => Number.isFinite(entry.revenue) || Number.isFinite(entry.expenditure))
      .map((entry) => entry.year);
    if (!years.some((year) => (seenYears.get(year) || 0) < perYear)) continue;
    chosen.add(file);
    for (const year of years) seenYears.set(year, (seenYears.get(year) || 0) + 1);
  }

  const published = new Map();
  for (const file of chosen) {
    const profile = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    for (const year of profile.history || []) {
      if (!Number.isFinite(year.revenue) && !Number.isFinite(year.expenditure)) continue;
      published.set(`${profile.code}|${year.year}`, {
        revenue: Number.isFinite(year.revenue) ? year.revenue : null,
        expenditure: Number.isFinite(year.expenditure) ? year.expenditure : null,
      });
    }
  }
  return { published, codes: [...chosen].map((name) => name.replace(/\.json$/, "")) };
}

const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-6);

const results = [];

for (const country of requested) {
  const alpha2 = ALPHA2[country];
  if (!alpha2) {
    console.log(`${country}: no alpha-2 mapping, skipped`);
    continue;
  }

  const { published, codes } = await publishedHeadlines(country, sampleSize);
  if (!published.size) {
    results.push({ country_code: country, status: "no_published_headline", detail: "the sampled profiles publish no revenue or expenditure" });
    console.log(`${country}: the sampled profiles publish no headline to check a rule against`);
    continue;
  }

  const ids = codes.map((code) => `"${alpha2}:${code}"`).join(",");
  const facts = await query(
    `SELECT public_entity_id, fiscal_year, fiscal_period, budget_stage, budget_side, economic_item_code,`
    + ` SUM(CAST(amount_local AS FLOAT64)) amount`
    // A deduction is a real fact but is not part of the headline it is taken from: Brazil's DCA
    // files a FUNDEB deduction against the same account code, stage and period as the gross
    // revenue it reduces, so anything summing that grain adds the two together.
    + ` FROM ${TABLE} WHERE fiscal_year BETWEEN 2000 AND 2030 AND NOT is_consolidation_item`
    + ` AND public_entity_id IN (${ids})`
    + ` GROUP BY 1,2,3,4,5,6`,
  );

  if (!facts.length) {
    results.push({ country_code: country, status: "not_in_warehouse", detail: `no facts for ${codes.length} sampled entities` });
    console.log(`${country}: not in the warehouse for the sampled entities`);
    continue;
  }

  // Candidate one: a published total row, identified by (stage, code).
  // Candidate two: the sum of every row at a stage, for sources that publish no total.
  // Candidate three: the sum of one level of a coded hierarchy. Spain's item codes are
  // chapter/article/concept nested by length — "1", "16", "162" — and every level restates
  // the one above it, so summing all of them triples the budget. The warehouse does not mark
  // these as summary rows, which is why depth has to be read off the code itself.
  const stageTotals = new Map();
  const depthTotals = new Map();
  for (const fact of facts) {
    const code = fact.public_entity_id.split(":").slice(1).join(":");
    const stageKey = `${code}|${fact.fiscal_year}|${fact.budget_stage}|${fact.fiscal_period}|${fact.budget_side}`;
    stageTotals.set(stageKey, (stageTotals.get(stageKey) || 0) + Number(fact.amount));
    // Only where the code is a nested numeric account — "1", "16", "162". Brazil's codes are
    // words, and "every row whose name happens to be 32 characters" is a coincidence, not a
    // level of a hierarchy; left unrestricted it wins on noise and gets written as a rule.
    if (/^\d{1,6}$/.test(String(fact.economic_item_code))) {
      const depth = String(fact.economic_item_code).length;
      depthTotals.set(`${stageKey}|${depth}`, (depthTotals.get(`${stageKey}|${depth}`) || 0) + Number(fact.amount));
    }
  }

  const years = [...new Set(facts.map((fact) => String(fact.fiscal_year)))].sort();
  const stageVocabulary = [...new Set(facts.map((fact) => fact.budget_stage))];
  const rule = { country_code: country, sample_size: published.size, years: {} };
  for (const year of years) rule.years[year] = {};
  for (const side of ["revenue", "expenditure"]) {
   for (const year of years) {
    const scores = new Map();
    for (const fact of facts) {
      if (fact.budget_side !== side || String(fact.fiscal_year) !== year) continue;
      const code = fact.public_entity_id.split(":").slice(1).join(":");
      const target = published.get(`${code}|${fact.fiscal_year}`);
      if (!target || target[side] === null) continue;
      if (!near(Number(fact.amount), target[side])) continue;
      const candidate = `${fact.budget_stage}@${fact.fiscal_period} ${fact.economic_item_code}`;
      scores.set(candidate, (scores.get(candidate) || 0) + 1);
    }
    // The sum-of-all-rows alternative, scored the same way.
    for (const [key, total] of stageTotals) {
      const [code, rowYear, stage, period, rowSide] = key.split("|");
      if (rowSide !== side || rowYear !== year) continue;
      const target = published.get(`${code}|${rowYear}`);
      if (!target || target[side] === null) continue;
      if (!near(total, target[side])) continue;
      const candidate = `${stage}@${period} *`;
      scores.set(candidate, (scores.get(candidate) || 0) + 1);
    }

    // Candidate four: one stage net of another. Brazil's published expenditure is "despesas
    // liquidadas", which settles this year's commitments and excludes restos a pagar — prior
    // years' commitments carried forward, which the loader classifies as its own stage. The
    // figure is therefore a difference, and no single row anywhere holds it.
    const perCell = new Map();
    for (const fact of facts) {
      if (fact.budget_side !== side || String(fact.fiscal_year) !== year) continue;
      const entity = fact.public_entity_id.split(":").slice(1).join(":");
      const cell = `${entity}|${fact.fiscal_year}|${fact.fiscal_period}|${fact.economic_item_code}`;
      if (!perCell.has(cell)) perCell.set(cell, new Map());
      const stages = perCell.get(cell);
      stages.set(fact.budget_stage, (stages.get(fact.budget_stage) || 0) + Number(fact.amount));
    }
    for (const [cell, stages] of perCell) {
      const [entity, cellYear, period, itemCode] = cell.split("|");
      const target = published.get(`${entity}|${cellYear}`);
      if (!target || target[side] === null) continue;
      for (const [minuend, left] of stages) {
        for (const subtrahend of stageVocabulary) {
          if (minuend === subtrahend) continue;
          // A stage absent from this entity is zero, not a reason to skip: three of the
          // sampled municipalities carry nothing forward, and "committed net of restos a
          // pagar" is the same rule there as everywhere else.
          if (!near(left - (stages.get(subtrahend) || 0), target[side])) continue;
          const candidate = `${minuend}-${subtrahend}@${period} ${itemCode}`;
          scores.set(candidate, (scores.get(candidate) || 0) + 1);
        }
      }
    }

    for (const [key, total] of depthTotals) {
      const [code, rowYear, stage, period, rowSide, depth] = key.split("|");
      if (rowSide !== side || rowYear !== year) continue;
      const target = published.get(`${code}|${rowYear}`);
      if (!target || target[side] === null) continue;
      if (!near(total, target[side])) continue;
      const candidate = `${stage}@${period} #${depth}`;
      scores.set(candidate, (scores.get(candidate) || 0) + 1);
    }

    const eligible = [...published].filter(([key, entry]) => key.endsWith(`|${year}`) && entry[side] !== null).length;
    if (!eligible) { continue; }
    const depthOf = (candidate) => {
      const match = /#(\d+)$/.exec(candidate);
      return match ? Number(match[1]) : Infinity;
    };
    const ranked = [...scores].sort((a, b) => b[1] - a[1] || depthOf(a[0]) - depthOf(b[0]));
    const [best, hits] = ranked[0] || [null, 0];
    if (!best) {
      rule.years[year][side] = { status: "unreproducible", eligible };
      continue;
    }
    const [stagePeriod, code] = best.split(" ");
    const [stageExpression, period] = stagePeriod.split("@");
    const [stage, netOf] = stageExpression.split("-");
    const depth = /^#(\d+)$/.exec(code);
    rule.years[year][side] = {
      stage,
      net_of_stage: netOf || null,
      fiscal_period: period,
      code: code === "*" || depth ? null : code,
      code_length: depth ? Number(depth[1]) : null,
      aggregate: depth ? "sum_at_code_depth" : (code === "*" ? "sum_of_rows" : "single_row"),
      matched: hits,
      eligible,
      match_rate: Number((hits / eligible).toFixed(4)),
      runner_up: ranked[1] ? { rule: ranked[1][0], matched: ranked[1][1] } : null,
    };
    if (args.includes("--explain") && hits / eligible < 0.95) {
      // How many entities have an exact match *somewhere*, against how many agree on where.
      // A figure that is reproducible per entity but at a different stage each time was not
      // taken from one rule; it was taken from whichever row the importer saw first.
      const matchedSomewhere = new Set();
      for (const fact of facts) {
        if (fact.budget_side !== side) continue;
        const entity = fact.public_entity_id.split(":").slice(1).join(":");
        const target = published.get(`${entity}|${fact.fiscal_year}`);
        if (target && target[side] !== null && near(Number(fact.amount), target[side])) matchedSomewhere.add(`${entity}|${fact.fiscal_year}`);
      }
      console.log(`  ${country} ${year} ${side}: best rule agrees on ${hits} of ${eligible}`);
      for (const [candidate, count] of ranked.slice(0, 6)) console.log(`      ${String(count).padStart(4)}  ${candidate}`);
    }
   }
  }
  // Coverage is what share of every published headline one rule per year reproduces.
  for (const side of ["revenue", "expenditure"]) {
    let matched = 0;
    let eligible = 0;
    for (const year of years) {
      const entry = rule.years[year][side];
      if (!entry) continue;
      matched += entry.matched || 0;
      eligible += entry.eligible || 0;
    }
    rule[side] = eligible ? { matched, eligible, match_rate: Number((matched / eligible).toFixed(4)) } : { status: "unreproducible", eligible: 0 };
  }
  results.push(rule);

  const line = (side) => {
    const value = rule[side];
    if (!value || value.status) return `${side}: ${value?.status || "none"}`;
    const per = Object.entries(rule.years)
      .filter(([, entry]) => entry[side])
      .map(([year, entry]) => `${year}:${entry[side].status ? "none" : `${entry[side].stage}${entry[side].net_of_stage ? `-${entry[side].net_of_stage}` : ""}`}`)
      .join(" ");
    return `${side} ${value.matched}/${value.eligible} (${per})`;
  };
  console.log(`${country.padEnd(4)} ${line("revenue").padEnd(46)} ${line("expenditure")}`);
}

const solid = results.filter((r) => r.revenue?.match_rate >= 0.95 && r.expenditure?.match_rate >= 0.95);
console.log(`\n${solid.length} of ${results.length} countries reproduce both published headlines on 95% or more of the sample.`);
for (const row of results.filter((r) => !solid.includes(r))) {
  const rate = (side) => (row[side]?.match_rate === undefined ? row[side]?.status || "none" : `${(row[side].match_rate * 100).toFixed(0)}%`);
  console.log(`  ${row.country_code}: ${row.status || `revenue ${rate("revenue")}, expenditure ${rate("expenditure")}`} — not yet regenerable from the warehouse alone`);
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
    note: "Which warehouse rows are a municipality's headline revenue and expenditure, per country. "
        + "Derived by scoring every candidate (stage, code) against the headline each profile already "
        + "publishes, not transcribed by hand — a misread rule would move a published figure silently. "
        + "`match_rate` is the share of the sample the rule reproduces exactly; anything short of 1.0 "
        + "is a country whose profiles cannot yet be regenerated from the warehouse alone.",
    sample_size: sampleSize,
    countries: results,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`\nWrote ${OUT}`);
