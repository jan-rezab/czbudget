import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const exportPath = process.argv[2] || "data/.municipal-headlines-query.json";
const snapshotPath = "data/municipal-snapshot.v1.json";
const requiredStages = ["enacted", "revised", "actual"];
const stageAmountKeys = {
  enacted: ["revenue_approved", "expense_approved"],
  revised: ["revenue_adjusted", "expense_adjusted"],
  actual: ["revenue_actual", "expense_actual"],
};

const rows = JSON.parse(await readFile(exportPath, "utf8"));
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const municipalities = new Map(snapshot.municipalities.map((entity) => [entity.national_id, entity]));
const byIco = new Map();
const lineageByIco = new Map();

for (const row of rows) {
  if (!municipalities.has(row.ico)) throw new Error(`BigQuery returned unknown municipality IČO ${row.ico}`);
  if (!requiredStages.includes(row.budget_stage)) throw new Error(`Unexpected budget stage ${row.budget_stage}`);
  const stages = byIco.get(row.ico) || new Map();
  if (stages.has(row.budget_stage)) throw new Error(`Duplicate ${row.budget_stage} headline for IČO ${row.ico}`);
  stages.set(row.budget_stage, {
    stage: row.budget_stage,
    revenue_czk: Number(row.revenue_total_czk),
    expenditure_czk: Number(row.expenditure_total_czk),
    financing_czk: Number(row.financing_total_czk),
    balance_czk: Number(row.budget_balance_czk),
  });
  byIco.set(row.ico, stages);
  lineageByIco.set(row.ico, {
    source_id: row.source_id,
    ingestion_run_id: row.ingestion_run_id,
    bigquery_table: "czbudget-janrezab.budget_detail.public_entity_budget_headlines",
  });
}

if (byIco.size !== 6254 || rows.length !== 18762) {
  throw new Error(`Expected 18,762 headlines for 6,254 municipalities, received ${rows.length} for ${byIco.size}`);
}

const closeEnough = (left, right) => Math.abs(left - right) <= 0.01;
for (const [ico, entity] of municipalities) {
  const stages = byIco.get(ico);
  if (!stages || requiredStages.some((stage) => !stages.has(stage))) {
    throw new Error(`Incomplete BigQuery budget stages for IČO ${ico}`);
  }
  for (const stage of requiredStages) {
    const [revenueKey, expenditureKey] = stageAmountKeys[stage];
    const headline = stages.get(stage);
    if (!closeEnough(headline.revenue_czk, entity.amounts[revenueKey]) ||
        !closeEnough(headline.expenditure_czk, entity.amounts[expenditureKey])) {
      throw new Error(`Checked-in snapshot differs from BigQuery for IČO ${ico}, stage ${stage}`);
    }
  }

  const entityPath = path.join("data", "entities", `${ico}.json`);
  const payload = JSON.parse(await readFile(entityPath, "utf8"));
  payload.entity.budget_stages = requiredStages.map((stage) => stages.get(stage));
  payload.entity.budget_stage_lineage = lineageByIco.get(ico);
  await writeFile(entityPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

await unlink(exportPath);
console.log(`Merged ${rows.length.toLocaleString("en-US")} BigQuery budget headlines into ${byIco.size.toLocaleString("en-US")} municipal profiles`);
