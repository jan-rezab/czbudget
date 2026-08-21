import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const breakdownExportPath = process.argv[2] || "data/.municipal-breakdowns-query.json";
const codebookExportPath = process.argv[3] || "data/.municipal-budget-codebook-query.json";
const entitiesDir = process.argv[4] || path.join("data", "entities");
const codebookPath = process.argv[5] || path.join("data", "municipal-budget-codebook.v1.json");
const requiredStages = ["enacted", "revised", "actual"];
const requiredDimensions = ["purpose_expenditure", "economic_revenue", "economic_expenditure"];
const allowedDimensions = [...requiredDimensions, "economic_financing"];

const rows = JSON.parse(await readFile(breakdownExportPath, "utf8"));
const codebookRows = JSON.parse(await readFile(codebookExportPath, "utf8"));
const byIco = new Map();

for (const row of rows) {
  if (!requiredStages.includes(row.budget_stage)) throw new Error(`Unexpected budget stage ${row.budget_stage}`);
  if (!allowedDimensions.includes(row.dimension)) throw new Error(`Unexpected breakdown dimension ${row.dimension}`);
  const entries = JSON.parse(row.entries_json).map(({ code, amount_czk }) => [code, Number(amount_czk)]);
  if (entries.some(([code, amount]) => !code || !Number.isFinite(amount))) {
    throw new Error(`Invalid ${row.dimension} entry for IČO ${row.ico}`);
  }
  const entity = byIco.get(row.ico) || {
    public_entity_id: row.public_entity_id,
    fiscal_period: row.fiscal_period,
    source_id: row.source_id,
    ingestion_run_id: row.ingestion_run_id,
    stages: new Map(),
  };
  const stage = entity.stages.get(row.budget_stage) || {};
  if (stage[row.dimension]) throw new Error(`Duplicate ${row.dimension}/${row.budget_stage} for IČO ${row.ico}`);
  stage[row.dimension] = entries;
  stage[`${row.dimension}_total_czk`] = Number(row.total_czk);
  entity.stages.set(row.budget_stage, stage);
  byIco.set(row.ico, entity);
}

if (byIco.size !== 6254) throw new Error(`Expected breakdowns for 6,254 municipalities, received ${byIco.size}`);

const closeEnough = (left, right) => Math.abs(left - right) <= 0.01;
for (const [ico, breakdown] of byIco) {
  const entityPath = path.join(entitiesDir, `${ico}.json`);
  const payload = JSON.parse(await readFile(entityPath, "utf8"));
  const headlines = new Map((payload.entity.budget_stages || []).map((stage) => [stage.stage, stage]));
  if (headlines.size !== requiredStages.length) throw new Error(`Missing budget headlines before breakdown merge for IČO ${ico}`);

  const stages = {};
  for (const stageName of requiredStages) {
    const stage = breakdown.stages.get(stageName);
    if (!stage || requiredDimensions.some((dimension) => !stage[dimension])) {
      throw new Error(`Incomplete ${stageName} breakdown for IČO ${ico}`);
    }
    stage.economic_financing ||= [];
    stage.economic_financing_total_czk ??= 0;
    const headline = headlines.get(stageName);
    if (!closeEnough(stage.purpose_expenditure_total_czk, headline.expenditure_czk) ||
        !closeEnough(stage.economic_expenditure_total_czk, headline.expenditure_czk) ||
        !closeEnough(stage.economic_revenue_total_czk, headline.revenue_czk) ||
        !closeEnough(stage.economic_financing_total_czk, headline.financing_czk)) {
      throw new Error(`Detailed breakdown does not reconcile with ${stageName} headline for IČO ${ico}`);
    }
    stages[stageName] = stage;
  }

  payload.entity.budget_breakdown = {
    fiscal_year: 2025,
    fiscal_period: breakdown.fiscal_period,
    currency_code: "CZK",
    codebook_path: "/data/municipal-budget-codebook.v1.json",
    stages,
    lineage: {
      source_id: breakdown.source_id,
      ingestion_run_id: breakdown.ingestion_run_id,
      bigquery_table: "czbudget-janrezab.budget_detail.municipal_budget_line_facts",
      consolidation_rule: "Internal-transfer rows are excluded; financing summary rows are excluded.",
    },
  };
  await writeFile(entityPath, `${JSON.stringify(payload)}\n`, "utf8");
}

const codebook = {
  schema_version: "1.0.0",
  fiscal_year: 2025,
  language_note_en: "Detailed names are official Czech budget-classification labels.",
  dimensions: { purpose: {}, economic: {} },
};
for (const row of codebookRows) {
  if (!codebook.dimensions[row.dimension] || !row.code || !row.name_cs) {
    throw new Error(`Invalid codebook row ${JSON.stringify(row)}`);
  }
  codebook.dimensions[row.dimension][row.code] = { cs: row.name_cs };
}
if (Object.keys(codebook.dimensions.purpose).length < 380 || Object.keys(codebook.dimensions.economic).length < 350) {
  throw new Error("Municipal budget codebook is unexpectedly incomplete");
}
await writeFile(codebookPath, `${JSON.stringify(codebook)}\n`, "utf8");

await Promise.all([unlink(breakdownExportPath), unlink(codebookExportPath)]);
console.log(`Merged detailed budget breakdowns into ${byIco.size.toLocaleString("en-US")} municipal profiles`);
