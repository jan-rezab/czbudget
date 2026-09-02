import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/cz-public-employment.v1.json", "utf8"));
const latest = dataset.history.at(-1);
const number = (value) => new Intl.NumberFormat("en-GB", {maximumFractionDigits: 0}).format(value);

test("public-employment report reconciles the control total and source layers", async ({ page }) => {
  const runtimeErrors = [];
  const datasetRequests = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("request", (request) => {
    if (request.url().includes("cz-public-employment.v1.json")) datasetRequests.push(request.url());
  });

  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "networkidle"});

  await expect(page.locator("h1")).toContainText("Who works");
  await expect(page.locator(".employment-hero-total")).toBeVisible();
  await expect(page.locator("#employment-hero-total")).toHaveText(number(latest.public_sector_fte));
  await expect(page.locator("#employment-history-body tr")).toHaveCount(dataset.history.length);
  await expect(page.locator("#growth")).toBeVisible();
  await expect(page.locator("#employment-growth-split")).toContainText(number(dataset.growth.general_government_change_fte));
  await expect(page.locator("#employment-growth-split")).toContainText(number(dataset.growth.public_corporations_change_fte));
  await expect(page.locator(".employment-growth-limit")).toContainText("This is where the exact 121,744-FTE breakdown ends");
  await expect(page.locator(".employment-growth-limit")).toContainText("independent returns");
  await expect(page.locator("#employment-school-growth")).toContainText(number(dataset.growth.regional_education_evidence.change_fte));
  await expect(page.locator("#employment-regulated-growth .employment-growth-row")).toHaveCount(dataset.growth.state_regulated_comparison.components.length);
  await expect(page.locator("#employment-regulated-growth")).toContainText("+64,633");
  await expect(page.locator("#employment-regulated-growth")).toContainText("+58,347");
  await expect(page.locator("#employment-regulated-growth")).toContainText("-2,130");
  await expect(page.locator("#employment-profession-growth .employment-profession-row")).toHaveCount(dataset.growth.education_profession_comparison.components.length);
  await expect(page.locator("#employment-profession-growth")).toContainText("Teaching assistants");
  await expect(page.locator("#employment-profession-growth")).toContainText("+9,139.2");
  await expect(page.locator("#employment-cost-kpis")).toContainText(number(dataset.compensation.headline.average_monthly_cost_2024_czk));
  await expect(page.locator("#employment-cost-chart svg")).toBeVisible();
  await expect(page.locator("#employment-function-growth .employment-cost-function-rows > article")).toHaveCount(dataset.compensation.change_by_function.length);
  await expect(page.locator("#employment-function-growth .employment-cost-stack-row")).toHaveCount(2);
  await expect(page.locator("#employment-salary-comparison > article")).toHaveCount(dataset.growth.state_regulated_comparison.salary_comparison.length);
  await expect(page.locator("#employment-scope-tabs > button")).toHaveCount(dataset.employment_explorer.scopes.length);
  await expect(page.locator("#employment-scope-tabs")).not.toContainText(number(dataset.headline.public_sector_fte));
  await expect(page.locator("#employment-scope-summary")).toContainText("Exact public-sector total");
  await expect(page.locator("#employment-scope-summary")).toContainText(number(dataset.headline.public_sector_fte));
  await expect(page.locator("#employment-explorer-equation")).toContainText(number(dataset.headline.general_government_fte));
  await expect(page.locator("#employment-explorer-equation")).toContainText(number(dataset.headline.public_corporations_combined_fte));
  await expect(page.locator("#employment-explorer-equation")).toContainText(number(dataset.headline.public_sector_fte));
  await expect(page.locator("#employment-boundary-equation")).toContainText(number(latest.general_government_fte));
  await expect(page.locator("#employment-boundary-equation")).toContainText(number(latest.public_corporations_combined_fte));
  await expect(page.locator("#employment-layer-grid > article")).toHaveCount(dataset.evidence_layers.length);
  await expect(page.locator("#employment-layer-grid")).toContainText("do not add");
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.registered_entities));
  await expect(page.locator("#employment-entity-status")).toContainText(number(dataset.entity_resolution.entities_with_employee_observation));
  expect(latest.public_sector_fte).toBe(latest.general_government_fte + latest.public_corporations_combined_fte);
  expect(dataset.growth.public_sector_change_fte).toBe(dataset.growth.general_government_change_fte + dataset.growth.public_corporations_change_fte);
  expect(dataset.growth.state_regulated_comparison.components.reduce((sum, row) => sum + row.change_employees, 0)).toBe(dataset.growth.state_regulated_comparison.change_employees);
  expect(dataset.compensation.change_by_function.reduce((sum, row) => sum + row.change_czk_m, 0)).toBe(dataset.compensation.headline.change_czk_m);
  expect(dataset.compensation.history.every((row) => row.compensation_employees_czk_m === row.wages_salaries_czk_m + row.employer_social_contributions_czk_m)).toBe(true);
  expect(datasetRequests).toHaveLength(1);
  expect(new URL(datasetRequests[0]).searchParams.get("v")).toBe(dataset.schema_version);
  expect(runtimeErrors).toEqual([]);
});

test("public-employment explorer drills from source scope to profession and organisation", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });

  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "networkidle"});
  const explorer = page.locator("#explorer");
  await expect(explorer).toBeVisible();
  await expect(page.locator("#employment-scope-tabs [aria-pressed=true]")).toContainText("Exact public-sector total");
  await expect(page.locator("#employment-treemap .employment-tile")).toHaveCount(2);
  await expect(page.locator("#employment-explorer-equation")).toContainText("exact match");

  await page.locator('[data-explorer-scope="education_professions"]').click();
  await page.locator('#employment-treemap [data-explorer-node="education_pedagogical"]').click();
  await expect(page.locator("#employment-explorer-breadcrumbs")).toContainText("Pedagogical workers");
  await expect(page.locator("#employment-treemap .employment-tile")).toHaveCount(9);
  await page.locator('#employment-treemap [data-explorer-node="education_assistants"]').click();
  await expect(page.locator("#employment-explorer-detail")).toContainText("Teaching assistants");
  await expect(page.locator("#employment-explorer-detail")).toContainText("+9,139.2");
  await expect(page.locator("#employment-explorer-detail")).toContainText("31,129 CZK");

  await page.locator('[data-explorer-scope="strategic_entities"]').click();
  await expect(page.locator("#employment-scope-summary")).toContainText("Portfolio of 38 entities");
  await expect(page.locator("#employment-scope-summary")).toContainText("This is not the 164,412-FTE public-corporation total");
  await page.locator('#employment-treemap [data-explorer-node="strategic_transport"]').click();
  await page.locator('#employment-treemap [data-explorer-node="entity_70994226"]').click();
  await expect(page.locator("#employment-explorer-detail")).toContainText("České dráhy, a.s.");
  await expect(page.locator("#employment-explorer-detail")).toContainText("IČO 70994226");
  await expect(page.locator("#employment-explorer-detail")).toContainText("13,183");
  expect(await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("every employment explorer tree reconciles within its declared scope", async () => {
  const visit = (node) => {
    if (!node.children?.length) return;
    const childrenTotal = node.children.reduce((sum, child) => sum + child.value, 0);
    expect(Math.abs(childrenTotal - node.value)).toBeLessThanOrEqual(0.11);
    node.children.forEach(visit);
  };
  dataset.employment_explorer.scopes.forEach((scope) => visit(scope.root));
});

test("public-employment English shell releases the paint guard immediately", async ({ page }) => {
  await page.goto("/deep-dives/public-employment/?lang=en", {waitUntil: "domcontentloaded"});
  await expect.poll(
    () => page.locator("html").getAttribute("data-language-pending"),
    { timeout: 1500 },
  ).toBeNull();
  await expect(page.locator("#growth h2")).toBeVisible();
});

test("public-employment report is discoverable from the Czech budget and report index", async ({ page }) => {
  await page.goto("/cesky-rozpocet.html?lang=en", {waitUntil: "networkidle"});
  const bridge = page.locator(".public-employment-bridge");
  await expect(bridge).toBeVisible();
  await expect(bridge).toContainText("New complete employment boundary");
  await expect(bridge).toHaveAttribute("href", /\/deep-dives\/public-employment\/\?lang=en$/);

  await page.goto("/deep-dives/?lang=en", {waitUntil: "networkidle"});
  await expect(page.locator("#public-employment")).toBeVisible();
  await expect(page.locator("#public-employment")).toContainText("Public employment");
});
