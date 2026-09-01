import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateScenario, decodeScenario, encodeScenario, flattenBudget } from "../../budget-planner.js";

const data = JSON.parse(await readFile(new URL("../../data/state-budget-cze-2027-proposal.v1.json", import.meta.url), "utf8"));

test("the normalized functional rows reconcile to the official proposal", () => {
  const scenario = calculateScenario(data);
  assert.equal(flattenBudget(data).length, 26);
  assert.ok(Math.abs(scenario.expenditure - data.headline.expenditure_2027) < 1e-9);
  assert.ok(Math.abs(scenario.revenue - data.headline.revenue_2027) < 1e-9);
  assert.ok(Math.abs(scenario.deficit - data.headline.deficit_2027) < 1e-9);
});

test("spending and revenue choices flow through the budget identity", () => {
  const scenario = calculateScenario(data, new Map([["22", 20], ["41", -10]]), 30);
  assert.ok(Math.abs(scenario.spendingAdjustment - 10) < 1e-9);
  assert.ok(Math.abs(scenario.revenueAdjustment - 30) < 1e-9);
  assert.ok(Math.abs(scenario.deficit - 369) < 1e-9);
  assert.ok(Math.abs(scenario.balance + scenario.deficit) < 1e-9);
});

test("a category cannot be reduced below zero", () => {
  const item = flattenBudget(data).find((row) => row.id === "24");
  const scenario = calculateScenario(data, new Map([["24", -100]]));
  const adjusted = scenario.items.find((row) => row.id === "24");
  assert.equal(adjusted.scenario, 0);
  assert.equal(adjusted.adjustment, -item.amount_2027);
});

test("scenario state has a stable URL representation", () => {
  const encoded = encodeScenario(new Map([["41", -10.5], ["22", 20], ["35", 0]]));
  assert.equal(encoded, "22:20,41:-10.5");
  assert.deepEqual([...decodeScenario(encoded)], [["22", 20], ["41", -10.5]]);
});
